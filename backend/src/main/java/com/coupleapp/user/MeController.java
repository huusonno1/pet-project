package com.coupleapp.user;

import com.coupleapp.common.AuthUser;
import com.coupleapp.user.UserDtos.MeResponse;
import com.coupleapp.user.UserDtos.SettingsResponse;
import com.coupleapp.user.UserDtos.UpdateMeRequest;
import com.coupleapp.user.UserDtos.UpdateSettingsRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final MeService me;

    @GetMapping
    public MeResponse get(@AuthenticationPrincipal Jwt jwt) {
        return me.get(AuthUser.id(jwt));
    }

    @PatchMapping
    public MeResponse update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateMeRequest r) {
        return me.update(AuthUser.id(jwt), r);
    }

    @GetMapping("/settings")
    public SettingsResponse settings(@AuthenticationPrincipal Jwt jwt) {
        return me.getSettings(AuthUser.id(jwt));
    }

    @PutMapping("/settings")
    public SettingsResponse updateSettings(@AuthenticationPrincipal Jwt jwt, @RequestBody UpdateSettingsRequest r) {
        return me.updateSettings(AuthUser.id(jwt), r);
    }
}
