package com.coupleapp.trait;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class TraitDtos {

    private TraitDtos() {}

    static final String CODE = "^[A-Z][A-Z0-9_]{1,39}$";
    static final String URL = "^https?://\\S{3,2000}$";

    public record SizeRequest(
            @NotNull UUID subjectUserId,
            @NotBlank @Pattern(regexp = CODE) String kind,
            @NotBlank @Size(max = 50) String value,
            @Size(max = 500) String note,
            Visibility visibility) {}

    public record SizePatch(
            @Pattern(regexp = CODE) String kind,
            @Size(min = 1, max = 50) String value,
            @Size(max = 500) String note,
            Visibility visibility) {}

    public record LinkInput(
            @NotBlank @Pattern(regexp = URL) String url,
            @Size(max = 50) String label,
            @PositiveOrZero Long price) {}

    public record PreferenceRequest(
            @NotNull UUID subjectUserId,
            @NotBlank @Pattern(regexp = CODE) String category,
            @Size(max = 100) String brand,
            @Size(max = 200) String name,
            @Size(max = 50) String color,
            @Size(max = 1000) String note,
            Visibility visibility,
            @Valid @Size(max = 10) List<LinkInput> links) {}

    public record PreferencePatch(
            @Pattern(regexp = CODE) String category,
            @Size(max = 100) String brand,
            @Size(max = 200) String name,
            @Size(max = 50) String color,
            @Size(max = 1000) String note,
            Visibility visibility,
            @Valid @Size(max = 10) List<LinkInput> links) {}

    public record SizeDto(UUID id, UUID subjectUserId, String kind, String value, String note,
                          Visibility visibility, UUID createdBy, Instant updatedAt) {}

    public record LinkDto(UUID id, String url, String label, Long price) {}

    public record PreferenceDto(UUID id, UUID subjectUserId, String category, String brand, String name,
                                String color, String note, Visibility visibility, UUID createdBy,
                                Instant updatedAt, List<LinkDto> links) {}

    public record TraitsResponse(List<SizeDto> sizes, List<PreferenceDto> preferences) {}

    public record CatalogItem(String code, String label) {}

    public record CatalogResponse(List<CatalogItem> sizeKinds, List<CatalogItem> preferenceCategories) {}
}
