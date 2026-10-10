package com.coupleapp.common;

public class ApiException extends RuntimeException {

    private final ErrorCode code;

    public ApiException(ErrorCode code, String detail) {
        super(detail);
        this.code = code;
    }

    public ErrorCode code() {
        return code;
    }

    public static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy");
    }
}
