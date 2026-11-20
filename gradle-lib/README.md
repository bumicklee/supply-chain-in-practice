# Gradle 저장소 실습

6-1은 저장소 루트에서 `make goto L=6-1`로 시작한다. 이 명령은 Maven 역할 저장소 두 개를 켜고 `settings.gradle.kts`를 공개 역할 저장소가 먼저인 실습 시작 상태로 만든다. `gradle-lib/`에서 JDK 17 또는 21로 `./gradlew --refresh-dependencies --info dependencyInsight --dependency pricing --configuration runtimeClasspath`를 실행하면 버전과 다운로드 주소를 함께 볼 수 있다. `make goto L=6-1 AT=done`은 `exclusiveContent`를 적용하고 네 단계의 Gradle 선택 결과를 `.lab/lesson-6-1/`에 기록한다. 끝 상태에서 `com.parts.internal`은 사내 저장소에서만 받는다. 두 저장소는 Docker의 정적 Maven 역할 저장소이며 외부 Maven Central과 통신하지 않는다.
