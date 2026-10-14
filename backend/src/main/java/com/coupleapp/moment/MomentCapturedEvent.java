package com.coupleapp.moment;

import java.util.UUID;

public record MomentCapturedEvent(UUID momentId, UUID authorId, UUID partnerId, String mood) {}
