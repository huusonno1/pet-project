package com.coupleapp.couple;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleDtos.CoupleResponse;
import com.coupleapp.couple.CoupleDtos.InviteResponse;
import com.coupleapp.couple.CoupleDtos.PartnerDto;
import com.coupleapp.couple.InviteService.Invite;
import com.coupleapp.couple.InviteService.InvitePayload;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CoupleService {

    private final CoupleRepository couples;
    private final CoupleMemberRepository members;
    private final CoupleAccess access;
    private final InviteService invites;
    private final UserRepository users;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public InviteResponse createInvite(UUID userId) {
        if (access.findActive(userId).isPresent()) {
            throw alreadyPaired();
        }
        Invite invite = invites.create(userId);
        return new InviteResponse(invite.code(), invite.expiresAt());
    }

    @Transactional
    public CoupleResponse join(UUID joinerId, String rawCode, LocalDate startedDatingOn) {
        invites.checkJoinRateLimit(joinerId);
        String code = InviteService.normalize(rawCode);
        InvitePayload payload = invites.peek(code).orElseThrow(CoupleService::invalidInvite);
        if (payload.inviterId().equals(joinerId)) {
            throw new ApiException(ErrorCode.INVITE_SELF, "Không thể nhập mã của chính bạn");
        }
        if (access.findActive(joinerId).isPresent() || access.findActive(payload.inviterId()).isPresent()) {
            throw alreadyPaired();
        }
        invites.claim(code).orElseThrow(CoupleService::invalidInvite);
        try {
            Instant now = clock.instant();
            Couple couple = new Couple();
            couple.setStartedDatingOn(startedDatingOn);
            couple.setCreatedAt(now);
            couples.saveAndFlush(couple);
            members.saveAndFlush(new CoupleMember(couple.getId(), payload.inviterId(), now));
            members.saveAndFlush(new CoupleMember(couple.getId(), joinerId, now));
            events.publishEvent(new CouplePairedEvent(couple.getId(), payload.inviterId(), joinerId, startedDatingOn));
            return toResponse(couple, payload.inviterId());
        } catch (DataIntegrityViolationException e) {
            invites.restore(code, payload);
            throw alreadyPaired();
        } catch (RuntimeException e) {
            invites.restore(code, payload);
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public CoupleResponse me(UUID userId) {
        CoupleContext ctx = access.requireActive(userId);
        Couple couple = couples.findById(ctx.coupleId()).orElseThrow(ApiException::notFound);
        return toResponse(couple, ctx.partnerId());
    }

    @Transactional
    public void end(UUID userId) {
        CoupleContext ctx = access.requireActive(userId);
        Instant now = clock.instant();
        Couple couple = couples.findById(ctx.coupleId()).orElseThrow(ApiException::notFound);
        couple.setStatus(CoupleStatus.ENDED);
        couple.setEndedAt(now);
        members.findByCoupleIdAndLeftAtIsNull(ctx.coupleId()).forEach(m -> m.setLeftAt(now));
        events.publishEvent(new CoupleEndedEvent(ctx.coupleId()));
    }

    private CoupleResponse toResponse(Couple couple, UUID partnerId) {
        User partner = users.findById(partnerId).orElseThrow(ApiException::notFound);
        return new CoupleResponse(couple.getId(), couple.getStartedDatingOn(), couple.getCreatedAt(),
                new PartnerDto(partner.getId(), partner.getDisplayName()));
    }

    private static ApiException invalidInvite() {
        return new ApiException(ErrorCode.INVITE_INVALID, "Mã mời không đúng hoặc đã hết hạn");
    }

    private static ApiException alreadyPaired() {
        return new ApiException(ErrorCode.COUPLE_ALREADY_PAIRED, "Một trong hai người đã có cặp đôi");
    }
}
