package com.coupleapp.media;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
class MediaCleanupJob {

    private final MediaService media;

    @Scheduled(cron = "0 30 3 * * *", zone = "Asia/Ho_Chi_Minh")
    void run() {
        int removed = media.cleanupPending();
        if (removed > 0) {
            log.info("Đã xoá {} ảnh upload dở", removed);
        }
    }
}
