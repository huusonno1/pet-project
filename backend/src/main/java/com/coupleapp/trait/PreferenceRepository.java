package com.coupleapp.trait;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PreferenceRepository extends JpaRepository<Preference, UUID> {

    List<Preference> findBySubjectUserIdOrderByCreatedAtAsc(UUID subjectUserId);
}
