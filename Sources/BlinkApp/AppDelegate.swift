import AppKit
import BlinkCore
import HudsonObservability
import ServiceManagement
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSPopoverDelegate {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover?
    private var contextMenu: NSMenu!
    private var store: NoteStore!
    private var panelManager: PanelManager!
    private var model: AppModel!
    private var settingsWindow: NSWindow?
    private var notesWatcher: DirectoryWatcher?
    private let log = HudLogger(category: "blink.app")

    static func notesDirectory() -> URL {
        BlinkPaths.notes()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        HudLoggerSinks.install(HudLogStore.shared)
        log.info("[BLINK] booted", metadata: ["milestone": "M1"])
        NSApp.setActivationPolicy(.accessory)
        installMainMenu()

        store = NoteStore(fileStore: NoteFileStore(directory: Self.notesDirectory()))
        panelManager = PanelManager(store: store)
        model = AppModel(store: store, panelManager: panelManager)
        panelManager.startObservingStore()

        // The filesystem is the API: external writers (the blink CLI, agents)
        // touch the Notes directory; reconcile diffs disk against memory and
        // posts the same notifications in-app mutations do, so the popover and
        // open panels pick external changes up live.
        notesWatcher = DirectoryWatcher(directory: Self.notesDirectory()) { [weak self] in
            guard let self else { return }
            Task {
                let diff = await self.store.reconcile()
                if !diff.isEmpty {
                    self.log.info(
                        "[BLINK] external changes reconciled",
                        metadata: [
                            "created": "\(diff.created.count)",
                            "updated": "\(diff.updated.count)",
                            "deleted": "\(diff.deleted.count)",
                        ]
                    )
                }
            }
        }

        // Agent-first config: hot-apply file edits to every live surface.
        BlinkConfigStore.shared.onChange = { [weak self] config in
            self?.panelManager.applyTheme(config)
            self?.applyHotkeys(config)
            self?.applyLoginItem(config)
        }

        Task {
            await panelManager.restoreSession()
            await model.start()
            panelManager.applyTheme(BlinkConfigStore.shared.config)
        }

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            button.image = BlinkIcon.menuBar(armed: false)
            button.target = self
            button.action = #selector(statusItemClicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        contextMenu = buildContextMenu()

        applyHotkeys(BlinkConfigStore.shared.config)
        applyLoginItem(BlinkConfigStore.shared.config)
    }

    /// Accessory apps do not show a menu bar, but AppKit still uses the main
    /// menu's key equivalents to route standard editing actions through the
    /// responder chain. Without this menu, WKWebView never receives them.
    private func installMainMenu() {
        let mainMenu = NSMenu()
        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        func addItem(
            _ title: String,
            action: Selector,
            keyEquivalent: String,
            modifiers: NSEvent.ModifierFlags = .command
        ) {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: keyEquivalent)
            item.target = nil
            item.keyEquivalentModifierMask = modifiers
            editMenu.addItem(item)
        }

        addItem("Undo", action: Selector(("undo:")), keyEquivalent: "z")
        addItem(
            "Redo", action: Selector(("redo:")), keyEquivalent: "z", modifiers: [.command, .shift]
        )
        editMenu.addItem(.separator())
        addItem("Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        addItem("Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        addItem("Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(.separator())
        addItem("Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        NSApp.mainMenu = mainMenu
    }

    /// Sync the SMAppService login item with config. Only touches the service
    /// when the desired state differs from the registered one, so launch never
    /// spams registration calls (or re-prompts) needlessly.
    private func applyLoginItem(_ config: BlinkConfig) {
        let service = SMAppService.mainApp
        let isEnabled = service.status == .enabled
        guard config.behavior.launchAtLogin != isEnabled else { return }
        do {
            if config.behavior.launchAtLogin {
                try service.register()
            } else {
                try service.unregister()
            }
            log.info(
                "[BLINK] launch at login",
                metadata: ["enabled": "\(config.behavior.launchAtLogin)"]
            )
        } catch {
            log.error(
                "[BLINK] launch-at-login change failed",
                metadata: ["error": "\(error)"]
            )
        }
    }

    /// Register (or re-register on hot reload) the global hotkeys from config.
    /// An invalid or modifier-less chord is logged and the previous binding kept —
    /// a bad config edit must never leave the app unreachable.
    private var appliedHotkeys: [UInt32: String] = [:]

    private func applyHotkeys(_ config: BlinkConfig) {
        registerGlobalHotkey(id: 1, chord: config.hotkeys.newNote, name: "newNote") { [weak self] in
            self?.newNote()
        }
        // The blink: shows every note, then none.
        registerGlobalHotkey(id: 2, chord: config.hotkeys.blink, name: "blink") { [weak self] in
            self?.panelManager.toggleBlink()
        }
        registerGlobalHotkey(id: 3, chord: config.hotkeys.grid, name: "grid") { [weak self] in
            self?.panelManager.toggleGridOverlay()
        }
        if let chord = KeyChord.parse(config.hotkeys.newNote) {
            statusItem?.button?.toolTip = "Blink — \(chord.display) for a new note"
        }
    }

    private func registerGlobalHotkey(
        id: UInt32, chord raw: String, name: String, callback: @escaping () -> Void
    ) {
        guard appliedHotkeys[id] != raw else { return }
        guard let chord = KeyChord.parse(raw), !chord.eventModifiers.isEmpty else {
            log.error(
                "[BLINK] invalid hotkey — keeping previous binding",
                metadata: ["hotkey": name, "value": raw]
            )
            return
        }
        if HotkeyManager.shared.register(
            id: id, keyCode: chord.keyCode, modifiers: chord.carbonModifiers, callback: callback
        ) {
            appliedHotkeys[id] = raw
            log.info("[BLINK] hotkey bound", metadata: ["hotkey": name, "chord": chord.display])
        } else {
            log.error(
                "[BLINK] hotkey registration failed (chord taken by another app?)",
                metadata: ["hotkey": name, "value": raw]
            )
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
        setMenuBarArmed(true)
        popover.contentViewController?.view.window?.makeKey()
    }

    func popoverDidClose(_ notification: Notification) {
        setMenuBarArmed(false)
        popover?.contentViewController = nil
        popover = nil
    }

    private func setMenuBarArmed(_ armed: Bool) {
        statusItem?.button?.image = BlinkIcon.menuBar(armed: armed)
    }

    private func makePopover() -> NSPopover {
        let popover = NSPopover()
        popover.behavior = .transient
        popover.delegate = self
        popover.appearance = NSAppearance(named: .darkAqua)
        popover.contentSize = CapturePopoverView.contentSize
        let host = NSHostingController(
            rootView: CapturePopoverView(
                model: model,
                dismiss: { [weak self] in self?.popover?.performClose(nil) },
                openSettings: { [weak self] in
                    self?.popover?.performClose(nil)
                    self?.openSettings()
                },
                toggleBlink: { [weak self] in
                    self?.popover?.performClose(nil)
                    self?.panelManager.toggleBlink()
                },
                showGrid: { [weak self] in
                    self?.popover?.performClose(nil)
                    self?.panelManager.toggleGridOverlay()
                },
                beginDictation: { [weak self] in
                    self?.beginPopoverDictation()
                }
            )
        )
        host.sizingOptions = .preferredContentSize
        popover.contentViewController = host
        self.popover = popover
        return popover
    }

    /// System dictation briefly promotes its own HUD outside Blink. A normal
    /// transient popover interprets that as an outside interaction and closes,
    /// destroying the target text field. Hold the popover through handoff,
    /// then restore its normal click-away behavior once the HUD is established.
    private func beginPopoverDictation() {
        guard let popover, popover.isShown else { return }
        popover.behavior = .applicationDefined
        NSApp.sendAction(Selector(("startDictation:")), to: nil, from: nil)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak popover] in
            guard let popover, popover.isShown else { return }
            popover.behavior = .transient
        }
    }

    private func buildContextMenu() -> NSMenu {
        let menu = NSMenu()

        let newNoteItem = NSMenuItem(title: "New Note", action: #selector(menuNewNote), keyEquivalent: "")
        newNoteItem.target = self
        menu.addItem(newNoteItem)

        menu.addItem(.separator())

        let settingsItem = NSMenuItem(title: "Settings…", action: #selector(menuSettings), keyEquivalent: ",")
        settingsItem.target = self
        menu.addItem(settingsItem)

        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Quit Blink", action: #selector(menuQuit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        return menu
    }

    @objc private func menuNewNote() {
        newNote()
    }

    @objc private func menuSettings() {
        openSettings()
    }

    @objc private func menuQuit() {
        NSApp.terminate(nil)
    }

    private func openSettings() {
        if settingsWindow == nil {
            let host = NSHostingController(
                rootView: SettingsView(store: .shared, notesDirectory: Self.notesDirectory())
            )
            let window = NSWindow(contentViewController: host)
            window.title = "Blink Settings"
            window.styleMask = [.titled, .closable]
            window.appearance = NSAppearance(named: .darkAqua)
            window.isReleasedWhenClosed = false
            window.setFrameAutosaveName("blink.settings")
            if window.frame.origin == .zero { window.center() }
            settingsWindow = window
        }
        NSApp.activate(ignoringOtherApps: true)
        settingsWindow?.makeKeyAndOrderFront(nil)
    }
}
