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
