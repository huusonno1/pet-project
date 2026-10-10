package com.coupleapp.couple;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "couple_members")
@IdClass(CoupleMember.Pk.class)
@Getter
@Setter
@NoArgsConstructor
public class CoupleMember {

    @Id
    private UUID coupleId;

    @Id
    private UUID userId;

    private Instant joinedAt;
    private Instant leftAt;

    public CoupleMember(UUID coupleId, UUID userId, Instant joinedAt) {
        this.coupleId = coupleId;
        this.userId = userId;
        this.joinedAt = joinedAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Pk implements Serializable {
        private UUID coupleId;
        private UUID userId;
    }
}
