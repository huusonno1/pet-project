package com.coupleapp.common;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    EMAIL_TAKEN(HttpStatus.CONFLICT),
    COUPLE_REQUIRED(HttpStatus.CONFLICT),
    COUPLE_ALREADY_PAIRED(HttpStatus.CONFLICT),
    INVITE_INVALID(HttpStatus.BAD_REQUEST),
    INVITE_SELF(HttpStatus.BAD_REQUEST),
    TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS),
    MEDIA_NOT_UPLOADED(HttpStatus.BAD_REQUEST),
    LOCATION_NOT_SHARED(HttpStatus.CONFLICT);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
