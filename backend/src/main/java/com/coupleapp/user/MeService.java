package com.coupleapp.user;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
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
        if (r.shareLocation() != null) {
            s.setShareLocation(r.shareLocation());
        }
        if (r.shareCycle() != null) {
            s.setShareCycle(r.shareCycle());
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
                locationBefore != s.isShareLocation(), cycleBefore != s.isShareCycle()));
        return toResponse(s);
    }

    User load(UUID userId) {
        return users.findById(userId).orElseThrow(ApiException::notFound);
    }

    MeResponse toResponse(User u) {
        return new MeResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getBirthday(), u.getTimezone(), null);
    }

    private static SettingsResponse toResponse(UserSettings s) {
        return new SettingsResponse(
                s.isShareLocation(), s.isShareCycle(), s.getCycleLengthDefault(), Map.copyOf(s.getNotifyPrefs()));
    }
}
