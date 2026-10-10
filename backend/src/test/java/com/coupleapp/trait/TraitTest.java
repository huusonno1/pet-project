package com.coupleapp.trait;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TraitTest extends IntegrationTest {

    String lan;
    String minh;
    UUID minhId;
    UUID lanId;

    @BeforeEach
    void setUp() throws Exception {
        lan = register("lan@x.vn", "Lan");
        minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        lanId = userId(lan);
        minhId = userId(minh);
    }

    @Test
    void sharedSizeIsVisibleToBoth() throws Exception {
        post("/api/traits/sizes", lan, Map.of("subjectUserId", minhId, "kind", "SHIRT", "value", "L", "note", "form rộng"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visibility").value("SHARED"));

        get("/api/traits/" + minhId, minh)
                .andExpect(jsonPath("$.sizes[0].kind").value("SHIRT"))
                .andExpect(jsonPath("$.sizes[0].value").value("L"));
        get("/api/traits/" + minhId, lan).andExpect(jsonPath("$.sizes.length()").value(1));
    }

    @Test
    void authorOnlyPreferenceIsHiddenFromSubject() throws Exception {
        String id = read(post("/api/traits/preferences", minh, Map.of(
                "subjectUserId", lanId, "category", "BAG", "brand", "Charles & Keith", "visibility", "AUTHOR_ONLY",
                "note", "Định tặng sinh nhật",
                "links", List.of(Map.of("url", "https://shopee.vn/abc", "label", "Shopee", "price", 1290000))))
                .andExpect(status().isCreated())).get("id").asText();

        get("/api/traits/" + lanId, lan).andExpect(jsonPath("$.preferences.length()").value(0));
        get("/api/traits/" + lanId, minh)
                .andExpect(jsonPath("$.preferences[0].links[0].price").value(1290000));
        patch("/api/traits/preferences/" + id, lan, Map.of("note", "lộ rồi")).andExpect(status().isNotFound());
        delete("/api/traits/preferences/" + id, lan).andExpect(status().isNotFound());
    }

    @Test
    void subjectCanEditSharedEntryButNotChangeVisibility() throws Exception {
        String id = read(post("/api/traits/sizes", lan, Map.of("subjectUserId", minhId, "kind", "SHOE", "value", "42")))
                .get("id").asText();

        patch("/api/traits/sizes/" + id, minh, Map.of("value", "43"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("43"));
        patch("/api/traits/sizes/" + id, minh, Map.of("visibility", "AUTHOR_ONLY"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void strangersCannotReadOrWrite() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        get("/api/traits/" + lanId, hoa).andExpect(status().isNotFound());
        post("/api/traits/sizes", hoa, Map.of("subjectUserId", lanId, "kind", "RING", "value", "8"))
                .andExpect(status().isNotFound());
    }

    @Test
    void patchReplacesLinks() throws Exception {
        String id = read(post("/api/traits/preferences", lan, Map.of(
                "subjectUserId", minhId, "category", "KEYBOARD", "name", "Keychron K2",
                "links", List.of(Map.of("url", "https://a.vn/1"), Map.of("url", "https://b.vn/2"))))).get("id").asText();

        patch("/api/traits/preferences/" + id, lan, Map.of("links", List.of(Map.of("url", "https://c.vn/3"))))
                .andExpect(jsonPath("$.links.length()").value(1))
                .andExpect(jsonPath("$.links[0].url").value("https://c.vn/3"))
                .andExpect(jsonPath("$.name").value("Keychron K2"));
    }

    @Test
    void validatesKindAndLinkUrl() throws Exception {
        post("/api/traits/sizes", lan, Map.of("subjectUserId", minhId, "kind", "shirt", "value", "L"))
                .andExpect(status().isBadRequest());
        post("/api/traits/preferences", lan, Map.of("subjectUserId", minhId, "category", "BAG",
                "links", List.of(Map.of("url", "javascript:alert(1)"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void canNoteAboutSelfWithoutCouple() throws Exception {
        String hoa = register("hoa@x.vn", "Hoa");
        UUID hoaId = userId(hoa);
        post("/api/traits/sizes", hoa, Map.of("subjectUserId", hoaId, "kind", "RING", "value", "7"))
                .andExpect(status().isCreated());
    }

    @Test
    void catalogListsSuggestedKinds() throws Exception {
        get("/api/traits/catalog", lan)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sizeKinds[0].code").value("SHIRT"))
                .andExpect(jsonPath("$.preferenceCategories[0].code").value("BAG"));
    }
}
