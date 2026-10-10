package com.coupleapp.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.storage")
public record StorageProperties(
        String endpoint, String publicEndpoint, String region, String accessKey, String secretKey, String bucket) {}
