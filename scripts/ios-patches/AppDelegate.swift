import UIKit
import Capacitor
import AVFoundation
import MediaPlayer
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, WKScriptMessageHandler {

    var window: UIWindow?
    private var currentArtworkImage: UIImage?
    private var lastArtworkUrl: String?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 1. Configure audio session for background, lockscreen and AirPlay/Bluetooth playback
        configureAudioSession()

        // 2. Setup Audio Interruption & Route Change Observers
        setupAudioObservers()

        // 3. Configure MPRemoteCommandCenter handlers
        setupRemoteCommandCenter()

        // 4. Register WKScriptMessageHandler on bridge webView when ready
        DispatchQueue.main.async { [weak self] in
            self?.setupWebViewBridge()
        }

        return true
    }

    private func configureAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .default, options: [.allowBluetooth, .allowBluetoothA2DP, .allowAirPlay])
            try audioSession.setActive(true, options: [])
            print("[MusicFlow AudioSession] Initialized .playback category successfully")
        } catch {
            print("[MusicFlow AudioSession] Error configuring audio session: \(error)")
        }
    }

    private func setupAudioObservers() {
        let center = NotificationCenter.default

        // Handle Audio Interruptions (Incoming Phone Calls, Siri, Alarms)
        center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] notification in
            guard let userInfo = notification.userInfo,
                  let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

            switch type {
            case .began:
                print("[MusicFlow AudioSession] Interruption began")
                self?.executeWebPlayerJS("if (window.Player && typeof window.Player.pause === 'function') { window.Player.pause(); }")
            case .ended:
                guard let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt else { return }
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) {
                    print("[MusicFlow AudioSession] Interruption ended -> Resuming audio playback")
                    self?.configureAudioSession()
                    self?.executeWebPlayerJS("if (window.Player && typeof window.Player.play === 'function') { window.Player.play(); }")
                }
            @unknown default:
                break
            }
        }

        // Handle Audio Route Changes (Headphones / AirPods disconnected -> pause to protect user)
        center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] notification in
            guard let userInfo = notification.userInfo,
                  let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
                  let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }

            if reason == .oldDeviceUnavailable {
                print("[MusicFlow AudioSession] Audio route disconnected (headphones unplugged) -> Pausing playback")
                self?.executeWebPlayerJS("if (window.Player && typeof window.Player.pause === 'function') { window.Player.pause(); }")
            }
        }

        // Handle iOS Media Services Reset (rare but critical edge case)
        center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
            print("[MusicFlow AudioSession] Media services were reset — reconfiguring audio session")
            self?.configureAudioSession()
        }
    }

    private func setupWebViewBridge() {
        if let bridgeVC = self.window?.rootViewController as? CAPBridgeViewController,
           let webView = bridgeVC.webView {
            webView.configuration.allowsInlineMediaPlayback = true
            webView.configuration.mediaTypesRequiringUserActionForPlayback = []
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "nativeMedia")
            webView.configuration.userContentController.add(self, name: "nativeMedia")
            print("[MusicFlow] WKScriptMessageHandler 'nativeMedia' registered successfully")
        }
    }

    private func setupRemoteCommandCenter() {
        let commandCenter = MPRemoteCommandCenter.shared()

        // Disable skip forward & skip backward (15s/30s) so iOS renders Previous/Next Track buttons
        commandCenter.skipForwardCommand.isEnabled = false
        commandCenter.skipBackwardCommand.isEnabled = false
        commandCenter.seekForwardCommand.isEnabled = false
        commandCenter.seekBackwardCommand.isEnabled = false

        // Previous Track
        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            self?.executeWebPlayerJS("if (window.Player && typeof window.Player.previous === 'function') { window.Player.previous(); }")
            return .success
        }

        // Next Track
        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            self?.executeWebPlayerJS("if (window.Player && typeof window.Player.next === 'function') { window.Player.next(); }")
            return .success
        }

        // Play
        commandCenter.playCommand.isEnabled = true
        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.executeWebPlayerJS("if (window.Player && typeof window.Player.play === 'function') { window.Player.play(); }")
            return .success
        }

        // Pause
        commandCenter.pauseCommand.isEnabled = true
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.executeWebPlayerJS("if (window.Player && typeof window.Player.pause === 'function') { window.Player.pause(); }")
            return .success
        }

        // Toggle Play/Pause
        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.executeWebPlayerJS("if (window.Player && typeof window.Player.togglePlay === 'function') { window.Player.togglePlay(); }")
            return .success
        }

        // Change Playback Position (Scrubbing / Seeking)
        commandCenter.changePlaybackPositionCommand.isEnabled = true
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            if let posEvent = event as? MPChangePlaybackPositionCommandEvent {
                self?.executeWebPlayerJS("if (window.Player && typeof window.Player.seek === 'function') { window.Player.seek(\(posEvent.positionTime)); }")
                return .success
            }
            return .commandFailed
        }
    }

    // MARK: - WKScriptMessageHandler
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeMedia", let body = message.body as? [String: Any] else { return }

        let action = body["action"] as? String ?? ""

        switch action {
        case "updateMetadata":
            updateNowPlaying(body)
        case "setPlaybackState":
            updatePlaybackState(body)
        case "clear":
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        default:
            break
        }
    }

    private func updateNowPlaying(_ data: [String: Any]) {
        let title = data["title"] as? String ?? "Unknown Track"
        let artist = data["artist"] as? String ?? "Unknown Artist"
        let album = data["album"] as? String ?? "MusicFlow Lossless"
        let duration = data["duration"] as? Double ?? 0.0
        let position = data["position"] as? Double ?? 0.0
        let isPlaying = data["isPlaying"] as? Bool ?? true
        let artworkUrlStr = data["artwork"] as? String ?? ""

        var nowPlayingInfo: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPMediaItemPropertyAlbumTitle: album,
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]

        if let currentImg = self.currentBitmap(for: artworkUrlStr) {
            let artwork = MPMediaItemArtwork(boundsSize: currentImg.size) { _ in currentImg }
            nowPlayingInfo[MPMediaItemPropertyArtwork] = artwork
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo

        // Fetch artwork asynchronously if URL is new without blocking playback
        if !artworkUrlStr.isEmpty && artworkUrlStr != self.lastArtworkUrl, let url = URL(string: artworkUrlStr) {
            self.lastArtworkUrl = artworkUrlStr
            URLSession.shared.dataTask(with: url) { [weak self] data, _, error in
                guard let self = self, let data = data, error == nil, let image = UIImage(data: data) else { return }
                self.currentArtworkImage = image
                DispatchQueue.main.async {
                    var updated = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                    let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                    updated[MPMediaItemPropertyArtwork] = artwork
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = updated
                }
            }.resume()
        }
    }

    private func updatePlaybackState(_ data: [String: Any]) {
        guard var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }

        if let isPlaying = data["isPlaying"] as? Bool {
            nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        }
        if let position = data["position"] as? Double {
            nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = position
        }
        if let duration = data["duration"] as? Double, duration > 0 {
            nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = duration
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    private func currentBitmap(for urlStr: String) -> UIImage? {
        if urlStr == lastArtworkUrl {
            return currentArtworkImage
        }
        return nil
    }

    private func executeWebPlayerJS(_ js: String) {
        DispatchQueue.main.async {
            if let bridgeVC = self.window?.rootViewController as? CAPBridgeViewController {
                bridgeVC.webView?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        // Maintain active audio session when entering background
        print("[MusicFlow] Application entered background -> Triggering background audio swap")

        // Trigger the JavaScript-side element swap:
        // This detaches AudioEffectsEngine (closes AudioContext) and creates a clean
        // Audio() element for background playback that outputs directly to the native
        // audio pipeline without going through Web Audio API.
        executeWebPlayerJS("""
            if (window.Player && typeof window.Player._handleBackgroundTransition === 'function') {
                window.Player._handleBackgroundTransition();
            }
        """)
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Re-activate audio session (may have been deactivated by interruption)
        print("[MusicFlow] Application returning to foreground -> Restoring audio session & effects")
        configureAudioSession()

        // Trigger the JavaScript-side foreground restore:
        // This syncs the position from the background element back to the original
        // effects-connected element and re-attaches AudioEffectsEngine.
        executeWebPlayerJS("""
            if (window.Player && typeof window.Player._handleForegroundTransition === 'function') {
                window.Player._handleForegroundTransition();
            }
        """)
    }

    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
