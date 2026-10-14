package com.coupleapp.notification;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface InboxRepository extends JpaRepository<InboxItem, UUID> {

    List<InboxItem> findByUserIdOrderByCreatedAtDesc(UUID userId, Limit limit);

    long countByUserIdAndReadAtIsNull(UUID userId);

    Optional<InboxItem> findByIdAndUserId(UUID id, UUID userId);

    @Modifying
    @Query("update InboxItem i set i.readAt = :now where i.userId = :userId and i.readAt is null")
    int markAllRead(UUID userId, Instant now);
}
