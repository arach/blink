use std::collections::HashMap;
use tempfile::TempDir;
use chrono::Utc;

use crate::types::{
    config::AppConfig,
    note::Note,
};
use crate::modules::{
    file_notes_storage::FileNotesStorage,
    database::{initialize_database, NoteRecord},
};
use crate::{log_info, log_error};

fn create_test_note(id: &str, title: &str, content: &str, position: Option<i32>) -> Note {
    let now = Utc::now().to_rfc3339();
    Note {
        id: id.to_string(),
        title: title.to_string(),
        content: content.to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: vec![],
        position,
    }
}

fn create_test_config(temp_dir: &TempDir) -> AppConfig {
    let mut config = AppConfig::default();
    config.storage.notes_directory = Some(temp_dir.path().to_string_lossy().to_string());
    config.storage.use_custom_directory = true;
    config
}

#[tokio::test]
async fn test_position_zero_bug_reproduction() {
    log_info!("SIMPLIFIED_TEST", "🧪 Testing position 0 bug reproduction");
    
    let temp_dir = TempDir::new().unwrap();
    let config = create_test_config(&temp_dir);
    
    // Create notes with positions 0, 1, 2
    let notes = vec![
        create_test_note("zero-note", "Note at Position Zero", "ZERO_CONTENT_UNIQUE", Some(0)),
        create_test_note("one-note", "Note at Position One", "ONE_CONTENT_DIFFERENT", Some(1)),
        create_test_note("two-note", "Note at Position Two", "TWO_CONTENT_ANOTHER", Some(2)),
    ];
    
    let storage = FileNotesStorage::new(&config).unwrap();
    let mut notes_map = HashMap::new();
    for note in &notes {
        notes_map.insert(note.id.clone(), note.clone());
    }
    
    // Save all notes
    storage.save_all_notes(&notes_map).await.unwrap();
    
    // Load notes back (simulating app restart)
    let loaded_notes = storage.load_notes().await.unwrap();
    
    // Check that we have the right notes
    assert_eq!(loaded_notes.len(), 3, "Should have 3 notes");
    
    // Get position 0 note by finding it
    let pos_0_note = loaded_notes.values()
        .find(|n| n.position == Some(0))
        .expect("Should have a note at position 0");
    
    log_info!("SIMPLIFIED_TEST", "Position 0 note: {} -> '{}'", pos_0_note.title, pos_0_note.content);
    
    // Check it has the right content
    assert_eq!(pos_0_note.content, "ZERO_CONTENT_UNIQUE", "Position 0 should have correct content");
    assert_eq!(pos_0_note.title, "Note at Position Zero", "Position 0 should have correct title");
    
    // Simulate the get_notes sorting (from commands.rs)
    let mut sorted_notes: Vec<Note> = loaded_notes.values().cloned().collect();
    sorted_notes.sort_by(|a, b| {
        match (a.position, b.position) {
            (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => std::cmp::Ordering::Equal,
        }
    });
    
    // The first note in the sorted list should be position 0
    assert_eq!(sorted_notes[0].position, Some(0), "First note should be position 0");
    assert_eq!(sorted_notes[0].content, "ZERO_CONTENT_UNIQUE", "First note should have correct content");
    
    // Now simulate selecting different notes (get_note by ID) and re-getting the list
    for (i, note) in sorted_notes.iter().enumerate() {
        log_info!("SIMPLIFIED_TEST", "Simulating selection of note {}: {}", i, note.title);
        
        // Simulate get_note command
        let selected_note = loaded_notes.get(&note.id).unwrap();
        assert_eq!(selected_note.id, note.id, "Selected note should match");
        
        // Re-get the sorted list (simulating frontend refresh)
        let mut refreshed_sorted: Vec<Note> = loaded_notes.values().cloned().collect();
        refreshed_sorted.sort_by(|a, b| {
            match (a.position, b.position) {
                (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
        
        // CRITICAL TEST: Position 0 should still be the same
        assert_eq!(refreshed_sorted[0].position, Some(0), 
            "After selecting {}, position 0 should still be position 0", selected_note.title);
        assert_eq!(refreshed_sorted[0].content, "ZERO_CONTENT_UNIQUE", 
            "After selecting {}, position 0 content should be unchanged", selected_note.title);
        assert_eq!(refreshed_sorted[0].id, "zero-note", 
            "After selecting {}, position 0 ID should be unchanged", selected_note.title);
        
        log_info!("SIMPLIFIED_TEST", "  ✅ Position 0 stable after selecting {}", selected_note.title);
    }
    
    log_info!("SIMPLIFIED_TEST", "✅ Position 0 bug reproduction test passed");
}

#[tokio::test] 
async fn test_database_position_consistency() {
    log_info!("SIMPLIFIED_TEST", "🧪 Testing database position consistency");
    
    let temp_dir = TempDir::new().unwrap();
    let config = create_test_config(&temp_dir);
    
    // Create notes and save via file storage
    let notes = vec![
        create_test_note("db-zero", "DB Zero Note", "DB_ZERO_CONTENT", Some(0)),
        create_test_note("db-one", "DB One Note", "DB_ONE_CONTENT", Some(1)),
    ];
    
    let storage = FileNotesStorage::new(&config).unwrap();
    let mut notes_map = HashMap::new();
    for note in &notes {
        notes_map.insert(note.id.clone(), note.clone());
    }
    
    storage.save_all_notes(&notes_map).await.unwrap();
    
    // Load via database
    let db = initialize_database(temp_dir.path()).unwrap();
    let db_notes = db.get_all_notes().unwrap();
    
    log_info!("SIMPLIFIED_TEST", "Database returned {} notes", db_notes.len());
    
    // Find position 0 in database
    let db_pos_0 = db_notes.iter().find(|n| n.position == 0);
    assert!(db_pos_0.is_some(), "Database should have a note at position 0");
    
    let db_pos_0 = db_pos_0.unwrap();
    assert_eq!(db_pos_0.id, "db-zero", "Database position 0 should be correct note");
    
    // Load via file system
    let file_notes = storage.load_notes().await.unwrap();
    let file_pos_0 = file_notes.values().find(|n| n.position == Some(0));
    assert!(file_pos_0.is_some(), "File system should have a note at position 0");
    
    let file_pos_0 = file_pos_0.unwrap();
    assert_eq!(file_pos_0.id, "db-zero", "File system position 0 should be correct note");
    
    // They should match
    assert_eq!(db_pos_0.id, file_pos_0.id, "Database and file system should agree on position 0 ID");
    
    log_info!("SIMPLIFIED_TEST", "✅ Database position consistency test passed");
}

#[tokio::test]
async fn test_position_zero_vs_none() {
    log_info!("SIMPLIFIED_TEST", "🧪 Testing position 0 vs None handling");
    
    let temp_dir = TempDir::new().unwrap();
    let config = create_test_config(&temp_dir);
    
    let notes = vec![
        create_test_note("has-zero", "Has Zero Position", "ZERO_POS_CONTENT", Some(0)),
        create_test_note("has-none", "Has None Position", "NONE_POS_CONTENT", None),
    ];
    
    let storage = FileNotesStorage::new(&config).unwrap();
    let mut notes_map = HashMap::new();
    for note in &notes {
        notes_map.insert(note.id.clone(), note.clone());
    }
    
    storage.save_all_notes(&notes_map).await.unwrap();
    let loaded_notes = storage.load_notes().await.unwrap();
    
    // Sort as the get_notes command does
    let mut sorted_notes: Vec<Note> = loaded_notes.values().cloned().collect();
    sorted_notes.sort_by(|a, b| {
        match (a.position, b.position) {
            (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => std::cmp::Ordering::Equal,
        }
    });
    
    // Position 0 should come first, None should come second
    assert_eq!(sorted_notes.len(), 2, "Should have 2 notes");
    assert_eq!(sorted_notes[0].position, Some(0), "First note should have position 0");
    assert_eq!(sorted_notes[0].content, "ZERO_POS_CONTENT", "First note should have right content");
    assert_eq!(sorted_notes[1].position, None, "Second note should have position None");
    assert_eq!(sorted_notes[1].content, "NONE_POS_CONTENT", "Second note should have right content");
    
    log_info!("SIMPLIFIED_TEST", "✅ Position 0 vs None test passed");
}