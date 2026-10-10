package com.coupleapp.couple;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoupleRepository extends JpaRepository<Couple, UUID> {}
