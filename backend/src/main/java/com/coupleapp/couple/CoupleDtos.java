package com.coupleapp.couple;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class CoupleDtos {

    private CoupleDtos() {}

    public record InviteResponse(String code, Instant expiresAt) {}

    public record JoinRequest(@NotBlank @Size(max = 20) String code, @PastOrPresent LocalDate startedDatingOn) {}

    public record PartnerDto(UUID id, String displayName) {}

    public record CoupleResponse(UUID id, LocalDate startedDatingOn, Instant createdAt, PartnerDto partner) {}
}
