# Gradle 저장소 실습

`make maven-up` 후 JDK 17 또는 21로 `./gradlew dependencyInsight --dependency pricing --configuration runtimeClasspath`를 실행한다. `settings.gradle.kts`는 처음에 공개 역할 저장소를 앞에 둔다. `lab-origin.txt`를 jar에서 꺼내 실제 출처를 확인한다. `exclusiveContent`를 적용하면 `com.parts.internal`은 사내 저장소에서만 받는다. 두 저장소는 Docker의 정적 Maven 역할 저장소이며 외부 Maven Central과 통신하지 않는다.
