use crate::error::{BlinkError, BlinkResult};
use crate::types::{note::Note, window::DetachedWindow};
use crate::{log_error, log_info};
use std::collections::HashMap;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Emitter};

/// Build the application menu with all items
pub fn build_app_menu(
    app: &AppHandle,
    detached_windows: &HashMap<String, DetachedWindow>,
    notes: &HashMap<String, Note>,
) -> BlinkResult<Menu<tauri::Wry>> {
    let menu = Menu::new(app).map_err(|e| BlinkError::Menu(e.to_string()))?;

    // App menu
    let app_menu = build_app_submenu(app)?;
    // Edit menu
    let edit_menu = build_edit_submenu(app)?;
    // Notes menu
    let notes_menu = build_notes_submenu(app, detached_windows, notes)?;
    // Developer menu
    let developer_menu = build_developer_submenu(app)?;
    // Window menu
    let window_menu = build_window_submenu(app)?;

    menu.append(&app_menu)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    menu.append(&edit_menu)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    menu.append(&notes_menu)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    menu.append(&developer_menu)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    menu.append(&window_menu)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;

    Ok(menu)
}

fn build_app_submenu(app: &AppHandle) -> BlinkResult<Submenu<tauri::Wry>> {
    let app_menu = Submenu::new(app, "Blink", true)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    
    let about_item = MenuItem::new(app, "About Blink", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let separator = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let services_item = MenuItem::new(app, "Services", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let separator2 = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let hide_item = MenuItem::new(app, "Hide Blink", true, Some("Cmd+H"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let hide_others_item = MenuItem::new(app, "Hide Others", true, Some("Cmd+Alt+H"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let show_all_item = MenuItem::new(app, "Show All", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let separator3 = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Blink", true, Some("Cmd+Q"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;

    app_menu.append(&about_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    app_menu.append(&separator).map_err(|e| BlinkError::Menu(e.to_string()))?;
    app_menu.append(&services_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    app_menu.append(&separator2).map_err(|e| BlinkError::Menu(e.to_string()))?;
    app_menu.append(&hide_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    app_menu.append(&hide_others_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    app_menu.append(&show_all_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    app_menu.append(&separator3).map_err(|e| BlinkError::Menu(e.to_string()))?;
    app_menu.append(&quit_item).map_err(|e| BlinkError::Menu(e.to_string()))?;

    Ok(app_menu)
}

fn build_edit_submenu(app: &AppHandle) -> BlinkResult<Submenu<tauri::Wry>> {
    let edit_menu = Submenu::new(app, "Edit", true)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    
    let undo_item = MenuItem::new(app, "Undo", true, Some("Cmd+Z"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let redo_item = MenuItem::new(app, "Redo", true, Some("Cmd+Shift+Z"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let separator = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let cut_item = MenuItem::new(app, "Cut", true, Some("Cmd+X"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let copy_item = MenuItem::new(app, "Copy", true, Some("Cmd+C"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let paste_item = MenuItem::new(app, "Paste", true, Some("Cmd+V"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let select_all_item = MenuItem::new(app, "Select All", true, Some("Cmd+A"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;

    edit_menu.append(&undo_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    edit_menu.append(&redo_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    edit_menu.append(&separator).map_err(|e| BlinkError::Menu(e.to_string()))?;
    edit_menu.append(&cut_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    edit_menu.append(&copy_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    edit_menu.append(&paste_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    edit_menu.append(&select_all_item).map_err(|e| BlinkError::Menu(e.to_string()))?;

    Ok(edit_menu)
}

fn build_notes_submenu(
    app: &AppHandle,
    detached_windows: &HashMap<String, DetachedWindow>,
    notes: &HashMap<String, Note>,
) -> BlinkResult<Submenu<tauri::Wry>> {
    let notes_menu = Submenu::new(app, "Notes", true)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    
    let new_note_item = MenuItem::with_id(app, "new-note", "New Note", true, Some("Cmd+Ctrl+Alt+Shift+N"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let separator = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let show_main_window_item = MenuItem::with_id(app, "show-main-window", "Show Main Window", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let separator2 = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;

    notes_menu.append(&new_note_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    notes_menu.append(&separator).map_err(|e| BlinkError::Menu(e.to_string()))?;
    notes_menu.append(&show_main_window_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    notes_menu.append(&separator2).map_err(|e| BlinkError::Menu(e.to_string()))?;

    // Add all notes to the menu
    let mut notes_vec: Vec<(&String, &Note)> = notes.iter().collect();
    notes_vec.sort_by(|a, b| match (a.1.position, b.1.position) {
        (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });

    for (note_id, note) in notes_vec.iter() {
        let is_open = detached_windows.values().any(|w| &w.note_id == *note_id);
        let title = if note.title.is_empty() {
            "Untitled Note".to_string()
        } else {
            note.title.clone()
        };
        let menu_title = if is_open {
            format!("• {}", title)
        } else {
            format!("  {}", title)
        };
        let item = MenuItem::with_id(app, format!("open-note-{}", note_id), menu_title, true, None::<&str>)
            .map_err(|e| BlinkError::Menu(e.to_string()))?;
        notes_menu.append(&item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    }

    Ok(notes_menu)
}

fn build_developer_submenu(app: &AppHandle) -> BlinkResult<Submenu<tauri::Wry>> {
    let developer_menu = Submenu::new(app, "Developer", true)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    
    let reload_app_item = MenuItem::with_id(app, "reload-app", "Reload App", true, Some("Cmd+R"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let restart_app_item = MenuItem::with_id(app, "restart-app", "Restart App", true, Some("Cmd+Shift+R"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let dev_separator = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let force_main_visible_item = MenuItem::with_id(app, "force-main-visible", "Force Main Window Visible", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;

    developer_menu.append(&reload_app_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    developer_menu.append(&restart_app_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    developer_menu.append(&dev_separator).map_err(|e| BlinkError::Menu(e.to_string()))?;
    developer_menu.append(&force_main_visible_item).map_err(|e| BlinkError::Menu(e.to_string()))?;

    Ok(developer_menu)
}

fn build_window_submenu(app: &AppHandle) -> BlinkResult<Submenu<tauri::Wry>> {
    let window_menu = Submenu::new(app, "Window", true)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    
    let minimize_item = MenuItem::with_id(app, "minimize", "Minimize", true, Some("Cmd+M"))
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let zoom_item = MenuItem::new(app, "Zoom", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let separator = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;

    // Tiling options (macOS 11+)
    let tile_left = MenuItem::new(app, "Tile Window to Left of Screen", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let tile_right = MenuItem::new(app, "Tile Window to Right of Screen", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let replace_tiled = MenuItem::new(app, "Replace Tiled Window", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let separator2 = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;

    let remove_from_stage = MenuItem::new(app, "Remove Window from Set", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;
    let separator3 = PredefinedMenuItem::separator(app)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;

    let bring_all_to_front = MenuItem::new(app, "Bring All to Front", true, None::<&str>)
        .map_err(|e| BlinkError::Menu(e.to_string()))?;

    window_menu.append(&minimize_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    window_menu.append(&zoom_item).map_err(|e| BlinkError::Menu(e.to_string()))?;
    window_menu.append(&separator).map_err(|e| BlinkError::Menu(e.to_string()))?;
    window_menu.append(&tile_left).map_err(|e| BlinkError::Menu(e.to_string()))?;
    window_menu.append(&tile_right).map_err(|e| BlinkError::Menu(e.to_string()))?;
    window_menu.append(&replace_tiled).map_err(|e| BlinkError::Menu(e.to_string()))?;
    window_menu.append(&separator2).map_err(|e| BlinkError::Menu(e.to_string()))?;
    window_menu.append(&remove_from_stage).map_err(|e| BlinkError::Menu(e.to_string()))?;
    window_menu.append(&separator3).map_err(|e| BlinkError::Menu(e.to_string()))?;
    window_menu.append(&bring_all_to_front).map_err(|e| BlinkError::Menu(e.to_string()))?;

    Ok(window_menu)
}

/// Update the application menu
pub async fn update_app_menu(
    app: tauri::AppHandle,
    detached_windows: tauri::State<'_, crate::state::DetachedWindowsState>,
    notes: tauri::State<'_, crate::state::NotesState>,
) -> Result<(), String> {
    let windows_lock = detached_windows.lock().await;
    let notes_lock = notes.lock().await;
    
    let menu = build_app_menu(&app, &*windows_lock, &*notes_lock)
        .map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| format!("Failed to update menu: {}", e))?;
    
    Ok(())
}

/// Handle menu events
pub fn handle_menu_event(app: &AppHandle, menu_id: &str) {
    use crate::modules::windows::{force_main_window_visible, create_detached_window};
    use crate::types::window::CreateDetachedWindowRequest;
    use crate::DetachedWindowsState;
    use crate::state::NotesState;
    
    log_info!("MENU", "Menu event received: {}", menu_id);

    match menu_id {
        "quit" => {
            log_info!("MENU", "Quit menu item selected");
            app.exit(0);
        }
        "minimize" => {
            log_info!("MENU", "Minimize menu item selected");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.minimize();
            }
        }
        "new-note" => {
            log_info!("MENU", "New Note menu item selected - emitting menu-new-note event");
            match app.emit("menu-new-note", ()) {
                Ok(_) => log_info!("MENU", "✅ Successfully emitted menu-new-note event"),
                Err(e) => log_error!("MENU", "❌ Failed to emit menu-new-note event: {}", e),
            }
        }
        "show-main-window" => {
            log_info!("MENU", "Show Main Window menu item selected");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
                log_info!("MENU", "✅ Main window shown and focused");
            } else {
                log_error!("MENU", "❌ Main window not found");
            }
        }
        "59" | "paste" => {
            log_info!("MENU", "Paste menu item selected - triggering paste");
            match app.emit("menu-paste", ()) {
                Ok(_) => log_info!("MENU", "✅ Paste event emitted"),
                Err(e) => log_error!("MENU", "❌ Failed to emit paste event: {}", e),
            }
        }
        "reload-app" => {
            log_info!("MENU", "Reload App menu item selected");
            if let Some(window) = app.get_webview_window("main") {
                match window.eval("window.location.reload()") {
                    Ok(_) => log_info!("MENU", "✅ App reloaded successfully"),
                    Err(e) => log_error!("MENU", "❌ Failed to reload app: {}", e),
                }
            } else {
                log_error!("MENU", "❌ Main window not found for reload");
            }
        }
        "restart-app" => {
            log_info!("MENU", "Restart App menu item selected");
            log_info!("MENU", "Restarting application...");
            app.restart();
        }
        "force-main-visible" => {
            log_info!("MENU", "Force Main Window Visible menu item selected");
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                match force_main_window_visible(app_handle).await {
                    Ok(_) => log_info!("MENU", "✅ Successfully forced main window visible"),
                    Err(e) => log_error!("MENU", "❌ Failed to force main window visible: {}", e),
                }
            });
        }
        id if id.starts_with("open-note-") => {
            let note_id = id.strip_prefix("open-note-").unwrap_or("").to_string();
            let app_handle = app.clone();

            // Open the note in a floating window
            tauri::async_runtime::spawn(async move {
                let detached_windows = app_handle.state::<DetachedWindowsState>();
                let windows_lock = detached_windows.lock().await;

                // Check if window already exists for this note
                if let Some((window_label, _)) = windows_lock
                    .iter()
                    .find(|(_, w)| w.note_id == note_id)
                {
                    // Window exists, just focus it
                    if let Some(window) = app_handle.get_webview_window(window_label) {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                } else {
                    // Create new window
                    drop(windows_lock);
                    let notes = app_handle.state::<NotesState>();
                    let request = CreateDetachedWindowRequest {
                        note_id: note_id.clone(),
                        x: None,
                        y: None,
                        width: None,
                        height: None,
                    };
                    let _ = create_detached_window(
                        request,
                        app_handle.clone(),
                        detached_windows.clone(),
                        notes.clone(),
                    )
                    .await;
                }
            });
        }
        _ => {}
    }
}