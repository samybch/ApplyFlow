package fr.applyflow.app;

import android.app.*;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.capacitorjs.plugins.localnotifications.*;
import com.getcapacitor.CapConfig;
import com.getcapacitor.JSObject;
import java.time.*;
import java.util.*;
import org.json.*;

/** One device-local dispatcher, independent of WebView and JS. All access is serialized. */
public final class ReminderEngine {
  static final Object LOCK = new Object();
  private static final int DISPATCH_ID = 701142;
  private static final String PREFS = "applyflow_dispatch";

  private ReminderEngine() {}

  static SQLiteDatabase database(Context c) {
    SQLiteDatabase db =
        SQLiteDatabase.openDatabase(
            c.getDatabasePath("applyflowSQLite.db").getPath(), null, SQLiteDatabase.OPEN_READWRITE);
    try (Cursor timeout = db.rawQuery("PRAGMA busy_timeout=5000", null)) {
      timeout.moveToFirst();
    }
    return db;
  }

  static JSONObject load(SQLiteDatabase db) throws JSONException {
    try (Cursor cur = db.rawQuery("SELECT payload FROM app_state WHERE id=1", null)) {
      if (!cur.moveToFirst()) throw new JSONException("No state");
      return new JSONObject(cur.getString(0));
    }
  }

  static void save(SQLiteDatabase db, JSONObject state) {
    db.execSQL(
        "UPDATE app_state SET payload=?, revision=revision+1 WHERE id=1",
        new Object[] {state.toString()});
  }

  private static PendingIntent dispatcher(Context c) {
    Intent i = new Intent(c, ReminderReceiver.class).setAction("fr.applyflow.DISPATCH");
    return PendingIntent.getBroadcast(
        c, DISPATCH_ID, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  static boolean active(JSONObject state, JSONObject r) throws JSONException {
    if (!state.getJSONObject("settings").getBoolean("notifications")
        || !"active".equals(r.getString("state"))) return false;
    JSONObject a = find(state.getJSONArray("applications"), r.getString("applicationId"));
    return a != null
        && !Arrays.asList("Refusée", "Acceptée", "Retirée").contains(a.getString("status"))
        && !a.isNull("submittedDate");
  }

  static JSONObject find(JSONArray rows, String id) throws JSONException {
    for (int j = 0; j < rows.length(); j++)
      if (rows.getJSONObject(j).getString("id").equals(id)) return rows.getJSONObject(j);
    return null;
  }

  private static boolean allowed(Context c) {
    NotificationManager nm = c.getSystemService(NotificationManager.class);
    NotificationChannel channel = nm.getNotificationChannel("reminders");
    return NotificationManagerCompat.from(c).areNotificationsEnabled()
        && (channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE);
  }

  static void reconcile(Context c) throws Exception {
    synchronized (LOCK) {
      AlarmManager alarm = c.getSystemService(AlarmManager.class);
      alarm.cancel(dispatcher(c));
      if (!c.getDatabasePath("applyflowSQLite.db").exists()) return;
      try (SQLiteDatabase db = database(c)) {
        schedule(c, load(db));
      }
    }
  }

  private static void schedule(Context c, JSONObject state) throws Exception {
    AlarmManager alarm = c.getSystemService(AlarmManager.class);
    Instant now = Instant.now(), earliest = null;
    Set<String> ids = new HashSet<>();
    JSONArray rs = state.getJSONArray("reminders");
    boolean permission = allowed(c);
    for (int i = 0; i < rs.length(); i++) {
      JSONObject r = rs.getJSONObject(i);
      if (!active(state, r) || !permission) {
        c.getSystemService(NotificationManager.class).cancel(r.getInt("notificationId"));
        continue;
      }
      ids.add(Integer.toString(r.getInt("notificationId")));
      Instant at =
          ReminderClock.next(
              r.getString("dueDate"),
              r.getString("time"),
              r.getBoolean("repeatDaily"),
              r.optString("lastNotifiedDate", null),
              now,
              ZoneId.systemDefault());
      if (at != null && (earliest == null || at.isBefore(earliest))) earliest = at;
    }
    Set<String> old = c.getSharedPreferences(PREFS, 0).getStringSet("ids", Collections.emptySet());
    for (String id : old)
      if (!ids.contains(id))
        c.getSystemService(NotificationManager.class).cancel(Integer.parseInt(id));
    c.getSharedPreferences(PREFS, 0).edit().putStringSet("ids", ids).apply();
    alarm.cancel(dispatcher(c));
    if (earliest != null) {
      long at = earliest.toEpochMilli();
      // Approximate delivery is the default; use exact access only when already granted.
      if (Build.VERSION.SDK_INT < 31 || alarm.canScheduleExactAlarms()) {
        try {
          alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, dispatcher(c));
        } catch (SecurityException e) {
          alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, dispatcher(c));
        }
      } else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, dispatcher(c));
    }
  }

  static void dispatch(Context c) throws Exception {
    synchronized (LOCK) {
      if (!c.getDatabasePath("applyflowSQLite.db").exists()) return;
      try (SQLiteDatabase db = database(c)) {
        db.beginTransaction();
        JSONObject state;
        ArrayList<JSONObject> due = new ArrayList<>();
        Instant now = Instant.now();
        try {
          state = load(db);
          if (allowed(c))
            for (int i = 0; i < state.getJSONArray("reminders").length(); i++) {
              JSONObject r = state.getJSONArray("reminders").getJSONObject(i);
              if (active(state, r)
                  && ReminderClock.due(
                      r.getString("dueDate"),
                      r.getString("time"),
                      r.getBoolean("repeatDaily"),
                      r.optString("lastNotifiedDate", null),
                      now,
                      ZoneId.systemDefault())) {
                r.put(
                    "lastNotifiedDate",
                    now.atZone(ZoneId.systemDefault()).toLocalDate().toString());
                due.add(r);
              }
            }
          if (!due.isEmpty()) save(db, state);
          db.setTransactionSuccessful();
        } finally {
          db.endTransaction();
        }
        // Marking the delivery before posting guarantees no replay flood after a crash.
        for (JSONObject r : due) publish(c, state, r);
        schedule(c, state);
      }
    }
  }

  private static void publish(Context c, JSONObject state, JSONObject r) throws Exception {
    JSONObject a = find(state.getJSONArray("applications"), r.getString("applicationId"));
    JSONObject o = find(state.getJSONArray("opportunities"), a.getString("opportunityId"));
    boolean privacy = state.getJSONObject("settings").getBoolean("privacy");
    JSObject payload = new JSObject();
    payload.put("id", r.getInt("notificationId"));
    payload.put("title", "ApplyFlow — Relance à effectuer");
    payload.put(
        "body",
        privacy
            ? "Une action vous attend dans ApplyFlow."
            : "Pense à relancer ta candidature chez "
                + o.getString("company")
                + " pour le poste de "
                + o.getString("title")
                + ".");
    payload.put("smallIcon", "ic_stat_applyflow");
    payload.put("channelId", "reminders");
    payload.put("actionTypeId", "followup");
    payload.put(
        "extra",
        new JSONObject()
            .put("applicationId", a.getString("id"))
            .put("reminderId", r.getString("id"))
            .put("revision", r.getInt("revision")));
    // The official Local Notifications renderer supplies content, lock-screen visibility,
    // launch intents and registered actions; our dispatcher supplies calendar recurrence.
    LocalNotificationManager manager =
        new LocalNotificationManager(new NotificationStorage(c), null, c, CapConfig.loadDefault(c));
    manager.createNotificationChannel();
    manager.schedule(
        null,
        Collections.singletonList(
            LocalNotification.Companion.buildNotificationFromJSObject(payload)));
  }

  static void handleIntent(Context c, Intent intent) {
    if (intent == null) return;
    String raw = intent.getStringExtra(LocalNotificationManager.NOTIFICATION_OBJ_INTENT_KEY);
    String action = intent.getStringExtra(LocalNotificationManager.ACTION_INTENT_KEY);
    if (raw == null) return;
    synchronized (LOCK) {
      try (SQLiteDatabase db = database(c)) {
        JSONObject extra = new JSONObject(raw).optJSONObject("extra");
        if (extra == null) return;
        String appId = extra.getString("applicationId");
        c.getSharedPreferences(PREFS, 0)
            .edit()
            .putString("navigation", appId)
            .putString("reminderId", extra.getString("reminderId"))
            .putBoolean("custom", "custom".equals(action))
            .commit();
        if ("done".equals(action) || "tomorrow".equals(action)) {
          db.beginTransaction();
          try {
            JSONObject state = load(db),
                r = find(state.getJSONArray("reminders"), extra.getString("reminderId"));
            if (r != null && active(state, r) && r.getInt("revision") == extra.getInt("revision")) {
              if ("done".equals(action)) {
                r.put("state", "done");
                r.put("completedAt", Instant.now().toString());
              } else {
                String date = LocalDate.now().plusDays(1).toString();
                boolean duplicate = false;
                JSONArray rr = state.getJSONArray("reminders");
                for (int i = 0; i < rr.length(); i++) {
                  JSONObject other = rr.getJSONObject(i);
                  if (!other.getString("id").equals(r.getString("id"))
                      && "active".equals(other.getString("state"))
                      && other.getString("applicationId").equals(appId)
                      && other.getString("dueDate").equals(date)
                      && other.getString("time").equals(r.getString("time"))) duplicate = true;
                }
                if (duplicate) throw new IllegalStateException("Une relance existe déjà demain");
                r.put("dueDate", date);
                r.put("lastNotifiedDate", JSONObject.NULL);
              }
              r.put("revision", r.getInt("revision") + 1);
              save(db, state);
              c.getSystemService(NotificationManager.class).cancel(r.getInt("notificationId"));
            }
            db.setTransactionSuccessful();
          } finally {
            db.endTransaction();
          }
        }
        reconcile(c);
      } catch (Exception e) {
        android.util.Log.e("ApplyFlow", "Notification action could not be applied", e);
      }
    }
    // Consume native action once; Capacitor still receives its own notification event.
    intent.removeExtra(LocalNotificationManager.ACTION_INTENT_KEY);
  }
}
