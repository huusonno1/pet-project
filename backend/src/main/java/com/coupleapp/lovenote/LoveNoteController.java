package com.coupleapp.lovenote;

import com.coupleapp.common.AuthUser;
import com.coupleapp.lovenote.LoveNoteDtos.LoveNoteDto;
import com.coupleapp.lovenote.LoveNoteDtos.SendNoteRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/love-notes")
@RequiredArgsConstructor
public class LoveNoteController {

    private final LoveNoteService notes;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LoveNoteDto send(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SendNoteRequest r) {
        return notes.send(AuthUser.id(jwt), r);
    }

    @GetMapping
    public List<LoveNoteDto> list(@AuthenticationPrincipal Jwt jwt,
                                  @RequestParam(required = false) Instant before,
                                  @RequestParam(defaultValue = "30") int limit) {
        return notes.list(AuthUser.id(jwt), before, limit);
    }

    @PostMapping("/{id}/seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void seen(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        notes.markSeen(AuthUser.id(jwt), id);
    }

    @GetMapping("/latest")
    public ResponseEntity<LoveNoteDto> latest(@AuthenticationPrincipal Jwt jwt) {
        return notes.latestFromPartner(AuthUser.id(jwt))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
