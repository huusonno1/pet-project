package com.coupleapp.media;

import com.coupleapp.common.AuthUser;
import com.coupleapp.media.MediaDtos.MediaDto;
import com.coupleapp.media.MediaDtos.UploadUrlRequest;
import com.coupleapp.media.MediaDtos.UploadUrlResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService media;

    @PostMapping("/upload-url")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadUrlResponse uploadUrl(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UploadUrlRequest r) {
        return media.createUpload(AuthUser.id(jwt), r);
    }

    @PostMapping("/{id}/confirm")
    public MediaDto confirm(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return media.confirm(AuthUser.id(jwt), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        media.delete(AuthUser.id(jwt), id);
    }
}
