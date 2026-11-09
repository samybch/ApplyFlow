package fr.applyflow.app;

import java.time.*;

/** Pure calendar policy shared by the receiver and JVM tests. */
public final class ReminderClock {
  private ReminderClock() {}

  public static Instant next(
      String due, String time, boolean repeat, String last, Instant now, ZoneId zone) {
    if (!repeat && last != null && !last.isEmpty()) return null;
    LocalDate today = now.atZone(zone).toLocalDate();
    LocalDate date = LocalDate.parse(due);
    if (date.isBefore(today)) date = today;
    if (date.toString().equals(last)) {
      if (!repeat) return null;
      date = date.plusDays(1);
    }
    // atZone moves a nonexistent spring-forward wall time to the first valid offset.
    // The last date guard prevents two deliveries during the repeated autumn hour.
    Instant result = LocalDateTime.of(date, LocalTime.parse(time)).atZone(zone).toInstant();
    return result.isAfter(now) ? result : now.plusSeconds(5);
  }

  public static boolean due(
      String due, String time, boolean repeat, String last, Instant now, ZoneId zone) {
    if (!repeat && last != null && !last.isEmpty()) return false;
    LocalDate today = now.atZone(zone).toLocalDate();
    if (today.toString().equals(last) || LocalDate.parse(due).isAfter(today)) return false;
    return !LocalDateTime.of(today, LocalTime.parse(time)).atZone(zone).toInstant().isAfter(now);
  }
}
