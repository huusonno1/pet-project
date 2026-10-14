package com.coupleapp.trait;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "preferences")
@Getter
@Setter
@NoArgsConstructor
public class Preference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID subjectUserId;
    private String category;
    private String brand;
    private String name;
    private String color;
    private String note;
    private UUID imageMediaId;

    @Enumerated(EnumType.STRING)
    private Visibility visibility = Visibility.SHARED;

    private UUID createdBy;
    private Instant createdAt;
    private Instant updatedAt;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "preference_id", nullable = false)
    @OrderBy("createdAt")
    private List<PreferenceLink> links = new ArrayList<>();
}
