# Operations

## Deploy

- Staging: auto on push to main
- Production: on tag v*.*.*

## Monitoring

- OTEL endpoint: OTEL_EXPORTER_OTLP_ENDPOINT
- Logs: JSON structured
- Health: /api/v1/health returns gates status

## Runbooks

- If G0 fails: check typecheck
- If security gate fails: run gitleaks
- If benchmark regresses >10%: check recent perf changes
