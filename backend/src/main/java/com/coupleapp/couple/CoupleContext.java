package com.coupleapp.couple;

import java.util.UUID;

/** Cặp đôi đang hoạt động nhìn từ góc của {@code userId}. */
public record CoupleContext(UUID coupleId, UUID userId, UUID partnerId) {}
