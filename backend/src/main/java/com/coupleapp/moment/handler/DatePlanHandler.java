package com.coupleapp.moment.handler;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
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
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class DatePlanHandler implements MomentTypeHandler {

    @Override
    public MomentType type() {
        return MomentType.DATE_PLAN;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of("P1D", "PT2H"), "20:00", Audience.BOTH);
    }

    @Override
    public void validate(Moment m) {
        if (m.getOccursAt() == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Lịch hẹn cần có giờ hẹn (occursAt)");
        }
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return Occurrences.single(m, from, to);
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        String body = offset.isZero()
                ? "Hôm nay có hẹn: \"" + m.getTitle() + "\""
                : Occurrences.capitalize(Occurrences.countdown(offset)) + " có buổi hẹn \"" + m.getTitle() + "\"";
        return new Message("📅 " + m.getTitle(), body, null);
    }
}
