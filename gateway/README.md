# Gateway

Servidor GraphQL (Nest) expuesto al cliente. Sin Federation — resolvers manuales que combinan:
- **Login/Profile Service** por gRPC
- **Chat Service** por GraphQL directo (pendiente, Fase 4)

Responsabilidades:
- Validar JWT de Auth0 — middleware oficial `express-oauth2-jwt-bearer`, aplicado globalmente
- Rate limiting en memoria (`@nestjs/throttler`), aplicado solo a la query `miPerfil`
- Rutear y combinar respuestas de los demás servicios

Escucha en `0.0.0.0:4001`.

Fase 2 del [plan de implementación](../docs/PLAN_IMPLEMENTACION.md) — falta solo probar el login completo con un token real.
