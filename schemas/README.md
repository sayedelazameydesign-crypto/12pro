# Schemas - عقود النظام (Contracts)

> في 2026: كل تفاعل بين مكونات Agent له schema موثق ومُتحقق.

- `api/` - OpenAPI + JSON Schema لـ REST
- `events/` - GitHub events, webhook payloads, internal events
- `tools/` - Tool definitions, input/output schemas
- `missions/` - Mission request/response, task DAG
- `governance/` - Policy, spend limits, allowlist
- `memory/` - Memory read/write schemas

هذه الـschemas تُستخدم في:
- Contract tests (`tests/contract/`)
- Tool validation (`@agi-system/tools`)
- Governance checks
- Certification gates (G4 Contract)

## Validation

```bash
npm run validate:schemas
```

يستخدم `ajv` للتحقق من كل JSON مقابل schemas.
