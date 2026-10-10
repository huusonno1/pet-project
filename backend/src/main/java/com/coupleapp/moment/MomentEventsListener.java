package com.coupleapp.moment;

import com.coupleapp.couple.CoupleEndedEvent;
import com.coupleapp.couple.CouplePairedEvent;
import com.coupleapp.notification.ReminderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class MomentEventsListener {

    private final MomentService moments;
    private final ReminderRepository reminders;

    @EventListener
    void onPaired(CouplePairedEvent e) {
        if (e.startedDatingOn() != null) {
            moments.createSystem(e.coupleId(), e.joinerId(), MomentType.ANNIVERSARY, "Ngày yêu nhau",
                    e.startedDatingOn(), null);
        }
    }

    @EventListener
    void onEnded(CoupleEndedEvent e) {
        reminders.cancelPendingByCouple(e.coupleId());
    }
}
