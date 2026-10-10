package com.coupleapp.moment.reminder;

import java.time.Instant;
import java.util.UUID;

public record ReminderPlan(UUID recipientId, Role role, Instant fireAt, String title, String body, String deepLink) {}
