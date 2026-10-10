package com.coupleapp.place;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class PlaceDtos {

    private PlaceDtos() {}

    public record PlaceInput(
            @NotBlank @Size(max = 200) String name,
            @Size(max = 500) String address,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
            @Pattern(regexp = "^[A-Z_]{2,30}$") String category) {}

    public record PlaceDto(UUID id, String name, String address, double lat, double lng, String category) {}
}
