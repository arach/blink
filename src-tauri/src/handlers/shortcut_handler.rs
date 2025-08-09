use crate::error::{BlinkError, BlinkResult};
use crate::types::window::{DetachedWindowsState, ToggleState};
use crate::{log_debug, log_error, log_info};
use crate::state::NotesState;
use tauri::{AppHandle, Manager, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Register all global shortcuts for the application
pub fn register_global_shortcuts(app: &AppHandle) -> BlinkResult<()> {
    log_info!("STARTUP", "🚀 Initializing global shortcuts...");

    // Register Hyperkey+N for new note
    register_new_note_shortcut(app)?;

    // Register Hyperkey+H for hover mode
    register_hover_mode_shortcut(app)?;

    // Register Hyperkey+B for window chord mode
    register_window_chord_shortcut(app)?;

    // Register Ctrl+Opt+Shift+1-9 for note deployment
    register_note_deployment_shortcuts(app)?;

    // Register test shortcut Cmd+Shift+N (optional)
    register_test_shortcut(app);

    Ok(())
}

fn register_new_note_shortcut(
    app: &AppHandle,
) -> BlinkResult<()> {
    let manager = app.global_shortcut();
    let hyperkey_n = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyN,
    );

    // Unregister if exists
    let _ = manager.unregister(hyperkey_n.clone());

    manager
        .register(hyperkey_n)
        .map_err(|e| BlinkError::GlobalShortcut(format!("Failed to register Hyperkey+N: {}", e)))?;

    log_info!(
        "STARTUP",
        "✅ Successfully registered global shortcut: Cmd+Ctrl+Alt+Shift+N"
    );

    Ok(())
}

fn register_hover_mode_shortcut(
    app: &AppHandle,
) -> BlinkResult<()> {
    let manager = app.global_shortcut();
    let hyperkey_h = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyH,
    );

    // Unregister if exists
    let _ = manager.unregister(hyperkey_h.clone());

    manager
        .register(hyperkey_h)
        .map_err(|e| BlinkError::GlobalShortcut(format!("Failed to register Hyperkey+H: {}", e)))?;

    log_info!(
        "STARTUP",
        "✅ Successfully registered global shortcut: Cmd+Ctrl+Alt+Shift+H (Hover mode)"
    );

    Ok(())
}

fn register_window_chord_shortcut(
    app: &AppHandle,
) -> BlinkResult<()> {
    let manager = app.global_shortcut();
    let hyperkey_b = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyB,
    );

    // Unregister if exists
    let _ = manager.unregister(hyperkey_b.clone());

    manager
        .register(hyperkey_b)
        .map_err(|e| BlinkError::GlobalShortcut(format!("Failed to register Hyperkey+B: {}", e)))?;

    log_info!(
        "STARTUP",
        "✅ Successfully registered global shortcut: Cmd+Ctrl+Alt+Shift+B (Window chord mode)"
    );

    Ok(())
}

fn register_note_deployment_shortcuts(
    app: &AppHandle,
) -> BlinkResult<()> {
    let manager = app.global_shortcut();
    log_info!(
        "STARTUP",
        "Registering Ctrl+Opt+Shift+1-9 for note deployment (main row + keypad)..."
    );

    let deploy_keys = [
        // Main number row
        (1, Code::Digit1),
        (2, Code::Digit2),
        (3, Code::Digit3),
        (4, Code::Digit4),
        (5, Code::Digit5),
        (6, Code::Digit6),
        (7, Code::Digit7),
        (8, Code::Digit8),
        (9, Code::Digit9),
        // Keypad numbers
        (1, Code::Numpad1),
        (2, Code::Numpad2),
        (3, Code::Numpad3),
        (4, Code::Numpad4),
        (5, Code::Numpad5),
        (6, Code::Numpad6),
        (7, Code::Numpad7),
        (8, Code::Numpad8),
        (9, Code::Numpad9),
    ];

    for (note_index, code) in deploy_keys.iter() {
        let deploy_shortcut = Shortcut::new(
            Some(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
            *code,
        );

        let key_type = match *code {
            Code::Numpad1
            | Code::Numpad2
            | Code::Numpad3
            | Code::Numpad4
            | Code::Numpad5
            | Code::Numpad6
            | Code::Numpad7
            | Code::Numpad8
            | Code::Numpad9 => "keypad",
            _ => "main",
        };

        match manager.register(deploy_shortcut) {
            Ok(_) => {
                log_info!(
                    "STARTUP",
                    "✅ Successfully registered Ctrl+Opt+Shift+{} ({}) for note {} deployment",
                    note_index,
                    key_type,
                    note_index
                );
            }
            Err(e) => {
                log_error!(
                    "STARTUP",
                    "❌ Failed to register Ctrl+Opt+Shift+{} ({}): {}",
                    note_index,
                    key_type,
                    e
                );
            }
        }
    }

    Ok(())
}

fn register_test_shortcut(app: &AppHandle) {
    let manager = app.global_shortcut();
    let test_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyN);

    match manager.register(test_shortcut) {
        Ok(_) => {
            log_info!("STARTUP", "✅ Also registered test shortcut: Cmd+Shift+N");
        }
        Err(e) => {
            log_debug!("STARTUP", "Could not register test shortcut: {}", e);
        }
    }
}

/// Handle global shortcut events
pub fn handle_global_shortcut(app: &AppHandle, shortcut: &Shortcut, event: ShortcutState) {
    log_info!(
        "SHORTCUT-HANDLER",
        "🎯 Global shortcut handler invoked - Event: {:?}, Shortcut: {:?}",
        event,
        shortcut
    );
    log_debug!(
        "SHORTCUT-HANDLER",
        "🔍 Raw shortcut details - mods: {:?}, key: {:?}",
        shortcut.mods,
        shortcut.key
    );

    if event != ShortcutState::Pressed {
        log_debug!(
            "SHORTCUT-HANDLER",
            "Event state was not Pressed: {:?}",
            event
        );
        return;
    }

    // Define shortcuts for comparison
    let hyperkey_n = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyN,
    );

    let hyperkey_h = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyH,
    );

    let hyperkey_b = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyB,
    );

    let simple_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyN);

    log_debug!("SHORTCUT-HANDLER", "Checking which shortcut was pressed...");

    if shortcut == &hyperkey_n {
        handle_new_note_shortcut(app);
    } else if shortcut == &hyperkey_h {
        handle_hover_mode_shortcut(app);
    } else if shortcut == &hyperkey_b {
        handle_window_chord_shortcut(app);
    } else if shortcut == &simple_shortcut {
        handle_simple_new_note_shortcut(app);
    } else {
        handle_deploy_shortcuts(app, shortcut);
    }
}

fn handle_new_note_shortcut(app: &AppHandle) {
    log_info!(
        "SHORTCUT-HANDLER",
        "🔥 HYPERKEY+N TRIGGERED! Creating new note..."
    );
    match app.emit("menu-new-note", ()) {
        Ok(_) => log_info!(
            "SHORTCUT-HANDLER",
            "✅ Successfully emitted menu-new-note event"
        ),
        Err(e) => log_error!(
            "SHORTCUT-HANDLER",
            "❌ Failed to emit menu-new-note event: {}",
            e
        ),
    }
}

fn handle_hover_mode_shortcut(app: &AppHandle) {
    use crate::modules::windows::toggle_all_windows_hover;

    log_info!(
        "SHORTCUT-HANDLER",
        "🔥 HYPERKEY+H TRIGGERED! Toggling hover mode for all detached windows..."
    );

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let detached_windows = app_handle.state::<DetachedWindowsState>();
        let notes = app_handle.state::<NotesState>();
        let toggle_state = app_handle.state::<ToggleState>();

        match toggle_all_windows_hover(app_handle.clone(), detached_windows, notes, toggle_state)
            .await
        {
            Ok(visible) => log_info!(
                "SHORTCUT-HANDLER",
                "✅ Successfully toggled windows. Visible: {}",
                visible
            ),
            Err(e) => log_error!(
                "SHORTCUT-HANDLER",
                "❌ Failed to toggle windows: {}",
                e
            ),
        }
    });
}

fn handle_window_chord_shortcut(app: &AppHandle) {
    log_info!(
        "SHORTCUT-HANDLER",
        "🔥 HYPERKEY+B TRIGGERED! Entering window chord mode..."
    );
    match app.emit("chord-window-mode", ()) {
        Ok(_) => log_info!(
            "SHORTCUT-HANDLER",
            "✅ Successfully emitted chord-window-mode event"
        ),
        Err(e) => log_error!(
            "SHORTCUT-HANDLER",
            "❌ Failed to emit chord-window-mode event: {}",
            e
        ),
    }
}

fn handle_simple_new_note_shortcut(app: &AppHandle) {
    log_info!(
        "SHORTCUT-HANDLER",
        "🔥 CMD+SHIFT+N TRIGGERED! Creating new note..."
    );
    match app.emit("menu-new-note", ()) {
        Ok(_) => log_info!(
            "SHORTCUT-HANDLER",
            "✅ Successfully emitted menu-new-note event"
        ),
        Err(e) => log_error!(
            "SHORTCUT-HANDLER",
            "❌ Failed to emit menu-new-note event: {}",
            e
        ),
    }
}

fn handle_deploy_shortcuts(app: &AppHandle, shortcut: &Shortcut) {
    // Check for deploy shortcuts (Ctrl+Opt+Shift+1-9, both main row and keypad)
    let deploy_keys = [
        // Main number row
        (1, Code::Digit1),
        (2, Code::Digit2),
        (3, Code::Digit3),
        (4, Code::Digit4),
        (5, Code::Digit5),
        (6, Code::Digit6),
        (7, Code::Digit7),
        (8, Code::Digit8),
        (9, Code::Digit9),
        // Keypad numbers
        (1, Code::Numpad1),
        (2, Code::Numpad2),
        (3, Code::Numpad3),
        (4, Code::Numpad4),
        (5, Code::Numpad5),
        (6, Code::Numpad6),
        (7, Code::Numpad7),
        (8, Code::Numpad8),
        (9, Code::Numpad9),
    ];

    for (note_index, code) in deploy_keys.iter() {
        let deploy_shortcut = Shortcut::new(
            Some(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
            *code,
        );

        log_debug!(
            "SHORTCUT-HANDLER",
            "Comparing with Ctrl+Opt+Shift+{}: expected mods={:?}, key={:?}",
            note_index,
            deploy_shortcut.mods,
            deploy_shortcut.key
        );

        if shortcut == &deploy_shortcut {
            log_info!(
                "SHORTCUT-HANDLER",
                "🔥 CTRL+OPT+SHIFT+{} TRIGGERED! Deploying note window for note {}...",
                note_index,
                note_index
            );
            // Emit event with the note index (0-based for array access)
            match app.emit("deploy-note-window", note_index - 1) {
                Ok(_) => log_info!(
                    "SHORTCUT-HANDLER",
                    "✅ Successfully emitted deploy-note-window event for note {}",
                    note_index
                ),
                Err(e) => log_error!(
                    "SHORTCUT-HANDLER",
                    "❌ Failed to emit deploy-note-window event: {}",
                    e
                ),
            }
            return;
        }
    }

    log_debug!("SHORTCUT-HANDLER", "Shortcut didn't match any registered patterns");
}

/// Re-register global shortcuts (used for runtime updates)
pub async fn reregister_global_shortcuts(app: AppHandle) -> BlinkResult<Vec<String>> {
    log_info!("SHORTCUT", "Re-registering global shortcuts...");

    let shortcut_manager = app.global_shortcut();
    let mut results = Vec::new();

    // Define the shortcuts
    let hyperkey_n = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyN,
    );

    let hyperkey_h = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyH,
    );

    log_debug!("SHORTCUT", "Created shortcut objects: Hyperkey+N and Hyperkey+H");

    // Unregister and re-register Hyperkey+N
    match shortcut_manager.unregister(hyperkey_n.clone()) {
        Ok(_) => log_info!("SHORTCUT", "Unregistered existing Hyperkey+N"),
        Err(e) => log_debug!("SHORTCUT", "No existing Hyperkey+N to unregister: {}", e),
    };

    match shortcut_manager.register(hyperkey_n) {
        Ok(_) => {
            log_info!("SHORTCUT", "✅ Successfully registered Hyperkey+N");
            results.push("Hyperkey+N (⌘⌃⌥⇧N) registered".to_string());
        }
        Err(e) => {
            log_error!("SHORTCUT", "❌ Failed to register Hyperkey+N: {}", e);
            results.push(format!("Hyperkey+N failed: {}", e));
        }
    }

    // Unregister and re-register Hyperkey+H
    match shortcut_manager.unregister(hyperkey_h.clone()) {
        Ok(_) => log_info!("SHORTCUT", "Unregistered existing Hyperkey+H"),
        Err(e) => log_debug!("SHORTCUT", "No existing Hyperkey+H to unregister: {}", e),
    };

    match shortcut_manager.register(hyperkey_h) {
        Ok(_) => {
            log_info!("SHORTCUT", "✅ Successfully registered Hyperkey+H");
            results.push("Hyperkey+H (⌘⌃⌥⇧H) registered".to_string());
        }
        Err(e) => {
            log_error!("SHORTCUT", "❌ Failed to register Hyperkey+H: {}", e);
            results.push(format!("Hyperkey+H failed: {}", e));
        }
    }

    Ok(results)
}