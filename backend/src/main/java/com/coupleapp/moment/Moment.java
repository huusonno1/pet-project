package com.coupleapp.moment;

import com.coupleapp.moment.reminder.ReminderConfig;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "moments")
@Getter
@Setter
@NoArgsConstructor
public class Moment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID coupleId;

    @Enumerated(EnumType.STRING)
    private MomentType type;

    private String title;
    private LocalDate occursOn;
    private Instant occursAt;

    @Enumerated(EnumType.STRING)
    private Recurrence recurrence = Recurrence.NONE;

    private UUID subjectUserId;
    private UUID placeId;
    private String message;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> details = new HashMap<>();

    /** NULL = dùng mặc định của handler. */
    @JdbcTypeCode(SqlTypes.JSON)
    private ReminderConfig reminderConfig;

    @ElementCollection
    @CollectionTable(name = "moment_media", joinColumns = @JoinColumn(name = "moment_id"))
    @OrderColumn(name = "position")
    @Column(name = "media_id")
    private List<UUID> mediaIds = new ArrayList<>();

    private UUID createdBy;
    private Instant createdAt;
    private Instant updatedAt;

    /** Người "chủ" của kỷ niệm: chủ thể nếu có, ngược lại là người tạo. */
    public UUID ownerId() {
        return subjectUserId != null ? subjectUserId : createdBy;
    }
}
