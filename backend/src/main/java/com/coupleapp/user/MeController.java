package com.coupleapp.user;

import com.coupleapp.common.AuthUser;
import com.coupleapp.user.UserDtos.MeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
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
}
