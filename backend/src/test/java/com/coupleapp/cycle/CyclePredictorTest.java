package com.coupleapp.cycle;

import static org.assertj.core.api.Assertions.assertThat;

import com.coupleapp.cycle.CyclePredictor.Prediction;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class CyclePredictorTest {

    static LocalDate d(String s) {
        return LocalDate.parse(s);
    }

    @Test
    void noLogsMeansNoPrediction() {
        assertThat(CyclePredictor.predict(List.of(), 28, d("2026-01-05"))).isEmpty();
    }

    @Test
    void singleLogUsesDefaultLength() {
        Prediction p = CyclePredictor.predict(List.of(d("2026-01-01")), 28, d("2026-01-05")).orElseThrow();
        assertThat(p.nextStart()).isEqualTo(d("2026-01-29"));
        assertThat(p.averageLength()).isEqualTo(28);
        assertThat(p.basedOnCycles()).isZero();
    }

    @Test
    void averagesRecentIntervals() {
        Prediction p = CyclePredictor.predict(
                List.of(d("2026-01-01"), d("2026-03-01"), d("2026-01-31")), 28, d("2026-03-02")).orElseThrow();
        // khoảng 30 và 29 ngày → làm tròn 30
        assertThat(p.averageLength()).isEqualTo(30);
        assertThat(p.nextStart()).isEqualTo(d("2026-03-31"));
        assertThat(p.basedOnCycles()).isEqualTo(2);
    }

    @Test
    void ignoresGapsFromMissedLogging() {
        Prediction p = CyclePredictor.predict(
                List.of(d("2025-10-01"), d("2026-01-01"), d("2026-01-29")), 30, d("2026-02-01")).orElseThrow();
        assertThat(p.averageLength()).isEqualTo(28);
        assertThat(p.nextStart()).isEqualTo(d("2026-02-26"));
    }

    @Test
    void rollsForwardWhenPredictionIsInThePast() {
        Prediction p = CyclePredictor.predict(List.of(d("2026-01-01")), 28, d("2026-03-01")).orElseThrow();
        assertThat(p.nextStart()).isEqualTo(d("2026-03-26"));
    }
}
