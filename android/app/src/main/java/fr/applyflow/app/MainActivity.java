package fr.applyflow.app;
import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state){registerPlugin(ApplyFlowStorePlugin.class);ReminderEngine.handleIntent(this,getIntent());super.onCreate(state);}
    @Override protected void onNewIntent(Intent intent){ReminderEngine.handleIntent(this,intent);super.onNewIntent(intent);setIntent(intent);}
}
