package com.coupleapp.user;

import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class UserDtos {

    private UserDtos() {}

    public record MeResponse(
            UUID id, String email, String displayName, String handle, LocalDate birthday, String timezone,
            String avatarUrl, Gender gender) {}

    public record UpdateMeRequest(
            @Size(min = 1, max = 50) String displayName,
            @Past LocalDate birthday,
            @Size(max = 64) String timezone,
            UUID avatarMediaId,
            Gender gender) {}

    public record SettingsResponse(
            boolean shareLocation, boolean shareCycle, int cycleLengthDefault, Map<String, Boolean> notifyPrefs,
            boolean discoverable, boolean cycleTracking) {}

    public record UpdateSettingsRequest(
            Boolean shareLocation, Boolean shareCycle, Map<String, Boolean> notifyPrefs,
            Boolean discoverable, Boolean cycleTracking) {}

    public record UserCard(UUID id, String displayName, String handle, String avatarUrl, Gender gender) {}
}
