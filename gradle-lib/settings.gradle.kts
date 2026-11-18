import org.gradle.api.initialization.resolve.RepositoriesMode

rootProject.name = "gradle-lib"
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven {
            name = "public-role"
            url = uri("http://127.0.0.1:8082/")
            isAllowInsecureProtocol = true
        }
        exclusiveContent {
            forRepository {
                maven {
                    name = "internal"
                    url = uri("http://127.0.0.1:8081/")
                    isAllowInsecureProtocol = true
                }
            }
            filter { includeGroup("com.parts.internal") }
        }
    }
}
