package com.coupleapp.user;

import com.coupleapp.common.ApiException;
import com.coupleapp.user.UserDtos.MeResponse;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MeService {

    private final UserRepository users;

    @Transactional(readOnly = true)
    public MeResponse get(UUID userId) {
        return toResponse(load(userId));
    }

    User load(UUID userId) {
        return users.findById(userId).orElseThrow(ApiException::notFound);
    }

    MeResponse toResponse(User u) {
        return new MeResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getBirthday(), u.getTimezone(), null);
    }
}
