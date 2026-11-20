# Gradle 저장소 실습

6-1은 저장소 루트에서 `make goto L=6-1`로 시작한다. 이 명령은 Maven 역할 저장소 두 개를 켜고 `settings.gradle.kts`를 공개 역할 저장소가 먼저인 실습 시작 상태로 만든다. `gradle-lib/`에서 JDK 17 또는 21로 `./gradlew --refresh-dependencies --info dependencyInsight --dependency pricing --configuration runtimeClasspath`를 실행하면 버전과 다운로드 주소를 함께 볼 수 있다. `make goto L=6-1 AT=done`은 `exclusiveContent`를 적용하고 네 단계의 Gradle 선택 결과를 `.lab/lesson-6-1/`에 기록한다. 끝 상태에서 `com.parts.internal`은 사내 저장소에서만 받는다. 두 저장소는 Docker의 정적 Maven 역할 저장소이며 외부 Maven Central과 통신하지 않는다.

6-2는 저장소 루트에서 `make goto L=6-2`로 시작한다. `make goto L=6-2 AT=done`은 `--write-verification-metadata sha256 clean build`로 실제 의존성 해시를 기록하고, 공개 역할 저장소의 같은 버전 jar를 바꿔 검증 실패를 확인한 다음 원본으로 복구한다. 마지막으로 `pricing`을 1.3.0으로 올리고 기록을 갱신한다. 실패 로그와 HTML 보고서는 `.lab/lesson-6-2/`에 저장된다. `make check L=6-2`로 결과를 확인한다. 새로 생성한 `gradle/verification-metadata.xml`은 Git 추적 전에는 `git diff`에 보이지 않으므로, PR에 올릴 때 파일을 추가하고 새로 들어온 해시와 남은 이전 버전 항목을 함께 리뷰한다.
