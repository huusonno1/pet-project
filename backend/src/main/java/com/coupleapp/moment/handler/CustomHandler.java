package com.coupleapp.moment.handler;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.Recurrence;
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
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CustomHandler implements MomentTypeHandler {

    @Override
    public MomentType type() {
        return MomentType.CUSTOM;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of("P1D", "P0D"), "08:00", Audience.OWNER);
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return m.getRecurrence() == Recurrence.YEARLY
                ? Occurrences.yearly(m, from, to)
                : Occurrences.single(m, from, to);
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        String body = offset.isZero()
                ? "Hôm nay: " + m.getTitle()
                : Occurrences.capitalize(Occurrences.countdown(offset)) + ": " + m.getTitle();
        return new Message("🔔 " + m.getTitle(), body, null);
    }
}
