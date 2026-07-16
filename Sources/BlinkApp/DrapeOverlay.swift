import AppKit

/// A full-screen blur + dim parked one level beneath every note panel: it turns
/// whatever's on the desktop — other apps, a wall of terminals — into a soft,
/// dark stage so the notes read as a set, glass and flat sheets alike. It spans
/// all screens and joins every Space, and it's click-through, so the world
/// underneath stays usable. Driven by config.json → `drape`.
@MainActor
final class DrapeOverlay {
    private let window: NSWindow
    private let blur = NSVisualEffectView()
    private let dimView = NSView()
    /// The alpha the drape fades up to when shown (config.json → drape.opacity):
    /// how present the whole backdrop is. 1 = solid stage, lower = a light veil
    /// the desktop shows through.
    private var targetOpacity: CGFloat = 1

    /// Themable strength, material, and overall presence
    /// (config.json → drape.dim / drape.material / drape.opacity).
    func applyTheme(dim: Double, material: NSVisualEffectView.Material, opacity: Double) {
        dimView.layer?.backgroundColor = NSColor.black.withAlphaComponent(dim).cgColor
        blur.material = material
        targetOpacity = max(0, min(1, CGFloat(opacity)))
    }

    init() {
        let w = NSWindow(
            contentRect: .zero,
            styleMask: [.borderless],
            backing: .buffered,
            defer: true
        )
        w.isOpaque = false
        w.backgroundColor = .clear
        w.ignoresMouseEvents = true
        // One step below the note panels' `.floating` level: behind every note,
        // above every ordinary window (terminals, editors, browsers).
        w.level = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue - 1)
        w.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        w.appearance = NSAppearance(named: .darkAqua)
        w.hasShadow = false

        blur.material = .hudWindow
        blur.blendingMode = .behindWindow
        blur.state = .active

        dimView.wantsLayer = true
        dimView.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.45).cgColor
        dimView.translatesAutoresizingMaskIntoConstraints = false
        blur.addSubview(dimView)
        NSLayoutConstraint.activate([
            dimView.topAnchor.constraint(equalTo: blur.topAnchor),
            dimView.leadingAnchor.constraint(equalTo: blur.leadingAnchor),
            dimView.trailingAnchor.constraint(equalTo: blur.trailingAnchor),
            dimView.bottomAnchor.constraint(equalTo: blur.bottomAnchor),
        ])

        w.contentView = blur
        w.alphaValue = 0
        window = w
    }

    /// Fade the drape in across every screen, behind the notes. Idempotent — a
    /// re-show just refreshes the union frame and keeps it up.
    func show() {
        let union = NSScreen.screens.reduce(NSRect.null) { $0.union($1.frame) }
        guard !union.isNull, !union.isEmpty else { return }
        window.setFrame(union, display: false)
        window.orderFront(nil)
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.24
            window.animator().alphaValue = targetOpacity
        }
    }

    /// Fade out. The window stays allocated but fully transparent and
    /// click-through — no teardown needed between shows.
    func hide() {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.24
            window.animator().alphaValue = 0
        }
    }
}
