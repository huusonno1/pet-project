package com.coupleapp.notification;

import com.coupleapp.lovenote.LoveNoteSentEvent;
import com.coupleapp.user.User;
import com.coupleapp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class LoveNoteNotifier {

    private final NotificationService notifications;
    private final UserRepository users;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onSent(LoveNoteSentEvent e) {
        String name = users.findById(e.authorId()).map(User::getDisplayName).orElse("Người ấy");
        String body = e.preview() != null ? e.preview() : "Một hình vẽ tay cho bạn";
        notifications.sendNow(e.recipientId(), "LOVE_NOTE", "💌 " + name + " gửi lời nhắn", body, "coupleapp://notes");
    }
}
