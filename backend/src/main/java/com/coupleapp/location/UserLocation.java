package com.coupleapp.location;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_locations")
@Getter
@Setter
@NoArgsConstructor
public class UserLocation {

    @Id
    private UUID userId;

    private double lat;
    private double lng;
    @Column(name = "accuracy_m")
    private Float accuracyM;
    private Instant updatedAt;

    public UserLocation(UUID userId) {
        this.userId = userId;
    }
}
