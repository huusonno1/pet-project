package com.coupleapp.notification;

import com.coupleapp.couple.CouplePairedEvent;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class PairingNotifier {

    private final NotificationService notifications;
    private final UserRepository users;

    /** Chỉ gửi khi ghép đôi đã commit thành công. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onPaired(CouplePairedEvent e) {
        String name = users.findById(e.joinerId()).map(User::getDisplayName).orElse("Người ấy");
        notifications.sendNow(e.inviterId(), "💞 Ghép đôi thành công", name + " đã ghép đôi với bạn", "coupleapp://home");
    }
}
