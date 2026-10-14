package com.coupleapp.user;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.media.MediaService;
import com.coupleapp.user.UserDtos.MeResponse;
import com.coupleapp.user.UserDtos.SettingsResponse;
import com.coupleapp.user.UserDtos.UpdateMeRequest;
import com.coupleapp.user.UserDtos.UpdateSettingsRequest;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MeService {

    private static final Pattern PREF_KEY = Pattern.compile("^[A-Z_]{1,40}$");

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final MediaService media;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional(readOnly = true)
    public MeResponse get(UUID userId) {
        return toResponse(load(userId));
    }

    @Transactional
    public MeResponse update(UUID userId, UpdateMeRequest r) {
        User u = load(userId);
        if (r.displayName() != null) {
            u.setDisplayName(r.displayName().trim());
        }
        if (r.birthday() != null) {
            u.setBirthday(r.birthday());
        }
        if (r.timezone() != null) {
            try {
                ZoneId.of(r.timezone());
            } catch (DateTimeException e) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "Múi giờ không hợp lệ");
            }
            u.setTimezone(r.timezone());
        }
        if (r.avatarMediaId() != null) {
            media.requireAvatar(userId, r.avatarMediaId());
            u.setAvatarMediaId(r.avatarMediaId());
        }
        if (r.gender() != null && r.gender() != u.getGender()) {
            u.setGender(r.gender());
            if (r.gender() != Gender.FEMALE) {
                stopCycleTracking(userId); // dữ liệu chu kỳ vẫn giữ, đổi lại Nữ thì bật lại được
            }
        }
        u.setUpdatedAt(clock.instant());
        return toResponse(u);
    }

    @Transactional(readOnly = true)
    public SettingsResponse getSettings(UUID userId) {
        return toResponse(settings.findById(userId).orElseGet(() -> new UserSettings(userId)));
    }

    @Transactional
    public SettingsResponse updateSettings(UUID userId, UpdateSettingsRequest r) {
        UserSettings s = settings.findById(userId).orElseGet(() -> new UserSettings(userId));
        boolean locationBefore = s.isShareLocation();
        boolean cycleBefore = s.isShareCycle();
        boolean trackingBefore = s.isCycleTracking();
        if (r.shareLocation() != null) {
            s.setShareLocation(r.shareLocation());
        }
        if (r.shareCycle() != null) {
            s.setShareCycle(r.shareCycle());
        }
        if (r.discoverable() != null) {
            s.setDiscoverable(r.discoverable());
        }
        if (r.cycleTracking() != null) {
            if (r.cycleTracking() && load(userId).getGender() != Gender.FEMALE) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "Chỉ tài khoản nữ mới theo dõi chu kỳ");
            }
            s.setCycleTracking(r.cycleTracking());
        }
        if (r.notifyPrefs() != null) {
            for (Map.Entry<String, Boolean> e : r.notifyPrefs().entrySet()) {
                if (!PREF_KEY.matcher(e.getKey()).matches() || e.getValue() == null) {
                    throw new ApiException(ErrorCode.VALIDATION_FAILED, "Cấu hình thông báo không hợp lệ");
                }
            }
            s.getNotifyPrefs().putAll(r.notifyPrefs());
        }
        settings.save(s);
        events.publishEvent(new UserSettingsChangedEvent(
                userId, s.isShareLocation(), s.isShareCycle(),
                locationBefore != s.isShareLocation(), cycleBefore != s.isShareCycle(),
                trackingBefore != s.isCycleTracking()));
        return toResponse(s);
    }

    private void stopCycleTracking(UUID userId) {
        settings.findById(userId).filter(UserSettings::isCycleTracking).ifPresent(s -> {
            s.setCycleTracking(false);
            settings.save(s);
            events.publishEvent(new UserSettingsChangedEvent(
                    userId, s.isShareLocation(), s.isShareCycle(), false, false, true));
        });
    }

    User load(UUID userId) {
        return users.findById(userId).orElseThrow(ApiException::notFound);
    }

    MeResponse toResponse(User u) {
        String avatarUrl = u.getAvatarMediaId() == null ? null : media.avatarUrl(u.getAvatarMediaId()).orElse(null);
        return new MeResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getHandle(), u.getBirthday(),
                u.getTimezone(), avatarUrl, u.getGender());
    }

    private static SettingsResponse toResponse(UserSettings s) {
        return new SettingsResponse(
                s.isShareLocation(), s.isShareCycle(), s.getCycleLengthDefault(), Map.copyOf(s.getNotifyPrefs()),
                s.isDiscoverable(), s.isCycleTracking());
    }
}
