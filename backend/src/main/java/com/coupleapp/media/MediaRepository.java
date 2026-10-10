package com.coupleapp.media;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<Media, UUID> {

    List<Media> findByStatusAndCreatedAtBefore(MediaStatus status, Instant cutoff);
}
