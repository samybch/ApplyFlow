package fr.applyflow.app;

import android.content.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ReminderReceiver extends BroadcastReceiver {
  private static final ExecutorService executor = Executors.newSingleThreadExecutor();

  @Override
  public void onReceive(Context context, Intent intent) {
    PendingResult pending = goAsync();
    executor.execute(
        () -> {
          try {
            if ("fr.applyflow.DISPATCH".equals(intent.getAction()))
              ReminderEngine.dispatch(context);
            else ReminderEngine.reconcile(context);
          } catch (Exception e) {
            android.util.Log.e("ApplyFlow", "Reminder reconciliation failed", e);
          } finally {
            pending.finish();
          }
        });
  }
}
