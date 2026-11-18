# 공급망 보안 실습장

Git은 모든 수강생에게 필수입니다. GitHub 계정이 있으면 공개 저장소를 포크하고, 없으면 원본 저장소를 Git으로 클론해 로컬 가지와 커밋으로 실습합니다.

```sh
git clone https://github.com/bumicklee/supply-chain-in-practice.git lab
cd lab
make doctor
make up
source .lab/env
cd parts-api && npm ci && npm test
```

Docker, Node.js 22, npm, make, jq, curl이 필요합니다. Gradle 수업은 JDK 17 이상도 필요합니다. `make doctor`가 설치 상태를 보여 줍니다. 처음 `make up`과 `npm ci`는 공개 패키지를 받느라 시간이 걸릴 수 있습니다.

## 실습 경로

| 수업 | 시작 명령 또는 파일 | 확인할 것 |
| --- | --- | --- |
| 2-1~2-4 | `make attack A=confusion` 등 | `parts-api`의 잠금 파일, 설치 스크립트와 로컬 수집기 |
| 3-1~3-2 | `make sbom`, `make ntia-check SBOM=parts-api/sbom/parts-api.cdx.json` | CycloneDX·SPDX 부품과 최소 요소 |
| 4-1~4-2 | `make grype-db`, `make triage-check`, `make vex-lint` | 취약점 우선순위와 VEX 근거 |
| 5-1 | `make dt-up`, `make dt-upload V=1.0.0 SBOM=<파일>` | Dependency-Track의 버전별 프로젝트와 정책 |
| 5-2 | `make pr-gate-local BASE=<기준커밋> HEAD=<후보커밋>` | GitHub 없이도 Critical 신규 의존성 실패·수정 통과 |
| 6-1~6-2 | `make maven-up`, `gradle-lib/`, `solutions/6-1-before.settings.gradle.kts` | 저장소 선택과 Gradle 검증 메타데이터 |
| 7-1~7-2 | `make vendor`, `make vendor-check`, `make release-local V=<버전>`, `make deploy TGZ=<파일> TAG=<태그>` | tarball·SBOM·증명과 배포 전 검증 |

6-3 Android 수업의 소스와 미리 빌드한 결과물은 공개 범위 검토 전까지 이 저장소에 포함하지 않습니다. GitHub 경로에서는 공개 포크의 PR 검사와 태그 릴리스를 사용합니다. 계정이 없으면 로컬 관문과 `make release-local`까지 수행할 수 있습니다. 로컬 릴리스에는 GitHub 출처 증명이 붙지 않습니다.

레지스트리와 공격 재연은 내 PC의 `127.0.0.1`에서 실행합니다. `npm publish`를 실행할 때는 반드시 `--registry http://127.0.0.1:4873/` 또는 `--registry http://127.0.0.1:4874/`를 명시하세요. 실제 npmjs와 Maven Central에는 실습 패키지를 게시하지 않습니다.

