package com.coupleapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class CoupleApplication {
    public static void main(String[] args) {
        SpringApplication.run(CoupleApplication.class, args);
    }
}
