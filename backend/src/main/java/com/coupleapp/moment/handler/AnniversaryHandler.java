package com.coupleapp.moment.handler;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.reminder.Audience;
import com.coupleapp.moment.reminder.Message;
import com.coupleapp.moment.reminder.MomentTypeHandler;
import com.coupleapp.moment.reminder.Occurrence;
import com.coupleapp.moment.reminder.Occurrences;
import com.coupleapp.moment.reminder.PlanningContext;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.Role;
import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;
import org.springframework.stereotype.Component;

@Component
public class AnniversaryHandler implements MomentTypeHandler {

    static final List<Integer> DEFAULT_MILESTONES = List.of(100, 200, 300, 500, 1000);

    @Override
    public MomentType type() {
        return MomentType.ANNIVERSARY;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, true, List.of("P3D", "P0D"), "08:00", Audience.BOTH);
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        LocalDate start = m.getOccursOn();
        TreeMap<LocalDate, String> byDate = new TreeMap<>();
        List<Integer> milestones = cfg.milestoneDays() != null ? cfg.milestoneDays() : defaultMilestones(start, to);
        for (int n : milestones) {
            LocalDate d = start.plusDays(n);
            if (Occurrences.within(d, from, to)) {
                byDate.merge(d, n + " ngày", (a, b) -> a + " · " + b);
            }
        }
        if (Boolean.TRUE.equals(cfg.yearly())) {
            for (int y = 1; !start.plusYears(y).isAfter(to); y++) {
                LocalDate d = start.plusYears(y);
                if (!d.isBefore(from)) {
                    byDate.merge(d, y + " năm", (a, b) -> a + " · " + b);
                }
            }
        }
        return byDate.entrySet().stream().map(e -> new Occurrence(e.getKey(), null, e.getValue())).toList();
    }

    /** 100, 200, 300, 500, 1000 rồi cứ mỗi 500 ngày. */
    static List<Integer> defaultMilestones(LocalDate start, LocalDate to) {
        List<Integer> out = new ArrayList<>(DEFAULT_MILESTONES);
        long maxDays = ChronoUnit.DAYS.between(start, to);
        for (int n = 1500; n <= maxDays; n += 500) {
            out.add(n);
        }
        return out;
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        String title = "💞 " + o.label() + " bên nhau";
        String body = offset.isZero()
                ? "Hôm nay là " + o.label() + " bên nhau của hai bạn. Chúc mừng nhé!"
                : Occurrences.capitalize(Occurrences.countdown(offset)) + " là " + o.label() + " bên nhau 🥰";
        return new Message(title, body, null);
    }
}
