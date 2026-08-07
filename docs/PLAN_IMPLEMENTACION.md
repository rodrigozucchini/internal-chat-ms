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
- [x] Rate limiter — con `@nestjs/throttler` (oficial de Nest), en memoria (sin Redis, no hay load balancer planeado); queda listo para aplicarse en `miPerfil`, todavía sin usar
- [x] Resolver que llama a Profile Service por gRPC (query `miPerfil`) — con `GqlThrottlerGuard` aplicado; probado: rechaza sin token, gRPC client conecta bien a Profile Service
- [x] Probar el login completo — con Device Flow real (Google → Auth0 → Gateway → gRPC); se encontró y arregló un bug real: el primer login de un usuario no tenía perfil creado. Se agregó auto-provisioning: si `GetProfile` devuelve `NOT_FOUND`, el Gateway pide los datos a `/userinfo` de Auth0 y crea el perfil con `UpsertProfile`

## Fase 3 — Chat Service (GraphQL + WebSocket)
- Tablas `channels` y `messages` en Postgres (`db_chat`)
- Mutation `sendMessage` y subscription `messageReceived`
- Conexión WebSocket (`graphql-ws`)
- Persistencia de mensajes

## Fase 4 — Integración Gateway ↔ Chat Service
- Resolvers en el Gateway que rutean al Chat Service
- Proxy de subscriptions desde el cliente hasta el Chat Service a través del Gateway

## Fase 5 — Tiempo real multi-instancia
- Redis Pub/Sub entre instancias del Chat Service
- Probar con 2 instancias corriendo: un mensaje tiene que llegarle a un cliente conectado a la otra instancia

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
