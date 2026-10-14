package com.coupleapp.couple;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleDtos.CoupleResponse;
import com.coupleapp.couple.CoupleDtos.InviteResponse;
import com.coupleapp.couple.CoupleDtos.PartnerDto;
import com.coupleapp.couple.InviteService.Invite;
import com.coupleapp.couple.InviteService.InvitePayload;
import com.coupleapp.user.User;
import com.coupleapp.user.UserDirectory;
import com.coupleapp.user.UserDtos.UserCard;
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
    private final UserDirectory directory;
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
            return createCouple(payload.inviterId(), joinerId, startedDatingOn);
        } catch (RuntimeException e) {
            invites.restore(code, payload);
            throw e;
        }
    }

    /** Tạo cặp đôi cho hai người chưa có cặp ACTIVE (dùng chung cho mã mời và lời mời theo ID). */
    @Transactional
    public CoupleResponse createCouple(UUID inviterId, UUID joinerId, LocalDate startedDatingOn) {
        if (access.findActive(joinerId).isPresent() || access.findActive(inviterId).isPresent()) {
            throw alreadyPaired();
        }
        try {
            Instant now = clock.instant();
            Couple couple = new Couple();
            couple.setStartedDatingOn(startedDatingOn);
            couple.setCreatedAt(now);
            couples.saveAndFlush(couple);
            members.saveAndFlush(new CoupleMember(couple.getId(), inviterId, now));
            members.saveAndFlush(new CoupleMember(couple.getId(), joinerId, now));
            events.publishEvent(new CouplePairedEvent(couple.getId(), inviterId, joinerId, startedDatingOn));
            return toResponse(couple, inviterId);
        } catch (DataIntegrityViolationException e) {
            throw alreadyPaired();
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
        UserCard card = directory.card(partnerId);
        LocalDate birthday = directory.find(partnerId).map(User::getBirthday).orElse(null);
        return new CoupleResponse(couple.getId(), couple.getStartedDatingOn(), couple.getCreatedAt(),
                new PartnerDto(card.id(), card.displayName(), card.handle(), birthday, card.avatarUrl(), card.gender()));
    }

    private static ApiException invalidInvite() {
        return new ApiException(ErrorCode.INVITE_INVALID, "Mã mời không đúng hoặc đã hết hạn");
    }

    private static ApiException alreadyPaired() {
        return new ApiException(ErrorCode.COUPLE_ALREADY_PAIRED, "Một trong hai người đã có cặp đôi");
    }
}
