package com.coupleapp.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.coupleapp.moment.reminder.ReminderScheduler;
import com.coupleapp.support.IntegrationTest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class NotificationTest extends IntegrationTest {

    static final String TOKEN = "ExponentPushToken[lan]";

    @Autowired ReminderDispatcher dispatcher;
    @Autowired ReminderScheduler scheduler;

    String lan;
    String minh;
    UUID lanId;
    UUID minhId;
    UUID momentId;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        lanId = userId(lan);
        minhId = userId(minh);
        post("/api/me/devices", lan, Map.of("token", TOKEN, "platform", "android"));
        momentId = UUID.fromString(read(post("/api/moments", lan, Map.of("type", "CUSTOM", "title", "Mua hoa",
                "occursOn", LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(10).toString()))).get("id").asText());
        jdbc.update("update reminders set status = 'CANCELLED'"); // chỉ xử lý nhắc do test tự chèn
        reset(push);
    }

    UUID insertReminder(UUID recipient, String fireAtSql) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into reminders(id, couple_id, moment_id, recipient_id, fire_at, title, body, deep_link, status)
                select ?, couple_id, id, ?, %s, 'Tiêu đề', 'Nội dung', 'coupleapp://moments/x', 'PENDING'
                from moments where id = ?
                """.formatted(fireAtSql), id, recipient, momentId);
        return id;
    }

    UUID insertDue(UUID recipient) {
        return insertReminder(recipient, "now() - interval '1 minute'");
    }

    String statusOf(UUID id) {
        return jdbc.queryForObject("select status from reminders where id = ?", String.class, id);
    }

    int attemptsOf(UUID id) {
        return jdbc.queryForObject("select attempts from reminders where id = ?", Integer.class, id);
    }

    void makeDueAgain(UUID id) {
        jdbc.update("update reminders set fire_at = now() - interval '1 minute' where id = ?", id);
    }

    @Test
    void sendsDueReminder() {
        when(push.send(anyList())).thenReturn(List.of(PushResult.success()));
        UUID r = insertDue(lanId);

        assertThat(dispatcher.dispatchDue()).isEqualTo(1);

        assertThat(statusOf(r)).isEqualTo("SENT");
        verify(push).send(argThat(list -> list.size() == 1
                && list.get(0).to().equals(TOKEN)
                && list.get(0).title().equals("Tiêu đề")
                && "coupleapp://moments/x".equals(list.get(0).data().get("url"))));
    }

    @Test
    void futureRemindersAreNotSent() {
        insertReminder(lanId, "now() + interval '1 hour'");
        assertThat(dispatcher.dispatchDue()).isZero();
        verifyNoInteractions(push);
    }

    @Test
    void deadDeviceIsRemoved() {
        when(push.send(anyList())).thenReturn(List.of(PushResult.failure("DeviceNotRegistered")));
        UUID r = insertDue(lanId);

        dispatcher.dispatchDue();

        assertThat(statusOf(r)).isEqualTo("SENT");
        assertThat(jdbc.queryForObject("select count(*) from device_tokens", Integer.class)).isZero();
    }

    @Test
    void transientFailureRetriesThenFails() {
        when(push.send(anyList())).thenReturn(List.of(PushResult.failure("MessageRateExceeded")));
        UUID r = insertDue(lanId);

        dispatcher.dispatchDue();
        assertThat(statusOf(r)).isEqualTo("PENDING");
        assertThat(attemptsOf(r)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select fire_at from reminders where id = ?", Timestamp.class, r).toInstant())
                .isAfter(Instant.now());

        makeDueAgain(r);
        dispatcher.dispatchDue();
        makeDueAgain(r);
        dispatcher.dispatchDue();

        assertThat(statusOf(r)).isEqualTo("FAILED");
        assertThat(attemptsOf(r)).isEqualTo(3);
    }

    @Test
    void senderExceptionCountsAsFailedAttempt() {
        when(push.send(anyList())).thenThrow(new RuntimeException("expo down"));
        UUID r = insertDue(lanId);

        dispatcher.dispatchDue();

        assertThat(statusOf(r)).isEqualTo("PENDING");
        assertThat(attemptsOf(r)).isEqualTo(1);
    }

    @Test
    void disabledPreferenceCancelsReminder() throws Exception {
        put("/api/me/settings", lan, Map.of("notifyPrefs", Map.of("CUSTOM", false)));
        UUID r = insertDue(lanId);

        dispatcher.dispatchDue();

        assertThat(statusOf(r)).isEqualTo("CANCELLED");
        verifyNoInteractions(push);
    }

    @Test
    void recipientWithoutDeviceIsMarkedSent() {
        UUID r = insertDue(minhId);
        dispatcher.dispatchDue();
        assertThat(statusOf(r)).isEqualTo("SENT");
        verifyNoInteractions(push);
    }

    @Test
    void concurrentDispatchSendsOnce() throws Exception {
        when(push.send(anyList())).thenAnswer(inv -> {
            Thread.sleep(300);
            return List.of(PushResult.success());
        });
        insertDue(lanId);

        CompletableFuture<Integer> a = CompletableFuture.supplyAsync(dispatcher::dispatchDue);
        CompletableFuture<Integer> b = CompletableFuture.supplyAsync(dispatcher::dispatchDue);

        assertThat(a.get() + b.get()).isEqualTo(1);
        verify(push, times(1)).send(anyList());
    }

    @Test
    void pairingNotifiesInviter() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        String hung = register("hung@x.vn", "Hùng");
        post("/api/me/devices", hoa, Map.of("token", "ExponentPushToken[hoa]", "platform", "ios"));
        when(push.send(anyList())).thenReturn(List.of(PushResult.success()));

        pair(hoa, hung);

        verify(push).send(argThat(list -> list.get(0).to().equals("ExponentPushToken[hoa]")
                && list.get(0).title().equals("💞 Ghép đôi thành công")
                && list.get(0).body().contains("Hùng")));
    }

    @Test
    void dailyReplanRestoresRecurringReminders() throws Exception {
        post("/api/moments", lan, Map.of("type", "ANNIVERSARY", "title", "Ngày yêu nhau",
                "occursOn", LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(50).toString()));
        jdbc.update("update reminders set status = 'CANCELLED'");

        assertThat(scheduler.replanAllRecurring()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from reminders where status = 'PENDING'", Integer.class))
                .isPositive();
    }
}
