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
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CycleHandler implements MomentTypeHandler {

    private static final DateTimeFormatter DAY_MONTH = DateTimeFormatter.ofPattern("dd/MM");

    @Override
    public MomentType type() {
        return MomentType.CYCLE;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of("P2D", "P0D"), "08:00", Audience.BOTH);
    }

    @Override
    public void validate(Moment m) {
        if (m.getSubjectUserId() == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Chu kỳ phải gắn với một người");
        }
    }

    /** Chủ thể tắt chia sẻ → chỉ nhắc chủ thể, bất kể cấu hình. */
    @Override
    public Audience audience(Moment m, Audience requested, PlanningContext ctx) {
        return ctx.cycleShared() ? requested : Audience.OWNER;
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return Occurrences.single(m, from, to);
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        boolean wholeDays = offset.toSeconds() % 86_400 == 0;
        if (role == Role.OWNER) {
            String body = offset.isZero()
                    ? "Hôm nay là ngày dự kiến bắt đầu chu kỳ. Nhớ giữ ấm và nghỉ ngơi nhé!"
                    : "Chu kỳ dự kiến bắt đầu khoảng ngày " + o.date().format(DAY_MONTH)
                            + " (" + Occurrences.countdown(offset) + "). Chuẩn bị sẵn nhé!";
            return new Message("🌸 Chu kỳ sắp tới", body, null);
        }
        String name = ctx.ownerName();
        String body;
        if (offset.isZero()) {
            body = "Hôm nay có thể là ngày đầu chu kỳ của " + name + ". Hỏi han, chuẩn bị đồ ấm, đồ ngọt nhé 💗";
        } else if (wholeDays) {
            body = "Khoảng " + offset.toDays() + " ngày nữa là tới ngày của " + name + ", nhớ quan tâm nhé 💗";
        } else {
            body = Occurrences.capitalize(Occurrences.countdown(offset)) + " là tới ngày của " + name + ", nhớ quan tâm nhé 💗";
        }
        return new Message("💗 Quan tâm " + name, body, null);
    }
}
