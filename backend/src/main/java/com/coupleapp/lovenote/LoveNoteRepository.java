package com.coupleapp.lovenote;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoveNoteRepository extends JpaRepository<LoveNote, UUID> {

    List<LoveNote> findByCoupleIdAndCreatedAtBeforeOrderByCreatedAtDesc(UUID coupleId, Instant before, Limit limit);

    Optional<LoveNote> findFirstByCoupleIdAndAuthorIdOrderByCreatedAtDesc(UUID coupleId, UUID authorId);
}
