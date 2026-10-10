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
