# Deployment

## Environments

- development: local, Ollama, docker-compose
- test: CI with Postgres/Redis/Qdrant services
- production: GHCR docker images + npm packages

## Configs

See configs/development|test|production

## Release Process

1. Verify all gates PASS: npm run verify -- --strict
2. Generate certification: npm run certify
3. Tag: git tag vX.Y.Z
4. Push tag -> triggers release.yml
5. Artifacts: Docker + npm + certification manifest attached to GitHub Release
