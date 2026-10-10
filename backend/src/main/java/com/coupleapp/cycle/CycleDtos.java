package com.coupleapp.cycle;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public final class CycleDtos {

    private CycleDtos() {}

    public record CycleLogRequest(@NotNull LocalDate periodStart, LocalDate periodEnd) {}

    public record CycleLogDto(UUID id, LocalDate periodStart, LocalDate periodEnd) {}

    public record PredictionResponse(LocalDate nextStart, int averageLength, int basedOnCycles) {}

    public record DefaultLengthRequest(@NotNull @Min(20) @Max(45) Integer days) {}
}
