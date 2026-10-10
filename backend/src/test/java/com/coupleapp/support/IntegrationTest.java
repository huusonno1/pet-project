package com.coupleapp.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    protected String register(String email, String displayName) throws Exception {
        return read(post("/api/auth/register", null,
                Map.of("email", email, "password", "password123", "displayName", displayName))
                .andExpect(status().isCreated()))
                .get("accessToken").asText();
    }

    protected UUID userId(String token) throws Exception {
        return UUID.fromString(read(get("/api/me", token).andExpect(status().isOk())).get("id").asText());
    }

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
