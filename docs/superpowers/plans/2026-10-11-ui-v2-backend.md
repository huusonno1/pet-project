# UI v2 — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm phần backend mà giao diện v2 cần: ID người dùng + tìm & mời ghép đôi theo ID, dùng app khi chưa ghép đôi, loại kỷ niệm `MOMENT`, lặp tuần/tháng, lời nhắn, hộp thông báo, theo dõi chu kỳ tuỳ chọn. Đăng nhập mạng xã hội **không** làm ở backend.

**Architecture:** Giữ cấu trúc module theo tính năng hiện có (`com.coupleapp.*`). Một migration Flyway `V2__ui_v2.sql` tạo toàn bộ cột/bảng mới. Push tức thời đi qua `NotificationService.sendNow(...)`, hàm này đồng thời ghi hộp thông báo; các sự kiện mới (lời nhắn, lời mời, khoảnh khắc) phát `ApplicationEvent` rồi một notifier trong package `notification` gửi push sau khi commit — giống `PairingNotifier`.

**Tech Stack:** Java 21, Spring Boot 3.5.6, Spring Data JPA, Flyway, PostgreSQL 17, Redis 7, MinIO (AWS SDK v2), JUnit 5 + Testcontainers.

**Spec:** `docs/superpowers/specs/2026-10-10-couple-app-design.md` — đặc biệt **§12 (UI v2)**, ghi đè các mục tương ứng ở §4–§8. Giao diện tham chiếu: `docs/design/mock-v2/`.

## Global Constraints

- Java 21 (`export JAVA_HOME=~/.jdks/temurin-21`), Spring Boot 3.5.6, **không thêm dependency mới**.
- Migration mới là `backend/src/main/resources/db/migration/V2__ui_v2.sql`; **không sửa `V1__init.sql`**. `spring.jpa.hibernate.ddl-auto: none`.
- `couple_id` luôn lấy từ user đang đăng nhập, **không bao giờ nhận từ client**.
- Lỗi trả RFC 7807 `ProblemDetail` có trường `code`; mã mới duy nhất: `HANDLE_TAKEN` (409). Thông báo lỗi bằng tiếng Việt.
- Truy cập dữ liệu không thuộc về mình → `404` (không tiết lộ sự tồn tại).
- Test tích hợp kế thừa `com.coupleapp.support.IntegrationTest` (Testcontainers; `PushSender` đã được mock). Lệnh chạy test: `cd backend && ./mvnw -q test -Dtest=<Tên>` (cần `JAVA_HOME` ở trên).
- Mỗi task kết thúc bằng một commit; message theo kiểu `feat(backend): …`, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `handle`: `^[a-z0-9._]{3,30}$`, duy nhất không phân biệt hoa thường. Lời mời ghép đôi hết hạn sau 24 giờ. Tra ID tối đa 30 lần / 15 phút. Lời nhắn văn bản ≤ 500 ký tự.

## Review Focus

1. Người dùng có kỷ niệm riêng rồi mới ghép đôi → người ấy **không được** thấy kỷ niệm riêng đó (list, get, reminders). Test ở Task 5.
2. Lặp hằng tháng từ ngày 31 hoặc 29/02 → tháng thiếu ngày phải rơi vào ngày cuối tháng, không bị bỏ qua. Test ở Task 3.
3. Lời mời ghép đôi đã hết hạn rồi gửi lại cùng người → phải tạo được lời mời mới (unique index chỉ áp cho `PENDING`). Test ở Task 7.
4. Tắt theo dõi chu kỳ khi đang có cặp → người ấy hết thấy dự đoán và **không còn nhắc nhở chu kỳ đang chờ**. Test ở Task 8.
5. Nhắc nhở đến hạn của người **không có thiết bị nào** → vẫn phải xuất hiện trong hộp thông báo. Test ở Task 2.

---

### Task 1: Migration V2, ID người dùng, cài đặt mới

**Files:**
- Create: `backend/src/main/resources/db/migration/V2__ui_v2.sql`
- Create: `backend/src/main/java/com/coupleapp/user/Handles.java`
- Create: `backend/src/main/java/com/coupleapp/user/HandleGenerator.java`
- Modify: `backend/src/main/java/com/coupleapp/user/User.java`
- Modify: `backend/src/main/java/com/coupleapp/user/UserSettings.java`
- Modify: `backend/src/main/java/com/coupleapp/user/UserRepository.java`
- Modify: `backend/src/main/java/com/coupleapp/user/UserDtos.java`
- Modify: `backend/src/main/java/com/coupleapp/user/MeService.java`
- Modify: `backend/src/main/java/com/coupleapp/auth/AuthService.java`
- Modify: `backend/src/main/java/com/coupleapp/common/ErrorCode.java`
- Test: `backend/src/test/java/com/coupleapp/user/HandlesTest.java` (mới), `backend/src/test/java/com/coupleapp/user/MeTest.java`, `backend/src/test/java/com/coupleapp/common/SchemaTest.java`

**Interfaces:**
- Produces: `Handles.VALID` (Pattern), `Handles.base(String)`, `Handles.normalize(String)`; `UserRepository.existsByHandleIgnoreCase(String)`, `UserRepository.findByHandleIgnoreCase(String)`; `User.getHandle()`; `UserSettings.isDiscoverable()`, `UserSettings.isCycleTracking()` (+ setters); `MeResponse(id, email, displayName, handle, birthday, timezone, avatarUrl)`; `SettingsResponse(shareLocation, shareCycle, cycleLengthDefault, notifyPrefs, discoverable, cycleTracking)`; `ErrorCode.HANDLE_TAKEN`. Bảng `love_notes`, `notifications`, `pair_requests` tồn tại (dùng ở Task 2, 6, 7).

- [ ] **Step 1: Viết test đơn vị cho `Handles`**

`backend/src/test/java/com/coupleapp/user/HandlesTest.java`:

```java
package com.coupleapp.user;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HandlesTest {

    @Test
    void baseStripsDiacriticsAndSymbols() {
        assertThat(Handles.base("Đức Anh")).isEqualTo("ducanh");
        assertThat(Handles.base("Nguyễn Thị Lan!")).isEqualTo("nguyenthilan");
        assertThat(Handles.base("A")).isEqualTo("user");
        assertThat(Handles.base("abcdefghijklmnopqrstuvwxyz")).hasSize(20);
    }

    @Test
    void normalizeDropsAtSignAndLowercases() {
        assertThat(Handles.normalize(" @Lan.2001 ")).isEqualTo("lan.2001");
    }

    @Test
    void validAcceptsOnlyLowercaseDigitsDotUnderscore() {
        assertThat(Handles.VALID.matcher("lan.2001").matches()).isTrue();
        assertThat(Handles.VALID.matcher("ab").matches()).isFalse();
        assertThat(Handles.VALID.matcher("Lan").matches()).isFalse();
        assertThat(Handles.VALID.matcher("lan-01").matches()).isFalse();
    }
}
```

- [ ] **Step 2: Thêm test tích hợp vào `MeTest`**

Thêm vào cuối class `MeTest` (dùng email riêng để không đụng `@BeforeEach` sẵn có); thêm import `static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath` và `java.util.Map` nếu chưa có:

```java
    @Test
    void registrationGeneratesHandleFromDisplayName() throws Exception {
        String t = register("duc.h@x.vn", "Đức Anh");
        String handle = read(get("/api/me", t).andExpect(status().isOk())).get("handle").asText();
        assertThat(handle).matches("^ducanh\\d{4}$");
    }

    @Test
    void handleCanBeChangedAndIsUniqueIgnoringCase() throws Exception {
        String lan = register("lan.h@x.vn", "Lan");
        String minh = register("minh.h@x.vn", "Minh");
        patch("/api/me", lan, Map.of("handle", "@Lan.2001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.handle").value("lan.2001"));
        patch("/api/me", minh, Map.of("handle", "LAN.2001"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HANDLE_TAKEN"));
        patch("/api/me", minh, Map.of("handle", "ab")).andExpect(status().isBadRequest());
        patch("/api/me", lan, Map.of("handle", "lan.2001")).andExpect(status().isOk());
    }

    @Test
    void settingsExposeDiscoverableAndCycleTracking() throws Exception {
        String t = register("sa.h@x.vn", "Sa");
        get("/api/me/settings", t)
                .andExpect(jsonPath("$.discoverable").value(true))
                .andExpect(jsonPath("$.cycleTracking").value(false));
        put("/api/me/settings", t, Map.of("discoverable", false, "cycleTracking", true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.discoverable").value(false))
                .andExpect(jsonPath("$.cycleTracking").value(true));
    }
```

- [ ] **Step 3: Cập nhật `SchemaTest`**

`users.handle` sẽ là `NOT NULL`, nên sửa helper `insertUser` và thêm 2 test:

```java
    @Test
    void uiV2TablesExist() {
        List<String> tables = jdbc.queryForList(
                "select tablename from pg_tables where schemaname = 'public'", String.class);
        assertThat(tables).contains("love_notes", "notifications", "pair_requests");
    }

    @Test
    void handleIsUniqueIgnoringCase() {
        insertUser("a@x.vn", "lan.2001");
        assertThatThrownBy(() -> insertUser("b@x.vn", "LAN.2001")).isInstanceOf(DataIntegrityViolationException.class);
    }

    private UUID insertUser(String email) {
        return insertUser(email, "u" + UUID.randomUUID().toString().substring(0, 8));
    }

    private UUID insertUser(String email, String handle) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into users(id, email, password_hash, display_name, handle) values (?, ?, 'h', 'U', ?)",
                id, email, handle);
        return id;
    }
```

(Xoá helper `insertUser(String email)` cũ, thay bằng 2 helper trên.)

- [ ] **Step 4: Chạy test để thấy lỗi**

Run: `cd backend && ./mvnw -q test -Dtest='HandlesTest,MeTest,SchemaTest'`
Expected: FAIL — `HandlesTest` không biên dịch được ("cannot find symbol Handles").

- [ ] **Step 5: Viết migration `V2__ui_v2.sql`**

```sql
-- ===== ID người dùng & cài đặt =====
ALTER TABLE users ADD COLUMN handle text;
UPDATE users SET handle = 'user' || substr(replace(id::text, '-', ''), 1, 8);
ALTER TABLE users ALTER COLUMN handle SET NOT NULL;
CREATE UNIQUE INDEX ux_users_handle ON users (lower(handle));

ALTER TABLE user_settings ADD COLUMN discoverable   boolean NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN cycle_tracking boolean NOT NULL DEFAULT false;
UPDATE user_settings s SET cycle_tracking = true
WHERE EXISTS (SELECT 1 FROM cycle_logs l WHERE l.user_id = s.user_id);

-- ===== Kỷ niệm: loại MOMENT, lặp tuần/tháng, kỷ niệm riêng =====
ALTER TABLE moments ALTER COLUMN couple_id DROP NOT NULL;
ALTER TABLE moments DROP CONSTRAINT moments_type_check;
ALTER TABLE moments ADD CONSTRAINT moments_type_check
    CHECK (type IN ('ANNIVERSARY', 'DATE_PLAN', 'GIFT_OCCASION', 'CYCLE', 'CUSTOM', 'MOMENT'));
ALTER TABLE moments DROP CONSTRAINT moments_recurrence_check;
ALTER TABLE moments ADD CONSTRAINT moments_recurrence_check
    CHECK (recurrence IN ('NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'));
-- Kỷ niệm riêng (chưa ghép đôi): chỉ MOMENT/CUSTOM, không gắn địa điểm
ALTER TABLE moments ADD CONSTRAINT moments_personal_check
    CHECK (couple_id IS NOT NULL OR (type IN ('MOMENT', 'CUSTOM') AND place_id IS NULL));
CREATE INDEX ix_moments_personal ON moments (created_by, occurs_on) WHERE couple_id IS NULL;

ALTER TABLE reminders ALTER COLUMN couple_id DROP NOT NULL;

-- ===== Ảnh cho món yêu thích =====
ALTER TABLE preferences ADD COLUMN image_media_id uuid REFERENCES media (id) ON DELETE SET NULL;

-- ===== Lời nhắn =====
CREATE TABLE love_notes (
    id                uuid PRIMARY KEY,
    couple_id         uuid        NOT NULL REFERENCES couples (id),
    author_id         uuid        NOT NULL REFERENCES users (id),
    kind              text        NOT NULL CHECK (kind IN ('TEXT', 'DRAWING')),
    text              text,
    drawing_media_id  uuid REFERENCES media (id) ON DELETE CASCADE,
    seen_at           timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind = 'TEXT' AND text IS NOT NULL) OR (kind = 'DRAWING' AND drawing_media_id IS NOT NULL))
);
CREATE INDEX ix_love_notes_couple ON love_notes (couple_id, created_at DESC);

-- ===== Hộp thông báo =====
CREATE TABLE notifications (
    id          uuid PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind        text        NOT NULL,
    title       text        NOT NULL,
    body        text        NOT NULL,
    deep_link   text,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX ix_notifications_unread ON notifications (user_id) WHERE read_at IS NULL;

-- ===== Lời mời ghép đôi theo ID =====
CREATE TABLE pair_requests (
    id            uuid PRIMARY KEY,
    requester_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status        text        NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL,
    responded_at  timestamptz,
    CHECK (requester_id <> target_id)
);
CREATE UNIQUE INDEX ux_pair_requests_pending ON pair_requests (requester_id, target_id) WHERE status = 'PENDING';
CREATE INDEX ix_pair_requests_target ON pair_requests (target_id) WHERE status = 'PENDING';
```

- [ ] **Step 6: Viết `Handles` và `HandleGenerator`**

`backend/src/main/java/com/coupleapp/user/Handles.java`:

```java
package com.coupleapp.user;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

public final class Handles {

    public static final Pattern VALID = Pattern.compile("^[a-z0-9._]{3,30}$");

    private Handles() {}

    /** "Đức Anh" → "ducanh"; ngắn hơn 3 ký tự → "user"; dài quá cắt còn 20. */
    public static String base(String displayName) {
        String s = Normalizer.normalize(displayName.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
        if (s.length() > 20) {
            s = s.substring(0, 20);
        }
        return s.length() < 3 ? "user" : s;
    }

    /** " @Lan.2001 " → "lan.2001". */
    public static String normalize(String raw) {
        String s = raw.trim();
        if (s.startsWith("@")) {
            s = s.substring(1);
        }
        return s.toLowerCase(Locale.ROOT);
    }
}
```

`backend/src/main/java/com/coupleapp/user/HandleGenerator.java`:

```java
package com.coupleapp.user;

import java.security.SecureRandom;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Sinh ID mặc định "<tên không dấu><4 số>" chưa ai dùng. */
@Component
@RequiredArgsConstructor
public class HandleGenerator {

    private final UserRepository users;
    private final SecureRandom random = new SecureRandom();

    public String generate(String displayName) {
        String base = Handles.base(displayName);
        for (int i = 0; i < 20; i++) {
            String candidate = base + "%04d".formatted(random.nextInt(10_000));
            if (!users.existsByHandleIgnoreCase(candidate)) {
                return candidate;
            }
        }
        byte[] bytes = new byte[4];
        random.nextBytes(bytes);
        return base + HexFormat.of().formatHex(bytes);
    }
}
```

- [ ] **Step 7: Cập nhật entity, repository, DTO, lỗi**

`User.java` — thêm trường sau `displayName`:

```java
    private String handle;
```

`UserSettings.java` — thêm sau `cycleLengthDefault`:

```java
    private boolean discoverable = true;
    private boolean cycleTracking = false;
```

`UserRepository.java` — thêm:

```java
    boolean existsByHandleIgnoreCase(String handle);

    Optional<User> findByHandleIgnoreCase(String handle);
```

`ErrorCode.java` — thêm sau `EMAIL_TAKEN(HttpStatus.CONFLICT),`:

```java
    HANDLE_TAKEN(HttpStatus.CONFLICT),
```

`UserDtos.java` — thay các record tương ứng:

```java
    public record MeResponse(
            UUID id, String email, String displayName, String handle, LocalDate birthday, String timezone,
            String avatarUrl) {}

    public record UpdateMeRequest(
            @Size(min = 1, max = 50) String displayName,
            @Size(max = 40) String handle,
            @Past LocalDate birthday,
            @Size(max = 64) String timezone,
            UUID avatarMediaId) {}

    public record SettingsResponse(
            boolean shareLocation, boolean shareCycle, int cycleLengthDefault, Map<String, Boolean> notifyPrefs,
            boolean discoverable, boolean cycleTracking) {}

    public record UpdateSettingsRequest(
            Boolean shareLocation, Boolean shareCycle, Map<String, Boolean> notifyPrefs,
            Boolean discoverable, Boolean cycleTracking) {}
```

- [ ] **Step 8: Cập nhật `AuthService.register` và `MeService`**

`AuthService`: thêm field `private final HandleGenerator handles;` và trong `register`, ngay sau `u.setDisplayName(r.displayName().trim());`:

```java
        u.setHandle(handles.generate(u.getDisplayName()));
```

`MeService.update` — thêm khối sau khối `displayName` (thêm import `org.springframework.dao.DataIntegrityViolationException`):

```java
        if (r.handle() != null) {
            String h = Handles.normalize(r.handle());
            if (!Handles.VALID.matcher(h).matches()) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED,
                        "ID chỉ gồm chữ thường, số, dấu chấm, gạch dưới (3–30 ký tự)");
            }
            if (!h.equalsIgnoreCase(u.getHandle()) && users.existsByHandleIgnoreCase(h)) {
                throw handleTaken();
            }
            u.setHandle(h);
        }
```

và ngay trước `return toResponse(u);` của `update`:

```java
        try {
            users.flush();
        } catch (DataIntegrityViolationException e) {
            throw handleTaken();
        }
```

thêm helper:

```java
    private static ApiException handleTaken() {
        return new ApiException(ErrorCode.HANDLE_TAKEN, "ID này đã có người dùng");
    }
```

`MeService.updateSettings` — thêm sau khối `shareCycle`:

```java
        if (r.discoverable() != null) {
            s.setDiscoverable(r.discoverable());
        }
        if (r.cycleTracking() != null) {
            s.setCycleTracking(r.cycleTracking());
        }
```

`MeService.toResponse(User u)`:

```java
        return new MeResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getHandle(), u.getBirthday(),
                u.getTimezone(), avatarUrl);
```

`MeService.toResponse(UserSettings s)`:

```java
        return new SettingsResponse(
                s.isShareLocation(), s.isShareCycle(), s.getCycleLengthDefault(), Map.copyOf(s.getNotifyPrefs()),
                s.isDiscoverable(), s.isCycleTracking());
```

- [ ] **Step 9: Tìm và sửa mọi chỗ khác chèn `users` bằng SQL hoặc gọi `new MeResponse(`/`new SettingsResponse(`**

Run: `cd backend && grep -rn "insert into users\|new MeResponse(\|new SettingsResponse(" src/`
Expected: chỉ còn các chỗ đã sửa ở Step 3 và Step 8. Chỗ nào khác chèn `users` thì thêm cột `handle` giống Step 3.

- [ ] **Step 10: Chạy test**

Run: `cd backend && ./mvnw -q test -Dtest='HandlesTest,MeTest,SchemaTest,AuthTest'`
Expected: PASS.

- [ ] **Step 11: Chạy toàn bộ test backend**

Run: `cd backend && ./mvnw -q test`
Expected: PASS (109 test cũ + test mới).

- [ ] **Step 12: Commit**

```bash
git add backend/src
git commit -m "feat(backend): handle người dùng, cài đặt discoverable/cycleTracking, migration UI v2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Hộp thông báo

**Files:**
- Create: `backend/src/main/java/com/coupleapp/notification/InboxItem.java`
- Create: `backend/src/main/java/com/coupleapp/notification/InboxRepository.java`
- Create: `backend/src/main/java/com/coupleapp/notification/InboxService.java`
- Create: `backend/src/main/java/com/coupleapp/notification/InboxController.java`
- Create: `backend/src/main/java/com/coupleapp/notification/InboxDtos.java`
- Modify: `backend/src/main/java/com/coupleapp/notification/NotificationService.java`
- Modify: `backend/src/main/java/com/coupleapp/notification/ReminderDispatcher.java`
- Modify: `backend/src/main/java/com/coupleapp/notification/PairingNotifier.java`
- Test: `backend/src/test/java/com/coupleapp/notification/InboxTest.java` (mới)

**Interfaces:**
- Consumes: bảng `notifications` (Task 1).
- Produces: `NotificationService.sendNow(UUID userId, String kind, String title, String body, String deepLink)` — **thay chữ ký cũ 4 tham số**; luôn ghi hộp thông báo rồi mới push. `InboxService.record(UUID userId, String kind, String title, String body, String deepLink)`. API: `GET /api/notifications?limit=`, `GET /api/notifications/unread-count` → `{"count": n}`, `POST /api/notifications/{id}/read` (204), `POST /api/notifications/read-all` (204). `kind` dùng các giá trị: `REMINDER`, `PAIRED`, `LOVE_NOTE`, `PAIR_REQUEST`, `MOMENT`.

- [ ] **Step 1: Viết test**

`backend/src/test/java/com/coupleapp/notification/InboxTest.java`:

```java
package com.coupleapp.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class InboxTest extends IntegrationTest {

    @Autowired ReminderDispatcher dispatcher;

    String lan;
    String minh;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        pair(lan, minh); // lan là người mời → nhận thông báo PAIRED
    }

    @Test
    void pairingIsRecordedForInviterOnly() throws Exception {
        JsonNode items = read(get("/api/notifications", lan).andExpect(status().isOk()));
        assertThat(items).hasSize(1);
        assertThat(items.get(0).get("kind").asText()).isEqualTo("PAIRED");
        assertThat(items.get(0).get("readAt").isNull()).isTrue();
        get("/api/notifications/unread-count", lan).andExpect(jsonPath("$.count").value(1));
        assertThat(read(get("/api/notifications", minh))).isEmpty();
    }

    @Test
    void dueReminderIsRecordedEvenWithoutDevices() throws Exception {
        String today10 = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(10).toString();
        String id = read(post("/api/moments", minh, Map.of("type", "CUSTOM", "title", "Mua hoa", "occursOn", today10))
                .andExpect(status().isCreated())).get("id").asText();
        jdbc.update("update reminders set fire_at = now() - interval '1 minute' where moment_id = ?::uuid", id);

        dispatcher.dispatchDue();

        JsonNode items = read(get("/api/notifications", minh).andExpect(status().isOk()));
        assertThat(items).hasSize(2); // mặc định CUSTOM: trước 1 ngày + đúng ngày
        items.forEach(n -> assertThat(n.get("kind").asText()).isEqualTo("REMINDER"));
        assertThat(items.get(0).get("deepLink").asText()).isEqualTo("coupleapp://moments/" + id);
    }

    @Test
    void markReadAndReadAll() throws Exception {
        String itemId = read(get("/api/notifications", lan)).get(0).get("id").asText();
        post("/api/notifications/" + itemId + "/read", minh, null).andExpect(status().isNotFound());
        post("/api/notifications/" + itemId + "/read", lan, null).andExpect(status().isNoContent());
        get("/api/notifications/unread-count", lan).andExpect(jsonPath("$.count").value(0));

        jdbc.update("update notifications set read_at = null");
        post("/api/notifications/read-all", lan, null).andExpect(status().isNoContent());
        get("/api/notifications/unread-count", lan).andExpect(jsonPath("$.count").value(0));
    }
}
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `cd backend && ./mvnw -q test -Dtest=InboxTest`
Expected: FAIL — `GET /api/notifications` trả 404/401 (chưa có endpoint).

- [ ] **Step 3: Entity, repository, DTO**

`InboxItem.java`:

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
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class InboxItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;
    private String kind;
    private String title;
    private String body;
    private String deepLink;
    private Instant readAt;
    private Instant createdAt;
}
```

`InboxRepository.java`:

```java
package com.coupleapp.notification;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface InboxRepository extends JpaRepository<InboxItem, UUID> {

    List<InboxItem> findByUserIdOrderByCreatedAtDesc(UUID userId, Limit limit);

    long countByUserIdAndReadAtIsNull(UUID userId);

    Optional<InboxItem> findByIdAndUserId(UUID id, UUID userId);

    @Modifying
    @Query("update InboxItem i set i.readAt = :now where i.userId = :userId and i.readAt is null")
    int markAllRead(UUID userId, Instant now);
}
```

`InboxDtos.java`:

```java
package com.coupleapp.notification;

import java.time.Instant;
import java.util.UUID;

public final class InboxDtos {

    private InboxDtos() {}

    public record InboxDto(UUID id, String kind, String title, String body, String deepLink, Instant readAt,
                           Instant createdAt) {}

    public record UnreadCount(long count) {}
}
```

- [ ] **Step 4: Service và controller**

`InboxService.java`:

```java
package com.coupleapp.notification;

import com.coupleapp.common.ApiException;
import com.coupleapp.notification.InboxDtos.InboxDto;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InboxService {

    static final int MAX_LIMIT = 100;

    private final InboxRepository items;
    private final Clock clock;

    @Transactional
    public void record(UUID userId, String kind, String title, String body, String deepLink) {
        InboxItem i = new InboxItem();
        i.setUserId(userId);
        i.setKind(kind);
        i.setTitle(title);
        i.setBody(body);
        i.setDeepLink(deepLink);
        i.setCreatedAt(clock.instant());
        items.save(i);
    }

    @Transactional(readOnly = true)
    public List<InboxDto> list(UUID userId, int limit) {
        int n = Math.max(1, Math.min(MAX_LIMIT, limit));
        return items.findByUserIdOrderByCreatedAtDesc(userId, Limit.of(n)).stream()
                .map(i -> new InboxDto(i.getId(), i.getKind(), i.getTitle(), i.getBody(), i.getDeepLink(),
                        i.getReadAt(), i.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public long unread(UUID userId) {
        return items.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public void markRead(UUID userId, UUID id) {
        InboxItem i = items.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
        if (i.getReadAt() == null) {
            i.setReadAt(clock.instant());
        }
    }

    @Transactional
    public void markAllRead(UUID userId) {
        items.markAllRead(userId, clock.instant());
    }
}
```

`InboxController.java`:

```java
package com.coupleapp.notification;

import com.coupleapp.common.AuthUser;
import com.coupleapp.notification.InboxDtos.InboxDto;
import com.coupleapp.notification.InboxDtos.UnreadCount;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class InboxController {

    private final InboxService inbox;

    @GetMapping
    public List<InboxDto> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "50") int limit) {
        return inbox.list(AuthUser.id(jwt), limit);
    }

    @GetMapping("/unread-count")
    public UnreadCount unread(@AuthenticationPrincipal Jwt jwt) {
        return new UnreadCount(inbox.unread(AuthUser.id(jwt)));
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        inbox.markRead(AuthUser.id(jwt), id);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void readAll(@AuthenticationPrincipal Jwt jwt) {
        inbox.markAllRead(AuthUser.id(jwt));
    }
}
```

- [ ] **Step 5: Ghi hộp thông báo khi gửi push**

`NotificationService` — thêm field `private final InboxService inbox;`, đổi chữ ký và ghi trước khi push:

```java
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendNow(UUID userId, String kind, String title, String body, String deepLink) {
        inbox.record(userId, kind, title, body, deepLink);
        List<DeviceToken> tokens = devices.findByUserId(userId);
        if (tokens.isEmpty()) {
            return;
        }
        // … phần còn lại giữ nguyên
    }
```

`PairingNotifier.onPaired`:

```java
        notifications.sendNow(e.inviterId(), "PAIRED", "💞 Ghép đôi thành công", name + " đã ghép đôi với bạn",
                "coupleapp://home");
```

`ReminderDispatcher` — thêm field `private final InboxService inbox;`; đổi `markSent` từ `static` thành phương thức thường và ghi hộp thông báo:

```java
    private void markSent(Reminder r, Instant now) {
        r.setStatus(ReminderStatus.SENT);
        r.setSentAt(now);
        inbox.record(r.getRecipientId(), "REMINDER", r.getTitle(), r.getBody(), r.getDeepLink());
    }
```

- [ ] **Step 6: Sửa mọi lời gọi `sendNow` cũ**

Run: `cd backend && grep -rn "sendNow(" src/`
Expected: chỉ còn lời gọi 5 tham số (sửa test nào còn gọi kiểu cũ, ví dụ `NotificationTest`, sang thêm tham số `kind`).

- [ ] **Step 7: Chạy test**

Run: `cd backend && ./mvnw -q test -Dtest='InboxTest,NotificationTest,CoupleTest'`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(backend): hộp thông báo cho mọi push đã gửi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lặp hằng tuần / hằng tháng

**Files:**
- Modify: `backend/src/main/java/com/coupleapp/moment/Recurrence.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/reminder/Occurrences.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/handler/CustomHandler.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/handler/DatePlanHandler.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/MomentService.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/MomentRepository.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/reminder/ReminderScheduler.java`
- Test: `backend/src/test/java/com/coupleapp/moment/reminder/OccurrencesTest.java` (mới), `backend/src/test/java/com/coupleapp/moment/MomentTest.java`

**Interfaces:**
- Produces: `Recurrence { NONE, WEEKLY, MONTHLY, YEARLY }`; `Occurrences.recurring(Moment, LocalDate from, LocalDate to)`; `MomentService.normalizeRecurrence(MomentType, Recurrence)` (static, package-private) — Task 4 thêm nhánh `MOMENT`; `MomentRepository.findRecurring(Collection<MomentType>, Collection<Recurrence>)`.

- [ ] **Step 1: Viết test đơn vị `OccurrencesTest`**

```java
package com.coupleapp.moment.reminder;

import static org.assertj.core.api.Assertions.assertThat;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.Recurrence;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class OccurrencesTest {

    static Moment moment(LocalDate on, Recurrence r) {
        Moment m = new Moment();
        m.setTitle("T");
        m.setOccursOn(on);
        m.setRecurrence(r);
        return m;
    }

    static List<LocalDate> dates(List<Occurrence> list) {
        return list.stream().map(Occurrence::date).toList();
    }

    @Test
    void weeklyRepeatsOnSameWeekday() {
        Moment m = moment(LocalDate.of(2026, 10, 2), Recurrence.WEEKLY);
        assertThat(dates(Occurrences.recurring(m, LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 31))))
                .containsExactly(LocalDate.of(2026, 10, 16), LocalDate.of(2026, 10, 23), LocalDate.of(2026, 10, 30));
    }

    @Test
    void monthlyFromThe31stFallsBackToMonthEnd() {
        Moment m = moment(LocalDate.of(2026, 1, 31), Recurrence.MONTHLY);
        assertThat(dates(Occurrences.recurring(m, LocalDate.of(2026, 2, 1), LocalDate.of(2026, 4, 30))))
                .containsExactly(LocalDate.of(2026, 2, 28), LocalDate.of(2026, 3, 31), LocalDate.of(2026, 4, 30));
    }

    @Test
    void monthlyFromLeapDay() {
        Moment m = moment(LocalDate.of(2028, 2, 29), Recurrence.MONTHLY);
        assertThat(dates(Occurrences.recurring(m, LocalDate.of(2028, 3, 1), LocalDate.of(2028, 4, 30))))
                .containsExactly(LocalDate.of(2028, 3, 29), LocalDate.of(2028, 4, 29));
    }

    @Test
    void weeklyShiftsTimeOfDayWithTheDate() {
        Moment m = moment(LocalDate.of(2026, 10, 2), Recurrence.WEEKLY);
        m.setOccursAt(Instant.parse("2026-10-02T12:00:00Z"));
        Occurrence third = Occurrences.recurring(m, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31)).get(2);
        assertThat(third.at()).isEqualTo(Instant.parse("2026-10-16T12:00:00Z"));
    }

    @Test
    void noneIsSingleOccurrence() {
        Moment m = moment(LocalDate.of(2026, 10, 2), Recurrence.NONE);
        assertThat(dates(Occurrences.recurring(m, LocalDate.of(2026, 10, 1), LocalDate.of(2027, 10, 1))))
                .containsExactly(LocalDate.of(2026, 10, 2));
    }
}
```

- [ ] **Step 2: Thêm test tích hợp vào `MomentTest`**

```java
    @Test
    void weeklyCustomMomentPlansRemindersEveryWeek() throws Exception {
        String id = create(lan, Map.of("type", "CUSTOM", "title", "Gọi video tối thứ 6",
                "occursOn", today().plusDays(1).toString(), "recurrence", "WEEKLY"));
        put("/api/moments/" + id + "/reminder-config", lan, Map.of("offsets", List.of("P0D")))
                .andExpect(status().isOk());
        assertThat(reminders(lan, id).size()).isBetween(55, 60); // 400 ngày ≈ 57 tuần
    }

    @Test
    void onlyCustomAndDatePlanMayRepeatWeeklyOrMonthly() throws Exception {
        post("/api/moments", lan, Map.of("type", "ANNIVERSARY", "title", "Yêu",
                "occursOn", today().minusDays(10).toString(), "recurrence", "MONTHLY"))
                .andExpect(status().isBadRequest());
        post("/api/moments", lan, Map.of("type", "GIFT_OCCASION", "title", "Sinh nhật",
                "occursOn", today().plusDays(10).toString(), "recurrence", "WEEKLY",
                "subjectUserId", minhId.toString(), "details", Map.of("occasion", "BIRTHDAY")))
                .andExpect(status().isBadRequest());
    }
```

- [ ] **Step 3: Chạy test để thấy lỗi**

Run: `cd backend && ./mvnw -q test -Dtest='OccurrencesTest,MomentTest'`
Expected: FAIL — `OccurrencesTest` không biên dịch ("cannot find symbol WEEKLY / recurring").

- [ ] **Step 4: Mở rộng `Recurrence` và `Occurrences`**

`Recurrence.java`:

```java
package com.coupleapp.moment;

public enum Recurrence { NONE, WEEKLY, MONTHLY, YEARLY }
```

`Occurrences.java` — thêm (import `java.time.Instant`, `java.time.temporal.ChronoUnit`, `java.util.function.LongFunction`):

```java
    /** Theo {@code recurrence} của kỷ niệm. MONTHLY tính từ ngày gốc nên 31 → 28/30/31 đúng từng tháng. */
    public static List<Occurrence> recurring(Moment m, LocalDate from, LocalDate to) {
        return switch (m.getRecurrence()) {
            case NONE -> single(m, from, to);
            case YEARLY -> yearly(m, from, to);
            case WEEKLY -> stepped(m, from, to, k -> m.getOccursOn().plusWeeks(k));
            case MONTHLY -> stepped(m, from, to, k -> m.getOccursOn().plusMonths(k));
        };
    }

    private static List<Occurrence> stepped(Moment m, LocalDate from, LocalDate to, LongFunction<LocalDate> nth) {
        List<Occurrence> out = new ArrayList<>();
        for (long k = 0; ; k++) {
            LocalDate d = nth.apply(k);
            if (d.isAfter(to)) {
                return out;
            }
            if (!d.isBefore(from)) {
                out.add(new Occurrence(d, shiftedAt(m, d), m.getTitle()));
            }
        }
    }

    private static Instant shiftedAt(Moment m, LocalDate d) {
        if (m.getOccursAt() == null) {
            return null;
        }
        return m.getOccursAt().plus(Duration.ofDays(ChronoUnit.DAYS.between(m.getOccursOn(), d)));
    }
```

- [ ] **Step 5: Handler dùng `recurring`**

`CustomHandler.occurrences` và `DatePlanHandler.occurrences` đều thành:

```java
        return Occurrences.recurring(m, from, to);
```

(Xoá import `Recurrence` không còn dùng trong `CustomHandler`.)

- [ ] **Step 6: Chuẩn hoá & kiểm tra recurrence trong `MomentService`**

Thêm phương thức:

```java
    /** WEEKLY/MONTHLY chỉ cho CUSTOM và DATE_PLAN; GIFT_OCCASION mặc định YEARLY. */
    static Recurrence normalizeRecurrence(MomentType type, Recurrence requested) {
        Recurrence r = requested != null ? requested
                : type == MomentType.GIFT_OCCASION ? Recurrence.YEARLY : Recurrence.NONE;
        boolean repeating = r == Recurrence.WEEKLY || r == Recurrence.MONTHLY;
        if (repeating && type != MomentType.CUSTOM && type != MomentType.DATE_PLAN) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Chỉ kỷ niệm tự do và lịch hẹn mới lặp theo tuần/tháng");
        }
        return r;
    }
```

Trong `create`, thay khối `m.setRecurrence(...)` bằng:

```java
        m.setRecurrence(normalizeRecurrence(r.type(), r.recurrence()));
```

Trong `update`, thay `if (r.recurrence() != null) m.setRecurrence(r.recurrence());` bằng:

```java
        if (r.recurrence() != null) m.setRecurrence(normalizeRecurrence(m.getType(), r.recurrence()));
```

- [ ] **Step 7: Job hằng ngày phủ cả tuần/tháng**

`MomentRepository`:

```java
    @Query("select m from Moment m where m.type in :types or m.recurrence in :recurrences")
    List<Moment> findRecurring(Collection<MomentType> types, Collection<Recurrence> recurrences);
```

`ReminderScheduler.replanAllRecurring`:

```java
        List<Moment> recurring = moments.findRecurring(
                EnumSet.of(MomentType.ANNIVERSARY, MomentType.GIFT_OCCASION, MomentType.CYCLE),
                EnumSet.of(Recurrence.WEEKLY, Recurrence.MONTHLY, Recurrence.YEARLY));
```

- [ ] **Step 8: Chạy test**

Run: `cd backend && ./mvnw -q test -Dtest='OccurrencesTest,MomentTest,ReminderPlannerTest'`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src
git commit -m "feat(backend): kỷ niệm lặp hằng tuần và hằng tháng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Loại kỷ niệm `MOMENT` (Khoảnh khắc)

**Files:**
- Modify: `backend/src/main/java/com/coupleapp/moment/MomentType.java`
- Create: `backend/src/main/java/com/coupleapp/moment/handler/MomentHandler.java`
- Create: `backend/src/main/java/com/coupleapp/moment/MomentCapturedEvent.java`
- Create: `backend/src/main/java/com/coupleapp/notification/MomentNotifier.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/MomentDtos.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/MomentService.java`
- Test: `backend/src/test/java/com/coupleapp/moment/MomentTypeMomentTest.java` (mới)

**Interfaces:**
- Consumes: `NotificationService.sendNow(userId, kind, title, body, deepLink)` (Task 2); `MomentService.normalizeRecurrence` (Task 3).
- Produces: `MomentType.MOMENT`; `MomentHandler.MOODS` (Set<String>), `MomentHandler.moodLabel(String)`; `CreateMomentRequest` có thêm thành phần cuối `Boolean notifyPartner`; `MomentCapturedEvent(UUID momentId, UUID authorId, UUID partnerId, String mood)`.

- [ ] **Step 1: Viết test**

`backend/src/test/java/com/coupleapp/moment/MomentTypeMomentTest.java`:

```java
package com.coupleapp.moment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MomentTypeMomentTest extends IntegrationTest {

    String lan;
    String minh;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
    }

    static String today() {
        return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).toString();
    }

    List<String> kinds(String token) throws Exception {
        JsonNode items = read(get("/api/notifications", token).andExpect(status().isOk()));
        return StreamSupport.stream(items.spliterator(), false).map(n -> n.get("kind").asText()).toList();
    }

    @Test
    void momentWithMoodAndPhotosHasNoRemindersAndNotifiesPartner() throws Exception {
        UUID p1 = uploadImage(lan);
        UUID p2 = uploadImage(lan);
        JsonNode m = read(post("/api/moments", lan, Map.of(
                "type", "MOMENT", "title", "Đi ngang quán cà phê cũ", "occursOn", today(),
                "details", Map.of("mood", "MISSING"), "mediaIds", List.of(p1, p2), "notifyPartner", true))
                .andExpect(status().isCreated()));
        assertThat(m.get("media")).hasSize(2);
        assertThat(m.get("recurrence").asText()).isEqualTo("NONE");

        String id = m.get("id").asText();
        assertThat(read(get("/api/moments/" + id + "/reminders", lan))).isEmpty();
        assertThat(read(get("/api/moments/" + id + "/reminders", minh))).isEmpty();

        JsonNode notes = read(get("/api/notifications", minh));
        assertThat(notes.get(0).get("kind").asText()).isEqualTo("MOMENT");
        assertThat(notes.get(0).get("body").asText()).isEqualTo("Lan vừa lưu một khoảnh khắc nhớ nhung");
        assertThat(notes.get(0).get("deepLink").asText()).isEqualTo("coupleapp://moments/" + id);
    }

    @Test
    void withoutNotifyPartnerNothingIsSent() throws Exception {
        post("/api/moments", lan, Map.of("type", "MOMENT", "title", "Bình yên", "occursOn", today()))
                .andExpect(status().isCreated());
        assertThat(kinds(minh)).doesNotContain("MOMENT");
    }

    @Test
    void invalidMoodAndReminderConfigAreRejected() throws Exception {
        post("/api/moments", lan, Map.of("type", "MOMENT", "title", "X", "occursOn", today(),
                "details", Map.of("mood", "ANGRY")))
                .andExpect(status().isBadRequest());
        String id = read(post("/api/moments", lan, Map.of("type", "MOMENT", "title", "X", "occursOn", today()))
                .andExpect(status().isCreated())).get("id").asText();
        put("/api/moments/" + id + "/reminder-config", lan, Map.of("offsets", List.of("P1D")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `cd backend && ./mvnw -q test -Dtest=MomentTypeMomentTest`
Expected: FAIL — tạo `MOMENT` trả 400 (không parse được enum).

- [ ] **Step 3: Enum, handler, event**

`MomentType.java`:

```java
package com.coupleapp.moment;

public enum MomentType { ANNIVERSARY, DATE_PLAN, GIFT_OCCASION, CYCLE, CUSTOM, MOMENT }
```

`MomentHandler.java`:

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
import com.coupleapp.moment.reminder.PlanningContext;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.Role;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Khoảnh khắc: lưu vào Nhật ký, không nhắc, không lặp. */
@Component
public class MomentHandler implements MomentTypeHandler {

    public static final Set<String> MOODS = Set.of("MISSING", "HAPPY", "PEACEFUL", "GRATEFUL", "SAD", "OTHER");

    private static final Map<String, String> LABELS = Map.of(
            "MISSING", "nhớ nhung", "HAPPY", "hạnh phúc", "PEACEFUL", "bình yên",
            "GRATEFUL", "biết ơn", "SAD", "buồn một chút");

    @Override
    public MomentType type() {
        return MomentType.MOMENT;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of(), "08:00", Audience.OWNER);
    }

    @Override
    public void validate(Moment m) {
        Object mood = m.getDetails().get("mood");
        if (mood != null && !MOODS.contains(mood.toString())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Cảm xúc không hợp lệ");
        }
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return List.of();
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        throw new IllegalStateException("Khoảnh khắc không có nhắc nhở");
    }

    /** "MISSING" → "nhớ nhung"; không có / OTHER → chuỗi rỗng. */
    public static String moodLabel(String code) {
        return code == null ? "" : LABELS.getOrDefault(code, "");
    }
}
```

`MomentCapturedEvent.java`:

```java
package com.coupleapp.moment;

import java.util.UUID;

public record MomentCapturedEvent(UUID momentId, UUID authorId, UUID partnerId, String mood) {}
```

- [ ] **Step 4: DTO & service**

`MomentDtos.CreateMomentRequest` — thêm thành phần cuối:

```java
            @Size(max = 30) List<UUID> mediaIds,
            Boolean notifyPartner) {}
```

`MomentService`:
- thêm field `private final ApplicationEventPublisher events;` (import `org.springframework.context.ApplicationEventPublisher`);
- thay `normalizeRecurrence` (Task 3) để `MOMENT` luôn là `NONE`:

```java
    static Recurrence normalizeRecurrence(MomentType type, Recurrence requested) {
        Recurrence r = requested != null ? requested
                : type == MomentType.GIFT_OCCASION ? Recurrence.YEARLY : Recurrence.NONE;
        boolean repeating = r == Recurrence.WEEKLY || r == Recurrence.MONTHLY;
        if (repeating && type != MomentType.CUSTOM && type != MomentType.DATE_PLAN) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Chỉ kỷ niệm tự do và lịch hẹn mới lặp theo tuần/tháng");
        }
        return type == MomentType.MOMENT ? Recurrence.NONE : r;
    }
```

- cuối `create`, trước `return toResponse(m);`:

```java
        if (m.getType() == MomentType.MOMENT && Boolean.TRUE.equals(r.notifyPartner())) {
            Object mood = m.getDetails().get("mood");
            events.publishEvent(new MomentCapturedEvent(m.getId(), userId, c.partnerId(),
                    mood == null ? null : mood.toString()));
        }
```

- đầu `setReminderConfig`, sau khi `loadEditable`:

```java
        if (m.getType() == MomentType.MOMENT) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Khoảnh khắc không có nhắc nhở");
        }
```

- [ ] **Step 5: Notifier**

`MomentNotifier.java`:

```java
package com.coupleapp.notification;

import com.coupleapp.moment.MomentCapturedEvent;
import com.coupleapp.moment.handler.MomentHandler;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class MomentNotifier {

    private final NotificationService notifications;
    private final UserRepository users;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onCaptured(MomentCapturedEvent e) {
        String name = users.findById(e.authorId()).map(User::getDisplayName).orElse("Người ấy");
        String label = MomentHandler.moodLabel(e.mood());
        String body = name + " vừa lưu một khoảnh khắc " + (label.isEmpty() ? "mới" : label);
        notifications.sendNow(e.partnerId(), "MOMENT", "💗 Khoảnh khắc mới", body,
                "coupleapp://moments/" + e.momentId());
    }
}
```

- [ ] **Step 6: Chạy test**

Run: `cd backend && ./mvnw -q test -Dtest='MomentTypeMomentTest,MomentTest'`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "feat(backend): loại kỷ niệm MOMENT với cảm xúc và báo cho người ấy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dùng app khi chưa ghép đôi (kỷ niệm & ảnh riêng)

**Files:**
- Modify: `backend/src/main/java/com/coupleapp/media/MediaService.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/MomentService.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/MomentRepository.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/MomentDtos.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/reminder/ReminderScheduler.java`
- Modify: `backend/src/main/java/com/coupleapp/moment/reminder/ReminderPlanner.java`
- Test: `backend/src/test/java/com/coupleapp/moment/PersonalMomentTest.java` (mới)

**Interfaces:**
- Consumes: `MomentService.normalizeRecurrence` (Task 3, 4).
- Produces: `MediaService.requireUsable(List<UUID> ids, UUID coupleId, UUID userId)` — `coupleId == null` nghĩa là ảnh riêng của `userId` (**thay chữ ký cũ 2 tham số**); `MomentResponse` có thêm thành phần cuối `boolean personal`; `MomentRepository.findByCoupleIdIsNullAndCreatedByOrderByOccursOnAsc(UUID)`.

- [ ] **Step 1: Viết test**

`backend/src/test/java/com/coupleapp/moment/PersonalMomentTest.java`:

```java
package com.coupleapp.moment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PersonalMomentTest extends IntegrationTest {

    String lan;
    UUID lanId;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        lanId = userId(lan);
    }

    static LocalDate today() {
        return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    @Test
    void unpairedUserKeepsPersonalMomentsWithPhotos() throws Exception {
        UUID photo = uploadImage(lan);
        post("/api/moments", lan, Map.of("type", "MOMENT", "title", "Hoàng hôn Hồ Tây",
                "occursOn", today().toString(), "details", Map.of("mood", "PEACEFUL"), "mediaIds", List.of(photo)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.personal").value(true))
                .andExpect(jsonPath("$.media.length()").value(1));
        assertThat(read(get("/api/moments", lan).andExpect(status().isOk()))).hasSize(1);
    }

    @Test
    void personalCustomReminderOnlyGoesToSelf() throws Exception {
        String id = read(post("/api/moments", lan, Map.of("type", "CUSTOM", "title", "Sinh nhật mẹ",
                "occursOn", today().plusDays(10).toString(), "recurrence", "YEARLY"))
                .andExpect(status().isCreated())).get("id").asText();
        put("/api/moments/" + id + "/reminder-config", lan, Map.of("recipients", "BOTH")).andExpect(status().isOk());
        assertThat(read(get("/api/moments/" + id + "/reminders", lan))).hasSize(2);
        assertThat(jdbc.queryForObject("select count(*) from reminders where recipient_id <> ?", Integer.class, lanId))
                .isZero();
    }

    @Test
    void coupleOnlyTypesAndPlacesNeedAPartner() throws Exception {
        post("/api/moments", lan, Map.of("type", "ANNIVERSARY", "title", "Yêu",
                "occursOn", today().minusDays(5).toString()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));
        post("/api/moments", lan, Map.of("type", "MOMENT", "title", "Cà phê", "occursOn", today().toString(),
                "place", Map.of("name", "Cộng", "lat", 21.03, "lng", 105.85)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void personalMomentsStayPrivateAfterPairing() throws Exception {
        String id = read(post("/api/moments", lan, Map.of("type", "MOMENT", "title", "Riêng",
                "occursOn", today().toString())).andExpect(status().isCreated())).get("id").asText();
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        String shared = read(post("/api/moments", minh, Map.of("type", "MOMENT", "title", "Chung",
                "occursOn", today().toString())).andExpect(status().isCreated())).get("id").asText();

        JsonNode minhList = read(get("/api/moments", minh));
        assertThat(minhList).hasSize(1);
        assertThat(minhList.get(0).get("id").asText()).isEqualTo(shared);
        get("/api/moments/" + id, minh).andExpect(status().isNotFound());
        get("/api/moments/" + id + "/reminders", minh).andExpect(status().isNotFound());

        JsonNode lanList = read(get("/api/moments", lan));
        assertThat(lanList).hasSize(2);
        get("/api/moments/" + id, lan).andExpect(jsonPath("$.personal").value(true));
        get("/api/moments/" + shared, lan).andExpect(jsonPath("$.personal").value(false));
    }
}
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `cd backend && ./mvnw -q test -Dtest=PersonalMomentTest`
Expected: FAIL — `uploadImage` trả 409 `COUPLE_REQUIRED`.

- [ ] **Step 3: Ảnh riêng khi chưa ghép đôi (`MediaService`)**

Trong `createUpload`, thay nhánh `else { … }` bằng:

```java
        } else {
            ZonedDateTime t = now.atZone(ZoneOffset.UTC);
            UUID coupleId = couples.findActive(userId).map(CoupleContext::coupleId).orElse(null);
            m.setCoupleId(coupleId);
            m.setObjectKey(coupleId != null
                    ? "couples/%s/%d/%02d/%s.%s".formatted(coupleId, t.getYear(), t.getMonthValue(), m.getId(), ext)
                    : "users/%s/moments/%d/%02d/%s.%s".formatted(userId, t.getYear(), t.getMonthValue(), m.getId(), ext));
        }
```

(import `com.coupleapp.couple.CoupleContext`.) Thay `requireUsable`:

```java
    /** Ảnh phải READY, không trùng; coupleId != null → thuộc cặp đôi đó; null → ảnh riêng do userId tải lên. */
    @Transactional(readOnly = true)
    public void requireUsable(List<UUID> ids, UUID coupleId, UUID userId) {
        if (ids.isEmpty()) {
            return;
        }
        if (new HashSet<>(ids).size() != ids.size()) {
            throw invalid("Danh sách ảnh bị trùng");
        }
        List<Media> found = media.findAllById(ids);
        boolean ok = found.size() == ids.size() && found.stream().allMatch(m -> m.getStatus() == MediaStatus.READY
                && (coupleId != null
                        ? coupleId.equals(m.getCoupleId())
                        : m.getCoupleId() == null && m.getUploaderId().equals(userId)));
        if (!ok) {
            throw invalid("Ảnh không hợp lệ");
        }
    }
```

Run: `cd backend && grep -rn "requireUsable(" src/main` — sửa mọi lời gọi sang 3 tham số (lời gọi trong `MomentService` sửa ở Step 4).

- [ ] **Step 4: `MomentService` hỗ trợ kỷ niệm riêng**

`MomentRepository` — thêm:

```java
    List<Moment> findByCoupleIdIsNullAndCreatedByOrderByOccursOnAsc(UUID createdBy);
```

`MomentDtos.MomentResponse` — thêm thành phần cuối `boolean personal`:

```java
            PlaceDto place, List<MediaDto> media, UUID createdBy, Instant createdAt, Instant updatedAt,
            boolean personal) {}
```

Trong `MomentService` (thêm import `java.util.Comparator`, `java.util.Optional`, `java.util.stream.Stream`):

1. `create` — thay `CoupleContext c = couples.requireActive(userId);` bằng:

```java
        Optional<CoupleContext> active = couples.findActive(userId);
        CoupleContext c = active.orElse(null);
        if (c == null) {
            requirePersonalAllowed(r.type(), r.subjectUserId(), userId, r.place(), r.placeId());
        }
```

   và trong thân `create`: `m.setCoupleId(c != null ? c.coupleId() : null);`, `m.setSubjectUserId(c != null ? checkSubject(c, r.subjectUserId()) : null);`, `applyPlace(m, c, userId, r.place(), r.placeId());`, `applyMedia(m, c, userId, r.mediaIds());`, còn điều kiện publish `MomentCapturedEvent` thêm `c != null &&`.

2. Thêm helper:

```java
    private static final Set<MomentType> PERSONAL_TYPES = EnumSet.of(MomentType.MOMENT, MomentType.CUSTOM);

    private static void requirePersonalAllowed(MomentType type, UUID subject, UUID userId,
                                               PlaceInput place, UUID placeId) {
        if (!PERSONAL_TYPES.contains(type)) {
            throw new ApiException(ErrorCode.COUPLE_REQUIRED, "Loại kỷ niệm này cần ghép đôi");
        }
        if (subject != null && !subject.equals(userId)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Kỷ niệm riêng chỉ nói về chính bạn");
        }
        if (place != null || placeId != null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Cần ghép đôi để gắn địa điểm");
        }
    }
```

   (import `java.util.EnumSet`, `java.util.Set`.)

3. Thay việc nạp kỷ niệm: bỏ `loadVisible(CoupleContext, UUID)` / `loadEditable(CoupleContext, UUID)` cũ, thay bằng:

```java
    private Moment loadVisible(UUID userId, UUID id) {
        Moment m = moments.findById(id).orElseThrow(ApiException::notFound);
        if (m.getCoupleId() == null) {
            if (!m.getCreatedBy().equals(userId)) throw ApiException.notFound();
            return m;
        }
        CoupleContext c = couples.findActive(userId).orElseThrow(ApiException::notFound);
        if (!m.getCoupleId().equals(c.coupleId()) || !visible(m, userId)) throw ApiException.notFound();
        return m;
    }

    private Moment loadEditable(UUID userId, UUID id) {
        Moment m = loadVisible(userId, id);
        if (m.getType() == MomentType.CYCLE && !userId.equals(m.getSubjectUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Chỉ chủ thể được sửa dữ liệu chu kỳ");
        }
        return m;
    }
```

4. `update`: thay `CoupleContext c = couples.requireActive(userId); Moment m = loadEditable(c, id);` bằng:

```java
        Moment m = loadEditable(userId, id);
        CoupleContext c = m.getCoupleId() == null ? null : couples.requireActive(userId);
        if (c == null) {
            requirePersonalAllowed(m.getType(), r.subjectUserId(), userId, r.place(), r.placeId());
        }
```

   rồi `if (r.subjectUserId() != null && c != null) m.setSubjectUserId(checkSubject(c, r.subjectUserId()));`, `applyPlace(m, c, userId, r.place(), r.placeId());`, `if (r.mediaIds() != null) applyMedia(m, c, userId, r.mediaIds());`.

5. `setReminderConfig`, `delete`, `get`, `upcomingReminders`: dùng `loadEditable(userId, id)` / `loadVisible(userId, id)` thay cho `couples.requireActive(...)` + hàm cũ.

6. `list`:

```java
    @Transactional(readOnly = true)
    public List<MomentResponse> list(UUID userId, MomentType type, LocalDate from, LocalDate to) {
        Stream<Moment> shared = couples.findActive(userId)
                .map(c -> moments.findByCoupleIdOrderByOccursOnAsc(c.coupleId()).stream()
                        .filter(m -> visible(m, userId)))
                .orElseGet(Stream::empty);
        Stream<Moment> personal = moments.findByCoupleIdIsNullAndCreatedByOrderByOccursOnAsc(userId).stream();
        return Stream.concat(shared, personal)
                .filter(m -> type == null || m.getType() == type)
                .filter(m -> from == null || !m.getOccursOn().isBefore(from))
                .filter(m -> to == null || !m.getOccursOn().isAfter(to))
                .sorted(Comparator.comparing(Moment::getOccursOn))
                .map(this::toResponse)
                .toList();
    }
```

7. `applyPlace` và `applyMedia` nhận `CoupleContext c` có thể null:

```java
    private void applyPlace(Moment m, CoupleContext c, UUID userId, PlaceInput place, UUID placeId) {
        if (c == null) {
            return; // requirePersonalAllowed đã chặn địa điểm cho kỷ niệm riêng
        }
        if (place != null) {
            m.setPlaceId(places.create(c.coupleId(), userId, place).getId());
        } else if (placeId != null) {
            m.setPlaceId(places.require(placeId, c.coupleId()).getId());
        }
    }

    private void applyMedia(Moment m, CoupleContext c, UUID userId, List<UUID> ids) {
        List<UUID> list = ids != null ? ids : List.of();
        media.requireUsable(list, c != null ? c.coupleId() : null, userId);
        m.getMediaIds().clear();
        m.getMediaIds().addAll(list);
    }
```

8. `toResponse` thêm `m.getCoupleId() == null` vào cuối lời gọi constructor `MomentResponse`.

- [ ] **Step 5: Lập lịch nhắc cho kỷ niệm riêng**

`ReminderPlanner.plan` — trong vòng lặp `for (Role role : audience.roles())`, ngay sau khi tính `recipient`:

```java
                    if (recipient == null) {
                        continue; // kỷ niệm riêng: không có người ấy
                    }
```

`ReminderScheduler.replan` — tách phần lưu và thêm nhánh riêng:

```java
    @Transactional
    public void replan(Moment m) {
        reminders.cancelPendingByMoment(m.getId());
        Instant now = clock.instant();
        if (m.getCoupleId() == null) {
            User owner = users.findById(m.getCreatedBy()).orElseThrow();
            PlanningContext ctx = new PlanningContext(owner.getId(), null, owner.getDisplayName(), null,
                    owner.zone(), owner.zone(), false, now, now.plus(HORIZON));
            save(m, planner.plan(m, handler(m.getType()), ctx), now);
            return;
        }
        Optional<CoupleContext> active = couples.findActive(m.ownerId())
                .filter(c -> c.coupleId().equals(m.getCoupleId()));
        if (active.isEmpty()) {
            return;
        }
        CoupleContext c = active.get();
        User owner = users.findById(c.userId()).orElseThrow();
        User partner = users.findById(c.partnerId()).orElseThrow();
        boolean cycleShared = settings.findById(owner.getId()).map(UserSettings::isShareCycle).orElse(true);
        PlanningContext ctx = new PlanningContext(owner.getId(), partner.getId(), owner.getDisplayName(),
                partner.getDisplayName(), owner.zone(), partner.zone(), cycleShared, now, now.plus(HORIZON));
        save(m, planner.plan(m, handler(m.getType()), ctx), now);
    }

    private void save(Moment m, List<ReminderPlan> plans, Instant now) {
        for (ReminderPlan p : plans) {
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
```

- [ ] **Step 6: Chạy test**

Run: `cd backend && ./mvnw -q test -Dtest='PersonalMomentTest,MomentTest,MomentTypeMomentTest,MediaTest,ReminderPlannerTest'`
Expected: PASS. Nếu `MediaTest` có test "upload khi chưa ghép đôi → 409" thì đổi kỳ vọng thành `201` với key bắt đầu `users/` (đúng theo spec §12.2).

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "feat(backend): kỷ niệm và ảnh riêng khi chưa ghép đôi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Lời nhắn (love notes)

**Files:**
- Create: `backend/src/main/java/com/coupleapp/lovenote/LoveNote.java`
- Create: `backend/src/main/java/com/coupleapp/lovenote/LoveNoteKind.java`
- Create: `backend/src/main/java/com/coupleapp/lovenote/LoveNoteRepository.java`
- Create: `backend/src/main/java/com/coupleapp/lovenote/LoveNoteDtos.java`
- Create: `backend/src/main/java/com/coupleapp/lovenote/LoveNoteSentEvent.java`
- Create: `backend/src/main/java/com/coupleapp/lovenote/LoveNoteService.java`
- Create: `backend/src/main/java/com/coupleapp/lovenote/LoveNoteController.java`
- Create: `backend/src/main/java/com/coupleapp/notification/LoveNoteNotifier.java`
- Test: `backend/src/test/java/com/coupleapp/lovenote/LoveNoteTest.java` (mới)

**Interfaces:**
- Consumes: `NotificationService.sendNow` (Task 2); `MediaService.requireUsable(ids, coupleId, userId)` (Task 5); `MediaService.dtos(List<UUID>)`.
- Produces: `POST /api/love-notes` → `LoveNoteDto(id, authorId, kind, text, drawing: MediaDto|null, seenAt, createdAt)`; `GET /api/love-notes?before=&limit=`; `POST /api/love-notes/{id}/seen`; `GET /api/love-notes/latest` (200 hoặc 204).

- [ ] **Step 1: Viết test**

```java
package com.coupleapp.lovenote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LoveNoteTest extends IntegrationTest {

    String lan;
    String minh;
    UUID lanId;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        lanId = userId(lan);
    }

    String send(String token, String text) throws Exception {
        return read(post("/api/love-notes", token, Map.of("kind", "TEXT", "text", text))
                .andExpect(status().isCreated())).get("id").asText();
    }

    @Test
    void textNoteReachesPartnerAndInbox() throws Exception {
        String id = send(lan, "Tối nay gọi video nha");

        JsonNode list = read(get("/api/love-notes", minh).andExpect(status().isOk()));
        assertThat(list).hasSize(1);
        assertThat(list.get(0).get("authorId").asText()).isEqualTo(lanId.toString());
        get("/api/love-notes/latest", minh).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        get("/api/love-notes/latest", lan).andExpect(status().isNoContent());

        JsonNode inbox = read(get("/api/notifications", minh));
        assertThat(inbox.get(0).get("kind").asText()).isEqualTo("LOVE_NOTE");
        assertThat(inbox.get(0).get("body").asText()).isEqualTo("Tối nay gọi video nha");
        assertThat(inbox.get(0).get("deepLink").asText()).isEqualTo("coupleapp://notes");
    }

    @Test
    void onlyRecipientMarksSeen() throws Exception {
        String id = send(lan, "Nhớ anh");
        post("/api/love-notes/" + id + "/seen", lan, null).andExpect(status().isNotFound());
        post("/api/love-notes/" + id + "/seen", minh, null).andExpect(status().isNoContent());
        assertThat(read(get("/api/love-notes", lan)).get(0).get("seenAt").isNull()).isFalse();
    }

    @Test
    void drawingNeedsCouplePhoto() throws Exception {
        UUID photo = uploadImage(lan);
        post("/api/love-notes", lan, Map.of("kind", "DRAWING", "drawingMediaId", photo.toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.drawing.url").isNotEmpty());
        post("/api/love-notes", lan, Map.of("kind", "DRAWING")).andExpect(status().isBadRequest());
        post("/api/love-notes", lan, Map.of("kind", "TEXT", "text", "   ")).andExpect(status().isBadRequest());
    }

    @Test
    void paginatesNewestFirst() throws Exception {
        send(lan, "1");
        send(lan, "2");
        send(lan, "3");
        JsonNode page = read(get("/api/love-notes?limit=2", minh));
        assertThat(page).hasSize(2);
        assertThat(page.get(0).get("text").asText()).isEqualTo("3");
        String before = page.get(1).get("createdAt").asText();
        JsonNode next = read(get("/api/love-notes?limit=2&before=" + before, minh));
        assertThat(next).hasSize(1);
        assertThat(next.get(0).get("text").asText()).isEqualTo("1");
    }

    @Test
    void otherCouplesAndUnpairedUsersSeeNothing() throws Exception {
        send(lan, "Riêng tư");
        String a = register("a@x.vn", "A");
        String b = register("b@x.vn", "B");
        pair(a, b);
        assertThat(read(get("/api/love-notes", a))).isEmpty();
        String solo = register("solo@x.vn", "Solo");
        get("/api/love-notes", solo).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));
    }
}
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `cd backend && ./mvnw -q test -Dtest=LoveNoteTest`
Expected: FAIL — `POST /api/love-notes` trả 404.

- [ ] **Step 3: Entity, enum, repository, event, DTO**

`LoveNoteKind.java`:

```java
package com.coupleapp.lovenote;

public enum LoveNoteKind { TEXT, DRAWING }
```

`LoveNote.java`:

```java
package com.coupleapp.lovenote;

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
@Table(name = "love_notes")
@Getter
@Setter
@NoArgsConstructor
public class LoveNote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID coupleId;
    private UUID authorId;

    @Enumerated(EnumType.STRING)
    private LoveNoteKind kind;

    private String text;
    private UUID drawingMediaId;
    private Instant seenAt;
    private Instant createdAt;
}
```

`LoveNoteRepository.java`:

```java
package com.coupleapp.lovenote;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoveNoteRepository extends JpaRepository<LoveNote, UUID> {

    List<LoveNote> findByCoupleIdAndCreatedAtBeforeOrderByCreatedAtDesc(UUID coupleId, Instant before, Limit limit);

    Optional<LoveNote> findFirstByCoupleIdAndAuthorIdOrderByCreatedAtDesc(UUID coupleId, UUID authorId);
}
```

`LoveNoteSentEvent.java`:

```java
package com.coupleapp.lovenote;

import java.util.UUID;

/** {@code preview}: nội dung chữ, null nếu chỉ có hình vẽ. */
public record LoveNoteSentEvent(UUID noteId, UUID authorId, UUID recipientId, String preview) {}
```

`LoveNoteDtos.java`:

```java
package com.coupleapp.lovenote;

import com.coupleapp.media.MediaDtos.MediaDto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class LoveNoteDtos {

    private LoveNoteDtos() {}

    public record SendNoteRequest(@NotNull LoveNoteKind kind, @Size(max = 500) String text, UUID drawingMediaId) {}

    public record LoveNoteDto(UUID id, UUID authorId, LoveNoteKind kind, String text, MediaDto drawing,
                              Instant seenAt, Instant createdAt) {}
}
```

- [ ] **Step 4: Service & controller**

`LoveNoteService.java`:

```java
package com.coupleapp.lovenote;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.lovenote.LoveNoteDtos.LoveNoteDto;
import com.coupleapp.lovenote.LoveNoteDtos.SendNoteRequest;
import com.coupleapp.media.MediaService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LoveNoteService {

    static final int MAX_LIMIT = 50;

    private final LoveNoteRepository notes;
    private final CoupleAccess couples;
    private final MediaService media;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional
    public LoveNoteDto send(UUID userId, SendNoteRequest r) {
        CoupleContext c = couples.requireActive(userId);
        String text = r.text() == null || r.text().isBlank() ? null : r.text().trim();
        LoveNote n = new LoveNote();
        n.setCoupleId(c.coupleId());
        n.setAuthorId(userId);
        n.setKind(r.kind());
        if (r.kind() == LoveNoteKind.TEXT) {
            if (text == null) {
                throw invalid("Lời nhắn đang trống");
            }
        } else {
            if (r.drawingMediaId() == null) {
                throw invalid("Thiếu hình vẽ");
            }
            media.requireUsable(List.of(r.drawingMediaId()), c.coupleId(), userId);
            n.setDrawingMediaId(r.drawingMediaId());
        }
        n.setText(text);
        n.setCreatedAt(clock.instant());
        notes.save(n);
        events.publishEvent(new LoveNoteSentEvent(n.getId(), userId, c.partnerId(), text));
        return toDto(n);
    }

    @Transactional(readOnly = true)
    public List<LoveNoteDto> list(UUID userId, Instant before, int limit) {
        CoupleContext c = couples.requireActive(userId);
        int n = Math.max(1, Math.min(MAX_LIMIT, limit));
        Instant cursor = before != null ? before : clock.instant().plusSeconds(60);
        return notes.findByCoupleIdAndCreatedAtBeforeOrderByCreatedAtDesc(c.coupleId(), cursor, Limit.of(n))
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public void markSeen(UUID userId, UUID id) {
        CoupleContext c = couples.requireActive(userId);
        LoveNote n = notes.findById(id)
                .filter(x -> x.getCoupleId().equals(c.coupleId()) && !x.getAuthorId().equals(userId))
                .orElseThrow(ApiException::notFound);
        if (n.getSeenAt() == null) {
            n.setSeenAt(clock.instant());
        }
    }

    /** Lời nhắn mới nhất người ấy gửi cho mình. */
    @Transactional(readOnly = true)
    public Optional<LoveNoteDto> latestFromPartner(UUID userId) {
        CoupleContext c = couples.requireActive(userId);
        return notes.findFirstByCoupleIdAndAuthorIdOrderByCreatedAtDesc(c.coupleId(), c.partnerId()).map(this::toDto);
    }

    private LoveNoteDto toDto(LoveNote n) {
        var drawing = n.getDrawingMediaId() == null ? null
                : media.dtos(List.of(n.getDrawingMediaId())).stream().findFirst().orElse(null);
        return new LoveNoteDto(n.getId(), n.getAuthorId(), n.getKind(), n.getText(), drawing, n.getSeenAt(),
                n.getCreatedAt());
    }

    private static ApiException invalid(String detail) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, detail);
    }
}
```

`LoveNoteController.java`:

```java
package com.coupleapp.lovenote;

import com.coupleapp.common.AuthUser;
import com.coupleapp.lovenote.LoveNoteDtos.LoveNoteDto;
import com.coupleapp.lovenote.LoveNoteDtos.SendNoteRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/love-notes")
@RequiredArgsConstructor
public class LoveNoteController {

    private final LoveNoteService notes;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LoveNoteDto send(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SendNoteRequest r) {
        return notes.send(AuthUser.id(jwt), r);
    }

    @GetMapping
    public List<LoveNoteDto> list(@AuthenticationPrincipal Jwt jwt,
                                  @RequestParam(required = false) Instant before,
                                  @RequestParam(defaultValue = "30") int limit) {
        return notes.list(AuthUser.id(jwt), before, limit);
    }

    @PostMapping("/{id}/seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void seen(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        notes.markSeen(AuthUser.id(jwt), id);
    }

    @GetMapping("/latest")
    public ResponseEntity<LoveNoteDto> latest(@AuthenticationPrincipal Jwt jwt) {
        return notes.latestFromPartner(AuthUser.id(jwt))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
```

- [ ] **Step 5: Notifier**

`LoveNoteNotifier.java`:

```java
package com.coupleapp.notification;

import com.coupleapp.lovenote.LoveNoteSentEvent;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class LoveNoteNotifier {

    private final NotificationService notifications;
    private final UserRepository users;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onSent(LoveNoteSentEvent e) {
        String name = users.findById(e.authorId()).map(User::getDisplayName).orElse("Người ấy");
        String body = e.preview() != null ? e.preview() : "Một hình vẽ tay cho bạn";
        notifications.sendNow(e.recipientId(), "LOVE_NOTE", "💌 " + name + " gửi lời nhắn", body, "coupleapp://notes");
    }
}
```

- [ ] **Step 6: Chạy test**

Run: `cd backend && ./mvnw -q test -Dtest=LoveNoteTest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "feat(backend): lời nhắn giữa hai người kèm push và hộp thông báo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tìm theo ID & lời mời ghép đôi

**Files:**
- Create: `backend/src/main/java/com/coupleapp/user/UserDirectory.java`
- Create: `backend/src/main/java/com/coupleapp/user/UserLookupController.java`
- Create: `backend/src/main/java/com/coupleapp/couple/PairRequest.java`
- Create: `backend/src/main/java/com/coupleapp/couple/PairRequestStatus.java`
- Create: `backend/src/main/java/com/coupleapp/couple/PairRequestRepository.java`
- Create: `backend/src/main/java/com/coupleapp/couple/PairRequestService.java`
- Create: `backend/src/main/java/com/coupleapp/couple/PairRequestController.java`
- Create: `backend/src/main/java/com/coupleapp/couple/PairRequestCleanup.java`
- Create: `backend/src/main/java/com/coupleapp/couple/PairRequestedEvent.java`
- Create: `backend/src/main/java/com/coupleapp/notification/PairRequestNotifier.java`
- Modify: `backend/src/main/java/com/coupleapp/user/UserDtos.java`
- Modify: `backend/src/main/java/com/coupleapp/couple/CoupleDtos.java`
- Modify: `backend/src/main/java/com/coupleapp/couple/CoupleService.java`
- Test: `backend/src/test/java/com/coupleapp/couple/PairRequestTest.java` (mới)

**Interfaces:**
- Consumes: `Handles`, `UserRepository.findByHandleIgnoreCase`, `UserSettings.isDiscoverable` (Task 1); `NotificationService.sendNow` (Task 2).
- Produces: `UserDtos.UserCard(UUID id, String displayName, String handle, String avatarUrl)`; `UserDirectory.findDiscoverable(UUID viewer, String rawHandle)` → `Optional<UserCard>`, `UserDirectory.card(UUID userId)` → `UserCard`; `CoupleService.createCouple(UUID inviterId, UUID joinerId, LocalDate startedDatingOn)` → `CoupleResponse`; API `GET /api/users/lookup?handle=`, `POST/GET /api/couples/requests`, `POST /api/couples/requests/{id}/accept|decline`, `DELETE /api/couples/requests/{id}`.

- [ ] **Step 1: Viết test**

```java
package com.coupleapp.couple;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PairRequestTest extends IntegrationTest {

    String lan;
    String minh;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        patch("/api/me", lan, Map.of("handle", "lan.2001")).andExpect(status().isOk());
        patch("/api/me", minh, Map.of("handle", "minh.dev")).andExpect(status().isOk());
    }

    String sendRequest(String from, String handle) throws Exception {
        return read(post("/api/couples/requests", from, Map.of("handle", handle))
                .andExpect(status().isCreated())).get("id").asText();
    }

    boolean hasKind(String token, String kind) throws Exception {
        return StreamSupport.stream(read(get("/api/notifications", token)).spliterator(), false)
                .anyMatch(n -> n.get("kind").asText().equals(kind));
    }

    @Test
    void lookupMatchesOnlyExactDiscoverableHandle() throws Exception {
        get("/api/users/lookup?handle=@Minh.Dev", lan).andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Minh"))
                .andExpect(jsonPath("$.handle").value("minh.dev"));
        get("/api/users/lookup?handle=minh", lan).andExpect(status().isNotFound());
        get("/api/users/lookup?handle=lan.2001", lan).andExpect(status().isNotFound());
        put("/api/me/settings", minh, Map.of("discoverable", false)).andExpect(status().isOk());
        get("/api/users/lookup?handle=minh.dev", lan).andExpect(status().isNotFound());
    }

    @Test
    void lookupIsRateLimited() throws Exception {
        for (int i = 0; i < 30; i++) {
            get("/api/users/lookup?handle=nobody" + i, lan).andExpect(status().isNotFound());
        }
        get("/api/users/lookup?handle=minh.dev", lan).andExpect(status().isTooManyRequests());
    }

    @Test
    void sendAndAcceptCreatesCouple() throws Exception {
        String id = sendRequest(lan, "@minh.dev");
        JsonNode incoming = read(get("/api/couples/requests", minh)).get("incoming");
        assertThat(incoming).hasSize(1);
        assertThat(incoming.get(0).get("user").get("handle").asText()).isEqualTo("lan.2001");
        assertThat(read(get("/api/couples/requests", lan)).get("outgoing")).hasSize(1);
        assertThat(hasKind(minh, "PAIR_REQUEST")).isTrue();

        post("/api/couples/requests/" + id + "/accept", lan, Map.of()).andExpect(status().isNotFound());
        post("/api/couples/requests/" + id + "/accept", minh, Map.of("startedDatingOn", "2025-02-14"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.partner.displayName").value("Lan"))
                .andExpect(jsonPath("$.startedDatingOn").value("2025-02-14"));
        get("/api/couples/me", lan).andExpect(status().isOk());
        assertThat(hasKind(lan, "PAIRED")).isTrue();
        assertThat(read(get("/api/couples/requests", minh)).get("incoming")).isEmpty();
    }

    @Test
    void declineAndCancel() throws Exception {
        String id = sendRequest(lan, "minh.dev");
        post("/api/couples/requests/" + id + "/decline", minh, null).andExpect(status().isNoContent());
        assertThat(read(get("/api/couples/requests", lan)).get("outgoing")).isEmpty();

        String again = sendRequest(lan, "minh.dev");
        delete("/api/couples/requests/" + again, minh).andExpect(status().isNotFound());
        delete("/api/couples/requests/" + again, lan).andExpect(status().isNoContent());
        assertThat(read(get("/api/couples/requests", minh)).get("incoming")).isEmpty();
    }

    @Test
    void expiredRequestCanBeSentAgain() throws Exception {
        String first = sendRequest(lan, "minh.dev");
        jdbc.update("update pair_requests set expires_at = now() - interval '1 hour'");
        assertThat(read(get("/api/couples/requests", minh)).get("incoming")).isEmpty();
        String second = sendRequest(lan, "minh.dev");
        assertThat(second).isNotEqualTo(first);
    }

    @Test
    void pairingByCodeCancelsPendingRequests() throws Exception {
        String id = sendRequest(lan, "minh.dev");
        String hoa = register("hoa@x.vn", "Hoa");
        pair(hoa, minh);
        assertThat(read(get("/api/couples/requests", lan)).get("outgoing")).isEmpty();
        assertThat(jdbc.queryForObject("select status from pair_requests where id = ?::uuid", String.class, id))
                .isEqualTo("CANCELLED");
    }

    @Test
    void pairedUsersCannotSendOrReceive() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        pair(lan, hoa);
        post("/api/couples/requests", lan, Map.of("handle", "minh.dev")).andExpect(status().isConflict());
        post("/api/couples/requests", minh, Map.of("handle", "lan.2001")).andExpect(status().isConflict());
    }
}
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `cd backend && ./mvnw -q test -Dtest=PairRequestTest`
Expected: FAIL — `GET /api/users/lookup` trả 404 cho cả trường hợp đúng.

- [ ] **Step 3: `UserCard`, `UserDirectory`, endpoint tra cứu**

`UserDtos` — thêm:

```java
    public record UserCard(UUID id, String displayName, String handle, String avatarUrl) {}
```

`UserDirectory.java`:

```java
package com.coupleapp.user;

import com.coupleapp.common.ApiException;
import com.coupleapp.media.MediaService;
import com.coupleapp.user.UserDtos.UserCard;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserDirectory {

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final MediaService media;

    /** Khớp chính xác ID, người đó cho phép tìm, và không phải chính mình. */
    @Transactional(readOnly = true)
    public Optional<UserCard> findDiscoverable(UUID viewer, String rawHandle) {
        String h = Handles.normalize(rawHandle);
        if (!Handles.VALID.matcher(h).matches()) {
            return Optional.empty();
        }
        return users.findByHandleIgnoreCase(h)
                .filter(u -> !u.getId().equals(viewer))
                .filter(u -> settings.findById(u.getId()).map(UserSettings::isDiscoverable).orElse(true))
                .map(this::card);
    }

    @Transactional(readOnly = true)
    public UserCard card(UUID userId) {
        return users.findById(userId).map(this::card).orElseThrow(ApiException::notFound);
    }

    @Transactional(readOnly = true)
    public Optional<User> find(UUID userId) {
        return users.findById(userId);
    }

    UserCard card(User u) {
        String avatar = u.getAvatarMediaId() == null ? null : media.avatarUrl(u.getAvatarMediaId()).orElse(null);
        return new UserCard(u.getId(), u.getDisplayName(), u.getHandle(), avatar);
    }
}
```

`UserLookupController.java`:

```java
package com.coupleapp.user;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.AuthUser;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.user.UserDtos.UserCard;
import java.time.Duration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class UserLookupController {

    static final int MAX_LOOKUPS = 30;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final UserDirectory directory;
    private final StringRedisTemplate redis;

    @GetMapping("/api/users/lookup")
    public UserCard lookup(@AuthenticationPrincipal Jwt jwt, @RequestParam String handle) {
        UUID me = AuthUser.id(jwt);
        checkRateLimit(me);
        return directory.findDiscoverable(me, handle)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy ID này"));
    }

    private void checkRateLimit(UUID userId) {
        String key = "ratelimit:lookup:" + userId;
        Long n = redis.opsForValue().increment(key);
        if (n != null && n == 1) {
            redis.expire(key, WINDOW);
        }
        if (n != null && n > MAX_LOOKUPS) {
            throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, "Bạn tra cứu quá nhiều, thử lại sau 15 phút");
        }
    }
}
```

- [ ] **Step 4: Tách `CoupleService.createCouple`**

Thay thân `join` sau dòng `invites.claim(code)…` và thêm phương thức mới:

```java
        invites.claim(code).orElseThrow(CoupleService::invalidInvite);
        try {
            return createCouple(payload.inviterId(), joinerId, startedDatingOn);
        } catch (RuntimeException e) {
            invites.restore(code, payload);
            throw e;
        }
    }

    /** Tạo cặp đôi cho hai người chưa có cặp ACTIVE (dùng chung cho mã mời và lời mời theo ID). */
    @Transactional
    public CoupleResponse createCouple(UUID inviterId, UUID joinerId, LocalDate startedDatingOn) {
        if (access.findActive(joinerId).isPresent() || access.findActive(inviterId).isPresent()) {
            throw alreadyPaired();
        }
        try {
            Instant now = clock.instant();
            Couple couple = new Couple();
            couple.setStartedDatingOn(startedDatingOn);
            couple.setCreatedAt(now);
            couples.saveAndFlush(couple);
            members.saveAndFlush(new CoupleMember(couple.getId(), inviterId, now));
            members.saveAndFlush(new CoupleMember(couple.getId(), joinerId, now));
            events.publishEvent(new CouplePairedEvent(couple.getId(), inviterId, joinerId, startedDatingOn));
            return toResponse(couple, inviterId);
        } catch (DataIntegrityViolationException e) {
            throw alreadyPaired();
        }
    }
```

(Bỏ khối `try … catch (DataIntegrityViolationException e) { invites.restore…` cũ trong `join` vì đã gộp vào `createCouple`; `toResponse(couple, inviterId)` trả partner = người mời, đúng góc nhìn người tham gia như trước.)

- [ ] **Step 5: Entity, repository, event, DTO cho lời mời**

`PairRequestStatus.java`:

```java
package com.coupleapp.couple;

public enum PairRequestStatus { PENDING, ACCEPTED, DECLINED, CANCELLED }
```

`PairRequest.java`:

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
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "pair_requests")
@Getter
@Setter
@NoArgsConstructor
public class PairRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID requesterId;
    private UUID targetId;

    @Enumerated(EnumType.STRING)
    private PairRequestStatus status = PairRequestStatus.PENDING;

    private Instant createdAt;
    private Instant expiresAt;
    private Instant respondedAt;
}
```

`PairRequestRepository.java`:

```java
package com.coupleapp.couple;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PairRequestRepository extends JpaRepository<PairRequest, UUID> {

    Optional<PairRequest> findByRequesterIdAndTargetIdAndStatus(UUID requesterId, UUID targetId,
                                                                PairRequestStatus status);

    List<PairRequest> findByTargetIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(UUID targetId,
                                                                                   PairRequestStatus status,
                                                                                   Instant now);

    List<PairRequest> findByRequesterIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(UUID requesterId,
                                                                                      PairRequestStatus status,
                                                                                      Instant now);

    @Modifying
    @Query(value = """
            update pair_requests set status = 'CANCELLED', responded_at = :now
            where status = 'PENDING' and (requester_id in (:a, :b) or target_id in (:a, :b))
            """, nativeQuery = true)
    int cancelPendingInvolving(UUID a, UUID b, Instant now);
}
```

`PairRequestedEvent.java`:

```java
package com.coupleapp.couple;

import java.util.UUID;

public record PairRequestedEvent(UUID requestId, UUID requesterId, UUID targetId) {}
```

`CoupleDtos` — thêm:

```java
    public record SendPairRequest(@NotBlank @Size(max = 40) String handle) {}

    public record AcceptPairRequest(@PastOrPresent LocalDate startedDatingOn) {}

    public record PairRequestDto(UUID id, UserCard user, Instant createdAt, Instant expiresAt) {}

    public record PairRequestsResponse(List<PairRequestDto> incoming, List<PairRequestDto> outgoing) {}
```

(import `com.coupleapp.user.UserDtos.UserCard`, `java.util.List`.)

- [ ] **Step 6: Service, controller, dọn dẹp khi ghép đôi**

`PairRequestService.java`:

```java
package com.coupleapp.couple;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleDtos.CoupleResponse;
import com.coupleapp.couple.CoupleDtos.PairRequestDto;
import com.coupleapp.couple.CoupleDtos.PairRequestsResponse;
import com.coupleapp.user.UserDirectory;
import com.coupleapp.user.UserDtos.UserCard;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PairRequestService {

    static final Duration TTL = Duration.ofHours(24);

    private final PairRequestRepository requests;
    private final CoupleAccess access;
    private final CoupleService couples;
    private final UserDirectory directory;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional
    public PairRequestDto send(UUID requesterId, String handle) {
        if (access.findActive(requesterId).isPresent()) {
            throw new ApiException(ErrorCode.COUPLE_ALREADY_PAIRED, "Bạn đang có cặp đôi");
        }
        UserCard target = directory.findDiscoverable(requesterId, handle)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy ID này"));
        if (access.findActive(target.id()).isPresent()) {
            throw new ApiException(ErrorCode.COUPLE_ALREADY_PAIRED, "Người này đã có cặp đôi");
        }
        Instant now = clock.instant();
        Optional<PairRequest> existing =
                requests.findByRequesterIdAndTargetIdAndStatus(requesterId, target.id(), PairRequestStatus.PENDING);
        if (existing.isPresent()) {
            PairRequest p = existing.get();
            if (p.getExpiresAt().isAfter(now)) {
                return new PairRequestDto(p.getId(), target, p.getCreatedAt(), p.getExpiresAt());
            }
            p.setStatus(PairRequestStatus.CANCELLED);
            p.setRespondedAt(now);
            requests.saveAndFlush(p);
        }
        PairRequest p = new PairRequest();
        p.setRequesterId(requesterId);
        p.setTargetId(target.id());
        p.setCreatedAt(now);
        p.setExpiresAt(now.plus(TTL));
        requests.saveAndFlush(p);
        events.publishEvent(new PairRequestedEvent(p.getId(), requesterId, target.id()));
        return new PairRequestDto(p.getId(), target, p.getCreatedAt(), p.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public PairRequestsResponse list(UUID userId) {
        Instant now = clock.instant();
        var incoming = requests.findByTargetIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                        userId, PairRequestStatus.PENDING, now).stream()
                .map(p -> new PairRequestDto(p.getId(), directory.card(p.getRequesterId()), p.getCreatedAt(),
                        p.getExpiresAt()))
                .toList();
        var outgoing = requests.findByRequesterIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                        userId, PairRequestStatus.PENDING, now).stream()
                .map(p -> new PairRequestDto(p.getId(), directory.card(p.getTargetId()), p.getCreatedAt(),
                        p.getExpiresAt()))
                .toList();
        return new PairRequestsResponse(incoming, outgoing);
    }

    @Transactional
    public CoupleResponse accept(UUID userId, UUID id, LocalDate startedDatingOn) {
        PairRequest p = pending(id).filter(x -> x.getTargetId().equals(userId)).orElseThrow(ApiException::notFound);
        p.setStatus(PairRequestStatus.ACCEPTED);
        p.setRespondedAt(clock.instant());
        requests.saveAndFlush(p);
        CoupleResponse couple = couples.createCouple(p.getRequesterId(), userId, startedDatingOn);
        return couple;
    }

    @Transactional
    public void decline(UUID userId, UUID id) {
        close(pending(id).filter(x -> x.getTargetId().equals(userId)), PairRequestStatus.DECLINED);
    }

    @Transactional
    public void cancel(UUID userId, UUID id) {
        close(pending(id).filter(x -> x.getRequesterId().equals(userId)), PairRequestStatus.CANCELLED);
    }

    private Optional<PairRequest> pending(UUID id) {
        Instant now = clock.instant();
        return requests.findById(id)
                .filter(p -> p.getStatus() == PairRequestStatus.PENDING && p.getExpiresAt().isAfter(now));
    }

    private void close(Optional<PairRequest> request, PairRequestStatus status) {
        PairRequest p = request.orElseThrow(ApiException::notFound);
        p.setStatus(status);
        p.setRespondedAt(clock.instant());
    }
}
```

> Lưu ý: `accept` trả `CoupleResponse` từ `createCouple(requester, accepter, …)` — `toResponse(couple, inviterId)` nên `partner` là người gửi lời mời, đúng góc nhìn người chấp nhận.

`PairRequestCleanup.java`:

```java
package com.coupleapp.couple;

import java.time.Clock;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Ghép đôi bằng bất kỳ cách nào → huỷ các lời mời đang chờ của cả hai người. */
@Component
@RequiredArgsConstructor
class PairRequestCleanup {

    private final PairRequestRepository requests;
    private final Clock clock;

    @EventListener
    void onPaired(CouplePairedEvent e) {
        requests.cancelPendingInvolving(e.inviterId(), e.joinerId(), clock.instant());
    }
}
```

`PairRequestController.java`:

```java
package com.coupleapp.couple;

import com.coupleapp.common.AuthUser;
import com.coupleapp.couple.CoupleDtos.AcceptPairRequest;
import com.coupleapp.couple.CoupleDtos.CoupleResponse;
import com.coupleapp.couple.CoupleDtos.PairRequestDto;
import com.coupleapp.couple.CoupleDtos.PairRequestsResponse;
import com.coupleapp.couple.CoupleDtos.SendPairRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/couples/requests")
@RequiredArgsConstructor
public class PairRequestController {

    private final PairRequestService requests;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PairRequestDto send(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SendPairRequest r) {
        return requests.send(AuthUser.id(jwt), r.handle());
    }

    @GetMapping
    public PairRequestsResponse list(@AuthenticationPrincipal Jwt jwt) {
        return requests.list(AuthUser.id(jwt));
    }

    @PostMapping("/{id}/accept")
    @ResponseStatus(HttpStatus.CREATED)
    public CoupleResponse accept(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                 @Valid @RequestBody(required = false) AcceptPairRequest r) {
        return requests.accept(AuthUser.id(jwt), id, r != null ? r.startedDatingOn() : null);
    }

    @PostMapping("/{id}/decline")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void decline(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        requests.decline(AuthUser.id(jwt), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        requests.cancel(AuthUser.id(jwt), id);
    }
}
```

`PairRequestNotifier.java`:

```java
package com.coupleapp.notification;

import com.coupleapp.couple.PairRequestedEvent;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class PairRequestNotifier {

    private final NotificationService notifications;
    private final UserRepository users;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onRequested(PairRequestedEvent e) {
        String name = users.findById(e.requesterId()).map(User::getDisplayName).orElse("Ai đó");
        notifications.sendNow(e.targetId(), "PAIR_REQUEST", "💌 Lời mời ghép đôi", name + " muốn ghép đôi với bạn",
                "coupleapp://pair/requests");
    }
}
```

- [ ] **Step 7: Chạy test**

Run: `cd backend && ./mvnw -q test -Dtest='PairRequestTest,CoupleTest'`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(backend): tìm theo ID và lời mời ghép đôi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Theo dõi chu kỳ tuỳ chọn & hồ sơ người ấy

**Files:**
- Modify: `backend/src/main/java/com/coupleapp/cycle/CycleService.java`
- Modify: `backend/src/main/java/com/coupleapp/cycle/CycleEventsListener.java`
- Modify: `backend/src/main/java/com/coupleapp/user/UserSettingsChangedEvent.java`
- Modify: `backend/src/main/java/com/coupleapp/user/MeService.java`
- Modify: `backend/src/main/java/com/coupleapp/couple/CoupleDtos.java`
- Modify: `backend/src/main/java/com/coupleapp/couple/CoupleService.java`
- Modify: `backend/src/test/java/com/coupleapp/support/IntegrationTest.java`
- Modify: `backend/src/test/java/com/coupleapp/cycle/CycleTest.java` (và test khác có ghi kỳ)
- Test: `backend/src/test/java/com/coupleapp/cycle/CycleTrackingTest.java` (mới)

**Interfaces:**
- Consumes: `UserSettings.isCycleTracking()` (Task 1); `UserDirectory.card(UUID)`, `UserDirectory.find(UUID)` (Task 7).
- Produces: `UserSettingsChangedEvent(userId, shareLocation, shareCycle, shareLocationChanged, shareCycleChanged, cycleTrackingChanged)`; `PartnerDto(UUID id, String displayName, String handle, LocalDate birthday, String avatarUrl)`; helper test `IntegrationTest.enableCycleTracking(String token)`.

- [ ] **Step 1: Viết test**

```java
package com.coupleapp.cycle;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CycleTrackingTest extends IntegrationTest {

    String lan;
    String minh;
    UUID lanId;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        lanId = userId(lan);
    }

    static String daysAgo(int n) {
        return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(n).toString();
    }

    int pendingCycleReminders() {
        return jdbc.queryForObject("""
                select count(*) from reminders r join moments m on m.id = r.moment_id
                where m.type = 'CYCLE' and r.status = 'PENDING'""", Integer.class);
    }

    @Test
    void loggingRequiresTracking() throws Exception {
        post("/api/cycles/logs", lan, Map.of("periodStart", daysAgo(20))).andExpect(status().isBadRequest());
        enableCycleTracking(lan);
        post("/api/cycles/logs", lan, Map.of("periodStart", daysAgo(20))).andExpect(status().isCreated());
    }

    @Test
    void partnerSeesPredictionOnlyWhileTrackingAndSharing() throws Exception {
        pair(lan, minh);
        enableCycleTracking(lan);
        post("/api/cycles/logs", lan, Map.of("periodStart", daysAgo(20))).andExpect(status().isCreated());
        get("/api/cycles/prediction?userId=" + lanId, minh).andExpect(status().isOk());
        assertThat(pendingCycleReminders()).isPositive();

        put("/api/me/settings", lan, Map.of("cycleTracking", false)).andExpect(status().isOk());
        get("/api/cycles/prediction?userId=" + lanId, minh).andExpect(status().isNotFound());
        assertThat(pendingCycleReminders()).isZero();

        enableCycleTracking(lan);
        get("/api/cycles/prediction?userId=" + lanId, minh).andExpect(status().isOk());
        assertThat(pendingCycleReminders()).isPositive();
    }

    @Test
    void coupleResponseIncludesPartnerProfile() throws Exception {
        patch("/api/me", lan, Map.of("handle", "lan.2001", "birthday", "2001-03-08")).andExpect(status().isOk());
        pair(lan, minh);
        get("/api/couples/me", minh)
                .andExpect(jsonPath("$.partner.handle").value("lan.2001"))
                .andExpect(jsonPath("$.partner.birthday").value("2001-03-08"))
                .andExpect(jsonPath("$.partner.avatarUrl").isEmpty());
    }
}
```

`IntegrationTest` — thêm helper:

```java
    protected void enableCycleTracking(String token) throws Exception {
        put("/api/me/settings", token, Map.of("cycleTracking", true)).andExpect(status().isOk());
    }
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `cd backend && ./mvnw -q test -Dtest=CycleTrackingTest`
Expected: FAIL — ghi kỳ khi chưa bật trả `201` thay vì `400`.

- [ ] **Step 3: Sự kiện cài đặt**

`UserSettingsChangedEvent.java`:

```java
public record UserSettingsChangedEvent(
        UUID userId,
        boolean shareLocation,
        boolean shareCycle,
        boolean shareLocationChanged,
        boolean shareCycleChanged,
        boolean cycleTrackingChanged) {}
```

`MeService.updateSettings` — lưu trạng thái trước (`boolean trackingBefore = s.isCycleTracking();`) cạnh `cycleBefore`, và publish:

```java
        events.publishEvent(new UserSettingsChangedEvent(
                userId, s.isShareLocation(), s.isShareCycle(),
                locationBefore != s.isShareLocation(), cycleBefore != s.isShareCycle(),
                trackingBefore != s.isCycleTracking()));
```

`CycleEventsListener.onSettingsChanged`:

```java
    @EventListener
    void onSettingsChanged(UserSettingsChangedEvent e) {
        if (e.cycleTrackingChanged()) {
            cycles.refresh(e.userId());
        } else if (e.shareCycleChanged()) {
            cycles.replanFor(e.userId());
        }
    }
```

- [ ] **Step 4: `CycleService`**

`addLog` — thêm ở đầu:

```java
        if (!settingsOf(userId).isCycleTracking()) {
            throw invalid("Hãy bật theo dõi chu kỳ trước");
        }
```

`prediction` — điều kiện cho đối phương thành:

```java
            UserSettings s = settingsOf(subject);
            if (!s.isCycleTracking() || !s.isShareCycle()) {
                throw ApiException.notFound();
            }
```

`refresh` — ngay sau khi lấy `existing`:

```java
        if (!settingsOf(userId).isCycleTracking()) {
            existing.ifPresent(moments::delete); // reminders xoá theo ON DELETE CASCADE
            return;
        }
```

- [ ] **Step 5: Hồ sơ người ấy trong `CoupleResponse`**

`CoupleDtos.PartnerDto`:

```java
    public record PartnerDto(UUID id, String displayName, String handle, LocalDate birthday, String avatarUrl) {}
```

`CoupleService` — thêm field `private final UserDirectory directory;` (import `com.coupleapp.user.UserDirectory`), thay `toResponse`:

```java
    private CoupleResponse toResponse(Couple couple, UUID partnerId) {
        UserCard card = directory.card(partnerId);
        LocalDate birthday = directory.find(partnerId).map(User::getBirthday).orElse(null);
        return new CoupleResponse(couple.getId(), couple.getStartedDatingOn(), couple.getCreatedAt(),
                new PartnerDto(card.id(), card.displayName(), card.handle(), birthday, card.avatarUrl()));
    }
```

(import `com.coupleapp.user.UserDtos.UserCard`; bỏ field `UserRepository users` nếu không còn dùng.)

- [ ] **Step 6: Bật theo dõi chu kỳ trong các test cũ có ghi kỳ**

Run: `cd backend && grep -rln "/api/cycles/logs" src/test`
Expected: liệt kê `CycleTest` (và có thể `NotificationTest`). Trong mỗi file, gọi `enableCycleTracking(<token chủ thể>)` ở `@BeforeEach` (hoặc trước lần `POST /api/cycles/logs` đầu tiên).

- [ ] **Step 7: Chạy test**

Run: `cd backend && ./mvnw -q test -Dtest='CycleTrackingTest,CycleTest,CoupleTest,NotificationTest'`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(backend): theo dõi chu kỳ tuỳ chọn, hồ sơ người ấy trong thông tin cặp đôi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Ảnh cho món yêu thích

**Files:**
- Modify: `backend/src/main/java/com/coupleapp/trait/Preference.java`
- Modify: `backend/src/main/java/com/coupleapp/trait/TraitDtos.java`
- Modify: `backend/src/main/java/com/coupleapp/trait/TraitService.java`
- Test: `backend/src/test/java/com/coupleapp/trait/TraitTest.java`

**Interfaces:**
- Consumes: cột `preferences.image_media_id` (Task 1); `MediaService.requireUsable(ids, coupleId, userId)` (Task 5), `MediaService.dtos(List<UUID>)`.
- Produces: `PreferenceRequest`/`PreferencePatch` có thêm thành phần cuối `UUID imageMediaId`; `PreferenceDto` có thêm thành phần cuối `MediaDto image` (null nếu không có ảnh).

- [ ] **Step 1: Viết test (thêm vào `TraitTest`)**

```java
    @Test
    void preferenceCanHaveAPhoto() throws Exception {
        UUID photo = uploadImage(lan);
        JsonNode p = read(post("/api/traits/preferences", lan, Map.of(
                "subjectUserId", minhId.toString(), "category", "KEYBOARD", "brand", "Keychron",
                "name", "K2 Pro", "imageMediaId", photo.toString()))
                .andExpect(status().isCreated()));
        assertThat(p.get("image").get("url").asText()).isNotEmpty();

        String other = register("x@x.vn", "X");
        UUID foreign = uploadImage(other);
        post("/api/traits/preferences", lan, Map.of("subjectUserId", minhId.toString(), "category", "BAG",
                "imageMediaId", foreign.toString()))
                .andExpect(status().isBadRequest());
    }
```

(Dùng các biến token/`minhId` mà `TraitTest` đã có trong `@BeforeEach`; nếu tên khác thì đổi cho khớp. Import `com.fasterxml.jackson.databind.JsonNode` nếu chưa có.)

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `cd backend && ./mvnw -q test -Dtest=TraitTest`
Expected: FAIL — `image` không có trong response (`NullPointerException` ở `p.get("image")`).

- [ ] **Step 3: Entity & DTO**

`Preference.java` — thêm sau `note`:

```java
    private UUID imageMediaId;
```

`TraitDtos` — thêm thành phần cuối:

```java
    public record PreferenceRequest(
            @NotNull UUID subjectUserId,
            @NotBlank @Pattern(regexp = CODE) String category,
            @Size(max = 100) String brand,
            @Size(max = 200) String name,
            @Size(max = 50) String color,
            @Size(max = 1000) String note,
            Visibility visibility,
            @Valid @Size(max = 10) List<LinkInput> links,
            UUID imageMediaId) {}

    public record PreferencePatch(
            @Pattern(regexp = CODE) String category,
            @Size(max = 100) String brand,
            @Size(max = 200) String name,
            @Size(max = 50) String color,
            @Size(max = 1000) String note,
            Visibility visibility,
            @Valid @Size(max = 10) List<LinkInput> links,
            UUID imageMediaId) {}

    public record PreferenceDto(UUID id, UUID subjectUserId, String category, String brand, String name,
                                String color, String note, Visibility visibility, UUID createdBy,
                                Instant updatedAt, List<LinkDto> links, MediaDto image) {}
```

(import `com.coupleapp.media.MediaDtos.MediaDto`.)

- [ ] **Step 4: Service**

`TraitService` — thêm field `private final MediaService media;` (import `com.coupleapp.media.MediaService`, `com.coupleapp.couple.CoupleContext`). Thêm helper:

```java
    private void applyImage(Preference p, UUID me, UUID imageMediaId) {
        if (imageMediaId == null) {
            return;
        }
        UUID coupleId = couples.findActive(me).map(CoupleContext::coupleId).orElse(null);
        media.requireUsable(List.of(imageMediaId), coupleId, me);
        p.setImageMediaId(imageMediaId);
    }
```

Gọi `applyImage(p, me, r.imageMediaId());` trong `createPreference` (trước `preferences.save(p)`) và trong `updatePreference` (trước `p.setUpdatedAt(...)`). Đổi `toDto(Preference p)` từ `static` thành phương thức thường và trả thêm ảnh:

```java
    private PreferenceDto toDto(Preference p) {
        List<LinkDto> links = p.getLinks().stream()
                .map(l -> new LinkDto(l.getId(), l.getUrl(), l.getLabel(), l.getPrice())).toList();
        MediaDto image = p.getImageMediaId() == null ? null
                : media.dtos(List.of(p.getImageMediaId())).stream().findFirst().orElse(null);
        return new PreferenceDto(p.getId(), p.getSubjectUserId(), p.getCategory(), p.getBrand(), p.getName(),
                p.getColor(), p.getNote(), p.getVisibility(), p.getCreatedBy(), p.getUpdatedAt(), links, image);
    }
```

Trong `list`, đổi `.map(TraitService::toDto)` của preferences thành `.map(this::toDto)`.

- [ ] **Step 5: Chạy test**

Run: `cd backend && ./mvnw -q test -Dtest=TraitTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(backend): ảnh cho món yêu thích

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Tài liệu API & chạy toàn bộ

**Files:**
- Modify: `README.md` (bảng API)
- Modify: `docs/superpowers/specs/2026-10-10-couple-app-design.md` (§8 API)

- [ ] **Step 1: Bổ sung bảng API**

Trong `README.md` và §8 của spec, thêm các dòng:

| Nhóm | Endpoint |
|---|---|
| Users | `GET /api/users/lookup?handle=` |
| Couple | `POST/GET /api/couples/requests`, `POST /api/couples/requests/{id}/accept`, `POST /api/couples/requests/{id}/decline`, `DELETE /api/couples/requests/{id}` |
| Love note | `GET/POST /api/love-notes`, `POST /api/love-notes/{id}/seen`, `GET /api/love-notes/latest` |
| Notifications | `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all` |

và ghi chú: `PATCH /api/me` nhận `handle`; `GET/PUT /api/me/settings` có `discoverable`, `cycleTracking`; `POST /api/moments` nhận `type: MOMENT`, `recurrence: WEEKLY|MONTHLY`, `notifyPartner`; `MomentResponse.personal`.

- [ ] **Step 2: Chạy toàn bộ test backend**

Run: `cd backend && ./mvnw -q test`
Expected: PASS toàn bộ.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-10-couple-app-design.md
git commit -m "docs: API cho UI v2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
