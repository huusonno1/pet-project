package com.coupleapp.couple;

import java.time.LocalDate;
import java.util.UUID;

public record CouplePairedEvent(UUID coupleId, UUID inviterId, UUID joinerId, LocalDate startedDatingOn) {}
