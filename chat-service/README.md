# Chat Service

Servidor **GraphQL** con canales y mensajes.

- Base de datos propia: `db_chat` (Postgres)
- Mutation `sendMessage` + subscription `messageReceived` sobre WebSocket
- Redis Pub/Sub para sincronizar mensajes entre instancias (escalado horizontal)

Pendiente — se implementa en la Fase 3 del [plan de implementación](../docs/PLAN_IMPLEMENTACION.md).
