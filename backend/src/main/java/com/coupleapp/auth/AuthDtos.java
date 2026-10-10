package com.coupleapp.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 50) String displayName) {

        /** Bàn phím điện thoại hay thêm dấu cách thừa — trim trước khi validate. */
        public RegisterRequest {
            email = email == null ? null : email.trim();
        }
    }

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {

        public LoginRequest {
            email = email == null ? null : email.trim();
        }
    }

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record TokenResponse(String accessToken, String refreshToken, long expiresIn) {}
}
