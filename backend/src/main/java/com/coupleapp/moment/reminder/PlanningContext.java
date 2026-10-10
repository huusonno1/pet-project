package com.coupleapp.moment.reminder;

import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

public record PlanningContext(
        UUID ownerId,
        UUID partnerId,
        String ownerName,
        String partnerName,
        ZoneId ownerZone,
        ZoneId partnerZone,
        boolean cycleShared,
        Instant now,
        Instant horizon) {}
