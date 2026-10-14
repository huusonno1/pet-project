package com.coupleapp.user;

import com.coupleapp.common.ApiException;
import com.coupleapp.media.MediaService;
import com.coupleapp.user.UserDtos.UserCard;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserDirectory {

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final MediaService media;

    /** Khớp chính xác ID, người đó cho phép tìm, và không phải chính mình. */
    @Transactional(readOnly = true)
    public Optional<UserCard> findDiscoverable(UUID viewer, String rawHandle) {
        String h = Handles.normalize(rawHandle);
        if (!Handles.VALID.matcher(h).matches()) {
            return Optional.empty();
        }
        return users.findByHandleIgnoreCase(h)
                .filter(u -> !u.getId().equals(viewer))
                .filter(u -> settings.findById(u.getId()).map(UserSettings::isDiscoverable).orElse(true))
                .map(this::card);
    }

    @Transactional(readOnly = true)
    public UserCard card(UUID userId) {
        return users.findById(userId).map(this::card).orElseThrow(ApiException::notFound);
    }

    @Transactional(readOnly = true)
    public Optional<User> find(UUID userId) {
        return users.findById(userId);
    }

    UserCard card(User u) {
        String avatar = u.getAvatarMediaId() == null ? null : media.avatarUrl(u.getAvatarMediaId()).orElse(null);
        return new UserCard(u.getId(), u.getDisplayName(), u.getHandle(), avatar, u.getGender());
    }
}
