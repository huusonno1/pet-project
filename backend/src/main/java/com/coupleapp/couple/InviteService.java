package com.coupleapp.couple;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InviteService {

    static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ 0, O, 1, I
    static final int CODE_LENGTH = 8;
    static final Duration TTL = Duration.ofHours(1);
    static final Duration RATE_WINDOW = Duration.ofMinutes(15);
    static final int MAX_JOIN_ATTEMPTS = 10;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final StringRedisTemplate redis;
    private final ObjectMapper json;
    private final Clock clock;

    public record Invite(String code, Instant expiresAt) {}

    public record InvitePayload(UUID inviterId, Instant expiresAt) {}

    public Invite create(UUID inviterId) {
        String old = redis.opsForValue().get(userKey(inviterId));
        if (old != null) {
            redis.delete(codeKey(old));
        }
        Instant expiresAt = clock.instant().plus(TTL);
        String payload = write(new InvitePayload(inviterId, expiresAt));
        for (int attempt = 0; attempt < 5; attempt++) {
            String code = randomCode();
            if (Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(codeKey(code), payload, TTL))) {
                redis.opsForValue().set(userKey(inviterId), code, TTL);
                return new Invite(code, expiresAt);
            }
        }
        throw new IllegalStateException("Không sinh được mã mời duy nhất");
    }

    public Optional<InvitePayload> peek(String code) {
        return Optional.ofNullable(redis.opsForValue().get(codeKey(code))).map(this::parse);
    }

    /** Lấy và xoá mã trong một lệnh (GETDEL) — chỉ một request giành được mã. */
    public Optional<InvitePayload> claim(String code) {
        Optional<InvitePayload> payload =
                Optional.ofNullable(redis.opsForValue().getAndDelete(codeKey(code))).map(this::parse);
        payload.ifPresent(p -> {
            if (code.equals(redis.opsForValue().get(userKey(p.inviterId())))) {
                redis.delete(userKey(p.inviterId()));
            }
        });
        return payload;
    }

    /** Trả lại mã khi ghép đôi thất bại sau khi đã giành mã. */
    public void restore(String code, InvitePayload p) {
        Duration left = Duration.between(clock.instant(), p.expiresAt());
        if (left.isPositive()) {
            redis.opsForValue().setIfAbsent(codeKey(code), write(p), left);
            redis.opsForValue().set(userKey(p.inviterId()), code, left);
        }
    }

    public void checkJoinRateLimit(UUID userId) {
        String key = "ratelimit:join:" + userId;
        Long attempts = redis.opsForValue().increment(key);
        if (attempts != null && attempts == 1) {
            redis.expire(key, RATE_WINDOW);
        }
        if (attempts != null && attempts > MAX_JOIN_ATTEMPTS) {
            throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, "Bạn nhập mã quá nhiều lần, thử lại sau 15 phút");
        }
    }

    public static String normalize(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private static String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    private static String codeKey(String code) {
        return "invite:" + code;
    }

    private static String userKey(UUID userId) {
        return "invite:user:" + userId;
    }

    private String write(InvitePayload p) {
        try {
            return json.writeValueAsString(p);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private InvitePayload parse(String value) {
        try {
            return json.readValue(value, InvitePayload.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
