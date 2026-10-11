package com.coupleapp.moment.reminder;

import com.coupleapp.moment.Moment;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class ReminderPlanner {

    public List<ReminderPlan> plan(Moment m, MomentTypeHandler handler, PlanningContext ctx) {
        ReminderConfig cfg = handler.defaults().merge(m.getReminderConfig());
        Audience audience = handler.audience(m, cfg.recipients(), ctx);
        LocalDate from = LocalDate.ofInstant(ctx.now(), ZoneOffset.UTC).minusDays(1);
        LocalDate to = LocalDate.ofInstant(ctx.horizon(), ZoneOffset.UTC).plusDays(31); // offset tối đa 30 ngày

        List<ReminderPlan> out = new ArrayList<>();
        for (Occurrence o : handler.occurrences(m, cfg, from, to)) {
            for (Duration offset : cfg.offsetDurations()) {
                for (Role role : audience.roles()) {
                    ZoneId zone = role == Role.OWNER ? ctx.ownerZone() : ctx.partnerZone();
                    UUID recipient = role == Role.OWNER ? ctx.ownerId() : ctx.partnerId();
                    if (recipient == null) {
                        continue; // kỷ niệm riêng: không có người ấy
                    }
                    Instant fireAt = fireAt(o, offset, cfg.sendAtTime(), zone);
                    if (fireAt.isAfter(ctx.now()) && !fireAt.isAfter(ctx.horizon())) {
                        Message msg = handler.message(m, o, role, offset, ctx);
                        String link = msg.deepLink() != null ? msg.deepLink() : "coupleapp://moments/" + m.getId();
                        out.add(new ReminderPlan(recipient, role, fireAt, msg.title(), msg.body(), link));
                    }
                }
            }
        }
        return out;
    }

    static Instant fireAt(Occurrence o, Duration offset, LocalTime sendAt, ZoneId zone) {
        if (offset.toSeconds() % 86_400 == 0) {
            return o.date().minusDays(offset.toDays()).atTime(sendAt).atZone(zone).toInstant();
        }
        Instant base = o.at() != null ? o.at() : o.date().atTime(sendAt).atZone(zone).toInstant();
        return base.minus(offset);
    }
}
