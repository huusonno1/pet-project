package com.coupleapp.couple;

import com.coupleapp.user.UserDtos.UserCard;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class CoupleDtos {

    private CoupleDtos() {}

    public record InviteResponse(String code, Instant expiresAt) {}

    public record JoinRequest(@NotBlank @Size(max = 20) String code, @PastOrPresent LocalDate startedDatingOn) {}

    public record PartnerDto(UUID id, String displayName, String handle, LocalDate birthday, String avatarUrl) {}

    public record CoupleResponse(UUID id, LocalDate startedDatingOn, Instant createdAt, PartnerDto partner) {}

    public record SendPairRequest(@NotBlank @Size(max = 40) String handle) {}

    public record AcceptPairRequest(@PastOrPresent LocalDate startedDatingOn) {}

    public record PairRequestDto(UUID id, UserCard user, Instant createdAt, Instant expiresAt) {}

    public record PairRequestsResponse(List<PairRequestDto> incoming, List<PairRequestDto> outgoing) {}
}
