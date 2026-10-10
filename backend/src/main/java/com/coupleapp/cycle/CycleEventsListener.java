package com.coupleapp.cycle;

import com.coupleapp.couple.CouplePairedEvent;
import com.coupleapp.user.UserSettingsChangedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class CycleEventsListener {

    private final CycleService cycles;

    @EventListener
    void onSettingsChanged(UserSettingsChangedEvent e) {
        if (e.shareCycleChanged()) {
            cycles.replanFor(e.userId());
        }
    }

    @EventListener
    void onPaired(CouplePairedEvent e) {
        cycles.refresh(e.inviterId());
        cycles.refresh(e.joinerId());
    }
}
