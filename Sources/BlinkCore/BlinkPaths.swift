import Foundation

/// Canonical locations for Blink's on-disk world, shared by the app and the
/// `blink` CLI so the two can never disagree about where notes live.
///
/// `BLINK_HOME` in the environment overrides the root — that's how tests and
/// agents sandbox a complete Blink (notes + config) without touching the real one.
public enum BlinkPaths {
    /// The Blink home directory: `~/Library/Application Support/Blink`,
    /// or `$BLINK_HOME` when set.
    public static func home(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL {
        if let override = environment["BLINK_HOME"], !override.isEmpty {
            return URL(fileURLWithPath: (override as NSString).expandingTildeInPath, isDirectory: true)
        }
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Blink", isDirectory: true)
    }

    /// Where the note files live: `<home>/Notes`.
    public static func notes(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL {
        home(environment: environment).appendingPathComponent("Notes", isDirectory: true)
    }

    /// The agent-first config file: `<home>/config.json`.
    public static func config(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL {
        home(environment: environment).appendingPathComponent("config.json", isDirectory: false)
    }

    /// Where note attachments live: `<home>/attachments`. A note can embed an
    /// image it owns via `![](blink://attachments/pic.png)`; the app serves this
    /// directory to the editor webview over the `blink://` scheme (see
    /// `EditorWebView`) rather than granting broad file-system read access.
    public static func attachments(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL {
        home(environment: environment).appendingPathComponent("attachments", isDirectory: true)
    }
}
