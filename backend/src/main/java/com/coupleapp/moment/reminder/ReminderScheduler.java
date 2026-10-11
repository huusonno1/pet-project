package com.coupleapp.moment.reminder;

import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentRepository;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.Recurrence;
import com.coupleapp.notification.Reminder;
import com.coupleapp.notification.ReminderRepository;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Chuyển kế hoạch nhắc của một kỷ niệm thành các dòng {@code reminders}. */
@Service
public class ReminderScheduler {

    static final Duration HORIZON = Duration.ofDays(400);

    private final Map<MomentType, MomentTypeHandler> handlers = new EnumMap<>(MomentType.class);
    private final ReminderPlanner planner;
    private final ReminderRepository reminders;
    private final MomentRepository moments;
    private final CoupleAccess couples;
    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final Clock clock;

    public ReminderScheduler(List<MomentTypeHandler> handlerList, ReminderPlanner planner,
                             ReminderRepository reminders, MomentRepository moments, CoupleAccess couples,
                             UserRepository users, UserSettingsRepository settings, Clock clock) {
        handlerList.forEach(h -> handlers.put(h.type(), h));
        this.planner = planner;
        this.reminders = reminders;
        this.moments = moments;
        this.couples = couples;
        this.users = users;
        this.settings = settings;
        this.clock = clock;
    }

    public MomentTypeHandler handler(MomentType type) {
        MomentTypeHandler h = handlers.get(type);
        if (h == null) {
            throw new IllegalStateException("Chưa có handler cho " + type);
        }
        return h;
    }

    public ReminderConfig effectiveConfig(Moment m) {
        return handler(m.getType()).defaults().merge(m.getReminderConfig());
    }

    /** Huỷ nhắc chưa gửi rồi sinh lại theo cấu hình hiện tại. Cặp đôi đã kết thúc → chỉ huỷ. */
    @Transactional
    public void replan(Moment m) {
        reminders.cancelPendingByMoment(m.getId());
        Optional<CoupleContext> active = couples.findActive(m.ownerId())
                .filter(c -> c.coupleId().equals(m.getCoupleId()));
        if (active.isEmpty()) {
            return;
        }
        CoupleContext c = active.get();
        User owner = users.findById(c.userId()).orElseThrow();
        User partner = users.findById(c.partnerId()).orElseThrow();
        boolean cycleShared = settings.findById(owner.getId()).map(UserSettings::isShareCycle).orElse(true);
        Instant now = clock.instant();
        PlanningContext ctx = new PlanningContext(owner.getId(), partner.getId(), owner.getDisplayName(),
                partner.getDisplayName(), owner.zone(), partner.zone(), cycleShared, now, now.plus(HORIZON));

        for (ReminderPlan p : planner.plan(m, handler(m.getType()), ctx)) {
            Reminder r = new Reminder();
            r.setCoupleId(m.getCoupleId());
            r.setMomentId(m.getId());
            r.setRecipientId(p.recipientId());
            r.setFireAt(p.fireAt());
            r.setTitle(p.title());
            r.setBody(p.body());
            r.setDeepLink(p.deepLink());
            r.setCreatedAt(now);
            reminders.save(r);
        }
    }

    /** Job hằng ngày: kéo dài lịch nhắc của kỷ niệm lặp lại để luôn phủ đủ horizon. */
    @Transactional
    public int replanAllRecurring() {
        List<Moment> recurring = moments.findRecurring(
                EnumSet.of(MomentType.ANNIVERSARY, MomentType.GIFT_OCCASION, MomentType.CYCLE),
                EnumSet.of(Recurrence.WEEKLY, Recurrence.MONTHLY, Recurrence.YEARLY));
        recurring.forEach(this::replan);
        return recurring.size();
    }
}
