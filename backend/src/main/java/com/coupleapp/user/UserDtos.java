package com.coupleapp.user;

import java.time.LocalDate;
import java.util.UUID;

public final class UserDtos {

    private UserDtos() {}

    public record MeResponse(
            UUID id, String email, String displayName, LocalDate birthday, String timezone, String avatarUrl) {}
}
