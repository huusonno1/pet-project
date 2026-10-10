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
