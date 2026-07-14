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

    /// Guaranteed-contrast tint between glass and content. Baseline keeps the
    /// panel legible over pale backgrounds without sampling the screen (which
    /// would need Screen Recording permission); edit mode darkens further so
    /// writing gets a focused, higher-contrast surface.
    private let tintLayer = NSView()
    private static let readTint: CGFloat = 0.18
    private static let editTint: CGFloat = 0.28  // subtle — the FocusOverlay dims the surroundings instead

    private var modePillView: NSView?
    private var focusGlyphView: NSView?
    private var isHovered = false

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

        tintLayer.wantsLayer = true
        tintLayer.layer?.backgroundColor = NSColor.black.cgColor
        tintLayer.alphaValue = Self.readTint
        tintLayer.translatesAutoresizingMaskIntoConstraints = false
        glass.addSubview(tintLayer)
        NSLayoutConstraint.activate([
            tintLayer.topAnchor.constraint(equalTo: glass.topAnchor),
            tintLayer.leadingAnchor.constraint(equalTo: glass.leadingAnchor),
            tintLayer.trailingAnchor.constraint(equalTo: glass.trailingAnchor),
            tintLayer.bottomAnchor.constraint(equalTo: glass.bottomAnchor),
        ])

        let webView = editor.webView
        webView.translatesAutoresizingMaskIntoConstraints = false
        glass.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: glass.topAnchor, constant: 28),
            webView.leadingAnchor.constraint(equalTo: glass.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: glass.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: glass.bottomAnchor),
        ])

        // Chrome is earned: both controls fade in on hover.
        // Mode pill (✎/◧) lives top-right in the title bar as an accessory;
        // the focus ring sits alone bottom-right — deliberately not a peer.
        let pill = NSHostingView(
            rootView: ModeToggle(state: modeState) { [weak self] mode in
                self?.selectMode(mode)
            }
        )
        pill.translatesAutoresizingMaskIntoConstraints = false
        let pillContainer = NSView()
        pillContainer.translatesAutoresizingMaskIntoConstraints = false
        pillContainer.addSubview(pill)
        NSLayoutConstraint.activate([
            pill.trailingAnchor.constraint(equalTo: pillContainer.trailingAnchor, constant: -8),
            pill.centerYAnchor.constraint(equalTo: pillContainer.centerYAnchor),
            pillContainer.heightAnchor.constraint(equalToConstant: 26),
            pillContainer.widthAnchor.constraint(equalToConstant: 62),
        ])
        pillContainer.alphaValue = 0
        let accessory = NSTitlebarAccessoryViewController()
        accessory.layoutAttribute = .trailing
        accessory.view = pillContainer
        addTitlebarAccessoryViewController(accessory)
        modePillView = pillContainer

        let focusHost = NSHostingView(
            rootView: FocusGlyph(state: modeState) { [weak self] in
                self?.toggleFocus()
            }
        )
        focusHost.translatesAutoresizingMaskIntoConstraints = false
        focusHost.alphaValue = 0
        glass.addSubview(focusHost)
        NSLayoutConstraint.activate([
            focusHost.trailingAnchor.constraint(equalTo: glass.trailingAnchor, constant: -9),
            focusHost.bottomAnchor.constraint(equalTo: glass.bottomAnchor, constant: -8),
        ])
        focusGlyphView = focusHost

        glass.addTrackingArea(
            NSTrackingArea(
                rect: .zero,
                options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
                owner: self
            )
        )

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

    /// ⌘⇧P flips mode and ⌘. toggles focus — handled natively so they work
    /// even when the webview never had key focus.
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        let key = event.charactersIgnoringModifiers?.lowercased()
        if flags == [.command, .shift], key == "p" {
            selectMode(currentMode == "edit" ? "read" : "edit")
            return true
        }
        if flags == [.command], key == "." {
            toggleFocus()
            return true
        }
        return super.performKeyEquivalent(with: event)
    }

    /// Focus mode: quiet everything around this panel (works in edit or read).
    var focusEnabled: Bool { modeState.focus }

    /// Fired when focus mode flips so the manager can update the overlay.
    var onFocusModeChange: (() -> Void)?

    func toggleFocus() {
        modeState.focus.toggle()
        if modeState.focus { makeKey() }
        updateChromeVisibility()
        onFocusModeChange?()
    }

    // MARK: - Hover-earned chrome

    override func mouseEntered(with event: NSEvent) {
        isHovered = true
        updateChromeVisibility()
    }

    override func mouseExited(with event: NSEvent) {
        isHovered = false
        updateChromeVisibility()
    }

    private func updateChromeVisibility() {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.15
            modePillView?.animator().alphaValue = isHovered ? 1 : 0
            // Active focus leaves a faint trace so the state stays legible.
            focusGlyphView?.animator().alphaValue = isHovered ? 1 : (modeState.focus ? 0.35 : 0)
        }
    }

    // MARK: - Mode

    /// Reflect a mode in the toggle without emitting a change (initial mode,
    /// or flips that originated in the webview). Also drives the focus tint:
    /// editing gets a darker, calmer surface; reading stays airy.
    func reflectMode(_ mode: String) {
        modeState.mode = mode
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.18
            tintLayer.animator().alphaValue = mode == "edit" ? Self.editTint : Self.readTint
        }
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

/// Observable mode + focus state for the SwiftUI toggle overlay.
@MainActor
final class PanelModeState: ObservableObject {
    @Published var mode: String = "edit"
    @Published var focus: Bool = false
}

/// ✎/◧ mode segments; the active segment is lit. Hover-revealed, top-right.
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

/// The focus ring: a small dashed circle, alone in the bottom-right corner —
/// deliberately not a peer of the mode segments. Fills in while focus is on.
private struct FocusGlyph: View {
    @ObservedObject var state: PanelModeState
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Image(systemName: state.focus ? "circle.dashed.inset.filled" : "circle.dashed")
                .font(.system(size: 11))
                .foregroundStyle(state.focus ? .white : .white.opacity(0.5))
        }
        .buttonStyle(.plain)
        .help("Focus — quiet everything else (⌘.)")
    }
}
