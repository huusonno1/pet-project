package com.coupleapp.couple;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleDtos.CoupleResponse;
import com.coupleapp.couple.CoupleDtos.PairRequestDto;
import com.coupleapp.couple.CoupleDtos.PairRequestsResponse;
import com.coupleapp.user.UserDirectory;
import com.coupleapp.user.UserDtos.UserCard;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PairRequestService {

    static final Duration TTL = Duration.ofHours(24);

    private final PairRequestRepository requests;
    private final CoupleAccess access;
    private final CoupleService couples;
    private final UserDirectory directory;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional
    public PairRequestDto send(UUID requesterId, String handle) {
        if (access.findActive(requesterId).isPresent()) {
            throw new ApiException(ErrorCode.COUPLE_ALREADY_PAIRED, "Bạn đang có cặp đôi");
        }
        UserCard target = directory.findDiscoverable(requesterId, handle)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy ID này"));
        if (access.findActive(target.id()).isPresent()) {
            throw new ApiException(ErrorCode.COUPLE_ALREADY_PAIRED, "Người này đã có cặp đôi");
        }
        Instant now = clock.instant();
        Optional<PairRequest> existing =
                requests.findByRequesterIdAndTargetIdAndStatus(requesterId, target.id(), PairRequestStatus.PENDING);
        if (existing.isPresent()) {
            PairRequest p = existing.get();
            if (p.getExpiresAt().isAfter(now)) {
                return new PairRequestDto(p.getId(), target, p.getCreatedAt(), p.getExpiresAt());
            }
            p.setStatus(PairRequestStatus.CANCELLED);
            p.setRespondedAt(now);
            requests.saveAndFlush(p);
        }
        PairRequest p = new PairRequest();
        p.setRequesterId(requesterId);
        p.setTargetId(target.id());
        p.setCreatedAt(now);
        p.setExpiresAt(now.plus(TTL));
        requests.saveAndFlush(p);
        events.publishEvent(new PairRequestedEvent(p.getId(), requesterId, target.id()));
        return new PairRequestDto(p.getId(), target, p.getCreatedAt(), p.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public PairRequestsResponse list(UUID userId) {
        Instant now = clock.instant();
        var incoming = requests.findByTargetIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                        userId, PairRequestStatus.PENDING, now).stream()
                .map(p -> new PairRequestDto(p.getId(), directory.card(p.getRequesterId()), p.getCreatedAt(),
                        p.getExpiresAt()))
                .toList();
        var outgoing = requests.findByRequesterIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                        userId, PairRequestStatus.PENDING, now).stream()
                .map(p -> new PairRequestDto(p.getId(), directory.card(p.getTargetId()), p.getCreatedAt(),
                        p.getExpiresAt()))
                .toList();
        return new PairRequestsResponse(incoming, outgoing);
    }

    @Transactional
    public CoupleResponse accept(UUID userId, UUID id, LocalDate startedDatingOn) {
        PairRequest p = pending(id).filter(x -> x.getTargetId().equals(userId)).orElseThrow(ApiException::notFound);
        p.setStatus(PairRequestStatus.ACCEPTED);
        p.setRespondedAt(clock.instant());
        requests.saveAndFlush(p);
        CoupleResponse couple = couples.createCouple(p.getRequesterId(), userId, startedDatingOn);
        return couple;
    }

    @Transactional
    public void decline(UUID userId, UUID id) {
        close(pending(id).filter(x -> x.getTargetId().equals(userId)), PairRequestStatus.DECLINED);
    }

    @Transactional
    public void cancel(UUID userId, UUID id) {
        close(pending(id).filter(x -> x.getRequesterId().equals(userId)), PairRequestStatus.CANCELLED);
    }

    private Optional<PairRequest> pending(UUID id) {
        Instant now = clock.instant();
        return requests.findById(id)
                .filter(p -> p.getStatus() == PairRequestStatus.PENDING && p.getExpiresAt().isAfter(now));
    }

    private void close(Optional<PairRequest> request, PairRequestStatus status) {
        PairRequest p = request.orElseThrow(ApiException::notFound);
        p.setStatus(status);
        p.setRespondedAt(clock.instant());
    }
}
