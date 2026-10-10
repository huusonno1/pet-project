package com.coupleapp.media;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class MediaDtos {

    private MediaDtos() {}

    public enum Purpose { SHARED, AVATAR }

    public record UploadUrlRequest(
            @NotBlank String contentType,
            @NotNull @Positive Long sizeBytes,
            @Positive Integer width,
            @Positive Integer height,
            @Size(max = 30) String filter,
            Instant takenAt,
            @DecimalMin("-90") @DecimalMax("90") Double lat,
            @DecimalMin("-180") @DecimalMax("180") Double lng,
            Purpose purpose) {}

    public record UploadUrlResponse(
            UUID mediaId, String uploadUrl, String method, Map<String, String> headers, Instant expiresAt) {}

    public record MediaDto(UUID id, String url, Integer width, Integer height, String filter, Instant takenAt) {}
}
