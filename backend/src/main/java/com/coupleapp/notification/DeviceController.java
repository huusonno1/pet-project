package com.coupleapp.notification;

import com.coupleapp.common.AuthUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/devices")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceTokenRepository devices;
    private final Clock clock;

    public record RegisterDeviceRequest(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Pattern(regexp = "ios|android") String platform) {}

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void register(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RegisterDeviceRequest r) {
        DeviceToken d = devices.findByExpoPushToken(r.token()).orElseGet(DeviceToken::new);
        d.setExpoPushToken(r.token());
        d.setUserId(AuthUser.id(jwt));
        d.setPlatform(r.platform());
        d.setLastSeenAt(clock.instant());
        devices.save(d);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void unregister(@AuthenticationPrincipal Jwt jwt, @RequestParam String token) {
        devices.deleteByExpoPushTokenAndUserId(token, AuthUser.id(jwt));
    }
}
