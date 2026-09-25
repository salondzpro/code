package dz.salondz.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Marges système réelles transmises au CSS.
 *
 * Le problème : depuis Android 15, une application dessine de bord à bord et la barre d'état comme la
 * barre de navigation RECOUVRENT la page. Les réglages de thème ne suffisent plus, et `env(safe-area-inset-*)`
 * de la WebView ne rend pas toujours la barre de navigation — selon le constructeur, la version d'Android
 * et le mode de navigation (trois boutons ou gestes).
 *
 * La seule source fiable est le système lui-même : on lit les marges à chaque changement (rotation,
 * passage boutons/gestes, clavier) et on les écrit dans quatre variables CSS, en pixels d'interface.
 * La feuille de style s'en sert partout où un élément touche un bord. Rien n'est figé pour un modèle
 * de téléphone : c'est mesuré sur l'appareil, quel qu'il soit.
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // De bord à bord : le fond de l'application occupe tout l'écran, et c'est le CSS qui écarte le
    // contenu des barres. Sans cela, on perdrait deux bandes grises en haut et en bas.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

    final View root = findViewById(android.R.id.content);
    ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
      // `systemBars` couvre la barre d'état et la barre de navigation (boutons comme gestes),
      // `displayCutout` l'encoche ou le poinçon de l'appareil. On garde le plus grand des deux.
      Insets bars = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
      );
      float density = getResources().getDisplayMetrics().density;
      applyInsets(
        Math.round(bars.top / density),
        Math.round(bars.bottom / density),
        Math.round(bars.left / density),
        Math.round(bars.right / density)
      );
      return windowInsets;
    });
  }

  /** Écrit les marges dans les variables CSS lues par la feuille de style. */
  private void applyInsets(int top, int bottom, int left, int right) {
    final String js =
      "(function(){var s=document.documentElement.style;" +
      "s.setProperty('--sat','" + top + "px');" +
      "s.setProperty('--sab','" + bottom + "px');" +
      "s.setProperty('--sal','" + left + "px');" +
      "s.setProperty('--sar','" + right + "px');})()";
    runOnUiThread(() -> {
      if (getBridge() != null && getBridge().getWebView() != null) {
        getBridge().getWebView().evaluateJavascript(js, null);
      }
    });
  }
}
