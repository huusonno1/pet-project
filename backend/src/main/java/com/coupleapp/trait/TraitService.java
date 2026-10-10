package com.coupleapp.trait;

import com.coupleapp.common.ApiException;
import com.coupleapp.common.ErrorCode;
import com.coupleapp.couple.CoupleAccess;
import com.coupleapp.trait.TraitDtos.CatalogItem;
import com.coupleapp.trait.TraitDtos.CatalogResponse;
import com.coupleapp.trait.TraitDtos.LinkDto;
import com.coupleapp.trait.TraitDtos.LinkInput;
import com.coupleapp.trait.TraitDtos.PreferenceDto;
import com.coupleapp.trait.TraitDtos.PreferencePatch;
import com.coupleapp.trait.TraitDtos.PreferenceRequest;
import com.coupleapp.trait.TraitDtos.SizeDto;
import com.coupleapp.trait.TraitDtos.SizePatch;
import com.coupleapp.trait.TraitDtos.SizeRequest;
import com.coupleapp.trait.TraitDtos.TraitsResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TraitService {

    static final CatalogResponse CATALOG = new CatalogResponse(
            List.of(new CatalogItem("SHIRT", "Áo"), new CatalogItem("PANTS", "Quần"),
                    new CatalogItem("SHOE", "Giày"), new CatalogItem("RING", "Nhẫn (ngón tay)"),
                    new CatalogItem("BRACELET", "Vòng tay"), new CatalogItem("NECKLACE", "Vòng cổ"),
                    new CatalogItem("BRA", "Áo ngực"), new CatalogItem("WAIST", "Vòng eo"),
                    new CatalogItem("HAT", "Mũ")),
            List.of(new CatalogItem("BAG", "Túi"), new CatalogItem("LIPSTICK", "Son"),
                    new CatalogItem("PERFUME", "Nước hoa"), new CatalogItem("SKINCARE", "Skincare"),
                    new CatalogItem("KEYBOARD", "Bàn phím"), new CatalogItem("WATCH", "Đồng hồ"),
                    new CatalogItem("SHOES", "Giày dép"), new CatalogItem("CLOTHES", "Quần áo"),
                    new CatalogItem("FOOD", "Đồ ăn"), new CatalogItem("DRINK", "Đồ uống"),
                    new CatalogItem("COLOR", "Màu sắc"), new CatalogItem("FLOWER", "Hoa"),
                    new CatalogItem("HOBBY", "Sở thích"), new CatalogItem("OTHER", "Khác")));

    private final SizeEntryRepository sizes;
    private final PreferenceRepository preferences;
    private final CoupleAccess couples;
    private final Clock clock;

    public CatalogResponse catalog() {
        return CATALOG;
    }

    @Transactional(readOnly = true)
    public TraitsResponse list(UUID me, UUID subject) {
        requireAccess(me, subject);
        List<SizeDto> s = sizes.findBySubjectUserIdOrderByCreatedAtAsc(subject).stream()
                .filter(e -> visible(me, e.getVisibility(), e.getCreatedBy()))
                .map(TraitService::toDto).toList();
        List<PreferenceDto> p = preferences.findBySubjectUserIdOrderByCreatedAtAsc(subject).stream()
                .filter(e -> visible(me, e.getVisibility(), e.getCreatedBy()))
                .map(TraitService::toDto).toList();
        return new TraitsResponse(s, p);
    }

    @Transactional
    public SizeDto createSize(UUID me, SizeRequest r) {
        requireAccess(me, r.subjectUserId());
        Instant now = clock.instant();
        SizeEntry e = new SizeEntry();
        e.setSubjectUserId(r.subjectUserId());
        e.setKind(r.kind());
        e.setValue(r.value().trim());
        e.setNote(r.note());
        e.setVisibility(r.visibility() != null ? r.visibility() : Visibility.SHARED);
        e.setCreatedBy(me);
        e.setCreatedAt(now);
        e.setUpdatedAt(now);
        return toDto(sizes.save(e));
    }

    @Transactional
    public SizeDto updateSize(UUID me, UUID id, SizePatch r) {
        SizeEntry e = sizes.findById(id).orElseThrow(ApiException::notFound);
        requireEditable(me, e.getSubjectUserId(), e.getVisibility(), e.getCreatedBy());
        checkVisibilityChange(me, e.getCreatedBy(), e.getVisibility(), r.visibility());
        if (r.kind() != null) e.setKind(r.kind());
        if (r.value() != null) e.setValue(r.value().trim());
        if (r.note() != null) e.setNote(r.note());
        if (r.visibility() != null) e.setVisibility(r.visibility());
        e.setUpdatedAt(clock.instant());
        return toDto(e);
    }

    @Transactional
    public void deleteSize(UUID me, UUID id) {
        SizeEntry e = sizes.findById(id).orElseThrow(ApiException::notFound);
        requireEditable(me, e.getSubjectUserId(), e.getVisibility(), e.getCreatedBy());
        sizes.delete(e);
    }

    @Transactional
    public PreferenceDto createPreference(UUID me, PreferenceRequest r) {
        requireAccess(me, r.subjectUserId());
        Instant now = clock.instant();
        Preference p = new Preference();
        p.setSubjectUserId(r.subjectUserId());
        p.setCategory(r.category());
        p.setBrand(r.brand());
        p.setName(r.name());
        p.setColor(r.color());
        p.setNote(r.note());
        p.setVisibility(r.visibility() != null ? r.visibility() : Visibility.SHARED);
        p.setCreatedBy(me);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        if (r.links() != null) {
            r.links().forEach(l -> p.getLinks().add(toEntity(l)));
        }
        return toDto(preferences.save(p));
    }

    @Transactional
    public PreferenceDto updatePreference(UUID me, UUID id, PreferencePatch r) {
        Preference p = preferences.findById(id).orElseThrow(ApiException::notFound);
        requireEditable(me, p.getSubjectUserId(), p.getVisibility(), p.getCreatedBy());
        checkVisibilityChange(me, p.getCreatedBy(), p.getVisibility(), r.visibility());
        if (r.category() != null) p.setCategory(r.category());
        if (r.brand() != null) p.setBrand(r.brand());
        if (r.name() != null) p.setName(r.name());
        if (r.color() != null) p.setColor(r.color());
        if (r.note() != null) p.setNote(r.note());
        if (r.visibility() != null) p.setVisibility(r.visibility());
        if (r.links() != null) {
            p.getLinks().clear();
            r.links().forEach(l -> p.getLinks().add(toEntity(l)));
        }
        p.setUpdatedAt(clock.instant());
        preferences.flush();
        return toDto(p);
    }

    @Transactional
    public void deletePreference(UUID me, UUID id) {
        Preference p = preferences.findById(id).orElseThrow(ApiException::notFound);
        requireEditable(me, p.getSubjectUserId(), p.getVisibility(), p.getCreatedBy());
        preferences.delete(p);
    }

    private void requireAccess(UUID me, UUID subject) {
        if (me.equals(subject)) {
            return;
        }
        couples.findActive(me).filter(c -> c.partnerId().equals(subject)).orElseThrow(ApiException::notFound);
    }

    private void requireEditable(UUID me, UUID subject, Visibility visibility, UUID createdBy) {
        requireAccess(me, subject);
        boolean ok = me.equals(createdBy) || (visibility == Visibility.SHARED && me.equals(subject));
        if (!ok) {
            throw ApiException.notFound();
        }
    }

    private static void checkVisibilityChange(UUID me, UUID createdBy, Visibility current, Visibility requested) {
        if (requested != null && requested != current && !me.equals(createdBy)) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Chỉ người tạo được đổi chế độ hiển thị");
        }
    }

    private static boolean visible(UUID me, Visibility visibility, UUID createdBy) {
        return visibility == Visibility.SHARED || me.equals(createdBy);
    }

    private static PreferenceLink toEntity(LinkInput l) {
        PreferenceLink link = new PreferenceLink();
        link.setUrl(l.url());
        link.setLabel(l.label());
        link.setPrice(l.price());
        return link;
    }

    private static SizeDto toDto(SizeEntry e) {
        return new SizeDto(e.getId(), e.getSubjectUserId(), e.getKind(), e.getValue(), e.getNote(),
                e.getVisibility(), e.getCreatedBy(), e.getUpdatedAt());
    }

    private static PreferenceDto toDto(Preference p) {
        List<LinkDto> links = p.getLinks().stream()
                .map(l -> new LinkDto(l.getId(), l.getUrl(), l.getLabel(), l.getPrice())).toList();
        return new PreferenceDto(p.getId(), p.getSubjectUserId(), p.getCategory(), p.getBrand(), p.getName(),
                p.getColor(), p.getNote(), p.getVisibility(), p.getCreatedBy(), p.getUpdatedAt(), links);
    }
}
