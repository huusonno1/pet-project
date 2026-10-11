package com.coupleapp.cycle;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.cycle.CycleDtos.CycleLogDto;
import com.coupleapp.cycle.CycleDtos.CycleLogRequest;
import com.coupleapp.cycle.CycleDtos.PredictionResponse;
import com.coupleapp.cycle.CyclePredictor.Prediction;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentRepository;
import com.coupleapp.moment.MomentService;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.reminder.ReminderScheduler;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CycleService {

    private final CycleLogRepository logs;
    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final CoupleAccess couples;
    private final MomentRepository moments;
    private final MomentService momentService;
    private final ReminderScheduler scheduler;
    private final Clock clock;

    @Transactional
    public CycleLogDto addLog(UUID userId, CycleLogRequest r) {
        if (!settingsOf(userId).isCycleTracking()) {
            throw invalid("Hãy bật theo dõi chu kỳ trước");
        }
        if (r.periodStart().isAfter(today(userId))) {
            throw invalid("Ngày bắt đầu không được ở tương lai");
        }
        if (r.periodEnd() != null && r.periodEnd().isBefore(r.periodStart())) {
            throw invalid("Ngày kết thúc phải sau ngày bắt đầu");
        }
        if (logs.existsByUserIdAndPeriodStart(userId, r.periodStart())) {
            throw invalid("Đã ghi kỳ bắt đầu vào ngày này");
        }
        CycleLog log = new CycleLog();
        log.setUserId(userId);
        log.setPeriodStart(r.periodStart());
        log.setPeriodEnd(r.periodEnd());
        log.setCreatedAt(clock.instant());
        logs.save(log);
        refresh(userId);
        return toDto(log);
    }

    @Transactional
    public void deleteLog(UUID userId, UUID id) {
        CycleLog log = logs.findById(id).filter(l -> l.getUserId().equals(userId)).orElseThrow(ApiException::notFound);
        logs.delete(log);
        logs.flush();
        refresh(userId);
    }

    @Transactional(readOnly = true)
    public List<CycleLogDto> logs(UUID userId) {
        return logs.findByUserIdOrderByPeriodStartDesc(userId).stream().map(CycleService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public PredictionResponse prediction(UUID viewer, UUID subject) {
        if (!viewer.equals(subject)) {
            couples.findActive(viewer).filter(c -> c.partnerId().equals(subject)).orElseThrow(ApiException::notFound);
            UserSettings s = settingsOf(subject);
            if (!s.isCycleTracking() || !s.isShareCycle()) {
                throw ApiException.notFound();
            }
        }
        return predict(subject)
                .map(p -> new PredictionResponse(p.nextStart(), p.averageLength(), p.basedOnCycles()))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Chưa có dữ liệu chu kỳ"));
    }

    @Transactional
    public void setDefaultLength(UUID userId, int days) {
        UserSettings s = settingsOf(userId);
        s.setCycleLengthDefault(days);
        settings.save(s);
        refresh(userId);
    }

    /** Tính lại ngày dự kiến và đồng bộ kỷ niệm CYCLE của user (chỉ khi đang có cặp đôi). */
    @Transactional
    public void refresh(UUID userId) {
        Optional<CoupleContext> c = couples.findActive(userId);
        if (c.isEmpty()) {
            return;
        }
        Optional<Moment> existing =
                moments.findFirstByCoupleIdAndTypeAndSubjectUserId(c.get().coupleId(), MomentType.CYCLE, userId);
        if (!settingsOf(userId).isCycleTracking()) {
            existing.ifPresent(moments::delete); // reminders xoá theo ON DELETE CASCADE
            return;
        }
        Optional<Prediction> p = predict(userId);
        if (p.isEmpty()) {
            existing.ifPresent(moments::delete);
            return;
        }
        if (existing.isPresent()) {
            Moment m = existing.get();
            m.setOccursOn(p.get().nextStart());
            m.setUpdatedAt(clock.instant());
            scheduler.replan(m);
        } else {
            momentService.createSystem(c.get().coupleId(), userId, MomentType.CYCLE, "Chu kỳ",
                    p.get().nextStart(), userId);
        }
    }

    @Transactional
    public void replanFor(UUID userId) {
        couples.findActive(userId)
                .flatMap(c -> moments.findFirstByCoupleIdAndTypeAndSubjectUserId(c.coupleId(), MomentType.CYCLE, userId))
                .ifPresent(scheduler::replan);
    }

    /** Job hằng ngày: ngày dự kiến đã qua mà chưa ghi kỳ mới → lùi sang chu kỳ kế tiếp. */
    @Transactional
    public int refreshStale() {
        List<Moment> stale = moments.findByTypeAndOccursOnBefore(MomentType.CYCLE, LocalDate.now(clock));
        stale.forEach(m -> refresh(m.getSubjectUserId()));
        return stale.size();
    }

    private Optional<Prediction> predict(UUID userId) {
        List<LocalDate> starts = logs.findByUserIdOrderByPeriodStartDesc(userId).stream()
                .map(CycleLog::getPeriodStart).toList();
        return CyclePredictor.predict(starts, settingsOf(userId).getCycleLengthDefault(), today(userId));
    }

    private UserSettings settingsOf(UUID userId) {
        return settings.findById(userId).orElseGet(() -> new UserSettings(userId));
    }

    private LocalDate today(UUID userId) {
        ZoneId zone = users.findById(userId).map(User::zone).orElse(ZoneOffset.UTC);
        return LocalDate.now(clock.withZone(zone));
    }

    private static CycleLogDto toDto(CycleLog l) {
        return new CycleLogDto(l.getId(), l.getPeriodStart(), l.getPeriodEnd());
    }

    private static ApiException invalid(String detail) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, detail);
    }
}
