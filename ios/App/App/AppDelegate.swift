import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        registerNotificationActions()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    /// Knapper i varsler. Serveren setter kategorien (se supabase/functions/_shared/apns.ts),
    /// og appen gjør selve handlingen (src/hooks/useNativePushNavigation.ts).
    private func registerNotificationActions() {
        let reply = UNTextInputNotificationAction(
            identifier: "reply",
            title: "Svar",
            options: [.foreground],
            textInputButtonTitle: "Send",
            textInputPlaceholder: "Skriv et svar"
        )
        let chat = UNNotificationCategory(identifier: "CHAT_MESSAGE", actions: [reply], intentIdentifiers: [], options: [])
        let fixed = UNNotificationAction(identifier: "fix_done", title: "Merk som fikset", options: [.foreground])
        let fix = UNNotificationCategory(identifier: "FIX_TASK", actions: [fixed], intentIdentifiers: [], options: [])
        UNUserNotificationCenter.current().setNotificationCategories([chat, fix])
    }

    // Forward APNs device token to Capacitor (required for @capacitor/push-notifications)
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

}

/// iOS krever nå scener (UIScene) for apper bygget med nyeste Xcode. Uten dette
/// stopper iOS appen med en gang den åpnes. Vinduet lages fra Main.storyboard
/// (satt i Info.plist), og lenker sendes videre til Capacitor som før.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }
        // Noen tillegg ser etter vinduet på AppDelegate.
        (UIApplication.shared.delegate as? AppDelegate)?.window = window

        // Appen ble åpnet fra en lenke (f.eks. Skann-widgeten) mens den var lukket.
        if let url = connectionOptions.urlContexts.first?.url {
            DispatchQueue.main.async {
                _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
            }
        }
        // Appen ble åpnet fra et hurtigvalg på app-ikonet.
        if let shortcut = connectionOptions.shortcutItem, let url = SceneDelegate.url(for: shortcut) {
            DispatchQueue.main.async {
                _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
            }
        }
        if let activity = connectionOptions.userActivities.first {
            DispatchQueue.main.async {
                _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
            }
        }
    }

    /// Hurtigvalg når man holder inne app-ikonet (UIApplicationShortcutItems i Info.plist).
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        guard let url = SceneDelegate.url(for: shortcutItem) else {
            completionHandler(false)
            return
        }
        completionHandler(ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:]))
    }

    static func url(for shortcut: UIApplicationShortcutItem) -> URL? {
        switch shortcut.type {
        case "com.oksnoen.ledere.skann": return URL(string: "oksnoen://skann")
        case "com.oksnoen.ledere.fix": return URL(string: "oksnoen://fix")
        case "com.oksnoen.ledere.chat": return URL(string: "oksnoen://chat")
        default: return nil
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
