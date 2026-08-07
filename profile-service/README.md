# Login/Profile Service

Servidor **gRPC** (Nest) con los datos de perfil de usuario.

- Base de datos propia: `db_profile` (Postgres, vía TypeORM)
- Cache de perfil en Redis (TTL 5 min, key-value, invalidado en cada `UpsertProfile`)
- Expone `GetProfile` / `UpsertProfile` — definidos en `src/proto/profile.proto`
- Escucha en `0.0.0.0:5000`

Fase 1 del [plan de implementación](../docs/PLAN_IMPLEMENTACION.md) — completa.
