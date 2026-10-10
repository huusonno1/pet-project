package com.coupleapp.moment.reminder;

import java.util.List;

public enum Audience {
    OWNER, PARTNER, BOTH;

    public List<Role> roles() {
        return switch (this) {
            case OWNER -> List.of(Role.OWNER);
            case PARTNER -> List.of(Role.PARTNER);
            case BOTH -> List.of(Role.OWNER, Role.PARTNER);
        };
    }
}
