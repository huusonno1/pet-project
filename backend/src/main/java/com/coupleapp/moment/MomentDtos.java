package com.coupleapp.moment;

import com.coupleapp.media.MediaDtos.MediaDto;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.place.PlaceDtos.PlaceDto;
import com.coupleapp.place.PlaceDtos.PlaceInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class MomentDtos {

    private MomentDtos() {}

    public record CreateMomentRequest(
            @NotNull MomentType type,
            @NotBlank @Size(max = 200) String title,
            @NotNull LocalDate occursOn,
            Instant occursAt,
            Recurrence recurrence,
            UUID subjectUserId,
            @Size(max = 2000) String message,
            Map<String, Object> details,
            @Valid PlaceInput place,
            UUID placeId,
            @Size(max = 30) List<UUID> mediaIds,
            Boolean notifyPartner) {}

    /** Trường null = giữ nguyên. */
    public record UpdateMomentRequest(
            @Size(min = 1, max = 200) String title,
            LocalDate occursOn,
            Instant occursAt,
            Recurrence recurrence,
            UUID subjectUserId,
            @Size(max = 2000) String message,
            Map<String, Object> details,
            @Valid PlaceInput place,
            UUID placeId,
            @Size(max = 30) List<UUID> mediaIds) {}

    public record MomentResponse(
            UUID id, MomentType type, String title, LocalDate occursOn, Instant occursAt, Recurrence recurrence,
            UUID subjectUserId, String message, Map<String, Object> details,
            ReminderConfig reminderConfig, ReminderConfig effectiveReminderConfig,
            PlaceDto place, List<MediaDto> media, UUID createdBy, Instant createdAt, Instant updatedAt) {}

    public record ReminderDto(UUID id, Instant fireAt, String title, String body, String deepLink) {}
}
