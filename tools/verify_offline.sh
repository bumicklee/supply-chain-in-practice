#!/bin/sh
set -eu

tgz=${1:-fixtures/attestation/parts-api-1.1.0.tgz}
bundle=${2:-fixtures/attestation/parts-api-1.1.0.attestations.jsonl}
root=${3:-fixtures/attestation/trusted_root.jsonl}
repo=bumicklee/supply-chain-in-practice
workflow="$repo/.github/workflows/release.yml"
ref=refs/tags/v1.1.0

for path in "$tgz" "$bundle" "$root"; do
  [ -f "$path" ] || { printf '오프라인 검증: 파일 없음(%s)\n' "$path" >&2; exit 2; }
done

for predicate in https://slsa.dev/provenance/v1 https://cyclonedx.org/bom; do
  if ! gh attestation verify "$tgz" --bundle "$bundle" --custom-trusted-root "$root" \
    --repo "$repo" --signer-workflow "$workflow" --source-ref "$ref" --predicate-type "$predicate"; then
    printf '오프라인 검증: 거부(%s)\n' "$predicate" >&2
    exit 1
  fi
  printf '오프라인 검증: 통과(%s)\n' "$predicate"
done
