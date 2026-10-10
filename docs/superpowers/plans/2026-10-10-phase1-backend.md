# GĐ1 Backend + Khung dự án — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng monorepo (backend + mobile skeleton + hạ tầng dev) và hoàn thiện toàn bộ API GĐ1: tài khoản, ghép đôi, khoảng cách, ảnh, đặc điểm đối phương, kỷ niệm + nhắc nhở, chu kỳ, gửi push.

**Architecture:** Spring Boot 3.5 (Java 21) chia package theo tính năng (`auth`, `user`, `couple`, `location`, `media`, `trait`, `place`, `moment`, `cycle`, `notification`). PostgreSQL (Flyway) là nguồn dữ liệu chính, Redis giữ mã mời + rate limit, MinIO lưu ảnh qua presigned URL. Nhắc nhở dùng Strategy pattern (`MomentTypeHandler`) sinh trước các dòng `reminders`; job mỗi phút gửi qua Expo Push. Mobile (Expo) chỉ được khởi tạo khung ở plan này — màn hình làm ở plan GĐ1-mobile riêng.

**Tech Stack:** Java 21, Spring Boot 3.5.6, Spring Security OAuth2 Resource Server (JWT HS256), Spring Data JPA/Hibernate 6, Flyway, PostgreSQL 17, Redis 7, MinIO + AWS SDK v2, Lombok, JUnit 5, Testcontainers, MockMvc; Expo (React Native, TypeScript).

**Spec:** `docs/superpowers/specs/2026-10-10-couple-app-design.md`

**Phạm vi plan này:** Backend GĐ1 + khung repo. **Không gồm:** màn hình mobile (plan `2026-xx-xx-phase1-mobile.md` viết sau khi backend xong), GĐ2 (visits, love notes), GĐ3.

## Global Constraints

- Java **21**, Spring Boot **3.5.6**, build bằng Maven Wrapper (`backend/mvnw`).
- Base package: `com.coupleapp`. Mỗi tính năng một package; module khác chỉ gọi qua service/`CoupleAccess`, không đụng entity nội bộ của module khác ngoài repository đã nêu trong task.
- Khoá chính `uuid`; thời gian lưu `timestamptz` ↔ `Instant` (UTC); ngày lịch `date` ↔ `LocalDate`.
- Mọi dữ liệu chung thuộc một `couple`; `couple_id` luôn lấy từ user đăng nhập (`CoupleAccess`), **không bao giờ nhận từ client**.
- Truy cập dữ liệu của cặp đôi khác → `404 NOT_FOUND` (không tiết lộ tồn tại).
- Lỗi trả RFC 7807 `ProblemDetail` + thuộc tính `code` (enum `ErrorCode`); thông điệp `detail` bằng tiếng Việt.
- Mã mời: 8 ký tự từ bảng `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, TTL **1 giờ**, lưu Redis; tối đa **10 lần nhập mã / 15 phút** / user.
- JWT access token **15 phút**, refresh token **30 ngày** (lưu SHA-256 hash, xoay vòng khi refresh).
- Ảnh: `image/jpeg|png|webp|heic`, tối đa **15MB**; presigned PUT **10 phút**, GET **1 giờ**; bucket private.
- `reminder_config`: tối đa **20** mốc ngày (1..36500), tối đa **5** offset, mỗi offset 0..**30 ngày**, `sendAt` dạng `HH:mm`.
- Horizon lập lịch nhắc: **400 ngày**. Múi giờ mặc định `Asia/Ho_Chi_Minh`.
- Không override bean `Clock` trong integration test (JWT decoder dùng giờ hệ thống); logic thời gian thuần được unit test với `Instant` truyền vào.
- Test class đặt tên `*Test` (Surefire mặc định). Integration test kế thừa `com.coupleapp.support.IntegrationTest`.
- Commit message dạng Conventional Commits, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Hai request ghép đôi chạy song song** (cùng một mã, hoặc A nhập mã B trong khi B nhập mã A) → chỉ một cặp được tạo, không user nào thuộc 2 cặp ACTIVE. → test `concurrentJoinWithSameCodeCreatesOneCouple` (Task 5) + unique index test (Task 2).
2. **Sinh nhật / kỷ niệm ngày 29/02** ở năm không nhuận → nhắc vào 28/02, không bị bỏ qua. → `giftOnFeb29FallsBackToFeb28` (Task 9).
3. **Hai người khác múi giờ** → mỗi người nhận nhắc đúng 08:00 giờ địa phương của mình. → `eachRecipientUsesOwnTimezone` (Task 9).
4. **Tắt chia sẻ chu kỳ sau khi đã có nhắc nhở** → nhắc chưa gửi của đối phương bị huỷ, đối phương không còn thấy kỷ niệm/dự đoán. → `disablingShareCycleCancelsPartnerReminders` (Task 11).
5. **Hai instance scheduler cùng chạy** → mỗi nhắc chỉ gửi một lần. → `concurrentDispatchSendsOnce` (Task 12).

---

## Cấu trúc file

```
pet-project/
├── .gitignore
├── README.md
├── docker-compose.yml                       # postgres, redis, minio cho dev
├── mobile/                                  # Expo app (create-expo-app), chưa có màn hình nghiệp vụ
└── backend/
    ├── pom.xml, mvnw, .mvn/
    └── src/
        ├── main/java/com/coupleapp/
        │   ├── CoupleApplication.java
        │   ├── common/          ErrorCode, ApiException, GlobalExceptionHandler, AuthUser, ClockConfig, SchedulingConfig
        │   ├── common/security/ JwtProperties, JwtConfig, SecurityConfig
        │   ├── auth/            AuthController, AuthService, TokenService, RefreshToken(+Repository), AuthDtos
        │   ├── user/            User, UserSettings (+Repositories), MeController, MeService, UserDtos, UserSettingsChangedEvent
        │   ├── couple/          Couple, CoupleMember (+Repositories), CoupleAccess, CoupleContext, InviteService,
        │   │                    CoupleService, CoupleController, CoupleDtos, CouplePairedEvent, CoupleEndedEvent
        │   ├── location/        UserLocation(+Repository), Geo, LocationService, LocationController, LocationDtos
        │   ├── storage/         StorageProperties, StorageConfig
        │   ├── media/           Media, MediaStatus, MediaRepository, MediaService, MediaController, MediaCleanupJob, MediaDtos
        │   ├── trait/           SizeEntry, Preference, PreferenceLink, Visibility (+Repositories), TraitService, TraitController, TraitDtos
        │   ├── place/           Place, PlaceRepository, PlaceService, PlaceDtos
        │   ├── moment/          Moment, MomentType, Recurrence, MomentRepository, MomentService, MomentController,
        │   │                    MomentDtos, MomentEventsListener
        │   ├── moment/reminder/ Audience, Role, ReminderConfig, Occurrence, Occurrences, Message, PlanningContext,
        │   │                    ReminderPlan, MomentTypeHandler, ReminderPlanner, ReminderScheduler
        │   ├── moment/handler/  AnniversaryHandler, DatePlanHandler, GiftOccasionHandler, CycleHandler, CustomHandler
        │   ├── cycle/           CycleLog(+Repository), CyclePredictor, CycleService, CycleController, CycleDtos, CycleEventsListener
        │   └── notification/    DeviceToken(+Repository), DeviceController, Reminder, ReminderStatus, ReminderRepository,
        │                        PushSender, PushMessage, PushResult, ExpoPushSender, ReminderDispatcher,
        │                        NotificationService, PairingNotifier, ReminderJobs
        ├── main/resources/      application.yml, db/migration/V1__init.sql
        └── test/java/com/coupleapp/
            ├── support/         TestcontainersConfig, IntegrationTest
            └── <module>/        *Test.java
```

---

### Task 1: Khung monorepo, hạ tầng dev, backend skeleton, mobile skeleton

**Files:**
- Create: `.gitignore`, `README.md`, `docker-compose.yml`
- Create: `backend/pom.xml`, `backend/mvnw`, `backend/.mvn/wrapper/maven-wrapper.properties` (sinh bằng lệnh)
- Create: `backend/src/main/java/com/coupleapp/CoupleApplication.java`
- Create: `backend/src/main/java/com/coupleapp/common/security/JwtProperties.java`, `JwtConfig.java`, `SecurityConfig.java`
- Create: `backend/src/main/resources/application.yml`
- Create: `backend/src/test/java/com/coupleapp/support/TestcontainersConfig.java`, `IntegrationTest.java`
- Test: `backend/src/test/java/com/coupleapp/HealthTest.java`
- Create: `mobile/` (sinh bằng `create-expo-app`)

**Interfaces:**
- Produces: `IntegrationTest` (base class) với `mvc`, `json`, `jdbc`, `redis` và helper `get/post/put/patch/delete(url, token[, body])`, `read(ResultActions) → JsonNode`; bean `JwtEncoder`, `JwtDecoder`, `PasswordEncoder`; record `JwtProperties(String secret, Duration accessTtl, Duration refreshTtl)`.

- [ ] **Step 1: Kiểm tra JDK 21**

Run: `java -version`
Expected: `openjdk version "21...`. Nếu không phải 21: nhờ người dùng chạy `! sudo apt install -y openjdk-21-jdk-headless`, rồi dùng `export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64` cho các lệnh Maven bên dưới.

- [ ] **Step 2: Tạo file gốc repo**

`.gitignore`:
```gitignore
# Java / Maven
backend/target/
*.class
*.log

# IDE
.idea/
*.iml
.vscode/

# Node / Expo
node_modules/

# Env
.env
.env.*
!.env.example

.DS_Store
```

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: coupleapp
      POSTGRES_USER: coupleapp
      POSTGRES_PASSWORD: coupleapp
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    # MinIO đã ngừng phát hành image community mới; pin image cũ cho dev (xem spec §11)
    image: minio/minio:RELEASE.2023-09-04T19-57-37Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: [miniodata:/data]

volumes:
  pgdata:
  miniodata:
```

`README.md`:
````markdown
# Couple App

App cho các cặp đôi: kỷ niệm, nhắc nhở, đặc điểm của nhau, khoảng cách yêu xa.
Thiết kế: `docs/superpowers/specs/2026-10-10-couple-app-design.md`.

## Cấu trúc

- `backend/` — Spring Boot 3.5 (Java 21)
- `mobile/` — Expo (React Native, TypeScript), chạy Android + iOS
- `docker-compose.yml` — PostgreSQL, Redis, MinIO cho môi trường dev

## Yêu cầu

- JDK 21, Docker (+ Docker Compose), Node.js 20+

## Chạy dev

```bash
docker compose up -d                 # Postgres :5432, Redis :6379, MinIO :9000 (console :9001)
cd backend && ./mvnw spring-boot:run # API :8080
cd mobile && npx expo start          # quét QR bằng Expo Go / development build
```

Khi test trên điện thoại thật, đặt `APP_STORAGE_PUBLIC_ENDPOINT=http://<IP-LAN-máy-dev>:9000`
để URL ảnh presigned truy cập được từ điện thoại.

## Test

```bash
cd backend && ./mvnw test            # cần Docker (Testcontainers)
```
````

- [ ] **Step 3: Tạo `backend/pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.5.6</version>
        <relativePath/>
    </parent>

    <groupId>com.coupleapp</groupId>
    <artifactId>backend</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <name>couple-app-backend</name>

    <properties>
        <java.version>21</java.version>
        <aws.sdk.version>2.31.0</aws.sdk.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>software.amazon.awssdk</groupId>
                <artifactId>bom</artifactId>
                <version>${aws.sdk.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-redis</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-oauth2-resource-server</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-actuator</artifactId></dependency>
        <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>
        <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-database-postgresql</artifactId></dependency>
        <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>
        <dependency><groupId>software.amazon.awssdk</groupId><artifactId>s3</artifactId></dependency>
        <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><optional>true</optional></dependency>

        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
        <dependency><groupId>org.springframework.security</groupId><artifactId>spring-security-test</artifactId><scope>test</scope></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-testcontainers</artifactId><scope>test</scope></dependency>
        <dependency><groupId>org.testcontainers</groupId><artifactId>junit-jupiter</artifactId><scope>test</scope></dependency>
        <dependency><groupId>org.testcontainers</groupId><artifactId>postgresql</artifactId><scope>test</scope></dependency>
        <dependency><groupId>org.testcontainers</groupId><artifactId>minio</artifactId><scope>test</scope></dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <annotationProcessorPaths>
                        <path><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId></path>
                    </annotationProcessorPaths>
                    <parameters>true</parameters>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId></exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 4: Sinh Maven Wrapper (không cần cài Maven, chạy qua Docker)**

Run:
```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e MAVEN_CONFIG=/tmp/.m2 \
  -v "$PWD/backend":/w -w /w maven:3.9-eclipse-temurin-21 \
  mvn -q -N -Duser.home=/tmp wrapper:wrapper -Dmaven=3.9.11
ls backend/mvnw backend/.mvn/wrapper/maven-wrapper.properties
```
Expected: cả hai file tồn tại.

- [ ] **Step 5: Code khởi động + bảo mật**

`backend/src/main/java/com/coupleapp/CoupleApplication.java`:
```java
package com.coupleapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class CoupleApplication {
    public static void main(String[] args) {
        SpringApplication.run(CoupleApplication.class, args);
    }
}
```

`backend/src/main/java/com/coupleapp/common/security/JwtProperties.java`:
```java
package com.coupleapp.common.security;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.jwt")
public record JwtProperties(String secret, Duration accessTtl, Duration refreshTtl) {}
```

`backend/src/main/java/com/coupleapp/common/security/JwtConfig.java`:
```java
package com.coupleapp.common.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

@Configuration
public class JwtConfig {

    @Bean
    SecretKey jwtKey(JwtProperties props) {
        byte[] bytes = props.secret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret phải dài ít nhất 32 byte");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey jwtKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(jwtKey));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey jwtKey) {
        return NimbusJwtDecoder.withSecretKey(jwtKey).macAlgorithm(MacAlgorithm.HS256).build();
    }
}
```

`backend/src/main/java/com/coupleapp/common/security/SecurityConfig.java`:
```java
package com.coupleapp.common.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/actuator/health").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

`backend/src/main/resources/application.yml`:
```yaml
spring:
  application:
    name: couple-app
  datasource:
    url: jdbc:postgresql://localhost:5432/coupleapp
    username: coupleapp
    password: coupleapp
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: none
    properties:
      hibernate:
        jdbc:
          time_zone: UTC
  data:
    redis:
      host: localhost
      port: 6379
  threads:
    virtual:
      enabled: true

app:
  jwt:
    secret: ${JWT_SECRET:dev-only-secret-change-me-0123456789abcdef}
    access-ttl: 15m
    refresh-ttl: 30d
  storage:
    endpoint: http://localhost:9000          # backend gọi MinIO
    public-endpoint: http://localhost:9000   # host trong URL presigned (điện thoại phải truy cập được)
    region: us-east-1
    access-key: minioadmin
    secret-key: minioadmin
    bucket: couple-media
  push:
    expo-url: https://exp.host/--/api/v2/push/send
  scheduling:
    enabled: true

management:
  endpoints:
    web:
      exposure:
        include: health
```

- [ ] **Step 6: Hạ tầng test**

`backend/src/test/java/com/coupleapp/support/TestcontainersConfig.java`:
```java
package com.coupleapp.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.containers.PostgreSQLContainer;

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

    @Bean
    MinIOContainer minio() {
        return new MinIOContainer("minio/minio:RELEASE.2023-09-04T19-57-37Z");
    }

    @Bean
    DynamicPropertyRegistrar minioProperties(MinIOContainer minio) {
        return registry -> {
            registry.add("app.storage.endpoint", minio::getS3URL);
            registry.add("app.storage.public-endpoint", minio::getS3URL);
            registry.add("app.storage.access-key", minio::getUserName);
            registry.add("app.storage.secret-key", minio::getPassword);
        };
    }
}
```

`backend/src/test/java/com/coupleapp/support/IntegrationTest.java`:
```java
package com.coupleapp.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

@SpringBootTest(properties = "app.scheduling.enabled=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfig.class)
public abstract class IntegrationTest {

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper json;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected StringRedisTemplate redis;

    @BeforeEach
    void resetState() {
        List<String> tables = jdbc.queryForList(
                "select tablename from pg_tables where schemaname = 'public' and tablename <> 'flyway_schema_history'",
                String.class);
        if (!tables.isEmpty()) {
            jdbc.execute("TRUNCATE " + String.join(", ", tables) + " CASCADE");
        }
        try (RedisConnection c = redis.getRequiredConnectionFactory().getConnection()) {
            c.serverCommands().flushAll();
        }
    }

    protected ResultActions get(String url, String token) throws Exception {
        return mvc.perform(auth(MockMvcRequestBuilders.get(url), token));
    }

    protected ResultActions post(String url, String token, Object body) throws Exception {
        return mvc.perform(withBody(MockMvcRequestBuilders.post(url), token, body));
    }

    protected ResultActions put(String url, String token, Object body) throws Exception {
        return mvc.perform(withBody(MockMvcRequestBuilders.put(url), token, body));
    }

    protected ResultActions patch(String url, String token, Object body) throws Exception {
        return mvc.perform(withBody(MockMvcRequestBuilders.patch(url), token, body));
    }

    protected ResultActions delete(String url, String token) throws Exception {
        return mvc.perform(auth(MockMvcRequestBuilders.delete(url), token));
    }

    protected JsonNode read(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder b, String token) {
        return token == null ? b : b.header("Authorization", "Bearer " + token);
    }

    private MockHttpServletRequestBuilder withBody(MockHttpServletRequestBuilder b, String token, Object body)
            throws Exception {
        b = auth(b, token).contentType(MediaType.APPLICATION_JSON);
        if (body == null) {
            return b;
        }
        return b.content(body instanceof String s ? s : json.writeValueAsString(body));
    }
}
```

- [ ] **Step 7: Viết test smoke (fail trước khi có code là không áp dụng ở bước khung — chạy để xác nhận khung hoạt động)**

`backend/src/test/java/com/coupleapp/HealthTest.java`:
```java
package com.coupleapp;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import org.junit.jupiter.api.Test;

class HealthTest extends IntegrationTest {

    @Test
    void healthIsUp() throws Exception {
        get("/actuator/health", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void apiRequiresAuthentication() throws Exception {
        get("/api/me", null).andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 8: Chạy test**

Run: `cd backend && ./mvnw -q test`
Expected: `BUILD SUCCESS`, 2 tests pass (lần đầu tải image Docker có thể mất vài phút).

- [ ] **Step 9: Khởi tạo mobile skeleton**

Run:
```bash
npx create-expo-app@latest mobile --yes
rm -rf mobile/.git
cd mobile && npx tsc --noEmit
```
Expected: thư mục `mobile/` có `app/`, `package.json`, `tsconfig.json`; `tsc` không lỗi.

- [ ] **Step 10: Commit**

```bash
git add .gitignore README.md docker-compose.yml backend mobile
git commit -m "chore: scaffold monorepo with backend skeleton, dev infra and expo app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema DB (Flyway V1) + xử lý lỗi chung

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__init.sql`
- Create: `backend/src/main/java/com/coupleapp/common/ErrorCode.java`, `ApiException.java`, `GlobalExceptionHandler.java`, `AuthUser.java`, `ClockConfig.java`
- Test: `backend/src/test/java/com/coupleapp/common/SchemaTest.java`

**Interfaces:**
- Produces: `enum ErrorCode { VALIDATION_FAILED, UNAUTHORIZED, INVALID_CREDENTIALS, FORBIDDEN, NOT_FOUND, EMAIL_TAKEN, COUPLE_REQUIRED, COUPLE_ALREADY_PAIRED, INVITE_INVALID, INVITE_SELF, TOO_MANY_ATTEMPTS, MEDIA_NOT_UPLOADED, LOCATION_NOT_SHARED }` với `HttpStatus status()`; `new ApiException(ErrorCode, String detail)` + `ErrorCode code()`; `AuthUser.id(Jwt) → UUID`; bean `Clock`.

- [ ] **Step 1: Viết test schema (fail vì chưa có migration)**

`backend/src/test/java/com/coupleapp/common/SchemaTest.java`:
```java
package com.coupleapp.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.coupleapp.support.IntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class SchemaTest extends IntegrationTest {

    @Test
    void allPhase1TablesExist() {
        List<String> tables = jdbc.queryForList(
                "select tablename from pg_tables where schemaname = 'public'", String.class);
        assertThat(tables).contains(
                "users", "refresh_tokens", "user_settings", "device_tokens", "couples", "couple_members",
                "media", "places", "moments", "moment_media", "cycle_logs", "reminders",
                "size_entries", "preferences", "preference_links", "user_locations");
    }

    @Test
    void userCanHaveOnlyOneActiveCouple() {
        UUID user = insertUser("a@x.vn");
        UUID c1 = insertCouple();
        UUID c2 = insertCouple();
        jdbc.update("insert into couple_members(couple_id, user_id) values (?, ?)", c1, user);

        assertThatThrownBy(() ->
                jdbc.update("insert into couple_members(couple_id, user_id) values (?, ?)", c2, user))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void userCanJoinNewCoupleAfterLeaving() {
        UUID user = insertUser("a@x.vn");
        UUID c1 = insertCouple();
        UUID c2 = insertCouple();
        jdbc.update("insert into couple_members(couple_id, user_id, left_at) values (?, ?, now())", c1, user);
        jdbc.update("insert into couple_members(couple_id, user_id) values (?, ?)", c2, user);

        assertThat(jdbc.queryForObject("select count(*) from couple_members where user_id = ?", Integer.class, user))
                .isEqualTo(2);
    }

    @Test
    void emailIsUniqueIgnoringCase() {
        insertUser("lan@x.vn");
        assertThatThrownBy(() -> insertUser("LAN@x.vn")).isInstanceOf(DataIntegrityViolationException.class);
    }

    private UUID insertUser(String email) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into users(id, email, password_hash, display_name) values (?, ?, 'h', 'U')", id, email);
        return id;
    }

    private UUID insertCouple() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into couples(id, status) values (?, 'ACTIVE')", id);
        return id;
    }
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest=SchemaTest`
Expected: FAIL (bảng không tồn tại).

- [ ] **Step 3: Viết migration**

`backend/src/main/resources/db/migration/V1__init.sql`:
```sql
-- ===== Cặp đôi & người dùng =====
CREATE TABLE couples (
    id                 uuid PRIMARY KEY,
    status             text        NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
    started_dating_on  date,
    created_at         timestamptz NOT NULL DEFAULT now(),
    ended_at           timestamptz
);

CREATE TABLE users (
    id                      uuid PRIMARY KEY,
    email                   text        NOT NULL,
    password_hash           text        NOT NULL,
    display_name            text        NOT NULL,
    avatar_media_id         uuid,
    birthday                date,
    timezone                text        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    identity_verified_hash  text UNIQUE,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));

CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  text        NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE user_settings (
    user_id               uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    share_location        boolean NOT NULL DEFAULT true,
    share_cycle           boolean NOT NULL DEFAULT true,
    cycle_length_default  int     NOT NULL DEFAULT 28 CHECK (cycle_length_default BETWEEN 20 AND 45),
    notify_prefs          jsonb   NOT NULL DEFAULT '{}'
);

CREATE TABLE device_tokens (
    id               uuid PRIMARY KEY,
    user_id          uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expo_push_token  text        NOT NULL UNIQUE,
    platform         text        NOT NULL CHECK (platform IN ('ios', 'android')),
    last_seen_at     timestamptz NOT NULL DEFAULT now(),
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_device_tokens_user ON device_tokens (user_id);

CREATE TABLE couple_members (
    couple_id  uuid        NOT NULL REFERENCES couples (id),
    user_id    uuid        NOT NULL REFERENCES users (id),
    joined_at  timestamptz NOT NULL DEFAULT now(),
    left_at    timestamptz,
    PRIMARY KEY (couple_id, user_id)
);
-- Mỗi user chỉ có tối đa 1 cặp đôi đang hoạt động
CREATE UNIQUE INDEX ux_member_active ON couple_members (user_id) WHERE left_at IS NULL;

-- ===== Ảnh =====
CREATE TABLE media (
    id            uuid PRIMARY KEY,
    couple_id     uuid REFERENCES couples (id),          -- NULL = ảnh cá nhân (avatar)
    uploader_id   uuid        NOT NULL REFERENCES users (id),
    object_key    text        NOT NULL UNIQUE,
    content_type  text        NOT NULL,
    size_bytes    bigint,
    width         int,
    height        int,
    filter        text,
    taken_at      timestamptz,
    lat           double precision,
    lng           double precision,
    status        text        NOT NULL CHECK (status IN ('PENDING', 'READY')),
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_media_couple ON media (couple_id);
CREATE INDEX ix_media_pending ON media (created_at) WHERE status = 'PENDING';

ALTER TABLE users
    ADD CONSTRAINT fk_users_avatar FOREIGN KEY (avatar_media_id) REFERENCES media (id) ON DELETE SET NULL;

-- ===== Địa điểm =====
CREATE TABLE places (
    id            uuid PRIMARY KEY,
    couple_id     uuid             NOT NULL REFERENCES couples (id),
    name          text             NOT NULL,
    address       text,
    lat           double precision NOT NULL,
    lng           double precision NOT NULL,
    category      text,
    external_ref  text,
    created_by    uuid             NOT NULL REFERENCES users (id),
    created_at    timestamptz      NOT NULL DEFAULT now(),
    updated_at    timestamptz      NOT NULL DEFAULT now()
);
CREATE INDEX ix_places_couple ON places (couple_id);

-- ===== Kỷ niệm =====
CREATE TABLE moments (
    id               uuid PRIMARY KEY,
    couple_id        uuid        NOT NULL REFERENCES couples (id),
    type             text        NOT NULL CHECK (type IN ('ANNIVERSARY', 'DATE_PLAN', 'GIFT_OCCASION', 'CYCLE', 'CUSTOM')),
    title            text        NOT NULL,
    occurs_on        date        NOT NULL,
    occurs_at        timestamptz,
    recurrence       text        NOT NULL DEFAULT 'NONE' CHECK (recurrence IN ('NONE', 'YEARLY')),
    subject_user_id  uuid REFERENCES users (id),
    place_id         uuid REFERENCES places (id) ON DELETE SET NULL,
    message          text,
    details          jsonb       NOT NULL DEFAULT '{}',
    reminder_config  jsonb,
    created_by       uuid        NOT NULL REFERENCES users (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_moments_couple_date ON moments (couple_id, occurs_on);
CREATE INDEX ix_moments_subject ON moments (subject_user_id);
CREATE INDEX ix_moments_place ON moments (place_id);

CREATE TABLE moment_media (
    moment_id  uuid NOT NULL REFERENCES moments (id) ON DELETE CASCADE,
    position   int  NOT NULL,
    media_id   uuid NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    PRIMARY KEY (moment_id, position)
);
CREATE INDEX ix_moment_media_media ON moment_media (media_id);

CREATE TABLE cycle_logs (
    id            uuid PRIMARY KEY,
    user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    period_start  date        NOT NULL,
    period_end    date,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, period_start)
);

CREATE TABLE reminders (
    id            uuid PRIMARY KEY,
    couple_id     uuid        NOT NULL REFERENCES couples (id),
    moment_id     uuid        NOT NULL REFERENCES moments (id) ON DELETE CASCADE,
    recipient_id  uuid        NOT NULL REFERENCES users (id),
    fire_at       timestamptz NOT NULL,
    title         text        NOT NULL,
    body          text        NOT NULL,
    deep_link     text,
    status        text        NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
    attempts      int         NOT NULL DEFAULT 0,
    sent_at       timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_reminders_due ON reminders (fire_at) WHERE status = 'PENDING';
CREATE INDEX ix_reminders_moment ON reminders (moment_id);
CREATE INDEX ix_reminders_couple ON reminders (couple_id);

-- ===== Đặc điểm đối phương =====
CREATE TABLE size_entries (
    id               uuid PRIMARY KEY,
    subject_user_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind             text        NOT NULL,
    value            text        NOT NULL,
    note             text,
    visibility       text        NOT NULL DEFAULT 'SHARED' CHECK (visibility IN ('SHARED', 'AUTHOR_ONLY')),
    created_by       uuid        NOT NULL REFERENCES users (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_size_entries_subject ON size_entries (subject_user_id);

CREATE TABLE preferences (
    id               uuid PRIMARY KEY,
    subject_user_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category         text        NOT NULL,
    brand            text,
    name             text,
    color            text,
    note             text,
    visibility       text        NOT NULL DEFAULT 'SHARED' CHECK (visibility IN ('SHARED', 'AUTHOR_ONLY')),
    created_by       uuid        NOT NULL REFERENCES users (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_preferences_subject ON preferences (subject_user_id);

CREATE TABLE preference_links (
    id             uuid PRIMARY KEY,
    preference_id  uuid           NOT NULL REFERENCES preferences (id) ON DELETE CASCADE,
    url            text           NOT NULL,
    label          text,
    price          numeric(12, 0),
    created_at     timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX ix_preference_links_pref ON preference_links (preference_id);

-- ===== Vị trí =====
CREATE TABLE user_locations (
    user_id     uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    lat         double precision NOT NULL,
    lng         double precision NOT NULL,
    accuracy_m  real,
    updated_at  timestamptz      NOT NULL
);
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest=SchemaTest`
Expected: PASS (4 tests).

- [ ] **Step 5: Lớp lỗi chung + tiện ích**

`backend/src/main/java/com/coupleapp/common/ErrorCode.java`:
```java
package com.coupleapp.common;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    EMAIL_TAKEN(HttpStatus.CONFLICT),
    COUPLE_REQUIRED(HttpStatus.CONFLICT),
    COUPLE_ALREADY_PAIRED(HttpStatus.CONFLICT),
    INVITE_INVALID(HttpStatus.BAD_REQUEST),
    INVITE_SELF(HttpStatus.BAD_REQUEST),
    TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS),
    MEDIA_NOT_UPLOADED(HttpStatus.BAD_REQUEST),
    LOCATION_NOT_SHARED(HttpStatus.CONFLICT);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
```

`backend/src/main/java/com/coupleapp/common/ApiException.java`:
```java
package com.coupleapp.common;

public class ApiException extends RuntimeException {

    private final ErrorCode code;

    public ApiException(ErrorCode code, String detail) {
        super(detail);
        this.code = code;
    }

    public ErrorCode code() {
        return code;
    }

    public static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy");
    }
}
```

`backend/src/main/java/com/coupleapp/common/GlobalExceptionHandler.java`:
```java
package com.coupleapp.common;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> handleApi(ApiException e) {
        return problem(e.code(), e.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> handleInvalid(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors()
                .forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        return problem(ErrorCode.VALIDATION_FAILED, "Dữ liệu không hợp lệ", fields);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ProblemDetail> handleUnreadable(Exception e) {
        return problem(ErrorCode.VALIDATION_FAILED, "Dữ liệu gửi lên không đúng định dạng", null);
    }

    static ResponseEntity<ProblemDetail> problem(ErrorCode code, String detail, Map<String, String> fields) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(code.status(), detail);
        pd.setProperty("code", code.name());
        if (fields != null) {
            pd.setProperty("fields", fields);
        }
        return ResponseEntity.status(code.status()).body(pd);
    }
}
```

`backend/src/main/java/com/coupleapp/common/AuthUser.java`:
```java
package com.coupleapp.common;

import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

public final class AuthUser {

    private AuthUser() {}

    public static UUID id(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
```

`backend/src/main/java/com/coupleapp/common/ClockConfig.java`:
```java
package com.coupleapp.common;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
```

- [ ] **Step 6: Chạy toàn bộ test**

Run: `cd backend && ./mvnw -q test`
Expected: PASS (HealthTest + SchemaTest).

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(db): add phase 1 schema and common error handling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Đăng ký, đăng nhập, refresh/logout, `GET /api/me`

**Files:**
- Create: `backend/src/main/java/com/coupleapp/user/User.java`, `UserRepository.java`, `UserSettings.java`, `UserSettingsRepository.java`, `UserDtos.java`, `MeService.java`, `MeController.java`
- Create: `backend/src/main/java/com/coupleapp/auth/RefreshToken.java`, `RefreshTokenRepository.java`, `TokenService.java`, `AuthService.java`, `AuthController.java`, `AuthDtos.java`
- Modify: `backend/src/test/java/com/coupleapp/support/IntegrationTest.java` (thêm helper `register`, `userId`)
- Test: `backend/src/test/java/com/coupleapp/auth/AuthTest.java`

**Interfaces:**
- Consumes: `ErrorCode`, `ApiException`, `AuthUser`, `JwtProperties`, `JwtEncoder`, `PasswordEncoder`, `Clock`.
- Produces:
  - Entity `User` (getter/setter: `id, email, passwordHash, displayName, avatarMediaId, birthday, timezone, createdAt, updatedAt`) + `ZoneId zone()`; `UserRepository.findByEmail(String)`, `existsByEmail(String)`.
  - Entity `UserSettings(UUID userId)` (`shareLocation`, `shareCycle`, `cycleLengthDefault`, `Map<String,Boolean> notifyPrefs`, `boolean notifyEnabled(String type)`); `UserSettingsRepository extends JpaRepository<UserSettings, UUID>`.
  - `MeService.get(UUID) → UserDtos.MeResponse(UUID id, String email, String displayName, LocalDate birthday, String timezone, String avatarUrl)`.
  - Test helper: `String register(String email, String displayName)` → access token; `UUID userId(String token)`.

- [ ] **Step 1: Thêm helper vào `IntegrationTest`**

Thêm import `java.util.Map`, `java.util.UUID`, `static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status` và các method:
```java
    protected String register(String email, String displayName) throws Exception {
        return read(post("/api/auth/register", null,
                Map.of("email", email, "password", "password123", "displayName", displayName))
                .andExpect(status().isCreated()))
                .get("accessToken").asText();
    }

    protected UUID userId(String token) throws Exception {
        return UUID.fromString(read(get("/api/me", token).andExpect(status().isOk())).get("id").asText());
    }
```

- [ ] **Step 2: Viết test (fail)**

`backend/src/test/java/com/coupleapp/auth/AuthTest.java`:
```java
package com.coupleapp.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AuthTest extends IntegrationTest {

    @Test
    void registerReturnsTokensThatAuthenticate() throws Exception {
        JsonNode tokens = read(post("/api/auth/register", null,
                Map.of("email", " Lan@Example.com ", "password", "password123", "displayName", "Lan"))
                .andExpect(status().isCreated()));

        assertThat(tokens.get("refreshToken").asText()).isNotBlank();
        assertThat(tokens.get("expiresIn").asLong()).isEqualTo(900);

        get("/api/me", tokens.get("accessToken").asText())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("lan@example.com"))
                .andExpect(jsonPath("$.displayName").value("Lan"))
                .andExpect(jsonPath("$.timezone").value("Asia/Ho_Chi_Minh"));
    }

    @Test
    void registerCreatesDefaultSettings() throws Exception {
        String token = register("lan@x.vn", "Lan");
        Integer count = jdbc.queryForObject(
                "select count(*) from user_settings where user_id = ?", Integer.class, userId(token));
        assertThat(count).isEqualTo(1);
    }

    @Test
    void duplicateEmailIgnoringCaseIsRejected() throws Exception {
        register("lan@x.vn", "Lan");
        post("/api/auth/register", null, Map.of("email", "LAN@x.vn", "password", "password123", "displayName", "L2"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    @Test
    void invalidRegisterBodyReturnsFieldErrors() throws Exception {
        post("/api/auth/register", null, Map.of("email", "not-an-email", "password", "short", "displayName", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fields.email").exists())
                .andExpect(jsonPath("$.fields.password").exists())
                .andExpect(jsonPath("$.fields.displayName").exists());
    }

    @Test
    void loginWithWrongPasswordFails() throws Exception {
        register("lan@x.vn", "Lan");
        post("/api/auth/login", null, Map.of("email", "lan@x.vn", "password", "wrong-password"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void loginSucceedsCaseInsensitive() throws Exception {
        register("lan@x.vn", "Lan");
        post("/api/auth/login", null, Map.of("email", "LAN@X.VN", "password", "password123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void refreshRotatesTokenAndOldOneStopsWorking() throws Exception {
        JsonNode first = read(post("/api/auth/register", null,
                Map.of("email", "lan@x.vn", "password", "password123", "displayName", "Lan")));
        String oldRefresh = first.get("refreshToken").asText();

        JsonNode second = read(post("/api/auth/refresh", null, Map.of("refreshToken", oldRefresh))
                .andExpect(status().isOk()));
        assertThat(second.get("refreshToken").asText()).isNotEqualTo(oldRefresh);

        post("/api/auth/refresh", null, Map.of("refreshToken", oldRefresh))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        JsonNode tokens = read(post("/api/auth/register", null,
                Map.of("email", "lan@x.vn", "password", "password123", "displayName", "Lan")));
        String refresh = tokens.get("refreshToken").asText();

        post("/api/auth/logout", null, Map.of("refreshToken", refresh)).andExpect(status().isNoContent());
        post("/api/auth/refresh", null, Map.of("refreshToken", refresh)).andExpect(status().isUnauthorized());
    }

    @Test
    void invalidAccessTokenIsRejected() throws Exception {
        get("/api/me", "not-a-jwt").andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest=AuthTest`
Expected: FAIL (404 / thiếu class).

- [ ] **Step 4: Module `user`**

`backend/src/main/java/com/coupleapp/user/User.java`:
```java
package com.coupleapp.user;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String email;
    private String passwordHash;
    private String displayName;
    private UUID avatarMediaId;
    private LocalDate birthday;
    private String timezone = "Asia/Ho_Chi_Minh";
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public ZoneId zone() {
        return ZoneId.of(timezone);
    }
}
```

`backend/src/main/java/com/coupleapp/user/UserRepository.java`:
```java
package com.coupleapp.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);
}
```

`backend/src/main/java/com/coupleapp/user/UserSettings.java`:
```java
package com.coupleapp.user;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "user_settings")
@Getter
@Setter
@NoArgsConstructor
public class UserSettings {

    @Id
    private UUID userId;

    private boolean shareLocation = true;
    private boolean shareCycle = true;
    private int cycleLengthDefault = 28;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Boolean> notifyPrefs = new HashMap<>();

    public UserSettings(UUID userId) {
        this.userId = userId;
    }

    /** Loại kỷ niệm chưa cấu hình được coi là bật. */
    public boolean notifyEnabled(String momentType) {
        return notifyPrefs.getOrDefault(momentType, true);
    }
}
```

`backend/src/main/java/com/coupleapp/user/UserSettingsRepository.java`:
```java
package com.coupleapp.user;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSettingsRepository extends JpaRepository<UserSettings, UUID> {}
```

`backend/src/main/java/com/coupleapp/user/UserDtos.java`:
```java
package com.coupleapp.user;

import java.time.LocalDate;
import java.util.UUID;

public final class UserDtos {

    private UserDtos() {}

    public record MeResponse(
            UUID id, String email, String displayName, LocalDate birthday, String timezone, String avatarUrl) {}
}
```

`backend/src/main/java/com/coupleapp/user/MeService.java`:
```java
package com.coupleapp.user;

import com.coupleapp.common.ApiException;
import com.coupleapp.user.UserDtos.MeResponse;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MeService {

    private final UserRepository users;

    @Transactional(readOnly = true)
    public MeResponse get(UUID userId) {
        return toResponse(load(userId));
    }

    User load(UUID userId) {
        return users.findById(userId).orElseThrow(ApiException::notFound);
    }

    MeResponse toResponse(User u) {
        return new MeResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getBirthday(), u.getTimezone(), null);
    }
}
```

`backend/src/main/java/com/coupleapp/user/MeController.java`:
```java
package com.coupleapp.user;

import com.coupleapp.common.AuthUser;
import com.coupleapp.user.UserDtos.MeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final MeService me;

    @GetMapping
    public MeResponse get(@AuthenticationPrincipal Jwt jwt) {
        return me.get(AuthUser.id(jwt));
    }
}
```

- [ ] **Step 5: Module `auth`**

`backend/src/main/java/com/coupleapp/auth/RefreshToken.java`:
```java
package com.coupleapp.auth;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;
    private String tokenHash;
    private Instant expiresAt;
    private Instant revokedAt;
    private Instant createdAt = Instant.now();
}
```

`backend/src/main/java/com/coupleapp/auth/RefreshTokenRepository.java`:
```java
package com.coupleapp.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);
}
```

`backend/src/main/java/com/coupleapp/auth/AuthDtos.java`:
```java
package com.coupleapp.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 50) String displayName) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record TokenResponse(String accessToken, String refreshToken, long expiresIn) {}
}
```

`backend/src/main/java/com/coupleapp/auth/TokenService.java`:
```java
package com.coupleapp.auth;

import com.coupleapp.auth.AuthDtos.TokenResponse;
import com.coupleapp.common.security.JwtProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final JwtEncoder encoder;
    private final JwtProperties props;
    private final RefreshTokenRepository refreshTokens;
    private final Clock clock;

    public TokenResponse issue(UUID userId) {
        Instant now = clock.instant();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(userId.toString())
                .issuedAt(now)
                .expiresAt(now.plus(props.accessTtl()))
                .build();
        String access = encoder.encode(
                JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        RefreshToken rt = new RefreshToken();
        rt.setUserId(userId);
        rt.setTokenHash(sha256(refresh));
        rt.setExpiresAt(now.plus(props.refreshTtl()));
        rt.setCreatedAt(now);
        refreshTokens.save(rt);

        return new TokenResponse(access, refresh, props.accessTtl().toSeconds());
    }

    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
```

`backend/src/main/java/com/coupleapp/auth/AuthService.java`:
```java
package com.coupleapp.auth;

import com.coupleapp.auth.AuthDtos.LoginRequest;
import com.coupleapp.auth.AuthDtos.RegisterRequest;
import com.coupleapp.auth.AuthDtos.TokenResponse;
import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwords;
    private final TokenService tokens;
    private final Clock clock;

    @Transactional
    public TokenResponse register(RegisterRequest r) {
        String email = normalize(r.email());
        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwords.encode(r.password()));
        u.setDisplayName(r.displayName().trim());
        try {
            users.saveAndFlush(u);
        } catch (DataIntegrityViolationException e) {
            throw emailTaken();
        }
        settings.save(new UserSettings(u.getId()));
        return tokens.issue(u.getId());
    }

    @Transactional
    public TokenResponse login(LoginRequest r) {
        User u = users.findByEmail(normalize(r.email()))
                .filter(x -> passwords.matches(r.password(), x.getPasswordHash()))
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "Email hoặc mật khẩu không đúng"));
        return tokens.issue(u.getId());
    }

    @Transactional
    public TokenResponse refresh(String rawToken) {
        RefreshToken t = refreshTokens.findByTokenHash(TokenService.sha256(rawToken))
                .filter(x -> x.getRevokedAt() == null && x.getExpiresAt().isAfter(clock.instant()))
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn"));
        t.setRevokedAt(clock.instant());
        return tokens.issue(t.getUserId());
    }

    @Transactional
    public void logout(String rawToken) {
        refreshTokens.findByTokenHash(TokenService.sha256(rawToken))
                .filter(t -> t.getRevokedAt() == null)
                .ifPresent(t -> t.setRevokedAt(clock.instant()));
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static ApiException emailTaken() {
        return new ApiException(ErrorCode.EMAIL_TAKEN, "Email đã được sử dụng");
    }
}
```

`backend/src/main/java/com/coupleapp/auth/AuthController.java`:
```java
package com.coupleapp.auth;

import com.coupleapp.auth.AuthDtos.LoginRequest;
import com.coupleapp.auth.AuthDtos.RefreshRequest;
import com.coupleapp.auth.AuthDtos.RegisterRequest;
import com.coupleapp.auth.AuthDtos.TokenResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService auth;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenResponse register(@Valid @RequestBody RegisterRequest r) {
        return auth.register(r);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest r) {
        return auth.login(r);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest r) {
        return auth.refresh(r.refreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest r) {
        auth.logout(r.refreshToken());
    }
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest=AuthTest`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(auth): email registration, login, refresh rotation and logout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hồ sơ cá nhân, cài đặt, thiết bị nhận push

**Files:**
- Modify: `backend/src/main/java/com/coupleapp/user/UserDtos.java`, `MeService.java`, `MeController.java`
- Create: `backend/src/main/java/com/coupleapp/user/UserSettingsChangedEvent.java`
- Create: `backend/src/main/java/com/coupleapp/notification/DeviceToken.java`, `DeviceTokenRepository.java`, `DeviceController.java`
- Test: `backend/src/test/java/com/coupleapp/user/MeTest.java`

**Interfaces:**
- Consumes: `User`, `UserSettings`, repositories (Task 3).
- Produces:
  - `record UserSettingsChangedEvent(UUID userId, boolean shareLocation, boolean shareCycle, boolean shareLocationChanged, boolean shareCycleChanged)` — publish đồng bộ trong transaction cập nhật settings.
  - `UserDtos.UpdateMeRequest(String displayName, LocalDate birthday, String timezone)`, `UserDtos.SettingsResponse(boolean shareLocation, boolean shareCycle, int cycleLengthDefault, Map<String,Boolean> notifyPrefs)`, `UserDtos.UpdateSettingsRequest(Boolean shareLocation, Boolean shareCycle, Map<String,Boolean> notifyPrefs)`.
  - Entity `DeviceToken` (`id, userId, expoPushToken, platform, lastSeenAt, createdAt`); `DeviceTokenRepository.findByExpoPushToken(String)`, `findByUserId(UUID) → List<DeviceToken>`, `deleteByExpoPushTokenAndUserId(String, UUID)`.

- [ ] **Step 1: Viết test (fail)**

`backend/src/test/java/com/coupleapp/user/MeTest.java`:
```java
package com.coupleapp.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MeTest extends IntegrationTest {

    @Test
    void updateProfile() throws Exception {
        String token = register("lan@x.vn", "Lan");
        patch("/api/me", token, Map.of("displayName", "Lan Anh", "birthday", "2000-03-08", "timezone", "Asia/Tokyo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Lan Anh"))
                .andExpect(jsonPath("$.birthday").value("2000-03-08"))
                .andExpect(jsonPath("$.timezone").value("Asia/Tokyo"));
    }

    @Test
    void invalidTimezoneIsRejected() throws Exception {
        String token = register("lan@x.vn", "Lan");
        patch("/api/me", token, Map.of("timezone", "Mars/Olympus"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void settingsDefaultsAndPartialUpdate() throws Exception {
        String token = register("lan@x.vn", "Lan");
        get("/api/me/settings", token)
                .andExpect(jsonPath("$.shareLocation").value(true))
                .andExpect(jsonPath("$.shareCycle").value(true))
                .andExpect(jsonPath("$.cycleLengthDefault").value(28));

        put("/api/me/settings", token, Map.of("shareCycle", false, "notifyPrefs", Map.of("DATE_PLAN", false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareLocation").value(true))
                .andExpect(jsonPath("$.shareCycle").value(false))
                .andExpect(jsonPath("$.notifyPrefs.DATE_PLAN").value(false));
    }

    @Test
    void invalidNotifyPrefKeyIsRejected() throws Exception {
        String token = register("lan@x.vn", "Lan");
        put("/api/me/settings", token, Map.of("notifyPrefs", Map.of("bad key!", true)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deviceRegistrationIsIdempotentAndMovesBetweenUsers() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        Map<String, String> device = Map.of("token", "ExponentPushToken[abc]", "platform", "ios");

        post("/api/me/devices", lan, device).andExpect(status().isNoContent());
        post("/api/me/devices", lan, device).andExpect(status().isNoContent());
        assertThat(countDevices(userId(lan).toString())).isEqualTo(1);

        post("/api/me/devices", minh, device).andExpect(status().isNoContent());
        assertThat(countDevices(userId(lan).toString())).isZero();
        assertThat(countDevices(userId(minh).toString())).isEqualTo(1);

        delete("/api/me/devices?token=ExponentPushToken[abc]", minh).andExpect(status().isNoContent());
        assertThat(countDevices(userId(minh).toString())).isZero();
    }

    @Test
    void invalidPlatformIsRejected() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        post("/api/me/devices", lan, Map.of("token", "t", "platform", "windows")).andExpect(status().isBadRequest());
    }

    private int countDevices(String userId) {
        return jdbc.queryForObject("select count(*) from device_tokens where user_id = ?::uuid", Integer.class, userId);
    }
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest=MeTest`
Expected: FAIL.

- [ ] **Step 3: DTO + event**

Thay toàn bộ `backend/src/main/java/com/coupleapp/user/UserDtos.java`:
```java
package com.coupleapp.user;

import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class UserDtos {

    private UserDtos() {}

    public record MeResponse(
            UUID id, String email, String displayName, LocalDate birthday, String timezone, String avatarUrl) {}

    public record UpdateMeRequest(
            @Size(min = 1, max = 50) String displayName,
            @Past LocalDate birthday,
            @Size(max = 64) String timezone) {}

    public record SettingsResponse(
            boolean shareLocation, boolean shareCycle, int cycleLengthDefault, Map<String, Boolean> notifyPrefs) {}

    public record UpdateSettingsRequest(Boolean shareLocation, Boolean shareCycle, Map<String, Boolean> notifyPrefs) {}
}
```

`backend/src/main/java/com/coupleapp/user/UserSettingsChangedEvent.java`:
```java
package com.coupleapp.user;

import java.util.UUID;

public record UserSettingsChangedEvent(
        UUID userId,
        boolean shareLocation,
        boolean shareCycle,
        boolean shareLocationChanged,
        boolean shareCycleChanged) {}
```

- [ ] **Step 4: Service + controller**

Thay toàn bộ `backend/src/main/java/com/coupleapp/user/MeService.java`:
```java
package com.coupleapp.user;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.user.UserDtos.MeResponse;
import com.coupleapp.user.UserDtos.SettingsResponse;
import com.coupleapp.user.UserDtos.UpdateMeRequest;
import com.coupleapp.user.UserDtos.UpdateSettingsRequest;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MeService {

    private static final Pattern PREF_KEY = Pattern.compile("^[A-Z_]{1,40}$");

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional(readOnly = true)
    public MeResponse get(UUID userId) {
        return toResponse(load(userId));
    }

    @Transactional
    public MeResponse update(UUID userId, UpdateMeRequest r) {
        User u = load(userId);
        if (r.displayName() != null) {
            u.setDisplayName(r.displayName().trim());
        }
        if (r.birthday() != null) {
            u.setBirthday(r.birthday());
        }
        if (r.timezone() != null) {
            try {
                ZoneId.of(r.timezone());
            } catch (DateTimeException e) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "Múi giờ không hợp lệ");
            }
            u.setTimezone(r.timezone());
        }
        u.setUpdatedAt(clock.instant());
        return toResponse(u);
    }

    @Transactional(readOnly = true)
    public SettingsResponse getSettings(UUID userId) {
        return toResponse(settings.findById(userId).orElseGet(() -> new UserSettings(userId)));
    }

    @Transactional
    public SettingsResponse updateSettings(UUID userId, UpdateSettingsRequest r) {
        UserSettings s = settings.findById(userId).orElseGet(() -> new UserSettings(userId));
        boolean locationBefore = s.isShareLocation();
        boolean cycleBefore = s.isShareCycle();
        if (r.shareLocation() != null) {
            s.setShareLocation(r.shareLocation());
        }
        if (r.shareCycle() != null) {
            s.setShareCycle(r.shareCycle());
        }
        if (r.notifyPrefs() != null) {
            for (Map.Entry<String, Boolean> e : r.notifyPrefs().entrySet()) {
                if (!PREF_KEY.matcher(e.getKey()).matches() || e.getValue() == null) {
                    throw new ApiException(ErrorCode.VALIDATION_FAILED, "Cấu hình thông báo không hợp lệ");
                }
            }
            s.getNotifyPrefs().putAll(r.notifyPrefs());
        }
        settings.save(s);
        events.publishEvent(new UserSettingsChangedEvent(
                userId, s.isShareLocation(), s.isShareCycle(),
                locationBefore != s.isShareLocation(), cycleBefore != s.isShareCycle()));
        return toResponse(s);
    }

    User load(UUID userId) {
        return users.findById(userId).orElseThrow(ApiException::notFound);
    }

    MeResponse toResponse(User u) {
        return new MeResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getBirthday(), u.getTimezone(), null);
    }

    private static SettingsResponse toResponse(UserSettings s) {
        return new SettingsResponse(
                s.isShareLocation(), s.isShareCycle(), s.getCycleLengthDefault(), Map.copyOf(s.getNotifyPrefs()));
    }
}
```

Thay toàn bộ `backend/src/main/java/com/coupleapp/user/MeController.java`:
```java
package com.coupleapp.user;

import com.coupleapp.common.AuthUser;
import com.coupleapp.user.UserDtos.MeResponse;
import com.coupleapp.user.UserDtos.SettingsResponse;
import com.coupleapp.user.UserDtos.UpdateMeRequest;
import com.coupleapp.user.UserDtos.UpdateSettingsRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final MeService me;

    @GetMapping
    public MeResponse get(@AuthenticationPrincipal Jwt jwt) {
        return me.get(AuthUser.id(jwt));
    }

    @PatchMapping
    public MeResponse update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateMeRequest r) {
        return me.update(AuthUser.id(jwt), r);
    }

    @GetMapping("/settings")
    public SettingsResponse settings(@AuthenticationPrincipal Jwt jwt) {
        return me.getSettings(AuthUser.id(jwt));
    }

    @PutMapping("/settings")
    public SettingsResponse updateSettings(@AuthenticationPrincipal Jwt jwt, @RequestBody UpdateSettingsRequest r) {
        return me.updateSettings(AuthUser.id(jwt), r);
    }
}
```

- [ ] **Step 5: Thiết bị nhận push**

`backend/src/main/java/com/coupleapp/notification/DeviceToken.java`:
```java
package com.coupleapp.notification;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "device_tokens")
@Getter
@Setter
@NoArgsConstructor
public class DeviceToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;
    private String expoPushToken;
    private String platform;
    private Instant lastSeenAt;
    private Instant createdAt = Instant.now();
}
```

`backend/src/main/java/com/coupleapp/notification/DeviceTokenRepository.java`:
```java
package com.coupleapp.notification;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {

    Optional<DeviceToken> findByExpoPushToken(String expoPushToken);

    List<DeviceToken> findByUserId(UUID userId);

    void deleteByExpoPushTokenAndUserId(String expoPushToken, UUID userId);
}
```

`backend/src/main/java/com/coupleapp/notification/DeviceController.java`:
```java
package com.coupleapp.notification;

import com.coupleapp.common.AuthUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/devices")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceTokenRepository devices;
    private final Clock clock;

    public record RegisterDeviceRequest(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Pattern(regexp = "ios|android") String platform) {}

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void register(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RegisterDeviceRequest r) {
        DeviceToken d = devices.findByExpoPushToken(r.token()).orElseGet(DeviceToken::new);
        d.setExpoPushToken(r.token());
        d.setUserId(AuthUser.id(jwt));
        d.setPlatform(r.platform());
        d.setLastSeenAt(clock.instant());
        devices.save(d);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void unregister(@AuthenticationPrincipal Jwt jwt, @RequestParam String token) {
        devices.deleteByExpoPushTokenAndUserId(token, AuthUser.id(jwt));
    }
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest=MeTest`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(user): profile update, settings and push device registration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ghép đôi bằng mã mời (Redis)

**Files:**
- Create: `backend/src/main/java/com/coupleapp/couple/Couple.java`, `CoupleStatus.java`, `CoupleMember.java`, `CoupleRepository.java`, `CoupleMemberRepository.java`, `CoupleContext.java`, `CoupleAccess.java`, `InviteService.java`, `CoupleService.java`, `CoupleController.java`, `CoupleDtos.java`, `CouplePairedEvent.java`, `CoupleEndedEvent.java`
- Modify: `backend/src/test/java/com/coupleapp/support/IntegrationTest.java` (helper `pair`)
- Test: `backend/src/test/java/com/coupleapp/couple/CoupleTest.java`

**Interfaces:**
- Consumes: `UserRepository`, `ErrorCode`, `ApiException`, `Clock`.
- Produces:
  - `record CoupleContext(UUID coupleId, UUID userId, UUID partnerId)`.
  - `CoupleAccess.findActive(UUID userId) → Optional<CoupleContext>`, `CoupleAccess.requireActive(UUID userId) → CoupleContext` (ném `COUPLE_REQUIRED`).
  - `record CouplePairedEvent(UUID coupleId, UUID inviterId, UUID joinerId, LocalDate startedDatingOn)` — publish đồng bộ trong transaction ghép đôi.
  - `record CoupleEndedEvent(UUID coupleId)`.
  - `CoupleService.join(UUID joinerId, String code, LocalDate startedDatingOn) → CoupleDtos.CoupleResponse`.
  - Test helper: `void pair(String inviterToken, String joinerToken)`, `void pair(String inviterToken, String joinerToken, String startedDatingOn)`.

- [ ] **Step 1: Thêm helper `pair` vào `IntegrationTest`**

Thêm import `java.util.HashMap` và:
```java
    protected void pair(String inviterToken, String joinerToken) throws Exception {
        pair(inviterToken, joinerToken, null);
    }

    protected void pair(String inviterToken, String joinerToken, String startedDatingOn) throws Exception {
        String code = read(post("/api/couples/invites", inviterToken, null).andExpect(status().isCreated()))
                .get("code").asText();
        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        if (startedDatingOn != null) {
            body.put("startedDatingOn", startedDatingOn);
        }
        post("/api/couples/join", joinerToken, body).andExpect(status().isCreated());
    }
```

- [ ] **Step 2: Viết test (fail)**

`backend/src/test/java/com/coupleapp/couple/CoupleTest.java`:
```java
package com.coupleapp.couple;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.common.ApiException;
import com.coupleapp.support.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CoupleTest extends IntegrationTest {

    @Autowired CoupleService coupleService;

    @Test
    void inviteAndJoinCreatesCouple() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");

        String code = read(post("/api/couples/invites", lan, null)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.expiresAt").exists())).get("code").asText();
        assertThat(code).matches("^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$");
        assertThat(redis.getExpire("invite:" + code)).isBetween(3500L, 3600L);

        post("/api/couples/join", minh, Map.of("code", code.toLowerCase(), "startedDatingOn", "2025-02-14"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.partner.displayName").value("Lan"))
                .andExpect(jsonPath("$.startedDatingOn").value("2025-02-14"));

        get("/api/couples/me", lan)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.partner.displayName").value("Minh"));
        assertThat(redis.hasKey("invite:" + code)).isFalse();
    }

    @Test
    void cannotJoinOwnCode() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String code = read(post("/api/couples/invites", lan, null)).get("code").asText();
        post("/api/couples/join", lan, Map.of("code", code))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVITE_SELF"));
    }

    @Test
    void unknownOrExpiredCodeIsInvalid() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        String code = read(post("/api/couples/invites", lan, null)).get("code").asText();
        redis.delete("invite:" + code); // mô phỏng hết TTL

        post("/api/couples/join", minh, Map.of("code", code))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVITE_INVALID"));
    }

    @Test
    void newInviteInvalidatesPreviousOne() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        String first = read(post("/api/couples/invites", lan, null)).get("code").asText();
        String second = read(post("/api/couples/invites", lan, null)).get("code").asText();

        post("/api/couples/join", minh, Map.of("code", first)).andExpect(jsonPath("$.code").value("INVITE_INVALID"));
        post("/api/couples/join", minh, Map.of("code", second)).andExpect(status().isCreated());
    }

    @Test
    void pairedUsersCannotInviteOrJoin() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        String hoa = register("hoa@x.vn", "Hoa");
        pair(lan, minh);

        post("/api/couples/invites", lan, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUPLE_ALREADY_PAIRED"));

        String hoaCode = read(post("/api/couples/invites", hoa, null)).get("code").asText();
        post("/api/couples/join", minh, Map.of("code", hoaCode))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUPLE_ALREADY_PAIRED"));
    }

    @Test
    void joinAttemptsAreRateLimited() throws Exception {
        String minh = register("minh@x.vn", "Minh");
        for (int i = 0; i < 10; i++) {
            post("/api/couples/join", minh, Map.of("code", "ZZZZZZZZ")).andExpect(status().isBadRequest());
        }
        post("/api/couples/join", minh, Map.of("code", "ZZZZZZZZ"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
    }

    @Test
    void notPairedReturnsCoupleRequired() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        get("/api/couples/me", lan)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));
    }

    @Test
    void endingCoupleLetsBothPairAgain() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        String hoa = register("hoa@x.vn", "Hoa");
        pair(lan, minh);

        post("/api/couples/me/end", minh, null).andExpect(status().isNoContent());
        get("/api/couples/me", lan).andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));

        pair(lan, hoa);
        get("/api/couples/me", hoa).andExpect(jsonPath("$.partner.displayName").value("Lan"));
    }

    @Test
    void concurrentJoinWithSameCodeCreatesOneCouple() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        UUID minh = userId(register("minh@x.vn", "Minh"));
        UUID hoa = userId(register("hoa@x.vn", "Hoa"));
        String code = read(post("/api/couples/invites", lan, null)).get("code").asText();

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Boolean>> results = new ArrayList<>();
        for (UUID joiner : List.of(minh, hoa)) {
            Callable<Boolean> task = () -> {
                start.await();
                try {
                    coupleService.join(joiner, code, null);
                    return true;
                } catch (ApiException e) {
                    return false;
                }
            };
            results.add(pool.submit(task));
        }
        start.countDown();
        int successes = 0;
        for (Future<Boolean> f : results) {
            if (f.get()) {
                successes++;
            }
        }
        pool.shutdown();

        assertThat(successes).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from couple_members", Integer.class)).isEqualTo(2);
    }
}
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest=CoupleTest`
Expected: FAIL.

- [ ] **Step 4: Entity + repository**

`backend/src/main/java/com/coupleapp/couple/CoupleStatus.java`:
```java
package com.coupleapp.couple;

public enum CoupleStatus { ACTIVE, ENDED }
```

`backend/src/main/java/com/coupleapp/couple/Couple.java`:
```java
package com.coupleapp.couple;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "couples")
@Getter
@Setter
@NoArgsConstructor
public class Couple {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    private CoupleStatus status = CoupleStatus.ACTIVE;

    private LocalDate startedDatingOn;
    private Instant createdAt = Instant.now();
    private Instant endedAt;
}
```

`backend/src/main/java/com/coupleapp/couple/CoupleMember.java`:
```java
package com.coupleapp.couple;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "couple_members")
@IdClass(CoupleMember.Pk.class)
@Getter
@Setter
@NoArgsConstructor
public class CoupleMember {

    @Id
    private UUID coupleId;

    @Id
    private UUID userId;

    private Instant joinedAt;
    private Instant leftAt;

    public CoupleMember(UUID coupleId, UUID userId, Instant joinedAt) {
        this.coupleId = coupleId;
        this.userId = userId;
        this.joinedAt = joinedAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Pk implements Serializable {
        private UUID coupleId;
        private UUID userId;
    }
}
```

`backend/src/main/java/com/coupleapp/couple/CoupleRepository.java`:
```java
package com.coupleapp.couple;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoupleRepository extends JpaRepository<Couple, UUID> {}
```

`backend/src/main/java/com/coupleapp/couple/CoupleMemberRepository.java`:
```java
package com.coupleapp.couple;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoupleMemberRepository extends JpaRepository<CoupleMember, CoupleMember.Pk> {

    Optional<CoupleMember> findByUserIdAndLeftAtIsNull(UUID userId);

    List<CoupleMember> findByCoupleIdAndLeftAtIsNull(UUID coupleId);
}
```

- [ ] **Step 5: Truy cập cặp đôi + sự kiện**

`backend/src/main/java/com/coupleapp/couple/CoupleContext.java`:
```java
package com.coupleapp.couple;

import java.util.UUID;

/** Cặp đôi đang hoạt động nhìn từ góc của {@code userId}. */
public record CoupleContext(UUID coupleId, UUID userId, UUID partnerId) {}
```

`backend/src/main/java/com/coupleapp/couple/CouplePairedEvent.java`:
```java
package com.coupleapp.couple;

import java.time.LocalDate;
import java.util.UUID;

public record CouplePairedEvent(UUID coupleId, UUID inviterId, UUID joinerId, LocalDate startedDatingOn) {}
```

`backend/src/main/java/com/coupleapp/couple/CoupleEndedEvent.java`:
```java
package com.coupleapp.couple;

import java.util.UUID;

public record CoupleEndedEvent(UUID coupleId) {}
```

`backend/src/main/java/com/coupleapp/couple/CoupleAccess.java`:
```java
package com.coupleapp.couple;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class CoupleAccess {

    private final CoupleMemberRepository members;

    @Transactional(readOnly = true)
    public Optional<CoupleContext> findActive(UUID userId) {
        return members.findByUserIdAndLeftAtIsNull(userId).flatMap(m ->
                members.findByCoupleIdAndLeftAtIsNull(m.getCoupleId()).stream()
                        .map(CoupleMember::getUserId)
                        .filter(id -> !id.equals(userId))
                        .findFirst()
                        .map(partner -> new CoupleContext(m.getCoupleId(), userId, partner)));
    }

    public CoupleContext requireActive(UUID userId) {
        return findActive(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_REQUIRED, "Bạn chưa ghép đôi"));
    }
}
```

- [ ] **Step 6: Mã mời trên Redis**

`backend/src/main/java/com/coupleapp/couple/InviteService.java`:
```java
package com.coupleapp.couple;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InviteService {

    static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ 0, O, 1, I
    static final int CODE_LENGTH = 8;
    static final Duration TTL = Duration.ofHours(1);
    static final Duration RATE_WINDOW = Duration.ofMinutes(15);
    static final int MAX_JOIN_ATTEMPTS = 10;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final StringRedisTemplate redis;
    private final ObjectMapper json;
    private final Clock clock;

    public record Invite(String code, Instant expiresAt) {}

    public record InvitePayload(UUID inviterId, Instant expiresAt) {}

    public Invite create(UUID inviterId) {
        String old = redis.opsForValue().get(userKey(inviterId));
        if (old != null) {
            redis.delete(codeKey(old));
        }
        Instant expiresAt = clock.instant().plus(TTL);
        String payload = write(new InvitePayload(inviterId, expiresAt));
        for (int attempt = 0; attempt < 5; attempt++) {
            String code = randomCode();
            if (Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(codeKey(code), payload, TTL))) {
                redis.opsForValue().set(userKey(inviterId), code, TTL);
                return new Invite(code, expiresAt);
            }
        }
        throw new IllegalStateException("Không sinh được mã mời duy nhất");
    }

    public Optional<InvitePayload> peek(String code) {
        return Optional.ofNullable(redis.opsForValue().get(codeKey(code))).map(this::parse);
    }

    /** Lấy và xoá mã trong một lệnh (GETDEL) — chỉ một request giành được mã. */
    public Optional<InvitePayload> claim(String code) {
        Optional<InvitePayload> payload =
                Optional.ofNullable(redis.opsForValue().getAndDelete(codeKey(code))).map(this::parse);
        payload.ifPresent(p -> {
            if (code.equals(redis.opsForValue().get(userKey(p.inviterId())))) {
                redis.delete(userKey(p.inviterId()));
            }
        });
        return payload;
    }

    /** Trả lại mã khi ghép đôi thất bại sau khi đã giành mã. */
    public void restore(String code, InvitePayload p) {
        Duration left = Duration.between(clock.instant(), p.expiresAt());
        if (left.isPositive()) {
            redis.opsForValue().setIfAbsent(codeKey(code), write(p), left);
            redis.opsForValue().set(userKey(p.inviterId()), code, left);
        }
    }

    public void checkJoinRateLimit(UUID userId) {
        String key = "ratelimit:join:" + userId;
        Long attempts = redis.opsForValue().increment(key);
        if (attempts != null && attempts == 1) {
            redis.expire(key, RATE_WINDOW);
        }
        if (attempts != null && attempts > MAX_JOIN_ATTEMPTS) {
            throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, "Bạn nhập mã quá nhiều lần, thử lại sau 15 phút");
        }
    }

    public static String normalize(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private static String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    private static String codeKey(String code) {
        return "invite:" + code;
    }

    private static String userKey(UUID userId) {
        return "invite:user:" + userId;
    }

    private String write(InvitePayload p) {
        try {
            return json.writeValueAsString(p);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private InvitePayload parse(String value) {
        try {
            return json.readValue(value, InvitePayload.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
```

- [ ] **Step 7: Service + controller**

`backend/src/main/java/com/coupleapp/couple/CoupleDtos.java`:
```java
package com.coupleapp.couple;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class CoupleDtos {

    private CoupleDtos() {}

    public record InviteResponse(String code, Instant expiresAt) {}

    public record JoinRequest(@NotBlank @Size(max = 20) String code, @PastOrPresent LocalDate startedDatingOn) {}

    public record PartnerDto(UUID id, String displayName) {}

    public record CoupleResponse(UUID id, LocalDate startedDatingOn, Instant createdAt, PartnerDto partner) {}
}
```

`backend/src/main/java/com/coupleapp/couple/CoupleService.java`:
```java
package com.coupleapp.couple;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleDtos.CoupleResponse;
import com.coupleapp.couple.CoupleDtos.InviteResponse;
import com.coupleapp.couple.CoupleDtos.PartnerDto;
import com.coupleapp.couple.InviteService.Invite;
import com.coupleapp.couple.InviteService.InvitePayload;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CoupleService {

    private final CoupleRepository couples;
    private final CoupleMemberRepository members;
    private final CoupleAccess access;
    private final InviteService invites;
    private final UserRepository users;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public InviteResponse createInvite(UUID userId) {
        if (access.findActive(userId).isPresent()) {
            throw alreadyPaired();
        }
        Invite invite = invites.create(userId);
        return new InviteResponse(invite.code(), invite.expiresAt());
    }

    @Transactional
    public CoupleResponse join(UUID joinerId, String rawCode, LocalDate startedDatingOn) {
        invites.checkJoinRateLimit(joinerId);
        String code = InviteService.normalize(rawCode);
        InvitePayload payload = invites.peek(code).orElseThrow(CoupleService::invalidInvite);
        if (payload.inviterId().equals(joinerId)) {
            throw new ApiException(ErrorCode.INVITE_SELF, "Không thể nhập mã của chính bạn");
        }
        if (access.findActive(joinerId).isPresent() || access.findActive(payload.inviterId()).isPresent()) {
            throw alreadyPaired();
        }
        invites.claim(code).orElseThrow(CoupleService::invalidInvite);
        try {
            Instant now = clock.instant();
            Couple couple = new Couple();
            couple.setStartedDatingOn(startedDatingOn);
            couple.setCreatedAt(now);
            couples.saveAndFlush(couple);
            members.saveAndFlush(new CoupleMember(couple.getId(), payload.inviterId(), now));
            members.saveAndFlush(new CoupleMember(couple.getId(), joinerId, now));
            events.publishEvent(new CouplePairedEvent(couple.getId(), payload.inviterId(), joinerId, startedDatingOn));
            return toResponse(couple, payload.inviterId());
        } catch (DataIntegrityViolationException e) {
            invites.restore(code, payload);
            throw alreadyPaired();
        } catch (RuntimeException e) {
            invites.restore(code, payload);
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public CoupleResponse me(UUID userId) {
        CoupleContext ctx = access.requireActive(userId);
        Couple couple = couples.findById(ctx.coupleId()).orElseThrow(ApiException::notFound);
        return toResponse(couple, ctx.partnerId());
    }

    @Transactional
    public void end(UUID userId) {
        CoupleContext ctx = access.requireActive(userId);
        Instant now = clock.instant();
        Couple couple = couples.findById(ctx.coupleId()).orElseThrow(ApiException::notFound);
        couple.setStatus(CoupleStatus.ENDED);
        couple.setEndedAt(now);
        members.findByCoupleIdAndLeftAtIsNull(ctx.coupleId()).forEach(m -> m.setLeftAt(now));
        events.publishEvent(new CoupleEndedEvent(ctx.coupleId()));
    }

    private CoupleResponse toResponse(Couple couple, UUID partnerId) {
        User partner = users.findById(partnerId).orElseThrow(ApiException::notFound);
        return new CoupleResponse(couple.getId(), couple.getStartedDatingOn(), couple.getCreatedAt(),
                new PartnerDto(partner.getId(), partner.getDisplayName()));
    }

    private static ApiException invalidInvite() {
        return new ApiException(ErrorCode.INVITE_INVALID, "Mã mời không đúng hoặc đã hết hạn");
    }

    private static ApiException alreadyPaired() {
        return new ApiException(ErrorCode.COUPLE_ALREADY_PAIRED, "Một trong hai người đã có cặp đôi");
    }
}
```

`backend/src/main/java/com/coupleapp/couple/CoupleController.java`:
```java
package com.coupleapp.couple;

import com.coupleapp.common.AuthUser;
import com.coupleapp.couple.CoupleDtos.CoupleResponse;
import com.coupleapp.couple.CoupleDtos.InviteResponse;
import com.coupleapp.couple.CoupleDtos.JoinRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/couples")
@RequiredArgsConstructor
public class CoupleController {

    private final CoupleService couples;

    @PostMapping("/invites")
    @ResponseStatus(HttpStatus.CREATED)
    public InviteResponse invite(@AuthenticationPrincipal Jwt jwt) {
        return couples.createInvite(AuthUser.id(jwt));
    }

    @PostMapping("/join")
    @ResponseStatus(HttpStatus.CREATED)
    public CoupleResponse join(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody JoinRequest r) {
        return couples.join(AuthUser.id(jwt), r.code(), r.startedDatingOn());
    }

    @GetMapping("/me")
    public CoupleResponse me(@AuthenticationPrincipal Jwt jwt) {
        return couples.me(AuthUser.id(jwt));
    }

    @PostMapping("/me/end")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void end(@AuthenticationPrincipal Jwt jwt) {
        couples.end(AuthUser.id(jwt));
    }
}
```

- [ ] **Step 8: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest=CoupleTest`
Expected: PASS (9 tests).

- [ ] **Step 9: Commit**

```bash
git add backend
git commit -m "feat(couple): redis invite codes, pairing, rate limit and ending a couple

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Vị trí & khoảng cách yêu xa

**Files:**
- Create: `backend/src/main/java/com/coupleapp/location/UserLocation.java`, `UserLocationRepository.java`, `Geo.java`, `LocationDtos.java`, `LocationService.java`, `LocationController.java`
- Test: `backend/src/test/java/com/coupleapp/location/GeoTest.java`, `LocationTest.java`

**Interfaces:**
- Consumes: `CoupleAccess.requireActive`, `UserSettingsRepository`, `UserSettingsChangedEvent`.
- Produces: `Geo.haversineKm(double lat1, double lng1, double lat2, double lng2) → double`; endpoints `PUT/DELETE /api/me/location`, `GET /api/couples/distance` → `{distanceKm: number|null, me: {updatedAt}|null, partner: {updatedAt}|null}`.

- [ ] **Step 1: Viết test (fail)**

`backend/src/test/java/com/coupleapp/location/GeoTest.java`:
```java
package com.coupleapp.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class GeoTest {

    @Test
    void hanoiToHoChiMinhCityIsAbout1137Km() {
        double km = Geo.haversineKm(21.0285, 105.8542, 10.8231, 106.6297);
        assertThat(km).isCloseTo(1137, within(15.0));
    }

    @Test
    void samePointIsZero() {
        assertThat(Geo.haversineKm(21.0, 105.0, 21.0, 105.0)).isZero();
    }
}
```

`backend/src/test/java/com/coupleapp/location/LocationTest.java`:
```java
package com.coupleapp.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import java.util.Map;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;

class LocationTest extends IntegrationTest {

    @Test
    void distanceBetweenPartners() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);

        get("/api/couples/distance", lan)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.distanceKm").doesNotExist())
                .andExpect(jsonPath("$.partner").doesNotExist());

        put("/api/me/location", lan, Map.of("lat", 21.0285, "lng", 105.8542, "accuracy", 20)).andExpect(status().isNoContent());
        put("/api/me/location", minh, Map.of("lat", 10.8231, "lng", 106.6297)).andExpect(status().isNoContent());

        get("/api/couples/distance", lan)
                .andExpect(jsonPath("$.distanceKm", Matchers.closeTo(1137.0, 15.0)))
                .andExpect(jsonPath("$.me.updatedAt").exists())
                .andExpect(jsonPath("$.partner.updatedAt").exists())
                .andExpect(jsonPath("$.partner.lat").doesNotExist());
    }

    @Test
    void disablingShareLocationDeletesLocationAndBlocksUpdates() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        put("/api/me/location", lan, Map.of("lat", 21.0, "lng", 105.8));
        put("/api/me/location", minh, Map.of("lat", 10.8, "lng", 106.6));

        put("/api/me/settings", minh, Map.of("shareLocation", false)).andExpect(status().isOk());

        assertThat(jdbc.queryForObject("select count(*) from user_locations", Integer.class)).isEqualTo(1);
        get("/api/couples/distance", lan)
                .andExpect(jsonPath("$.distanceKm").doesNotExist())
                .andExpect(jsonPath("$.partner").doesNotExist());
        put("/api/me/location", minh, Map.of("lat", 10.8, "lng", 106.6))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LOCATION_NOT_SHARED"));
    }

    @Test
    void invalidCoordinatesAreRejected() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        put("/api/me/location", lan, Map.of("lat", 91, "lng", 0)).andExpect(status().isBadRequest());
    }

    @Test
    void distanceRequiresCouple() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        get("/api/couples/distance", lan).andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));
    }

    @Test
    void deleteLocation() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        put("/api/me/location", lan, Map.of("lat", 21.0, "lng", 105.8));
        delete("/api/me/location", lan).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select count(*) from user_locations", Integer.class)).isZero();
    }
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest='GeoTest,LocationTest'`
Expected: FAIL.

- [ ] **Step 3: Cài đặt**

`backend/src/main/java/com/coupleapp/location/Geo.java`:
```java
package com.coupleapp.location;

public final class Geo {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private Geo() {}

    public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
```

`backend/src/main/java/com/coupleapp/location/UserLocation.java`:
```java
package com.coupleapp.location;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_locations")
@Getter
@Setter
@NoArgsConstructor
public class UserLocation {

    @Id
    private UUID userId;

    private double lat;
    private double lng;
    private Float accuracyM;
    private Instant updatedAt;

    public UserLocation(UUID userId) {
        this.userId = userId;
    }
}
```

`backend/src/main/java/com/coupleapp/location/UserLocationRepository.java`:
```java
package com.coupleapp.location;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserLocationRepository extends JpaRepository<UserLocation, UUID> {}
```

`backend/src/main/java/com/coupleapp/location/LocationDtos.java`:
```java
package com.coupleapp.location;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;

public final class LocationDtos {

    private LocationDtos() {}

    public record LocationRequest(
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
            @PositiveOrZero Float accuracy) {}

    public record Stamp(Instant updatedAt) {}

    public record DistanceResponse(Double distanceKm, Stamp me, Stamp partner) {}
}
```

`backend/src/main/java/com/coupleapp/location/LocationService.java`:
```java
package com.coupleapp.location;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.location.LocationDtos.DistanceResponse;
import com.coupleapp.location.LocationDtos.LocationRequest;
import com.coupleapp.location.LocationDtos.Stamp;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsChangedEvent;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final UserLocationRepository locations;
    private final UserSettingsRepository settings;
    private final CoupleAccess couples;
    private final Clock clock;

    @Transactional
    public void update(UUID userId, LocationRequest r) {
        if (!sharing(userId)) {
            throw new ApiException(ErrorCode.LOCATION_NOT_SHARED, "Bạn đang tắt chia sẻ vị trí");
        }
        UserLocation l = locations.findById(userId).orElseGet(() -> new UserLocation(userId));
        l.setLat(r.lat());
        l.setLng(r.lng());
        l.setAccuracyM(r.accuracy());
        l.setUpdatedAt(clock.instant());
        locations.save(l);
    }

    @Transactional
    public void clear(UUID userId) {
        locations.deleteById(userId);
    }

    @Transactional(readOnly = true)
    public DistanceResponse distance(UUID userId) {
        CoupleContext c = couples.requireActive(userId);
        Optional<UserLocation> mine = locations.findById(userId);
        Optional<UserLocation> theirs = sharing(c.partnerId()) ? locations.findById(c.partnerId()) : Optional.empty();
        Double km = null;
        if (mine.isPresent() && theirs.isPresent()) {
            double raw = Geo.haversineKm(mine.get().getLat(), mine.get().getLng(), theirs.get().getLat(), theirs.get().getLng());
            km = Math.round(raw * 10) / 10.0;
        }
        return new DistanceResponse(
                km,
                mine.map(l -> new Stamp(l.getUpdatedAt())).orElse(null),
                theirs.map(l -> new Stamp(l.getUpdatedAt())).orElse(null));
    }

    @EventListener
    public void onSettingsChanged(UserSettingsChangedEvent e) {
        if (e.shareLocationChanged() && !e.shareLocation()) {
            locations.deleteById(e.userId());
        }
    }

    private boolean sharing(UUID userId) {
        return settings.findById(userId).map(UserSettings::isShareLocation).orElse(true);
    }
}
```

`backend/src/main/java/com/coupleapp/location/LocationController.java`:
```java
package com.coupleapp.location;

import com.coupleapp.common.AuthUser;
import com.coupleapp.location.LocationDtos.DistanceResponse;
import com.coupleapp.location.LocationDtos.LocationRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locations;

    @PutMapping("/api/me/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody LocationRequest r) {
        locations.update(AuthUser.id(jwt), r);
    }

    @DeleteMapping("/api/me/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@AuthenticationPrincipal Jwt jwt) {
        locations.clear(AuthUser.id(jwt));
    }

    @GetMapping("/api/couples/distance")
    public DistanceResponse distance(@AuthenticationPrincipal Jwt jwt) {
        return locations.distance(AuthUser.id(jwt));
    }
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest='GeoTest,LocationTest'`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat(location): share latest location and partner distance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Ảnh (MinIO presigned URL) + avatar + dọn ảnh treo

**Files:**
- Create: `backend/src/main/java/com/coupleapp/storage/StorageProperties.java`, `StorageConfig.java`
- Create: `backend/src/main/java/com/coupleapp/media/Media.java`, `MediaStatus.java`, `MediaRepository.java`, `MediaDtos.java`, `MediaService.java`, `MediaController.java`, `MediaCleanupJob.java`
- Create: `backend/src/main/java/com/coupleapp/common/SchedulingConfig.java`
- Modify: `backend/src/main/java/com/coupleapp/user/UserDtos.java`, `MeService.java` (avatar)
- Modify: `backend/src/test/java/com/coupleapp/support/IntegrationTest.java` (helper `uploadImage`, `TINY_JPEG`)
- Test: `backend/src/test/java/com/coupleapp/media/MediaTest.java`

**Interfaces:**
- Consumes: `CoupleAccess.requireActive`, `Clock`.
- Produces:
  - `MediaService.createUpload(UUID userId, UploadUrlRequest) → UploadUrlResponse(UUID mediaId, String uploadUrl, String method, Map<String,String> headers, Instant expiresAt)`
  - `MediaService.confirm(UUID userId, UUID mediaId) → MediaDto(UUID id, String url, Integer width, Integer height, String filter, Instant takenAt)`
  - `MediaService.dtos(List<UUID> ids) → List<MediaDto>` (giữ thứ tự), `MediaService.requireUsable(List<UUID> ids, UUID coupleId)` (ném `VALIDATION_FAILED`), `MediaService.requireAvatar(UUID userId, UUID mediaId)`, `MediaService.avatarUrl(UUID mediaId) → Optional<String>`, `MediaService.cleanupPending() → int`.
  - Test helper `UUID uploadImage(String token)` — upload thật lên MinIO + confirm, trả `mediaId`.

- [ ] **Step 1: Thêm helper upload vào `IntegrationTest`**

Thêm import `java.net.URI`, `java.net.http.HttpClient`, `java.net.http.HttpRequest`, `java.net.http.HttpResponse`, `static org.assertj.core.api.Assertions.assertThat`, `com.fasterxml.jackson.databind.JsonNode` (đã có) và:
```java
    protected static final byte[] TINY_JPEG = {
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00, (byte) 0xFF, (byte) 0xD9};

    protected int putToPresignedUrl(String url, String contentType, byte[] bytes) throws Exception {
        HttpResponse<Void> res = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(url))
                        .header("Content-Type", contentType)
                        .PUT(HttpRequest.BodyPublishers.ofByteArray(bytes))
                        .build(),
                HttpResponse.BodyHandlers.discarding());
        return res.statusCode();
    }

    protected UUID uploadImage(String token) throws Exception {
        JsonNode up = read(post("/api/media/upload-url", token,
                Map.of("contentType", "image/jpeg", "sizeBytes", TINY_JPEG.length))
                .andExpect(status().isCreated()));
        assertThat(putToPresignedUrl(up.get("uploadUrl").asText(), "image/jpeg", TINY_JPEG)).isEqualTo(200);
        UUID id = UUID.fromString(up.get("mediaId").asText());
        post("/api/media/" + id + "/confirm", token, null).andExpect(status().isOk());
        return id;
    }
```

- [ ] **Step 2: Viết test (fail)**

`backend/src/test/java/com/coupleapp/media/MediaTest.java`:
```java
package com.coupleapp.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class MediaTest extends IntegrationTest {

    @Autowired MediaService mediaService;

    @Test
    void uploadConfirmAndDownload() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);

        JsonNode up = read(post("/api/media/upload-url", lan, Map.of(
                "contentType", "image/jpeg", "sizeBytes", TINY_JPEG.length,
                "width", 1, "height", 1, "filter", "VINTAGE"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.method").value("PUT"))
                .andExpect(jsonPath("$.headers['Content-Type']").value("image/jpeg")));
        assertThat(putToPresignedUrl(up.get("uploadUrl").asText(), "image/jpeg", TINY_JPEG)).isEqualTo(200);

        String id = up.get("mediaId").asText();
        JsonNode media = read(post("/api/media/" + id + "/confirm", lan, null).andExpect(status().isOk()));
        assertThat(media.get("filter").asText()).isEqualTo("VINTAGE");

        HttpResponse<byte[]> download = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(media.get("url").asText())).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());
        assertThat(download.statusCode()).isEqualTo(200);
        assertThat(download.body()).isEqualTo(TINY_JPEG);
        assertThat(jdbc.queryForObject("select status from media where id = ?::uuid", String.class, id)).isEqualTo("READY");
        assertThat(jdbc.queryForObject("select size_bytes from media where id = ?::uuid", Long.class, id))
                .isEqualTo(TINY_JPEG.length);
    }

    @Test
    void confirmWithoutUploadFails() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        String id = read(post("/api/media/upload-url", lan, Map.of("contentType", "image/png", "sizeBytes", 10)))
                .get("mediaId").asText();

        post("/api/media/" + id + "/confirm", lan, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MEDIA_NOT_UPLOADED"));
    }

    @Test
    void onlyUploaderCanConfirmOrDelete() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        String id = read(post("/api/media/upload-url", lan, Map.of("contentType", "image/png", "sizeBytes", 10)))
                .get("mediaId").asText();

        post("/api/media/" + id + "/confirm", minh, null).andExpect(status().isNotFound());
        delete("/api/media/" + id, minh).andExpect(status().isNotFound());
    }

    @Test
    void sharedUploadRequiresCouple() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        post("/api/media/upload-url", lan, Map.of("contentType", "image/jpeg", "sizeBytes", 10))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));
    }

    @Test
    void rejectsUnsupportedTypeAndOversizedFiles() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        post("/api/media/upload-url", lan, Map.of("contentType", "application/pdf", "sizeBytes", 10))
                .andExpect(status().isBadRequest());
        post("/api/media/upload-url", lan, Map.of("contentType", "image/jpeg", "sizeBytes", 16L * 1024 * 1024))
                .andExpect(status().isBadRequest());
    }

    @Test
    void avatarCanBeUploadedBeforePairing() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        JsonNode up = read(post("/api/media/upload-url", lan,
                Map.of("contentType", "image/jpeg", "sizeBytes", TINY_JPEG.length, "purpose", "AVATAR"))
                .andExpect(status().isCreated()));
        putToPresignedUrl(up.get("uploadUrl").asText(), "image/jpeg", TINY_JPEG);
        String id = up.get("mediaId").asText();
        post("/api/media/" + id + "/confirm", lan, null).andExpect(status().isOk());

        patch("/api/me", lan, Map.of("avatarMediaId", id)).andExpect(status().isOk());
        get("/api/me", lan).andExpect(jsonPath("$.avatarUrl").isNotEmpty());
    }

    @Test
    void sharedMediaCannotBeUsedAsAvatar() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        UUID shared = uploadImage(lan);
        patch("/api/me", lan, Map.of("avatarMediaId", shared.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void deleteRemovesRowAndObject() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        UUID id = uploadImage(lan);
        String url = mediaService.dtos(java.util.List.of(id)).get(0).url();

        delete("/api/media/" + id, lan).andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject("select count(*) from media", Integer.class)).isZero();
        HttpResponse<Void> res = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(url)).GET().build(), HttpResponse.BodyHandlers.discarding());
        assertThat(res.statusCode()).isEqualTo(404);
    }

    @Test
    void cleanupRemovesStalePendingUploads() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        post("/api/media/upload-url", lan, Map.of("contentType", "image/jpeg", "sizeBytes", 10));
        uploadImage(lan); // READY — không bị xoá
        jdbc.update("update media set created_at = now() - interval '25 hours' where status = 'PENDING'");

        assertThat(mediaService.cleanupPending()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from media", Integer.class)).isEqualTo(1);
    }
}
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest=MediaTest`
Expected: FAIL.

- [ ] **Step 4: Cấu hình storage**

`backend/src/main/java/com/coupleapp/storage/StorageProperties.java`:
```java
package com.coupleapp.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.storage")
public record StorageProperties(
        String endpoint, String publicEndpoint, String region, String accessKey, String secretKey, String bucket) {}
```

`backend/src/main/java/com/coupleapp/storage/StorageConfig.java`:
```java
package com.coupleapp.storage;

import java.net.URI;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class StorageConfig {

    @Bean
    S3Client s3Client(StorageProperties p) {
        return S3Client.builder()
                .endpointOverride(URI.create(p.endpoint()))
                .region(Region.of(p.region()))
                .credentialsProvider(credentials(p))
                .forcePathStyle(true)
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }

    /** Ký URL bằng endpoint công khai để điện thoại truy cập được. */
    @Bean
    S3Presigner s3Presigner(StorageProperties p) {
        return S3Presigner.builder()
                .endpointOverride(URI.create(p.publicEndpoint()))
                .region(Region.of(p.region()))
                .credentialsProvider(credentials(p))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
    }

    @Bean
    ApplicationRunner ensureBucket(S3Client s3, StorageProperties p) {
        return args -> {
            try {
                s3.headBucket(b -> b.bucket(p.bucket()));
            } catch (S3Exception e) {
                if (e.statusCode() != 404) {
                    throw e;
                }
                s3.createBucket(b -> b.bucket(p.bucket()));
            }
        };
    }

    private static StaticCredentialsProvider credentials(StorageProperties p) {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(p.accessKey(), p.secretKey()));
    }
}
```

`backend/src/main/java/com/coupleapp/common/SchedulingConfig.java`:
```java
package com.coupleapp.common;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {}
```

- [ ] **Step 5: Module media**

`backend/src/main/java/com/coupleapp/media/MediaStatus.java`:
```java
package com.coupleapp.media;

public enum MediaStatus { PENDING, READY }
```

`backend/src/main/java/com/coupleapp/media/Media.java`:
```java
package com.coupleapp.media;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "media")
@Getter
@Setter
@NoArgsConstructor
public class Media {

    /** Sinh ở service trước khi lưu vì object key cần id. */
    @Id
    private UUID id;

    private UUID coupleId;
    private UUID uploaderId;
    private String objectKey;
    private String contentType;
    private Long sizeBytes;
    private Integer width;
    private Integer height;
    private String filter;
    private Instant takenAt;
    private Double lat;
    private Double lng;

    @Enumerated(EnumType.STRING)
    private MediaStatus status;

    private Instant createdAt;
}
```

`backend/src/main/java/com/coupleapp/media/MediaRepository.java`:
```java
package com.coupleapp.media;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<Media, UUID> {

    List<Media> findByStatusAndCreatedAtBefore(MediaStatus status, Instant cutoff);
}
```

`backend/src/main/java/com/coupleapp/media/MediaDtos.java`:
```java
package com.coupleapp.media;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class MediaDtos {

    private MediaDtos() {}

    public enum Purpose { SHARED, AVATAR }

    public record UploadUrlRequest(
            @NotBlank String contentType,
            @NotNull @Positive Long sizeBytes,
            @Positive Integer width,
            @Positive Integer height,
            @Size(max = 30) String filter,
            Instant takenAt,
            @DecimalMin("-90") @DecimalMax("90") Double lat,
            @DecimalMin("-180") @DecimalMax("180") Double lng,
            Purpose purpose) {}

    public record UploadUrlResponse(
            UUID mediaId, String uploadUrl, String method, Map<String, String> headers, Instant expiresAt) {}

    public record MediaDto(UUID id, String url, Integer width, Integer height, String filter, Instant takenAt) {}
}
```

`backend/src/main/java/com/coupleapp/media/MediaService.java`:
```java
package com.coupleapp.media;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.media.MediaDtos.MediaDto;
import com.coupleapp.media.MediaDtos.Purpose;
import com.coupleapp.media.MediaDtos.UploadUrlRequest;
import com.coupleapp.media.MediaDtos.UploadUrlResponse;
import com.coupleapp.storage.StorageProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaService {

    static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/webp", "webp", "image/heic", "heic");
    static final long MAX_BYTES = 15L * 1024 * 1024;
    static final Duration PUT_TTL = Duration.ofMinutes(10);
    static final Duration GET_TTL = Duration.ofHours(1);

    private final MediaRepository media;
    private final CoupleAccess couples;
    private final S3Client s3;
    private final S3Presigner presigner;
    private final StorageProperties props;
    private final Clock clock;

    @Transactional
    public UploadUrlResponse createUpload(UUID userId, UploadUrlRequest r) {
        String ext = EXTENSIONS.get(r.contentType());
        if (ext == null) {
            throw invalid("Chỉ hỗ trợ ảnh JPEG, PNG, WEBP, HEIC");
        }
        if (r.sizeBytes() > MAX_BYTES) {
            throw invalid("Ảnh tối đa 15MB");
        }
        Instant now = clock.instant();
        Media m = new Media();
        m.setId(UUID.randomUUID());
        m.setUploaderId(userId);
        m.setContentType(r.contentType());
        m.setWidth(r.width());
        m.setHeight(r.height());
        m.setFilter(r.filter());
        m.setTakenAt(r.takenAt());
        m.setLat(r.lat());
        m.setLng(r.lng());
        m.setStatus(MediaStatus.PENDING);
        m.setCreatedAt(now);
        if (r.purpose() == Purpose.AVATAR) {
            m.setObjectKey("users/%s/avatar/%s.%s".formatted(userId, m.getId(), ext));
        } else {
            UUID coupleId = couples.requireActive(userId).coupleId();
            ZonedDateTime t = now.atZone(ZoneOffset.UTC);
            m.setCoupleId(coupleId);
            m.setObjectKey("couples/%s/%d/%02d/%s.%s".formatted(coupleId, t.getYear(), t.getMonthValue(), m.getId(), ext));
        }
        media.save(m);

        String url = presigner.presignPutObject(b -> b
                        .signatureDuration(PUT_TTL)
                        .putObjectRequest(o -> o.bucket(props.bucket()).key(m.getObjectKey()).contentType(r.contentType())))
                .url().toString();
        return new UploadUrlResponse(m.getId(), url, "PUT", Map.of("Content-Type", r.contentType()), now.plus(PUT_TTL));
    }

    @Transactional
    public MediaDto confirm(UUID userId, UUID mediaId) {
        Media m = ownMedia(userId, mediaId);
        if (m.getStatus() == MediaStatus.READY) {
            return toDto(m);
        }
        HeadObjectResponse head;
        try {
            head = s3.headObject(b -> b.bucket(props.bucket()).key(m.getObjectKey()));
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                throw new ApiException(ErrorCode.MEDIA_NOT_UPLOADED, "Ảnh chưa được tải lên");
            }
            throw e;
        }
        if (head.contentLength() > MAX_BYTES) {
            deleteObject(m);
            media.delete(m);
            throw invalid("Ảnh tối đa 15MB");
        }
        m.setSizeBytes(head.contentLength());
        m.setStatus(MediaStatus.READY);
        return toDto(m);
    }

    @Transactional
    public void delete(UUID userId, UUID mediaId) {
        Media m = ownMedia(userId, mediaId);
        deleteObject(m);
        media.delete(m);
    }

    @Transactional(readOnly = true)
    public List<MediaDto> dtos(List<UUID> ids) {
        Map<UUID, Media> byId = media.findAllById(ids).stream()
                .collect(Collectors.toMap(Media::getId, Function.identity()));
        return ids.stream().map(byId::get).filter(Objects::nonNull).map(this::toDto).toList();
    }

    /** Ảnh gắn vào nội dung chung phải READY, thuộc đúng cặp đôi và không trùng lặp. */
    @Transactional(readOnly = true)
    public void requireUsable(List<UUID> ids, UUID coupleId) {
        if (ids.isEmpty()) {
            return;
        }
        if (new HashSet<>(ids).size() != ids.size()) {
            throw invalid("Danh sách ảnh bị trùng");
        }
        List<Media> found = media.findAllById(ids);
        boolean ok = found.size() == ids.size() && found.stream()
                .allMatch(m -> m.getStatus() == MediaStatus.READY && coupleId.equals(m.getCoupleId()));
        if (!ok) {
            throw invalid("Ảnh không hợp lệ");
        }
    }

    @Transactional(readOnly = true)
    public void requireAvatar(UUID userId, UUID mediaId) {
        boolean ok = media.findById(mediaId)
                .filter(m -> m.getUploaderId().equals(userId)
                        && m.getCoupleId() == null
                        && m.getStatus() == MediaStatus.READY)
                .isPresent();
        if (!ok) {
            throw invalid("Ảnh đại diện không hợp lệ");
        }
    }

    @Transactional(readOnly = true)
    public Optional<String> avatarUrl(UUID mediaId) {
        return media.findById(mediaId).map(this::url);
    }

    @Transactional
    public int cleanupPending() {
        List<Media> stale = media.findByStatusAndCreatedAtBefore(
                MediaStatus.PENDING, clock.instant().minus(Duration.ofHours(24)));
        for (Media m : stale) {
            try {
                deleteObject(m);
            } catch (S3Exception e) {
                log.warn("Không xoá được object {}", m.getObjectKey(), e);
            }
        }
        media.deleteAll(stale);
        return stale.size();
    }

    public MediaDto toDto(Media m) {
        return new MediaDto(m.getId(), url(m), m.getWidth(), m.getHeight(), m.getFilter(), m.getTakenAt());
    }

    private String url(Media m) {
        return presigner.presignGetObject(b -> b
                        .signatureDuration(GET_TTL)
                        .getObjectRequest(o -> o.bucket(props.bucket()).key(m.getObjectKey())))
                .url().toString();
    }

    private Media ownMedia(UUID userId, UUID mediaId) {
        return media.findById(mediaId).filter(m -> m.getUploaderId().equals(userId)).orElseThrow(ApiException::notFound);
    }

    private void deleteObject(Media m) {
        s3.deleteObject(b -> b.bucket(props.bucket()).key(m.getObjectKey()));
    }

    private static ApiException invalid(String detail) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, detail);
    }
}
```

`backend/src/main/java/com/coupleapp/media/MediaController.java`:
```java
package com.coupleapp.media;

import com.coupleapp.common.AuthUser;
import com.coupleapp.media.MediaDtos.MediaDto;
import com.coupleapp.media.MediaDtos.UploadUrlRequest;
import com.coupleapp.media.MediaDtos.UploadUrlResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService media;

    @PostMapping("/upload-url")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadUrlResponse uploadUrl(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UploadUrlRequest r) {
        return media.createUpload(AuthUser.id(jwt), r);
    }

    @PostMapping("/{id}/confirm")
    public MediaDto confirm(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return media.confirm(AuthUser.id(jwt), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        media.delete(AuthUser.id(jwt), id);
    }
}
```

`backend/src/main/java/com/coupleapp/media/MediaCleanupJob.java`:
```java
package com.coupleapp.media;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
class MediaCleanupJob {

    private final MediaService media;

    @Scheduled(cron = "0 30 3 * * *", zone = "Asia/Ho_Chi_Minh")
    void run() {
        int removed = media.cleanupPending();
        if (removed > 0) {
            log.info("Đã xoá {} ảnh upload dở", removed);
        }
    }
}
```

- [ ] **Step 6: Avatar trong hồ sơ**

Trong `UserDtos.java`, thay record `UpdateMeRequest` bằng:
```java
    public record UpdateMeRequest(
            @Size(min = 1, max = 50) String displayName,
            @Past LocalDate birthday,
            @Size(max = 64) String timezone,
            UUID avatarMediaId) {}
```

Trong `MeService.java`:
1. Thêm import `com.coupleapp.media.MediaService` và field `private final MediaService media;` (sau `settings`).
2. Trong `update(...)`, ngay trước dòng `u.setUpdatedAt(clock.instant());` thêm:
```java
        if (r.avatarMediaId() != null) {
            media.requireAvatar(userId, r.avatarMediaId());
            u.setAvatarMediaId(r.avatarMediaId());
        }
```
3. Thay method `toResponse(User u)` bằng:
```java
    MeResponse toResponse(User u) {
        String avatarUrl = u.getAvatarMediaId() == null ? null : media.avatarUrl(u.getAvatarMediaId()).orElse(null);
        return new MeResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getBirthday(), u.getTimezone(), avatarUrl);
    }
```

- [ ] **Step 7: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest='MediaTest,MeTest'`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "feat(media): presigned uploads to minio, avatar and stale upload cleanup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Đặc điểm đối phương (size, sở thích, link mua hàng)

**Files:**
- Create: `backend/src/main/java/com/coupleapp/trait/Visibility.java`, `SizeEntry.java`, `Preference.java`, `PreferenceLink.java`, `SizeEntryRepository.java`, `PreferenceRepository.java`, `TraitDtos.java`, `TraitService.java`, `TraitController.java`
- Test: `backend/src/test/java/com/coupleapp/trait/TraitTest.java`

**Interfaces:**
- Consumes: `CoupleAccess.findActive`, `Clock`.
- Produces: endpoints `GET /api/traits/catalog`, `GET /api/traits/{userId}`, `POST /api/traits/sizes`, `PATCH|DELETE /api/traits/sizes/{id}`, `POST /api/traits/preferences`, `PATCH|DELETE /api/traits/preferences/{id}`. Quy tắc: xem được nếu `subject` là mình hoặc người yêu hiện tại; `AUTHOR_ONLY` chỉ người tạo thấy/sửa; mục `SHARED` sửa được bởi người tạo hoặc chủ thể; chỉ người tạo đổi `visibility`.

- [ ] **Step 1: Viết test (fail)**

`backend/src/test/java/com/coupleapp/trait/TraitTest.java`:
```java
package com.coupleapp.trait;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TraitTest extends IntegrationTest {

    String lan;
    String minh;
    UUID minhId;
    UUID lanId;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        lanId = userId(lan);
        minhId = userId(minh);
    }

    @Test
    void sharedSizeIsVisibleToBoth() throws Exception {
        post("/api/traits/sizes", lan, Map.of("subjectUserId", minhId, "kind", "SHIRT", "value", "L", "note", "form rộng"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visibility").value("SHARED"));

        get("/api/traits/" + minhId, minh)
                .andExpect(jsonPath("$.sizes[0].kind").value("SHIRT"))
                .andExpect(jsonPath("$.sizes[0].value").value("L"));
        get("/api/traits/" + minhId, lan).andExpect(jsonPath("$.sizes.length()").value(1));
    }

    @Test
    void authorOnlyPreferenceIsHiddenFromSubject() throws Exception {
        String id = read(post("/api/traits/preferences", minh, Map.of(
                "subjectUserId", lanId, "category", "BAG", "brand", "Charles & Keith", "visibility", "AUTHOR_ONLY",
                "note", "Định tặng sinh nhật",
                "links", List.of(Map.of("url", "https://shopee.vn/abc", "label", "Shopee", "price", 1290000))))
                .andExpect(status().isCreated())).get("id").asText();

        get("/api/traits/" + lanId, lan).andExpect(jsonPath("$.preferences.length()").value(0));
        get("/api/traits/" + lanId, minh)
                .andExpect(jsonPath("$.preferences[0].links[0].price").value(1290000));
        patch("/api/traits/preferences/" + id, lan, Map.of("note", "lộ rồi")).andExpect(status().isNotFound());
        delete("/api/traits/preferences/" + id, lan).andExpect(status().isNotFound());
    }

    @Test
    void subjectCanEditSharedEntryButNotChangeVisibility() throws Exception {
        String id = read(post("/api/traits/sizes", lan, Map.of("subjectUserId", minhId, "kind", "SHOE", "value", "42")))
                .get("id").asText();

        patch("/api/traits/sizes/" + id, minh, Map.of("value", "43"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("43"));
        patch("/api/traits/sizes/" + id, minh, Map.of("visibility", "AUTHOR_ONLY"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void strangersCannotReadOrWrite() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        get("/api/traits/" + lanId, hoa).andExpect(status().isNotFound());
        post("/api/traits/sizes", hoa, Map.of("subjectUserId", lanId, "kind", "RING", "value", "8"))
                .andExpect(status().isNotFound());
    }

    @Test
    void patchReplacesLinks() throws Exception {
        String id = read(post("/api/traits/preferences", lan, Map.of(
                "subjectUserId", minhId, "category", "KEYBOARD", "name", "Keychron K2",
                "links", List.of(Map.of("url", "https://a.vn/1"), Map.of("url", "https://b.vn/2"))))).get("id").asText();

        patch("/api/traits/preferences/" + id, lan, Map.of("links", List.of(Map.of("url", "https://c.vn/3"))))
                .andExpect(jsonPath("$.links.length()").value(1))
                .andExpect(jsonPath("$.links[0].url").value("https://c.vn/3"))
                .andExpect(jsonPath("$.name").value("Keychron K2"));
    }

    @Test
    void validatesKindAndLinkUrl() throws Exception {
        post("/api/traits/sizes", lan, Map.of("subjectUserId", minhId, "kind", "shirt", "value", "L"))
                .andExpect(status().isBadRequest());
        post("/api/traits/preferences", lan, Map.of("subjectUserId", minhId, "category", "BAG",
                "links", List.of(Map.of("url", "javascript:alert(1)"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void canNoteAboutSelfWithoutCouple() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        UUID hoaId = userId(hoa);
        post("/api/traits/sizes", hoa, Map.of("subjectUserId", hoaId, "kind", "RING", "value", "7"))
                .andExpect(status().isCreated());
    }

    @Test
    void catalogListsSuggestedKinds() throws Exception {
        get("/api/traits/catalog", lan)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sizeKinds[0].code").value("SHIRT"))
                .andExpect(jsonPath("$.preferenceCategories[0].code").value("BAG"));
    }
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest=TraitTest`
Expected: FAIL.

- [ ] **Step 3: Entity + repository**

`backend/src/main/java/com/coupleapp/trait/Visibility.java`:
```java
package com.coupleapp.trait;

public enum Visibility { SHARED, AUTHOR_ONLY }
```

`backend/src/main/java/com/coupleapp/trait/SizeEntry.java`:
```java
package com.coupleapp.trait;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "size_entries")
@Getter
@Setter
@NoArgsConstructor
public class SizeEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID subjectUserId;
    private String kind;
    private String value;
    private String note;

    @Enumerated(EnumType.STRING)
    private Visibility visibility = Visibility.SHARED;

    private UUID createdBy;
    private Instant createdAt;
    private Instant updatedAt;
}
```

`backend/src/main/java/com/coupleapp/trait/PreferenceLink.java`:
```java
package com.coupleapp.trait;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "preference_links")
@Getter
@Setter
@NoArgsConstructor
public class PreferenceLink {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String url;
    private String label;
    private Long price;
    private Instant createdAt = Instant.now();
}
```

`backend/src/main/java/com/coupleapp/trait/Preference.java`:
```java
package com.coupleapp.trait;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "preferences")
@Getter
@Setter
@NoArgsConstructor
public class Preference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID subjectUserId;
    private String category;
    private String brand;
    private String name;
    private String color;
    private String note;

    @Enumerated(EnumType.STRING)
    private Visibility visibility = Visibility.SHARED;

    private UUID createdBy;
    private Instant createdAt;
    private Instant updatedAt;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "preference_id", nullable = false)
    @OrderBy("createdAt")
    private List<PreferenceLink> links = new ArrayList<>();
}
```

`backend/src/main/java/com/coupleapp/trait/SizeEntryRepository.java`:
```java
package com.coupleapp.trait;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SizeEntryRepository extends JpaRepository<SizeEntry, UUID> {

    List<SizeEntry> findBySubjectUserIdOrderByCreatedAtAsc(UUID subjectUserId);
}
```

`backend/src/main/java/com/coupleapp/trait/PreferenceRepository.java`:
```java
package com.coupleapp.trait;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PreferenceRepository extends JpaRepository<Preference, UUID> {

    List<Preference> findBySubjectUserIdOrderByCreatedAtAsc(UUID subjectUserId);
}
```

- [ ] **Step 4: DTO, service, controller**

`backend/src/main/java/com/coupleapp/trait/TraitDtos.java`:
```java
package com.coupleapp.trait;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class TraitDtos {

    private TraitDtos() {}

    static final String CODE = "^[A-Z][A-Z0-9_]{1,39}$";
    static final String URL = "^https?://\\S{3,2000}$";

    public record SizeRequest(
            @NotNull UUID subjectUserId,
            @NotBlank @Pattern(regexp = CODE) String kind,
            @NotBlank @Size(max = 50) String value,
            @Size(max = 500) String note,
            Visibility visibility) {}

    public record SizePatch(
            @Pattern(regexp = CODE) String kind,
            @Size(min = 1, max = 50) String value,
            @Size(max = 500) String note,
            Visibility visibility) {}

    public record LinkInput(
            @NotBlank @Pattern(regexp = URL) String url,
            @Size(max = 50) String label,
            @PositiveOrZero Long price) {}

    public record PreferenceRequest(
            @NotNull UUID subjectUserId,
            @NotBlank @Pattern(regexp = CODE) String category,
            @Size(max = 100) String brand,
            @Size(max = 200) String name,
            @Size(max = 50) String color,
            @Size(max = 1000) String note,
            Visibility visibility,
            @Valid @Size(max = 10) List<LinkInput> links) {}

    public record PreferencePatch(
            @Pattern(regexp = CODE) String category,
            @Size(max = 100) String brand,
            @Size(max = 200) String name,
            @Size(max = 50) String color,
            @Size(max = 1000) String note,
            Visibility visibility,
            @Valid @Size(max = 10) List<LinkInput> links) {}

    public record SizeDto(UUID id, UUID subjectUserId, String kind, String value, String note,
                          Visibility visibility, UUID createdBy, Instant updatedAt) {}

    public record LinkDto(UUID id, String url, String label, Long price) {}

    public record PreferenceDto(UUID id, UUID subjectUserId, String category, String brand, String name,
                                String color, String note, Visibility visibility, UUID createdBy,
                                Instant updatedAt, List<LinkDto> links) {}

    public record TraitsResponse(List<SizeDto> sizes, List<PreferenceDto> preferences) {}

    public record CatalogItem(String code, String label) {}

    public record CatalogResponse(List<CatalogItem> sizeKinds, List<CatalogItem> preferenceCategories) {}
}
```

`backend/src/main/java/com/coupleapp/trait/TraitService.java`:
```java
package com.coupleapp.trait;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.trait.TraitDtos.CatalogItem;
import com.coupleapp.trait.TraitDtos.CatalogResponse;
import com.coupleapp.trait.TraitDtos.LinkDto;
import com.coupleapp.trait.TraitDtos.LinkInput;
import com.coupleapp.trait.TraitDtos.PreferenceDto;
import com.coupleapp.trait.TraitDtos.PreferencePatch;
import com.coupleapp.trait.TraitDtos.PreferenceRequest;
import com.coupleapp.trait.TraitDtos.SizeDto;
import com.coupleapp.trait.TraitDtos.SizePatch;
import com.coupleapp.trait.TraitDtos.SizeRequest;
import com.coupleapp.trait.TraitDtos.TraitsResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TraitService {

    static final CatalogResponse CATALOG = new CatalogResponse(
            List.of(new CatalogItem("SHIRT", "Áo"), new CatalogItem("PANTS", "Quần"),
                    new CatalogItem("SHOE", "Giày"), new CatalogItem("RING", "Nhẫn (ngón tay)"),
                    new CatalogItem("BRACELET", "Vòng tay"), new CatalogItem("NECKLACE", "Vòng cổ"),
                    new CatalogItem("BRA", "Áo ngực"), new CatalogItem("WAIST", "Vòng eo"),
                    new CatalogItem("HAT", "Mũ")),
            List.of(new CatalogItem("BAG", "Túi"), new CatalogItem("LIPSTICK", "Son"),
                    new CatalogItem("PERFUME", "Nước hoa"), new CatalogItem("SKINCARE", "Skincare"),
                    new CatalogItem("KEYBOARD", "Bàn phím"), new CatalogItem("WATCH", "Đồng hồ"),
                    new CatalogItem("SHOES", "Giày dép"), new CatalogItem("CLOTHES", "Quần áo"),
                    new CatalogItem("FOOD", "Đồ ăn"), new CatalogItem("DRINK", "Đồ uống"),
                    new CatalogItem("COLOR", "Màu sắc"), new CatalogItem("FLOWER", "Hoa"),
                    new CatalogItem("HOBBY", "Sở thích"), new CatalogItem("OTHER", "Khác")));

    private final SizeEntryRepository sizes;
    private final PreferenceRepository preferences;
    private final CoupleAccess couples;
    private final Clock clock;

    public CatalogResponse catalog() {
        return CATALOG;
    }

    @Transactional(readOnly = true)
    public TraitsResponse list(UUID me, UUID subject) {
        requireAccess(me, subject);
        List<SizeDto> s = sizes.findBySubjectUserIdOrderByCreatedAtAsc(subject).stream()
                .filter(e -> visible(me, e.getVisibility(), e.getCreatedBy()))
                .map(TraitService::toDto).toList();
        List<PreferenceDto> p = preferences.findBySubjectUserIdOrderByCreatedAtAsc(subject).stream()
                .filter(e -> visible(me, e.getVisibility(), e.getCreatedBy()))
                .map(TraitService::toDto).toList();
        return new TraitsResponse(s, p);
    }

    @Transactional
    public SizeDto createSize(UUID me, SizeRequest r) {
        requireAccess(me, r.subjectUserId());
        Instant now = clock.instant();
        SizeEntry e = new SizeEntry();
        e.setSubjectUserId(r.subjectUserId());
        e.setKind(r.kind());
        e.setValue(r.value().trim());
        e.setNote(r.note());
        e.setVisibility(r.visibility() != null ? r.visibility() : Visibility.SHARED);
        e.setCreatedBy(me);
        e.setCreatedAt(now);
        e.setUpdatedAt(now);
        return toDto(sizes.save(e));
    }

    @Transactional
    public SizeDto updateSize(UUID me, UUID id, SizePatch r) {
        SizeEntry e = sizes.findById(id).orElseThrow(ApiException::notFound);
        requireEditable(me, e.getSubjectUserId(), e.getVisibility(), e.getCreatedBy());
        checkVisibilityChange(me, e.getCreatedBy(), e.getVisibility(), r.visibility());
        if (r.kind() != null) e.setKind(r.kind());
        if (r.value() != null) e.setValue(r.value().trim());
        if (r.note() != null) e.setNote(r.note());
        if (r.visibility() != null) e.setVisibility(r.visibility());
        e.setUpdatedAt(clock.instant());
        return toDto(e);
    }

    @Transactional
    public void deleteSize(UUID me, UUID id) {
        SizeEntry e = sizes.findById(id).orElseThrow(ApiException::notFound);
        requireEditable(me, e.getSubjectUserId(), e.getVisibility(), e.getCreatedBy());
        sizes.delete(e);
    }

    @Transactional
    public PreferenceDto createPreference(UUID me, PreferenceRequest r) {
        requireAccess(me, r.subjectUserId());
        Instant now = clock.instant();
        Preference p = new Preference();
        p.setSubjectUserId(r.subjectUserId());
        p.setCategory(r.category());
        p.setBrand(r.brand());
        p.setName(r.name());
        p.setColor(r.color());
        p.setNote(r.note());
        p.setVisibility(r.visibility() != null ? r.visibility() : Visibility.SHARED);
        p.setCreatedBy(me);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        if (r.links() != null) {
            r.links().forEach(l -> p.getLinks().add(toEntity(l)));
        }
        return toDto(preferences.save(p));
    }

    @Transactional
    public PreferenceDto updatePreference(UUID me, UUID id, PreferencePatch r) {
        Preference p = preferences.findById(id).orElseThrow(ApiException::notFound);
        requireEditable(me, p.getSubjectUserId(), p.getVisibility(), p.getCreatedBy());
        checkVisibilityChange(me, p.getCreatedBy(), p.getVisibility(), r.visibility());
        if (r.category() != null) p.setCategory(r.category());
        if (r.brand() != null) p.setBrand(r.brand());
        if (r.name() != null) p.setName(r.name());
        if (r.color() != null) p.setColor(r.color());
        if (r.note() != null) p.setNote(r.note());
        if (r.visibility() != null) p.setVisibility(r.visibility());
        if (r.links() != null) {
            p.getLinks().clear();
            r.links().forEach(l -> p.getLinks().add(toEntity(l)));
        }
        p.setUpdatedAt(clock.instant());
        preferences.flush();
        return toDto(p);
    }

    @Transactional
    public void deletePreference(UUID me, UUID id) {
        Preference p = preferences.findById(id).orElseThrow(ApiException::notFound);
        requireEditable(me, p.getSubjectUserId(), p.getVisibility(), p.getCreatedBy());
        preferences.delete(p);
    }

    private void requireAccess(UUID me, UUID subject) {
        if (me.equals(subject)) {
            return;
        }
        couples.findActive(me).filter(c -> c.partnerId().equals(subject)).orElseThrow(ApiException::notFound);
    }

    private void requireEditable(UUID me, UUID subject, Visibility visibility, UUID createdBy) {
        requireAccess(me, subject);
        boolean ok = me.equals(createdBy) || (visibility == Visibility.SHARED && me.equals(subject));
        if (!ok) {
            throw ApiException.notFound();
        }
    }

    private static void checkVisibilityChange(UUID me, UUID createdBy, Visibility current, Visibility requested) {
        if (requested != null && requested != current && !me.equals(createdBy)) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Chỉ người tạo được đổi chế độ hiển thị");
        }
    }

    private static boolean visible(UUID me, Visibility visibility, UUID createdBy) {
        return visibility == Visibility.SHARED || me.equals(createdBy);
    }

    private static PreferenceLink toEntity(LinkInput l) {
        PreferenceLink link = new PreferenceLink();
        link.setUrl(l.url());
        link.setLabel(l.label());
        link.setPrice(l.price());
        return link;
    }

    private static SizeDto toDto(SizeEntry e) {
        return new SizeDto(e.getId(), e.getSubjectUserId(), e.getKind(), e.getValue(), e.getNote(),
                e.getVisibility(), e.getCreatedBy(), e.getUpdatedAt());
    }

    private static PreferenceDto toDto(Preference p) {
        List<LinkDto> links = p.getLinks().stream()
                .map(l -> new LinkDto(l.getId(), l.getUrl(), l.getLabel(), l.getPrice())).toList();
        return new PreferenceDto(p.getId(), p.getSubjectUserId(), p.getCategory(), p.getBrand(), p.getName(),
                p.getColor(), p.getNote(), p.getVisibility(), p.getCreatedBy(), p.getUpdatedAt(), links);
    }
}
```

`backend/src/main/java/com/coupleapp/trait/TraitController.java`:
```java
package com.coupleapp.trait;

import com.coupleapp.common.AuthUser;
import com.coupleapp.trait.TraitDtos.CatalogResponse;
import com.coupleapp.trait.TraitDtos.PreferenceDto;
import com.coupleapp.trait.TraitDtos.PreferencePatch;
import com.coupleapp.trait.TraitDtos.PreferenceRequest;
import com.coupleapp.trait.TraitDtos.SizeDto;
import com.coupleapp.trait.TraitDtos.SizePatch;
import com.coupleapp.trait.TraitDtos.SizeRequest;
import com.coupleapp.trait.TraitDtos.TraitsResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/traits")
@RequiredArgsConstructor
public class TraitController {

    private final TraitService traits;

    @GetMapping("/catalog")
    public CatalogResponse catalog() {
        return traits.catalog();
    }

    @GetMapping("/{userId}")
    public TraitsResponse list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID userId) {
        return traits.list(AuthUser.id(jwt), userId);
    }

    @PostMapping("/sizes")
    @ResponseStatus(HttpStatus.CREATED)
    public SizeDto createSize(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SizeRequest r) {
        return traits.createSize(AuthUser.id(jwt), r);
    }

    @PatchMapping("/sizes/{id}")
    public SizeDto updateSize(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody SizePatch r) {
        return traits.updateSize(AuthUser.id(jwt), id, r);
    }

    @DeleteMapping("/sizes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSize(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        traits.deleteSize(AuthUser.id(jwt), id);
    }

    @PostMapping("/preferences")
    @ResponseStatus(HttpStatus.CREATED)
    public PreferenceDto createPreference(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PreferenceRequest r) {
        return traits.createPreference(AuthUser.id(jwt), r);
    }

    @PatchMapping("/preferences/{id}")
    public PreferenceDto updatePreference(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                          @Valid @RequestBody PreferencePatch r) {
        return traits.updatePreference(AuthUser.id(jwt), id, r);
    }

    @DeleteMapping("/preferences/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePreference(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        traits.deletePreference(AuthUser.id(jwt), id);
    }
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest=TraitTest`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(trait): sizes, preferences with shopping links and secret notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Bộ máy nhắc nhở (Strategy `MomentTypeHandler` + `ReminderPlanner`) — logic thuần

**Files:**
- Create: `backend/src/main/java/com/coupleapp/moment/MomentType.java`, `Recurrence.java`, `Moment.java`
- Create: `backend/src/main/java/com/coupleapp/moment/reminder/Audience.java`, `Role.java`, `ReminderConfig.java`, `Occurrence.java`, `Occurrences.java`, `Message.java`, `PlanningContext.java`, `ReminderPlan.java`, `MomentTypeHandler.java`, `ReminderPlanner.java`
- Create: `backend/src/main/java/com/coupleapp/moment/handler/AnniversaryHandler.java`, `DatePlanHandler.java`, `GiftOccasionHandler.java`, `CycleHandler.java`, `CustomHandler.java`
- Test: `backend/src/test/java/com/coupleapp/moment/reminder/ReminderPlannerTest.java`, `ReminderConfigTest.java`

**Interfaces:**
- Consumes: `ApiException`, `ErrorCode`.
- Produces:
  - `enum MomentType { ANNIVERSARY, DATE_PLAN, GIFT_OCCASION, CYCLE, CUSTOM }`, `enum Recurrence { NONE, YEARLY }`.
  - Entity `Moment` (`id, coupleId, type, title, occursOn, occursAt, recurrence, subjectUserId, placeId, message, Map<String,Object> details, ReminderConfig reminderConfig, List<UUID> mediaIds, createdBy, createdAt, updatedAt`) + `UUID ownerId()` (= subject nếu có, ngược lại người tạo).
  - `record ReminderConfig(List<Integer> milestoneDays, Boolean yearly, List<String> offsets, String sendAt, Audience recipients)` + `merge(ReminderConfig override)`, `validate()`, `offsetDurations()`, `sendAtTime()`.
  - `enum Audience { OWNER, PARTNER, BOTH }` + `List<Role> roles()`; `enum Role { OWNER, PARTNER }`.
  - `record PlanningContext(UUID ownerId, UUID partnerId, String ownerName, String partnerName, ZoneId ownerZone, ZoneId partnerZone, boolean cycleShared, Instant now, Instant horizon)`.
  - `record ReminderPlan(UUID recipientId, Role role, Instant fireAt, String title, String body, String deepLink)`.
  - `interface MomentTypeHandler { MomentType type(); ReminderConfig defaults(); void validate(Moment); List<Occurrence> occurrences(Moment, ReminderConfig, LocalDate from, LocalDate to); Message message(Moment, Occurrence, Role, Duration offset, PlanningContext); Audience audience(Moment, Audience requested, PlanningContext); }`.
  - `ReminderPlanner.plan(Moment, MomentTypeHandler, PlanningContext) → List<ReminderPlan>`.

Quy tắc thời điểm gửi: offset chỉ gồm ngày (`P3D`, `P0D`) → gửi lúc `sendAt` theo **múi giờ người nhận** vào ngày (ngày sự kiện − N); offset có phần giờ/phút (`PT2H`) → `occursAt − offset` (nếu không có `occursAt` thì lấy ngày sự kiện lúc `sendAt`). Chỉ giữ nhắc có `now < fireAt ≤ horizon`.

- [ ] **Step 1: Viết test (fail)**

`backend/src/test/java/com/coupleapp/moment/reminder/ReminderPlannerTest.java`:
```java
package com.coupleapp.moment.reminder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.coupleapp.common.ApiException;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.Recurrence;
import com.coupleapp.moment.handler.AnniversaryHandler;
import com.coupleapp.moment.handler.CustomHandler;
import com.coupleapp.moment.handler.CycleHandler;
import com.coupleapp.moment.handler.DatePlanHandler;
import com.coupleapp.moment.handler.GiftOccasionHandler;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReminderPlannerTest {

    static final UUID OWNER = UUID.randomUUID();
    static final UUID PARTNER = UUID.randomUUID();
    static final ZoneId ICT = ZoneId.of("Asia/Ho_Chi_Minh");
    static final Instant NOW = Instant.parse("2026-01-02T00:00:00Z");
    static final Instant HORIZON = NOW.plus(Duration.ofDays(400));

    final ReminderPlanner planner = new ReminderPlanner();

    static PlanningContext ctx(ZoneId partnerZone, boolean cycleShared) {
        return new PlanningContext(OWNER, PARTNER, "Lan", "Minh", ICT, partnerZone, cycleShared, NOW, HORIZON);
    }

    static PlanningContext ctx() {
        return ctx(ICT, true);
    }

    static Moment moment(MomentType type, String occursOn) {
        Moment m = new Moment();
        m.setId(UUID.randomUUID());
        m.setType(type);
        m.setTitle("Test");
        m.setOccursOn(LocalDate.parse(occursOn));
        m.setCreatedBy(OWNER);
        return m;
    }

    static List<Instant> fires(List<ReminderPlan> plans, UUID recipient) {
        return plans.stream().filter(p -> p.recipientId().equals(recipient)).map(ReminderPlan::fireAt).sorted().toList();
    }

    static Instant at(String iso) {
        return Instant.parse(iso);
    }

    @Test
    void anniversaryDefaultsCoverMilestonesAndYearlyForBoth() {
        Moment m = moment(MomentType.ANNIVERSARY, "2026-01-01");
        List<ReminderPlan> plans = planner.plan(m, new AnniversaryHandler(), ctx());

        // 100 ngày (11/04), 200 ngày (20/07), 300 ngày (28/10), 1 năm (01/01/2027) × (P3D, P0D) × 2 người
        assertThat(plans).hasSize(16);
        assertThat(fires(plans, OWNER)).contains(
                at("2026-04-08T01:00:00Z"), at("2026-04-11T01:00:00Z"), at("2027-01-01T01:00:00Z"));
        assertThat(fires(plans, PARTNER)).isEqualTo(fires(plans, OWNER));
        assertThat(plans).allMatch(p -> p.fireAt().isAfter(NOW) && !p.fireAt().isAfter(HORIZON));
        assertThat(plans).anyMatch(p -> p.title().equals("💞 100 ngày bên nhau") && p.body().startsWith("Còn 3 ngày nữa"));
        assertThat(plans).allMatch(p -> p.deepLink().equals("coupleapp://moments/" + m.getId()));
    }

    @Test
    void customMilestonesReplaceDefaults() {
        Moment m = moment(MomentType.ANNIVERSARY, "2026-01-01");
        m.setReminderConfig(new ReminderConfig(List.of(150), false, null, null, null));

        List<ReminderPlan> plans = planner.plan(m, new AnniversaryHandler(), ctx());

        assertThat(fires(plans, OWNER)).containsExactly(at("2026-05-28T01:00:00Z"), at("2026-05-31T01:00:00Z"));
        assertThat(plans).hasSize(4);
    }

    @Test
    void giftOnFeb29FallsBackToFeb28AndOnlyGiverIsNotified() {
        Moment m = moment(MomentType.GIFT_OCCASION, "2024-02-29");
        m.setTitle("Sinh nhật Lan");
        m.setRecurrence(Recurrence.YEARLY);
        m.setSubjectUserId(OWNER);
        m.setDetails(Map.of("occasion", "BIRTHDAY"));

        List<ReminderPlan> plans = planner.plan(m, new GiftOccasionHandler(), ctx());

        assertThat(fires(plans, PARTNER)).containsExactly(at("2026-02-21T01:00:00Z"), at("2026-02-27T01:00:00Z"));
        assertThat(fires(plans, OWNER)).isEmpty();
        assertThat(plans).allMatch(p -> p.deepLink().equals("coupleapp://traits/" + OWNER));
        assertThat(plans).allMatch(p -> p.body().contains("Lan"));
    }

    @Test
    void giftAudienceCanBeOverriddenToBoth() {
        Moment m = moment(MomentType.GIFT_OCCASION, "2024-02-29");
        m.setRecurrence(Recurrence.YEARLY);
        m.setSubjectUserId(OWNER);
        m.setDetails(Map.of("occasion", "BIRTHDAY"));
        m.setReminderConfig(new ReminderConfig(null, null, null, null, Audience.BOTH));

        List<ReminderPlan> plans = planner.plan(m, new GiftOccasionHandler(), ctx());

        assertThat(plans).hasSize(4);
        assertThat(plans).filteredOn(p -> p.role() == Role.OWNER).allMatch(p -> p.body().contains("của bạn"));
    }

    @Test
    void datePlanUsesEveningBeforeAndHoursBeforeStart() {
        Moment m = moment(MomentType.DATE_PLAN, "2026-03-10");
        m.setOccursAt(at("2026-03-10T12:00:00Z")); // 19:00 giờ VN

        List<ReminderPlan> plans = planner.plan(m, new DatePlanHandler(), ctx());

        assertThat(fires(plans, OWNER)).containsExactly(at("2026-03-09T13:00:00Z"), at("2026-03-10T10:00:00Z"));
        assertThat(fires(plans, PARTNER)).containsExactly(at("2026-03-09T13:00:00Z"), at("2026-03-10T10:00:00Z"));
    }

    @Test
    void cycleNotSharedOnlyNotifiesSubject() {
        Moment m = moment(MomentType.CYCLE, "2026-01-20");
        m.setSubjectUserId(OWNER);

        List<ReminderPlan> plans = planner.plan(m, new CycleHandler(), ctx(ICT, false));

        assertThat(fires(plans, OWNER)).containsExactly(at("2026-01-18T01:00:00Z"), at("2026-01-20T01:00:00Z"));
        assertThat(fires(plans, PARTNER)).isEmpty();
    }

    @Test
    void cycleSharedSendsCaringMessageToPartner() {
        Moment m = moment(MomentType.CYCLE, "2026-01-20");
        m.setSubjectUserId(OWNER);

        List<ReminderPlan> plans = planner.plan(m, new CycleHandler(), ctx());

        assertThat(plans).hasSize(4);
        assertThat(plans).filteredOn(p -> p.role() == Role.PARTNER)
                .anyMatch(p -> p.body().equals("Khoảng 2 ngày nữa là tới ngày của Lan, nhớ quan tâm nhé 💗"));
    }

    @Test
    void eachRecipientUsesOwnTimezone() {
        Moment m = moment(MomentType.CUSTOM, "2026-02-01");
        m.setReminderConfig(new ReminderConfig(null, null, null, null, Audience.BOTH));

        List<ReminderPlan> plans = planner.plan(m, new CustomHandler(), ctx(ZoneId.of("Asia/Tokyo"), true));

        assertThat(fires(plans, OWNER)).containsExactly(at("2026-01-31T01:00:00Z"), at("2026-02-01T01:00:00Z"));
        assertThat(fires(plans, PARTNER)).containsExactly(at("2026-01-30T23:00:00Z"), at("2026-01-31T23:00:00Z"));
    }

    @Test
    void pastOccurrencesProduceNothing() {
        Moment m = moment(MomentType.CUSTOM, "2026-01-01");
        assertThat(planner.plan(m, new CustomHandler(), ctx())).isEmpty();
    }

    @Test
    void handlersValidateRequiredFields() {
        Moment datePlan = moment(MomentType.DATE_PLAN, "2026-03-10");
        assertThatThrownBy(() -> new DatePlanHandler().validate(datePlan)).isInstanceOf(ApiException.class);

        Moment gift = moment(MomentType.GIFT_OCCASION, "2026-03-08");
        gift.setDetails(Map.of("occasion", "BIRTHDAY"));
        assertThatThrownBy(() -> new GiftOccasionHandler().validate(gift)).isInstanceOf(ApiException.class);

        gift.setSubjectUserId(OWNER);
        gift.setDetails(Map.of("occasion", "UNKNOWN"));
        assertThatThrownBy(() -> new GiftOccasionHandler().validate(gift)).isInstanceOf(ApiException.class);
    }
}
```

`backend/src/test/java/com/coupleapp/moment/reminder/ReminderConfigTest.java`:
```java
package com.coupleapp.moment.reminder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.coupleapp.common.ApiException;
import java.time.Duration;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class ReminderConfigTest {

    static final ReminderConfig DEFAULTS =
            new ReminderConfig(null, true, List.of("P3D", "P0D"), "08:00", Audience.BOTH);

    @Test
    void mergeOverridesOnlyProvidedFields() {
        ReminderConfig merged = DEFAULTS.merge(new ReminderConfig(null, null, List.of("PT2H"), null, Audience.OWNER));

        assertThat(merged.offsetDurations()).containsExactly(Duration.ofHours(2));
        assertThat(merged.recipients()).isEqualTo(Audience.OWNER);
        assertThat(merged.yearly()).isTrue();
        assertThat(merged.sendAtTime()).isEqualTo(LocalTime.of(8, 0));
        assertThat(DEFAULTS.merge(null)).isEqualTo(DEFAULTS);
    }

    @Test
    void acceptsValidConfig() {
        assertThatCode(() -> new ReminderConfig(List.of(100, 520), true, List.of("P7D", "PT30M"), "21:30", Audience.PARTNER)
                .validate()).doesNotThrowAnyException();
    }

    @Test
    void rejectsOutOfRangeValues() {
        List<ReminderConfig> invalid = List.of(
                new ReminderConfig(null, null, Collections.nCopies(6, "P1D"), null, null),
                new ReminderConfig(null, null, List.of("P31D"), null, null),
                new ReminderConfig(null, null, List.of("-P1D"), null, null),
                new ReminderConfig(null, null, List.of("abc"), null, null),
                new ReminderConfig(IntStream.rangeClosed(1, 21).boxed().toList(), null, null, null, null),
                new ReminderConfig(List.of(0), null, null, null, null),
                new ReminderConfig(null, null, null, "25:00", null));
        for (ReminderConfig c : invalid) {
            assertThatThrownBy(c::validate).as(c.toString()).isInstanceOf(ApiException.class);
        }
    }
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest='ReminderPlannerTest,ReminderConfigTest'`
Expected: FAIL (lỗi biên dịch — class chưa tồn tại).

- [ ] **Step 3: Entity `Moment` + enum**

`backend/src/main/java/com/coupleapp/moment/MomentType.java`:
```java
package com.coupleapp.moment;

public enum MomentType { ANNIVERSARY, DATE_PLAN, GIFT_OCCASION, CYCLE, CUSTOM }
```

`backend/src/main/java/com/coupleapp/moment/Recurrence.java`:
```java
package com.coupleapp.moment;

public enum Recurrence { NONE, YEARLY }
```

`backend/src/main/java/com/coupleapp/moment/Moment.java`:
```java
package com.coupleapp.moment;

import com.coupleapp.moment.reminder.ReminderConfig;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "moments")
@Getter
@Setter
@NoArgsConstructor
public class Moment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID coupleId;

    @Enumerated(EnumType.STRING)
    private MomentType type;

    private String title;
    private LocalDate occursOn;
    private Instant occursAt;

    @Enumerated(EnumType.STRING)
    private Recurrence recurrence = Recurrence.NONE;

    private UUID subjectUserId;
    private UUID placeId;
    private String message;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> details = new HashMap<>();

    /** NULL = dùng mặc định của handler. */
    @JdbcTypeCode(SqlTypes.JSON)
    private ReminderConfig reminderConfig;

    @ElementCollection
    @CollectionTable(name = "moment_media", joinColumns = @JoinColumn(name = "moment_id"))
    @OrderColumn(name = "position")
    @Column(name = "media_id")
    private List<UUID> mediaIds = new ArrayList<>();

    private UUID createdBy;
    private Instant createdAt;
    private Instant updatedAt;

    /** Người "chủ" của kỷ niệm: chủ thể nếu có, ngược lại là người tạo. */
    public UUID ownerId() {
        return subjectUserId != null ? subjectUserId : createdBy;
    }
}
```

- [ ] **Step 4: Kiểu dữ liệu của bộ máy nhắc nhở**

`backend/src/main/java/com/coupleapp/moment/reminder/Role.java`:
```java
package com.coupleapp.moment.reminder;

public enum Role { OWNER, PARTNER }
```

`backend/src/main/java/com/coupleapp/moment/reminder/Audience.java`:
```java
package com.coupleapp.moment.reminder;

import java.util.List;

public enum Audience {
    OWNER, PARTNER, BOTH;

    public List<Role> roles() {
        return switch (this) {
            case OWNER -> List.of(Role.OWNER);
            case PARTNER -> List.of(Role.PARTNER);
            case BOTH -> List.of(Role.OWNER, Role.PARTNER);
        };
    }
}
```

`backend/src/main/java/com/coupleapp/moment/reminder/ReminderConfig.java`:
```java
package com.coupleapp.moment.reminder;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import java.time.Duration;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/** Mọi trường đều tuỳ chọn; trường null nghĩa là "dùng mặc định". */
public record ReminderConfig(
        List<Integer> milestoneDays,
        Boolean yearly,
        List<String> offsets,
        String sendAt,
        Audience recipients) {

    static final int MAX_MILESTONES = 20;
    static final int MAX_OFFSETS = 5;
    static final Duration MAX_OFFSET = Duration.ofDays(30);

    public ReminderConfig merge(ReminderConfig override) {
        if (override == null) {
            return this;
        }
        return new ReminderConfig(
                override.milestoneDays != null ? override.milestoneDays : milestoneDays,
                override.yearly != null ? override.yearly : yearly,
                override.offsets != null ? override.offsets : offsets,
                override.sendAt != null ? override.sendAt : sendAt,
                override.recipients != null ? override.recipients : recipients);
    }

    public void validate() {
        if (milestoneDays != null && (milestoneDays.size() > MAX_MILESTONES
                || milestoneDays.stream().anyMatch(d -> d == null || d < 1 || d > 36_500))) {
            throw invalid("Tối đa 20 mốc ngày, mỗi mốc từ 1 đến 36500");
        }
        if (offsets != null) {
            if (offsets.size() > MAX_OFFSETS) {
                throw invalid("Tối đa 5 lần nhắc");
            }
            for (String o : offsets) {
                Duration d;
                try {
                    d = Duration.parse(o);
                } catch (DateTimeParseException | NullPointerException e) {
                    throw invalid("Thời điểm nhắc không hợp lệ: " + o);
                }
                if (d.isNegative() || d.compareTo(MAX_OFFSET) > 0) {
                    throw invalid("Chỉ nhắc trước tối đa 30 ngày");
                }
            }
        }
        if (sendAt != null) {
            try {
                LocalTime.parse(sendAt);
            } catch (DateTimeParseException e) {
                throw invalid("Giờ gửi phải có dạng HH:mm");
            }
        }
    }

    public List<Duration> offsetDurations() {
        return offsets == null ? List.of() : offsets.stream().map(Duration::parse).toList();
    }

    public LocalTime sendAtTime() {
        return LocalTime.parse(sendAt);
    }

    private static ApiException invalid(String detail) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, detail);
    }
}
```

`backend/src/main/java/com/coupleapp/moment/reminder/Occurrence.java`:
```java
package com.coupleapp.moment.reminder;

import java.time.Instant;
import java.time.LocalDate;

/** Một lần sự kiện diễn ra. {@code at} chỉ có khi sự kiện có giờ cụ thể. */
public record Occurrence(LocalDate date, Instant at, String label) {}
```

`backend/src/main/java/com/coupleapp/moment/reminder/Message.java`:
```java
package com.coupleapp.moment.reminder;

/** {@code deepLink} null → planner dùng link tới kỷ niệm. */
public record Message(String title, String body, String deepLink) {}
```

`backend/src/main/java/com/coupleapp/moment/reminder/PlanningContext.java`:
```java
package com.coupleapp.moment.reminder;

import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

public record PlanningContext(
        UUID ownerId,
        UUID partnerId,
        String ownerName,
        String partnerName,
        ZoneId ownerZone,
        ZoneId partnerZone,
        boolean cycleShared,
        Instant now,
        Instant horizon) {}
```

`backend/src/main/java/com/coupleapp/moment/reminder/ReminderPlan.java`:
```java
package com.coupleapp.moment.reminder;

import java.time.Instant;
import java.util.UUID;

public record ReminderPlan(UUID recipientId, Role role, Instant fireAt, String title, String body, String deepLink) {}
```

`backend/src/main/java/com/coupleapp/moment/reminder/Occurrences.java`:
```java
package com.coupleapp.moment.reminder;

import com.coupleapp.moment.Moment;
import java.time.Duration;
import java.time.LocalDate;
import java.time.MonthDay;
import java.util.ArrayList;
import java.util.List;

public final class Occurrences {

    private Occurrences() {}

    public static List<Occurrence> single(Moment m, LocalDate from, LocalDate to) {
        LocalDate d = m.getOccursOn();
        return within(d, from, to) ? List.of(new Occurrence(d, m.getOccursAt(), m.getTitle())) : List.of();
    }

    /** Lặp hằng năm từ ngày gốc; 29/02 rơi vào 28/02 ở năm không nhuận. */
    public static List<Occurrence> yearly(Moment m, LocalDate from, LocalDate to) {
        MonthDay md = MonthDay.from(m.getOccursOn());
        List<Occurrence> out = new ArrayList<>();
        for (int year = from.getYear(); year <= to.getYear(); year++) {
            LocalDate d = md.atYear(year);
            if (!d.isBefore(m.getOccursOn()) && within(d, from, to)) {
                out.add(new Occurrence(d, null, m.getTitle()));
            }
        }
        return out;
    }

    public static boolean within(LocalDate d, LocalDate from, LocalDate to) {
        return !d.isBefore(from) && !d.isAfter(to);
    }

    /** "hôm nay" / "ngày mai" / "còn 3 ngày nữa" / "còn 2 giờ nữa" / "còn 30 phút nữa". */
    public static String countdown(Duration offset) {
        if (offset.isZero()) {
            return "hôm nay";
        }
        if (offset.toSeconds() % 86_400 == 0) {
            return offset.toDays() == 1 ? "ngày mai" : "còn " + offset.toDays() + " ngày nữa";
        }
        if (offset.toMinutes() % 60 == 0) {
            return "còn " + offset.toHours() + " giờ nữa";
        }
        return "còn " + offset.toMinutes() + " phút nữa";
    }

    public static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
```

`backend/src/main/java/com/coupleapp/moment/reminder/MomentTypeHandler.java`:
```java
package com.coupleapp.moment.reminder;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

/** Strategy cho từng loại kỷ niệm. Thêm loại mới = thêm một implementation. */
public interface MomentTypeHandler {

    MomentType type();

    ReminderConfig defaults();

    default void validate(Moment moment) {}

    List<Occurrence> occurrences(Moment moment, ReminderConfig config, LocalDate from, LocalDate to);

    Message message(Moment moment, Occurrence occurrence, Role recipient, Duration offset, PlanningContext ctx);

    default Audience audience(Moment moment, Audience requested, PlanningContext ctx) {
        return requested;
    }
}
```

`backend/src/main/java/com/coupleapp/moment/reminder/ReminderPlanner.java`:
```java
package com.coupleapp.moment.reminder;

import com.coupleapp.moment.Moment;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class ReminderPlanner {

    public List<ReminderPlan> plan(Moment m, MomentTypeHandler handler, PlanningContext ctx) {
        ReminderConfig cfg = handler.defaults().merge(m.getReminderConfig());
        Audience audience = handler.audience(m, cfg.recipients(), ctx);
        LocalDate from = LocalDate.ofInstant(ctx.now(), ZoneOffset.UTC).minusDays(1);
        LocalDate to = LocalDate.ofInstant(ctx.horizon(), ZoneOffset.UTC).plusDays(31); // offset tối đa 30 ngày

        List<ReminderPlan> out = new ArrayList<>();
        for (Occurrence o : handler.occurrences(m, cfg, from, to)) {
            for (Duration offset : cfg.offsetDurations()) {
                for (Role role : audience.roles()) {
                    ZoneId zone = role == Role.OWNER ? ctx.ownerZone() : ctx.partnerZone();
                    UUID recipient = role == Role.OWNER ? ctx.ownerId() : ctx.partnerId();
                    Instant fireAt = fireAt(o, offset, cfg.sendAtTime(), zone);
                    if (fireAt.isAfter(ctx.now()) && !fireAt.isAfter(ctx.horizon())) {
                        Message msg = handler.message(m, o, role, offset, ctx);
                        String link = msg.deepLink() != null ? msg.deepLink() : "coupleapp://moments/" + m.getId();
                        out.add(new ReminderPlan(recipient, role, fireAt, msg.title(), msg.body(), link));
                    }
                }
            }
        }
        return out;
    }

    static Instant fireAt(Occurrence o, Duration offset, LocalTime sendAt, ZoneId zone) {
        if (offset.toSeconds() % 86_400 == 0) {
            return o.date().minusDays(offset.toDays()).atTime(sendAt).atZone(zone).toInstant();
        }
        Instant base = o.at() != null ? o.at() : o.date().atTime(sendAt).atZone(zone).toInstant();
        return base.minus(offset);
    }
}
```

- [ ] **Step 5: Các handler**

`backend/src/main/java/com/coupleapp/moment/handler/AnniversaryHandler.java`:
```java
package com.coupleapp.moment.handler;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.reminder.Audience;
import com.coupleapp.moment.reminder.Message;
import com.coupleapp.moment.reminder.MomentTypeHandler;
import com.coupleapp.moment.reminder.Occurrence;
import com.coupleapp.moment.reminder.Occurrences;
import com.coupleapp.moment.reminder.PlanningContext;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.Role;
import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;
import org.springframework.stereotype.Component;

@Component
public class AnniversaryHandler implements MomentTypeHandler {

    static final List<Integer> DEFAULT_MILESTONES = List.of(100, 200, 300, 500, 1000);

    @Override
    public MomentType type() {
        return MomentType.ANNIVERSARY;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, true, List.of("P3D", "P0D"), "08:00", Audience.BOTH);
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        LocalDate start = m.getOccursOn();
        TreeMap<LocalDate, String> byDate = new TreeMap<>();
        List<Integer> milestones = cfg.milestoneDays() != null ? cfg.milestoneDays() : defaultMilestones(start, to);
        for (int n : milestones) {
            LocalDate d = start.plusDays(n);
            if (Occurrences.within(d, from, to)) {
                byDate.merge(d, n + " ngày", (a, b) -> a + " · " + b);
            }
        }
        if (Boolean.TRUE.equals(cfg.yearly())) {
            for (int y = 1; !start.plusYears(y).isAfter(to); y++) {
                LocalDate d = start.plusYears(y);
                if (!d.isBefore(from)) {
                    byDate.merge(d, y + " năm", (a, b) -> a + " · " + b);
                }
            }
        }
        return byDate.entrySet().stream().map(e -> new Occurrence(e.getKey(), null, e.getValue())).toList();
    }

    /** 100, 200, 300, 500, 1000 rồi cứ mỗi 500 ngày. */
    static List<Integer> defaultMilestones(LocalDate start, LocalDate to) {
        List<Integer> out = new ArrayList<>(DEFAULT_MILESTONES);
        long maxDays = ChronoUnit.DAYS.between(start, to);
        for (int n = 1500; n <= maxDays; n += 500) {
            out.add(n);
        }
        return out;
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        String title = "💞 " + o.label() + " bên nhau";
        String body = offset.isZero()
                ? "Hôm nay là " + o.label() + " bên nhau của hai bạn. Chúc mừng nhé!"
                : Occurrences.capitalize(Occurrences.countdown(offset)) + " là " + o.label() + " bên nhau 🥰";
        return new Message(title, body, null);
    }
}
```

`backend/src/main/java/com/coupleapp/moment/handler/DatePlanHandler.java`:
```java
package com.coupleapp.moment.handler;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.reminder.Audience;
import com.coupleapp.moment.reminder.Message;
import com.coupleapp.moment.reminder.MomentTypeHandler;
import com.coupleapp.moment.reminder.Occurrence;
import com.coupleapp.moment.reminder.Occurrences;
import com.coupleapp.moment.reminder.PlanningContext;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.Role;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class DatePlanHandler implements MomentTypeHandler {

    @Override
    public MomentType type() {
        return MomentType.DATE_PLAN;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of("P1D", "PT2H"), "20:00", Audience.BOTH);
    }

    @Override
    public void validate(Moment m) {
        if (m.getOccursAt() == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Lịch hẹn cần có giờ hẹn (occursAt)");
        }
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return Occurrences.single(m, from, to);
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        String body = offset.isZero()
                ? "Hôm nay có hẹn: \"" + m.getTitle() + "\""
                : Occurrences.capitalize(Occurrences.countdown(offset)) + " có buổi hẹn \"" + m.getTitle() + "\"";
        return new Message("📅 " + m.getTitle(), body, null);
    }
}
```

`backend/src/main/java/com/coupleapp/moment/handler/GiftOccasionHandler.java`:
```java
package com.coupleapp.moment.handler;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.Recurrence;
import com.coupleapp.moment.reminder.Audience;
import com.coupleapp.moment.reminder.Message;
import com.coupleapp.moment.reminder.MomentTypeHandler;
import com.coupleapp.moment.reminder.Occurrence;
import com.coupleapp.moment.reminder.Occurrences;
import com.coupleapp.moment.reminder.PlanningContext;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.Role;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class GiftOccasionHandler implements MomentTypeHandler {

    static final Set<String> OCCASIONS =
            Set.of("BIRTHDAY", "VALENTINE", "WOMENS_DAY_8_3", "WOMENS_DAY_20_10", "CHRISTMAS", "OTHER");

    @Override
    public MomentType type() {
        return MomentType.GIFT_OCCASION;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of("P7D", "P1D"), "08:00", Audience.PARTNER);
    }

    @Override
    public void validate(Moment m) {
        if (m.getSubjectUserId() == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Cần chọn người nhận quà (subjectUserId)");
        }
        if (!(m.getDetails().get("occasion") instanceof String occasion) || !OCCASIONS.contains(occasion)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Dịp tặng quà không hợp lệ (details.occasion)");
        }
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return m.getRecurrence() == Recurrence.YEARLY
                ? Occurrences.yearly(m, from, to)
                : Occurrences.single(m, from, to);
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        String when = Occurrences.capitalize(Occurrences.countdown(offset));
        if (role == Role.OWNER) {
            String body = offset.isZero()
                    ? "Hôm nay là " + m.getTitle() + " của bạn 🎉"
                    : when + " là " + m.getTitle() + " của bạn 🎉";
            return new Message("🎉 " + m.getTitle(), body, null);
        }
        String body = offset.isZero()
                ? "Hôm nay là " + m.getTitle() + " của " + ctx.ownerName() + ". Đừng quên quà nhé!"
                : when + " là " + m.getTitle() + " của " + ctx.ownerName() + ". Xem gợi ý quà trong mục Đặc điểm nhé!";
        return new Message("🎁 " + m.getTitle(), body, "coupleapp://traits/" + ctx.ownerId());
    }
}
```

`backend/src/main/java/com/coupleapp/moment/handler/CycleHandler.java`:
```java
package com.coupleapp.moment.handler;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.reminder.Audience;
import com.coupleapp.moment.reminder.Message;
import com.coupleapp.moment.reminder.MomentTypeHandler;
import com.coupleapp.moment.reminder.Occurrence;
import com.coupleapp.moment.reminder.Occurrences;
import com.coupleapp.moment.reminder.PlanningContext;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.Role;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CycleHandler implements MomentTypeHandler {

    private static final DateTimeFormatter DAY_MONTH = DateTimeFormatter.ofPattern("dd/MM");

    @Override
    public MomentType type() {
        return MomentType.CYCLE;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of("P2D", "P0D"), "08:00", Audience.BOTH);
    }

    @Override
    public void validate(Moment m) {
        if (m.getSubjectUserId() == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Chu kỳ phải gắn với một người");
        }
    }

    /** Chủ thể tắt chia sẻ → chỉ nhắc chủ thể, bất kể cấu hình. */
    @Override
    public Audience audience(Moment m, Audience requested, PlanningContext ctx) {
        return ctx.cycleShared() ? requested : Audience.OWNER;
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return Occurrences.single(m, from, to);
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        boolean wholeDays = offset.toSeconds() % 86_400 == 0;
        if (role == Role.OWNER) {
            String body = offset.isZero()
                    ? "Hôm nay là ngày dự kiến bắt đầu chu kỳ. Nhớ giữ ấm và nghỉ ngơi nhé!"
                    : "Chu kỳ dự kiến bắt đầu khoảng ngày " + o.date().format(DAY_MONTH)
                            + " (" + Occurrences.countdown(offset) + "). Chuẩn bị sẵn nhé!";
            return new Message("🌸 Chu kỳ sắp tới", body, null);
        }
        String name = ctx.ownerName();
        String body;
        if (offset.isZero()) {
            body = "Hôm nay có thể là ngày đầu chu kỳ của " + name + ". Hỏi han, chuẩn bị đồ ấm, đồ ngọt nhé 💗";
        } else if (wholeDays) {
            body = "Khoảng " + offset.toDays() + " ngày nữa là tới ngày của " + name + ", nhớ quan tâm nhé 💗";
        } else {
            body = Occurrences.capitalize(Occurrences.countdown(offset)) + " là tới ngày của " + name + ", nhớ quan tâm nhé 💗";
        }
        return new Message("💗 Quan tâm " + name, body, null);
    }
}
```

`backend/src/main/java/com/coupleapp/moment/handler/CustomHandler.java`:
```java
package com.coupleapp.moment.handler;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.Recurrence;
import com.coupleapp.moment.reminder.Audience;
import com.coupleapp.moment.reminder.Message;
import com.coupleapp.moment.reminder.MomentTypeHandler;
import com.coupleapp.moment.reminder.Occurrence;
import com.coupleapp.moment.reminder.Occurrences;
import com.coupleapp.moment.reminder.PlanningContext;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.Role;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CustomHandler implements MomentTypeHandler {

    @Override
    public MomentType type() {
        return MomentType.CUSTOM;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of("P1D", "P0D"), "08:00", Audience.OWNER);
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return m.getRecurrence() == Recurrence.YEARLY
                ? Occurrences.yearly(m, from, to)
                : Occurrences.single(m, from, to);
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        String body = offset.isZero()
                ? "Hôm nay: " + m.getTitle()
                : Occurrences.capitalize(Occurrences.countdown(offset)) + ": " + m.getTitle();
        return new Message("🔔 " + m.getTitle(), body, null);
    }
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest='ReminderPlannerTest,ReminderConfigTest'`
Expected: PASS (13 tests).

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(moment): reminder planning engine with per-type strategy handlers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: API kỷ niệm (CRUD, ảnh, địa điểm, tuỳ chỉnh nhắc) + lưu lịch nhắc

**Files:**
- Create: `backend/src/main/java/com/coupleapp/place/Place.java`, `PlaceRepository.java`, `PlaceDtos.java`, `PlaceService.java`
- Create: `backend/src/main/java/com/coupleapp/notification/Reminder.java`, `ReminderStatus.java`, `ReminderRepository.java`
- Create: `backend/src/main/java/com/coupleapp/moment/MomentRepository.java`, `MomentDtos.java`, `MomentService.java`, `MomentController.java`, `MomentEventsListener.java`
- Create: `backend/src/main/java/com/coupleapp/moment/reminder/ReminderScheduler.java`
- Test: `backend/src/test/java/com/coupleapp/moment/MomentTest.java`

**Interfaces:**
- Consumes: `CoupleAccess`, `CoupleContext`, `CouplePairedEvent`, `CoupleEndedEvent`, `MediaService.requireUsable/dtos`, `UserRepository`, `UserSettingsRepository`, `ReminderPlanner`, các `MomentTypeHandler`, `Moment`.
- Produces:
  - `PlaceDtos.PlaceInput(String name, String address, Double lat, Double lng, String category)`, `PlaceDtos.PlaceDto(UUID id, String name, String address, double lat, double lng, String category)`; `PlaceService.create(UUID coupleId, UUID userId, PlaceInput) → Place`, `require(UUID placeId, UUID coupleId) → Place`, `find(UUID placeId) → Optional<PlaceDto>`.
  - Entity `Reminder`, `enum ReminderStatus { PENDING, SENT, FAILED, CANCELLED }`; `ReminderRepository.cancelPendingByMoment(UUID)`, `cancelPendingByCouple(UUID)`, `lockDue(Instant now, int limit)`, `findByMomentIdAndRecipientIdAndStatusOrderByFireAtAsc(UUID, UUID, ReminderStatus)`.
  - `ReminderScheduler.replan(Moment)`, `handler(MomentType) → MomentTypeHandler`, `effectiveConfig(Moment) → ReminderConfig`, `replanAllRecurring() → int`.
  - `MomentService.createSystem(UUID coupleId, UUID createdBy, MomentType type, String title, LocalDate occursOn, UUID subjectUserId) → Moment` (dùng cho ghép đôi và chu kỳ).
  - `MomentRepository.findFirstByCoupleIdAndTypeAndSubjectUserId(UUID, MomentType, UUID) → Optional<Moment>`, `findByTypeAndOccursOnBefore(MomentType, LocalDate) → List<Moment>`.

- [ ] **Step 1: Viết test (fail)**

`backend/src/test/java/com/coupleapp/moment/MomentTest.java`:
```java
package com.coupleapp.moment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MomentTest extends IntegrationTest {

    String lan;
    String minh;
    UUID lanId;
    UUID minhId;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        lanId = userId(lan);
        minhId = userId(minh);
    }

    static LocalDate today() {
        return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    String create(String token, Map<String, Object> body) throws Exception {
        return read(post("/api/moments", token, body).andExpect(status().isCreated())).get("id").asText();
    }

    JsonNode reminders(String token, String momentId) throws Exception {
        return read(get("/api/moments/" + momentId + "/reminders", token).andExpect(status().isOk()));
    }

    static List<String> texts(JsonNode array, String field) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.get(field).asText()));
        return out;
    }

    @Test
    void anniversaryWithNewPlaceRemindsBoth() throws Exception {
        JsonNode m = read(post("/api/moments", lan, Map.of(
                "type", "ANNIVERSARY", "title", "Ngày yêu nhau",
                "occursOn", today().minusDays(50).toString(),
                "message", "Lần đầu đi chơi Hồ Gươm",
                "place", Map.of("name", "Hồ Gươm", "lat", 21.0287, "lng", 105.8524, "category", "TRAVEL")))
                .andExpect(status().isCreated()));

        assertThat(m.get("place").get("name").asText()).isEqualTo("Hồ Gươm");
        assertThat(m.get("reminderConfig").isNull()).isTrue();
        assertThat(m.get("effectiveReminderConfig").get("recipients").asText()).isEqualTo("BOTH");

        String id = m.get("id").asText();
        JsonNode lanReminders = reminders(lan, id);
        assertThat(texts(lanReminders, "title")).contains("💞 100 ngày bên nhau");
        assertThat(reminders(minh, id).size()).isEqualTo(lanReminders.size());
    }

    @Test
    void reminderConfigChangesRecipientsAndOffsetsAndCanBeReset() throws Exception {
        String id = create(lan, Map.of("type", "CUSTOM", "title", "Mua hoa", "occursOn", today().plusDays(10).toString()));
        assertThat(reminders(lan, id).size()).isEqualTo(2);
        assertThat(reminders(minh, id).size()).isZero();

        put("/api/moments/" + id + "/reminder-config", lan, Map.of("offsets", List.of("P5D"), "recipients", "BOTH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reminderConfig.offsets[0]").value("P5D"))
                .andExpect(jsonPath("$.effectiveReminderConfig.sendAt").value("08:00"));
        assertThat(reminders(lan, id).size()).isEqualTo(1);
        assertThat(reminders(minh, id).size()).isEqualTo(1);

        put("/api/moments/" + id + "/reminder-config", lan, "null").andExpect(status().isOk());
        assertThat(reminders(lan, id).size()).isEqualTo(2);
        assertThat(reminders(minh, id).size()).isZero();
    }

    @Test
    void invalidReminderConfigIsRejected() throws Exception {
        String id = create(lan, Map.of("type", "CUSTOM", "title", "X", "occursOn", today().plusDays(10).toString()));
        put("/api/moments/" + id + "/reminder-config", lan,
                Map.of("offsets", List.of("P1D", "P2D", "P3D", "P4D", "P5D", "P6D")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        put("/api/moments/" + id + "/reminder-config", lan, Map.of("recipients", "EVERYONE"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updatingDateReplansReminders() throws Exception {
        LocalDate day = today().plusDays(5);
        String id = create(lan, Map.of("type", "DATE_PLAN", "title", "Ăn tối", "occursOn", day.toString(),
                "occursAt", day.atTime(12, 0).toInstant(ZoneOffset.UTC).toString()));
        List<String> before = texts(reminders(lan, id), "fireAt");

        LocalDate newDay = today().plusDays(7);
        patch("/api/moments/" + id, lan, Map.of("occursOn", newDay.toString(),
                "occursAt", newDay.atTime(12, 0).toInstant(ZoneOffset.UTC).toString()))
                .andExpect(status().isOk());

        List<String> after = texts(reminders(lan, id), "fireAt");
        assertThat(after).hasSize(2).doesNotContainAnyElementsOf(before);
        assertThat(jdbc.queryForObject(
                "select count(*) from reminders where moment_id = ?::uuid and status = 'CANCELLED'", Integer.class, id))
                .isEqualTo(4);
    }

    @Test
    void datePlanRequiresTime() throws Exception {
        post("/api/moments", lan, Map.of("type", "DATE_PLAN", "title", "Ăn tối", "occursOn", today().plusDays(3).toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void giftOccasionRemindsGiverWithLinkToTraits() throws Exception {
        String id = create(minh, Map.of("type", "GIFT_OCCASION", "title", "Sinh nhật Lan",
                "occursOn", today().plusDays(20).minusYears(20).toString(),
                "subjectUserId", lanId.toString(), "details", Map.of("occasion", "BIRTHDAY")));

        JsonNode giver = reminders(minh, id);
        // năm nay (còn 20 ngày) + năm sau (~385 ngày, vẫn trong horizon 400 ngày) × (P7D, P1D)
        assertThat(giver.size()).isEqualTo(4);
        assertThat(texts(giver, "deepLink")).allMatch(l -> l.equals("coupleapp://traits/" + lanId));
        assertThat(reminders(lan, id).size()).isZero();
        get("/api/moments/" + id, lan).andExpect(jsonPath("$.recurrence").value("YEARLY"));
    }

    @Test
    void subjectMustBelongToCouple() throws Exception {
        post("/api/moments", lan, Map.of("type", "GIFT_OCCASION", "title", "X", "occursOn", "2000-01-01",
                "subjectUserId", UUID.randomUUID().toString(), "details", Map.of("occasion", "BIRTHDAY")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void attachesMediaInOrderAndReplacesOnUpdate() throws Exception {
        UUID first = uploadImage(lan);
        UUID second = uploadImage(minh);
        JsonNode m = read(post("/api/moments", lan, Map.of("type", "ANNIVERSARY", "title", "Đà Lạt",
                "occursOn", today().minusDays(10).toString(), "mediaIds", List.of(second, first)))
                .andExpect(status().isCreated()));
        assertThat(texts(m.get("media"), "id")).containsExactly(second.toString(), first.toString());
        assertThat(m.get("media").get(0).get("url").asText()).startsWith("http");

        patch("/api/moments/" + m.get("id").asText(), lan, Map.of("mediaIds", List.of(first, second)))
                .andExpect(jsonPath("$.media[0].id").value(first.toString()))
                .andExpect(jsonPath("$.media[1].id").value(second.toString()));
    }

    @Test
    void mediaFromAnotherCoupleIsRejected() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        String hung = register("hung@x.vn", "Hùng");
        pair(hoa, hung);
        UUID foreign = uploadImage(hoa);

        post("/api/moments", lan, Map.of("type", "ANNIVERSARY", "title", "X",
                "occursOn", today().toString(), "mediaIds", List.of(foreign)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void otherCoupleCannotSeeOrEdit() throws Exception {
        String id = create(lan, Map.of("type", "CUSTOM", "title", "Bí mật", "occursOn", today().plusDays(3).toString()));
        String hoa = register("hoa@x.vn", "Hoa");
        String hung = register("hung@x.vn", "Hùng");
        pair(hoa, hung);

        get("/api/moments/" + id, hoa).andExpect(status().isNotFound());
        patch("/api/moments/" + id, hoa, Map.of("title", "hack")).andExpect(status().isNotFound());
        delete("/api/moments/" + id, hoa).andExpect(status().isNotFound());
    }

    @Test
    void cycleCannotBeCreatedThroughMomentsApi() throws Exception {
        post("/api/moments", lan, Map.of("type", "CYCLE", "title", "Chu kỳ", "occursOn", today().toString(),
                "subjectUserId", lanId.toString()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pairingWithStartDateCreatesAnniversary() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        String hung = register("hung@x.vn", "Hùng");
        pair(hoa, hung, "2025-02-14");

        get("/api/moments?type=ANNIVERSARY", hoa)
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Ngày yêu nhau"))
                .andExpect(jsonPath("$[0].occursOn").value("2025-02-14"));
    }

    @Test
    void listFiltersByTypeAndDateRange() throws Exception {
        create(lan, Map.of("type", "CUSTOM", "title", "A", "occursOn", "2026-01-10"));
        create(lan, Map.of("type", "CUSTOM", "title", "B", "occursOn", "2026-03-10"));
        create(lan, Map.of("type", "ANNIVERSARY", "title", "C", "occursOn", "2026-02-10"));

        get("/api/moments?type=CUSTOM&from=2026-02-01&to=2026-12-31", minh)
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("B"));
        get("/api/moments", minh)
                .andExpect(jsonPath("$[0].title").value("A"))
                .andExpect(jsonPath("$[1].title").value("C"))
                .andExpect(jsonPath("$[2].title").value("B"));
    }

    @Test
    void deleteRemovesMomentAndItsReminders() throws Exception {
        String id = create(lan, Map.of("type", "CUSTOM", "title", "X", "occursOn", today().plusDays(10).toString()));
        delete("/api/moments/" + id, minh).andExpect(status().isNoContent());
        get("/api/moments/" + id, lan).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select count(*) from reminders", Integer.class)).isZero();
    }

    @Test
    void endingCoupleCancelsPendingReminders() throws Exception {
        Map<String, Object> body = new HashMap<>(Map.of("type", "CUSTOM", "title", "X",
                "occursOn", today().plusDays(10).toString()));
        create(lan, body);
        post("/api/couples/me/end", lan, null).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select count(*) from reminders where status = 'PENDING'", Integer.class)).isZero();
    }

    @Test
    void requiresCouple() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        get("/api/moments", hoa).andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));
    }
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest=MomentTest`
Expected: FAIL.

- [ ] **Step 3: Địa điểm (tối thiểu cho GĐ1)**

`backend/src/main/java/com/coupleapp/place/Place.java`:
```java
package com.coupleapp.place;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "places")
@Getter
@Setter
@NoArgsConstructor
public class Place {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID coupleId;
    private String name;
    private String address;
    private double lat;
    private double lng;
    private String category;
    private String externalRef;
    private UUID createdBy;
    private Instant createdAt;
    private Instant updatedAt;
}
```

`backend/src/main/java/com/coupleapp/place/PlaceRepository.java`:
```java
package com.coupleapp.place;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlaceRepository extends JpaRepository<Place, UUID> {}
```

`backend/src/main/java/com/coupleapp/place/PlaceDtos.java`:
```java
package com.coupleapp.place;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class PlaceDtos {

    private PlaceDtos() {}

    public record PlaceInput(
            @NotBlank @Size(max = 200) String name,
            @Size(max = 500) String address,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
            @Pattern(regexp = "^[A-Z_]{2,30}$") String category) {}

    public record PlaceDto(UUID id, String name, String address, double lat, double lng, String category) {}
}
```

`backend/src/main/java/com/coupleapp/place/PlaceService.java`:
```java
package com.coupleapp.place;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.place.PlaceDtos.PlaceDto;
import com.coupleapp.place.PlaceDtos.PlaceInput;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlaceService {

    private final PlaceRepository places;
    private final Clock clock;

    @Transactional
    public Place create(UUID coupleId, UUID userId, PlaceInput in) {
        Instant now = clock.instant();
        Place p = new Place();
        p.setCoupleId(coupleId);
        p.setName(in.name().trim());
        p.setAddress(in.address());
        p.setLat(in.lat());
        p.setLng(in.lng());
        p.setCategory(in.category());
        p.setCreatedBy(userId);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        return places.save(p);
    }

    @Transactional(readOnly = true)
    public Place require(UUID placeId, UUID coupleId) {
        return places.findById(placeId)
                .filter(p -> p.getCoupleId().equals(coupleId))
                .orElseThrow(() -> new ApiException(ErrorCode.VALIDATION_FAILED, "Địa điểm không hợp lệ"));
    }

    @Transactional(readOnly = true)
    public Optional<PlaceDto> find(UUID placeId) {
        return placeId == null ? Optional.empty() : places.findById(placeId).map(PlaceService::toDto);
    }

    public static PlaceDto toDto(Place p) {
        return new PlaceDto(p.getId(), p.getName(), p.getAddress(), p.getLat(), p.getLng(), p.getCategory());
    }
}
```

- [ ] **Step 4: Bảng nhắc nhở**

`backend/src/main/java/com/coupleapp/notification/ReminderStatus.java`:
```java
package com.coupleapp.notification;

public enum ReminderStatus { PENDING, SENT, FAILED, CANCELLED }
```

`backend/src/main/java/com/coupleapp/notification/Reminder.java`:
```java
package com.coupleapp.notification;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reminders")
@Getter
@Setter
@NoArgsConstructor
public class Reminder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID coupleId;
    private UUID momentId;
    private UUID recipientId;
    private Instant fireAt;
    private String title;
    private String body;
    private String deepLink;

    @Enumerated(EnumType.STRING)
    private ReminderStatus status = ReminderStatus.PENDING;

    private int attempts;
    private Instant sentAt;
    private Instant createdAt = Instant.now();
}
```

`backend/src/main/java/com/coupleapp/notification/ReminderRepository.java`:
```java
package com.coupleapp.notification;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {

    @Modifying
    @Query(value = "update reminders set status = 'CANCELLED' where moment_id = :momentId and status = 'PENDING'",
            nativeQuery = true)
    int cancelPendingByMoment(UUID momentId);

    @Modifying
    @Query(value = "update reminders set status = 'CANCELLED' where couple_id = :coupleId and status = 'PENDING'",
            nativeQuery = true)
    int cancelPendingByCouple(UUID coupleId);

    /** Khoá các nhắc đến hạn; instance khác chạy song song sẽ bỏ qua dòng đang bị khoá. */
    @Query(value = """
            select * from reminders
            where status = 'PENDING' and fire_at <= :now
            order by fire_at
            limit :limit
            for update skip locked
            """, nativeQuery = true)
    List<Reminder> lockDue(Instant now, int limit);

    List<Reminder> findByMomentIdAndRecipientIdAndStatusOrderByFireAtAsc(
            UUID momentId, UUID recipientId, ReminderStatus status);
}
```

- [ ] **Step 5: Repository + scheduler**

`backend/src/main/java/com/coupleapp/moment/MomentRepository.java`:
```java
package com.coupleapp.moment;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MomentRepository extends JpaRepository<Moment, UUID> {

    List<Moment> findByCoupleIdOrderByOccursOnAsc(UUID coupleId);

    Optional<Moment> findFirstByCoupleIdAndTypeAndSubjectUserId(UUID coupleId, MomentType type, UUID subjectUserId);

    List<Moment> findByTypeAndOccursOnBefore(MomentType type, LocalDate date);

    @Query("select m from Moment m where m.type in :types or m.recurrence = :recurrence")
    List<Moment> findRecurring(Collection<MomentType> types, Recurrence recurrence);
}
```

`backend/src/main/java/com/coupleapp/moment/reminder/ReminderScheduler.java`:
```java
package com.coupleapp.moment.reminder;

import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentRepository;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.Recurrence;
import com.coupleapp.notification.Reminder;
import com.coupleapp.notification.ReminderRepository;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Chuyển kế hoạch nhắc của một kỷ niệm thành các dòng {@code reminders}. */
@Service
public class ReminderScheduler {

    static final Duration HORIZON = Duration.ofDays(400);

    private final Map<MomentType, MomentTypeHandler> handlers = new EnumMap<>(MomentType.class);
    private final ReminderPlanner planner;
    private final ReminderRepository reminders;
    private final MomentRepository moments;
    private final CoupleAccess couples;
    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final Clock clock;

    public ReminderScheduler(List<MomentTypeHandler> handlerList, ReminderPlanner planner,
                             ReminderRepository reminders, MomentRepository moments, CoupleAccess couples,
                             UserRepository users, UserSettingsRepository settings, Clock clock) {
        handlerList.forEach(h -> handlers.put(h.type(), h));
        this.planner = planner;
        this.reminders = reminders;
        this.moments = moments;
        this.couples = couples;
        this.users = users;
        this.settings = settings;
        this.clock = clock;
    }

    public MomentTypeHandler handler(MomentType type) {
        MomentTypeHandler h = handlers.get(type);
        if (h == null) {
            throw new IllegalStateException("Chưa có handler cho " + type);
        }
        return h;
    }

    public ReminderConfig effectiveConfig(Moment m) {
        return handler(m.getType()).defaults().merge(m.getReminderConfig());
    }

    /** Huỷ nhắc chưa gửi rồi sinh lại theo cấu hình hiện tại. Cặp đôi đã kết thúc → chỉ huỷ. */
    @Transactional
    public void replan(Moment m) {
        reminders.cancelPendingByMoment(m.getId());
        Optional<CoupleContext> active = couples.findActive(m.ownerId())
                .filter(c -> c.coupleId().equals(m.getCoupleId()));
        if (active.isEmpty()) {
            return;
        }
        CoupleContext c = active.get();
        User owner = users.findById(c.userId()).orElseThrow();
        User partner = users.findById(c.partnerId()).orElseThrow();
        boolean cycleShared = settings.findById(owner.getId()).map(UserSettings::isShareCycle).orElse(true);
        Instant now = clock.instant();
        PlanningContext ctx = new PlanningContext(owner.getId(), partner.getId(), owner.getDisplayName(),
                partner.getDisplayName(), owner.zone(), partner.zone(), cycleShared, now, now.plus(HORIZON));

        for (ReminderPlan p : planner.plan(m, handler(m.getType()), ctx)) {
            Reminder r = new Reminder();
            r.setCoupleId(m.getCoupleId());
            r.setMomentId(m.getId());
            r.setRecipientId(p.recipientId());
            r.setFireAt(p.fireAt());
            r.setTitle(p.title());
            r.setBody(p.body());
            r.setDeepLink(p.deepLink());
            r.setCreatedAt(now);
            reminders.save(r);
        }
    }

    /** Job hằng ngày: kéo dài lịch nhắc của kỷ niệm lặp lại để luôn phủ đủ horizon. */
    @Transactional
    public int replanAllRecurring() {
        List<Moment> recurring = moments.findRecurring(
                EnumSet.of(MomentType.ANNIVERSARY, MomentType.GIFT_OCCASION, MomentType.CYCLE), Recurrence.YEARLY);
        recurring.forEach(this::replan);
        return recurring.size();
    }
}
```

- [ ] **Step 6: DTO, service, controller, listener**

`backend/src/main/java/com/coupleapp/moment/MomentDtos.java`:
```java
package com.coupleapp.moment;

import com.coupleapp.media.MediaDtos.MediaDto;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.place.PlaceDtos.PlaceDto;
import com.coupleapp.place.PlaceDtos.PlaceInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class MomentDtos {

    private MomentDtos() {}

    public record CreateMomentRequest(
            @NotNull MomentType type,
            @NotBlank @Size(max = 200) String title,
            @NotNull LocalDate occursOn,
            Instant occursAt,
            Recurrence recurrence,
            UUID subjectUserId,
            @Size(max = 2000) String message,
            Map<String, Object> details,
            @Valid PlaceInput place,
            UUID placeId,
            @Size(max = 30) List<UUID> mediaIds) {}

    /** Trường null = giữ nguyên. */
    public record UpdateMomentRequest(
            @Size(min = 1, max = 200) String title,
            LocalDate occursOn,
            Instant occursAt,
            Recurrence recurrence,
            UUID subjectUserId,
            @Size(max = 2000) String message,
            Map<String, Object> details,
            @Valid PlaceInput place,
            UUID placeId,
            @Size(max = 30) List<UUID> mediaIds) {}

    public record MomentResponse(
            UUID id, MomentType type, String title, LocalDate occursOn, Instant occursAt, Recurrence recurrence,
            UUID subjectUserId, String message, Map<String, Object> details,
            ReminderConfig reminderConfig, ReminderConfig effectiveReminderConfig,
            PlaceDto place, List<MediaDto> media, UUID createdBy, Instant createdAt, Instant updatedAt) {}

    public record ReminderDto(UUID id, Instant fireAt, String title, String body, String deepLink) {}
}
```

`backend/src/main/java/com/coupleapp/moment/MomentService.java`:
```java
package com.coupleapp.moment;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.media.MediaService;
import com.coupleapp.moment.MomentDtos.CreateMomentRequest;
import com.coupleapp.moment.MomentDtos.MomentResponse;
import com.coupleapp.moment.MomentDtos.ReminderDto;
import com.coupleapp.moment.MomentDtos.UpdateMomentRequest;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.ReminderScheduler;
import com.coupleapp.notification.ReminderRepository;
import com.coupleapp.notification.ReminderStatus;
import com.coupleapp.place.PlaceDtos.PlaceInput;
import com.coupleapp.place.PlaceService;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MomentService {

    private final MomentRepository moments;
    private final ReminderScheduler scheduler;
    private final ReminderRepository reminders;
    private final CoupleAccess couples;
    private final PlaceService places;
    private final MediaService media;
    private final UserSettingsRepository settings;
    private final Clock clock;

    @Transactional
    public MomentResponse create(UUID userId, CreateMomentRequest r) {
        CoupleContext c = couples.requireActive(userId);
        if (r.type() == MomentType.CYCLE) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Chu kỳ được quản lý qua /api/cycles");
        }
        Instant now = clock.instant();
        Moment m = new Moment();
        m.setCoupleId(c.coupleId());
        m.setType(r.type());
        m.setTitle(r.title().trim());
        m.setOccursOn(r.occursOn());
        m.setOccursAt(r.occursAt());
        m.setRecurrence(r.recurrence() != null ? r.recurrence()
                : r.type() == MomentType.GIFT_OCCASION ? Recurrence.YEARLY : Recurrence.NONE);
        m.setSubjectUserId(checkSubject(c, r.subjectUserId()));
        m.setMessage(r.message());
        m.setDetails(r.details() != null ? new HashMap<>(r.details()) : new HashMap<>());
        applyPlace(m, c, userId, r.place(), r.placeId());
        applyMedia(m, c, r.mediaIds());
        m.setCreatedBy(userId);
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        scheduler.handler(m.getType()).validate(m);
        moments.save(m);
        scheduler.replan(m);
        return toResponse(m);
    }

    /** Tạo kỷ niệm do hệ thống sinh (ngày yêu khi ghép đôi, chu kỳ). */
    @Transactional
    public Moment createSystem(UUID coupleId, UUID createdBy, MomentType type, String title,
                               LocalDate occursOn, UUID subjectUserId) {
        Instant now = clock.instant();
        Moment m = new Moment();
        m.setCoupleId(coupleId);
        m.setType(type);
        m.setTitle(title);
        m.setOccursOn(occursOn);
        m.setSubjectUserId(subjectUserId);
        m.setCreatedBy(createdBy);
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        scheduler.handler(type).validate(m);
        moments.save(m);
        scheduler.replan(m);
        return m;
    }

    @Transactional
    public MomentResponse update(UUID userId, UUID id, UpdateMomentRequest r) {
        CoupleContext c = couples.requireActive(userId);
        Moment m = loadEditable(c, id);
        if (r.title() != null) m.setTitle(r.title().trim());
        if (r.occursOn() != null) m.setOccursOn(r.occursOn());
        if (r.occursAt() != null) m.setOccursAt(r.occursAt());
        if (r.recurrence() != null) m.setRecurrence(r.recurrence());
        if (r.subjectUserId() != null) m.setSubjectUserId(checkSubject(c, r.subjectUserId()));
        if (r.message() != null) m.setMessage(r.message());
        if (r.details() != null) m.setDetails(new HashMap<>(r.details()));
        applyPlace(m, c, userId, r.place(), r.placeId());
        if (r.mediaIds() != null) applyMedia(m, c, r.mediaIds());
        m.setUpdatedAt(clock.instant());
        scheduler.handler(m.getType()).validate(m);
        scheduler.replan(m);
        return toResponse(m);
    }

    @Transactional
    public MomentResponse setReminderConfig(UUID userId, UUID id, ReminderConfig config) {
        CoupleContext c = couples.requireActive(userId);
        Moment m = loadEditable(c, id);
        if (config != null) {
            config.validate();
        }
        m.setReminderConfig(config);
        m.setUpdatedAt(clock.instant());
        scheduler.replan(m);
        return toResponse(m);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        CoupleContext c = couples.requireActive(userId);
        moments.delete(loadEditable(c, id));
    }

    @Transactional(readOnly = true)
    public MomentResponse get(UUID userId, UUID id) {
        return toResponse(loadVisible(couples.requireActive(userId), id));
    }

    @Transactional(readOnly = true)
    public List<MomentResponse> list(UUID userId, MomentType type, LocalDate from, LocalDate to) {
        CoupleContext c = couples.requireActive(userId);
        return moments.findByCoupleIdOrderByOccursOnAsc(c.coupleId()).stream()
                .filter(m -> type == null || m.getType() == type)
                .filter(m -> from == null || !m.getOccursOn().isBefore(from))
                .filter(m -> to == null || !m.getOccursOn().isAfter(to))
                .filter(m -> visible(m, userId))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ReminderDto> upcomingReminders(UUID userId, UUID id) {
        Moment m = loadVisible(couples.requireActive(userId), id);
        return reminders.findByMomentIdAndRecipientIdAndStatusOrderByFireAtAsc(m.getId(), userId, ReminderStatus.PENDING)
                .stream()
                .map(r -> new ReminderDto(r.getId(), r.getFireAt(), r.getTitle(), r.getBody(), r.getDeepLink()))
                .toList();
    }

    private Moment loadVisible(CoupleContext c, UUID id) {
        return moments.findById(id)
                .filter(m -> m.getCoupleId().equals(c.coupleId()))
                .filter(m -> visible(m, c.userId()))
                .orElseThrow(ApiException::notFound);
    }

    /** Kỷ niệm chu kỳ chỉ chủ thể được sửa. */
    private Moment loadEditable(CoupleContext c, UUID id) {
        Moment m = loadVisible(c, id);
        if (m.getType() == MomentType.CYCLE && !c.userId().equals(m.getSubjectUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Chỉ chủ thể được sửa dữ liệu chu kỳ");
        }
        return m;
    }

    private boolean visible(Moment m, UUID viewer) {
        if (m.getType() != MomentType.CYCLE || viewer.equals(m.getSubjectUserId())) {
            return true;
        }
        return settings.findById(m.getSubjectUserId()).map(UserSettings::isShareCycle).orElse(true);
    }

    private static UUID checkSubject(CoupleContext c, UUID subject) {
        if (subject != null && !subject.equals(c.userId()) && !subject.equals(c.partnerId())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Người được nhắc tới phải là bạn hoặc người yêu");
        }
        return subject;
    }

    private void applyPlace(Moment m, CoupleContext c, UUID userId, PlaceInput place, UUID placeId) {
        if (place != null) {
            m.setPlaceId(places.create(c.coupleId(), userId, place).getId());
        } else if (placeId != null) {
            m.setPlaceId(places.require(placeId, c.coupleId()).getId());
        }
    }

    private void applyMedia(Moment m, CoupleContext c, List<UUID> ids) {
        List<UUID> list = ids != null ? ids : List.of();
        media.requireUsable(list, c.coupleId());
        m.getMediaIds().clear();
        m.getMediaIds().addAll(list);
    }

    private MomentResponse toResponse(Moment m) {
        return new MomentResponse(
                m.getId(), m.getType(), m.getTitle(), m.getOccursOn(), m.getOccursAt(), m.getRecurrence(),
                m.getSubjectUserId(), m.getMessage(), m.getDetails(),
                m.getReminderConfig(), scheduler.effectiveConfig(m),
                places.find(m.getPlaceId()).orElse(null),
                media.dtos(new ArrayList<>(m.getMediaIds())),
                m.getCreatedBy(), m.getCreatedAt(), m.getUpdatedAt());
    }
}
```

`backend/src/main/java/com/coupleapp/moment/MomentController.java`:
```java
package com.coupleapp.moment;

import com.coupleapp.common.AuthUser;
import com.coupleapp.moment.MomentDtos.CreateMomentRequest;
import com.coupleapp.moment.MomentDtos.MomentResponse;
import com.coupleapp.moment.MomentDtos.ReminderDto;
import com.coupleapp.moment.MomentDtos.UpdateMomentRequest;
import com.coupleapp.moment.reminder.ReminderConfig;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/moments")
@RequiredArgsConstructor
public class MomentController {

    private final MomentService moments;

    @GetMapping
    public List<MomentResponse> list(@AuthenticationPrincipal Jwt jwt,
                                     @RequestParam(required = false) MomentType type,
                                     @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return moments.list(AuthUser.id(jwt), type, from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MomentResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateMomentRequest r) {
        return moments.create(AuthUser.id(jwt), r);
    }

    @GetMapping("/{id}")
    public MomentResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return moments.get(AuthUser.id(jwt), id);
    }

    @PatchMapping("/{id}")
    public MomentResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                 @Valid @RequestBody UpdateMomentRequest r) {
        return moments.update(AuthUser.id(jwt), id, r);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        moments.delete(AuthUser.id(jwt), id);
    }

    /** Body {@code null} = khôi phục mặc định. */
    @PutMapping("/{id}/reminder-config")
    public MomentResponse reminderConfig(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                         @RequestBody(required = false) ReminderConfig config) {
        return moments.setReminderConfig(AuthUser.id(jwt), id, config);
    }

    @GetMapping("/{id}/reminders")
    public List<ReminderDto> reminders(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return moments.upcomingReminders(AuthUser.id(jwt), id);
    }
}
```

`backend/src/main/java/com/coupleapp/moment/MomentEventsListener.java`:
```java
package com.coupleapp.moment;

import com.coupleapp.couple.CoupleEndedEvent;
import com.coupleapp.couple.CouplePairedEvent;
import com.coupleapp.notification.ReminderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class MomentEventsListener {

    private final MomentService moments;
    private final ReminderRepository reminders;

    @EventListener
    void onPaired(CouplePairedEvent e) {
        if (e.startedDatingOn() != null) {
            moments.createSystem(e.coupleId(), e.joinerId(), MomentType.ANNIVERSARY, "Ngày yêu nhau",
                    e.startedDatingOn(), null);
        }
    }

    @EventListener
    void onEnded(CoupleEndedEvent e) {
        reminders.cancelPendingByCouple(e.coupleId());
    }
}
```

- [ ] **Step 7: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest=MomentTest`
Expected: PASS (16 tests).

- [ ] **Step 8: Chạy toàn bộ test**

Run: `cd backend && ./mvnw -q test`
Expected: PASS toàn bộ.

- [ ] **Step 9: Commit**

```bash
git add backend
git commit -m "feat(moment): moments api with places, photos, reminder config and persisted reminders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Chu kỳ (ghi kỳ, dự đoán, kỷ niệm CYCLE, chia sẻ)

**Files:**
- Create: `backend/src/main/java/com/coupleapp/cycle/CycleLog.java`, `CycleLogRepository.java`, `CyclePredictor.java`, `CycleDtos.java`, `CycleService.java`, `CycleController.java`, `CycleEventsListener.java`
- Test: `backend/src/test/java/com/coupleapp/cycle/CyclePredictorTest.java`, `CycleTest.java`

**Interfaces:**
- Consumes: `CoupleAccess`, `CouplePairedEvent`, `UserSettingsChangedEvent`, `UserRepository`, `UserSettingsRepository`, `MomentRepository.findFirstByCoupleIdAndTypeAndSubjectUserId/findByTypeAndOccursOnBefore`, `MomentService.createSystem`, `ReminderScheduler.replan`.
- Produces:
  - `CyclePredictor.predict(List<LocalDate> starts, int defaultLength, LocalDate today) → Optional<Prediction(LocalDate nextStart, int averageLength, int basedOnCycles)>` — trung bình tối đa 6 khoảng gần nhất trong 15–45 ngày; không có khoảng hợp lệ → `defaultLength`; ngày dự đoán đã qua → cộng tiếp chu kỳ.
  - `CycleService.refresh(UUID userId)`, `replanFor(UUID userId)`, `refreshStale() → int`.
  - Endpoints: `GET/POST /api/cycles/logs`, `DELETE /api/cycles/logs/{id}`, `GET /api/cycles/prediction?userId=`, `PUT /api/cycles/default-length`.

- [ ] **Step 1: Viết test (fail)**

`backend/src/test/java/com/coupleapp/cycle/CyclePredictorTest.java`:
```java
package com.coupleapp.cycle;

import static org.assertj.core.api.Assertions.assertThat;

import com.coupleapp.cycle.CyclePredictor.Prediction;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class CyclePredictorTest {

    static LocalDate d(String s) {
        return LocalDate.parse(s);
    }

    @Test
    void noLogsMeansNoPrediction() {
        assertThat(CyclePredictor.predict(List.of(), 28, d("2026-01-05"))).isEmpty();
    }

    @Test
    void singleLogUsesDefaultLength() {
        Prediction p = CyclePredictor.predict(List.of(d("2026-01-01")), 28, d("2026-01-05")).orElseThrow();
        assertThat(p.nextStart()).isEqualTo(d("2026-01-29"));
        assertThat(p.averageLength()).isEqualTo(28);
        assertThat(p.basedOnCycles()).isZero();
    }

    @Test
    void averagesRecentIntervals() {
        Prediction p = CyclePredictor.predict(
                List.of(d("2026-01-01"), d("2026-03-01"), d("2026-01-31")), 28, d("2026-03-02")).orElseThrow();
        // khoảng 30 và 29 ngày → làm tròn 30
        assertThat(p.averageLength()).isEqualTo(30);
        assertThat(p.nextStart()).isEqualTo(d("2026-03-31"));
        assertThat(p.basedOnCycles()).isEqualTo(2);
    }

    @Test
    void ignoresGapsFromMissedLogging() {
        Prediction p = CyclePredictor.predict(
                List.of(d("2025-10-01"), d("2026-01-01"), d("2026-01-29")), 30, d("2026-02-01")).orElseThrow();
        assertThat(p.averageLength()).isEqualTo(28);
        assertThat(p.nextStart()).isEqualTo(d("2026-02-26"));
    }

    @Test
    void rollsForwardWhenPredictionIsInThePast() {
        Prediction p = CyclePredictor.predict(List.of(d("2026-01-01")), 28, d("2026-03-01")).orElseThrow();
        assertThat(p.nextStart()).isEqualTo(d("2026-03-26"));
    }
}
```

`backend/src/test/java/com/coupleapp/cycle/CycleTest.java`:
```java
package com.coupleapp.cycle;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CycleTest extends IntegrationTest {

    String lan;
    String minh;
    UUID lanId;
    UUID minhId;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        lanId = userId(lan);
        minhId = userId(minh);
    }

    static LocalDate today() {
        return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    void logTwoCycles(String token) throws Exception {
        post("/api/cycles/logs", token, Map.of("periodStart", today().minusDays(30).toString())).andExpect(status().isCreated());
        post("/api/cycles/logs", token, Map.of("periodStart", today().minusDays(2).toString())).andExpect(status().isCreated());
    }

    String cycleMomentId(String token) throws Exception {
        JsonNode list = read(get("/api/moments?type=CYCLE", token));
        assertThat(list.size()).isEqualTo(1);
        return list.get(0).get("id").asText();
    }

    List<String> bodies(String token, String momentId) throws Exception {
        List<String> out = new ArrayList<>();
        read(get("/api/moments/" + momentId + "/reminders", token)).forEach(n -> out.add(n.get("body").asText()));
        return out;
    }

    int pendingFor(UUID userId) {
        return jdbc.queryForObject(
                "select count(*) from reminders where recipient_id = ? and status = 'PENDING'", Integer.class, userId);
    }

    @Test
    void predictionWorksWithoutCouple() throws Exception {
        logTwoCycles(lan);
        get("/api/cycles/prediction", lan)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextStart").value(today().plusDays(26).toString()))
                .andExpect(jsonPath("$.averageLength").value(28))
                .andExpect(jsonPath("$.basedOnCycles").value(1));
        assertThat(jdbc.queryForObject("select count(*) from moments", Integer.class)).isZero();
    }

    @Test
    void partnerGetsCaringRemindersWhenShared() throws Exception {
        pair(lan, minh);
        logTwoCycles(lan);
        String id = cycleMomentId(lan);

        assertThat(bodies(minh, id)).isNotEmpty().allMatch(b -> b.contains("Lan"));
        assertThat(bodies(lan, id)).anyMatch(b -> b.startsWith("Chu kỳ dự kiến bắt đầu"));
        get("/api/cycles/prediction?userId=" + lanId, minh).andExpect(status().isOk());
    }

    @Test
    void disablingShareCycleCancelsPartnerReminders() throws Exception {
        pair(lan, minh);
        logTwoCycles(lan);
        assertThat(pendingFor(minhId)).isPositive();

        put("/api/me/settings", lan, Map.of("shareCycle", false)).andExpect(status().isOk());

        assertThat(pendingFor(minhId)).isZero();
        assertThat(pendingFor(lanId)).isPositive();
        get("/api/moments?type=CYCLE", minh).andExpect(jsonPath("$.length()").value(0));
        get("/api/cycles/prediction?userId=" + lanId, minh).andExpect(status().isNotFound());
    }

    @Test
    void partnerCannotEditCycleReminderConfig() throws Exception {
        pair(lan, minh);
        logTwoCycles(lan);
        String id = cycleMomentId(lan);

        put("/api/moments/" + id + "/reminder-config", minh, Map.of("recipients", "OWNER"))
                .andExpect(status().isForbidden());
        put("/api/moments/" + id + "/reminder-config", lan, Map.of("offsets", List.of("P3D")))
                .andExpect(status().isOk());
    }

    @Test
    void pairingAfterLoggingCreatesCycleMoment() throws Exception {
        logTwoCycles(lan);
        pair(lan, minh);
        get("/api/moments?type=CYCLE", lan)
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].occursOn").value(today().plusDays(26).toString()));
    }

    @Test
    void deletingAllLogsRemovesCycleMoment() throws Exception {
        pair(lan, minh);
        String logId = read(post("/api/cycles/logs", lan, Map.of("periodStart", today().minusDays(2).toString())))
                .get("id").asText();
        cycleMomentId(lan);

        delete("/api/cycles/logs/" + logId, lan).andExpect(status().isNoContent());
        get("/api/moments?type=CYCLE", lan).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void defaultLengthAppliesWhenNotEnoughData() throws Exception {
        post("/api/cycles/logs", lan, Map.of("periodStart", today().minusDays(2).toString()));
        put("/api/cycles/default-length", lan, Map.of("days", 30)).andExpect(status().isNoContent());
        get("/api/cycles/prediction", lan).andExpect(jsonPath("$.nextStart").value(today().plusDays(28).toString()));
        put("/api/cycles/default-length", lan, Map.of("days", 60)).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsFutureAndDuplicateStarts() throws Exception {
        post("/api/cycles/logs", lan, Map.of("periodStart", today().plusDays(1).toString()))
                .andExpect(status().isBadRequest());
        post("/api/cycles/logs", lan, Map.of("periodStart", today().toString())).andExpect(status().isCreated());
        post("/api/cycles/logs", lan, Map.of("periodStart", today().toString())).andExpect(status().isBadRequest());
    }

    @Test
    void strangerCannotSeePrediction() throws Exception {
        logTwoCycles(lan);
        get("/api/cycles/prediction?userId=" + lanId, minh).andExpect(status().isNotFound());
    }
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest='CyclePredictorTest,CycleTest'`
Expected: FAIL.

- [ ] **Step 3: Thuật toán dự đoán**

`backend/src/main/java/com/coupleapp/cycle/CyclePredictor.java`:
```java
package com.coupleapp.cycle;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public final class CyclePredictor {

    static final int MAX_INTERVALS = 6;
    static final int MIN_LENGTH = 15;
    static final int MAX_LENGTH = 45;

    private CyclePredictor() {}

    public record Prediction(LocalDate nextStart, int averageLength, int basedOnCycles) {}

    public static Optional<Prediction> predict(List<LocalDate> starts, int defaultLength, LocalDate today) {
        if (starts.isEmpty()) {
            return Optional.empty();
        }
        List<LocalDate> sorted = starts.stream().sorted(Comparator.reverseOrder()).toList();
        List<Long> lengths = new ArrayList<>();
        for (int i = 0; i + 1 < sorted.size() && lengths.size() < MAX_INTERVALS; i++) {
            long days = ChronoUnit.DAYS.between(sorted.get(i + 1), sorted.get(i));
            if (days >= MIN_LENGTH && days <= MAX_LENGTH) {
                lengths.add(days);
            }
        }
        int average = lengths.isEmpty()
                ? defaultLength
                : (int) Math.round(lengths.stream().mapToLong(Long::longValue).average().orElseThrow());
        LocalDate next = sorted.get(0).plusDays(average);
        while (next.isBefore(today)) {
            next = next.plusDays(average);
        }
        return Optional.of(new Prediction(next, average, lengths.size()));
    }
}
```

- [ ] **Step 4: Entity, DTO, service, controller, listener**

`backend/src/main/java/com/coupleapp/cycle/CycleLog.java`:
```java
package com.coupleapp.cycle;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "cycle_logs")
@Getter
@Setter
@NoArgsConstructor
public class CycleLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private Instant createdAt = Instant.now();
}
```

`backend/src/main/java/com/coupleapp/cycle/CycleLogRepository.java`:
```java
package com.coupleapp.cycle;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CycleLogRepository extends JpaRepository<CycleLog, UUID> {

    List<CycleLog> findByUserIdOrderByPeriodStartDesc(UUID userId);

    boolean existsByUserIdAndPeriodStart(UUID userId, LocalDate periodStart);
}
```

`backend/src/main/java/com/coupleapp/cycle/CycleDtos.java`:
```java
package com.coupleapp.cycle;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public final class CycleDtos {

    private CycleDtos() {}

    public record CycleLogRequest(@NotNull LocalDate periodStart, LocalDate periodEnd) {}

    public record CycleLogDto(UUID id, LocalDate periodStart, LocalDate periodEnd) {}

    public record PredictionResponse(LocalDate nextStart, int averageLength, int basedOnCycles) {}

    public record DefaultLengthRequest(@NotNull @Min(20) @Max(45) Integer days) {}
}
```

`backend/src/main/java/com/coupleapp/cycle/CycleService.java`:
```java
package com.coupleapp.cycle;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.cycle.CycleDtos.CycleLogDto;
import com.coupleapp.cycle.CycleDtos.CycleLogRequest;
import com.coupleapp.cycle.CycleDtos.PredictionResponse;
import com.coupleapp.cycle.CyclePredictor.Prediction;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentRepository;
import com.coupleapp.moment.MomentService;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.reminder.ReminderScheduler;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CycleService {

    private final CycleLogRepository logs;
    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final CoupleAccess couples;
    private final MomentRepository moments;
    private final MomentService momentService;
    private final ReminderScheduler scheduler;
    private final Clock clock;

    @Transactional
    public CycleLogDto addLog(UUID userId, CycleLogRequest r) {
        if (r.periodStart().isAfter(today(userId))) {
            throw invalid("Ngày bắt đầu không được ở tương lai");
        }
        if (r.periodEnd() != null && r.periodEnd().isBefore(r.periodStart())) {
            throw invalid("Ngày kết thúc phải sau ngày bắt đầu");
        }
        if (logs.existsByUserIdAndPeriodStart(userId, r.periodStart())) {
            throw invalid("Đã ghi kỳ bắt đầu vào ngày này");
        }
        CycleLog log = new CycleLog();
        log.setUserId(userId);
        log.setPeriodStart(r.periodStart());
        log.setPeriodEnd(r.periodEnd());
        log.setCreatedAt(clock.instant());
        logs.save(log);
        refresh(userId);
        return toDto(log);
    }

    @Transactional
    public void deleteLog(UUID userId, UUID id) {
        CycleLog log = logs.findById(id).filter(l -> l.getUserId().equals(userId)).orElseThrow(ApiException::notFound);
        logs.delete(log);
        logs.flush();
        refresh(userId);
    }

    @Transactional(readOnly = true)
    public List<CycleLogDto> logs(UUID userId) {
        return logs.findByUserIdOrderByPeriodStartDesc(userId).stream().map(CycleService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public PredictionResponse prediction(UUID viewer, UUID subject) {
        if (!viewer.equals(subject)) {
            couples.findActive(viewer).filter(c -> c.partnerId().equals(subject)).orElseThrow(ApiException::notFound);
            if (!settingsOf(subject).isShareCycle()) {
                throw ApiException.notFound();
            }
        }
        return predict(subject)
                .map(p -> new PredictionResponse(p.nextStart(), p.averageLength(), p.basedOnCycles()))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Chưa có dữ liệu chu kỳ"));
    }

    @Transactional
    public void setDefaultLength(UUID userId, int days) {
        UserSettings s = settingsOf(userId);
        s.setCycleLengthDefault(days);
        settings.save(s);
        refresh(userId);
    }

    /** Tính lại ngày dự kiến và đồng bộ kỷ niệm CYCLE của user (chỉ khi đang có cặp đôi). */
    @Transactional
    public void refresh(UUID userId) {
        Optional<CoupleContext> c = couples.findActive(userId);
        if (c.isEmpty()) {
            return;
        }
        Optional<Moment> existing =
                moments.findFirstByCoupleIdAndTypeAndSubjectUserId(c.get().coupleId(), MomentType.CYCLE, userId);
        Optional<Prediction> p = predict(userId);
        if (p.isEmpty()) {
            existing.ifPresent(moments::delete);
            return;
        }
        if (existing.isPresent()) {
            Moment m = existing.get();
            m.setOccursOn(p.get().nextStart());
            m.setUpdatedAt(clock.instant());
            scheduler.replan(m);
        } else {
            momentService.createSystem(c.get().coupleId(), userId, MomentType.CYCLE, "Chu kỳ",
                    p.get().nextStart(), userId);
        }
    }

    @Transactional
    public void replanFor(UUID userId) {
        couples.findActive(userId)
                .flatMap(c -> moments.findFirstByCoupleIdAndTypeAndSubjectUserId(c.coupleId(), MomentType.CYCLE, userId))
                .ifPresent(scheduler::replan);
    }

    /** Job hằng ngày: ngày dự kiến đã qua mà chưa ghi kỳ mới → lùi sang chu kỳ kế tiếp. */
    @Transactional
    public int refreshStale() {
        List<Moment> stale = moments.findByTypeAndOccursOnBefore(MomentType.CYCLE, LocalDate.now(clock));
        stale.forEach(m -> refresh(m.getSubjectUserId()));
        return stale.size();
    }

    private Optional<Prediction> predict(UUID userId) {
        List<LocalDate> starts = logs.findByUserIdOrderByPeriodStartDesc(userId).stream()
                .map(CycleLog::getPeriodStart).toList();
        return CyclePredictor.predict(starts, settingsOf(userId).getCycleLengthDefault(), today(userId));
    }

    private UserSettings settingsOf(UUID userId) {
        return settings.findById(userId).orElseGet(() -> new UserSettings(userId));
    }

    private LocalDate today(UUID userId) {
        ZoneId zone = users.findById(userId).map(User::zone).orElse(ZoneOffset.UTC);
        return LocalDate.now(clock.withZone(zone));
    }

    private static CycleLogDto toDto(CycleLog l) {
        return new CycleLogDto(l.getId(), l.getPeriodStart(), l.getPeriodEnd());
    }

    private static ApiException invalid(String detail) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, detail);
    }
}
```

`backend/src/main/java/com/coupleapp/cycle/CycleController.java`:
```java
package com.coupleapp.cycle;

import com.coupleapp.common.AuthUser;
import com.coupleapp.cycle.CycleDtos.CycleLogDto;
import com.coupleapp.cycle.CycleDtos.CycleLogRequest;
import com.coupleapp.cycle.CycleDtos.DefaultLengthRequest;
import com.coupleapp.cycle.CycleDtos.PredictionResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cycles")
@RequiredArgsConstructor
public class CycleController {

    private final CycleService cycles;

    @GetMapping("/logs")
    public List<CycleLogDto> logs(@AuthenticationPrincipal Jwt jwt) {
        return cycles.logs(AuthUser.id(jwt));
    }

    @PostMapping("/logs")
    @ResponseStatus(HttpStatus.CREATED)
    public CycleLogDto add(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CycleLogRequest r) {
        return cycles.addLog(AuthUser.id(jwt), r);
    }

    @DeleteMapping("/logs/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        cycles.deleteLog(AuthUser.id(jwt), id);
    }

    @GetMapping("/prediction")
    public PredictionResponse prediction(@AuthenticationPrincipal Jwt jwt,
                                         @RequestParam(required = false) UUID userId) {
        UUID me = AuthUser.id(jwt);
        return cycles.prediction(me, userId != null ? userId : me);
    }

    @PutMapping("/default-length")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void defaultLength(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DefaultLengthRequest r) {
        cycles.setDefaultLength(AuthUser.id(jwt), r.days());
    }
}
```

`backend/src/main/java/com/coupleapp/cycle/CycleEventsListener.java`:
```java
package com.coupleapp.cycle;

import com.coupleapp.couple.CouplePairedEvent;
import com.coupleapp.user.UserSettingsChangedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class CycleEventsListener {

    private final CycleService cycles;

    @EventListener
    void onSettingsChanged(UserSettingsChangedEvent e) {
        if (e.shareCycleChanged()) {
            cycles.replanFor(e.userId());
        }
    }

    @EventListener
    void onPaired(CouplePairedEvent e) {
        cycles.refresh(e.inviterId());
        cycles.refresh(e.joinerId());
    }
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest='CyclePredictorTest,CycleTest'`
Expected: PASS (14 tests).

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(cycle): cycle logs, prediction and partner-aware cycle reminders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Gửi push qua Expo (dispatcher, retry, job định kỳ, thông báo ghép đôi)

**Files:**
- Create: `backend/src/main/java/com/coupleapp/notification/PushMessage.java`, `PushResult.java`, `PushSender.java`, `ExpoPushSender.java`, `ReminderDispatcher.java`, `NotificationService.java`, `PairingNotifier.java`, `ReminderJobs.java`
- Modify: `backend/src/test/java/com/coupleapp/support/IntegrationTest.java` (thêm `@MockitoBean PushSender push`)
- Test: `backend/src/test/java/com/coupleapp/notification/ExpoPushSenderTest.java`, `NotificationTest.java`

**Interfaces:**
- Consumes: `ReminderRepository.lockDue`, `Reminder`, `DeviceTokenRepository.findByUserId`, `UserSettingsRepository`, `MomentRepository`, `UserRepository`, `CouplePairedEvent`, `ReminderScheduler.replanAllRecurring`, `CycleService.refreshStale`.
- Produces:
  - `record PushMessage(String to, String title, String body, Map<String,Object> data)` + `static PushMessage of(String to, String title, String body, String deepLink)`.
  - `record PushResult(boolean ok, String error)` + `success()`, `failure(String)`.
  - `interface PushSender { List<PushResult> send(List<PushMessage> messages); }` — kết quả cùng thứ tự với input.
  - `ReminderDispatcher.dispatchDue() → int` (số nhắc đã xử lý; `BATCH = 100`, `MAX_ATTEMPTS = 3`, backoff `5 phút × attempts`).
  - `NotificationService.sendNow(UUID userId, String title, String body, String deepLink)` (transaction riêng).

- [ ] **Step 1: Mock push trong mọi integration test**

Trong `IntegrationTest.java` thêm import `com.coupleapp.notification.PushSender`, `org.springframework.test.context.bean.override.mockito.MockitoBean` và field:
```java
    /** Không bao giờ gọi Expo thật trong test. */
    @MockitoBean protected PushSender push;
```

- [ ] **Step 2: Viết test (fail)**

`backend/src/test/java/com/coupleapp/notification/ExpoPushSenderTest.java`:
```java
package com.coupleapp.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ExpoPushSenderTest {

    static final String URL = "https://exp.host/--/api/v2/push/send";

    @Test
    void mapsTicketsToResultsInOrder() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        ExpoPushSender sender = new ExpoPushSender(builder, URL);

        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$[0].to").value("ExponentPushToken[a]"))
                .andExpect(jsonPath("$[0].data.url").value("coupleapp://moments/1"))
                .andExpect(jsonPath("$[1].sound").value("default"))
                .andRespond(withSuccess("""
                        {"data":[
                          {"status":"ok","id":"t1"},
                          {"status":"error","message":"not registered","details":{"error":"DeviceNotRegistered"}}
                        ]}""", MediaType.APPLICATION_JSON));

        List<PushResult> results = sender.send(List.of(
                PushMessage.of("ExponentPushToken[a]", "Tiêu đề", "Nội dung", "coupleapp://moments/1"),
                PushMessage.of("ExponentPushToken[b]", "Tiêu đề", "Nội dung", null)));

        assertThat(results).containsExactly(PushResult.success(), PushResult.failure("DeviceNotRegistered"));
        server.verify();
    }
}
```

`backend/src/test/java/com/coupleapp/notification/NotificationTest.java`:
```java
package com.coupleapp.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.coupleapp.moment.reminder.ReminderScheduler;
import com.coupleapp.support.IntegrationTest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class NotificationTest extends IntegrationTest {

    static final String TOKEN = "ExponentPushToken[lan]";

    @Autowired ReminderDispatcher dispatcher;
    @Autowired ReminderScheduler scheduler;

    String lan;
    String minh;
    UUID lanId;
    UUID minhId;
    UUID momentId;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        lanId = userId(lan);
        minhId = userId(minh);
        post("/api/me/devices", lan, Map.of("token", TOKEN, "platform", "android"));
        momentId = UUID.fromString(read(post("/api/moments", lan, Map.of("type", "CUSTOM", "title", "Mua hoa",
                "occursOn", LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(10).toString()))).get("id").asText());
        jdbc.update("update reminders set status = 'CANCELLED'"); // chỉ xử lý nhắc do test tự chèn
        reset(push);
    }

    UUID insertReminder(UUID recipient, String fireAtSql) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into reminders(id, couple_id, moment_id, recipient_id, fire_at, title, body, deep_link, status)
                select ?, couple_id, id, ?, %s, 'Tiêu đề', 'Nội dung', 'coupleapp://moments/x', 'PENDING'
                from moments where id = ?
                """.formatted(fireAtSql), id, recipient, momentId);
        return id;
    }

    UUID insertDue(UUID recipient) {
        return insertReminder(recipient, "now() - interval '1 minute'");
    }

    String statusOf(UUID id) {
        return jdbc.queryForObject("select status from reminders where id = ?", String.class, id);
    }

    int attemptsOf(UUID id) {
        return jdbc.queryForObject("select attempts from reminders where id = ?", Integer.class, id);
    }

    void makeDueAgain(UUID id) {
        jdbc.update("update reminders set fire_at = now() - interval '1 minute' where id = ?", id);
    }

    @Test
    void sendsDueReminder() {
        when(push.send(anyList())).thenReturn(List.of(PushResult.success()));
        UUID r = insertDue(lanId);

        assertThat(dispatcher.dispatchDue()).isEqualTo(1);

        assertThat(statusOf(r)).isEqualTo("SENT");
        verify(push).send(argThat(list -> list.size() == 1
                && list.get(0).to().equals(TOKEN)
                && list.get(0).title().equals("Tiêu đề")
                && "coupleapp://moments/x".equals(list.get(0).data().get("url"))));
    }

    @Test
    void futureRemindersAreNotSent() {
        insertReminder(lanId, "now() + interval '1 hour'");
        assertThat(dispatcher.dispatchDue()).isZero();
        verifyNoInteractions(push);
    }

    @Test
    void deadDeviceIsRemoved() {
        when(push.send(anyList())).thenReturn(List.of(PushResult.failure("DeviceNotRegistered")));
        UUID r = insertDue(lanId);

        dispatcher.dispatchDue();

        assertThat(statusOf(r)).isEqualTo("SENT");
        assertThat(jdbc.queryForObject("select count(*) from device_tokens", Integer.class)).isZero();
    }

    @Test
    void transientFailureRetriesThenFails() {
        when(push.send(anyList())).thenReturn(List.of(PushResult.failure("MessageRateExceeded")));
        UUID r = insertDue(lanId);

        dispatcher.dispatchDue();
        assertThat(statusOf(r)).isEqualTo("PENDING");
        assertThat(attemptsOf(r)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select fire_at from reminders where id = ?", Timestamp.class, r).toInstant())
                .isAfter(Instant.now());

        makeDueAgain(r);
        dispatcher.dispatchDue();
        makeDueAgain(r);
        dispatcher.dispatchDue();

        assertThat(statusOf(r)).isEqualTo("FAILED");
        assertThat(attemptsOf(r)).isEqualTo(3);
    }

    @Test
    void senderExceptionCountsAsFailedAttempt() {
        when(push.send(anyList())).thenThrow(new RuntimeException("expo down"));
        UUID r = insertDue(lanId);

        dispatcher.dispatchDue();

        assertThat(statusOf(r)).isEqualTo("PENDING");
        assertThat(attemptsOf(r)).isEqualTo(1);
    }

    @Test
    void disabledPreferenceCancelsReminder() throws Exception {
        put("/api/me/settings", lan, Map.of("notifyPrefs", Map.of("CUSTOM", false)));
        UUID r = insertDue(lanId);

        dispatcher.dispatchDue();

        assertThat(statusOf(r)).isEqualTo("CANCELLED");
        verifyNoInteractions(push);
    }

    @Test
    void recipientWithoutDeviceIsMarkedSent() {
        UUID r = insertDue(minhId);
        dispatcher.dispatchDue();
        assertThat(statusOf(r)).isEqualTo("SENT");
        verifyNoInteractions(push);
    }

    @Test
    void concurrentDispatchSendsOnce() throws Exception {
        when(push.send(anyList())).thenAnswer(inv -> {
            Thread.sleep(300);
            return List.of(PushResult.success());
        });
        insertDue(lanId);

        CompletableFuture<Integer> a = CompletableFuture.supplyAsync(dispatcher::dispatchDue);
        CompletableFuture<Integer> b = CompletableFuture.supplyAsync(dispatcher::dispatchDue);

        assertThat(a.get() + b.get()).isEqualTo(1);
        verify(push, times(1)).send(anyList());
    }

    @Test
    void pairingNotifiesInviter() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        String hung = register("hung@x.vn", "Hùng");
        post("/api/me/devices", hoa, Map.of("token", "ExponentPushToken[hoa]", "platform", "ios"));
        when(push.send(anyList())).thenReturn(List.of(PushResult.success()));

        pair(hoa, hung);

        verify(push).send(argThat(list -> list.get(0).to().equals("ExponentPushToken[hoa]")
                && list.get(0).title().equals("💞 Ghép đôi thành công")
                && list.get(0).body().contains("Hùng")));
    }

    @Test
    void dailyReplanRestoresRecurringReminders() throws Exception {
        post("/api/moments", lan, Map.of("type", "ANNIVERSARY", "title", "Ngày yêu nhau",
                "occursOn", LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(50).toString()));
        jdbc.update("update reminders set status = 'CANCELLED'");

        assertThat(scheduler.replanAllRecurring()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from reminders where status = 'PENDING'", Integer.class))
                .isPositive();
    }
}
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `cd backend && ./mvnw -q test -Dtest='ExpoPushSenderTest,NotificationTest'`
Expected: FAIL.

- [ ] **Step 4: Kiểu dữ liệu push + Expo client**

`backend/src/main/java/com/coupleapp/notification/PushMessage.java`:
```java
package com.coupleapp.notification;

import java.util.Map;

public record PushMessage(String to, String title, String body, Map<String, Object> data) {

    public static PushMessage of(String to, String title, String body, String deepLink) {
        Map<String, Object> data = deepLink == null ? Map.of() : Map.<String, Object>of("url", deepLink);
        return new PushMessage(to, title, body, data);
    }
}
```

`backend/src/main/java/com/coupleapp/notification/PushResult.java`:
```java
package com.coupleapp.notification;

/** {@code error} theo mã của Expo, vd {@code DeviceNotRegistered}. */
public record PushResult(boolean ok, String error) {

    public static PushResult success() {
        return new PushResult(true, null);
    }

    public static PushResult failure(String error) {
        return new PushResult(false, error);
    }
}
```

`backend/src/main/java/com/coupleapp/notification/PushSender.java`:
```java
package com.coupleapp.notification;

import java.util.List;

public interface PushSender {

    /** Trả kết quả theo đúng thứ tự {@code messages}. */
    List<PushResult> send(List<PushMessage> messages);
}
```

`backend/src/main/java/com/coupleapp/notification/ExpoPushSender.java`:
```java
package com.coupleapp.notification;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Expo Push API → FCM (Android) / APNs (iOS). Tối đa 100 tin mỗi request. */
@Component
public class ExpoPushSender implements PushSender {

    static final int CHUNK = 100;

    private final RestClient http;

    public ExpoPushSender(RestClient.Builder builder, @Value("${app.push.expo-url}") String url) {
        this.http = builder.baseUrl(url).build();
    }

    @Override
    public List<PushResult> send(List<PushMessage> messages) {
        List<PushResult> out = new ArrayList<>();
        for (int i = 0; i < messages.size(); i += CHUNK) {
            List<Map<String, Object>> payload = messages.subList(i, Math.min(i + CHUNK, messages.size())).stream()
                    .map(m -> Map.<String, Object>of(
                            "to", m.to(), "title", m.title(), "body", m.body(), "data", m.data(), "sound", "default"))
                    .toList();
            ExpoResponse res = http.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(ExpoResponse.class);
            if (res == null || res.data() == null || res.data().size() != payload.size()) {
                throw new IllegalStateException("Phản hồi Expo không hợp lệ");
            }
            for (ExpoTicket t : res.data()) {
                out.add("ok".equals(t.status())
                        ? PushResult.success()
                        : PushResult.failure(t.details() != null && t.details().error() != null
                                ? t.details().error() : "Unknown"));
            }
        }
        return out;
    }

    record ExpoResponse(List<ExpoTicket> data) {}

    record ExpoTicket(String status, String message, Details details) {}

    record Details(String error) {}
}
```

- [ ] **Step 5: Dispatcher, gửi ngay, job, thông báo ghép đôi**

`backend/src/main/java/com/coupleapp/notification/ReminderDispatcher.java`:
```java
package com.coupleapp.notification;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentRepository;
import com.coupleapp.moment.MomentType;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReminderDispatcher {

    public static final int BATCH = 100;
    static final int MAX_ATTEMPTS = 3;
    static final String DEVICE_NOT_REGISTERED = "DeviceNotRegistered";

    private final ReminderRepository reminders;
    private final MomentRepository moments;
    private final DeviceTokenRepository devices;
    private final UserSettingsRepository settings;
    private final PushSender push;
    private final Clock clock;

    /** Xử lý một lô nhắc đến hạn. Dòng bị khoá bởi instance khác được bỏ qua (SKIP LOCKED). */
    @Transactional
    public int dispatchDue() {
        Instant now = clock.instant();
        List<Reminder> due = reminders.lockDue(now, BATCH);
        if (due.isEmpty()) {
            return 0;
        }
        Map<UUID, MomentType> types = moments.findAllById(due.stream().map(Reminder::getMomentId).distinct().toList())
                .stream().collect(Collectors.toMap(Moment::getId, Moment::getType));
        for (Reminder r : due) {
            MomentType type = types.get(r.getMomentId());
            boolean enabled = type == null || settings.findById(r.getRecipientId())
                    .map(s -> s.notifyEnabled(type.name())).orElse(true);
            if (enabled) {
                deliver(r, now);
            } else {
                r.setStatus(ReminderStatus.CANCELLED);
            }
        }
        return due.size();
    }

    private void deliver(Reminder r, Instant now) {
        List<DeviceToken> tokens = devices.findByUserId(r.getRecipientId());
        if (tokens.isEmpty()) {
            markSent(r, now);
            return;
        }
        List<PushMessage> messages = tokens.stream()
                .map(t -> PushMessage.of(t.getExpoPushToken(), r.getTitle(), r.getBody(), r.getDeepLink()))
                .toList();
        List<PushResult> results;
        try {
            results = push.send(messages);
        } catch (RuntimeException e) {
            log.warn("Gửi push thất bại cho nhắc {}", r.getId(), e);
            results = List.of();
        }
        if (results.size() != messages.size()) {
            results = messages.stream().map(m -> PushResult.failure("Transport")).toList();
        }

        boolean anyOk = false;
        boolean allDead = true;
        for (int i = 0; i < results.size(); i++) {
            PushResult res = results.get(i);
            anyOk |= res.ok();
            boolean dead = DEVICE_NOT_REGISTERED.equals(res.error());
            allDead &= dead;
            if (dead) {
                devices.delete(tokens.get(i));
            }
        }
        if (anyOk || allDead) {
            markSent(r, now); // allDead: không còn thiết bị nào nhận được, không thử lại
            return;
        }
        r.setAttempts(r.getAttempts() + 1);
        if (r.getAttempts() >= MAX_ATTEMPTS) {
            r.setStatus(ReminderStatus.FAILED);
        } else {
            r.setFireAt(now.plus(Duration.ofMinutes(5L * r.getAttempts())));
        }
    }

    private static void markSent(Reminder r, Instant now) {
        r.setStatus(ReminderStatus.SENT);
        r.setSentAt(now);
    }
}
```

`backend/src/main/java/com/coupleapp/notification/NotificationService.java`:
```java
package com.coupleapp.notification;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Gửi push ngay (không qua bảng reminders), dùng cho sự kiện tức thời. */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final DeviceTokenRepository devices;
    private final PushSender push;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendNow(UUID userId, String title, String body, String deepLink) {
        List<DeviceToken> tokens = devices.findByUserId(userId);
        if (tokens.isEmpty()) {
            return;
        }
        List<PushMessage> messages = tokens.stream()
                .map(t -> PushMessage.of(t.getExpoPushToken(), title, body, deepLink))
                .toList();
        try {
            List<PushResult> results = push.send(messages);
            for (int i = 0; i < Math.min(results.size(), tokens.size()); i++) {
                if (ReminderDispatcher.DEVICE_NOT_REGISTERED.equals(results.get(i).error())) {
                    devices.delete(tokens.get(i));
                }
            }
        } catch (RuntimeException e) {
            log.warn("Gửi push tức thời thất bại cho {}", userId, e);
        }
    }
}
```

`backend/src/main/java/com/coupleapp/notification/PairingNotifier.java`:
```java
package com.coupleapp.notification;

import com.coupleapp.couple.CouplePairedEvent;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class PairingNotifier {

    private final NotificationService notifications;
    private final UserRepository users;

    /** Chỉ gửi khi ghép đôi đã commit thành công. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onPaired(CouplePairedEvent e) {
        String name = users.findById(e.joinerId()).map(User::getDisplayName).orElse("Người ấy");
        notifications.sendNow(e.inviterId(), "💞 Ghép đôi thành công", name + " đã ghép đôi với bạn", "coupleapp://home");
    }
}
```

`backend/src/main/java/com/coupleapp/notification/ReminderJobs.java`:
```java
package com.coupleapp.notification;

import com.coupleapp.cycle.CycleService;
import com.coupleapp.moment.reminder.ReminderScheduler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
class ReminderJobs {

    private final ReminderDispatcher dispatcher;
    private final ReminderScheduler scheduler;
    private final CycleService cycles;

    @Scheduled(fixedDelay = 60_000)
    void dispatch() {
        int processed;
        do {
            processed = dispatcher.dispatchDue();
        } while (processed == ReminderDispatcher.BATCH);
    }

    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Ho_Chi_Minh")
    void daily() {
        int cycles = this.cycles.refreshStale();
        int moments = scheduler.replanAllRecurring();
        log.info("Job hằng ngày: cập nhật {} chu kỳ, lập lại lịch {} kỷ niệm", cycles, moments);
    }
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `cd backend && ./mvnw -q test -Dtest='ExpoPushSenderTest,NotificationTest'`
Expected: PASS (11 tests).

- [ ] **Step 7: Chạy toàn bộ test**

Run: `cd backend && ./mvnw -q test`
Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "feat(notification): expo push dispatcher with retries, skip-locked batching and jobs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Kiểm tra đầu-cuối trên môi trường dev + tài liệu API

**Files:**
- Modify: `README.md` (thêm mục "API GĐ1")

**Interfaces:**
- Consumes: toàn bộ API các task trước.

- [ ] **Step 1: Chạy toàn bộ test**

Run: `cd backend && ./mvnw -q test`
Expected: `BUILD SUCCESS`.

- [ ] **Step 2: Chạy app thật với docker compose**

Run:
```bash
docker compose up -d
cd backend && (./mvnw -q spring-boot:run > /tmp/coupleapp-run.log 2>&1 &) && sleep 25
curl -s localhost:8080/actuator/health
```
Expected: `{"status":"UP"...}`.

- [ ] **Step 3: Smoke test luồng chính bằng curl**

Run:
```bash
A=$(curl -s -X POST localhost:8080/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"a@dev.vn","password":"password123","displayName":"Lan"}' | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
B=$(curl -s -X POST localhost:8080/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"b@dev.vn","password":"password123","displayName":"Minh"}' | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
CODE=$(curl -s -X POST localhost:8080/api/couples/invites -H "Authorization: Bearer $A" | sed -E 's/.*"code":"([^"]+)".*/\1/')
curl -s -X POST localhost:8080/api/couples/join -H "Authorization: Bearer $B" -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"startedDatingOn\":\"2025-02-14\"}"
curl -s "localhost:8080/api/moments?type=ANNIVERSARY" -H "Authorization: Bearer $A"
```
Expected: lệnh join trả JSON có `"partner":{"...","displayName":"Lan"}`; lệnh cuối trả mảng có kỷ niệm "Ngày yêu nhau".

- [ ] **Step 4: Dừng app, dọn dữ liệu dev**

Run:
```bash
pkill -f 'spring-boot:run' || true
docker compose down -v
```

- [ ] **Step 5: Thêm mục API vào README**

Thêm vào cuối `README.md`:
````markdown
## API GĐ1 (tóm tắt)

Mọi endpoint (trừ `/api/auth/**`) cần header `Authorization: Bearer <accessToken>`. Lỗi trả dạng RFC 7807 kèm `code`.

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `/logout` |
| Me | `GET/PATCH /api/me`, `GET/PUT /api/me/settings`, `PUT/DELETE /api/me/location`, `POST/DELETE /api/me/devices` |
| Couple | `POST /api/couples/invites`, `POST /api/couples/join`, `GET /api/couples/me`, `POST /api/couples/me/end`, `GET /api/couples/distance` |
| Media | `POST /api/media/upload-url` → PUT file lên `uploadUrl` → `POST /api/media/{id}/confirm`; `DELETE /api/media/{id}` |
| Moment | `GET/POST /api/moments`, `GET/PATCH/DELETE /api/moments/{id}`, `PUT /api/moments/{id}/reminder-config`, `GET /api/moments/{id}/reminders` |
| Cycle | `GET/POST /api/cycles/logs`, `DELETE /api/cycles/logs/{id}`, `GET /api/cycles/prediction?userId=`, `PUT /api/cycles/default-length` |
| Trait | `GET /api/traits/catalog`, `GET /api/traits/{userId}`, `POST/PATCH/DELETE /api/traits/sizes[/{id}]`, `POST/PATCH/DELETE /api/traits/preferences[/{id}]` |

Chi tiết nghiệp vụ: `docs/superpowers/specs/2026-10-10-couple-app-design.md`.
````

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document phase 1 api in readme

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Sau plan này

- Viết plan **GĐ1 Mobile** (`docs/superpowers/plans/<ngày>-phase1-mobile.md`): đăng nhập, ghép đôi, màn khoảng cách, kỷ niệm (camera + filter Skia, chọn ảnh, bản đồ chọn địa điểm), tuỳ chỉnh nhắc nhở, chu kỳ, đặc điểm đối phương, đăng ký Expo push token, danh sách gợi ý dịp tặng quà.
