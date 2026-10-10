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
    void deletingAttachedPhotoKeepsMomentReadable() throws Exception {
        UUID first = uploadImage(lan);
        UUID second = uploadImage(lan);
        String id = create(lan, Map.of("type", "ANNIVERSARY", "title", "Đà Lạt",
                "occursOn", today().minusDays(10).toString(), "mediaIds", List.of(first, second)));

        delete("/api/media/" + first, lan).andExpect(status().isNoContent());

        get("/api/moments/" + id, lan)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.media.length()").value(1))
                .andExpect(jsonPath("$.media[0].id").value(second.toString()));
        patch("/api/moments/" + id, lan, Map.of("title", "Đà Lạt 2026")).andExpect(status().isOk());
    }

    @Test
    void requiresCouple() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        get("/api/moments", hoa).andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));
    }
}
