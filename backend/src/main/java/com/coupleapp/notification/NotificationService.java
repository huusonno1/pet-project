package com.coupleapp.notification;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Ghi hộp thông báo rồi gửi push ngay (không qua bảng reminders), dùng cho sự kiện tức thời. */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final DeviceTokenRepository devices;
    private final PushSender push;
    private final InboxService inbox;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendNow(UUID userId, String kind, String title, String body, String deepLink) {
        inbox.record(userId, kind, title, body, deepLink);
        List<DeviceToken> tokens = devices.findByUserId(userId);
        if (tokens.isEmpty()) {
            return;
        }
        List<PushMessage> messages = tokens.stream()
                .map(t -> PushMessage.of(t.getExpoPushToken(), title, body, deepLink))
                .toList();
        try {
            List<PushResult> results = push.send(messages);
            for (int i = 0; i < Math.min(results.size(), tokens.size()); i++) {
                if (ReminderDispatcher.DEVICE_NOT_REGISTERED.equals(results.get(i).error())) {
                    devices.delete(tokens.get(i));
                }
            }
        } catch (RuntimeException e) {
            log.warn("Gửi push tức thời thất bại cho {}", userId, e);
        }
    }
}
