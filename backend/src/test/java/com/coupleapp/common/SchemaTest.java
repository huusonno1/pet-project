package com.coupleapp.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.coupleapp.support.IntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class SchemaTest extends IntegrationTest {

    @Test
    void allPhase1TablesExist() {
        List<String> tables = jdbc.queryForList(
                "select tablename from pg_tables where schemaname = 'public'", String.class);
        assertThat(tables).contains(
                "users", "refresh_tokens", "user_settings", "device_tokens", "couples", "couple_members",
                "media", "places", "moments", "moment_media", "cycle_logs", "reminders",
                "size_entries", "preferences", "preference_links", "user_locations");
    }

    @Test
    void userCanHaveOnlyOneActiveCouple() {
        UUID user = insertUser("a@x.vn");
        UUID c1 = insertCouple();
        UUID c2 = insertCouple();
        jdbc.update("insert into couple_members(couple_id, user_id) values (?, ?)", c1, user);

        assertThatThrownBy(() ->
                jdbc.update("insert into couple_members(couple_id, user_id) values (?, ?)", c2, user))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void userCanJoinNewCoupleAfterLeaving() {
        UUID user = insertUser("a@x.vn");
        UUID c1 = insertCouple();
        UUID c2 = insertCouple();
        jdbc.update("insert into couple_members(couple_id, user_id, left_at) values (?, ?, now())", c1, user);
        jdbc.update("insert into couple_members(couple_id, user_id) values (?, ?)", c2, user);

        assertThat(jdbc.queryForObject("select count(*) from couple_members where user_id = ?", Integer.class, user))
                .isEqualTo(2);
    }

    @Test
    void emailIsUniqueIgnoringCase() {
        insertUser("lan@x.vn");
        assertThatThrownBy(() -> insertUser("LAN@x.vn")).isInstanceOf(DataIntegrityViolationException.class);
    }

    private UUID insertUser(String email) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into users(id, email, password_hash, display_name) values (?, ?, 'h', 'U')", id, email);
        return id;
    }

    private UUID insertCouple() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into couples(id, status) values (?, 'ACTIVE')", id);
        return id;
    }
}
