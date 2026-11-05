package dz.salondz.app;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * STORY : ouvre Instagram directement, sans passer par la feuille de partage du téléphone.
 *
 * Avec un identifiant d'application Meta, l'image arrive sur l'écran de story d'Instagram
 * (`ADD_TO_STORY`). Sans lui, Instagram refuse cet écran depuis janvier 2023 : on lui envoie alors
 * l'image par `ACTION_SEND`, et c'est Instagram qui propose story, publication ou message.
 *
 * `{ ouvert: false }` veut dire qu'Instagram n'est pas installé : la page retombe sur la feuille.
 */
@CapacitorPlugin(name = "PartageDirect")
public class PartageDirectPlugin extends Plugin {

  private static final String INSTAGRAM = "com.instagram.android";

  /** `chemin` : adresse du fichier écrit par Filesystem. `identifiantMeta` : facultatif. */
  @PluginMethod
  public void instagram(PluginCall call) {
    Context ctx = getContext();
    String chemin = call.getString("chemin");
    if (chemin == null) {
      call.reject("Fichier manquant");
      return;
    }
    Uri image;
    try {
      File fichier = new File(Uri.parse(chemin).getPath());
      image = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", fichier);
    } catch (IllegalArgumentException e) {
      call.reject("Fichier inaccessible");
      return;
    }

    String identifiant = call.getString("identifiantMeta");
    Intent intent;
    if (identifiant != null && !identifiant.isEmpty()) {
      intent = new Intent("com.instagram.share.ADD_TO_STORY");
      intent.setDataAndType(image, "image/png");
      intent.putExtra("source_application", identifiant);
    } else {
      intent = new Intent(Intent.ACTION_SEND);
      intent.setType("image/png");
      intent.putExtra(Intent.EXTRA_STREAM, image);
    }
    intent.setPackage(INSTAGRAM);
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
    ctx.grantUriPermission(INSTAGRAM, image, Intent.FLAG_GRANT_READ_URI_PERMISSION);

    JSObject ret = new JSObject();
    try {
      ctx.startActivity(intent);
      ret.put("ouvert", true);
    } catch (ActivityNotFoundException | SecurityException e) {
      ret.put("ouvert", false);
    }
    call.resolve(ret);
  }
}
