#!/bin/sh
set -eu

tgz=${1:-}
tag=${2:-}
root=$(pwd)
work=
cleanup() { if [ -n "$work" ] && [ -d "$work" ]; then rm -rf "$work"; fi; }
trap cleanup 0
reject() {
  printf '배포: 거부(%s)\n' "$1" >&2
  printf '%s | %s | 거부 | %s\n' "$(date -u +%FT%TZ)" "$tag" "$1" >> .lab/deploy.log
  exit 1
}

[ -n "$tgz" ] && [ -f "$tgz" ] || reject 'tgz 경로'
case "$tag" in v*[!A-Za-z0-9._-]*|''|*[!A-Za-z0-9._-]*) reject '태그 형식' ;; esac

repo=${LAB_REPO:-}
if [ -z "$repo" ]; then
  origin=$(git remote get-url origin 2>/dev/null || true)
  case "$origin" in
    https://github.com/*) repo=${origin#https://github.com/} ;;
    git@github.com:*) repo=${origin#git@github.com:} ;;
  esac
  repo=${repo%.git}
fi
case "$repo" in */*/*|*' '*|''|/*|*/|*..*) reject 'GitHub 저장소' ;; esac
case "$repo" in */*) : ;; *) reject 'GitHub 저장소' ;; esac

mkdir -p .lab/deploy
signer="$repo/.github/workflows/release.yml"
source_ref="refs/tags/$tag"
printf '출처 증명 확인: %s, %s\n' "$signer" "$source_ref"
if ! gh attestation verify "$tgz" --repo "$repo" --signer-workflow "$signer" --source-ref "$source_ref"; then
  reject '출처 증명'
fi

work=$(mktemp -d ".lab/deploy/.tmp-${tag}.XXXXXX")
if ! tar -tzf "$tgz" | grep -Fxq 'package/npm-shrinkwrap.json'; then reject '잠금 목록'; fi
if ! tar -tzf "$tgz" | grep -q '^package/vendor/'; then reject 'vendor'; fi
if ! tar -xzf "$tgz" -C "$work"; then reject '압축 해제'; fi
if ! (cd "$work/package" && npm ci --omit=dev --ignore-scripts --registry=https://registry.npmjs.org/ --replace-registry-host=never --cache "$root/.lab/npm-cache-deploy"); then
  reject '잠금 설치'
fi
if ! (cd "$work/package" && npm rebuild @parts/fast-hash --ignore-scripts=false); then reject '허용된 빌드'; fi

printf 'SBOM 증명 확인: 같은 tgz 지문\n'
if ! gh attestation verify "$tgz" --repo "$repo" --signer-workflow "$signer" --source-ref "$source_ref" --predicate-type https://cyclonedx.org/bom; then
  reject 'SBOM 증명'
fi
if ! (cd "$work/package" && node -e "require('./src/app')"); then reject '기동 확인'; fi

destination=".lab/deploy/$tag"
[ ! -e "$destination" ] || reject '이미 배포된 태그'
mv "$work" "$destination"
work=
printf '%s | %s | 통과\n' "$(date -u +%FT%TZ)" "$tag" >> .lab/deploy.log
printf '배포: 통과(%s)\n' "$tag"
