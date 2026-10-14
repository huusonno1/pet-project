package com.coupleapp.user;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

public final class Handles {

    public static final Pattern VALID = Pattern.compile("^[a-z0-9._]{3,30}$");

    private Handles() {}

    /** "Đức Anh" → "ducanh"; ngắn hơn 3 ký tự → "user"; dài quá cắt còn 20. */
    public static String base(String displayName) {
        String s = Normalizer.normalize(displayName.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
        if (s.length() > 20) {
            s = s.substring(0, 20);
        }
        return s.length() < 3 ? "user" : s;
    }

    /** " @Lan.2001 " → "lan.2001". */
    public static String normalize(String raw) {
        String s = raw.trim();
        if (s.startsWith("@")) {
            s = s.substring(1);
        }
        return s.toLowerCase(Locale.ROOT);
    }
}
