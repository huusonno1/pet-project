package com.coupleapp.moment.handler;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.reminder.Audience;
import com.coupleapp.moment.reminder.Message;
import com.coupleapp.moment.reminder.MomentTypeHandler;
import com.coupleapp.moment.reminder.Occurrence;
import com.coupleapp.moment.reminder.PlanningContext;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.Role;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Khoảnh khắc: lưu vào Nhật ký, không nhắc, không lặp. */
@Component
public class MomentHandler implements MomentTypeHandler {

    public static final Set<String> MOODS = Set.of("MISSING", "HAPPY", "PEACEFUL", "GRATEFUL", "SAD", "OTHER");

    private static final Map<String, String> LABELS = Map.of(
            "MISSING", "nhớ nhung", "HAPPY", "hạnh phúc", "PEACEFUL", "bình yên",
            "GRATEFUL", "biết ơn", "SAD", "buồn một chút");

    @Override
    public MomentType type() {
        return MomentType.MOMENT;
    }

    @Override
    public ReminderConfig defaults() {
        return new ReminderConfig(null, null, List.of(), "08:00", Audience.OWNER);
    }

    @Override
    public void validate(Moment m) {
        Object mood = m.getDetails().get("mood");
        if (mood != null && !MOODS.contains(mood.toString())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Cảm xúc không hợp lệ");
        }
    }

    @Override
    public List<Occurrence> occurrences(Moment m, ReminderConfig cfg, LocalDate from, LocalDate to) {
        return List.of();
    }

    @Override
    public Message message(Moment m, Occurrence o, Role role, Duration offset, PlanningContext ctx) {
        throw new IllegalStateException("Khoảnh khắc không có nhắc nhở");
    }

    /** "MISSING" → "nhớ nhung"; không có / OTHER → chuỗi rỗng. */
    public static String moodLabel(String code) {
        return code == null ? "" : LABELS.getOrDefault(code, "");
    }
}
