package fr.applyflow.app;

import static org.junit.Assert.*;

import java.time.*;
import org.junit.Test;

public class ReminderClockTest {
  private final ZoneId paris = ZoneId.of("Europe/Paris");

  @Test
  public void firstAt18Local() {
    assertEquals(
        Instant.parse("2026-02-10T17:00:00Z"),
        ReminderClock.next(
            "2026-02-10", "18:00", true, null, Instant.parse("2026-02-10T10:00:00Z"), paris));
  }

  @Test
  public void repeatsTomorrow() {
    assertEquals(
        Instant.parse("2026-02-11T17:00:00Z"),
        ReminderClock.next(
            "2026-02-10",
            "18:00",
            true,
            "2026-02-10",
            Instant.parse("2026-02-10T17:01:00Z"),
            paris));
  }

  @Test
  public void noRepeatForOneShot() {
    assertNull(
        ReminderClock.next("2026-02-10", "18:00", false, "2026-02-10", Instant.now(), paris));
  }

  @Test
  public void noReplayBacklog() {
    Instant now = Instant.parse("2026-02-10T20:00:00Z");
    assertEquals(
        now.plusSeconds(5), ReminderClock.next("2025-01-01", "18:00", true, null, now, paris));
  }

  @Test
  public void respectsCustomTime() {
    assertEquals(
        Instant.parse("2026-02-10T08:15:00Z"),
        ReminderClock.next(
            "2026-02-10", "09:15", true, null, Instant.parse("2026-02-10T07:00:00Z"), paris));
  }

  @Test
  public void postponementStartsAtNewDue() {
    assertEquals(
        Instant.parse("2026-03-01T17:00:00Z"),
        ReminderClock.next(
            "2026-03-01", "18:00", true, null, Instant.parse("2026-02-10T20:00:00Z"), paris));
  }

  @Test
  public void daylightSavingRetainsWallTime() {
    Instant before = Instant.parse("2026-03-28T18:00:00Z");
    assertEquals(
        Instant.parse("2026-03-29T16:00:00Z"),
        ReminderClock.next("2026-03-28", "18:00", true, "2026-03-28", before, paris));
  }

  @Test
  public void timezoneChange() {
    assertEquals(
        Instant.parse("2026-02-11T00:00:00Z"),
        ReminderClock.next(
            "2026-02-10",
            "18:00",
            true,
            null,
            Instant.parse("2026-02-10T20:00:00Z"),
            ZoneId.of("America/Chicago")));
  }

  @Test
  public void noDoubleDeliveryDuringFallBack() {
    assertFalse(
        ReminderClock.due(
            "2026-10-25",
            "02:30",
            true,
            "2026-10-25",
            Instant.parse("2026-10-25T01:35:00Z"),
            paris));
  }

  @Test
  public void dueCheckAndFutureBoundary() {
    assertTrue(
        ReminderClock.due(
            "2026-02-10", "18:00", true, null, Instant.parse("2026-02-10T17:00:00Z"), paris));
    assertFalse(
        ReminderClock.due(
            "2026-02-11", "18:00", true, null, Instant.parse("2026-02-10T19:00:00Z"), paris));
  }
}
