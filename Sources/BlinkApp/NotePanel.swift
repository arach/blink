import AppKit
import BlinkCore
import WebKit

/// A floating glass panel that IS a note — Blink's atomic unit.
/// Glass material + a transparent CodeMirror webview; chrome is minimal.
/// Geometry persists via frame autosave (full spatial state lands in M3).
@MainActor
final class NotePanel: NSPanel {
    let noteID: String
    let editor: EditorWebView

    /// Fired for user-initiated mode flips from the titlebar toggle (JS-side
    /// flips arrive via the bridge's modeChanged instead).
    var onUserModeChange: ((String) -> Void)?

    private(set) var currentMode = "edit"
    private var modeButton: NSButton?

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
        contentView = glass

        // Restore remembered geometry (or cascade near center on first open).
        let autosaveName = "blink.note.\(noteID)"
        if !setFrameUsingName(autosaveName) {
            center()
        }
        setFrameAutosaveName(autosaveName)

        addModeToggleAccessory()

        editor.load()
        editor.setContent(initialContent)
        // Focus-on-ready and initial mode are owned by PanelManager (mode-aware).
    }

    /// Nonactivating panels must opt in to becoming key so the editor can type.
    override var canBecomeKey: Bool { true }

    // MARK: - Edit/read mode toggle (titlebar accessory, Hudson Canvas pattern)

    /// Reflect a mode in the toggle without emitting a change (used for the
    /// initial mode and for flips that originated in the webview).
    func reflectMode(_ mode: String) {
        currentMode = mode
        let toRead = mode == "edit"
        modeButton?.image = NSImage(
            systemSymbolName: toRead ? "book" : "pencil",
            accessibilityDescription: toRead ? "Read" : "Edit"
        )
        modeButton?.toolTip = toRead ? "Read (⌘⇧P)" : "Edit (⌘⇧P)"
    }

    private func addModeToggleAccessory() {
        let button = NSButton(
            image: NSImage(systemSymbolName: "book", accessibilityDescription: "Read") ?? NSImage(),
            target: self,
            action: #selector(toggleModeClicked)
        )
        button.isBordered = false
        button.imagePosition = .imageOnly
        button.contentTintColor = .secondaryLabelColor
        button.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(button)
        NSLayoutConstraint.activate([
            button.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8),
            button.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            container.heightAnchor.constraint(equalToConstant: 24),
            container.widthAnchor.constraint(equalToConstant: 30),
        ])

        let accessory = NSTitlebarAccessoryViewController()
        accessory.layoutAttribute = .trailing
        accessory.view = container
        addTitlebarAccessoryViewController(accessory)
        modeButton = button
        reflectMode(currentMode)
    }

    @objc private func toggleModeClicked() {
        let newMode = currentMode == "edit" ? "read" : "edit"
        editor.setMode(newMode)
        reflectMode(newMode)
        if newMode == "edit" {
            makeKey()
            editor.focus()
        }
        onUserModeChange?(newMode)
    }
}
