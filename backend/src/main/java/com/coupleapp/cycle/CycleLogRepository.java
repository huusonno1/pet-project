package com.coupleapp.cycle;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CycleLogRepository extends JpaRepository<CycleLog, UUID> {

    List<CycleLog> findByUserIdOrderByPeriodStartDesc(UUID userId);

    boolean existsByUserIdAndPeriodStart(UUID userId, LocalDate periodStart);
}
