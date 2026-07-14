import Foundation
import SwiftUI

enum ConfigKeys {
    static let restoreSession = "blink.restoreSession"
    static let defaultMode = "blink.defaultMode"  // "read" | "edit"
    static func noteMode(_ id: String) -> String { "blink.noteMode.\(id)" }
}

/// App preferences, UserDefaults-backed. Deliberately tiny: if a setting has a
/// good default, it isn't a setting.
@MainActor
final class ConfigStore: ObservableObject {
    static let shared = ConfigStore()
    private let defaults = UserDefaults.standard

    /// Reopen last session's panels at launch.
    @Published var restoreSession: Bool {
        didSet { defaults.set(restoreSession, forKey: ConfigKeys.restoreSession) }
    }

    /// Mode for opening notes that have no remembered mode. New notes always
    /// open in edit; a note's last mode is remembered per note.
    @Published var defaultMode: String {
        didSet { defaults.set(defaultMode, forKey: ConfigKeys.defaultMode) }
    }

    private init() {
        restoreSession = defaults.object(forKey: ConfigKeys.restoreSession) as? Bool ?? true
        defaultMode = defaults.string(forKey: ConfigKeys.defaultMode) ?? "read"
    }
}
