package com.coupleapp.user;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HandlesTest {

    @Test
    void baseStripsDiacriticsAndSymbols() {
        assertThat(Handles.base("Đức Anh")).isEqualTo("ducanh");
        assertThat(Handles.base("Nguyễn Thị Lan!")).isEqualTo("nguyenthilan");
        assertThat(Handles.base("A")).isEqualTo("user");
        assertThat(Handles.base("abcdefghijklmnopqrstuvwxyz")).hasSize(20);
    }

    @Test
    void normalizeDropsAtSignAndLowercases() {
        assertThat(Handles.normalize(" @Lan.2001 ")).isEqualTo("lan.2001");
    }

    @Test
    void validAcceptsOnlyLowercaseDigitsDotUnderscore() {
        assertThat(Handles.VALID.matcher("lan.2001").matches()).isTrue();
        assertThat(Handles.VALID.matcher("ab").matches()).isFalse();
        assertThat(Handles.VALID.matcher("Lan").matches()).isFalse();
        assertThat(Handles.VALID.matcher("lan-01").matches()).isFalse();
    }
}
