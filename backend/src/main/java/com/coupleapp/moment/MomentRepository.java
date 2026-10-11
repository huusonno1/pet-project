package com.coupleapp.moment;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MomentRepository extends JpaRepository<Moment, UUID> {

    List<Moment> findByCoupleIdOrderByOccursOnAsc(UUID coupleId);

    Optional<Moment> findFirstByCoupleIdAndTypeAndSubjectUserId(UUID coupleId, MomentType type, UUID subjectUserId);

    List<Moment> findByTypeAndOccursOnBefore(MomentType type, LocalDate date);

    @Query("select m from Moment m where m.type in :types or m.recurrence in :recurrences")
    List<Moment> findRecurring(Collection<MomentType> types, Collection<Recurrence> recurrences);
}
