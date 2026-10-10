package com.coupleapp.notification;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Expo Push API → FCM (Android) / APNs (iOS). Tối đa 100 tin mỗi request. */
@Component
public class ExpoPushSender implements PushSender {

    static final int CHUNK = 100;

    private final RestClient http;

    public ExpoPushSender(RestClient.Builder builder, @Value("${app.push.expo-url}") String url) {
        this.http = builder.baseUrl(url).build();
    }

    @Override
    public List<PushResult> send(List<PushMessage> messages) {
        List<PushResult> out = new ArrayList<>();
        for (int i = 0; i < messages.size(); i += CHUNK) {
            List<Map<String, Object>> payload = messages.subList(i, Math.min(i + CHUNK, messages.size())).stream()
                    .map(m -> Map.<String, Object>of(
                            "to", m.to(), "title", m.title(), "body", m.body(), "data", m.data(), "sound", "default"))
                    .toList();
            ExpoResponse res = http.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(ExpoResponse.class);
            if (res == null || res.data() == null || res.data().size() != payload.size()) {
                throw new IllegalStateException("Phản hồi Expo không hợp lệ");
            }
            for (ExpoTicket t : res.data()) {
                out.add("ok".equals(t.status())
                        ? PushResult.success()
                        : PushResult.failure(t.details() != null && t.details().error() != null
                                ? t.details().error() : "Unknown"));
            }
        }
        return out;
    }

    record ExpoResponse(List<ExpoTicket> data) {}

    record ExpoTicket(String status, String message, Details details) {}

    record Details(String error) {}
}
