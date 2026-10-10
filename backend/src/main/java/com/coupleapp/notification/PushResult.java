package com.coupleapp.notification;

/** {@code error} theo mã của Expo, vd {@code DeviceNotRegistered}. */
public record PushResult(boolean ok, String error) {

    public static PushResult success() {
        return new PushResult(true, null);
    }

    public static PushResult failure(String error) {
        return new PushResult(false, error);
    }
}
