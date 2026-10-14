package com.coupleapp.notification;

import java.time.Instant;
import java.util.UUID;

public final class InboxDtos {

    private InboxDtos() {}

    public record InboxDto(UUID id, String kind, String title, String body, String deepLink, Instant readAt,
                           Instant createdAt) {}

    public record UnreadCount(long count) {}
}
