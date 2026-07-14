import AppKit
import HudsonUI
import SwiftUI

/// Blink's whole settings surface: three sections, one screen — built from
/// HudsonKit's settings primitives. The UI is a *view* over the agent-first
/// config file; everything here round-trips through config.json.
struct SettingsView: View {
    @ObservedObject var store: BlinkConfigStore
    let notesDirectory: URL

    private var tildePath: String {
        notesDirectory.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")
    }

    private var restoreSession: Binding<Bool> {
        Binding(
            get: { store.config.behavior.restoreSession },
            set: { value in store.update { $0.behavior.restoreSession = value } }
        )
    }

    private var defaultMode: Binding<String> {
        Binding(
            get: { store.config.behavior.defaultMode },
            set: { value in store.update { $0.behavior.defaultMode = value } }
        )
    }

    private var launchAtLogin: Binding<Bool> {
        Binding(
            get: { store.config.behavior.launchAtLogin },
            set: { value in store.update { $0.behavior.launchAtLogin = value } }
        )
    }

    /// Pretty form of a config chord string ("hyper+n" → "⌃⌥⇧⌘N").
    private func chord(_ raw: String) -> String {
        KeyChord.parse(raw)?.display ?? raw
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xl) {
                HudSettingsSection("General") {
                    HudSettingsRow(
                        icon: "folder",
                        title: "Notes folder",
                        subtitle: tildePath,
                        badge: {
                            Button("Reveal") {
                                NSWorkspace.shared.activateFileViewerSelecting([notesDirectory])
                            }
                            .controlSize(.small)
                        }
                    )
                    HudSettingsRow(
                        icon: "curlybraces",
                        title: "Config file",
                        subtitle: store.displayPath + " — theme, behavior; agents edit this too",
                        badge: {
                            Button("Open") {
                                NSWorkspace.shared.open(store.fileURL)
                            }
                            .controlSize(.small)
                        }
                    )
                    HudSettingsControlRow(
                        title: "Restore panels at launch",
                        subtitle: "Reopen last session's notes where you left them",
                        icon: "macwindow.on.rectangle"
                    ) {
                        Toggle("", isOn: restoreSession)
                            .toggleStyle(.switch)
                            .labelsHidden()
                            .controlSize(.small)
                    }
                    HudSettingsControlRow(
                        title: "Launch at login",
                        subtitle: "Start Blink when you sign in",
                        icon: "power"
                    ) {
                        Toggle("", isOn: launchAtLogin)
                            .toggleStyle(.switch)
                            .labelsHidden()
                            .controlSize(.small)
                    }
                }

                HudSettingsSection("Editor") {
                    HudSettingsControlRow(
                        title: "Open notes in",
                        subtitle: "New notes always open in edit",
                        icon: "book"
                    ) {
                        Picker("", selection: defaultMode) {
                            Text("Read").tag("read")
                            Text("Edit").tag("edit")
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                        .frame(width: 130)
                    }
                    HudSettingsRow(
                        icon: "paintpalette",
                        title: "Theme",
                        subtitle: "Fonts, colors, glass, shadows — edit theme values in the config file"
                    )
                }

                HudSettingsSection("Shortcuts") {
                    HudSettingsRow(
                        icon: "plus.square",
                        title: "New note",
                        subtitle: "Rebind any of these in the config file's hotkeys section",
                        badge: { KeyCap(chord(store.config.hotkeys.newNote)) }
                    )
                    HudSettingsRow(
                        icon: "eye",
                        title: "Blink — all notes / none",
                        badge: { KeyCap(chord(store.config.hotkeys.blink)) }
                    )
                    HudSettingsRow(
                        icon: "book.closed",
                        title: "Flip read / edit",
                        badge: { KeyCap(chord(store.config.hotkeys.toggleMode)) }
                    )
                    HudSettingsRow(
                        icon: "circle.dashed",
                        title: "Focus",
                        badge: { KeyCap(chord(store.config.hotkeys.focus)) }
                    )
                    HudSettingsRow(
                        icon: "grid",
                        title: "Grid overlay",
                        badge: { KeyCap(chord(store.config.hotkeys.grid)) }
                    )
                    HudSettingsRow(
                        icon: "xmark.square",
                        title: "Close panel",
                        subtitle: "⎋ steps down: leaves edit, then drops focus",
                        badge: { KeyCap("⌘W") }
                    )
                    HudSettingsRow(
                        icon: "command",
                        title: "Command palette",
                        subtitle: "soon",
                        badge: { KeyCap("⌘K") }
                    )
                }
            }
            .padding(HudSpacing.xl)
        }
        .frame(width: 460, height: 640)
    }
}

/// Small keycap chip for shortcut rows.
private struct KeyCap: View {
    let keys: String
    init(_ keys: String) { self.keys = keys }

    var body: some View {
        Text(keys)
            .font(.system(size: 11, design: .monospaced))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 4))
    }
}
