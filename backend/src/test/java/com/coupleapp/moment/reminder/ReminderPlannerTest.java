package com.coupleapp.moment.reminder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.coupleapp.common.ApiException;
import com.coupleapp.moment.Moment;
import com.coupleapp.moment.MomentType;
import com.coupleapp.moment.Recurrence;
import com.coupleapp.moment.handler.AnniversaryHandler;
import com.coupleapp.moment.handler.CustomHandler;
import com.coupleapp.moment.handler.CycleHandler;
import com.coupleapp.moment.handler.DatePlanHandler;
import com.coupleapp.moment.handler.GiftOccasionHandler;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReminderPlannerTest {

    static final UUID OWNER = UUID.randomUUID();
    static final UUID PARTNER = UUID.randomUUID();
    static final ZoneId ICT = ZoneId.of("Asia/Ho_Chi_Minh");
    static final Instant NOW = Instant.parse("2026-01-02T00:00:00Z");
    static final Instant HORIZON = NOW.plus(Duration.ofDays(400));

    final ReminderPlanner planner = new ReminderPlanner();

    static PlanningContext ctx(ZoneId partnerZone, boolean cycleShared) {
        return new PlanningContext(OWNER, PARTNER, "Lan", "Minh", ICT, partnerZone, cycleShared, NOW, HORIZON);
    }

    static PlanningContext ctx() {
        return ctx(ICT, true);
    }

    static Moment moment(MomentType type, String occursOn) {
        Moment m = new Moment();
        m.setId(UUID.randomUUID());
        m.setType(type);
        m.setTitle("Test");
        m.setOccursOn(LocalDate.parse(occursOn));
        m.setCreatedBy(OWNER);
        return m;
    }

    static List<Instant> fires(List<ReminderPlan> plans, UUID recipient) {
        return plans.stream().filter(p -> p.recipientId().equals(recipient)).map(ReminderPlan::fireAt).sorted().toList();
    }

    static Instant at(String iso) {
        return Instant.parse(iso);
    }

    @Test
    void anniversaryDefaultsCoverMilestonesAndYearlyForBoth() {
        Moment m = moment(MomentType.ANNIVERSARY, "2026-01-01");
        List<ReminderPlan> plans = planner.plan(m, new AnniversaryHandler(), ctx());

        // 100 ngày (11/04), 200 ngày (20/07), 300 ngày (28/10), 1 năm (01/01/2027) × (P3D, P0D) × 2 người
        assertThat(plans).hasSize(16);
        assertThat(fires(plans, OWNER)).contains(
                at("2026-04-08T01:00:00Z"), at("2026-04-11T01:00:00Z"), at("2027-01-01T01:00:00Z"));
        assertThat(fires(plans, PARTNER)).isEqualTo(fires(plans, OWNER));
        assertThat(plans).allMatch(p -> p.fireAt().isAfter(NOW) && !p.fireAt().isAfter(HORIZON));
        assertThat(plans).anyMatch(p -> p.title().equals("💞 100 ngày bên nhau") && p.body().startsWith("Còn 3 ngày nữa"));
        assertThat(plans).allMatch(p -> p.deepLink().equals("coupleapp://moments/" + m.getId()));
    }

    @Test
    void customMilestonesReplaceDefaults() {
        Moment m = moment(MomentType.ANNIVERSARY, "2026-01-01");
        m.setReminderConfig(new ReminderConfig(List.of(150), false, null, null, null));

        List<ReminderPlan> plans = planner.plan(m, new AnniversaryHandler(), ctx());

        assertThat(fires(plans, OWNER)).containsExactly(at("2026-05-28T01:00:00Z"), at("2026-05-31T01:00:00Z"));
        assertThat(plans).hasSize(4);
    }

    @Test
    void giftOnFeb29FallsBackToFeb28AndOnlyGiverIsNotified() {
        Moment m = moment(MomentType.GIFT_OCCASION, "2024-02-29");
        m.setTitle("Sinh nhật Lan");
        m.setRecurrence(Recurrence.YEARLY);
        m.setSubjectUserId(OWNER);
        m.setDetails(Map.of("occasion", "BIRTHDAY"));

        List<ReminderPlan> plans = planner.plan(m, new GiftOccasionHandler(), ctx());

        assertThat(fires(plans, PARTNER)).containsExactly(at("2026-02-21T01:00:00Z"), at("2026-02-27T01:00:00Z"));
        assertThat(fires(plans, OWNER)).isEmpty();
        assertThat(plans).allMatch(p -> p.deepLink().equals("coupleapp://traits/" + OWNER));
        assertThat(plans).allMatch(p -> p.body().contains("Lan"));
    }

    @Test
    void giftAudienceCanBeOverriddenToBoth() {
        Moment m = moment(MomentType.GIFT_OCCASION, "2024-02-29");
        m.setRecurrence(Recurrence.YEARLY);
        m.setSubjectUserId(OWNER);
        m.setDetails(Map.of("occasion", "BIRTHDAY"));
        m.setReminderConfig(new ReminderConfig(null, null, null, null, Audience.BOTH));

        List<ReminderPlan> plans = planner.plan(m, new GiftOccasionHandler(), ctx());

        assertThat(plans).hasSize(4);
        assertThat(plans).filteredOn(p -> p.role() == Role.OWNER).allMatch(p -> p.body().contains("của bạn"));
    }

    @Test
    void datePlanUsesEveningBeforeAndHoursBeforeStart() {
        Moment m = moment(MomentType.DATE_PLAN, "2026-03-10");
        m.setOccursAt(at("2026-03-10T12:00:00Z")); // 19:00 giờ VN

        List<ReminderPlan> plans = planner.plan(m, new DatePlanHandler(), ctx());

        assertThat(fires(plans, OWNER)).containsExactly(at("2026-03-09T13:00:00Z"), at("2026-03-10T10:00:00Z"));
        assertThat(fires(plans, PARTNER)).containsExactly(at("2026-03-09T13:00:00Z"), at("2026-03-10T10:00:00Z"));
    }

    @Test
    void cycleNotSharedOnlyNotifiesSubject() {
        Moment m = moment(MomentType.CYCLE, "2026-01-20");
        m.setSubjectUserId(OWNER);

        List<ReminderPlan> plans = planner.plan(m, new CycleHandler(), ctx(ICT, false));

        assertThat(fires(plans, OWNER)).containsExactly(at("2026-01-18T01:00:00Z"), at("2026-01-20T01:00:00Z"));
        assertThat(fires(plans, PARTNER)).isEmpty();
    }

    @Test
    void cycleSharedSendsCaringMessageToPartner() {
        Moment m = moment(MomentType.CYCLE, "2026-01-20");
        m.setSubjectUserId(OWNER);

        List<ReminderPlan> plans = planner.plan(m, new CycleHandler(), ctx());

        assertThat(plans).hasSize(4);
        assertThat(plans).filteredOn(p -> p.role() == Role.PARTNER)
                .anyMatch(p -> p.body().equals("Khoảng 2 ngày nữa là tới ngày của Lan, nhớ quan tâm nhé 💗"));
    }

    @Test
    void eachRecipientUsesOwnTimezone() {
        Moment m = moment(MomentType.CUSTOM, "2026-02-01");
        m.setReminderConfig(new ReminderConfig(null, null, null, null, Audience.BOTH));

        List<ReminderPlan> plans = planner.plan(m, new CustomHandler(), ctx(ZoneId.of("Asia/Tokyo"), true));

        assertThat(fires(plans, OWNER)).containsExactly(at("2026-01-31T01:00:00Z"), at("2026-02-01T01:00:00Z"));
        assertThat(fires(plans, PARTNER)).containsExactly(at("2026-01-30T23:00:00Z"), at("2026-01-31T23:00:00Z"));
    }

    @Test
    void pastOccurrencesProduceNothing() {
        Moment m = moment(MomentType.CUSTOM, "2026-01-01");
        assertThat(planner.plan(m, new CustomHandler(), ctx())).isEmpty();
    }

    @Test
    void handlersValidateRequiredFields() {
        Moment datePlan = moment(MomentType.DATE_PLAN, "2026-03-10");
        assertThatThrownBy(() -> new DatePlanHandler().validate(datePlan)).isInstanceOf(ApiException.class);

        Moment gift = moment(MomentType.GIFT_OCCASION, "2026-03-08");
        gift.setDetails(Map.of("occasion", "BIRTHDAY"));
        assertThatThrownBy(() -> new GiftOccasionHandler().validate(gift)).isInstanceOf(ApiException.class);

        gift.setSubjectUserId(OWNER);
        gift.setDetails(Map.of("occasion", "UNKNOWN"));
        assertThatThrownBy(() -> new GiftOccasionHandler().validate(gift)).isInstanceOf(ApiException.class);
    }
}
