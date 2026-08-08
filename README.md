# Internal Chat System

Sistema interno de chat en tiempo real entre usuarios autenticados, construido con una arquitectura de microservicios (GraphQL + gRPC, sin Federation). Proyecto de práctica de system design.

## Qué hace

- Login con Google vía Auth0.
- Chat 1 a 1 en tiempo real entre compañeros.
- Alerta en tiempo real (evento de subscription) cuando llega un mensaje nuevo.
- Todo containerizado con Docker, pensado para levantar el entorno completo con un solo comando.

**Sin frontend** — es un proyecto de práctica de arquitectura backend. Todo se prueba con **Insomnia** (soporta GraphQL, GraphQL Subscriptions y gRPC nativamente).

## Stack

- **Auth**: Auth0 (OAuth 2.0 / OIDC + Google)
- **API**: GraphQL en el Gateway, con resolvers manuales (sin Federation)
- **Comunicación interna**: gRPC (Gateway ↔ Login/Profile Service)
- **Tiempo real**: GraphQL Subscriptions sobre WebSocket
- **Base de datos**: PostgreSQL (una base por servicio)
- **Cache**: Redis (perfil de usuario) + Redis Pub/Sub (sincronizar Chat Service entre instancias)
- **Infra**: Docker + Docker Compose

## Arquitectura

```
Insomnia ─► Auth0 ─► Gateway (GraphQL, resolvers manuales)
                        │
              ┌─────────┴─────────┐
           gRPC                GraphQL
              ▼                   ▼
     Login/Profile Service   Chat Service
              │                   │
         db_profile            db_chat
                                  │
                          Redis Pub/Sub ──► WebSocket ──► otros clientes
```

Documentación técnica completa, con el flujo detallado de un mensaje y las decisiones de diseño: [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md).

Orden de construcción del proyecto, por fases: [`docs/PLAN_IMPLEMENTACION.md`](./docs/PLAN_IMPLEMENTACION.md).

## Servicios

| Servicio | Rol | Protocolo |
|---|---|---|
| `gateway` | Valida auth, combina las respuestas de los demás servicios | GraphQL hacia el cliente |
| `profile-service` | Perfil de usuario | gRPC |
| `chat-service` | Canales, mensajes, WebSocket | GraphQL |

## Cómo correr el proyecto

```bash
docker compose up
```

*(instrucciones detalladas de setup, variables de entorno y configuración de Auth0 — pendiente)*

## Estructura del repo

```
.
├── docs/
│   ├── ARQUITECTURA.md
│   └── PLAN_IMPLEMENTACION.md
├── postgres/
│   └── init.sql
├── gateway/            # Nest — GraphQL + Auth0 + cliente gRPC
├── profile-service/    # Nest — gRPC + TypeORM + Redis
├── chat-service/       # pendiente (Fase 3)
└── docker-compose.yml
```
