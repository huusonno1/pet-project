package com.coupleapp.moment;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.media.MediaService;
import com.coupleapp.moment.MomentDtos.CreateMomentRequest;
import com.coupleapp.moment.MomentDtos.MomentResponse;
import com.coupleapp.moment.MomentDtos.ReminderDto;
import com.coupleapp.moment.MomentDtos.UpdateMomentRequest;
import com.coupleapp.moment.reminder.ReminderConfig;
import com.coupleapp.moment.reminder.ReminderScheduler;
import com.coupleapp.notification.ReminderRepository;
import com.coupleapp.notification.ReminderStatus;
import com.coupleapp.place.PlaceDtos.PlaceInput;
import com.coupleapp.place.PlaceService;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MomentService {

    private final MomentRepository moments;
    private final ReminderScheduler scheduler;
    private final ReminderRepository reminders;
    private final CoupleAccess couples;
    private final PlaceService places;
    private final MediaService media;
    private final UserSettingsRepository settings;
    private final Clock clock;

    @Transactional
    public MomentResponse create(UUID userId, CreateMomentRequest r) {
        CoupleContext c = couples.requireActive(userId);
        if (r.type() == MomentType.CYCLE) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Chu kỳ được quản lý qua /api/cycles");
        }
        Instant now = clock.instant();
        Moment m = new Moment();
        m.setCoupleId(c.coupleId());
        m.setType(r.type());
        m.setTitle(r.title().trim());
        m.setOccursOn(r.occursOn());
        m.setOccursAt(r.occursAt());
        m.setRecurrence(r.recurrence() != null ? r.recurrence()
                : r.type() == MomentType.GIFT_OCCASION ? Recurrence.YEARLY : Recurrence.NONE);
        m.setSubjectUserId(checkSubject(c, r.subjectUserId()));
        m.setMessage(r.message());
        m.setDetails(r.details() != null ? new HashMap<>(r.details()) : new HashMap<>());
        applyPlace(m, c, userId, r.place(), r.placeId());
        applyMedia(m, c, r.mediaIds());
        m.setCreatedBy(userId);
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        scheduler.handler(m.getType()).validate(m);
        moments.save(m);
        scheduler.replan(m);
        return toResponse(m);
    }

    /** Tạo kỷ niệm do hệ thống sinh (ngày yêu khi ghép đôi, chu kỳ). */
    @Transactional
    public Moment createSystem(UUID coupleId, UUID createdBy, MomentType type, String title,
                               LocalDate occursOn, UUID subjectUserId) {
        Instant now = clock.instant();
        Moment m = new Moment();
        m.setCoupleId(coupleId);
        m.setType(type);
        m.setTitle(title);
        m.setOccursOn(occursOn);
        m.setSubjectUserId(subjectUserId);
        m.setCreatedBy(createdBy);
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        scheduler.handler(type).validate(m);
        moments.save(m);
        scheduler.replan(m);
        return m;
    }

    @Transactional
    public MomentResponse update(UUID userId, UUID id, UpdateMomentRequest r) {
        CoupleContext c = couples.requireActive(userId);
        Moment m = loadEditable(c, id);
        if (r.title() != null) m.setTitle(r.title().trim());
        if (r.occursOn() != null) m.setOccursOn(r.occursOn());
        if (r.occursAt() != null) m.setOccursAt(r.occursAt());
        if (r.recurrence() != null) m.setRecurrence(r.recurrence());
        if (r.subjectUserId() != null) m.setSubjectUserId(checkSubject(c, r.subjectUserId()));
        if (r.message() != null) m.setMessage(r.message());
        if (r.details() != null) m.setDetails(new HashMap<>(r.details()));
        applyPlace(m, c, userId, r.place(), r.placeId());
        if (r.mediaIds() != null) applyMedia(m, c, r.mediaIds());
        m.setUpdatedAt(clock.instant());
        scheduler.handler(m.getType()).validate(m);
        scheduler.replan(m);
        return toResponse(m);
    }

    @Transactional
    public MomentResponse setReminderConfig(UUID userId, UUID id, ReminderConfig config) {
        CoupleContext c = couples.requireActive(userId);
        Moment m = loadEditable(c, id);
        if (config != null) {
            config.validate();
        }
        m.setReminderConfig(config);
        m.setUpdatedAt(clock.instant());
        scheduler.replan(m);
        return toResponse(m);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        CoupleContext c = couples.requireActive(userId);
        moments.delete(loadEditable(c, id));
    }

    @Transactional(readOnly = true)
    public MomentResponse get(UUID userId, UUID id) {
        return toResponse(loadVisible(couples.requireActive(userId), id));
    }

    @Transactional(readOnly = true)
    public List<MomentResponse> list(UUID userId, MomentType type, LocalDate from, LocalDate to) {
        CoupleContext c = couples.requireActive(userId);
        return moments.findByCoupleIdOrderByOccursOnAsc(c.coupleId()).stream()
                .filter(m -> type == null || m.getType() == type)
                .filter(m -> from == null || !m.getOccursOn().isBefore(from))
                .filter(m -> to == null || !m.getOccursOn().isAfter(to))
                .filter(m -> visible(m, userId))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ReminderDto> upcomingReminders(UUID userId, UUID id) {
        Moment m = loadVisible(couples.requireActive(userId), id);
        return reminders.findByMomentIdAndRecipientIdAndStatusOrderByFireAtAsc(m.getId(), userId, ReminderStatus.PENDING)
                .stream()
                .map(r -> new ReminderDto(r.getId(), r.getFireAt(), r.getTitle(), r.getBody(), r.getDeepLink()))
                .toList();
    }

    private Moment loadVisible(CoupleContext c, UUID id) {
        return moments.findById(id)
                .filter(m -> m.getCoupleId().equals(c.coupleId()))
                .filter(m -> visible(m, c.userId()))
                .orElseThrow(ApiException::notFound);
    }

    /** Kỷ niệm chu kỳ chỉ chủ thể được sửa. */
    private Moment loadEditable(CoupleContext c, UUID id) {
        Moment m = loadVisible(c, id);
        if (m.getType() == MomentType.CYCLE && !c.userId().equals(m.getSubjectUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Chỉ chủ thể được sửa dữ liệu chu kỳ");
        }
        return m;
    }

    private boolean visible(Moment m, UUID viewer) {
        if (m.getType() != MomentType.CYCLE || viewer.equals(m.getSubjectUserId())) {
            return true;
        }
        return settings.findById(m.getSubjectUserId()).map(UserSettings::isShareCycle).orElse(true);
    }

    private static UUID checkSubject(CoupleContext c, UUID subject) {
        if (subject != null && !subject.equals(c.userId()) && !subject.equals(c.partnerId())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Người được nhắc tới phải là bạn hoặc người yêu");
        }
        return subject;
    }

    private void applyPlace(Moment m, CoupleContext c, UUID userId, PlaceInput place, UUID placeId) {
        if (place != null) {
            m.setPlaceId(places.create(c.coupleId(), userId, place).getId());
        } else if (placeId != null) {
            m.setPlaceId(places.require(placeId, c.coupleId()).getId());
        }
    }

    private void applyMedia(Moment m, CoupleContext c, List<UUID> ids) {
        List<UUID> list = ids != null ? ids : List.of();
        media.requireUsable(list, c.coupleId());
        m.getMediaIds().clear();
        m.getMediaIds().addAll(list);
    }

    private MomentResponse toResponse(Moment m) {
        return new MomentResponse(
                m.getId(), m.getType(), m.getTitle(), m.getOccursOn(), m.getOccursAt(), m.getRecurrence(),
                m.getSubjectUserId(), m.getMessage(), m.getDetails(),
                m.getReminderConfig(), scheduler.effectiveConfig(m),
                places.find(m.getPlaceId()).orElse(null),
                media.dtos(new ArrayList<>(m.getMediaIds())),
                m.getCreatedBy(), m.getCreatedAt(), m.getUpdatedAt());
    }
}
