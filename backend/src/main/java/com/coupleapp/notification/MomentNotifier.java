package com.coupleapp.notification;

import com.coupleapp.moment.MomentCapturedEvent;
import com.coupleapp.moment.handler.MomentHandler;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class MomentNotifier {

    private final NotificationService notifications;
    private final UserRepository users;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onCaptured(MomentCapturedEvent e) {
        String name = users.findById(e.authorId()).map(User::getDisplayName).orElse("Người ấy");
        String label = MomentHandler.moodLabel(e.mood());
        String body = name + " vừa lưu một khoảnh khắc " + (label.isEmpty() ? "mới" : label);
        notifications.sendNow(e.partnerId(), "MOMENT", "💗 Khoảnh khắc mới", body,
                "coupleapp://moments/" + e.momentId());
    }
}
