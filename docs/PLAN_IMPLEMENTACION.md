# Plan de Implementación

Orden sugerido para construir el proyecto en pasos chicos y probables, sin tener que integrar todo junto desde el principio. Cada fase termina en algo que se puede probar de forma aislada.

## Fase 0 — Setup base
- Estructura de carpetas: `gateway/`, `profile-service/`, `chat-service/`
- `docker-compose.yml` inicial con solo `postgres` y `redis` (los servicios de app se suman después)
- Cuenta en Auth0: tenant, aplicación, conexión social con Google, configuración del JWT

## Fase 1 — Login/Profile Service (gRPC)
- [x] Inicializar el proyecto con Nest CLI
- [x] Definir el `.proto` (mensaje `Profile`, RPCs `GetProfile` / `UpsertProfile`)
- [x] Instalar dependencias: `@nestjs/microservices`, `@grpc/grpc-js`, `@grpc/proto-loader`, `@nestjs/typeorm` + `pg`, `ioredis`
- [x] Configurar el microservicio gRPC en `main.ts`
- [x] Módulo Profile: handler con `@GrpcMethod`, service, entidad `User` (TypeORM) conectada a `db_profile`
- [x] Cache de perfil en Redis (TTL) — se consulta antes de ir a Postgres — probado: hit/miss funciona, TTL de 5 min confirmado
- [x] Probar con Insomnia (importando el `.proto`) — sin Gateway todavía

## Fase 2 — Gateway básico + Auth0
- [x] Servidor GraphQL mínimo — probado: `{ ping }` responde `pong` en `localhost:4001/graphql`
- [x] Middleware que valida el JWT de Auth0 — con `express-oauth2-jwt-bearer` (paquete oficial), protege todo el Gateway; probado: rechaza requests sin token con 401
- [~] ~~Rate limiter~~ — implementado con `@nestjs/throttler` y después **removido del proyecto**: no se necesita para este alcance
- [x] Resolver que llama a Profile Service por gRPC (query `miPerfil`) — probado: rechaza sin token, gRPC client conecta bien a Profile Service
- [x] Probar el login completo — con Device Flow real (Google → Auth0 → Gateway → gRPC); se encontró y arregló un bug real: el primer login de un usuario no tenía perfil creado. Se agregó auto-provisioning: si `GetProfile` devuelve `NOT_FOUND`, el Gateway pide los datos a `/userinfo` de Auth0 y crea el perfil con `UpsertProfile`

## Fase 3 — Chat Service (GraphQL + WebSocket)
- [x] Inicializar el proyecto Nest — probado: arranca correctamente
- [x] Tablas `channels` y `messages` en Postgres (`db_chat`), vía TypeORM — probado: se crearon con la relación (FK `channelId`) correcta
- [x] Mutation `sendMessage` — probada: crea el canal automáticamente y guarda el mensaje. Se agregó también la query `messages(channelId)` (GraphQL exige al menos una Query en el schema, no alcanza con solo una Mutation)
- [x] Subscription `messageReceived` (GraphQL Subscriptions sobre WebSocket), con `PubSub` en memoria — **solución definitiva**, no intermedia (ver nota en la Fase 5, cortada). Probada de punta a punta con un cliente `graphql-ws` real: el mensaje llegó por WebSocket apenas se publicó
- [x] Persistencia de mensajes — cubierto por `sendMessage`/`messages`, confirmado en Postgres

## Fase 4 — Integración Gateway ↔ Chat Service
- [x] Resolvers en el Gateway que rutean al Chat Service — `senderId` dejó de venir del cliente, lo inyecta el Gateway desde el `sub` del JWT
- [x] Proxy de subscriptions desde el cliente hasta el Chat Service a través del Gateway

**Nota — 2026-08-08:** después de cerrar esta fase, se migró todo el transporte del chat (Fase 3 y 4) de GraphQL Subscriptions/`graphql-ws` a **Socket.IO**. Fue una decisión explícita del usuario por claridad/aprendizaje, no una necesidad técnica — el mecanismo de fondo (persistencia en Postgres + notificación en memoria del proceso, sin Redis ni broker externo) es el mismo que se describe en el punto de Subscription más abajo, solo cambió la librería: `PubSub`+`filter` de GraphQL se reemplazó por `rooms` nativas de Socket.IO, y `sendMessage`/`messages` pasaron de mutation/query a eventos con ack (`sendMessage`, `getMessages`). El detalle está en `docs/ARQUITECTURA.md`.

**Corrección — mismo día:** la primera versión de la migración le hizo abrir al Gateway **una sola conexión Socket.IO compartida** hacia Chat Service, y lo obligó a mantener su propia tabla de rooms para repartir mensajes entre sus clientes — lógica de más que no le correspondía (y con un bug real: si esa conexión se cortaba, perdía silenciosamente todos los joins). Se corrigió a **una conexión propia por cada cliente conectado al Gateway**: así Chat Service hace el join y el reparto real con su propia sala (ya la tenía), y el Gateway vuelve a ser un relay fino sin estado propio.

## ~~Fase 5 — Tiempo real multi-instancia~~ (cortada)

Decisión: no se implementa. No hay load balancer planeado para ningún servicio del proyecto — sin eso, nunca va a existir más de una instancia de `chat-service` corriendo al mismo tiempo, así que el `PubSub` en memoria de la Fase 3 (paso "Subscription `messageReceived`") queda como la solución **definitiva**, no como algo temporal a reemplazar por Redis. Si más adelante se suma Kubernetes (u otro orquestador) y se corre `chat-service` con réplicas reales, ahí sí esta fase se retoma — Redis Pub/Sub o Postgres `LISTEN`/`NOTIFY` serían las opciones, sin agregar infraestructura nueva a menos que se elija Redis.

## Fase 6 — Alertas in-app
- Contador de mensajes no leídos
- Toast/notificación dentro de la UI al llegar un mensaje

## Fase 7 — Dockerización completa
- `Dockerfile` por servicio
- `docker-compose.yml` final, todo junto
- Variables de entorno / `.env`

## Fase 8 — Pulido y seguridad
- TLS/WSS
- Verificar cifrado en reposo en Postgres
- Logs básicos por servicio

---

**Regla simple para avanzar:** no pasar a la fase siguiente hasta poder probar la anterior de forma aislada (sin depender de las que faltan).
