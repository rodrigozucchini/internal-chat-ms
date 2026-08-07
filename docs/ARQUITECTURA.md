# Arquitectura del Sistema

Documento técnico de implementación. Para una descripción general del proyecto, ver el [README](../README.md).

## 1. Descripción

Sistema interno de chat en tiempo real entre usuarios autenticados. Arquitectura de microservicios containerizados, sin GraphQL Federation — el Gateway combina los servicios con resolvers manuales. Construido como proyecto de práctica de system design.

## 2. Diagrama de flujo

```
[Cliente de prueba: Insomnia]
      │
  (Auth0 JWT + Google)
      │
      ▼
┌───────────────┐
│   Gateway     │──────► [ Rate Limiter en memoria — solo en `miPerfil` ]
│ (resolvers    │
│  manuales)    │
└──────┬────────┘
       │
       ├──gRPC──────► [ Login/Profile Service ] ──► [ Cache Perfil (Redis) ] ──► [ PostgreSQL: db_profile ]
       │
       └──GraphQL───► [ Chat Service ] ──► [ PostgreSQL: db_chat ]
                            │
                            ├──► [ Redis Pub/Sub ] (sincroniza instancias)
                            │
                            └──► GraphQL Subscription (WebSocket) ──► otros clientes conectados
```

El Gateway expone **una sola API GraphQL** hacia el cliente. Por dentro, sus resolvers llaman a cada servicio con el protocolo que le corresponde y combinan la respuesta — no hay stitching automático de schemas.

### Flujo detallado de un mensaje

1. El cliente A envía un mensaje mediante una **mutation** GraphQL contra el Gateway.
2. El Gateway rutea al Chat Service (GraphQL directo), que valida el request y **persiste el mensaje** en `db_chat`.
3. Publica el evento en **Redis Pub/Sub**, para que todas las instancias del Chat Service se enteren, no solo la que atendió el mutation.
4. La instancia que mantiene la conexión WebSocket del cliente B dispara la **subscription** correspondiente y le empuja el mensaje en tiempo real.
5. Si B está conectado: lo recibe al instante + alerta in-app (badge/toast) en la misma conexión.
6. Si B no está conectado: el mensaje queda persistido; al reconectar, lo obtiene con un fetch normal de historial.
7. Si la respuesta necesita datos de perfil (ej: nombre del que envió), el Gateway le pega por **gRPC** al Login/Profile Service y combina ambas respuestas antes de devolverle todo al cliente.

## 3. Servicios

| Servicio | Responsabilidad | Protocolo interno | Contenedor |
|---|---|---|---|
| **Gateway** | Valida JWT de Auth0, rate limiting, combina las respuestas de los demás servicios con resolvers manuales | GraphQL (hacia el cliente) | `gateway` |
| **Login/Profile Service** | Datos de perfil de usuario | gRPC | `profile-service` |
| **Chat Service** | Canales, mensajes, conexiones WebSocket, subscriptions, publica a Redis Pub/Sub | GraphQL | `chat-service` |

### Database per service

Cada servicio tiene su **propia base de datos lógica** (`db_profile` y `db_chat`), aunque ambas corran sobre el mismo contenedor de PostgreSQL. El Chat Service nunca lee directamente las tablas de usuarios del Login/Profile Service — si necesita ese dato, se lo pide al Gateway, que a su vez lo obtiene por gRPC. Compartir tablas entre servicios rompe el aislamiento que justifica tener microservicios separados en primer lugar.

## 4. Stack tecnológico

| Capa / Módulo | Tecnología | Patrón / Tema de System Design |
|---|---|---|
| Autenticación | Auth0 (OAuth 2.0 / OIDC + Google) | Seguridad — validación de JWT, RBAC |
| API Gateway | GraphQL con resolvers manuales (sin Federation) | Comunicación — agregación manual entre servicios |
| Login/Profile Service ↔ Gateway | gRPC | Comunicación interna tipada (`.proto`) |
| Resiliencia | `@nestjs/throttler`, en memoria, aplicado solo a `miPerfil` | Rate limiting por usuario — sin Redis porque no hay load balancer que requiera un contador compartido entre instancias |
| Caché | Redis (perfil de usuario — key-value, TTL) | Reducción de latencia en lookups repetidos |
| Tiempo real | GraphQL Subscriptions sobre WebSocket (`graphql-ws`) | Comunicación bidireccional persistente |
| Escalado del chat | Redis Pub/Sub | Sincronización de eventos entre instancias |
| Persistencia | PostgreSQL — una base por servicio | Bases de datos relacional |
| Contenerización | Docker + Docker Compose | Orquestación local, aislamiento por servicio |

## 5. Contenedores

```yaml
services:
  gateway
  profile-service
  chat-service
  postgres      # con dos databases: db_profile, db_chat
  redis
```

Cada servicio de aplicación (`gateway`, `profile-service`, `chat-service`) tiene su propia imagen y `Dockerfile`, orquestados en conjunto mediante `docker-compose.yml` para levantar todo el entorno de desarrollo con un solo comando.

## 6. Seguridad

**Validación de JWT**: el Gateway usa el middleware oficial de Auth0 (`express-oauth2-jwt-bearer`), aplicado globalmente — protege toda la API GraphQL, no query por query. Se evaluó una versión con Passport (`@nestjs/passport` + `passport-jwt` + `jwks-rsa`) y una versión con guard manual, pero se optó por el paquete oficial: menos código propio, y la validación de identidad queda a cargo del mismo proveedor de identidad.


- **En tránsito**: TLS/WSS para todas las conexiones, incluyendo el WebSocket — nadie puede interceptar mensajes viajando por la red.
- **En reposo**: cifrado a nivel de disco en PostgreSQL (activado por defecto en la mayoría de los proveedores cloud administrados).
- **Mensajes**: se almacenan legibles por el backend (no hay cifrado de extremo a extremo) — es el mismo nivel de seguridad que herramientas internas como Slack o Teams. E2EE (tipo Signal/WhatsApp) queda deliberadamente fuera por la complejidad que agrega (manejo de claves, protocolo Double Ratchet) sin un beneficio real para un chat interno entre compañeros.
- **Acceso a datos**: cada servicio opera solo sobre su propia base de datos, con credenciales separadas — principio de mínimo privilegio.

## 7. Alertas

Sin frontend, la "alerta" es simplemente el **evento de la subscription** entregado por WebSocket apenas llega un mensaje — cualquier cliente conectado a esa subscription (Insomnia, un script, o a futuro una UI) lo recibe en tiempo real. No hay badge/toast porque no hay interfaz que lo renderice todavía; eso queda para cuando exista un frontend. Push notifications del sistema operativo (Web Push API + Service Worker) tampoco se implementan en esta fase.

## 8. Sin frontend — cómo se prueba el sistema

Este proyecto se construye y valida sin interfaz web. Todo se prueba con **Insomnia**, que soporta nativamente los tres protocolos que usa el sistema:

- **GraphQL** (queries y mutations) contra el Gateway
- **GraphQL Subscriptions** (tiempo real, sobre WebSocket) contra el Gateway
- **gRPC** — importando el `.proto` del Login/Profile Service, para probarlo aislado sin pasar por el Gateway

Para el login, la Application en Auth0 es de tipo **Native** con **Device Authorization Flow** — el mismo mecanismo que usa `gh auth login`: se abre el navegador una sola vez para autorizar, y devuelve un JWT real que se usa en los requests de Insomnia. No requiere ninguna pantalla de login propia.
