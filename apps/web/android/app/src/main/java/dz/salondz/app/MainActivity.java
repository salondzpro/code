package dz.salondz.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
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
    // Greffon propre à l'application (état réel des notifications, écran de réglages) : il doit être
    // enregistré AVANT le démarrage du pont, sinon la page ne le voit pas.
    registerPlugin(ReglagesNotificationsPlugin.class);
    super.onCreate(savedInstanceState);

    // De bord à bord : le fond de l'application occupe tout l'écran, et c'est le CSS qui écarte le
    // contenu des barres. Sans cela, on perdrait deux bandes grises en haut et en bas.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

    bloquerZoom();

    rootView = findViewById(android.R.id.content);
    ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, windowInsets) -> {
      // `systemBars` couvre la barre d'état et la barre de navigation (boutons comme gestes),
      // `displayCutout` l'encoche ou le poinçon de l'appareil. On garde le plus grand des deux.
      Insets bars = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
      );
      // CLAVIER. De bord à bord, Android ne réduit plus la fenêtre quand le clavier s'ouvre : il la
      // RECOUVRE, et la WebView fait défiler la page d'un coup pour dégager le champ touché — c'est
      // le saut constaté sur les écrans de connexion. On rend donc à la page exactement la place
      // au-dessus du clavier : la vue racine prend la hauteur du clavier en marge basse. Pendant ce
      // temps la barre de navigation est sous le clavier : la marge basse du CSS tombe à zéro, sans
      // quoi elle s'ajouterait à celle du clavier.
      int clavier = windowInsets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
      boolean clavierOuvert = clavier > 0;
      view.setPadding(0, 0, 0, clavierOuvert ? clavier : 0);
      float density = getResources().getDisplayMetrics().density;
      applyInsets(
        Math.round(bars.top / density),
        clavierOuvert ? 0 : Math.round(bars.bottom / density),
        Math.round(bars.left / density),
        Math.round(bars.right / density)
      );
      return windowInsets;
    });
  }

  /**
   * PAS DE ZOOM DANS L'APPLICATION (28 oct. 2026).
   *
   * Deux causes distinctes, toutes deux corrigées ici :
   *   - la TAILLE DE POLICE du système (Réglages → Affichage → Taille de police) : la WebView
   *     l'applique en zoomant TOUT le texte (`textZoom` = 115 %, 130 %…). Les écrans dessinés au
   *     pixel débordaient, l'application paraissait « zoomée ». On fixe 100 % : la mise en page est
   *     celle qu'on a dessinée, quelle que soit la réglette du téléphone ;
   *   - le PINCEMENT et le double toucher : la WebView sait zoomer d'elle-même. Une application n'est
   *     pas une page à agrandir — on coupe le zoom intégré et ses boutons.
   * La carte (Leaflet) garde son propre pincement : il est géré dans la page, pas par la WebView.
   */
  private void bloquerZoom() {
    if (getBridge() == null || getBridge().getWebView() == null) return;
    WebSettings reglages = getBridge().getWebView().getSettings();
    reglages.setTextZoom(100);
    reglages.setSupportZoom(false);
    reglages.setBuiltInZoomControls(false);
    reglages.setDisplayZoomControls(false);
  }

  /**
   * Les variables CSS vivent dans la page : un rechargement les efface, et les marges ne seraient
   * alors reposées qu'au prochain changement — l'application reprendrait sous les barres. On les
   * réapplique donc au retour au premier plan, et on redemande au système de les notifier.
   */
  @Override
  public void onResume() {
    super.onResume();
    // Le réglage de police peut avoir changé pendant que l'application était en arrière-plan.
    bloquerZoom();
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
