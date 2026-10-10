package com.coupleapp.couple;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoupleMemberRepository extends JpaRepository<CoupleMember, CoupleMember.Pk> {

    Optional<CoupleMember> findByUserIdAndLeftAtIsNull(UUID userId);

    List<CoupleMember> findByCoupleIdAndLeftAtIsNull(UUID coupleId);
}
