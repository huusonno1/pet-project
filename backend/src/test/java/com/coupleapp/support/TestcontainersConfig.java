package com.coupleapp.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgres() {
        return new PostgreSQLContainer<>("postgres:17-alpine");
    }

    @Bean
    @ServiceConnection(name = "redis")
    GenericContainer<?> redis() {
        return new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
    }

    static final String MINIO_USER = "minioadmin";
    static final String MINIO_PASSWORD = "minioadmin";

    /** Image minio/minio đã bị gỡ khỏi Docker Hub; dùng bản đóng gói của Bitnami (legacy). */
    @Bean
    GenericContainer<?> minio() {
        return new GenericContainer<>("bitnamilegacy/minio:2025.4.22")
                .withEnv("MINIO_ROOT_USER", MINIO_USER)
                .withEnv("MINIO_ROOT_PASSWORD", MINIO_PASSWORD)
                .withExposedPorts(9000)
                .waitingFor(Wait.forHttp("/minio/health/live").forPort(9000));
    }

    @Bean
    DynamicPropertyRegistrar minioProperties(GenericContainer<?> minio) {
        return registry -> {
            String url = "http://" + minio.getHost() + ":" + minio.getMappedPort(9000);
            registry.add("app.storage.endpoint", () -> url);
            registry.add("app.storage.public-endpoint", () -> url);
            registry.add("app.storage.access-key", () -> MINIO_USER);
            registry.add("app.storage.secret-key", () -> MINIO_PASSWORD);
        };
    }
}
