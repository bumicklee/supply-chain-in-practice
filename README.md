# 공급망 보안 실습장

현재 저장소는 강의 제작용 실측판입니다. `student-baseline` 가지에는 1-1과 2-1~6-1의 `make goto`·`make check`가 구현되어 있습니다. 전체 17개 수업을 차례로 진행하는 수강생용 완료본은 아닙니다.

Git은 모든 수강생에게 필수입니다. GitHub 계정이 있으면 공개 저장소를 포크하고, 없으면 원본 저장소를 Git으로 클론해 로컬 가지와 커밋으로 실습합니다.

```sh
git clone -b student-baseline https://github.com/bumicklee/supply-chain-in-practice.git lab
cd lab
make doctor
make up
source .lab/env
cd parts-api && npm ci && npm test
cd .. && make check L=1-1
```

Docker, Node.js 22, npm, make, jq, curl이 필요합니다. Gradle 수업은 JDK 17 이상도 필요합니다. `make doctor`가 설치 상태를 보여 줍니다. 처음 `make up`과 `npm ci`는 공개 패키지를 받느라 시간이 걸릴 수 있습니다.

구현된 지점은 1-1과 2-1~6-1 수업마다 `make goto L=<수업>`, `make goto L=<수업> AT=done`입니다. `make where`로 현재 위치를 봅니다. 지점 이동은 이 클론의 Docker 레지스트리 볼륨을 새로 만들지만 Dependency-Track 볼륨은 유지합니다. 6-1은 별도의 Maven 역할 저장소 두 개를 초기화합니다. 고친 수업 파일이 있으면 이동을 멈춥니다. 직접 변경 내용을 저장하거나 `FORCE=1`을 주면 덮어쓰기 전 사본을 `.lab/backup/`에 남깁니다. 같은 포트를 쓰는 다른 클론의 서비스를 먼저 내려야 합니다.

4-2 VEX 실습의 억제 장면은 `parts-api/sbom/parts-api.syft.json`을 스캐너 입력으로 씁니다. CycloneDX 입력으로는 이 VEX의 대상 경보가 억제되지 않았습니다. `make goto L=4-2`는 조사 중 문서를, `AT=done`은 영향 없음 문서와 코드 변경 재연·되돌림 기록을 만듭니다.

4-1 첫 실행의 `make grype-db`는 체크섬을 검증한 2026-11-18 DB를 내려받아 약 3GB로 풀며 시간이 걸립니다. `make kev-check`는 같은 날짜의 CISA KEV 스냅샷과 Grype 경보의 CVE 별칭을 대조합니다. 일치가 0건이어도 안전하다는 뜻은 아닙니다.

5-1의 기본 `make dt-up`은 빈 Dependency-Track 데이터 볼륨에 교육용 NVD 캐시를 만들어 외부 취약점 이력 동기화를 건너뜁니다. 이 수업은 `INT-LAB-0001`이라는 실습용 내부 취약점으로 재분석과 웹훅을 확인합니다. 실제 공개 취약점 감시 결과로 해석하지 마세요. `make dt-bootstrap`은 첫 관리자 암호를 바꾸고 팀 API 키를 `.lab/`에 보관합니다. 화면에 암호나 키를 출력하지 않습니다. 이미 직접 첫 로그인과 키 발급을 마쳤다면 이 명령을 생략합니다. `DT_FAST=0 make dt-up`은 빈 볼륨에서 실제 외부 데이터 동기화를 시작할 수 있으며 완료까지 오래 걸릴 수 있습니다.

5-2의 `make goto/check`는 이 저장소에 남은 Git PR 커밋을 고정 Grype DB로 비교하는 로컬 경로입니다. 실제 GitHub PR을 재연할 때는 포크의 `main`을 **별도 폴더에 클론**해 가지를 만드세요. `student-baseline`에는 이미 취약 버전 `minimist@0.0.8`이 있어 그 가지에서 시작하면 PR의 변경 한 줄을 보여 주기 어렵습니다. 검사 실패가 머지를 기술적으로 막으려면 저장소의 가지 보호 규칙에서 해당 상태 검사를 필수로 지정해야 합니다.

2-4에서 공개 역할 저장소에 `string-padder@2.4.1`을 올린 뒤 사내 주소가 예전 2.4.0 목록만 보여 `ETARGET`이 나면 `make padder-cache-refresh`로 해당 목록만 새로 읽습니다. `make goto L=2-4 AT=done`은 이 단계를 자동으로 실행합니다.

## 실습 경로

| 수업 | 시작 명령 또는 파일 | 확인할 것 |
| --- | --- | --- |
| 2-1~2-4 | `make attack A=confusion` 등 | `parts-api`의 잠금 파일, 설치 스크립트와 로컬 수집기 |
| 3-1~3-2 | `make sbom`, `make ntia-check SBOM=parts-api/sbom/parts-api.cdx.json` | CycloneDX·SPDX 부품과 최소 요소 |
| 4-1~4-2 | `make grype-db`, `make triage-check`, `make vex-lint` | 취약점 우선순위와 VEX 근거 |
| 5-1 | `make goto L=5-1`, `make dt-up`, `make dt-bootstrap`, `make goto L=5-1 AT=done`, `make check L=5-1` | 두 릴리스의 SBOM, 내부 취약점, 정책과 실제 웹훅 |
| 5-2 | `make goto L=5-2`, `make goto L=5-2 AT=done`, `make check L=5-2` | Git 커밋 차이에서 취약 `minimist@0.0.8` 실패·수정 `1.2.8` 통과 |
| 6-1 | `make goto L=6-1`, `make goto L=6-1 AT=done`, `make check L=6-1` | 공개 8082의 1.99.0과 칸막이 뒤 사내 8081의 1.3.0 |
| 6-2 | `make maven-up`, `gradle-lib/` | Gradle 검증 메타데이터(학생 지점 구현 전) |
| 7-1~7-2 | `make vendor`, `make vendor-check`, `make release-local V=<버전>`, `make deploy TGZ=<파일> TAG=<태그>`, `make verify-offline` | tarball·SBOM·증명과 배포 전 검증 |

6-3 Android 수업의 소스와 미리 빌드한 결과물은 공개 범위 검토 전까지 이 저장소에 포함하지 않습니다. GitHub 경로에서는 공개 포크의 PR 검사와 태그 릴리스를 사용합니다. 계정이 없으면 로컬 관문과 `make release-local`까지 수행할 수 있습니다. 로컬 릴리스에는 GitHub 출처 증명이 붙지 않습니다.

`make verify-offline`은 이 저장소에 포함된 공식 실습 릴리스 `v1.1.0`의 tgz, 증명 번들, Sigstore 신뢰 루트로 출처와 CycloneDX SBOM 증명을 검사합니다. GitHub 로그인과 네트워크가 필요하지 않습니다. 다른 파일을 시험하려면 `TGZ=<파일>`을 지정하세요. 신뢰 루트는 2026-11-19에 받아 둔 시점의 자료이므로 장기간 보관한 뒤 새 증명을 검증할 때는 갱신해야 합니다. 오프라인 번들은 증명 당시 저장소 이름을 확인하지만 이후 이름 변경 여부를 조회하지 않습니다.

`v1.2.0` 통합 실측에서는 PR의 신규 `minimist` 취약점이 막히고 수정 후 릴리스·배포 검증은 통과했습니다. Dependency-Track은 기존 `lodash 4.17.20`과 내부 `@parts/price-rules 1.2.0`에 대해 Critical 정책 FAIL 2건을 표시했습니다. 배포 검증 성공은 취약점 정책 통과를 뜻하지 않습니다.

레지스트리와 공격 재연은 내 PC의 `127.0.0.1`에서 실행합니다. `npm publish`를 실행할 때는 반드시 `--registry http://127.0.0.1:4873/` 또는 `--registry http://127.0.0.1:4874/`를 명시하세요. 실제 npmjs와 Maven Central에는 실습 패키지를 게시하지 않습니다.

