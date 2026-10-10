package com.coupleapp.trait;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SizeEntryRepository extends JpaRepository<SizeEntry, UUID> {

    List<SizeEntry> findBySubjectUserIdOrderByCreatedAtAsc(UUID subjectUserId);
}
