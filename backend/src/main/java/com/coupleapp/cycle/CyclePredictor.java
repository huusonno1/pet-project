package com.coupleapp.cycle;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public final class CyclePredictor {

    static final int MAX_INTERVALS = 6;
    static final int MIN_LENGTH = 15;
    static final int MAX_LENGTH = 45;

    private CyclePredictor() {}

    public record Prediction(LocalDate nextStart, int averageLength, int basedOnCycles) {}

    public static Optional<Prediction> predict(List<LocalDate> starts, int defaultLength, LocalDate today) {
        if (starts.isEmpty()) {
            return Optional.empty();
        }
        List<LocalDate> sorted = starts.stream().sorted(Comparator.reverseOrder()).toList();
        List<Long> lengths = new ArrayList<>();
        for (int i = 0; i + 1 < sorted.size() && lengths.size() < MAX_INTERVALS; i++) {
            long days = ChronoUnit.DAYS.between(sorted.get(i + 1), sorted.get(i));
            if (days >= MIN_LENGTH && days <= MAX_LENGTH) {
                lengths.add(days);
            }
        }
        int average = lengths.isEmpty()
                ? defaultLength
                : (int) Math.round(lengths.stream().mapToLong(Long::longValue).average().orElseThrow());
        LocalDate next = sorted.get(0).plusDays(average);
        while (next.isBefore(today)) {
            next = next.plusDays(average);
        }
        return Optional.of(new Prediction(next, average, lengths.size()));
    }
}
