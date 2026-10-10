package com.coupleapp.notification;

import com.coupleapp.cycle.CycleService;
import com.coupleapp.moment.reminder.ReminderScheduler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
class ReminderJobs {

    private final ReminderDispatcher dispatcher;
    private final ReminderScheduler scheduler;
    private final CycleService cycles;

    @Scheduled(fixedDelay = 60_000)
    void dispatch() {
        int processed;
        do {
            processed = dispatcher.dispatchDue();
        } while (processed == ReminderDispatcher.BATCH);
    }

    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Ho_Chi_Minh")
    void daily() {
        int cycles = this.cycles.refreshStale();
        int moments = scheduler.replanAllRecurring();
        log.info("Job hằng ngày: cập nhật {} chu kỳ, lập lại lịch {} kỷ niệm", cycles, moments);
    }
}
