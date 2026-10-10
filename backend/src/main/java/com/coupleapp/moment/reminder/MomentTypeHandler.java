package com.coupleapp.moment.reminder;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

/** Strategy cho từng loại kỷ niệm. Thêm loại mới = thêm một implementation. */
public interface MomentTypeHandler {

    MomentType type();

    ReminderConfig defaults();

    default void validate(Moment moment) {}

    List<Occurrence> occurrences(Moment moment, ReminderConfig config, LocalDate from, LocalDate to);

    Message message(Moment moment, Occurrence occurrence, Role recipient, Duration offset, PlanningContext ctx);

    default Audience audience(Moment moment, Audience requested, PlanningContext ctx) {
        return requested;
    }
}
