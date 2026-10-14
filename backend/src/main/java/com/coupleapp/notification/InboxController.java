package com.coupleapp.notification;

import com.coupleapp.common.AuthUser;
import com.coupleapp.notification.InboxDtos.InboxDto;
import com.coupleapp.notification.InboxDtos.UnreadCount;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class InboxController {

    private final InboxService inbox;

    @GetMapping
    public List<InboxDto> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "50") int limit) {
        return inbox.list(AuthUser.id(jwt), limit);
    }

    @GetMapping("/unread-count")
    public UnreadCount unread(@AuthenticationPrincipal Jwt jwt) {
        return new UnreadCount(inbox.unread(AuthUser.id(jwt)));
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        inbox.markRead(AuthUser.id(jwt), id);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void readAll(@AuthenticationPrincipal Jwt jwt) {
        inbox.markAllRead(AuthUser.id(jwt));
    }
}
