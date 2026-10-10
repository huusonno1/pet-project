package com.coupleapp.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.coupleapp.support.IntegrationTest;
import java.util.Map;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;

class LocationTest extends IntegrationTest {

    @Test
    void distanceBetweenPartners() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);

        get("/api/couples/distance", lan)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.distanceKm").doesNotExist())
                .andExpect(jsonPath("$.partner").doesNotExist());

        put("/api/me/location", lan, Map.of("lat", 21.0285, "lng", 105.8542, "accuracy", 20)).andExpect(status().isNoContent());
        put("/api/me/location", minh, Map.of("lat", 10.8231, "lng", 106.6297)).andExpect(status().isNoContent());

        get("/api/couples/distance", lan)
                .andExpect(jsonPath("$.distanceKm", Matchers.closeTo(1137.0, 15.0)))
                .andExpect(jsonPath("$.me.updatedAt").exists())
                .andExpect(jsonPath("$.partner.updatedAt").exists())
                .andExpect(jsonPath("$.partner.lat").doesNotExist());
    }

    @Test
    void disablingShareLocationDeletesLocationAndBlocksUpdates() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        String minh = register("minh@x.vn", "Minh");
        pair(lan, minh);
        put("/api/me/location", lan, Map.of("lat", 21.0, "lng", 105.8));
        put("/api/me/location", minh, Map.of("lat", 10.8, "lng", 106.6));

        put("/api/me/settings", minh, Map.of("shareLocation", false)).andExpect(status().isOk());

        assertThat(jdbc.queryForObject("select count(*) from user_locations", Integer.class)).isEqualTo(1);
        get("/api/couples/distance", lan)
                .andExpect(jsonPath("$.distanceKm").doesNotExist())
                .andExpect(jsonPath("$.partner").doesNotExist());
        put("/api/me/location", minh, Map.of("lat", 10.8, "lng", 106.6))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LOCATION_NOT_SHARED"));
    }

    @Test
    void invalidCoordinatesAreRejected() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        put("/api/me/location", lan, Map.of("lat", 91, "lng", 0)).andExpect(status().isBadRequest());
    }

    @Test
    void distanceRequiresCouple() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        get("/api/couples/distance", lan).andExpect(jsonPath("$.code").value("COUPLE_REQUIRED"));
    }

    @Test
    void deleteLocation() throws Exception {
        String lan = register("lan@x.vn", "Lan");
        put("/api/me/location", lan, Map.of("lat", 21.0, "lng", 105.8));
        delete("/api/me/location", lan).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select count(*) from user_locations", Integer.class)).isZero();
    }
}
