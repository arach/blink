import AppKit
import BlinkCore
import Foundation
import HudsonObservability
import WebKit

/// A renderer-only CodeMirror host. Its user-content controller registers one
/// message (`ready`) and its JavaScript global exposes only presentation calls.
/// There is no content-change callback, save request, or content getter for a
/// caller to accidentally connect to Blink's note mutation path.
@MainActor
final class SourceViewerWebView: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let webView: WKWebView

    private var viewerURL: URL?
    private var isReady = false
    private var pendingDocument: SourceDocument?
    private var pendingTheme: [String: String]?
    private let log = HudLogger(category: "blink.source-bridge")

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        configuration.userContentController.add(self, name: "blinkSource")
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
    }

    func load() {
        guard let url = Self.viewerHTMLURL() else {
            log.error("[BLINK] source-viewer.html not found — build web/editor")
            return
        }
        viewerURL = url
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    func teardown() {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "blinkSource")
    }

    func setDocument(_ document: SourceDocument) {
        guard isReady else {
            pendingDocument = document
            return
        }
        var payload: [String: Any] = [
            "text": document.text,
            "language": document.language,
        ]
        if let lines = document.lines {
            payload["lineStart"] = lines.start
            payload["lineEnd"] = lines.end
        }
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8)
        else { return }
        evaluate("window.blinkSource.setDocument(\(json))")
    }

    func setTheme(_ variables: [String: String]) {
        guard isReady else {
            pendingTheme = variables
            return
        }
        guard let data = try? JSONSerialization.data(withJSONObject: variables),
              let json = String(data: data, encoding: .utf8)
        else { return }
        evaluate("window.blinkSource.setTheme(\(json))")
    }

    func focus() {
        guard isReady else { return }
        evaluate("window.blinkSource.focus()")
    }

    func showFind() {
        guard isReady else { return }
        evaluate("window.blinkSource.showFind()")
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "blinkSource",
              let body = message.body as? [String: Any],
              body["type"] as? String == "ready"
        else { return }
        isReady = true
        if let theme = pendingTheme {
            pendingTheme = nil
            setTheme(theme)
        }
        if let document = pendingDocument {
            pendingDocument = nil
            setDocument(document)
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url,
              url.isFileURL,
              let viewerURL,
              url.path == viewerURL.path
        else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    private func evaluate(_ script: String) {
        webView.evaluateJavaScript(script) { [weak self] _, error in
            if let error {
                self?.log.error("[BLINK] source bridge evaluation failed", metadata: ["error": "\(error)"])
            }
        }
    }

    private static func viewerHTMLURL() -> URL? {
        if let bundled = Bundle.main.url(forResource: "source-viewer", withExtension: "html") {
            return bundled
        }
        let executable = URL(fileURLWithPath: ProcessInfo.processInfo.arguments[0])
        let repoRoot = executable
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let dev = repoRoot.appendingPathComponent("web/editor/dist/source-viewer.html")
        return FileManager.default.fileExists(atPath: dev.path) ? dev : nil
    }
}
