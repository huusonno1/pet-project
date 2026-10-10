package com.coupleapp.media;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "media")
@Getter
@Setter
@NoArgsConstructor
public class Media {

    /** Sinh ở service trước khi lưu vì object key cần id. */
    @Id
    private UUID id;

    private UUID coupleId;
    private UUID uploaderId;
    private String objectKey;
    private String contentType;
    private Long sizeBytes;
    private Integer width;
    private Integer height;
    private String filter;
    private Instant takenAt;
    private Double lat;
    private Double lng;

    @Enumerated(EnumType.STRING)
    private MediaStatus status;

    private Instant createdAt;
}
