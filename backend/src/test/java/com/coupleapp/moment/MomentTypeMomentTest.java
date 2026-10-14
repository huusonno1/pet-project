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
