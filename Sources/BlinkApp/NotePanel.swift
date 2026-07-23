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
    /// The sheet template this panel renders (config default or per-note
    /// `blink:` override) — resolved from `notePresentation` at open time and on
    /// every hot reload. ("sheetTemplate", not "sheet" — NSWindow owns `sheet: Bool`.)
    private(set) var sheetTemplate: String
    /// This note's presentation intent (the `blink:` block, plus any legacy
    /// `sheet:` alias merged in by PanelManager). The single input to
    /// `config.resolved(for:)`, so open-time and hot-reload theming agree.
    private let notePresentation: NotePresentation

    /// Fired for user-initiated mode flips from the native toggle or ⌘⇧P
    /// (JS-side flips arrive via the bridge's modeChanged instead).
    var onUserModeChange: ((String) -> Void)?

    let modeState = PanelModeState()
    var currentMode: String { modeState.mode }

    /// Guaranteed-contrast tint between glass and content. Baseline keeps the
    /// panel legible over pale backgrounds without sampling the screen (which
    /// would need Screen Recording permission); edit mode darkens further so
    /// writing gets a focused, higher-contrast surface. Values are themable
    /// via config.json.
    private let tintLayer = NSView()
    private let glassView = NSVisualEffectView()
    /// Plain root content view; the glass material is a sibling behind the
    /// content so flat sheets can hide the glass without hiding the webview.
    private let container = NSView()
    private var readTint: CGFloat
    private var editTint: CGFloat

    private var modePillView: NSView?
    private var noteIDView: NSView?
    private var focusGlyphView: NSView?
    private var closeButtonView: NSView?
    private var isHovered = false

    init(
        noteID: String,
        initialContent: String,
        title: String,
        presentation: NotePresentation = NotePresentation()
    ) {
        self.noteID = noteID
        self.editor = EditorWebView()
        self.notePresentation = presentation

        // Resolve this note's presentation onto the config once, up front — the
        // same reducer hot reload uses, so per-note sheet/tint/radius/theme are
        // consistent everywhere.
        let theme = BlinkConfigStore.shared.config.resolved(for: presentation)
        self.sheetTemplate = theme.panel.sheet
        self.readTint = theme.panel.tintRead
        self.editTint = theme.panel.tintEdit

        super.init(
            contentRect: NSRect(
                x: 0, y: 0,
                width: theme.panel.defaultWidth, height: theme.panel.defaultHeight
            ),
            // Truly borderless: no titlebar, no reserved band — the note is a
            // page, not an OS window. `.resizable` keeps native edge-resizing;
            // dragging moves to an invisible strip along the top edge; close
            // lives on the hover ✕ and ⌘W (close(), not performClose — there is
            // no close button to simulate).
            styleMask: [.borderless, .resizable, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        isFloatingPanel = true
        level = .floating
        hidesOnDeactivate = false
        isMovableByWindowBackground = true
        // Title never renders (borderless) but names the window for AX/scripts.
        self.title = title
        isOpaque = false
        backgroundColor = .clear
        minSize = NSSize(width: 260, height: 120)
        // Blink's glass is dark regardless of system appearance — the editor
        // typography (white on transparent) and the studies assume it.
        appearance = NSAppearance(named: .darkAqua)

        // Plain container is the contentView; the glass material is a sibling
        // BEHIND the content, not the content root. This lets flat sheets hide
        // the glass (and tint) independently while the webView and hover chrome
        // stay live — hiding the visual-effect view would take its subviews
        // with it, so it must never be an ancestor of the content.
        let glass = glassView
        let container = self.container
        container.wantsLayer = true
        container.layer?.cornerRadius = theme.panel.cornerRadius
        container.layer?.masksToBounds = true

        glass.material = theme.panel.visualEffectMaterial
        glass.blendingMode = .behindWindow
        glass.state = .active
        glass.wantsLayer = true
        glass.layer?.cornerRadius = theme.panel.cornerRadius
        glass.layer?.masksToBounds = true
        glass.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(glass)
        NSLayoutConstraint.activate([
            glass.topAnchor.constraint(equalTo: container.topAnchor),
            glass.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            glass.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            glass.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        hasShadow = theme.panel.shadow

        tintLayer.wantsLayer = true
        tintLayer.layer?.backgroundColor = NSColor.black.cgColor
        tintLayer.alphaValue = readTint
        tintLayer.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(tintLayer)
        NSLayoutConstraint.activate([
            tintLayer.topAnchor.constraint(equalTo: container.topAnchor),
            tintLayer.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            tintLayer.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            tintLayer.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        let webView = editor.webView
        webView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        // Invisible drag strip along the top edge: the webview consumes clicks
        // everywhere, so this is the panel's move gesture (the old titlebar's
        // one useful job, kept without its reserved band). Sits under the
        // corner chrome in z so ✕/pill clicks win. Height spans the empty top
        // margin above the first line — 24pt matches the reader's content
        // padding, so the grab band fills the band over the text (a bigger,
        // still-thin target) without covering the first line itself.
        let drag = DragHandle()
        drag.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(drag)
        NSLayoutConstraint.activate([
            drag.topAnchor.constraint(equalTo: container.topAnchor),
            drag.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            drag.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            drag.heightAnchor.constraint(equalToConstant: 24),
        ])

        // Chrome is earned: controls fade in on hover, floating IN the former
        // title area — top corners, over the content, no reserved band.
        // Mode pill (✎/◧) top-right; the focus ring sits alone bottom-right —
        // deliberately not a peer.
        let pill = NSHostingView(
            rootView: ModeToggle(state: modeState) { [weak self] mode in
                self?.selectMode(mode)
            }
        )
        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.alphaValue = 0
        container.addSubview(pill)
        NSLayoutConstraint.activate([
            pill.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8),
            pill.topAnchor.constraint(equalTo: container.topAnchor, constant: 8),
        ])
        modePillView = pill

        // Edit mode exposes the note's stable slug — the same identifier the
        // CLI and agent APIs accept. Keep it quietly visible in the top band so
        // the user can name the exact note/window in a prompt; clicking copies
        // the untruncated value. Read mode remains presentation-clean.
        let noteIDHost = NSHostingView(
            rootView: NoteIdentifierBadge(noteID: noteID) { [weak self] in
                self?.copyNoteID()
            }
        )
        noteIDHost.translatesAutoresizingMaskIntoConstraints = false
        noteIDHost.alphaValue = 0.55
        container.addSubview(noteIDHost)
        NSLayoutConstraint.activate([
            noteIDHost.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            noteIDHost.topAnchor.constraint(equalTo: container.topAnchor, constant: 6),
            noteIDHost.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 34),
            noteIDHost.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -68),
        ])
        noteIDView = noteIDHost

        // Close glyph (✕) mirrors the mode pill: hover-earned, top-LEFT, in the
        // title area. This (and ⌘W) is how a note is dismissed — close(), which
        // still runs the windowWillClose flush path.
        let closeHost = NSHostingView(
            rootView: CloseGlyph { [weak self] in
                self?.close()
            }
        )
        closeHost.translatesAutoresizingMaskIntoConstraints = false
        closeHost.alphaValue = 0
        container.addSubview(closeHost)
        NSLayoutConstraint.activate([
            closeHost.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 8),
            closeHost.topAnchor.constraint(equalTo: container.topAnchor, constant: 8),
        ])
        closeButtonView = closeHost

        let focusHost = NSHostingView(
            rootView: FocusGlyph(state: modeState) { [weak self] in
                self?.toggleFocus()
            }
        )
        focusHost.translatesAutoresizingMaskIntoConstraints = false
        focusHost.alphaValue = 0
        container.addSubview(focusHost)
        NSLayoutConstraint.activate([
            focusHost.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -9),
            focusHost.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -8),
        ])
        focusGlyphView = focusHost

        container.addTrackingArea(
            NSTrackingArea(
                rect: .zero,
                options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
                owner: self
            )
        )

        contentView = container

        // Restore remembered geometry (or cascade near center on first open).
        let autosaveName = "blink.note.\(noteID)"
        if !setFrameUsingName(autosaveName) {
            center()
        }
        setFrameAutosaveName(autosaveName)

        // Derive the panel's surface from the sheet template: glass-visible for
        // glass/card, fully flat (no glass, no shadow) for the cut-out sheets.
        applySheetAppearance(theme)

        editor.load()
        editor.setContent(initialContent)
        editor.setSheet(sheetTemplate)
        // Focus-on-ready and initial mode are owned by PanelManager (mode-aware).
    }

    /// True for the flat sheets that put ink straight on the wallpaper —
    /// no native glass, no window shadow (a shadow under a transparent
    /// rectangle reads as a ghost box).
    private static func isFlatSheet(_ name: String) -> Bool {
        switch name {
        case "dotted", "bracket", "marginalia": true
        default: false  // glass, card, and any unknown name fall back to glass
        }
    }

    /// Reconcile the native surface with `sheetTemplate`.
    ///
    /// - glass/card: the glass material and tint stay ON (card draws its own
    ///   near-opaque paper in the web layer, but the glass behind it is cheap
    ///   and harmless). Corner radius + shadow come from config.
    /// - dotted/bracket/marginalia: hide the glass and tint layers entirely and
    ///   drop the window shadow — the web layer paints everything on a fully
    ///   transparent page.
    private func applySheetAppearance(_ config: BlinkConfig) {
        let flat = Self.isFlatSheet(sheetTemplate)
        glassView.isHidden = flat
        tintLayer.isHidden = flat
        if flat {
            hasShadow = false
            // No rounded clip over a transparent page — the sheet's own frame
            // (drawn by the web layer) defines the shape.
            container.layer?.cornerRadius = 0
        } else {
            glassView.material = config.panel.visualEffectMaterial
            glassView.layer?.cornerRadius = config.panel.cornerRadius
            container.layer?.cornerRadius = config.panel.cornerRadius
            hasShadow = config.panel.shadow
        }
    }

    /// Nonactivating borderless panels must opt in to becoming key so the
    /// editor can type.
    override var canBecomeKey: Bool { true }

    /// Mode flip (⌘⇧P) and focus (⌘.) — chords come from config so they follow
    /// hot reloads. Handled natively so they work even when the webview never
    /// had key focus. ⌘W closes the panel (LSUIElement apps have no Close menu
    /// item to route it); the close path flushes pending saves as always.
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        let hotkeys = BlinkConfigStore.shared.config.hotkeys
        if let chord = KeyChord.parse(hotkeys.toggleMode), chord.matches(event) {
            selectMode(currentMode == "edit" ? "read" : "edit")
            return true
        }
        if let chord = KeyChord.parse(hotkeys.focus), chord.matches(event) {
            toggleFocus()
            return true
        }
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        if flags == [.command], event.charactersIgnoringModifiers?.lowercased() == "w" {
            close()  // borderless: performClose would beep (no close button)
            return true
        }
        return super.performKeyEquivalent(with: event)
    }

    /// Esc quiets things down a step: leave edit for read, then drop focus mode.
    override func cancelOperation(_ sender: Any?) {
        if currentMode == "edit" {
            selectMode("read")
        } else if focusEnabled {
            toggleFocus()
        }
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
            closeButtonView?.animator().alphaValue = isHovered ? 1 : 0
            noteIDView?.animator().alphaValue = currentMode == "edit"
                ? (isHovered ? 1 : 0.55)
                : 0
            // Active focus leaves a faint trace so the state stays legible.
            focusGlyphView?.animator().alphaValue = isHovered ? 1 : (modeState.focus ? 0.35 : 0)
        }
    }

    // MARK: - Mode

    /// Reflect a mode in the toggle without emitting a change (initial mode,
    /// or flips that originated in the webview). On glass sheets it also drives
    /// the focus tint: editing gets a darker, calmer surface; reading stays
    /// airy. Flat sheets have no tint layer, so the flip is a no-op there
    /// (their mode contrast comes from the sheet's own CSS if needed).
    func reflectMode(_ mode: String) {
        modeState.mode = mode
        noteIDView?.isHidden = mode != "edit"
        noteIDView?.alphaValue = mode == "edit" ? (isHovered ? 1 : 0.55) : 0
        guard !Self.isFlatSheet(sheetTemplate) else { return }
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.18
            tintLayer.animator().alphaValue = mode == "edit" ? editTint : readTint
        }
    }

    /// Re-apply themable visuals after a config change (hot reload).
    func applyTheme(_ config: BlinkConfig) {
        // Resolve the incoming config through this note's presentation, so per-note
        // sheet/tint/radius/theme survive a global hot reload: a note with its own
        // `blink.sheet` always resolves back to it, a note without one follows the
        // new global sheet.
        let theme = config.resolved(for: notePresentation)
        readTint = theme.panel.tintRead
        editTint = theme.panel.tintEdit

        if theme.panel.sheet != sheetTemplate {
            sheetTemplate = theme.panel.sheet
            editor.setSheet(sheetTemplate)
        }

        // Re-derive the native surface (glass vs flat, material, radius, shadow)
        // for the current sheet, then set the mode tint only where it applies.
        applySheetAppearance(theme)
        if !Self.isFlatSheet(sheetTemplate) {
            tintLayer.alphaValue = currentMode == "edit" ? editTint : readTint
        }
        editor.setTheme(theme.editorThemeVars)
    }

    // MARK: - Arrival: motion signature

    /// True when the OS asks for reduced motion — treated as `"none"` (spec).
    static var reduceMotion: Bool {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    }

    /// Resolve the effective entrance for this panel. `draw` only makes sense on
    /// flat sheets (there's a frame to stroke); on glass/card it falls back to
    /// `shimmer`. Reduce Motion and a disabled config collapse to `none`.
    private func effectiveEntrance(_ motion: BlinkConfig.Motion) -> String {
        guard motion.enabled, !Self.reduceMotion else { return "none" }
        if motion.entrance == "draw", !Self.isFlatSheet(sheetTemplate) {
            return "shimmer"
        }
        return motion.entrance
    }

    /// Land this panel with its configured entrance. The window animates its own
    /// alpha 0→1 over `durationMs` (and, for `drop`, drifts down from 8pt above
    /// with a spring-like settle); the web layer choreographs the content via
    /// `enter(kind)`. `none` (and Reduce Motion / disabled) is today's instant
    /// show. Safe to call before `orderFront`; the caller orders the panel in.
    ///
    /// `fromOffset` nudges the pre-animation origin (used by the blink's
    /// compass reveal) on top of any per-kind drift.
    func animateEntrance(motion: BlinkConfig.Motion, fromOffset: CGSize = .zero) {
        // If an exhale left the frame drifted, snap back to the resting home
        // before we read the target — the reveal must land the panel exactly
        // where it lives, never at a drifted position.
        if let home = blinkHomeFrame {
            setFrame(home, display: false)
            blinkHomeFrame = nil
        }

        let kind = effectiveEntrance(motion)
        editor.enter(kind, durationMs: motion.durationMs)

        guard kind != "none" else {
            // Instant: assigning alpha directly interrupts any in-flight implicit
            // animation, so nothing is left partial.
            alphaValue = 1
            return
        }

        let target = frame
        let dur = max(0.05, motion.durationMs / 1000)
        // `drop` starts 8pt above and scaled-feeling (we approximate the scale
        // with the frame drift + content fade; a window can't cheaply scale its
        // own backing). Any compass offset from the blink adds on top.
        let dropDrift: CGFloat = kind == "drop" ? 8 : 0
        let start = NSRect(
            x: target.origin.x + fromOffset.width,
            y: target.origin.y + dropDrift + fromOffset.height,
            width: target.width, height: target.height
        )

        alphaValue = 0
        if start != target {
            setFrame(start, display: false)
        }

        NSAnimationContext.runAnimationGroup { context in
            context.duration = dur
            // A gentle overshoot easing so `drop` reads as a settle, not a slide.
            context.timingFunction = kind == "drop"
                ? CAMediaTimingFunction(controlPoints: 0.2, 0.9, 0.3, 1.25)
                : CAMediaTimingFunction(name: .easeOut)
            animator().alphaValue = 1
            if start != target {
                animator().setFrame(target, display: true)
            }
        } completionHandler: { [weak self] in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.alphaValue = 1
                self.setFrame(target, display: false)
            }
        }
    }

    /// The resting frame captured at the start of a blink exhale, so a reveal
    /// (or the exhale's own reset) can restore the panel to exactly where it
    /// lived. The drift is purely cosmetic and NEVER touches autosaved geometry.
    private var blinkHomeFrame: NSRect?

    /// Fade out for the blink's synchronized exhale: alpha → 0 and a drift toward
    /// `direction` over `durationMs`. The caller's `finish` closure decides
    /// whether to `orderOut` — a rapid re-toggle can supersede this exhale, in
    /// which case the panel must stay visible for the incoming reveal instead.
    func animateExhale(
        direction: CGSize, durationMs: Double, then finish: @escaping @MainActor () -> Void
    ) {
        let home = frame
        blinkHomeFrame = home
        let dur = max(0.05, durationMs / 1000)
        NSAnimationContext.runAnimationGroup { context in
            context.duration = dur
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            animator().alphaValue = 0
            animator().setFrame(home.offsetBy(dx: direction.width, dy: direction.height), display: true)
        } completionHandler: {
            MainActor.assumeIsolated { finish() }
        }
    }

    /// Restore a panel to its resting frame + full alpha after the exhale has
    /// ordered it out, ready for the next reveal. Never touches autosaved frame.
    func resetAfterExhale() {
        if let home = blinkHomeFrame {
            setFrame(home, display: false)
            blinkHomeFrame = nil
        }
        alphaValue = 1
    }

    /// Reusable "slot lock" primitive: animate to `frame` with a 2pt
    /// overshoot-and-settle so a programmatic placement reads as snapping into
    /// its slot rather than gliding. Persists the new frame in the completion.
    /// (GridOverlay draws its own placement today; this is here for it to adopt
    /// later — the spec forbids modifying GridOverlay to use it now.)
    func animateLock(to frame: NSRect) {
        // Overshoot slightly past the target along the travel direction, then
        // settle back. Direction derives from where we're coming from.
        let current = self.frame
        let dx = frame.minX - current.minX
        let dy = frame.minY - current.minY
        let len = max(hypot(dx, dy), 0.001)
        let overshoot: CGFloat = 2
        let past = NSRect(
            x: frame.minX + dx / len * overshoot,
            y: frame.minY + dy / len * overshoot,
            width: frame.width, height: frame.height
        )
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.17
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            animator().setFrame(past, display: true)
        } completionHandler: { [weak self] in
            MainActor.assumeIsolated {
                guard let self else { return }
                NSAnimationContext.runAnimationGroup { settle in
                    settle.duration = 0.11
                    settle.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                    self.animator().setFrame(frame, display: true)
                } completionHandler: {
                    MainActor.assumeIsolated {
                        self.setFrame(frame, display: false)
                        self.saveFrame(usingName: "blink.note.\(self.noteID)")
                    }
                }
            }
        }
    }

    // MARK: - Focus recede

    /// Whether this panel is currently receded (a non-key panel while focus mode
    /// is active). Recede is a layer TRANSFORM + alpha only — it must never touch
    /// the frame, or geometry persistence would drift.
    private(set) var isReceded = false

    /// Push this panel back a hair: contentView layer scales to 0.985 and dims to
    /// 0.92, giving the focused note visible depth over its peers. Transform-only,
    /// so autosaved geometry is untouched. No-op when motion is disabled or
    /// Reduce Motion is on.
    func recede(enabled: Bool) {
        guard enabled, !Self.reduceMotion else { return }
        guard !isReceded else { return }
        isReceded = true
        applyRecede(scale: 0.985, alpha: 0.92)
    }

    /// Restore a receded panel to its resting transform/alpha (focus off, or this
    /// panel became key). Always safe to call.
    func unrecede() {
        guard isReceded else { return }
        isReceded = false
        applyRecede(scale: 1.0, alpha: 1.0)
    }

    private func applyRecede(scale: CGFloat, alpha: CGFloat) {
        guard let layer = container.layer else { return }
        // Scale about the view's center so the recede reads as depth, not a
        // corner shrink. Anchor + position math keeps the layer put.
        let bounds = container.bounds
        layer.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        layer.position = CGPoint(x: bounds.midX, y: bounds.midY)
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.2
            context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            context.allowsImplicitAnimation = true
            layer.transform = CATransform3DMakeScale(scale, scale, 1)
            container.animator().alphaValue = alpha
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

    /// Copy the exact agent-facing id, then return keyboard focus to the editor
    /// so identifying a note never interrupts the writing flow.
    private func copyNoteID() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(noteID, forType: .string)
        guard currentMode == "edit" else { return }
        makeKey()
        makeFirstResponder(editor.webView)
        editor.focus()
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

/// The note/window handle exposed only while editing. It shows the stable slug
/// agents already use (`blink write <id>`, panel APIs) and copies the full value
/// even when a narrow panel has to truncate the middle visually.
private struct NoteIdentifierBadge: View {
    let noteID: String
    var onCopy: () -> Void
    @State private var copied = false

    var body: some View {
        Button {
            onCopy()
            withAnimation(.easeOut(duration: 0.12)) { copied = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                withAnimation(.easeOut(duration: 0.12)) { copied = false }
            }
        } label: {
            HStack(spacing: 4) {
                Text(copied ? "copied" : "id")
                    .foregroundStyle(Color.primary.opacity(0.55))
                Text(noteID)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .font(.system(size: 9, weight: .medium, design: .monospaced))
            .foregroundStyle(Color.primary.opacity(0.82))
            .padding(.horizontal, 6)
            .frame(height: 18)
            .background(Color.primary.opacity(0.07), in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .help("Note ID: \(noteID) — click to copy for an agent")
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

/// Invisible top-edge strip that moves the window — the webview eats clicks
/// everywhere else, so this is the drag surface (the titlebar's ghost, minus
/// the band).
private final class DragHandle: NSView {
    override func mouseDown(with event: NSEvent) {
        window?.performDrag(with: event)
    }
}

/// The close glyph: a small ✕ alone in the top-left corner, mirroring the mode
/// pill top-right. Hover-revealed. Replaces the hidden traffic-light close.
private struct CloseGlyph: View {
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Image(systemName: "xmark")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.white.opacity(0.55))
                .frame(width: 18, height: 18)
                .background(.white.opacity(0.08), in: Circle())
        }
        .buttonStyle(.plain)
        .help("Close (⌘W)")
    }
}
