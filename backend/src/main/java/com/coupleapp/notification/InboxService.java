package com.coupleapp.notification;

import com.coupleapp.common.ApiException;
import com.coupleapp.notification.InboxDtos.InboxDto;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InboxService {

    static final int MAX_LIMIT = 100;

    private final InboxRepository items;
    private final Clock clock;

    @Transactional
    public void record(UUID userId, String kind, String title, String body, String deepLink) {
        InboxItem i = new InboxItem();
        i.setUserId(userId);
        i.setKind(kind);
        i.setTitle(title);
        i.setBody(body);
        i.setDeepLink(deepLink);
        i.setCreatedAt(clock.instant());
        items.save(i);
    }

    @Transactional(readOnly = true)
    public List<InboxDto> list(UUID userId, int limit) {
        int n = Math.max(1, Math.min(MAX_LIMIT, limit));
        return items.findByUserIdOrderByCreatedAtDesc(userId, Limit.of(n)).stream()
                .map(i -> new InboxDto(i.getId(), i.getKind(), i.getTitle(), i.getBody(), i.getDeepLink(),
                        i.getReadAt(), i.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public long unread(UUID userId) {
        return items.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public void markRead(UUID userId, UUID id) {
        InboxItem i = items.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
        if (i.getReadAt() == null) {
            i.setReadAt(clock.instant());
        }
    }

    @Transactional
    public void markAllRead(UUID userId) {
        items.markAllRead(userId, clock.instant());
    }
}
