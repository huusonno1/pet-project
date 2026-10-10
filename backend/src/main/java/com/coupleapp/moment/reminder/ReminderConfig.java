package com.coupleapp.moment.reminder;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import java.time.Duration;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/** Mọi trường đều tuỳ chọn; trường null nghĩa là "dùng mặc định". */
public record ReminderConfig(
        List<Integer> milestoneDays,
        Boolean yearly,
        List<String> offsets,
        String sendAt,
        Audience recipients) {

    static final int MAX_MILESTONES = 20;
    static final int MAX_OFFSETS = 5;
    static final Duration MAX_OFFSET = Duration.ofDays(30);

    public ReminderConfig merge(ReminderConfig override) {
        if (override == null) {
            return this;
        }
        return new ReminderConfig(
                override.milestoneDays != null ? override.milestoneDays : milestoneDays,
                override.yearly != null ? override.yearly : yearly,
                override.offsets != null ? override.offsets : offsets,
                override.sendAt != null ? override.sendAt : sendAt,
                override.recipients != null ? override.recipients : recipients);
    }

    public void validate() {
        if (milestoneDays != null && (milestoneDays.size() > MAX_MILESTONES
                || milestoneDays.stream().anyMatch(d -> d == null || d < 1 || d > 36_500))) {
            throw invalid("Tối đa 20 mốc ngày, mỗi mốc từ 1 đến 36500");
        }
        if (offsets != null) {
            if (offsets.size() > MAX_OFFSETS) {
                throw invalid("Tối đa 5 lần nhắc");
            }
            for (String o : offsets) {
                Duration d;
                try {
                    d = Duration.parse(o);
                } catch (DateTimeParseException | NullPointerException e) {
                    throw invalid("Thời điểm nhắc không hợp lệ: " + o);
                }
                if (d.isNegative() || d.compareTo(MAX_OFFSET) > 0) {
                    throw invalid("Chỉ nhắc trước tối đa 30 ngày");
                }
            }
        }
        if (sendAt != null) {
            try {
                LocalTime.parse(sendAt);
            } catch (DateTimeParseException e) {
                throw invalid("Giờ gửi phải có dạng HH:mm");
            }
        }
    }

    public List<Duration> offsetDurations() {
        return offsets == null ? List.of() : offsets.stream().map(Duration::parse).toList();
    }

    public LocalTime sendAtTime() {
        return LocalTime.parse(sendAt);
    }

    private static ApiException invalid(String detail) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, detail);
    }
}
