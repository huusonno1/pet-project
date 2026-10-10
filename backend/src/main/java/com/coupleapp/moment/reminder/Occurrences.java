package com.coupleapp.moment.reminder;

import com.coupleapp.moment.Moment;
import java.time.Duration;
import java.time.LocalDate;
import java.time.MonthDay;
import java.util.ArrayList;
import java.util.List;

public final class Occurrences {

    private Occurrences() {}

    public static List<Occurrence> single(Moment m, LocalDate from, LocalDate to) {
        LocalDate d = m.getOccursOn();
        return within(d, from, to) ? List.of(new Occurrence(d, m.getOccursAt(), m.getTitle())) : List.of();
    }

    /** Lặp hằng năm từ ngày gốc; 29/02 rơi vào 28/02 ở năm không nhuận. */
    public static List<Occurrence> yearly(Moment m, LocalDate from, LocalDate to) {
        MonthDay md = MonthDay.from(m.getOccursOn());
        List<Occurrence> out = new ArrayList<>();
        for (int year = from.getYear(); year <= to.getYear(); year++) {
            LocalDate d = md.atYear(year);
            if (!d.isBefore(m.getOccursOn()) && within(d, from, to)) {
                out.add(new Occurrence(d, null, m.getTitle()));
            }
        }
        return out;
    }

    public static boolean within(LocalDate d, LocalDate from, LocalDate to) {
        return !d.isBefore(from) && !d.isAfter(to);
    }

    /** "hôm nay" / "ngày mai" / "còn 3 ngày nữa" / "còn 2 giờ nữa" / "còn 30 phút nữa". */
    public static String countdown(Duration offset) {
        if (offset.isZero()) {
            return "hôm nay";
        }
        if (offset.toSeconds() % 86_400 == 0) {
            return offset.toDays() == 1 ? "ngày mai" : "còn " + offset.toDays() + " ngày nữa";
        }
        if (offset.toMinutes() % 60 == 0) {
            return "còn " + offset.toHours() + " giờ nữa";
        }
        return "còn " + offset.toMinutes() + " phút nữa";
    }

    public static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
