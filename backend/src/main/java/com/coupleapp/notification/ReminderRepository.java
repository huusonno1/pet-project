package com.coupleapp.notification;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {

    @Modifying
    @Query(value = "update reminders set status = 'CANCELLED' where moment_id = :momentId and status = 'PENDING'",
            nativeQuery = true)
    int cancelPendingByMoment(UUID momentId);

    @Modifying
    @Query(value = "update reminders set status = 'CANCELLED' where couple_id = :coupleId and status = 'PENDING'",
            nativeQuery = true)
    int cancelPendingByCouple(UUID coupleId);

    /** Khoá các nhắc đến hạn; instance khác chạy song song sẽ bỏ qua dòng đang bị khoá. */
    @Query(value = """
            select * from reminders
            where status = 'PENDING' and fire_at <= :now
            order by fire_at
            limit :limit
            for update skip locked
            """, nativeQuery = true)
    List<Reminder> lockDue(Instant now, int limit);

    List<Reminder> findByMomentIdAndRecipientIdAndStatusOrderByFireAtAsc(
            UUID momentId, UUID recipientId, ReminderStatus status);
}
