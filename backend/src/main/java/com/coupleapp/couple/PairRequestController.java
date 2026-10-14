package com.coupleapp.couple;

import com.coupleapp.common.AuthUser;
import com.coupleapp.couple.CoupleDtos.AcceptPairRequest;
import com.coupleapp.couple.CoupleDtos.CoupleResponse;
import com.coupleapp.couple.CoupleDtos.PairRequestDto;
import com.coupleapp.couple.CoupleDtos.PairRequestsResponse;
import com.coupleapp.couple.CoupleDtos.SendPairRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/couples/requests")
@RequiredArgsConstructor
public class PairRequestController {

    private final PairRequestService requests;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PairRequestDto send(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SendPairRequest r) {
        return requests.send(AuthUser.id(jwt), r.handle());
    }

    @GetMapping
    public PairRequestsResponse list(@AuthenticationPrincipal Jwt jwt) {
        return requests.list(AuthUser.id(jwt));
    }

    @PostMapping("/{id}/accept")
    @ResponseStatus(HttpStatus.CREATED)
    public CoupleResponse accept(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                 @Valid @RequestBody(required = false) AcceptPairRequest r) {
        return requests.accept(AuthUser.id(jwt), id, r != null ? r.startedDatingOn() : null);
    }

    @PostMapping("/{id}/decline")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void decline(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        requests.decline(AuthUser.id(jwt), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        requests.cancel(AuthUser.id(jwt), id);
    }
}
