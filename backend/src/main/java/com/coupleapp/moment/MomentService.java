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
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
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
    private final ApplicationEventPublisher events;

    @Transactional
    public MomentResponse create(UUID userId, CreateMomentRequest r) {
        Optional<CoupleContext> active = couples.findActive(userId);
        CoupleContext c = active.orElse(null);
        if (c == null) {
            requirePersonalAllowed(r.type(), r.subjectUserId(), userId, r.place(), r.placeId());
        }
        if (r.type() == MomentType.CYCLE) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Chu kỳ được quản lý qua /api/cycles");
        }
        Instant now = clock.instant();
        Moment m = new Moment();
        m.setCoupleId(c != null ? c.coupleId() : null);
        m.setType(r.type());
        m.setTitle(r.title().trim());
        m.setOccursOn(r.occursOn());
        m.setOccursAt(r.occursAt());
        m.setRecurrence(normalizeRecurrence(r.type(), r.recurrence()));
        m.setSubjectUserId(c != null ? checkSubject(c, r.subjectUserId()) : null);
        m.setMessage(r.message());
        m.setDetails(r.details() != null ? new HashMap<>(r.details()) : new HashMap<>());
        applyPlace(m, c, userId, r.place(), r.placeId());
        applyMedia(m, c, userId, r.mediaIds());
        m.setCreatedBy(userId);
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        scheduler.handler(m.getType()).validate(m);
        moments.save(m);
        scheduler.replan(m);
        if (c != null && m.getType() == MomentType.MOMENT && Boolean.TRUE.equals(r.notifyPartner())) {
            Object mood = m.getDetails().get("mood");
            events.publishEvent(new MomentCapturedEvent(m.getId(), userId, c.partnerId(),
                    mood == null ? null : mood.toString()));
        }
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
        Moment m = loadEditable(userId, id);
        CoupleContext c = m.getCoupleId() == null ? null : couples.requireActive(userId);
        if (c == null) {
            requirePersonalAllowed(m.getType(), r.subjectUserId(), userId, r.place(), r.placeId());
        }
        if (r.title() != null) m.setTitle(r.title().trim());
        if (r.occursOn() != null) m.setOccursOn(r.occursOn());
        if (r.occursAt() != null) m.setOccursAt(r.occursAt());
        if (r.recurrence() != null) m.setRecurrence(normalizeRecurrence(m.getType(), r.recurrence()));
        if (r.subjectUserId() != null && c != null) m.setSubjectUserId(checkSubject(c, r.subjectUserId()));
        if (r.message() != null) m.setMessage(r.message());
        if (r.details() != null) m.setDetails(new HashMap<>(r.details()));
        applyPlace(m, c, userId, r.place(), r.placeId());
        if (r.mediaIds() != null) applyMedia(m, c, userId, r.mediaIds());
        m.setUpdatedAt(clock.instant());
        scheduler.handler(m.getType()).validate(m);
        scheduler.replan(m);
        return toResponse(m);
    }

    @Transactional
    public MomentResponse setReminderConfig(UUID userId, UUID id, ReminderConfig config) {
        Moment m = loadEditable(userId, id);
        if (m.getType() == MomentType.MOMENT) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Khoảnh khắc không có nhắc nhở");
        }
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
        moments.delete(loadEditable(userId, id));
    }

    @Transactional(readOnly = true)
    public MomentResponse get(UUID userId, UUID id) {
        return toResponse(loadVisible(userId, id));
    }

    @Transactional(readOnly = true)
    public List<MomentResponse> list(UUID userId, MomentType type, LocalDate from, LocalDate to) {
        Stream<Moment> shared = couples.findActive(userId)
                .map(c -> moments.findByCoupleIdOrderByOccursOnAsc(c.coupleId()).stream()
                        .filter(m -> visible(m, userId)))
                .orElseGet(Stream::empty);
        Stream<Moment> personal = moments.findByCoupleIdIsNullAndCreatedByOrderByOccursOnAsc(userId).stream();
        return Stream.concat(shared, personal)
                .filter(m -> type == null || m.getType() == type)
                .filter(m -> from == null || !m.getOccursOn().isBefore(from))
                .filter(m -> to == null || !m.getOccursOn().isAfter(to))
                .sorted(Comparator.comparing(Moment::getOccursOn))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ReminderDto> upcomingReminders(UUID userId, UUID id) {
        Moment m = loadVisible(userId, id);
        return reminders.findByMomentIdAndRecipientIdAndStatusOrderByFireAtAsc(m.getId(), userId, ReminderStatus.PENDING)
                .stream()
                .map(r -> new ReminderDto(r.getId(), r.getFireAt(), r.getTitle(), r.getBody(), r.getDeepLink()))
                .toList();
    }

    private Moment loadVisible(UUID userId, UUID id) {
        Moment m = moments.findById(id).orElseThrow(ApiException::notFound);
        if (m.getCoupleId() == null) {
            if (!m.getCreatedBy().equals(userId)) throw ApiException.notFound();
            return m;
        }
        CoupleContext c = couples.findActive(userId).orElseThrow(ApiException::notFound);
        if (!m.getCoupleId().equals(c.coupleId()) || !visible(m, userId)) throw ApiException.notFound();
        return m;
    }

    /** Kỷ niệm chu kỳ chỉ chủ thể được sửa. */
    private Moment loadEditable(UUID userId, UUID id) {
        Moment m = loadVisible(userId, id);
        if (m.getType() == MomentType.CYCLE && !userId.equals(m.getSubjectUserId())) {
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

    /** WEEKLY/MONTHLY chỉ cho CUSTOM và DATE_PLAN; GIFT_OCCASION mặc định YEARLY. */
    static Recurrence normalizeRecurrence(MomentType type, Recurrence requested) {
        Recurrence r = requested != null ? requested
                : type == MomentType.GIFT_OCCASION ? Recurrence.YEARLY : Recurrence.NONE;
        boolean repeating = r == Recurrence.WEEKLY || r == Recurrence.MONTHLY;
        if (repeating && type != MomentType.CUSTOM && type != MomentType.DATE_PLAN) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Chỉ kỷ niệm tự do và lịch hẹn mới lặp theo tuần/tháng");
        }
        return type == MomentType.MOMENT ? Recurrence.NONE : r;
    }

    private static final Set<MomentType> PERSONAL_TYPES = EnumSet.of(MomentType.MOMENT, MomentType.CUSTOM);

    private static void requirePersonalAllowed(MomentType type, UUID subject, UUID userId,
                                               PlaceInput place, UUID placeId) {
        if (!PERSONAL_TYPES.contains(type)) {
            throw new ApiException(ErrorCode.COUPLE_REQUIRED, "Loại kỷ niệm này cần ghép đôi");
        }
        if (subject != null && !subject.equals(userId)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Kỷ niệm riêng chỉ nói về chính bạn");
        }
        if (place != null || placeId != null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Cần ghép đôi để gắn địa điểm");
        }
    }

    private static UUID checkSubject(CoupleContext c, UUID subject) {
        if (subject != null && !subject.equals(c.userId()) && !subject.equals(c.partnerId())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Người được nhắc tới phải là bạn hoặc người yêu");
        }
        return subject;
    }

    private void applyPlace(Moment m, CoupleContext c, UUID userId, PlaceInput place, UUID placeId) {
        if (c == null) {
            return; // requirePersonalAllowed đã chặn địa điểm cho kỷ niệm riêng
        }
        if (place != null) {
            m.setPlaceId(places.create(c.coupleId(), userId, place).getId());
        } else if (placeId != null) {
            m.setPlaceId(places.require(placeId, c.coupleId()).getId());
        }
    }

    private void applyMedia(Moment m, CoupleContext c, UUID userId, List<UUID> ids) {
        List<UUID> list = ids != null ? ids : List.of();
        media.requireUsable(list, c != null ? c.coupleId() : null, userId);
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
                m.getCreatedBy(), m.getCreatedAt(), m.getUpdatedAt(), m.getCoupleId() == null);
    }
}
