package com.coupleapp.user;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String email;
    private String passwordHash;
    private String displayName;
    private String handle;
    private UUID avatarMediaId;
    private LocalDate birthday;
    private String timezone = "Asia/Ho_Chi_Minh";
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public ZoneId zone() {
        return ZoneId.of(timezone);
    }
}
