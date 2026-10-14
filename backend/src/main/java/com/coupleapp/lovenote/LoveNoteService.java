package com.coupleapp.lovenote;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.lovenote.LoveNoteDtos.LoveNoteDto;
import com.coupleapp.lovenote.LoveNoteDtos.SendNoteRequest;
import com.coupleapp.media.MediaService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LoveNoteService {

    static final int MAX_LIMIT = 50;

    private final LoveNoteRepository notes;
    private final CoupleAccess couples;
    private final MediaService media;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional
    public LoveNoteDto send(UUID userId, SendNoteRequest r) {
        CoupleContext c = couples.requireActive(userId);
        String text = r.text() == null || r.text().isBlank() ? null : r.text().trim();
        LoveNote n = new LoveNote();
        n.setCoupleId(c.coupleId());
        n.setAuthorId(userId);
        n.setKind(r.kind());
        if (r.kind() == LoveNoteKind.TEXT) {
            if (text == null) {
                throw invalid("Lời nhắn đang trống");
            }
        } else {
            if (r.drawingMediaId() == null) {
                throw invalid("Thiếu hình vẽ");
            }
            media.requireUsable(List.of(r.drawingMediaId()), c.coupleId(), userId);
            n.setDrawingMediaId(r.drawingMediaId());
        }
        n.setText(text);
        n.setCreatedAt(clock.instant());
        notes.save(n);
        events.publishEvent(new LoveNoteSentEvent(n.getId(), userId, c.partnerId(), text));
        return toDto(n);
    }

    @Transactional(readOnly = true)
    public List<LoveNoteDto> list(UUID userId, Instant before, int limit) {
        CoupleContext c = couples.requireActive(userId);
        int n = Math.max(1, Math.min(MAX_LIMIT, limit));
        Instant cursor = before != null ? before : clock.instant().plusSeconds(60);
        return notes.findByCoupleIdAndCreatedAtBeforeOrderByCreatedAtDesc(c.coupleId(), cursor, Limit.of(n))
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public void markSeen(UUID userId, UUID id) {
        CoupleContext c = couples.requireActive(userId);
        LoveNote n = notes.findById(id)
                .filter(x -> x.getCoupleId().equals(c.coupleId()) && !x.getAuthorId().equals(userId))
                .orElseThrow(ApiException::notFound);
        if (n.getSeenAt() == null) {
            n.setSeenAt(clock.instant());
        }
    }

    /** Lời nhắn mới nhất người ấy gửi cho mình. */
    @Transactional(readOnly = true)
    public Optional<LoveNoteDto> latestFromPartner(UUID userId) {
        CoupleContext c = couples.requireActive(userId);
        return notes.findFirstByCoupleIdAndAuthorIdOrderByCreatedAtDesc(c.coupleId(), c.partnerId()).map(this::toDto);
    }

    private LoveNoteDto toDto(LoveNote n) {
        var drawing = n.getDrawingMediaId() == null ? null
                : media.dtos(List.of(n.getDrawingMediaId())).stream().findFirst().orElse(null);
        return new LoveNoteDto(n.getId(), n.getAuthorId(), n.getKind(), n.getText(), drawing, n.getSeenAt(),
                n.getCreatedAt());
    }

    private static ApiException invalid(String detail) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, detail);
    }
}
