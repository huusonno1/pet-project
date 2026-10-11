package com.coupleapp.media;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.couple.CoupleContext;
import com.coupleapp.media.MediaDtos.MediaDto;
import com.coupleapp.media.MediaDtos.Purpose;
import com.coupleapp.media.MediaDtos.UploadUrlRequest;
import com.coupleapp.media.MediaDtos.UploadUrlResponse;
import com.coupleapp.storage.StorageProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaService {

    static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/webp", "webp", "image/heic", "heic");
    static final long MAX_BYTES = 15L * 1024 * 1024;
    static final Duration PUT_TTL = Duration.ofMinutes(10);
    static final Duration GET_TTL = Duration.ofHours(1);

    private final MediaRepository media;
    private final CoupleAccess couples;
    private final S3Client s3;
    private final S3Presigner presigner;
    private final StorageProperties props;
    private final Clock clock;

    @Transactional
    public UploadUrlResponse createUpload(UUID userId, UploadUrlRequest r) {
        String ext = EXTENSIONS.get(r.contentType());
        if (ext == null) {
            throw invalid("Chỉ hỗ trợ ảnh JPEG, PNG, WEBP, HEIC");
        }
        if (r.sizeBytes() > MAX_BYTES) {
            throw invalid("Ảnh tối đa 15MB");
        }
        Instant now = clock.instant();
        Media m = new Media();
        m.setId(UUID.randomUUID());
        m.setUploaderId(userId);
        m.setContentType(r.contentType());
        m.setWidth(r.width());
        m.setHeight(r.height());
        m.setFilter(r.filter());
        m.setTakenAt(r.takenAt());
        m.setLat(r.lat());
        m.setLng(r.lng());
        m.setStatus(MediaStatus.PENDING);
        m.setCreatedAt(now);
        if (r.purpose() == Purpose.AVATAR) {
            m.setObjectKey("users/%s/avatar/%s.%s".formatted(userId, m.getId(), ext));
        } else {
            ZonedDateTime t = now.atZone(ZoneOffset.UTC);
            UUID coupleId = couples.findActive(userId).map(CoupleContext::coupleId).orElse(null);
            m.setCoupleId(coupleId);
            m.setObjectKey(coupleId != null
                    ? "couples/%s/%d/%02d/%s.%s".formatted(coupleId, t.getYear(), t.getMonthValue(), m.getId(), ext)
                    : "users/%s/moments/%d/%02d/%s.%s".formatted(userId, t.getYear(), t.getMonthValue(), m.getId(), ext));
        }
        media.save(m);

        String url = presigner.presignPutObject(b -> b
                        .signatureDuration(PUT_TTL)
                        .putObjectRequest(o -> o.bucket(props.bucket()).key(m.getObjectKey()).contentType(r.contentType())))
                .url().toString();
        return new UploadUrlResponse(m.getId(), url, "PUT", Map.of("Content-Type", r.contentType()), now.plus(PUT_TTL));
    }

    @Transactional
    public MediaDto confirm(UUID userId, UUID mediaId) {
        Media m = ownMedia(userId, mediaId);
        if (m.getStatus() == MediaStatus.READY) {
            return toDto(m);
        }
        HeadObjectResponse head;
        try {
            head = s3.headObject(b -> b.bucket(props.bucket()).key(m.getObjectKey()));
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                throw new ApiException(ErrorCode.MEDIA_NOT_UPLOADED, "Ảnh chưa được tải lên");
            }
            throw e;
        }
        if (head.contentLength() > MAX_BYTES) {
            deleteObject(m);
            media.delete(m);
            throw invalid("Ảnh tối đa 15MB");
        }
        m.setSizeBytes(head.contentLength());
        m.setStatus(MediaStatus.READY);
        return toDto(m);
    }

    @Transactional
    public void delete(UUID userId, UUID mediaId) {
        Media m = ownMedia(userId, mediaId);
        deleteObject(m);
        media.delete(m);
    }

    @Transactional(readOnly = true)
    public List<MediaDto> dtos(List<UUID> ids) {
        Map<UUID, Media> byId = media.findAllById(ids).stream()
                .collect(Collectors.toMap(Media::getId, Function.identity()));
        return ids.stream().map(byId::get).filter(Objects::nonNull).map(this::toDto).toList();
    }

    /** Ảnh phải READY, không trùng; coupleId != null → thuộc cặp đôi đó; null → ảnh riêng do userId tải lên. */
    @Transactional(readOnly = true)
    public void requireUsable(List<UUID> ids, UUID coupleId, UUID userId) {
        if (ids.isEmpty()) {
            return;
        }
        if (new HashSet<>(ids).size() != ids.size()) {
            throw invalid("Danh sách ảnh bị trùng");
        }
        List<Media> found = media.findAllById(ids);
        boolean ok = found.size() == ids.size() && found.stream().allMatch(m -> m.getStatus() == MediaStatus.READY
                && (coupleId != null
                        ? coupleId.equals(m.getCoupleId())
                        : m.getCoupleId() == null && m.getUploaderId().equals(userId)));
        if (!ok) {
            throw invalid("Ảnh không hợp lệ");
        }
    }

    @Transactional(readOnly = true)
    public void requireAvatar(UUID userId, UUID mediaId) {
        boolean ok = media.findById(mediaId)
                .filter(m -> m.getUploaderId().equals(userId)
                        && m.getCoupleId() == null
                        && m.getStatus() == MediaStatus.READY)
                .isPresent();
        if (!ok) {
            throw invalid("Ảnh đại diện không hợp lệ");
        }
    }

    @Transactional(readOnly = true)
    public Optional<String> avatarUrl(UUID mediaId) {
        return media.findById(mediaId).map(this::url);
    }

    @Transactional
    public int cleanupPending() {
        List<Media> stale = media.findByStatusAndCreatedAtBefore(
                MediaStatus.PENDING, clock.instant().minus(Duration.ofHours(24)));
        for (Media m : stale) {
            try {
                deleteObject(m);
            } catch (S3Exception e) {
                log.warn("Không xoá được object {}", m.getObjectKey(), e);
            }
        }
        media.deleteAll(stale);
        return stale.size();
    }

    public MediaDto toDto(Media m) {
        return new MediaDto(m.getId(), url(m), m.getWidth(), m.getHeight(), m.getFilter(), m.getTakenAt());
    }

    private String url(Media m) {
        return presigner.presignGetObject(b -> b
                        .signatureDuration(GET_TTL)
                        .getObjectRequest(o -> o.bucket(props.bucket()).key(m.getObjectKey())))
                .url().toString();
    }

    private Media ownMedia(UUID userId, UUID mediaId) {
        return media.findById(mediaId).filter(m -> m.getUploaderId().equals(userId)).orElseThrow(ApiException::notFound);
    }

    private void deleteObject(Media m) {
        s3.deleteObject(b -> b.bucket(props.bucket()).key(m.getObjectKey()));
    }

    private static ApiException invalid(String detail) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, detail);
    }
}
