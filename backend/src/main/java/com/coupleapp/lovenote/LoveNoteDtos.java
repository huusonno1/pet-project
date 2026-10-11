package com.coupleapp.lovenote;

import com.coupleapp.media.MediaDtos.MediaDto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class LoveNoteDtos {

    private LoveNoteDtos() {}

    public record SendNoteRequest(@NotNull LoveNoteKind kind, @Size(max = 500) String text, UUID drawingMediaId) {}

    public record LoveNoteDto(UUID id, UUID authorId, LoveNoteKind kind, String text, MediaDto drawing,
                              Instant seenAt, Instant createdAt) {}
}
