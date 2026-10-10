package com.coupleapp.trait;

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
@Table(name = "size_entries")
@Getter
@Setter
@NoArgsConstructor
public class SizeEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID subjectUserId;
    private String kind;
    private String value;
    private String note;

    @Enumerated(EnumType.STRING)
    private Visibility visibility = Visibility.SHARED;

    private UUID createdBy;
    private Instant createdAt;
    private Instant updatedAt;
}
