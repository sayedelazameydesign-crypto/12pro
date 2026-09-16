# Supply Chain Security - 2026

## Overview

In 2026, GitHub Repository is a **Software Delivery System**, not just git hosting.

Supply chain layers:

- **SBOM**: SPDX + CycloneDX via `anchore/sbom-action`
- **Provenance**: SLSA via `actions/attest-build-provenance@v2`
- **Attestations**: Build provenance + SBOM attestation
- **Dependency Review**: `actions/dependency-review-action@v4`
- **License Check**: Only MIT, Apache-2.0, ISC, BSD allowed

## Workflows

- `attestation.yml`: Build + SBOM + Provenance + Attest + Verify
- `supply-chain.yml`: SBOM + Dependency Review + License Check + Provenance Check + Policy
- `release.yml`: Updated to include SBOM + attestation + Docker provenance+sbom

## Verification

```bash
# Verify artifact attestation
gh attestation verify oci://ghcr.io/sayedelazameydesign-crypto/12pro:v0.1.0 --owner sayedelazameydesign-crypto

# Check SBOM
cat certification/sbom/sbom.spdx.json

# Check attestation manifest
cat certification/attestations/<commit>.json
```

## Gates

- SBOM must exist for production deploy (enforced in `environments/production.yml`)
- Provenance must exist for production deploy
- License check must PASS (no disallowed licenses)

## References

- https://docs.github.com/en/actions/concepts/security/artifact-attestations
- https://slsa.dev/provenance/v1
- https://spdx.dev/
```

