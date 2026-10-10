package com.coupleapp.moment.reminder;

import java.time.Instant;
import java.time.LocalDate;

/** Một lần sự kiện diễn ra. {@code at} chỉ có khi sự kiện có giờ cụ thể. */
public record Occurrence(LocalDate date, Instant at, String label) {}
