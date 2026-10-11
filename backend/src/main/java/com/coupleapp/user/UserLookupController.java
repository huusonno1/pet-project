package com.coupleapp.user;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.AuthUser;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.user.UserDtos.UserCard;
import java.time.Duration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class UserLookupController {

    static final int MAX_LOOKUPS = 30;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final UserDirectory directory;
    private final StringRedisTemplate redis;

    @GetMapping("/api/users/lookup")
    public UserCard lookup(@AuthenticationPrincipal Jwt jwt, @RequestParam String handle) {
        UUID me = AuthUser.id(jwt);
        checkRateLimit(me);
        return directory.findDiscoverable(me, handle)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy ID này"));
    }

    private void checkRateLimit(UUID userId) {
        String key = "ratelimit:lookup:" + userId;
        Long n = redis.opsForValue().increment(key);
        if (n != null && n == 1) {
            redis.expire(key, WINDOW);
        }
        if (n != null && n > MAX_LOOKUPS) {
            throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, "Bạn tra cứu quá nhiều, thử lại sau 15 phút");
        }
    }
}
