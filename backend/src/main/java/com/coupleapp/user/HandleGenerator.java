package com.coupleapp.user;

import java.security.SecureRandom;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Sinh ID mặc định "<tên không dấu><4 số>" chưa ai dùng. */
@Component
@RequiredArgsConstructor
public class HandleGenerator {

    private final UserRepository users;
    private final SecureRandom random = new SecureRandom();

    public String generate(String displayName) {
        String base = Handles.base(displayName);
        for (int i = 0; i < 20; i++) {
            String candidate = base + "%04d".formatted(random.nextInt(10_000));
            if (!users.existsByHandleIgnoreCase(candidate)) {
                return candidate;
            }
        }
        byte[] bytes = new byte[4];
        random.nextBytes(bytes);
        return base + HexFormat.of().formatHex(bytes);
    }
}
