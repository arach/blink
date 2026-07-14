import AppKit
import Foundation
import HudsonObservability

/// Blink's agent-first configuration: a human/agent-editable JSON file that is
/// the source of truth for behavior and theme. Every field is optional in the
/// file; missing fields fall back to defaults. Schema: docs/config.md.
struct BlinkConfig: Codable, Equatable {
    struct Behavior: Codable, Equatable {
        var restoreSession: Bool = true
        var defaultMode: String = "read"

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            restoreSession = try c.decodeIfPresent(Bool.self, forKey: .restoreSession) ?? true
            defaultMode = try c.decodeIfPresent(String.self, forKey: .defaultMode) ?? "read"
        }
    }

    struct Panel: Codable, Equatable {
        var material: String = "hud"  // hud | underWindow | popover | sidebar | menu
        var cornerRadius: Double = 12
        var tintRead: Double = 0.18
        var tintEdit: Double = 0.28
        var shadow: Bool = true
        var defaultWidth: Double = 420
        var defaultHeight: Double = 340

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            material = try c.decodeIfPresent(String.self, forKey: .material) ?? "hud"
            cornerRadius = try c.decodeIfPresent(Double.self, forKey: .cornerRadius) ?? 12
            tintRead = try c.decodeIfPresent(Double.self, forKey: .tintRead) ?? 0.18
            tintEdit = try c.decodeIfPresent(Double.self, forKey: .tintEdit) ?? 0.28
            shadow = try c.decodeIfPresent(Bool.self, forKey: .shadow) ?? true
            defaultWidth = try c.decodeIfPresent(Double.self, forKey: .defaultWidth) ?? 420
            defaultHeight = try c.decodeIfPresent(Double.self, forKey: .defaultHeight) ?? 340
        }

        var visualEffectMaterial: NSVisualEffectView.Material {
            switch material {
            case "underWindow": .underWindowBackground
            case "popover": .popover
            case "sidebar": .sidebar
            case "menu": .menu
            default: .hudWindow
            }
        }
    }

    struct Focus: Codable, Equatable {
        var dim: Double = 0.30

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            dim = try c.decodeIfPresent(Double.self, forKey: .dim) ?? 0.30
        }
    }

    struct Editor: Codable, Equatable {
        var fontFamily: String?
        var monoFamily: String?
        var fontSize: Double = 13
        var lineHeight: Double = 1.75
        var paddingX: Double = 20
        var paddingY: Double = 16
        var textColor: String?
        var textStrongColor: String?
        var textMutedColor: String?
        var accentColor: String?
        var codeBackground: String?
        var caretColor: String?
        var selectionColor: String?
        var h1Size: Double?
        var h2Size: Double?
        var h3Size: Double?

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            fontFamily = try c.decodeIfPresent(String.self, forKey: .fontFamily)
            monoFamily = try c.decodeIfPresent(String.self, forKey: .monoFamily)
            fontSize = try c.decodeIfPresent(Double.self, forKey: .fontSize) ?? 13
            lineHeight = try c.decodeIfPresent(Double.self, forKey: .lineHeight) ?? 1.75
            paddingX = try c.decodeIfPresent(Double.self, forKey: .paddingX) ?? 20
            paddingY = try c.decodeIfPresent(Double.self, forKey: .paddingY) ?? 16
            textColor = try c.decodeIfPresent(String.self, forKey: .textColor)
            textStrongColor = try c.decodeIfPresent(String.self, forKey: .textStrongColor)
            textMutedColor = try c.decodeIfPresent(String.self, forKey: .textMutedColor)
            accentColor = try c.decodeIfPresent(String.self, forKey: .accentColor)
            codeBackground = try c.decodeIfPresent(String.self, forKey: .codeBackground)
            caretColor = try c.decodeIfPresent(String.self, forKey: .caretColor)
            selectionColor = try c.decodeIfPresent(String.self, forKey: .selectionColor)
            h1Size = try c.decodeIfPresent(Double.self, forKey: .h1Size)
            h2Size = try c.decodeIfPresent(Double.self, forKey: .h2Size)
            h3Size = try c.decodeIfPresent(Double.self, forKey: .h3Size)
        }
    }

    var behavior = Behavior()
    var panel = Panel()
    var focus = Focus()
    var editor = Editor()

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        behavior = try c.decodeIfPresent(Behavior.self, forKey: .behavior) ?? Behavior()
        panel = try c.decodeIfPresent(Panel.self, forKey: .panel) ?? Panel()
        focus = try c.decodeIfPresent(Focus.self, forKey: .focus) ?? Focus()
        editor = try c.decodeIfPresent(Editor.self, forKey: .editor) ?? Editor()
    }

    /// Map editor settings onto the web bundle's CSS variable contract
    /// (see web/editor/README.md). Only non-default values are sent; the
    /// stylesheet's own defaults cover the rest.
    var editorThemeVars: [String: String] {
        var vars: [String: String] = [
            "--blink-font-size": "\(editor.fontSize)px",
            "--blink-line-height": "\(editor.lineHeight)",
            "--blink-pad-x": "\(editor.paddingX)px",
            "--blink-pad-y": "\(editor.paddingY)px",
        ]
        if let v = editor.fontFamily { vars["--blink-font-family"] = v }
        if let v = editor.monoFamily { vars["--blink-mono-family"] = v }
        if let v = editor.textColor { vars["--blink-text"] = v }
        if let v = editor.textStrongColor { vars["--blink-text-strong"] = v }
        if let v = editor.textMutedColor { vars["--blink-text-muted"] = v }
        if let v = editor.accentColor { vars["--blink-accent"] = v }
        if let v = editor.codeBackground { vars["--blink-code-bg"] = v }
        if let v = editor.caretColor { vars["--blink-caret"] = v }
        if let v = editor.selectionColor { vars["--blink-selection"] = v }
        if let v = editor.h1Size { vars["--blink-h1-size"] = "\(v)px" }
        if let v = editor.h2Size { vars["--blink-h2-size"] = "\(v)px" }
        if let v = editor.h3Size { vars["--blink-h3-size"] = "\(v)px" }
        return vars
    }
}

/// Loads, saves, and hot-reloads the config file. Agent-first: any process may
/// edit the file; a directory watcher picks the change up and re-applies it
/// live. Invalid JSON keeps the last good config (and logs).
@MainActor
final class BlinkConfigStore: ObservableObject {
    static let shared = BlinkConfigStore()

    @Published private(set) var config = BlinkConfig()
    let fileURL: URL

    /// Fired on every effective change (file edit or in-app update).
    var onChange: ((BlinkConfig) -> Void)?

    private var watcher: DispatchSourceFileSystemObject?
    private let log = HudLogger(category: "blink.config")

    var displayPath: String {
        fileURL.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")
    }

    private init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Blink", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("config.json")

        if let loaded = Self.load(from: fileURL) {
            config = loaded
        } else {
            // Bootstrap: migrate the two legacy UserDefaults keys, then the
            // file is the source of truth forever after.
            var bootstrap = BlinkConfig()
            let defaults = UserDefaults.standard
            if let restore = defaults.object(forKey: ConfigKeys.restoreSession) as? Bool {
                bootstrap.behavior.restoreSession = restore
            }
            if let mode = defaults.string(forKey: ConfigKeys.defaultMode) {
                bootstrap.behavior.defaultMode = mode
            }
            config = bootstrap
            save()
            log.info("[BLINK] config bootstrapped", metadata: ["path": displayPath])
        }
        watch()
    }

    /// In-app mutation (settings UI). Saves and notifies.
    func update(_ mutate: (inout BlinkConfig) -> Void) {
        var next = config
        mutate(&next)
        guard next != config else { return }
        config = next
        save()
        onChange?(next)
    }

    func reloadFromDisk() {
        guard let loaded = Self.load(from: fileURL) else {
            log.error("[BLINK] config invalid — keeping last good", metadata: ["path": displayPath])
            return
        }
        guard loaded != config else { return }
        config = loaded
        onChange?(loaded)
        log.info("[BLINK] config hot-reloaded", metadata: ["path": displayPath])
    }

    private static func load(from url: URL) -> BlinkConfig? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(BlinkConfig.self, from: data)
    }

    private func save() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(config) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }

    /// Watch the containing directory (atomic writes replace the file's inode,
    /// so watching the file descriptor directly would go stale).
    private func watch() {
        let fd = open(fileURL.deletingLastPathComponent().path, O_EVTONLY)
        guard fd >= 0 else { return }
        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd,
            eventMask: [.write],
            queue: .main
        )
        source.setEventHandler { [weak self] in
            MainActor.assumeIsolated { self?.reloadFromDisk() }
        }
        source.setCancelHandler { close(fd) }
        source.resume()
        watcher = source
    }
}
