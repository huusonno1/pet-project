package com.coupleapp.place;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.place.PlaceDtos.PlaceDto;
import com.coupleapp.place.PlaceDtos.PlaceInput;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlaceService {

    private final PlaceRepository places;
    private final Clock clock;

    @Transactional
    public Place create(UUID coupleId, UUID userId, PlaceInput in) {
        Instant now = clock.instant();
        Place p = new Place();
        p.setCoupleId(coupleId);
        p.setName(in.name().trim());
        p.setAddress(in.address());
        p.setLat(in.lat());
        p.setLng(in.lng());
        p.setCategory(in.category());
        p.setCreatedBy(userId);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        return places.save(p);
    }

    @Transactional(readOnly = true)
    public Place require(UUID placeId, UUID coupleId) {
        return places.findById(placeId)
                .filter(p -> p.getCoupleId().equals(coupleId))
                .orElseThrow(() -> new ApiException(ErrorCode.VALIDATION_FAILED, "Địa điểm không hợp lệ"));
    }

    @Transactional(readOnly = true)
    public Optional<PlaceDto> find(UUID placeId) {
        return placeId == null ? Optional.empty() : places.findById(placeId).map(PlaceService::toDto);
    }

    public static PlaceDto toDto(Place p) {
        return new PlaceDto(p.getId(), p.getName(), p.getAddress(), p.getLat(), p.getLng(), p.getCategory());
    }
}
