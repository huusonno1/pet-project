package com.coupleapp.couple;

import java.util.UUID;

public record PairRequestedEvent(UUID requestId, UUID requesterId, UUID targetId) {}
