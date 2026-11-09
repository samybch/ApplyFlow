package fr.applyflow.app;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name="ApplyFlowStore")
public class ApplyFlowStorePlugin extends Plugin {
    @PluginMethod public void read(PluginCall call) {
        synchronized(ReminderEngine.LOCK){try(SQLiteDatabase db=ReminderEngine.database(getContext());Cursor cur=db.rawQuery("SELECT payload,revision FROM app_state WHERE id=1",null)) {
            if(!cur.moveToFirst())throw new IllegalStateException("Base vide");
            call.resolve(new JSObject().put("payload",cur.getString(0)).put("revision",cur.getInt(1)));
        }catch(Exception e){call.reject("Lecture SQLite impossible",e);}}
    }
    @PluginMethod public void write(PluginCall call) {
        synchronized(ReminderEngine.LOCK){try(SQLiteDatabase db=ReminderEngine.database(getContext())) {
            String payload=call.getString("payload");Integer revision=call.getInt("revision");if(payload==null||revision==null)throw new IllegalArgumentException();
            new org.json.JSONObject(payload); // JS validates the full versioned schema before the bridge.
            android.content.ContentValues values=new android.content.ContentValues();values.put("payload",payload);values.put("revision",revision+1);
            boolean saved=db.update("app_state",values,"id=1 AND revision=?",new String[]{revision.toString()})==1;
            if(saved){ // Existing visible content may contain private or superseded information.
                getContext().getSystemService(android.app.NotificationManager.class).cancelAll();
                ReminderEngine.reconcile(getContext());
            }
            call.resolve(new JSObject().put("saved",saved));
        }catch(Exception e){call.reject("Écriture SQLite impossible",e);}}
    }
    @PluginMethod public void reconcile(PluginCall call){try{ReminderEngine.reconcile(getContext());call.resolve();}catch(Exception e){call.reject("Programmation des rappels impossible",e);}}
    @PluginMethod public void consumeNavigation(PluginCall call){android.content.SharedPreferences p=getContext().getSharedPreferences("applyflow_dispatch",0);JSObject out=new JSObject();String id=p.getString("navigation",null);if(id!=null){out.put("applicationId",id);out.put("custom",p.getBoolean("custom",false));p.edit().remove("navigation").remove("custom").commit();}call.resolve(out);}
    @PluginMethod public void openSettings(PluginCall call){Intent i=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName());getActivity().startActivity(i);call.resolve();}
}
