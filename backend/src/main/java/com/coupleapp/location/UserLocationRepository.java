package com.coupleapp.location;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserLocationRepository extends JpaRepository<UserLocation, UUID> {}
