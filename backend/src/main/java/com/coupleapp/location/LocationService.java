package com.coupleapp.location;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.location.LocationDtos.DistanceResponse;
import com.coupleapp.location.LocationDtos.LocationRequest;
import com.coupleapp.location.LocationDtos.Stamp;
import com.coupleapp.user.UserSettings;
import com.coupleapp.user.UserSettingsChangedEvent;
import com.coupleapp.user.UserSettingsRepository;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final UserLocationRepository locations;
    private final UserSettingsRepository settings;
    private final CoupleAccess couples;
    private final Clock clock;

    @Transactional
    public void update(UUID userId, LocationRequest r) {
        if (!sharing(userId)) {
            throw new ApiException(ErrorCode.LOCATION_NOT_SHARED, "Bạn đang tắt chia sẻ vị trí");
        }
        UserLocation l = locations.findById(userId).orElseGet(() -> new UserLocation(userId));
        l.setLat(r.lat());
        l.setLng(r.lng());
        l.setAccuracyM(r.accuracy());
        l.setUpdatedAt(clock.instant());
        locations.save(l);
    }

    @Transactional
    public void clear(UUID userId) {
        locations.deleteById(userId);
    }

    @Transactional(readOnly = true)
    public DistanceResponse distance(UUID userId) {
        CoupleContext c = couples.requireActive(userId);
        Optional<UserLocation> mine = locations.findById(userId);
        Optional<UserLocation> theirs = sharing(c.partnerId()) ? locations.findById(c.partnerId()) : Optional.empty();
        Double km = null;
        if (mine.isPresent() && theirs.isPresent()) {
            double raw = Geo.haversineKm(mine.get().getLat(), mine.get().getLng(), theirs.get().getLat(), theirs.get().getLng());
            km = Math.round(raw * 10) / 10.0;
        }
        return new DistanceResponse(
                km,
                mine.map(l -> new Stamp(l.getUpdatedAt())).orElse(null),
                theirs.map(l -> new Stamp(l.getUpdatedAt())).orElse(null));
    }

    @EventListener
    public void onSettingsChanged(UserSettingsChangedEvent e) {
        if (e.shareLocationChanged() && !e.shareLocation()) {
            locations.deleteById(e.userId());
        }
    }

    private boolean sharing(UUID userId) {
        return settings.findById(userId).map(UserSettings::isShareLocation).orElse(true);
    }
}
