# ADR 0006: REST API Design

- Date: 2026-09-16
- Status: Accepted

## Decision
API is REST + JSON, versioned via /api/v1

Endpoints:
- POST /api/v1/missions
- GET /api/v1/missions/:id
- POST /api/v1/missions/:id/cancel
- GET /api/v1/health

OpenAPI spec in docs/api/openapi.yaml
