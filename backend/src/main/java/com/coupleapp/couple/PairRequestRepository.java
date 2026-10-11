package com.coupleapp.couple;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PairRequestRepository extends JpaRepository<PairRequest, UUID> {

    Optional<PairRequest> findByRequesterIdAndTargetIdAndStatus(UUID requesterId, UUID targetId,
                                                                PairRequestStatus status);

    List<PairRequest> findByTargetIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(UUID targetId,
                                                                                   PairRequestStatus status,
                                                                                   Instant now);

    List<PairRequest> findByRequesterIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(UUID requesterId,
                                                                                      PairRequestStatus status,
                                                                                      Instant now);

    @Modifying
    @Query(value = """
            update pair_requests set status = 'CANCELLED', responded_at = :now
            where status = 'PENDING' and (requester_id in (:a, :b) or target_id in (:a, :b))
            """, nativeQuery = true)
    int cancelPendingInvolving(UUID a, UUID b, Instant now);
}
