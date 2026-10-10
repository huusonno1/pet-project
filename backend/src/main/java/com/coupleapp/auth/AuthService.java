package com.coupleapp.auth;

import com.coupleapp.auth.AuthDtos.LoginRequest;
import com.coupleapp.auth.AuthDtos.RegisterRequest;
import com.coupleapp.auth.AuthDtos.TokenResponse;
import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwords;
    private final TokenService tokens;
    private final Clock clock;

    @Transactional
    public TokenResponse register(RegisterRequest r) {
        String email = normalize(r.email());
        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwords.encode(r.password()));
        u.setDisplayName(r.displayName().trim());
        try {
            users.saveAndFlush(u);
        } catch (DataIntegrityViolationException e) {
            throw emailTaken();
        }
        settings.save(new UserSettings(u.getId()));
        return tokens.issue(u.getId());
    }

    @Transactional
    public TokenResponse login(LoginRequest r) {
        User u = users.findByEmail(normalize(r.email()))
                .filter(x -> passwords.matches(r.password(), x.getPasswordHash()))
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "Email hoặc mật khẩu không đúng"));
        return tokens.issue(u.getId());
    }

    @Transactional
    public TokenResponse refresh(String rawToken) {
        RefreshToken t = refreshTokens.findByTokenHash(TokenService.sha256(rawToken))
                .filter(x -> x.getRevokedAt() == null && x.getExpiresAt().isAfter(clock.instant()))
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn"));
        t.setRevokedAt(clock.instant());
        return tokens.issue(t.getUserId());
    }

    @Transactional
    public void logout(String rawToken) {
        refreshTokens.findByTokenHash(TokenService.sha256(rawToken))
                .filter(t -> t.getRevokedAt() == null)
                .ifPresent(t -> t.setRevokedAt(clock.instant()));
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static ApiException emailTaken() {
        return new ApiException(ErrorCode.EMAIL_TAKEN, "Email đã được sử dụng");
    }
}
