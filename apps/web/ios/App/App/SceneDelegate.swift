import UIKit
import Capacitor
import UserNotifications
import AuthenticationServices

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SalonBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/**
 * Pont Capacitor de l'application, avec nos greffons propres. Défini ICI, dans un fichier déjà
 * compilé par le projet, pour ne pas avoir à toucher au fichier de projet Xcode.
 */
class SalonBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ReglagesNotificationsPlugin())
        bridge?.registerPluginInstance(ConnexionWebPlugin())
        bloquerZoom()
        // L'application restait AGRANDIE (signalé le 28 oct. 2026) : iOS zoome sur un champ au
        // focus, et une fois l'échelle figée il n'y avait plus de geste pour revenir. On remet
        // donc l'échelle à 1 à chaque fermeture du clavier et à chaque retour au premier plan.
        let centre = NotificationCenter.default
        centre.addObserver(self, selector: #selector(remettreEchelle), name: UIResponder.keyboardDidHideNotification, object: nil)
        centre.addObserver(self, selector: #selector(remettreEchelle), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    @objc private func remettreEchelle() {
        guard let scroll = webView?.scrollView else { return }
        bloquerZoom()
        if scroll.zoomScale != 1 { scroll.setZoomScale(1, animated: true) }
    }

    /**
     * PAS DE ZOOM DANS L'APPLICATION (28 oct. 2026). Depuis iOS 10, la WebView ignore
     * `user-scalable=no` : le pincement agrandissait toute l'application, et elle restait parfois
     * agrandie après la saisie dans un champ. On fige l'échelle de la vue défilante à 1 et on coupe
     * son geste de pincement. La carte (Leaflet) garde le sien : il est géré par la page.
     */
    private func bloquerZoom() {
        guard let scroll = webView?.scrollView else { return }
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = 1
        scroll.bouncesZoom = false
        scroll.pinchGestureRecognizer?.isEnabled = false
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        bloquerZoom()
    }
}

/**
 * NOTIFICATIONS : l'état réel, et le chemin le plus court vers l'écran qui le change.
 *
 * iOS 16 et suivants savent ouvrir DIRECTEMENT l'écran « Notifications » de l'application
 * (`openNotificationSettingsURLString`) ; avant, on ouvre sa fiche dans Réglages, où la ligne
 * « Notifications » est la première. Une adresse lancée depuis la page ne sait faire ni l'un ni l'autre.
 */
@objc(ReglagesNotificationsPlugin)
public class ReglagesNotificationsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReglagesNotificationsPlugin"
    public let jsName = "ReglagesNotifications"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "etat", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ouvrir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ouvrirApplication", returnType: CAPPluginReturnPromise),
    ]

    /// `{ actives }` : vrai si l'application a le droit d'afficher une notification.
    @objc func etat(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { reglages in
            let actives: Bool
            switch reglages.authorizationStatus {
            case .authorized, .provisional, .ephemeral: actives = true
            default: actives = false
            }
            call.resolve(["actives": actives])
        }
    }

    @objc func ouvrir(_ call: CAPPluginCall) {
        if #available(iOS 16.0, *) {
            ouvrirAdresse(UIApplication.openNotificationSettingsURLString, call)
        } else {
            ouvrirAdresse(UIApplication.openSettingsURLString, call)
        }
    }

    @objc func ouvrirApplication(_ call: CAPPluginCall) {
        ouvrirAdresse(UIApplication.openSettingsURLString, call)
    }

    private func ouvrirAdresse(_ adresse: String, _ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: adresse) else {
                call.resolve(["ouvert": false])
                return
            }
            UIApplication.shared.open(url, options: [:]) { ouvert in
                call.resolve(["ouvert": ouvert])
            }
        }
    }
}

/**
 * CONNEXION GOOGLE / APPLE SUR IPHONE (24 nov. 2026).
 *
 * La page de Google s'ouvrait dans `SFSafariViewController` (`@capacitor/browser`) : depuis iOS 11 il
 * ne partage PAS les cookies de Safari, donc Google n'y montrait aucun des comptes déjà connectés ;
 * et le retour passait par `salondz://`, avec la question « Ouvrir dans Salon DZ ? ».
 * `ASWebAuthenticationSession` est la fenêtre de connexion prévue par Apple : elle partage la session
 * de Safari (les comptes Google déjà ouverts apparaissent) et rend la main à l'application dès que la
 * page navigue vers le schéma de l'application, sans question ni passage par le système.
 *
 * `ouvrir({ url })` → `{ url }` : l'adresse de retour (`salondz://reprise?d=…` ou `salondzpro://…`).
 * Le schéma attendu est lu dans l'Info.plist : Salon DZ et Salon DZ Pro ont chacun le leur.
 * Annulation par la personne → rejet `annule`.
 */
public class ConnexionWebPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "ConnexionWebPlugin"
    public let jsName = "ConnexionWeb"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ouvrir", returnType: CAPPluginReturnPromise),
    ]
    private var session: ASWebAuthenticationSession?

    private func schema() -> String {
        let types = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]]
        let schemas = types?.first?["CFBundleURLSchemes"] as? [String]
        return schemas?.first ?? "salondz"
    }

    @objc func ouvrir(_ call: CAPPluginCall) {
        guard let texte = call.getString("url"), let adresse = URL(string: texte) else {
            call.reject("adresse")
            return
        }
        DispatchQueue.main.async {
            let s = ASWebAuthenticationSession(url: adresse, callbackURLScheme: self.schema()) { retour, erreur in
                self.session = nil
                if let retour = retour {
                    call.resolve(["url": retour.absoluteString])
                } else if let e = erreur as? ASWebAuthenticationSessionError, e.code == .canceledLogin {
                    call.reject("annule")
                } else {
                    call.reject(erreur?.localizedDescription ?? "echec")
                }
            }
            s.presentationContextProvider = self
            // Session de Safari partagée : les comptes Google déjà connectés sont proposés.
            s.prefersEphemeralWebBrowserSession = false
            self.session = s
            if !s.start() {
                self.session = nil
                call.reject("echec")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return self.bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
