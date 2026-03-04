import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWidgets", returnType: CAPPluginReturnPromise)
    ]

    private let appGroupId = "group.com.oksnoen.lederapp"

    @objc func updateWidgetData(_ call: CAPPluginCall) {
        let currentActivity = call.getString("currentActivity")
        let extraActivity = call.getString("extraActivity")
        let obsMessage = call.getString("obsMessage")

        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            call.reject("Failed to access App Group UserDefaults")
            return
        }

        defaults.set(currentActivity, forKey: "widget_current_activity")
        defaults.set(extraActivity, forKey: "widget_extra_activity")
        defaults.set(obsMessage, forKey: "widget_obs_message")
        defaults.set(Date().timeIntervalSince1970, forKey: "widget_last_updated")

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve()
    }

    @objc func reloadWidgets(_ call: CAPPluginCall) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
