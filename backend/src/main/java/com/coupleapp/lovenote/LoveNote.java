package com.coupleapp.lovenote;

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
@Table(name = "love_notes")
@Getter
@Setter
@NoArgsConstructor
public class LoveNote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID coupleId;
    private UUID authorId;

    @Enumerated(EnumType.STRING)
    private LoveNoteKind kind;

    private String text;
    private UUID drawingMediaId;
    private Instant seenAt;
    private Instant createdAt;
}
