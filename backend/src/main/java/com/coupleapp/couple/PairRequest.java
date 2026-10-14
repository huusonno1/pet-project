package com.coupleapp.couple;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "pair_requests")
@Getter
@Setter
@NoArgsConstructor
public class PairRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID requesterId;
    private UUID targetId;

    @Enumerated(EnumType.STRING)
    private PairRequestStatus status = PairRequestStatus.PENDING;

    private Instant createdAt;
    private Instant expiresAt;
    private Instant respondedAt;
}
