package com.coupleapp.moment;

import com.coupleapp.common.AuthUser;
import com.coupleapp.moment.MomentDtos.CreateMomentRequest;
import com.coupleapp.moment.MomentDtos.MomentResponse;
import com.coupleapp.moment.MomentDtos.ReminderDto;
import com.coupleapp.moment.MomentDtos.UpdateMomentRequest;
import com.coupleapp.moment.reminder.ReminderConfig;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/moments")
@RequiredArgsConstructor
public class MomentController {

    private final MomentService moments;

    @GetMapping
    public List<MomentResponse> list(@AuthenticationPrincipal Jwt jwt,
                                     @RequestParam(required = false) MomentType type,
                                     @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return moments.list(AuthUser.id(jwt), type, from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MomentResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateMomentRequest r) {
        return moments.create(AuthUser.id(jwt), r);
    }

    @GetMapping("/{id}")
    public MomentResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return moments.get(AuthUser.id(jwt), id);
    }

    @PatchMapping("/{id}")
    public MomentResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                 @Valid @RequestBody UpdateMomentRequest r) {
        return moments.update(AuthUser.id(jwt), id, r);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        moments.delete(AuthUser.id(jwt), id);
    }

    /** Body {@code null} = khôi phục mặc định. */
    @PutMapping("/{id}/reminder-config")
    public MomentResponse reminderConfig(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                         @RequestBody(required = false) ReminderConfig config) {
        return moments.setReminderConfig(AuthUser.id(jwt), id, config);
    }

    @GetMapping("/{id}/reminders")
    public List<ReminderDto> reminders(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return moments.upcomingReminders(AuthUser.id(jwt), id);
    }
}
