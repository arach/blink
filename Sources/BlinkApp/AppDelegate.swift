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
    private var guideWindow: NSWindow?
    private var commandPaletteController: BlinkCommandPaletteController?
    private var activityCatalog: BlinkActivityCatalog?
    private var commandRequestObserver: NSObjectProtocol?
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
        configureDiscovery()
        commandRequestObserver = NotificationCenter.default.addObserver(
            forName: .blinkCommandPaletteRequested,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.toggleCommandPalette(from: nil)
            }
        }

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

        // Light/dark: resolve the config's appearance axis before the first
        // theme pass, and re-theme AppKit surfaces on a system-driven flip
        // (the SwiftUI popover observes AppearanceManager itself).
        AppearanceManager.shared.apply(BlinkConfigStore.shared.config.appearance)
        AppearanceManager.shared.onChange = { [weak self] _ in
            self?.panelManager.applyTheme(BlinkConfigStore.shared.config)
        }

        // Agent-first config: hot-apply file edits to every live surface.
        BlinkConfigStore.shared.onChange = { [weak self] config in
            // Appearance first, so applyTheme paints the resolved scheme.
            AppearanceManager.shared.apply(config.appearance)
            self?.panelManager.applyTheme(config)
            self?.applyHotkeys(config)
            self?.applyLoginItem(config)
            // Reflect an appearance change (or any state) in the menu checkmarks.
            self?.contextMenu = self?.buildContextMenu()
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

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu(title: "Blink")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        func appItem(
            _ title: String,
            action: Selector,
            keyEquivalent: String,
            modifiers: NSEvent.ModifierFlags = .command
        ) {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: keyEquivalent)
            item.target = self
            item.keyEquivalentModifierMask = modifiers
            appMenu.addItem(item)
        }

        appItem("Commands…", action: #selector(menuCommands), keyEquivalent: "k")
        appItem(
            "Help & Shortcuts",
            action: #selector(menuGuide),
            keyEquivalent: "?",
            modifiers: [.command]
        )
        appMenu.addItem(.separator())
        appItem("Settings…", action: #selector(menuSettings), keyEquivalent: ",")
        appMenu.addItem(.separator())
        appItem("Quit Blink", action: #selector(menuQuit), keyEquivalent: "q")

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
        if let commandRequestObserver {
            NotificationCenter.default.removeObserver(commandRequestObserver)
        }
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
            // Rebuild so live state (e.g. the Background checkmark) is current.
            contextMenu = buildContextMenu()
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
        popover.appearance = NSAppearance(named: AppearanceManager.shared.scheme.nsAppearanceName)
        popover.contentSize = CapturePopoverView.contentSize
        let host = NSHostingController(
            rootView: CapturePopoverView(
                model: model,
                dismiss: { [weak self] in self?.popover?.performClose(nil) },
                openSettings: { [weak self] in
                    self?.popover?.performClose(nil)
                    self?.openSettings()
                },
                openGuide: { [weak self] in
                    self?.popover?.performClose(nil)
                    self?.openGuide()
                },
                showCommands: { [weak self] in
                    let invocationWindow = self?.popover?.contentViewController?.view.window
                    self?.popover?.performClose(nil)
                    self?.toggleCommandPalette(from: invocationWindow)
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

        // Background: quick control over the drape (the full-screen blur/dim
        // behind the notes) without a trip through config.json.
        let backgroundItem = NSMenuItem(title: "Background", action: nil, keyEquivalent: "")
        let backgroundMenu = NSMenu()
        let level = drapeLevel(BlinkConfigStore.shared.config)
        for (title, target) in [("Off", DrapeLevel.off), ("Light", .light), ("Full", .full)] {
            let item = NSMenuItem(title: title, action: #selector(menuBackgroundLevel(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = target.rawValue
            item.state = (level == target) ? .on : .off
            backgroundMenu.addItem(item)
        }
        backgroundItem.submenu = backgroundMenu
        menu.addItem(backgroundItem)

        // Appearance: light/dark override (or Auto to follow macOS), without a
        // trip through config.json. Mirrors config.appearance.
        let appearanceItem = NSMenuItem(title: "Appearance", action: nil, keyEquivalent: "")
        let appearanceMenu = NSMenu()
        let current = BlinkConfigStore.shared.config.appearance.lowercased()
        let activeAppearance = (current == "light" || current == "dark") ? current : "auto"
        for (title, value) in [("Auto", "auto"), ("Light", "light"), ("Dark", "dark")] {
            let item = NSMenuItem(title: title, action: #selector(menuAppearance(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = value
            item.state = (activeAppearance == value) ? .on : .off
            appearanceMenu.addItem(item)
        }
        appearanceItem.submenu = appearanceMenu
        menu.addItem(appearanceItem)

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

    /// The three quick background presets. `Off` kills the drape; `Light` and
    /// `Full` set its overall presence (opacity) but leave `dim`/`material` as
    /// configured, so a tuned drape keeps its character.
    private enum DrapeLevel: String {
        case off, light, full
    }

    private func drapeLevel(_ config: BlinkConfig) -> DrapeLevel {
        guard config.drape.enabled else { return .off }
        return config.drape.opacity <= 0.7 ? .light : .full
    }

    @objc private func menuBackgroundLevel(_ sender: NSMenuItem) {
        guard let raw = sender.representedObject as? String,
              let level = DrapeLevel(rawValue: raw) else { return }
        BlinkConfigStore.shared.update { config in
            switch level {
            case .off:   config.drape.enabled = false
            case .light: config.drape.enabled = true; config.drape.opacity = 0.4
            case .full:  config.drape.enabled = true; config.drape.opacity = 1.0
            }
        }
    }

    @objc private func menuAppearance(_ sender: NSMenuItem) {
        guard let value = sender.representedObject as? String else { return }
        BlinkConfigStore.shared.update { $0.appearance = value }
    }

    @objc private func menuNewNote() {
        newNote()
    }

    @objc private func menuSettings() {
        openSettings()
    }

    @objc private func menuCommands() {
        toggleCommandPalette(from: NSApp.keyWindow)
    }

    @objc private func menuGuide() {
        openGuide()
    }

    @objc private func menuQuit() {
        NSApp.terminate(nil)
    }

    private func configureDiscovery() {
        let handlers = BlinkActivityCatalog.Handlers(
            newNote: { [weak self] in self?.newNote() },
            toggleBlink: { [weak self] in self?.panelManager.toggleBlink() },
            showGrid: { [weak self] in self?.panelManager.toggleGridOverlay() },
            openSettings: { [weak self] in self?.openSettings() },
            openGuide: { [weak self] in self?.openGuide() },
            revealNotesFolder: {
                NSWorkspace.shared.activateFileViewerSelecting([Self.notesDirectory()])
            },
            openConfigFile: {
                NSWorkspace.shared.open(BlinkConfigStore.shared.fileURL)
            },
            toggleCurrentNoteMode: { [weak self] in self?.panelManager.toggleCommandNoteMode() },
            toggleCurrentNoteFocus: { [weak self] in self?.panelManager.toggleCommandNoteFocus() },
            chooseCurrentNoteStyle: { [weak self] in self?.panelManager.chooseCommandNoteStyle() },
            hideCurrentNote: { [weak self] in self?.panelManager.hideCommandNote() },
            closeCurrentNote: { [weak self] in self?.panelManager.closeCommandNote() },
            copyCurrentNoteID: { [weak self] in self?.panelManager.copyCommandNoteID() },
            copyCurrentNoteMarkdown: { [weak self] in self?.panelManager.copyCommandNoteMarkdown() },
            copyCurrentNoteFilePath: { [weak self] in self?.panelManager.copyCommandNoteFilePath() },
            openCurrentNoteFile: { [weak self] in self?.panelManager.openCommandNoteFile() },
            revealCurrentNoteInFinder: { [weak self] in self?.panelManager.revealCommandNoteInFinder() },
            currentNoteAvailable: { [weak self] in self?.panelManager.hasCommandNotePanel ?? false }
        )
        let catalog = BlinkActivityCatalog(handlers: handlers)
        activityCatalog = catalog
        commandPaletteController = BlinkCommandPaletteController(
            model: model,
            activities: { [weak self] in self?.activityCatalog?.paletteActivities ?? [] }
        )
    }

    private func toggleCommandPalette(from invocationWindow: NSWindow?) {
        popover?.performClose(nil)
        commandPaletteController?.toggle(from: invocationWindow)
    }

    private func openGuide() {
        guard let activities = activityCatalog?.activities else { return }
        // Blink owns one durable utility surface at a time. Commands remains a
        // transient interstitial; Help and Settings replace one another instead
        // of accumulating as unrelated document windows on the desktop.
        commandPaletteController?.dismiss()
        settingsWindow?.orderOut(nil)
        if guideWindow == nil {
            let host = NSHostingController(rootView: BlinkGuideView(activities: activities))
            let window = NSWindow(contentViewController: host)
            window.title = "Blink Help & Shortcuts"
            window.styleMask = [.titled, .closable, .resizable]
            window.setContentSize(NSSize(width: 780, height: 610))
            window.contentMinSize = NSSize(width: 720, height: 520)
            window.isReleasedWhenClosed = false
            window.setFrameAutosaveName("blink.guide")
            if window.frame.origin == .zero { window.center() }
            guideWindow = window
        }
        NSApp.activate(ignoringOtherApps: true)
        guideWindow?.makeKeyAndOrderFront(nil)
    }

    private func openSettings() {
        commandPaletteController?.dismiss()
        guideWindow?.orderOut(nil)
        if settingsWindow == nil {
            let host = NSHostingController(
                rootView: SettingsView(store: .shared, notesDirectory: Self.notesDirectory())
            )
            let window = NSWindow(contentViewController: host)
            window.title = "Blink Settings"
            window.styleMask = [.titled, .closable, .resizable]
            window.setContentSize(NSSize(width: 760, height: 640))
            window.contentMinSize = NSSize(width: 604, height: 540)
            // No explicit appearance — inherit NSApp.appearance, which
            // AppearanceManager pins (light/dark) or clears (auto → the OS).
            window.isReleasedWhenClosed = false
            window.setFrameAutosaveName("blink.settings")
            if window.frame.origin == .zero { window.center() }
            settingsWindow = window
        }
        NSApp.activate(ignoringOtherApps: true)
        settingsWindow?.makeKeyAndOrderFront(nil)
    }
}

extension Notification.Name {
    static let blinkCommandPaletteRequested = Notification.Name("blink.commandPaletteRequested")
}
