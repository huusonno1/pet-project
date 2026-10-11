package com.coupleapp.notification;

import com.coupleapp.couple.PairRequestedEvent;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class PairRequestNotifier {

    private final NotificationService notifications;
    private final UserRepository users;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onRequested(PairRequestedEvent e) {
        String name = users.findById(e.requesterId()).map(User::getDisplayName).orElse("Ai đó");
        notifications.sendNow(e.targetId(), "PAIR_REQUEST", "💌 Lời mời ghép đôi", name + " muốn ghép đôi với bạn",
                "coupleapp://pair/requests");
    }
}
