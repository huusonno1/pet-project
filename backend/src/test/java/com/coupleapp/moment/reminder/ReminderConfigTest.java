package com.coupleapp.moment.reminder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.coupleapp.common.ApiException;
import java.time.Duration;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class ReminderConfigTest {

    static final ReminderConfig DEFAULTS =
            new ReminderConfig(null, true, List.of("P3D", "P0D"), "08:00", Audience.BOTH);

    @Test
    void mergeOverridesOnlyProvidedFields() {
        ReminderConfig merged = DEFAULTS.merge(new ReminderConfig(null, null, List.of("PT2H"), null, Audience.OWNER));

        assertThat(merged.offsetDurations()).containsExactly(Duration.ofHours(2));
        assertThat(merged.recipients()).isEqualTo(Audience.OWNER);
        assertThat(merged.yearly()).isTrue();
        assertThat(merged.sendAtTime()).isEqualTo(LocalTime.of(8, 0));
        assertThat(DEFAULTS.merge(null)).isEqualTo(DEFAULTS);
    }

    @Test
    void acceptsValidConfig() {
        assertThatCode(() -> new ReminderConfig(List.of(100, 520), true, List.of("P7D", "PT30M"), "21:30", Audience.PARTNER)
                .validate()).doesNotThrowAnyException();
    }

    @Test
    void rejectsOutOfRangeValues() {
        List<ReminderConfig> invalid = List.of(
                new ReminderConfig(null, null, Collections.nCopies(6, "P1D"), null, null),
                new ReminderConfig(null, null, List.of("P31D"), null, null),
                new ReminderConfig(null, null, List.of("-P1D"), null, null),
                new ReminderConfig(null, null, List.of("abc"), null, null),
                new ReminderConfig(IntStream.rangeClosed(1, 21).boxed().toList(), null, null, null, null),
                new ReminderConfig(List.of(0), null, null, null, null),
                new ReminderConfig(null, null, null, "25:00", null));
        for (ReminderConfig c : invalid) {
            assertThatThrownBy(c::validate).as(c.toString()).isInstanceOf(ApiException.class);
        }
    }
}
