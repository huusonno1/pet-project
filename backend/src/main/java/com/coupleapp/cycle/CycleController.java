package com.coupleapp.cycle;

import com.coupleapp.common.AuthUser;
import com.coupleapp.cycle.CycleDtos.CycleLogDto;
import com.coupleapp.cycle.CycleDtos.CycleLogRequest;
import com.coupleapp.cycle.CycleDtos.DefaultLengthRequest;
import com.coupleapp.cycle.CycleDtos.PredictionResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cycles")
@RequiredArgsConstructor
public class CycleController {

    private final CycleService cycles;

    @GetMapping("/logs")
    public List<CycleLogDto> logs(@AuthenticationPrincipal Jwt jwt) {
        return cycles.logs(AuthUser.id(jwt));
    }

    @PostMapping("/logs")
    @ResponseStatus(HttpStatus.CREATED)
    public CycleLogDto add(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CycleLogRequest r) {
        return cycles.addLog(AuthUser.id(jwt), r);
    }

    @DeleteMapping("/logs/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        cycles.deleteLog(AuthUser.id(jwt), id);
    }

    @GetMapping("/prediction")
    public PredictionResponse prediction(@AuthenticationPrincipal Jwt jwt,
                                         @RequestParam(required = false) UUID userId) {
        UUID me = AuthUser.id(jwt);
        return cycles.prediction(me, userId != null ? userId : me);
    }

    @PutMapping("/default-length")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void defaultLength(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DefaultLengthRequest r) {
        cycles.setDefaultLength(AuthUser.id(jwt), r.days());
    }
}
