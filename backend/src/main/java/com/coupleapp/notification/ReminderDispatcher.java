package com.coupleapp.notification;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentRepository;
import com.coupleapp.moment.MomentType;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReminderDispatcher {

    public static final int BATCH = 100;
    static final int MAX_ATTEMPTS = 3;
    static final String DEVICE_NOT_REGISTERED = "DeviceNotRegistered";

    private final ReminderRepository reminders;
    private final MomentRepository moments;
    private final DeviceTokenRepository devices;
    private final UserSettingsRepository settings;
    private final PushSender push;
    private final InboxService inbox;
    private final Clock clock;

    /** Xử lý một lô nhắc đến hạn. Dòng bị khoá bởi instance khác được bỏ qua (SKIP LOCKED). */
    @Transactional
    public int dispatchDue() {
        Instant now = clock.instant();
        List<Reminder> due = reminders.lockDue(now, BATCH);
        if (due.isEmpty()) {
            return 0;
        }
        Map<UUID, MomentType> types = moments.findAllById(due.stream().map(Reminder::getMomentId).distinct().toList())
                .stream().collect(Collectors.toMap(Moment::getId, Moment::getType));
        for (Reminder r : due) {
            MomentType type = types.get(r.getMomentId());
            boolean enabled = type == null || settings.findById(r.getRecipientId())
                    .map(s -> s.notifyEnabled(type.name())).orElse(true);
            if (enabled) {
                deliver(r, now);
            } else {
                r.setStatus(ReminderStatus.CANCELLED);
            }
        }
        return due.size();
    }

    private void deliver(Reminder r, Instant now) {
        List<DeviceToken> tokens = devices.findByUserId(r.getRecipientId());
        if (tokens.isEmpty()) {
            markSent(r, now);
            return;
        }
        List<PushMessage> messages = tokens.stream()
                .map(t -> PushMessage.of(t.getExpoPushToken(), r.getTitle(), r.getBody(), r.getDeepLink()))
                .toList();
        List<PushResult> results;
        try {
            results = push.send(messages);
        } catch (RuntimeException e) {
            log.warn("Gửi push thất bại cho nhắc {}", r.getId(), e);
            results = List.of();
        }
        if (results.size() != messages.size()) {
            results = messages.stream().map(m -> PushResult.failure("Transport")).toList();
        }

        boolean anyOk = false;
        boolean allDead = true;
        for (int i = 0; i < results.size(); i++) {
            PushResult res = results.get(i);
            anyOk |= res.ok();
            boolean dead = DEVICE_NOT_REGISTERED.equals(res.error());
            allDead &= dead;
            if (dead) {
                devices.delete(tokens.get(i));
            }
        }
        if (anyOk || allDead) {
            markSent(r, now); // allDead: không còn thiết bị nào nhận được, không thử lại
            return;
        }
        r.setAttempts(r.getAttempts() + 1);
        if (r.getAttempts() >= MAX_ATTEMPTS) {
            r.setStatus(ReminderStatus.FAILED);
        } else {
            r.setFireAt(now.plus(Duration.ofMinutes(5L * r.getAttempts())));
        }
    }

    private void markSent(Reminder r, Instant now) {
        r.setStatus(ReminderStatus.SENT);
        r.setSentAt(now);
        inbox.record(r.getRecipientId(), "REMINDER", r.getTitle(), r.getBody(), r.getDeepLink());
    }
}
