// THESIS: A source file should read as a first-class Blink object without pretending to be a note or an IDE.
// OWN-WORLD: Deep translucent glass, compact native provenance chrome, cool signal blue, and CodeMirror ink.
// STORY: Identify the file and trust boundary, inspect anchored code, search or select it, then hand off to the expert editor.
// FIRST VIEWPORT: Path and filename lead; READ ONLY is persistent; anchored lines appear immediately in a spacious line-numbered source plane.
// FORM: A floating resizable companion panel that inherits Blink geometry and material while keeping a distinct renderer-only bridge.

import AppKit
import BlinkCore
import SwiftUI

@MainActor
final class SourcePanel: NSPanel {
    let sourceIdentity: String
    let viewer = SourceViewerWebView()
    private(set) var document: SourceDocument
    private(set) var restoredLocalFrame = false

    private let container = NSView()
    private let glass = NSVisualEffectView()
    private let tint = NSView()
    private let header = SourceDragView()
    private let footer = NSView()
    private let titleField = NSTextField(labelWithString: "")
    private let pathField = NSTextField(labelWithString: "")
    private let languageField = NSTextField(labelWithString: "")
    private let provenanceField = NSTextField(labelWithString: "")
    private let readOnlyField = NSTextField(labelWithString: "READ ONLY")

    init(document: SourceDocument) {
        self.document = document
        sourceIdentity = document.url.path
        let config = BlinkConfigStore.shared.config
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 640, height: 460),
            styleMask: [.borderless, .resizable, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        title = document.displayName
        isFloatingPanel = true
        level = .floating
        hidesOnDeactivate = false
        acceptsMouseMovedEvents = true
        isMovableByWindowBackground = true
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        minSize = NSSize(width: 390, height: 240)
        collectionBehavior = [.moveToActiveSpace, .fullScreenAuxiliary]

        buildSurface(config)
        update(document)

        let autosaveName = "blink.source.\(uuidFromSlug("source:\(sourceIdentity)").uuidString.lowercased())"
        restoredLocalFrame = setFrameUsingName(autosaveName)
        if !restoredLocalFrame { center() }
        setFrameAutosaveName(autosaveName)

        viewer.load()
        viewer.setDocument(document)
        applyTheme(config)
    }

    override var canBecomeKey: Bool { true }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        let key = event.charactersIgnoringModifiers?.lowercased()
        if flags == [.command], key == "w" {
            close()
            return true
        }
        if flags == [.command], key == "f" {
            viewer.showFind()
            return true
        }
        if flags == [.command], key == "k" {
            NotificationCenter.default.post(name: .blinkCommandPaletteRequested, object: self)
            return true
        }
        return super.performKeyEquivalent(with: event)
    }

    override func cancelOperation(_ sender: Any?) {
        close()
    }

    func update(_ next: SourceDocument) {
        document = next
        title = next.displayName
        titleField.stringValue = next.displayName
        pathField.stringValue = next.displayPath
        languageField.stringValue = next.language.uppercased()
        provenanceField.stringValue = Self.provenance(for: next)
        viewer.setDocument(next)
    }

    func applyTheme(_ config: BlinkConfig) {
        let scheme = AppearanceManager.shared.scheme
        appearance = NSAppearance(named: scheme.nsAppearanceName)
        glass.material = NotePanel.glassMaterial(config, scheme)
        let radius = min(max(config.panel.cornerRadius, 8), 22)
        container.layer?.cornerRadius = radius
        glass.layer?.cornerRadius = radius
        tint.layer?.backgroundColor = NotePanel.tintColor(scheme)
        tint.alphaValue = scheme.isDark ? 0.42 : 0.58
        hasShadow = config.panel.shadow

        let strong = scheme.isDark ? NSColor.white.withAlphaComponent(0.94) : NSColor.black.withAlphaComponent(0.88)
        let muted = scheme.isDark ? NSColor.white.withAlphaComponent(0.48) : NSColor.black.withAlphaComponent(0.50)
        titleField.textColor = strong
        pathField.textColor = muted
        languageField.textColor = muted
        provenanceField.textColor = muted
        readOnlyField.textColor = scheme.isDark
            ? NSColor(calibratedRed: 0.62, green: 0.76, blue: 0.97, alpha: 0.8)
            : NSColor(calibratedRed: 0.14, green: 0.33, blue: 0.62, alpha: 0.9)

        var variables = config.editorThemeVars(scheme: scheme)
        variables["--blink-source-font-size"] = "12px"
        variables["--blink-source-line-height"] = "1.62"
        variables["--blink-source-color-scheme"] = scheme.isDark ? "dark" : "light"
        if scheme.isDark {
            variables["--blink-source-anchor"] = "rgba(89,137,211,0.16)"
            variables["--blink-source-match"] = "rgba(214,174,91,0.24)"
            variables["--blink-source-panel"] = "rgba(12,17,28,0.96)"
            variables["--blink-source-rule"] = "rgba(255,255,255,0.12)"
            variables["--blink-source-keyword"] = "#8db8ff"
            variables["--blink-source-type"] = "#7fd7d0"
            variables["--blink-source-function"] = "#d8b5ff"
            variables["--blink-source-string"] = "#9bd49b"
            variables["--blink-source-literal"] = "#e7bd86"
            variables["--blink-source-meta"] = "#b8c7df"
        } else {
            variables["--blink-source-anchor"] = "rgba(45,93,175,0.12)"
            variables["--blink-source-match"] = "rgba(161,112,25,0.18)"
            variables["--blink-source-panel"] = "rgba(248,247,244,0.98)"
            variables["--blink-source-rule"] = "rgba(24,22,20,0.14)"
            variables["--blink-source-keyword"] = "#245ba7"
            variables["--blink-source-type"] = "#16756f"
            variables["--blink-source-function"] = "#7650a5"
            variables["--blink-source-string"] = "#39743d"
            variables["--blink-source-literal"] = "#9a5a19"
            variables["--blink-source-meta"] = "#4e607a"
        }
        viewer.setTheme(variables)
    }

    private func buildSurface(_ config: BlinkConfig) {
        container.wantsLayer = true
        container.layer?.masksToBounds = true
        contentView = container

        glass.blendingMode = .behindWindow
        glass.state = .active
        glass.wantsLayer = true
        glass.layer?.masksToBounds = true
        pin(glass, to: container)

        tint.wantsLayer = true
        pin(tint, to: container)

        header.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(header)
        footer.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(footer)

        let separatorTop = separator()
        header.addSubview(separatorTop)
        let separatorBottom = separator()
        footer.addSubview(separatorBottom)

        let close = symbolButton("xmark", help: "Close source", action: #selector(closeSource))
        let open = symbolButton("arrow.up.forward.app", help: "Open in default editor", action: #selector(openInEditor))
        let reveal = symbolButton("folder", help: "Reveal in Finder", action: #selector(revealInFinder))
        for button in [close, open, reveal] { header.addSubview(button) }

        titleField.font = .systemFont(ofSize: 12, weight: .semibold)
        titleField.lineBreakMode = .byTruncatingMiddle
        pathField.font = .monospacedSystemFont(ofSize: 10, weight: .medium)
        pathField.lineBreakMode = .byTruncatingMiddle
        readOnlyField.font = .monospacedSystemFont(ofSize: 10, weight: .semibold)
        readOnlyField.alignment = .right
        for field in [titleField, pathField, readOnlyField] {
            field.translatesAutoresizingMaskIntoConstraints = false
            header.addSubview(field)
        }

        languageField.font = .monospacedSystemFont(ofSize: 10, weight: .semibold)
        provenanceField.font = .monospacedSystemFont(ofSize: 10, weight: .medium)
        provenanceField.alignment = .right
        for field in [languageField, provenanceField] {
            field.translatesAutoresizingMaskIntoConstraints = false
            footer.addSubview(field)
        }

        let webView = viewer.webView
        webView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(webView)

        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: container.topAnchor),
            header.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            header.heightAnchor.constraint(equalToConstant: 49),
            footer.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            footer.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            footer.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            footer.heightAnchor.constraint(equalToConstant: 25),
            webView.topAnchor.constraint(equalTo: header.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: footer.topAnchor),

            close.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 11),
            close.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            close.widthAnchor.constraint(equalToConstant: 25),
            close.heightAnchor.constraint(equalToConstant: 25),
            titleField.leadingAnchor.constraint(equalTo: close.trailingAnchor, constant: 10),
            titleField.topAnchor.constraint(equalTo: header.topAnchor, constant: 9),
            titleField.trailingAnchor.constraint(lessThanOrEqualTo: readOnlyField.leadingAnchor, constant: -10),
            pathField.leadingAnchor.constraint(equalTo: titleField.leadingAnchor),
            pathField.topAnchor.constraint(equalTo: titleField.bottomAnchor, constant: 3),
            pathField.trailingAnchor.constraint(lessThanOrEqualTo: readOnlyField.leadingAnchor, constant: -10),
            readOnlyField.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            readOnlyField.trailingAnchor.constraint(equalTo: reveal.leadingAnchor, constant: -9),
            reveal.trailingAnchor.constraint(equalTo: open.leadingAnchor, constant: -3),
            reveal.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            reveal.widthAnchor.constraint(equalToConstant: 25),
            reveal.heightAnchor.constraint(equalToConstant: 25),
            open.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -10),
            open.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            open.widthAnchor.constraint(equalToConstant: 25),
            open.heightAnchor.constraint(equalToConstant: 25),

            separatorTop.leadingAnchor.constraint(equalTo: header.leadingAnchor),
            separatorTop.trailingAnchor.constraint(equalTo: header.trailingAnchor),
            separatorTop.bottomAnchor.constraint(equalTo: header.bottomAnchor),
            separatorTop.heightAnchor.constraint(equalToConstant: 1),
            separatorBottom.leadingAnchor.constraint(equalTo: footer.leadingAnchor),
            separatorBottom.trailingAnchor.constraint(equalTo: footer.trailingAnchor),
            separatorBottom.topAnchor.constraint(equalTo: footer.topAnchor),
            separatorBottom.heightAnchor.constraint(equalToConstant: 1),
            languageField.leadingAnchor.constraint(equalTo: footer.leadingAnchor, constant: 13),
            languageField.centerYAnchor.constraint(equalTo: footer.centerYAnchor, constant: 1),
            provenanceField.trailingAnchor.constraint(equalTo: footer.trailingAnchor, constant: -13),
            provenanceField.centerYAnchor.constraint(equalTo: footer.centerYAnchor, constant: 1),
            provenanceField.leadingAnchor.constraint(greaterThanOrEqualTo: languageField.trailingAnchor, constant: 12),
        ])
    }

    private func pin(_ view: NSView, to parent: NSView) {
        view.translatesAutoresizingMaskIntoConstraints = false
        parent.addSubview(view)
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: parent.topAnchor),
            view.leadingAnchor.constraint(equalTo: parent.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: parent.trailingAnchor),
            view.bottomAnchor.constraint(equalTo: parent.bottomAnchor),
        ])
    }

    private func separator() -> NSView {
        let view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.11).cgColor
        return view
    }

    private func symbolButton(_ symbol: String, help: String, action: Selector) -> NSButton {
        let image = NSImage(systemSymbolName: symbol, accessibilityDescription: help) ?? NSImage()
        let button = NSButton(image: image, target: self, action: action)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.isBordered = false
        button.imageScaling = .scaleProportionallyDown
        button.contentTintColor = .secondaryLabelColor
        button.toolTip = help
        button.setAccessibilityLabel(help)
        return button
    }

    @objc private func closeSource() { close() }
    @objc private func openInEditor() { NSWorkspace.shared.open(document.url) }
    @objc private func revealInFinder() {
        NSWorkspace.shared.activateFileViewerSelecting([document.url])
    }

    private static func provenance(for document: SourceDocument) -> String {
        var pieces: [String] = []
        if let lines = document.lines {
            pieces.append(lines.start == lines.end ? "L\(lines.start)" : "L\(lines.start)–\(lines.end)")
        }
        if let revision = document.revision { pieces.append(revision) }
        return pieces.joined(separator: " · ")
    }
}

private final class SourceDragView: NSView {
    override var mouseDownCanMoveWindow: Bool { true }
}
