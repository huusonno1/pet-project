package com.coupleapp.notification;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {

    Optional<DeviceToken> findByExpoPushToken(String expoPushToken);

    List<DeviceToken> findByUserId(UUID userId);

    void deleteByExpoPushTokenAndUserId(String expoPushToken, UUID userId);
}
