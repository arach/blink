import AppKit
import BlinkCore
import Foundation
import HudsonObservability

/// Blink's agent-first configuration: a human/agent-editable JSON file that is
/// the source of truth for behavior and theme. Every field is optional in the
/// file; missing fields fall back to defaults. Schema: docs/config.md.
struct BlinkConfig: Codable, Equatable {
    struct Behavior: Codable, Equatable {
        var restoreSession: Bool = true
        var defaultMode: String = "read"
        var launchAtLogin: Bool = false

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            restoreSession = try c.decodeIfPresent(Bool.self, forKey: .restoreSession) ?? true
            defaultMode = try c.decodeIfPresent(String.self, forKey: .defaultMode) ?? "read"
            launchAtLogin = try c.decodeIfPresent(Bool.self, forKey: .launchAtLogin) ?? false
        }
    }

    /// Chord strings parsed by `KeyChord` ("hyper+n", "cmd+shift+p", "cmd+.").
    /// `newNote` and `blink` are global (Carbon); `toggleMode` and `focus` are
    /// panel-local. Invalid strings are logged and the previous binding kept.
    struct Hotkeys: Codable, Equatable {
        var newNote: String = "hyper+n"
        var blink: String = "hyper+b"
        // C for constellation — G belongs to Lattices (in-place window tools).
        // The machine-wide Hyper namespace map lives in project memory.
        var grid: String = "hyper+c"
        var toggleMode: String = "cmd+shift+p"
        var focus: String = "cmd+."

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            newNote = try c.decodeIfPresent(String.self, forKey: .newNote) ?? "hyper+n"
            blink = try c.decodeIfPresent(String.self, forKey: .blink) ?? "hyper+b"
            grid = try c.decodeIfPresent(String.self, forKey: .grid) ?? "hyper+c"
            toggleMode = try c.decodeIfPresent(String.self, forKey: .toggleMode) ?? "cmd+shift+p"
            focus = try c.decodeIfPresent(String.self, forKey: .focus) ?? "cmd+."
        }
    }

    struct Panel: Codable, Equatable {
        /// Sheet template — the note's whole visual identity, drawn by the web
        /// layer: "glass" | "card" | "dotted" | "bracket" | "marginalia".
        /// Per-note override via a `sheet:` frontmatter key.
        var sheet: String = "glass"
        var material: String = "hud"  // hud | underWindow | popover | sidebar | menu
        var cornerRadius: Double = 12
        var tintRead: Double = 0.18
        var tintEdit: Double = 0.28
        var shadow: Bool = true
        var defaultWidth: Double = 420
        var defaultHeight: Double = 340
        /// Optional CSS surface color painted by the web sheet. `nil` keeps
        /// glass transparent; treatments can supply an opaque brand canvas.
        var background: String?
        /// Optional identity mark shown in the panel's top-left chrome. Relative
        /// paths resolve under `$BLINK_HOME/attachments`; note markdown never
        /// needs to carry presentation-only brand assets.
        var mark: String?

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            sheet = try c.decodeIfPresent(String.self, forKey: .sheet) ?? "glass"
            material = try c.decodeIfPresent(String.self, forKey: .material) ?? "hud"
            cornerRadius = try c.decodeIfPresent(Double.self, forKey: .cornerRadius) ?? 12
            tintRead = try c.decodeIfPresent(Double.self, forKey: .tintRead) ?? 0.18
            tintEdit = try c.decodeIfPresent(Double.self, forKey: .tintEdit) ?? 0.28
            shadow = try c.decodeIfPresent(Bool.self, forKey: .shadow) ?? true
            defaultWidth = try c.decodeIfPresent(Double.self, forKey: .defaultWidth) ?? 420
            defaultHeight = try c.decodeIfPresent(Double.self, forKey: .defaultHeight) ?? 340
            background = try c.decodeIfPresent(String.self, forKey: .background)
            mark = try c.decodeIfPresent(String.self, forKey: .mark)
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

    /// A backdrop parked behind every note panel: a full-screen blur + dim that
    /// mutes a busy desktop into a calm, dark stage so the notes read as a set.
    /// Off by default; agents flip it on via config.json and it hot-applies.
    struct Drape: Codable, Equatable {
        var enabled: Bool = false
        var dim: Double = 0.45  // 0–1 black tint over the blurred backdrop
        var opacity: Double = 1  // 0–1 overall presence; lower = a lighter veil
        var material: String = "hud"  // hud | underWindow | popover | sidebar | menu
        /// Suppress the drape while a single note is on screen — a lone note
        /// reads better clean over the desktop; the backdrop earns its keep only
        /// once the notes form a set. Off restores "behind every note".
        var soloSuppressed: Bool = true

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
            dim = try c.decodeIfPresent(Double.self, forKey: .dim) ?? 0.45
            opacity = try c.decodeIfPresent(Double.self, forKey: .opacity) ?? 1
            material = try c.decodeIfPresent(String.self, forKey: .material) ?? "hud"
            soloSuppressed = try c.decodeIfPresent(Bool.self, forKey: .soloSuppressed) ?? true
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

    /// Motion signature: every show/hide is choreographed so a theme ships a
    /// matching feel. `enabled == false` restores today's instant behavior, and
    /// `NSWorkspace.accessibilityDisplayShouldReduceMotion` is honored as "none"
    /// regardless of these values.
    struct Motion: Codable, Equatable {
        /// "shimmer" | "drop" | "draw" | "none". Unknown names fall back to none.
        var entrance: String = "shimmer"
        /// Base duration for one panel's entrance, in milliseconds.
        var durationMs: Double = 260
        /// Per-panel delay in group reveals (session restore + the blink), in ms.
        var staggerMs: Double = 40
        /// Master switch — false is today's instant show/hide.
        var enabled: Bool = true

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            entrance = try c.decodeIfPresent(String.self, forKey: .entrance) ?? "shimmer"
            durationMs = try c.decodeIfPresent(Double.self, forKey: .durationMs) ?? 260
            staggerMs = try c.decodeIfPresent(Double.self, forKey: .staggerMs) ?? 40
            enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        }
    }

    /// Panel physics: momentum fling with edge bounce, and shake-to-shade —
    /// how a panel behaves under the hand, as opposed to `motion`, which owns
    /// show/hide choreography. Read at gesture time (no hot-apply needed).
    /// Reduce Motion turns the physics gestures off entirely.
    struct Physics: Codable, Equatable {
        /// Master switch for the fling: release a fast drag and the panel
        /// glides on, bouncing off the edges of the screen it's mostly on.
        var flingEnabled: Bool = true
        /// Exponential glide friction (1/s); higher = heavier, stops sooner.
        /// Total glide distance is ~releaseSpeed / flingFriction.
        var flingFriction: Double = 3.2
        /// Release speed (pt/s) that starts a glide; below it the panel stays put.
        var flingMinVelocity: Double = 900
        /// Fraction of velocity kept after an edge bounce (0…1).
        var bounceDamping: Double = 0.6
        /// Shake the panel side-to-side during a drag to fold it into its top
        /// band (shade); shake again — or double-click the band — to restore.
        var shakeEnabled: Bool = true

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            flingEnabled = try c.decodeIfPresent(Bool.self, forKey: .flingEnabled) ?? true
            flingFriction = try c.decodeIfPresent(Double.self, forKey: .flingFriction) ?? 3.2
            flingMinVelocity = try c.decodeIfPresent(Double.self, forKey: .flingMinVelocity) ?? 900
            bounceDamping = try c.decodeIfPresent(Double.self, forKey: .bounceDamping) ?? 0.6
            shakeEnabled = try c.decodeIfPresent(Bool.self, forKey: .shakeEnabled) ?? true
        }
    }

    struct Editor: Codable, Equatable {
        var fontFamily: String?
        var monoFamily: String?
        var titleFamily: String?
        var fontSize: Double = 13
        var lineHeight: Double = 1.75
        var paddingX: Double = 20
        var paddingY: Double = 16
        var textColor: String?
        var textStrongColor: String?
        var textMutedColor: String?
        var dimColor: String?
        var borderColor: String?
        var accentColor: String?
        var accentDimColor: String?
        var codeBackground: String?
        var codeTextColor: String?
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
            titleFamily = try c.decodeIfPresent(String.self, forKey: .titleFamily)
            fontSize = try c.decodeIfPresent(Double.self, forKey: .fontSize) ?? 13
            lineHeight = try c.decodeIfPresent(Double.self, forKey: .lineHeight) ?? 1.75
            paddingX = try c.decodeIfPresent(Double.self, forKey: .paddingX) ?? 20
            paddingY = try c.decodeIfPresent(Double.self, forKey: .paddingY) ?? 16
            textColor = try c.decodeIfPresent(String.self, forKey: .textColor)
            textStrongColor = try c.decodeIfPresent(String.self, forKey: .textStrongColor)
            textMutedColor = try c.decodeIfPresent(String.self, forKey: .textMutedColor)
            dimColor = try c.decodeIfPresent(String.self, forKey: .dimColor)
            borderColor = try c.decodeIfPresent(String.self, forKey: .borderColor)
            accentColor = try c.decodeIfPresent(String.self, forKey: .accentColor)
            accentDimColor = try c.decodeIfPresent(String.self, forKey: .accentDimColor)
            codeBackground = try c.decodeIfPresent(String.self, forKey: .codeBackground)
            codeTextColor = try c.decodeIfPresent(String.self, forKey: .codeTextColor)
            caretColor = try c.decodeIfPresent(String.self, forKey: .caretColor)
            selectionColor = try c.decodeIfPresent(String.self, forKey: .selectionColor)
            h1Size = try c.decodeIfPresent(Double.self, forKey: .h1Size)
            h2Size = try c.decodeIfPresent(Double.self, forKey: .h2Size)
            h3Size = try c.decodeIfPresent(Double.self, forKey: .h3Size)
        }
    }

    /// A named, reusable presentation preset — a *partial* overlay onto the
    /// panel/editor defaults, every field optional. A note references one by name
    /// via its `blink.style`; the studio's treatments live here. Typed (not
    /// passed-through) so it survives a config re-encode.
    /// Field → surface mapping is in `apply(treatment:)`; see
    /// `docs/notes-representation.md` Appendix A.
    struct Treatment: Codable, Equatable {
        var sheet: String?
        var accent: String?
        var accentDim: String?
        var font: String?
        var mono: String?
        var titleFont: String?
        var fontSize: Double?
        var lineHeight: Double?
        var background: String?
        var text: String?
        var textStrong: String?
        var textMuted: String?
        var dim: String?
        var border: String?
        var codeBackground: String?
        var codeText: String?
        var caret: String?
        var selection: String?
        var tint: Double?
        var tintRead: Double?
        var tintEdit: Double?
        var radius: Double?
        /// Relative path under `$BLINK_HOME/attachments` for a restrained
        /// identity mark in the panel's top-left chrome.
        var mark: String?

        init() {}
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            sheet = try c.decodeIfPresent(String.self, forKey: .sheet)
            accent = try c.decodeIfPresent(String.self, forKey: .accent)
            accentDim = try c.decodeIfPresent(String.self, forKey: .accentDim)
            font = try c.decodeIfPresent(String.self, forKey: .font)
            mono = try c.decodeIfPresent(String.self, forKey: .mono)
            titleFont = try c.decodeIfPresent(String.self, forKey: .titleFont)
            fontSize = try c.decodeIfPresent(Double.self, forKey: .fontSize)
            lineHeight = try c.decodeIfPresent(Double.self, forKey: .lineHeight)
            background = try c.decodeIfPresent(String.self, forKey: .background)
            text = try c.decodeIfPresent(String.self, forKey: .text)
            textStrong = try c.decodeIfPresent(String.self, forKey: .textStrong)
            textMuted = try c.decodeIfPresent(String.self, forKey: .textMuted)
            dim = try c.decodeIfPresent(String.self, forKey: .dim)
            border = try c.decodeIfPresent(String.self, forKey: .border)
            codeBackground = try c.decodeIfPresent(String.self, forKey: .codeBackground)
            codeText = try c.decodeIfPresent(String.self, forKey: .codeText)
            caret = try c.decodeIfPresent(String.self, forKey: .caret)
            selection = try c.decodeIfPresent(String.self, forKey: .selection)
            tint = try c.decodeIfPresent(Double.self, forKey: .tint)
            tintRead = try c.decodeIfPresent(Double.self, forKey: .tintRead)
            tintEdit = try c.decodeIfPresent(Double.self, forKey: .tintEdit)
            radius = try c.decodeIfPresent(Double.self, forKey: .radius)
            mark = try c.decodeIfPresent(String.self, forKey: .mark)
        }
    }

    /// App-wide light/dark axis: "auto" (follow macOS) | "light" | "dark".
    /// Resolved to an effective `AppScheme` by `AppearanceManager`; every
    /// surface paints by that. "auto" is the default and tracks the OS live.
    var appearance = "auto"
    var behavior = Behavior()
    var hotkeys = Hotkeys()
    var panel = Panel()
    var focus = Focus()
    var drape = Drape()
    var motion = Motion()
    var physics = Physics()
    var editor = Editor()
    /// Named presentation presets, referenced by a note's `blink.style`.
    var styles: [String: Treatment]?

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        appearance = try c.decodeIfPresent(String.self, forKey: .appearance) ?? "auto"
        behavior = try c.decodeIfPresent(Behavior.self, forKey: .behavior) ?? Behavior()
        hotkeys = try c.decodeIfPresent(Hotkeys.self, forKey: .hotkeys) ?? Hotkeys()
        panel = try c.decodeIfPresent(Panel.self, forKey: .panel) ?? Panel()
        focus = try c.decodeIfPresent(Focus.self, forKey: .focus) ?? Focus()
        drape = try c.decodeIfPresent(Drape.self, forKey: .drape) ?? Drape()
        motion = try c.decodeIfPresent(Motion.self, forKey: .motion) ?? Motion()
        physics = try c.decodeIfPresent(Physics.self, forKey: .physics) ?? Physics()
        editor = try c.decodeIfPresent(Editor.self, forKey: .editor) ?? Editor()
        styles = try c.decodeIfPresent([String: Treatment].self, forKey: .styles)
    }

    // MARK: - Per-note presentation resolution

    /// Resolve a note's `blink:` presentation onto this config, producing the
    /// effective config *for that note*:
    /// `configDefaults ← styles[name] ← loose overrides` (Appendix A).
    /// A missing/unknown style name is ignored (defaults stand); loose overrides
    /// always win. Never throws — a bad value is clamped, never fatal.
    func resolved(for presentation: NotePresentation) -> BlinkConfig {
        var c = self
        if let name = presentation.style, let treatment = styles?[name] {
            c.apply(treatment: treatment)
        }
        c.apply(treatment: BlinkConfig.treatment(from: presentation))
        return c
    }

    /// Overlay a treatment's set fields onto panel/editor, with defensive clamps
    /// so a stray value can't render the surface unusable.
    mutating func apply(treatment t: Treatment) {
        if let v = t.sheet { panel.sheet = v }
        if let v = t.accent { editor.accentColor = v }
        if let v = t.accentDim { editor.accentDimColor = v }
        if let v = t.font { editor.fontFamily = v }
        if let v = t.mono { editor.monoFamily = v }
        if let v = t.titleFont { editor.titleFamily = v }
        if let v = t.fontSize { editor.fontSize = clamp(v, 6, 48) }
        if let v = t.lineHeight { editor.lineHeight = clamp(v, 0.8, 3.0) }
        if let v = t.background { panel.background = v }
        if let v = t.text { editor.textColor = v }
        if let v = t.textStrong { editor.textStrongColor = v }
        if let v = t.textMuted { editor.textMutedColor = v }
        if let v = t.dim { editor.dimColor = v }
        if let v = t.border { editor.borderColor = v }
        if let v = t.codeBackground { editor.codeBackground = v }
        if let v = t.codeText { editor.codeTextColor = v }
        if let v = t.caret { editor.caretColor = v }
        if let v = t.selection { editor.selectionColor = v }
        // `tint` is shorthand for both; explicit read/edit win over it.
        if let v = t.tint { let c = clamp(v, 0, 1); panel.tintRead = c; panel.tintEdit = c }
        if let v = t.tintRead { panel.tintRead = clamp(v, 0, 1) }
        if let v = t.tintEdit { panel.tintEdit = clamp(v, 0, 1) }
        if let v = t.radius { panel.cornerRadius = clamp(v, 0, 40) }
        if let v = t.mark { panel.mark = v }
    }

    /// The loose per-note overrides as a treatment (everything but `style`/`slot`).
    private static func treatment(from p: NotePresentation) -> Treatment {
        var t = Treatment()
        t.sheet = p.sheet
        t.accent = p.accent
        t.font = p.font
        t.fontSize = p.fontSize
        t.lineHeight = p.lineHeight
        t.tint = p.tint
        t.tintRead = p.tintRead
        t.tintEdit = p.tintEdit
        t.radius = p.radius
        return t
    }

    /// Map editor settings onto the web bundle's CSS variable contract
    /// (see web/editor/README.md). The bundle's own `:root` defaults are dark;
    /// in light mode we push a full "paper" palette (dark ink on light) BEFORE
    /// the user's explicit `editor.*` colors, which always win. Only non-default
    /// values are sent; the stylesheet covers the rest.
    func editorThemeVars(scheme: AppScheme) -> [String: String] {
        var vars: [String: String] = [
            "--blink-font-size": "\(editor.fontSize)px",
            "--blink-line-height": "\(editor.lineHeight)",
            // A top-left identity mark earns a small content gutter so the
            // chrome never overlaps the first heading or editor source.
            "--blink-pad-x": "\(panel.mark == nil ? editor.paddingX : max(editor.paddingX, 56))px",
            "--blink-pad-y": "\(editor.paddingY)px",
        ]
        if scheme == .light {
            // Light "paper" defaults — dark ink on the now-light glass. Any
            // explicit editor.* color below overrides these per note/theme.
            vars["--blink-text"] = "rgba(28,26,24,0.86)"
            vars["--blink-text-strong"] = "rgba(18,17,16,0.98)"
            vars["--blink-text-muted"] = "rgba(60,56,52,0.55)"
            vars["--blink-accent"] = "#c2410c"  // deepened amber; reads on light
            vars["--blink-code-bg"] = "rgba(20,18,16,0.06)"
            vars["--blink-caret"] = "#c2410c"
            vars["--blink-selection"] = "rgba(194,65,12,0.22)"
        }
        if let v = editor.fontFamily { vars["--blink-font-family"] = v }
        if let v = editor.monoFamily { vars["--blink-mono-family"] = v }
        if let v = editor.titleFamily { vars["--blink-title-family"] = v }
        if let v = panel.background { vars["--blink-sheet-bg"] = v }
        if let v = editor.textColor { vars["--blink-text"] = v }
        if let v = editor.textStrongColor { vars["--blink-text-strong"] = v }
        if let v = editor.textMutedColor {
            vars["--blink-text-muted"] = v
            vars["--blink-quote-text"] = v
        }
        if let v = editor.dimColor { vars["--blink-marker"] = v }
        if let v = editor.borderColor {
            vars["--blink-quote-border"] = v
            vars["--blink-rule"] = v
            vars["--blink-frame"] = v
        }
        if let v = editor.accentColor { vars["--blink-accent"] = v }
        if let v = editor.accentDimColor { vars["--blink-accent-dim"] = v }
        if let v = editor.codeBackground { vars["--blink-code-bg"] = v }
        if let v = editor.codeTextColor { vars["--blink-code-text"] = v }
        if let v = editor.caretColor { vars["--blink-caret"] = v }
        if let v = editor.selectionColor { vars["--blink-selection"] = v }
        if let v = editor.h1Size { vars["--blink-h1-size"] = "\(v)px" }
        if let v = editor.h2Size { vars["--blink-h2-size"] = "\(v)px" }
        if let v = editor.h3Size { vars["--blink-h3-size"] = "\(v)px" }
        return vars
    }
}

/// Clamp a value into `[lo, hi]` — defensive bound for resolved presentation.
private func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
    min(max(v, lo), hi)
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
        let dir = BlinkPaths.home()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = BlinkPaths.config()

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
