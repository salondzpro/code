package dz.salondz.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/**
 * NOTIFICATIONS : l'état RÉEL du téléphone, et le chemin le plus court vers l'écran qui le change.
 *
 * Pourquoi un greffon à nous, et pas une adresse lancée depuis la page :
 *   - Capacitor ouvre toute adresse externe avec une simple intention « voir ». Une adresse
 *     `intent:#Intent;action=…` n'est comprise par AUCUNE application : le bouton « Ouvrir les
 *     réglages » ne faisait rien du tout. Seul le code natif peut lancer l'écran des réglages.
 *   - Le greffon de notifications de Capacitor répond « accordé » sur tout Android antérieur à 13,
 *     même quand la personne a coupé les notifications de l'application : l'écran croyait tout en
 *     ordre et ne proposait jamais de les rallumer. La seule source fiable est l'interrupteur du
 *     système, `areNotificationsEnabled()`, plus les canaux : tous coupés, rien n'arrive non plus.
 *
 * L'identifiant du paquet est lu sur l'application elle-même : la variante professionnelle
 * (`pro.salondz.app`) ouvre SA fiche, sans rien à configurer.
 */
@CapacitorPlugin(name = "ReglagesNotifications")
public class ReglagesNotificationsPlugin extends Plugin {

  /** `{ actives }` : vrai seulement si une notification envoyée maintenant s'afficherait. */
  @PluginMethod
  public void etat(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("actives", notificationsActives(getContext()));
    call.resolve(ret);
  }

  /** Écran « Notifications » de CETTE application ; à défaut sa fiche ; à défaut les réglages. */
  @PluginMethod
  public void ouvrir(PluginCall call) {
    Context ctx = getContext();
    String paquet = ctx.getPackageName();
    Intent notifications;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notifications = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
      notifications.putExtra(Settings.EXTRA_APP_PACKAGE, paquet);
    } else {
      // Android 7 : même écran, mais il lit le paquet et l'uid sous ces deux noms-là.
      notifications = new Intent("android.settings.APP_NOTIFICATION_SETTINGS");
      notifications.putExtra("app_package", paquet);
      notifications.putExtra("app_uid", ctx.getApplicationInfo().uid);
    }
    resoudre(call, lancer(notifications) || lancer(fiche(paquet)) || lancer(new Intent(Settings.ACTION_SETTINGS)));
  }

  /** Fiche de l'application (autorisations comprises, dont la position). */
  @PluginMethod
  public void ouvrirApplication(PluginCall call) {
    resoudre(call, lancer(fiche(getContext().getPackageName())) || lancer(new Intent(Settings.ACTION_SETTINGS)));
  }

  private static Intent fiche(String paquet) {
    return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + paquet));
  }

  private boolean lancer(Intent intent) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try {
      getContext().startActivity(intent);
      return true;
    } catch (ActivityNotFoundException | SecurityException e) {
      // Certains constructeurs retirent ou protègent l'écran visé : on passe au suivant.
      return false;
    }
  }

  private static void resoudre(PluginCall call, boolean ouvert) {
    JSObject ret = new JSObject();
    ret.put("ouvert", ouvert);
    call.resolve(ret);
  }

  static boolean notificationsActives(Context ctx) {
    if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return false;
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
    NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return true;
    List<NotificationChannel> canaux = nm.getNotificationChannels();
    // Aucun canal encore créé : Firebase créera le sien à la première notification, ouvert.
    if (canaux == null || canaux.isEmpty()) return true;
    for (NotificationChannel canal : canaux) {
      if (canal.getImportance() != NotificationManager.IMPORTANCE_NONE) return true;
    }
    return false;
  }
}
