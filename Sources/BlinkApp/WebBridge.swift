import Foundation
import HudsonObservability
import WebKit

/// Hosts the CodeMirror editor bundle in a WKWebView and speaks the bridge
/// contract (see web/editor/README.md):
///   JS → native:  ready · contentChanged(text) · saveRequested
///   native → JS:  setContent · typeOn · focus · mode/theme/sheet/entrance
///
/// Designed to be generic enough to upstream to HudsonKit once proven.
@MainActor
final class EditorWebView: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let webView: WKWebView

    var onReady: (() -> Void)?
    var onContentChanged: ((String) -> Void)?
    var onSaveRequested: (() -> Void)?
    var onModeChanged: ((String) -> Void)?

    private var isReady = false
    private var pendingContent: String?
    private var pendingMode: String?
    private var pendingTheme: [String: String]?
    private var pendingSheet: String?
    private var pendingEnter: (kind: String, durationMs: Double)?
    private var pendingTypeOn: (base: String, suffix: String, source: String?)?
    private let log = HudLogger(category: "blink.bridge")

    override init() {
        let configuration = WKWebViewConfiguration()
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()

        configuration.userContentController.add(self, name: "blink")
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")  // transparent over glass
    }

    /// Break the userContentController → handler retain cycle. Must be called
    /// when the hosting panel closes (PanelManager does this).
    func teardown() {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "blink")
        onReady = nil
        onContentChanged = nil
        onSaveRequested = nil
        onModeChanged = nil
    }

    /// Locate the built editor bundle: app Resources first (run-app.sh copies it),
    /// then the repo-relative dev path for `swift run`.
    static func editorHTMLURL() -> URL? {
        if let bundled = Bundle.main.url(forResource: "editor", withExtension: "html") {
            return bundled
        }
        // Dev fallback: <repo>/web/editor/dist/editor.html relative to the executable
        // (.build/debug/BlinkApp → repo root is three levels up).
        let executable = URL(fileURLWithPath: ProcessInfo.processInfo.arguments[0])
        let repoRoot = executable
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let dev = repoRoot.appendingPathComponent("web/editor/dist/editor.html")
        return FileManager.default.fileExists(atPath: dev.path) ? dev : nil
    }

    func load() {
        guard let url = Self.editorHTMLURL() else {
            log.error("[BLINK] editor.html not found — build web/editor first")
            return
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    func setContent(_ text: String) {
        guard isReady else {
            pendingContent = text
            // Last programmatic content operation wins while the page loads.
            // A non-append replacement supersedes a queued reveal.
            pendingTypeOn = nil
            return
        }
        evaluate("window.blink.setContent(\(Self.jsString(text)))")
    }

    func focus() {
        guard isReady else { return }
        evaluate("window.blink.focus()")
    }

    /// Programmatic mode switch (edit/read) — never echoes modeChanged.
    func setMode(_ mode: String) {
        guard isReady else {
            pendingMode = mode
            return
        }
        evaluate("window.blink.setMode(\(Self.jsString(mode)))")
    }

    /// Select the sheet template (the note's whole visual identity, drawn by
    /// the web layer). Never echoes contentChanged. Guarded so an older bundle
    /// without setSheet is a no-op rather than an error.
    func setSheet(_ name: String) {
        guard isReady else {
            pendingSheet = name
            return
        }
        evaluate("window.blink.setSheet && window.blink.setSheet(\(Self.jsString(name)))")
    }

    /// Play a content entrance effect (Arrival): the web layer choreographs the
    /// content while the native panel animates its window. Guarded so an older
    /// bundle without `enter` is a no-op rather than an error. `none` still calls
    /// through (a harmless no-op web-side) so a stale bundle never animates.
    func enter(_ kind: String, durationMs: Double) {
        guard isReady else {
            pendingEnter = (kind, durationMs)
            return
        }
        evaluate("window.blink.enter && window.blink.enter(\(Self.jsString(kind)), \(durationMs))")
    }

    /// Reveal an externally appended suffix without ever echoing
    /// `contentChanged`. Like theme/sheet/entrance this queues until `ready`
    /// and is guarded for a stale editor bundle; unlike those cosmetic calls,
    /// the fallback MUST install the complete content so no update is lost.
    func typeOn(base: String, suffix: String, source: String?) {
        guard isReady else {
            pendingContent = nil
            pendingTypeOn = (base, suffix, source)
            return
        }
        let full = base + suffix
        let encodedSource = source.map(Self.jsString) ?? "null"
        evaluate(
            "window.blink.typeOn "
                + "? window.blink.typeOn(\(Self.jsString(base)), \(Self.jsString(suffix)), "
                + "\(encodedSource)) "
                + ": window.blink.setContent(\(Self.jsString(full)))"
        )
    }

    /// Snap an in-flight reveal to its already-installed full document. Before
    /// `ready`, collapse the queued reveal into a full pending set instead.
    func finishTypeOn() {
        guard isReady else {
            // The native reveal clock can elapse before a newly created
            // WKWebView reaches `ready`. Collapse the queued reveal to a plain
            // full-content set — never discard the only copy of the update.
            if let pending = pendingTypeOn {
                pendingContent = pending.base + pending.suffix
                pendingTypeOn = nil
            }
            return
        }
        evaluate("window.blink.finishTypeOn && window.blink.finishTypeOn()")
    }

    /// Push CSS variables to the bundle (theming). Guarded so an older bundle
    /// without setTheme is a no-op rather than an error.
    func setTheme(_ vars: [String: String]) {
        guard isReady else {
            pendingTheme = vars
            return
        }
        guard let data = try? JSONSerialization.data(withJSONObject: vars),
              let json = String(data: data, encoding: .utf8)
        else { return }
        evaluate("window.blink.setTheme && window.blink.setTheme(\(json))")
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "blink",
              let body = message.body as? [String: Any],
              let type = body["type"] as? String
        else { return }

        switch type {
        case "ready":
            isReady = true
            if let pending = pendingContent {
                pendingContent = nil
                setContent(pending)
            }
            if let mode = pendingMode {
                pendingMode = nil
                setMode(mode)
            }
            if let theme = pendingTheme {
                pendingTheme = nil
                setTheme(theme)
            }
            if let sheet = pendingSheet {
                pendingSheet = nil
                setSheet(sheet)
            }
            // Entrance last: content + sheet are in place, so the effect plays
            // against the final surface rather than an empty page.
            if let enter = pendingEnter {
                pendingEnter = nil
                self.enter(enter.kind, durationMs: enter.durationMs)
            }
            // Reveal last: content, mode, sheet, and any panel entrance are all
            // established before the append begins typing.
            if let typeOn = pendingTypeOn {
                pendingTypeOn = nil
                self.typeOn(base: typeOn.base, suffix: typeOn.suffix, source: typeOn.source)
            }
            onReady?()
        case "contentChanged":
            if let text = body["text"] as? String {
                onContentChanged?(text)
            }
        case "saveRequested":
            onSaveRequested?()
        case "modeChanged":
            if let mode = body["mode"] as? String {
                onModeChanged?(mode)
            }
        default:
            log.info("[BLINK] unknown bridge message", metadata: ["type": type])
        }
    }

    // MARK: - Helpers

    private func evaluate(_ js: String) {
        webView.evaluateJavaScript(js) { [log] _, error in
            if let error {
                log.error("[BLINK] bridge evaluate failed", metadata: ["error": "\(error)"])
            }
        }
    }

    /// Encode a Swift string as a JS string literal (JSON is a subset of JS).
    static func jsString(_ text: String) -> String {
        guard let data = try? JSONEncoder().encode(text),
              let encoded = String(data: data, encoding: .utf8)
        else { return "\"\"" }
        return encoded
    }
}
