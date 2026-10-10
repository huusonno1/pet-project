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
