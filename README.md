# Internal Chat System

Sistema interno de chat en tiempo real entre usuarios autenticados, construido con una arquitectura de microservicios (GraphQL para perfil, Socket.IO para chat, gRPC entre el Gateway y Profile Service). Proyecto de práctica de system design.

## Qué hace

- Login con Google vía Auth0.
- Chat 1 a 1 en tiempo real entre compañeros.
- Alerta en tiempo real (evento `messageReceived` de Socket.IO) cuando llega un mensaje nuevo.
- Todo containerizado con Docker, se levanta con un solo comando (`docker compose up`).

**Sin frontend** — es un proyecto de práctica de arquitectura backend. Todo se prueba con **Insomnia** (soporta GraphQL, Socket.IO y gRPC nativamente).

## Stack

- **Auth**: Auth0 (OAuth 2.0 / OIDC + Google)
- **API**: GraphQL en el Gateway, con resolvers manuales (sin Federation)
- **Comunicación interna**: gRPC (Gateway ↔ Login/Profile Service)
- **Tiempo real**: Socket.IO (eventos con ack + rooms por canal)
- **Base de datos**: PostgreSQL (una base por servicio)
- **Cache**: Redis (perfil de usuario)
- **Infra**: Docker + Docker Compose

## Arquitectura

```mermaid
flowchart LR
    Ins["Insomnia<br/>(cliente de prueba)"]
    A0["Auth0<br/>(OAuth2/OIDC + Google)"]

    Ins <-->|"1 . Device Auth Flow<br/>login con Google"| A0

    subgraph GW["Gateway"]
        direction TB
        GQL["GraphQL Resolvers<br/>(perfil)"]
        SIO["Socket.IO ChatGateway<br/>(chat)"]
        TORM[("TypeORM")]
    end

    Ins -->|"2 . query miPerfil<br/>Authorization: Bearer JWT"| GQL
    Ins <-->|"3 . socket connect + eventos<br/>handshake.auth.token = JWT"| SIO

    GQL -->|gRPC| PS
    SIO --> TORM
    TORM --> DBC[("PostgreSQL<br/>db_chat")]

    subgraph PS["Profile Service"]
        direction TB
        GRPC["gRPC Controller"]
        R[("Redis<br/>cache de perfil")]
    end

    GRPC --> R
    GRPC --> DBP[("PostgreSQL<br/>db_profile")]

    SIO -.->|"messageReceived<br/>(room por canal)"| Ins
```

El Gateway persiste el chat directo (sin ningún proceso intermedio); Profile Service sigue siendo el único servicio externo real, por gRPC.

Documentación técnica completa, con el flujo detallado de un mensaje y las decisiones de diseño: [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md).

### Chat — estructura y flujo de un mensaje

`gateway/src/chat/` completo: quién arma a quién, y qué pasa desde que un cliente manda `sendMessage` hasta que el otro lo recibe.

```mermaid
flowchart TD
    subgraph ChatDir["gateway/src/chat/"]
        CM["chat.module.ts"]
        CG["chat.gateway.ts<br/>WebSocketGateway"]
        CS["chat.service.ts"]
        ME["message.entity.ts<br/>Entity messages"]
    end

    VT["auth/verify-auth0-token.ts"]
    Cliente(["Cliente Socket.IO"])
    Room[("room del canal")]
    DB[("PostgreSQL db_chat")]
    Otros(["otros clientes unidos al canal"])

    CM -->|provee| CG
    CM -->|provee| CS
    CM -->|TypeOrmModule forFeature| ME

    Cliente -->|"connect: handshake.auth.token"| CG
    CG -->|verifyAuth0Token| VT
    VT -->|"sub del JWT, guardado en socket.data.userId"| CG

    Cliente -->|"joinChannel: channelId"| CG
    CG -->|"socket.join del room"| Room

    Cliente -->|"sendMessage: recipientId, content"| CG
    CG -->|"chatService.sendMessage"| CS
    CS -->|"channelId: ids ordenados y unidos"| CS
    CS -->|messageRepo save| ME
    ME --> DB
    CS -->|Message creado| CG
    CG -->|"emit messageReceived"| Room
    Room --> Otros

    Cliente -->|"getMessages: channelId"| CG
    CG -->|"chatService.getMessages"| CS
    CS -->|"find por channelId, orden createdAt asc"| DB
```

Puntos clave: el `channelId` nunca se persiste ni se busca — se deriva ordenando los dos IDs, así da igual quién le escribe a quién. El `senderId` que manda el cliente se ignora siempre; se usa el `sub` validado del JWT. Si el destinatario no está conectado, el mensaje queda igual en `db_chat` y lo recupera con `getMessages` al reconectar.

### Auth — validación de JWT (HTTP y WebSocket)

Dos caminos distintos porque el handshake de un socket no pasa por middleware de Express: en GraphQL la validación es automática (`express-oauth2-jwt-bearer`), en Socket.IO es manual (`auth/verify-auth0-token.ts`).

```mermaid
sequenceDiagram
    participant U as Usuario
    participant Ins as Insomnia
    participant A0 as Auth0 (Google)
    participant GW as Gateway
    participant JWKS as Auth0 JWKS

    Note over Ins,A0: Login — Device Authorization Flow
    Ins->>A0: solicita device code
    A0-->>Ins: verification_uri + user_code
    U->>A0: autoriza en el navegador (Google)
    A0-->>Ins: access_token (JWT)

    Note over Ins,GW: GraphQL (HTTP) — validación automática
    Ins->>GW: query miPerfil (Authorization: Bearer JWT)
    GW->>JWKS: middleware global valida firma/issuer/audience
    JWKS-->>GW: OK
    alt primer login (Profile Service responde NOT_FOUND)
        GW->>A0: GET /userinfo (mismo access token)
        A0-->>GW: email, name, picture
        GW->>GW: UpsertProfile por gRPC
    end
    GW-->>Ins: Profile

    Note over Ins,GW: Socket.IO — validación manual
    Ins->>GW: connect (handshake.auth.token = JWT)
    GW->>GW: verifyAuth0Token(token)
    GW->>JWKS: getSigningKey(kid)
    JWKS-->>GW: clave pública (RS256)
    GW->>GW: jwt.verify(token, key, {audience, issuer})
    alt token inválido o ausente
        GW-->>Ins: emit('error') + disconnect
    else válido
        GW->>GW: socket.data.userId = sub
        GW-->>Ins: conexión aceptada
    end
```

Orden de construcción del proyecto, por fases: [`docs/PLAN_IMPLEMENTACION.md`](./docs/PLAN_IMPLEMENTACION.md).

## Servicios

| Servicio | Rol | Protocolo |
|---|---|---|
| `gateway` | Valida auth, expone perfil y chat, persiste el chat directo en Postgres | GraphQL + Socket.IO hacia el cliente |
| `profile-service` | Perfil de usuario | gRPC |

## Cómo correr el proyecto

Copiar `.env.example` → `.env` en `gateway/` y `profile-service/` (Auth0 ya viene con los valores de este proyecto), y despues:

```bash
docker compose up
```

Levanta Postgres, Redis, `profile-service` y `gateway` — este último queda escuchando en `localhost:4001`.

## Estructura del repo

```
.
├── docs/
│   ├── ARQUITECTURA.md
│   └── PLAN_IMPLEMENTACION.md
├── postgres/
│   └── init.sql
├── gateway/            # Nest — GraphQL + Auth0 + cliente gRPC + Socket.IO/chat (TypeORM)
├── profile-service/    # Nest — gRPC + TypeORM + Redis
└── docker-compose.yml
```
