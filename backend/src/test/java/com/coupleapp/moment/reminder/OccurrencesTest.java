package com.coupleapp.moment.reminder;

import static org.assertj.core.api.Assertions.assertThat;

import com.coupleapp.moment.Moment;
import com.coupleapp.moment.Recurrence;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class OccurrencesTest {

    static Moment moment(LocalDate on, Recurrence r) {
        Moment m = new Moment();
        m.setTitle("T");
        m.setOccursOn(on);
        m.setRecurrence(r);
        return m;
    }

    static List<LocalDate> dates(List<Occurrence> list) {
        return list.stream().map(Occurrence::date).toList();
    }

    @Test
    void weeklyRepeatsOnSameWeekday() {
        Moment m = moment(LocalDate.of(2026, 10, 2), Recurrence.WEEKLY);
        assertThat(dates(Occurrences.recurring(m, LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 31))))
                .containsExactly(LocalDate.of(2026, 10, 16), LocalDate.of(2026, 10, 23), LocalDate.of(2026, 10, 30));
    }

    @Test
    void monthlyFromThe31stFallsBackToMonthEnd() {
        Moment m = moment(LocalDate.of(2026, 1, 31), Recurrence.MONTHLY);
        assertThat(dates(Occurrences.recurring(m, LocalDate.of(2026, 2, 1), LocalDate.of(2026, 4, 30))))
                .containsExactly(LocalDate.of(2026, 2, 28), LocalDate.of(2026, 3, 31), LocalDate.of(2026, 4, 30));
    }

    @Test
    void monthlyFromLeapDay() {
        Moment m = moment(LocalDate.of(2028, 2, 29), Recurrence.MONTHLY);
        assertThat(dates(Occurrences.recurring(m, LocalDate.of(2028, 3, 1), LocalDate.of(2028, 4, 30))))
                .containsExactly(LocalDate.of(2028, 3, 29), LocalDate.of(2028, 4, 29));
    }

    @Test
    void weeklyShiftsTimeOfDayWithTheDate() {
        Moment m = moment(LocalDate.of(2026, 10, 2), Recurrence.WEEKLY);
        m.setOccursAt(Instant.parse("2026-10-02T12:00:00Z"));
        Occurrence third = Occurrences.recurring(m, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31)).get(2);
        assertThat(third.at()).isEqualTo(Instant.parse("2026-10-16T12:00:00Z"));
    }

    @Test
    void noneIsSingleOccurrence() {
        Moment m = moment(LocalDate.of(2026, 10, 2), Recurrence.NONE);
        assertThat(dates(Occurrences.recurring(m, LocalDate.of(2026, 10, 1), LocalDate.of(2027, 10, 1))))
                .containsExactly(LocalDate.of(2026, 10, 2));
    }
}
