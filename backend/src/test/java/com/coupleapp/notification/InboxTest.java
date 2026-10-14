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
