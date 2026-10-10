package com.coupleapp.location;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;

public final class LocationDtos {

    private LocationDtos() {}

    public record LocationRequest(
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
            @PositiveOrZero Float accuracy) {}

    public record Stamp(Instant updatedAt) {}

    public record DistanceResponse(Double distanceKm, Stamp me, Stamp partner) {}
}
