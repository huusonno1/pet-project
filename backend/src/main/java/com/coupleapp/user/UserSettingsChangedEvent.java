package com.coupleapp.user;

import java.util.UUID;

public record UserSettingsChangedEvent(
        UUID userId,
        boolean shareLocation,
        boolean shareCycle,
        boolean shareLocationChanged,
        boolean shareCycleChanged) {}
