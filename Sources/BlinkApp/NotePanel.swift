import AppKit
import BlinkCore
import SwiftUI
import WebKit

/// A floating glass panel that IS a note — Blink's atomic unit.
/// Glass material + a transparent CodeMirror/reader webview; chrome is minimal.
/// Geometry persists via frame autosave (full spatial state lands in M3).
@MainActor
final class NotePanel: NSPanel {
    let noteID: String
    let editor: EditorWebView

    /// Fired for user-initiated mode flips from the native toggle or ⌘⇧P
    /// (JS-side flips arrive via the bridge's modeChanged instead).
    var onUserModeChange: ((String) -> Void)?

    let modeState = PanelModeState()
    var currentMode: String { modeState.mode }

    init(noteID: String, initialContent: String, title: String) {
        self.noteID = noteID
        self.editor = EditorWebView()

        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 340),
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        isFloatingPanel = true
        level = .floating
        hidesOnDeactivate = false
        isMovableByWindowBackground = true
        titlebarAppearsTransparent = true
        titleVisibility = .visible
        self.title = title
        isOpaque = false
        backgroundColor = .clear
        minSize = NSSize(width: 260, height: 120)
        // Blink's glass is dark regardless of system appearance — the editor
        // typography (white on transparent) and the studies assume it.
        appearance = NSAppearance(named: .darkAqua)

        // Glass under a transparent editor.
        let glass = NSVisualEffectView()
        glass.material = .hudWindow
        glass.blendingMode = .behindWindow
        glass.state = .active
        glass.wantsLayer = true
        glass.layer?.cornerRadius = 12
        glass.layer?.masksToBounds = true

        let webView = editor.webView
        webView.translatesAutoresizingMaskIntoConstraints = false
        glass.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: glass.topAnchor, constant: 28),
            webView.leadingAnchor.constraint(equalTo: glass.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: glass.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: glass.bottomAnchor),
        ])

        // Always-visible mode control: ✎/◧ segments, bottom-right, active
        // segment lit — you can always SEE which mode a panel is in.
        let toggle = NSHostingView(
            rootView: ModeToggle(state: modeState) { [weak self] mode in
                self?.selectMode(mode)
            }
        )
        toggle.translatesAutoresizingMaskIntoConstraints = false
        glass.addSubview(toggle)
        NSLayoutConstraint.activate([
            toggle.trailingAnchor.constraint(equalTo: glass.trailingAnchor, constant: -8),
            toggle.bottomAnchor.constraint(equalTo: glass.bottomAnchor, constant: -8),
        ])

        contentView = glass

        // Restore remembered geometry (or cascade near center on first open).
        let autosaveName = "blink.note.\(noteID)"
        if !setFrameUsingName(autosaveName) {
            center()
        }
        setFrameAutosaveName(autosaveName)

        editor.load()
        editor.setContent(initialContent)
        // Focus-on-ready and initial mode are owned by PanelManager (mode-aware).
    }

    /// Nonactivating panels must opt in to becoming key so the editor can type.
    override var canBecomeKey: Bool { true }

    /// ⌘⇧P flips mode natively — reliable even when the webview never had
    /// key focus (the in-webview keymap only works after a click into it).
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if event.modifierFlags.intersection(.deviceIndependentFlagsMask) == [.command, .shift],
           event.charactersIgnoringModifiers?.lowercased() == "p" {
            selectMode(currentMode == "edit" ? "read" : "edit")
            return true
        }
        return super.performKeyEquivalent(with: event)
    }

    // MARK: - Mode

    /// Reflect a mode in the toggle without emitting a change (initial mode,
    /// or flips that originated in the webview).
    func reflectMode(_ mode: String) {
        modeState.mode = mode
    }

    /// User-initiated mode change from native chrome (toggle click or ⌘⇧P).
    func selectMode(_ mode: String) {
        guard mode != modeState.mode else { return }
        editor.setMode(mode)
        reflectMode(mode)
        if mode == "edit" {
            makeKey()
            makeFirstResponder(editor.webView)
            editor.focus()
        }
        onUserModeChange?(mode)
    }
}

/// Observable mode for the SwiftUI toggle overlay.
@MainActor
final class PanelModeState: ObservableObject {
    @Published var mode: String = "edit"
}

/// Two-segment ✎/◧ control; the active segment is lit.
private struct ModeToggle: View {
    @ObservedObject var state: PanelModeState
    var onSelect: (String) -> Void

    var body: some View {
        HStack(spacing: 2) {
            segment(icon: "pencil", mode: "edit", help: "Edit (⌘⇧P)")
            segment(icon: "book", mode: "read", help: "Read (⌘⇧P)")
        }
        .padding(2)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
    }

    private func segment(icon: String, mode: String, help: String) -> some View {
        Button {
            onSelect(mode)
        } label: {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(state.mode == mode ? .white : .white.opacity(0.4))
                .frame(width: 22, height: 18)
                .background(
                    state.mode == mode ? Color.white.opacity(0.18) : .clear,
                    in: RoundedRectangle(cornerRadius: 4)
                )
        }
        .buttonStyle(.plain)
        .help(help)
    }
}
