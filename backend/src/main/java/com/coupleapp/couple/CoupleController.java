package com.coupleapp.couple;

import com.coupleapp.common.AuthUser;
import com.coupleapp.couple.CoupleDtos.CoupleResponse;
import com.coupleapp.couple.CoupleDtos.InviteResponse;
import com.coupleapp.couple.CoupleDtos.JoinRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/couples")
@RequiredArgsConstructor
public class CoupleController {

    private final CoupleService couples;

    @PostMapping("/invites")
    @ResponseStatus(HttpStatus.CREATED)
    public InviteResponse invite(@AuthenticationPrincipal Jwt jwt) {
        return couples.createInvite(AuthUser.id(jwt));
    }

    @PostMapping("/join")
    @ResponseStatus(HttpStatus.CREATED)
    public CoupleResponse join(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody JoinRequest r) {
        return couples.join(AuthUser.id(jwt), r.code(), r.startedDatingOn());
    }

    @GetMapping("/me")
    public CoupleResponse me(@AuthenticationPrincipal Jwt jwt) {
        return couples.me(AuthUser.id(jwt));
    }

    @PostMapping("/me/end")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void end(@AuthenticationPrincipal Jwt jwt) {
        couples.end(AuthUser.id(jwt));
    }
}
