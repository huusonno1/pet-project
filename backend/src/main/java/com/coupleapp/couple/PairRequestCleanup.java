package com.coupleapp.couple;

import java.time.Clock;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Ghép đôi bằng bất kỳ cách nào → huỷ các lời mời đang chờ của cả hai người. */
@Component
@RequiredArgsConstructor
class PairRequestCleanup {

    private final PairRequestRepository requests;
    private final Clock clock;

    @EventListener
    void onPaired(CouplePairedEvent e) {
        requests.cancelPendingInvolving(e.inviterId(), e.joinerId(), clock.instant());
    }
}
