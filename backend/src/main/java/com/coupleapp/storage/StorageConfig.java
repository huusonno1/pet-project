package com.coupleapp.storage;

import java.net.URI;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class StorageConfig {

    @Bean
    S3Client s3Client(StorageProperties p) {
        return S3Client.builder()
                .endpointOverride(URI.create(p.endpoint()))
                .region(Region.of(p.region()))
                .credentialsProvider(credentials(p))
                .forcePathStyle(true)
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }

    /** Ký URL bằng endpoint công khai để điện thoại truy cập được. */
    @Bean
    S3Presigner s3Presigner(StorageProperties p) {
        return S3Presigner.builder()
                .endpointOverride(URI.create(p.publicEndpoint()))
                .region(Region.of(p.region()))
                .credentialsProvider(credentials(p))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
    }

    @Bean
    ApplicationRunner ensureBucket(S3Client s3, StorageProperties p) {
        return args -> {
            try {
                s3.headBucket(b -> b.bucket(p.bucket()));
            } catch (S3Exception e) {
                if (e.statusCode() != 404) {
                    throw e;
                }
                s3.createBucket(b -> b.bucket(p.bucket()));
            }
        };
    }

    private static StaticCredentialsProvider credentials(StorageProperties p) {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(p.accessKey(), p.secretKey()));
    }
}
