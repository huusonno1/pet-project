package com.coupleapp.notification;

import java.util.List;

public interface PushSender {

    /** Trả kết quả theo đúng thứ tự {@code messages}. */
    List<PushResult> send(List<PushMessage> messages);
}
