import AppKit
import BlinkCore
import HudsonObservability
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSPopoverDelegate {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover?
    private var contextMenu: NSMenu!
    private var panelManager: PanelManager!
    private var model: AppModel!
    private let log = HudLogger(category: "blink.app")

    static func notesDirectory() -> URL {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        return appSupport.appendingPathComponent("Blink/Notes", isDirectory: true)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        HudLoggerSinks.install(HudLogStore.shared)
        log.info("[BLINK] booted", metadata: ["milestone": "M1"])
        NSApp.setActivationPolicy(.accessory)

        let store = NoteStore(fileStore: NoteFileStore(directory: Self.notesDirectory()))
        panelManager = PanelManager(store: store)
        model = AppModel(store: store, panelManager: panelManager)
        Task {
            await panelManager.restoreSession()
            await model.start()
        }

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            let image = NSImage(systemSymbolName: "eye", accessibilityDescription: "Blink")
            image?.isTemplate = true
            button.image = image
            button.toolTip = "Blink — Hyper+N for a new note"
            button.target = self
            button.action = #selector(statusItemClicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        contextMenu = buildContextMenu()

        HotkeyManager.shared.register(
            id: 1,
            keyCode: CarbonKeyCode.n,
            modifiers: CarbonModifier.hyper
        ) { [weak self] in
            self?.newNote()
        }
    }

    /// Flush pending note saves before quitting — never drop edits (v1 lesson).
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        panelManager.prepareForTermination()
        Task {
            await panelManager.flushAll()
            sender.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }

    func applicationWillTerminate(_ notification: Notification) {
        HotkeyManager.shared.unregisterAll()
    }

    private func newNote() {
        log.info("[BLINK] new-note requested", metadata: ["source": "hotkey"])
        Task { await model.createNote() }
    }

    @objc
    private func statusItemClicked(_ sender: Any?) {
        guard let event = NSApp.currentEvent, let button = statusItem.button else {
            return
        }

        if event.type == .rightMouseUp {
            contextMenu.popUp(positioning: nil, at: NSPoint(x: 0, y: button.bounds.height + 4), in: button)
            return
        }

        if let popover, popover.isShown {
            popover.performClose(sender)
            return
        }

        showPopover()
    }

    private func showPopover() {
        guard let button = statusItem.button else { return }
        let popover = makePopover()
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        popover.contentViewController?.view.window?.makeKey()
    }

    func popoverDidClose(_ notification: Notification) {
        popover?.contentViewController = nil
        popover = nil
    }

    private func makePopover() -> NSPopover {
        let popover = NSPopover()
        popover.behavior = .transient
        popover.delegate = self
        popover.appearance = NSAppearance(named: .darkAqua)
        let host = NSHostingController(
            rootView: CapturePopoverView(model: model) { [weak self] in
                self?.popover?.performClose(nil)
            }
        )
        host.sizingOptions = .preferredContentSize
        popover.contentViewController = host
        self.popover = popover
        return popover
    }

    private func buildContextMenu() -> NSMenu {
        let menu = NSMenu()

        let newNoteItem = NSMenuItem(title: "New Note", action: #selector(menuNewNote), keyEquivalent: "")
        newNoteItem.target = self
        menu.addItem(newNoteItem)

        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Quit Blink", action: #selector(menuQuit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        return menu
    }

    @objc private func menuNewNote() {
        newNote()
    }

    @objc private func menuQuit() {
        NSApp.terminate(nil)
    }
}
