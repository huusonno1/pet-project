package com.coupleapp.moment.handler;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
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
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class GiftOccasionHandler implements MomentTypeHandler {

    static final Set<String> OCCASIONS =
            Set.of("BIRTHDAY", "VALENTINE", "WOMENS_DAY_8_3", "WOMENS_DAY_20_10", "CHRISTMAS", "OTHER");

    @Override
    public MomentType type() {
        return MomentType.GIFT_OCCASION;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of("P7D", "P1D"), "08:00", Audience.PARTNER);
    }

    @Override
    public void validate(Moment m) {
        if (m.getSubjectUserId() == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Cần chọn người nhận quà (subjectUserId)");
        }
        if (!(m.getDetails().get("occasion") instanceof String occasion) || !OCCASIONS.contains(occasion)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Dịp tặng quà không hợp lệ (details.occasion)");
        }
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return m.getRecurrence() == Recurrence.YEARLY
                ? Occurrences.yearly(m, from, to)
                : Occurrences.single(m, from, to);
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        String when = Occurrences.capitalize(Occurrences.countdown(offset));
        if (role == Role.OWNER) {
            String body = offset.isZero()
                    ? "Hôm nay là " + m.getTitle() + " của bạn 🎉"
                    : when + " là " + m.getTitle() + " của bạn 🎉";
            return new Message("🎉 " + m.getTitle(), body, null);
        }
        String body = offset.isZero()
                ? "Hôm nay là " + m.getTitle() + " của " + ctx.ownerName() + ". Đừng quên quà nhé!"
                : when + " là " + m.getTitle() + " của " + ctx.ownerName() + ". Xem gợi ý quà trong mục Đặc điểm nhé!";
        return new Message("🎁 " + m.getTitle(), body, "coupleapp://traits/" + ctx.ownerId());
    }
}
