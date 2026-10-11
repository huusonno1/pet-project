package com.coupleapp.user;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "user_settings")
@Getter
@Setter
@NoArgsConstructor
public class UserSettings {

    @Id
    private UUID userId;

    private boolean shareLocation = true;
    private boolean shareCycle = true;
    private int cycleLengthDefault = 28;
    private boolean discoverable = true;
    private boolean cycleTracking = false;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Boolean> notifyPrefs = new HashMap<>();

    public UserSettings(UUID userId) {
        this.userId = userId;
    }

    /** Loại kỷ niệm chưa cấu hình được coi là bật. */
    public boolean notifyEnabled(String momentType) {
        return notifyPrefs.getOrDefault(momentType, true);
    }
}
