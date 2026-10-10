package com.coupleapp.trait;

import com.coupleapp.common.AuthUser;
import com.coupleapp.trait.TraitDtos.CatalogResponse;
import com.coupleapp.trait.TraitDtos.PreferenceDto;
import com.coupleapp.trait.TraitDtos.PreferencePatch;
import com.coupleapp.trait.TraitDtos.PreferenceRequest;
import com.coupleapp.trait.TraitDtos.SizeDto;
import com.coupleapp.trait.TraitDtos.SizePatch;
import com.coupleapp.trait.TraitDtos.SizeRequest;
import com.coupleapp.trait.TraitDtos.TraitsResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/traits")
@RequiredArgsConstructor
public class TraitController {

    private final TraitService traits;

    @GetMapping("/catalog")
    public CatalogResponse catalog() {
        return traits.catalog();
    }

    @GetMapping("/{userId}")
    public TraitsResponse list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID userId) {
        return traits.list(AuthUser.id(jwt), userId);
    }

    @PostMapping("/sizes")
    @ResponseStatus(HttpStatus.CREATED)
    public SizeDto createSize(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SizeRequest r) {
        return traits.createSize(AuthUser.id(jwt), r);
    }

    @PatchMapping("/sizes/{id}")
    public SizeDto updateSize(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody SizePatch r) {
        return traits.updateSize(AuthUser.id(jwt), id, r);
    }

    @DeleteMapping("/sizes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSize(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        traits.deleteSize(AuthUser.id(jwt), id);
    }

    @PostMapping("/preferences")
    @ResponseStatus(HttpStatus.CREATED)
    public PreferenceDto createPreference(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PreferenceRequest r) {
        return traits.createPreference(AuthUser.id(jwt), r);
    }

    @PatchMapping("/preferences/{id}")
    public PreferenceDto updatePreference(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                          @Valid @RequestBody PreferencePatch r) {
        return traits.updatePreference(AuthUser.id(jwt), id, r);
    }

    @DeleteMapping("/preferences/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePreference(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        traits.deletePreference(AuthUser.id(jwt), id);
    }
}
