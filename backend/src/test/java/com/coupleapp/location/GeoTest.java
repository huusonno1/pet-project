package com.coupleapp.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class GeoTest {

    @Test
    void hanoiToHoChiMinhCityIsAbout1137Km() {
        double km = Geo.haversineKm(21.0285, 105.8542, 10.8231, 106.6297);
        assertThat(km).isCloseTo(1137, within(15.0));
    }

    @Test
    void samePointIsZero() {
        assertThat(Geo.haversineKm(21.0, 105.0, 21.0, 105.0)).isZero();
    }
}
