package com.coupleapp.notification;

import java.util.Map;

public record PushMessage(String to, String title, String body, Map<String, Object> data) {

    public static PushMessage of(String to, String title, String body, String deepLink) {
        Map<String, Object> data = deepLink == null ? Map.of() : Map.<String, Object>of("url", deepLink);
        return new PushMessage(to, title, body, data);
    }
}
