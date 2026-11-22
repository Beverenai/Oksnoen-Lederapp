import Foundation
import UIKit
import Capacitor
import WidgetKit
import ActivityKit
import AVFoundation
import UserNotifications

// Egne iOS-tillegg for Oksnøen-lederappen:
//  - MainViewController registrerer tilleggene (egne plugins må registreres for hånd i Capacitor).
//  - WidgetBridgePlugin: data til widgetene, live-visning på låseskjermen og tallmerket på ikonet.
//  - NativeScannerPlugin: iPhones innebygde QR-leser, vist bak nettsiden.

let oksAppGroupId = "group.com.oksnoen.ledere.shared"

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(NativeScannerPlugin())
        // Sveip fra venstre kant for å gå tilbake, som i vanlige iOS-apper.
        // Virker med appens egen navigering (history.pushState).
        webView?.allowsBackForwardNavigationGestures = true
    }
}

/// Live-visningen «Denne økta». Må være lik definisjonen i widget-utvidelsen (LederWidgetBundle.swift).
struct OktAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var activity: String
        var sessionLabel: String
        var extra: String
        var obs: String
    }
    var leaderName: String
}

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBadge", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncLiveActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endLiveActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWidgets", returnType: CAPPluginReturnPromise)
    ]

    /// Eldre kall: bare de tre tekstene.
    @objc func updateWidgetData(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: oksAppGroupId) else {
            call.reject("Fikk ikke tilgang til app-gruppen")
            return
        }
        defaults.set(call.getString("currentActivity"), forKey: "widget_current_activity")
        defaults.set(call.getString("extraActivity"), forKey: "widget_extra_activity")
        defaults.set(call.getString("obsMessage"), forKey: "widget_obs_message")
        defaults.set(Date().timeIntervalSince1970, forKey: "widget_last_updated")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// Hele øyeblikksbildet som JSON. Tom streng tømmer widgetene (utlogging).
    @objc func setSnapshot(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: oksAppGroupId) else {
            call.reject("Fikk ikke tilgang til app-gruppen")
            return
        }
        let json = call.getString("json") ?? ""
        if json.isEmpty {
            defaults.removeObject(forKey: "widget_snapshot")
            defaults.removeObject(forKey: "widget_current_activity")
            defaults.removeObject(forKey: "widget_extra_activity")
            defaults.removeObject(forKey: "widget_obs_message")
        } else {
            defaults.set(json, forKey: "widget_snapshot")
        }
        defaults.set(Date().timeIntervalSince1970, forKey: "widget_last_updated")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func setBadge(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)
        UNUserNotificationCenter.current().setBadgeCount(count) { _ in }
        call.resolve()
    }

    /// Starter live-visningen, eller oppdaterer den som allerede vises.
    @objc func syncLiveActivity(_ call: CAPPluginCall) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["active": false])
            return
        }
        let state = OktAttributes.ContentState(
            activity: call.getString("activity") ?? "",
            sessionLabel: call.getString("sessionLabel") ?? "",
            extra: call.getString("extra") ?? "",
            obs: call.getString("obs") ?? ""
        )
        let leaderName = call.getString("leaderName") ?? ""
        Task {
            // Visningen regnes som utdatert etter fire timer, så et gammelt oppdrag ikke blir stående.
            let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(4 * 60 * 60))
            if let existing = Activity<OktAttributes>.activities.first {
                await existing.update(content)
                call.resolve(["active": true])
                return
            }
            do {
                _ = try Activity.request(attributes: OktAttributes(leaderName: leaderName), content: content, pushType: nil)
                call.resolve(["active": true])
            } catch {
                call.resolve(["active": false])
            }
        }
    }

    @objc func endLiveActivity(_ call: CAPPluginCall) {
        Task {
            for activity in Activity<OktAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }

    @objc func reloadWidgets(_ call: CAPPluginCall) {
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

/// Kameravisningen som legges bak nettsiden.
private final class ScannerPreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}

@objc(NativeScannerPlugin)
public class NativeScannerPlugin: CAPPlugin, CAPBridgedPlugin, AVCaptureMetadataOutputObjectsDelegate {
    public let identifier = "NativeScannerPlugin"
    public let jsName = "NativeScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTorch", returnType: CAPPluginReturnPromise)
    ]

    private var session: AVCaptureSession?
    private var device: AVCaptureDevice?
    private var preview: ScannerPreviewView?
    private let sessionQueue = DispatchQueue(label: "com.oksnoen.ledere.scanner")
    private var lastValue = ""
    private var lastAt = Date.distantPast
    private var savedOpaque = true
    private var savedBackground: UIColor?
    private var savedScrollBackground: UIColor?

    @objc func start(_ call: CAPPluginCall) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            begin(call)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted { self.begin(call) } else { call.reject("Ingen tilgang til kameraet", "NO_PERMISSION") }
            }
        default:
            call.reject("Ingen tilgang til kameraet", "NO_PERMISSION")
        }
    }

    private func begin(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.session != nil {
                call.resolve(["torch": self.device?.hasTorch ?? false])
                return
            }
            guard let webView = self.bridge?.webView, let container = webView.superview else {
                call.reject("Fant ikke visningen", "NO_VIEW")
                return
            }
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                  let input = try? AVCaptureDeviceInput(device: device) else {
                call.reject("Fant ikke kameraet", "NO_CAMERA")
                return
            }
            let session = AVCaptureSession()
            session.sessionPreset = .high
            let output = AVCaptureMetadataOutput()
            guard session.canAddInput(input), session.canAddOutput(output) else {
                call.reject("Fikk ikke startet kameraet", "NO_SESSION")
                return
            }
            session.addInput(input)
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            guard output.availableMetadataObjectTypes.contains(.qr) else {
                call.reject("QR-lesing støttes ikke", "NO_QR")
                return
            }
            output.metadataObjectTypes = [.qr]

            // Armbånd holdes nært: kontinuerlig fokus med vekt på kort avstand.
            if (try? device.lockForConfiguration()) != nil {
                if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
                if device.isAutoFocusRangeRestrictionSupported { device.autoFocusRangeRestriction = .near }
                if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
                device.unlockForConfiguration()
            }

            let preview = ScannerPreviewView(frame: webView.frame)
            preview.backgroundColor = .black
            preview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            preview.previewLayer.session = session
            preview.previewLayer.videoGravity = .resizeAspectFill
            container.insertSubview(preview, belowSubview: webView)

            // Nettsiden gjøres gjennomsiktig så kameraet synes bak den.
            self.savedOpaque = webView.isOpaque
            self.savedBackground = webView.backgroundColor
            self.savedScrollBackground = webView.scrollView.backgroundColor
            webView.isOpaque = false
            webView.backgroundColor = .clear
            webView.scrollView.backgroundColor = .clear

            self.session = session
            self.device = device
            self.preview = preview
            self.lastValue = ""
            self.sessionQueue.async { session.startRunning() }
            call.resolve(["torch": device.hasTorch])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.teardown()
            call.resolve()
        }
    }

    private func teardown() {
        guard let session = self.session else { return }
        if let device = self.device, device.hasTorch, device.torchMode == .on, (try? device.lockForConfiguration()) != nil {
            device.torchMode = .off
            device.unlockForConfiguration()
        }
        self.sessionQueue.async { session.stopRunning() }
        self.preview?.removeFromSuperview()
        if let webView = self.bridge?.webView {
            webView.isOpaque = self.savedOpaque
            webView.backgroundColor = self.savedBackground
            webView.scrollView.backgroundColor = self.savedScrollBackground
        }
        self.session = nil
        self.device = nil
        self.preview = nil
    }

    @objc func setTorch(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        guard let device = self.device, device.hasTorch, (try? device.lockForConfiguration()) != nil else {
            call.reject("Lommelykten er ikke tilgjengelig")
            return
        }
        device.torchMode = on ? .on : .off
        device.unlockForConfiguration()
        call.resolve()
    }

    public func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let code = metadataObjects.first as? AVMetadataMachineReadableCodeObject, let value = code.stringValue, !value.isEmpty else { return }
        // Samme kode sendes ikke oftere enn hvert 0,6 sekund. Nettsiden avgjør resten.
        let now = Date()
        if value == lastValue && now.timeIntervalSince(lastAt) < 0.6 { return }
        lastValue = value
        lastAt = now
        notifyListeners("code", data: ["value": value])
    }
}
