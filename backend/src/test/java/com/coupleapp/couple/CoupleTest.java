package com.coupleapp.couple;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.common.ApiException;
import com.coupleapp.support.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CoupleTest extends IntegrationTest {

    @Autowired CoupleService coupleService;

    @Test
    void inviteAndJoinCreatesCouple() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");

        String code = read(post("/api/couples/invites", lan, null)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.expiresAt").exists())).get("code").asText();
        assertThat(code).matches("^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$");
        assertThat(redis.getExpire("invite:" + code)).isBetween(3500L, 3600L);

        post("/api/couples/join", minh, Map.of("code", code.toLowerCase(), "startedDatingOn", "2025-02-14"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.partner.displayName").value("Lan"))
                .andExpect(jsonPath("$.startedDatingOn").value("2025-02-14"));

        get("/api/couples/me", lan)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.partner.displayName").value("Minh"));
        assertThat(redis.hasKey("invite:" + code)).isFalse();
    }

    @Test
    void cannotJoinOwnCode() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String code = read(post("/api/couples/invites", lan, null)).get("code").asText();
        post("/api/couples/join", lan, Map.of("code", code))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVITE_SELF"));
    }

    @Test
    void unknownOrExpiredCodeIsInvalid() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        String code = read(post("/api/couples/invites", lan, null)).get("code").asText();
        redis.delete("invite:" + code); // mô phỏng hết TTL

        post("/api/couples/join", minh, Map.of("code", code))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVITE_INVALID"));
    }

    @Test
    void newInviteInvalidatesPreviousOne() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        String first = read(post("/api/couples/invites", lan, null)).get("code").asText();
        String second = read(post("/api/couples/invites", lan, null)).get("code").asText();

        post("/api/couples/join", minh, Map.of("code", first)).andExpect(jsonPath("$.code").value("INVITE_INVALID"));
        post("/api/couples/join", minh, Map.of("code", second)).andExpect(status().isCreated());
    }

    @Test
    void pairedUsersCannotInviteOrJoin() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        String hoa = register("hoa@x.vn", "Hoa");
        pair(lan, minh);

        post("/api/couples/invites", lan, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUPLE_ALREADY_PAIRED"));

        String hoaCode = read(post("/api/couples/invites", hoa, null)).get("code").asText();
        post("/api/couples/join", minh, Map.of("code", hoaCode))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUPLE_ALREADY_PAIRED"));
    }

    @Test
    void joinAttemptsAreRateLimited() throws Exception {
        String minh = register("minh@x.vn", "Minh");
        for (int i = 0; i < 10; i++) {
            post("/api/couples/join", minh, Map.of("code", "ZZZZZZZZ")).andExpect(status().isBadRequest());
        }
        post("/api/couples/join", minh, Map.of("code", "ZZZZZZZZ"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
    }

    @Test
    void notPairedReturnsCoupleRequired() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        get("/api/couples/me", lan)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));
    }

    @Test
    void endingCoupleLetsBothPairAgain() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        String hoa = register("hoa@x.vn", "Hoa");
        pair(lan, minh);

        post("/api/couples/me/end", minh, null).andExpect(status().isNoContent());
        get("/api/couples/me", lan).andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));

        pair(lan, hoa);
        get("/api/couples/me", hoa).andExpect(jsonPath("$.partner.displayName").value("Lan"));
    }

    @Test
    void concurrentJoinWithSameCodeCreatesOneCouple() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        UUID minh = userId(register("minh@x.vn", "Minh"));
        UUID hoa = userId(register("hoa@x.vn", "Hoa"));
        String code = read(post("/api/couples/invites", lan, null)).get("code").asText();

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Boolean>> results = new ArrayList<>();
        for (UUID joiner : List.of(minh, hoa)) {
            Callable<Boolean> task = () -> {
                start.await();
                try {
                    coupleService.join(joiner, code, null);
                    return true;
                } catch (ApiException e) {
                    return false;
                }
            };
            results.add(pool.submit(task));
        }
        start.countDown();
        int successes = 0;
        for (Future<Boolean> f : results) {
            if (f.get()) {
                successes++;
            }
        }
        pool.shutdown();

        assertThat(successes).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from couple_members", Integer.class)).isEqualTo(2);
    }
}
