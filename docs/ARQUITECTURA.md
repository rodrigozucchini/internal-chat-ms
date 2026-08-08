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
┌────────────────┐
│    Gateway      │
│ (GraphQL manual  │
│  + Socket.IO)    │
└──────┬───────────┘
       │
       ├──gRPC───────► [ Login/Profile Service ] ──► [ Cache Perfil (Redis) ] ──► [ PostgreSQL: db_profile ]
       │
       └──Socket.IO──► [ Chat Service ] ──► [ PostgreSQL: db_chat ]
                             │
                             └──► rooms por channelId ──► otros clientes conectados al mismo canal
```

El Gateway es el único punto de entrada del cliente: expone **GraphQL** para lo que es request/response puro (perfil) y **Socket.IO** para lo que es tiempo real (chat). Por dentro, sus resolvers/gateways llaman a cada servicio con el protocolo que le corresponde y combinan la respuesta — no hay stitching automático de schemas, ni un broker externo para el chat.

### Flujo detallado de un mensaje

1. El cliente A se conecta al Gateway por Socket.IO, autenticando el handshake con su JWT de Auth0 (el Gateway lo valida a mano contra el JWKS de Auth0 y guarda el `sub` en la conexión). Al aceptar la conexión, el Gateway abre **su propia conexión Socket.IO hacia Chat Service, una por cada cliente conectado** — no una única conexión compartida entre todos.
2. El cliente A hace `join` a la sala de su canal y emite el evento `sendMessage`; el Gateway reenvía ambos eventos 1 a 1 por esa conexión emparejada, sin guardar ningún estado de rooms propio — solo cambia el `senderId` que venga del cliente por el `sub` real del JWT antes de reenviar.
3. Chat Service recibe la conexión del Gateway como si fuera un cliente más: hace el `join` real a la sala del canal, **persiste el mensaje** en `db_chat` y hace `io.to(room).emit('messageReceived', ...)` sobre su propio servidor de sockets — ahí vive el reparto real a todos los que están en ese canal.
4. Cada conexión emparejada del Gateway que esté en esa sala recibe el evento y lo reenvía, también 1 a 1, al cliente que le corresponde (por ejemplo, el cliente B).
5. Si B no está conectado en ese momento: el mensaje queda persistido igual; al reconectar, lo pide con el evento `getMessages` (con ack), que trae el historial completo del canal.
6. Si la respuesta necesita datos de perfil (ej: nombre del que envió), el Gateway le pega por **gRPC** al Login/Profile Service y combina ambas respuestas antes de devolverle todo al cliente.

## 3. Servicios

| Servicio | Responsabilidad | Protocolo interno | Contenedor |
|---|---|---|---|
| **Gateway** | Valida JWT de Auth0, combina las respuestas de los demás servicios con resolvers/gateways manuales | GraphQL (perfil) + Socket.IO (chat) hacia el cliente | `gateway` |
| **Login/Profile Service** | Datos de perfil de usuario | gRPC | `profile-service` |
| **Chat Service** | Canales, mensajes, conexiones Socket.IO, rooms por canal | Socket.IO | `chat-service` |

### Primer login — auto-provisioning

Cuando un usuario se loguea por primera vez, no existe todavía un registro suyo en `db_profile`. El resolver `miPerfil` del Gateway maneja esto así: intenta `GetProfile` por gRPC; si Profile Service responde `NOT_FOUND`, el Gateway le pide los datos del usuario a Auth0 (`GET /userinfo`, con el mismo access token — el access token en sí no trae email/nombre/foto, solo el `sub`) y llama a `UpsertProfile` para crear el registro. Las siguientes veces, `GetProfile` ya lo encuentra directo.

### Database per service

Cada servicio tiene su **propia base de datos lógica** (`db_profile` y `db_chat`), aunque ambas corran sobre el mismo contenedor de PostgreSQL. El Chat Service nunca lee directamente las tablas de usuarios del Login/Profile Service — si necesita ese dato, se lo pide al Gateway, que a su vez lo obtiene por gRPC. Compartir tablas entre servicios rompe el aislamiento que justifica tener microservicios separados en primer lugar.

## 4. Stack tecnológico

| Capa / Módulo | Tecnología | Patrón / Tema de System Design |
|---|---|---|
| Autenticación | Auth0 (OAuth 2.0 / OIDC + Google) | Seguridad — validación de JWT, RBAC |
| API Gateway | GraphQL con resolvers manuales (sin Federation) para perfil | Comunicación — agregación manual entre servicios |
| Login/Profile Service ↔ Gateway | gRPC | Comunicación interna tipada (`.proto`) |
| Caché | Redis (perfil de usuario — key-value, TTL) | Reducción de latencia en lookups repetidos |
| Tiempo real | Socket.IO — eventos con ack (`sendMessage`, `getMessages`) + rooms por canal (`messageReceived`) | Comunicación bidireccional persistente |
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

Sin frontend, la "alerta" es simplemente el **evento `messageReceived`** de Socket.IO, entregado por WebSocket apenas llega un mensaje — cualquier cliente unido a esa sala (Insomnia, un script, o a futuro una UI) lo recibe en tiempo real. No hay badge/toast porque no hay interfaz que lo renderice todavía; eso queda para cuando exista un frontend. Push notifications del sistema operativo (Web Push API + Service Worker) tampoco se implementan en esta fase.

## 8. Sin frontend — cómo se prueba el sistema

Este proyecto se construye y valida sin interfaz web. Todo se prueba con **Insomnia**, que soporta nativamente los protocolos que usa el sistema:

- **GraphQL** (query `miPerfil`) contra el Gateway
- **Socket.IO** (`joinChannel`, `sendMessage`, `getMessages`, `messageReceived`) contra el Gateway — Insomnia tiene un cliente Socket.IO propio; también hay scripts de prueba (`test-chat-client.js` en cada servicio) para probarlo desde la terminal
- **gRPC** — importando el `.proto` del Login/Profile Service, para probarlo aislado sin pasar por el Gateway

Para el login, la Application en Auth0 es de tipo **Native** con **Device Authorization Flow** — el mismo mecanismo que usa `gh auth login`: se abre el navegador una sola vez para autorizar, y devuelve un JWT real que se usa en los requests de Insomnia. No requiere ninguna pantalla de login propia.
