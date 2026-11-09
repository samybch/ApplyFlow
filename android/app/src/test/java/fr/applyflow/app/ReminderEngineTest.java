package fr.applyflow.app;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.app.*;
import android.content.*;
import android.database.sqlite.SQLiteDatabase;
import androidx.test.core.app.ApplicationProvider;
import com.capacitorjs.plugins.localnotifications.LocalNotificationManager;
import java.time.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlarmManager;

/** Simulated Android framework tests, NOT evidence of delivery to a phone. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class ReminderEngineTest {
  private Context c;
  private JSONObject state, r, a;

  @Before
  public void seed() throws Exception {
    c = ApplicationProvider.getApplicationContext();
    c.deleteDatabase("applyflowSQLite.db");
    c.getSharedPreferences("applyflow_dispatch", 0).edit().clear().commit();
    c.getSystemService(NotificationManager.class)
        .createNotificationChannel(
            new NotificationChannel(
                "reminders", "Relances", NotificationManager.IMPORTANCE_DEFAULT));
    shadowOf(c.getSystemService(NotificationManager.class)).setNotificationsEnabled(true);
    ShadowAlarmManager.setCanScheduleExactAlarms(false);
    a =
        new JSONObject()
            .put("id", "app")
            .put("status", "Envoyée")
            .put("submittedDate", "2026-01-01")
            .put("opportunityId", "offer");
    r =
        new JSONObject()
            .put("id", "reminder")
            .put("applicationId", "app")
            .put("notificationId", 9)
            .put("dueDate", "2020-01-01")
            .put("time", "00:00")
            .put("repeatDaily", true)
            .put("state", "active")
            .put("revision", 0)
            .put("lastNotifiedDate", JSONObject.NULL);
    state =
        new JSONObject()
            .put("settings", new JSONObject().put("notifications", true).put("privacy", false))
            .put("applications", new JSONArray().put(a))
            .put(
                "opportunities",
                new JSONArray()
                    .put(
                        new JSONObject()
                            .put("id", "offer")
                            .put("company", "KPMG")
                            .put("title", "Pricing Senior Analyst")))
            .put("reminders", new JSONArray().put(r));
    try (SQLiteDatabase db = c.openOrCreateDatabase("applyflowSQLite.db", 0, null)) {
      db.execSQL("CREATE TABLE app_state(id INTEGER PRIMARY KEY,payload TEXT,revision INTEGER)");
      db.execSQL("INSERT INTO app_state VALUES(1,?,0)", new Object[] {state.toString()});
    }
  }

  private void persist() {
    try (SQLiteDatabase db = ReminderEngine.database(c)) {
      ReminderEngine.save(db, state);
    }
  }

  private JSONObject read() throws Exception {
    try (SQLiteDatabase db = ReminderEngine.database(c)) {
      return ReminderEngine.load(db);
    }
  }

  private int alarms() {
    return shadowOf(c.getSystemService(AlarmManager.class)).getScheduledAlarms().size();
  }

  @Test
  public void reconciliationKeepsExactlyOneAlarmIncludingAfterSimulatedRestart() throws Exception {
    ReminderEngine.reconcile(c);
    ReminderEngine.reconcile(c);
    assertEquals(1, alarms());
    c.getSystemService(AlarmManager.class)
        .cancel(
            shadowOf(c.getSystemService(AlarmManager.class)).peekNextScheduledAlarm().operation);
    assertEquals(0, alarms());
    ReminderEngine.reconcile(c);
    assertEquals(1, alarms());
  }

  @Test
  public void deniedPermissionLeavesNoAlarmAndNoNotification() throws Exception {
    shadowOf(c.getSystemService(NotificationManager.class)).setNotificationsEnabled(false);
    ReminderEngine.reconcile(c);
    ReminderEngine.dispatch(c);
    assertEquals(0, alarms());
    assertEquals(0, shadowOf(c.getSystemService(NotificationManager.class)).size());
    assertTrue(read().getJSONArray("reminders").getJSONObject(0).isNull("lastNotifiedDate"));
  }

  @Test
  public void dispatchWithoutWebViewPublishesOnceAndRearmsTomorrow() throws Exception {
    ReminderEngine.dispatch(c);
    JSONObject first = read();
    assertEquals(
        LocalDate.now().toString(),
        first.getJSONArray("reminders").getJSONObject(0).getString("lastNotifiedDate"));
    assertEquals(1, alarms());
    assertEquals(1, shadowOf(c.getSystemService(NotificationManager.class)).size());
    assertTrue(
        shadowOf(c.getSystemService(NotificationManager.class))
            .getNotification(9)
            .extras
            .getString(Notification.EXTRA_TEXT)
            .contains("KPMG"));
    ReminderEngine.dispatch(c);
    assertEquals(first.toString(), read().toString());
  }

  @Test
  public void privacyIsAppliedAtDispatch() throws Exception {
    state.getJSONObject("settings").put("privacy", true);
    persist();
    ReminderEngine.dispatch(c);
    String body =
        shadowOf(c.getSystemService(NotificationManager.class))
            .getNotification(9)
            .extras
            .getString(Notification.EXTRA_TEXT);
    assertFalse(body.contains("KPMG"));
    assertFalse(body.contains("Pricing"));
  }

  @Test
  public void closureCancelsAlarmAndVisibleNotification() throws Exception {
    ReminderEngine.dispatch(c);
    a.put("status", "Refusée");
    persist();
    ReminderEngine.reconcile(c);
    assertEquals(0, alarms());
    assertEquals(0, shadowOf(c.getSystemService(NotificationManager.class)).size());
  }

  @Test
  public void completedAndCancelledRemindersDoNotDispatch() throws Exception {
    for (String mode : new String[] {"done", "cancelled"}) {
      r.put("state", mode);
      persist();
      ReminderEngine.dispatch(c);
      assertEquals(0, alarms());
      assertEquals(0, shadowOf(c.getSystemService(NotificationManager.class)).size());
    }
  }

  @Test
  public void exactPermissionIsOptional() throws Exception {
    ReminderEngine.reconcile(c);
    assertEquals(1, alarms());
    ShadowAlarmManager.setCanScheduleExactAlarms(true);
    ReminderEngine.reconcile(c);
    assertEquals(1, alarms());
  }

  private Intent action(String action, int revision) throws Exception {
    return new Intent()
        .putExtra(LocalNotificationManager.ACTION_INTENT_KEY, action)
        .putExtra(
            LocalNotificationManager.NOTIFICATION_OBJ_INTENT_KEY,
            new JSONObject()
                .put(
                    "extra",
                    new JSONObject()
                        .put("applicationId", "app")
                        .put("reminderId", "reminder")
                        .put("revision", revision))
                .toString());
  }

  @Test
  public void nativeDoneActionPersistsAndRoutesToCorrectApplication() throws Exception {
    ReminderEngine.reconcile(c);
    ReminderEngine.handleIntent(c, action("done", 0));
    assertEquals("done", read().getJSONArray("reminders").getJSONObject(0).getString("state"));
    assertEquals(0, alarms());
    assertEquals(
        "app", c.getSharedPreferences("applyflow_dispatch", 0).getString("navigation", null));
  }

  @Test
  public void staleActionDoesNotCompleteRescheduledReminder() throws Exception {
    r.put("revision", 1);
    persist();
    ReminderEngine.handleIntent(c, action("done", 0));
    assertEquals("active", read().getJSONArray("reminders").getJSONObject(0).getString("state"));
  }

  @Test
  public void nativeTomorrowActionAndCustomRouteKeepReminderIdentity() throws Exception {
    ReminderEngine.handleIntent(c, action("tomorrow", 0));
    JSONObject updated = read().getJSONArray("reminders").getJSONObject(0);
    assertEquals(LocalDate.now().plusDays(1).toString(), updated.getString("dueDate"));
    assertEquals(9, updated.getInt("notificationId"));
    ReminderEngine.handleIntent(c, action("custom", 1));
    assertTrue(c.getSharedPreferences("applyflow_dispatch", 0).getBoolean("custom", false));
    assertEquals(
        "reminder", c.getSharedPreferences("applyflow_dispatch", 0).getString("reminderId", null));
  }
}
