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

  /** Dernières marges connues, en pixels d'interface : elles servent à les REPOSER après un rechargement. */
  private int lastTop = 0, lastBottom = 0, lastLeft = 0, lastRight = 0;
  private View rootView;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // De bord à bord : le fond de l'application occupe tout l'écran, et c'est le CSS qui écarte le
    // contenu des barres. Sans cela, on perdrait deux bandes grises en haut et en bas.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

    rootView = findViewById(android.R.id.content);
    ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, windowInsets) -> {
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

  /**
   * Les variables CSS vivent dans la page : un rechargement les efface, et les marges ne seraient
   * alors reposées qu'au prochain changement — l'application reprendrait sous les barres. On les
   * réapplique donc au retour au premier plan, et on redemande au système de les notifier.
   */
  @Override
  public void onResume() {
    super.onResume();
    applyInsets(lastTop, lastBottom, lastLeft, lastRight);
    if (rootView != null) ViewCompat.requestApplyInsets(rootView);
  }

  /** Écrit les marges dans les variables CSS lues par la feuille de style. */
  private void applyInsets(int top, int bottom, int left, int right) {
    lastTop = top;
    lastBottom = bottom;
    lastLeft = left;
    lastRight = right;
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
