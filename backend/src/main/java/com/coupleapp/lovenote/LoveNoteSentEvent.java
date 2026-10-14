package com.coupleapp.lovenote;

import java.util.UUID;

/** {@code preview}: nội dung chữ, null nếu chỉ có hình vẽ. */
public record LoveNoteSentEvent(UUID noteId, UUID authorId, UUID recipientId, String preview) {}
