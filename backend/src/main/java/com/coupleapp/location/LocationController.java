package com.coupleapp.location;

import com.coupleapp.common.AuthUser;
import com.coupleapp.location.LocationDtos.DistanceResponse;
import com.coupleapp.location.LocationDtos.LocationRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locations;

    @PutMapping("/api/me/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody LocationRequest r) {
        locations.update(AuthUser.id(jwt), r);
    }

    @DeleteMapping("/api/me/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@AuthenticationPrincipal Jwt jwt) {
        locations.clear(AuthUser.id(jwt));
    }

    @GetMapping("/api/couples/distance")
    public DistanceResponse distance(@AuthenticationPrincipal Jwt jwt) {
        return locations.distance(AuthUser.id(jwt));
    }
}
