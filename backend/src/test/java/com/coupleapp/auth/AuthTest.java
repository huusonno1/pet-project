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
