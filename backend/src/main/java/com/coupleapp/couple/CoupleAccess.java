package com.coupleapp.couple;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class CoupleAccess {

    private final CoupleMemberRepository members;

    @Transactional(readOnly = true)
    public Optional<CoupleContext> findActive(UUID userId) {
        return members.findByUserIdAndLeftAtIsNull(userId).flatMap(m ->
                members.findByCoupleIdAndLeftAtIsNull(m.getCoupleId()).stream()
                        .map(CoupleMember::getUserId)
                        .filter(id -> !id.equals(userId))
                        .findFirst()
                        .map(partner -> new CoupleContext(m.getCoupleId(), userId, partner)));
    }

    public CoupleContext requireActive(UUID userId) {
        return findActive(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_REQUIRED, "Bạn chưa ghép đôi"));
    }
}
