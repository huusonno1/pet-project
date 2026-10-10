package com.coupleapp.moment.reminder;

/** {@code deepLink} null → planner dùng link tới kỷ niệm. */
public record Message(String title, String body, String deepLink) {}
