use std::collections::HashMap;
use tempfile::TempDir;
use uuid::Uuid;

use crate::types::{
    config::AppConfig,
    note::Note,
};
use crate::modules::{
    file_notes_storage::FileNotesStorage,
    file_storage::FileStorageManager,
    database::{initialize_database, NoteRecord},
};
use crate::{log_info, log_error, log_debug};

/// Test utilities and setup functions
mod test_utils {
    use super::*;
    use chrono::Utc;

    pub fn create_test_note(id: &str, title: &str, content: &str, position: Option<i32>) -> Note {
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

    pub fn create_test_config(temp_dir: &TempDir) -> AppConfig {
        let mut config = AppConfig::default();
        config.storage.notes_directory = Some(temp_dir.path().to_string_lossy().to_string());
        config.storage.use_custom_directory = true;
        config
    }

    pub fn print_notes_debug_info(notes: &[Note], test_name: &str) {
        log_info!("TEST_DEBUG", "=== {} ===", test_name);
        for (i, note) in notes.iter().enumerate() {
            let id_short = if note.id.len() >= 8 { &note.id[..8] } else { &note.id };
            log_info!("TEST_DEBUG", "  [{}] {} (id={}, pos={:?})", 
                i, note.title, id_short, note.position);
        }
        log_info!("TEST_DEBUG", "=== End {} ===", test_name);
    }
    
    pub fn print_hashmap_debug_info(notes: &HashMap<String, Note>, test_name: &str) {
        log_info!("TEST_DEBUG", "=== {} HashMap ===", test_name);
        for (key, note) in notes.iter() {
            let key_short = if key.len() >= 8 { &key[..8] } else { key };
            log_info!("TEST_DEBUG", "  {} -> {} (pos={:?})", key_short, note.title, note.position);
        }
        log_info!("TEST_DEBUG", "=== End {} HashMap ===", test_name);
    }
}

/// Test position 0 handling in various scenarios
#[cfg(test)]
mod position_zero_tests {
    use super::*;
    use test_utils::*;

    #[tokio::test]
    async fn test_position_0_with_valid_note() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing position 0 with valid note");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        // Create notes with positions 0, 1, 2
        let notes = vec![
            create_test_note("note-0", "First Note", "Content of first note", Some(0)),
            create_test_note("note-1", "Second Note", "Content of second note", Some(1)),
            create_test_note("note-2", "Third Note", "Content of third note", Some(2)),
        ];
        
        let storage = FileNotesStorage::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
        }
        
        // Save all notes
        storage.save_all_notes(&notes_map).await.unwrap();
        
        // Load notes back
        let loaded_notes = storage.load_notes().await.unwrap();
        print_hashmap_debug_info(&loaded_notes, "Loaded Notes with Position 0");
        
        // Convert to sorted vector (like get_notes command does)
        let mut notes_vec: Vec<Note> = loaded_notes.values().cloned().collect();
        notes_vec.sort_by(|a, b| {
            match (a.position, b.position) {
                (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
        
        print_notes_debug_info(&notes_vec, "Sorted Notes Vec");
        
        // CRITICAL TEST: Verify position 0 note is actually at index 0
        assert_eq!(notes_vec.len(), 3);
        assert_eq!(notes_vec[0].position, Some(0), "Note at index 0 should have position 0");
        assert_eq!(notes_vec[0].title, "First Note", "Note at index 0 should be 'First Note'");
        assert_eq!(notes_vec[0].content, "Content of first note", "Position 0 note content should be correct");
        
        // Test get_note_by_id for position 0 note
        let retrieved_note_0 = loaded_notes.get("note-0").unwrap();
        assert_eq!(retrieved_note_0.title, "First Note");
        assert_eq!(retrieved_note_0.content, "Content of first note");
        assert_eq!(retrieved_note_0.position, Some(0));
        
        log_info!("POSITION_BUG_TEST", "✅ Position 0 test passed");
    }

    #[tokio::test]
    async fn test_position_0_vs_none_handling() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing position 0 vs None handling");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        // Create notes: one with position 0, one with None
        let notes = vec![
            create_test_note("note-zero", "Note with Position 0", "Content 0", Some(0)),
            create_test_note("note-none", "Note with No Position", "Content None", None),
        ];
        
        let storage = FileNotesStorage::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
        }
        
        storage.save_all_notes(&notes_map).await.unwrap();
        let loaded_notes = storage.load_notes().await.unwrap();
        
        print_hashmap_debug_info(&loaded_notes, "Position 0 vs None");
        
        // Sort as the get_notes command does
        let mut notes_vec: Vec<Note> = loaded_notes.values().cloned().collect();
        notes_vec.sort_by(|a, b| {
            match (a.position, b.position) {
                (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
        
        print_notes_debug_info(&notes_vec, "Sorted: Position 0 vs None");
        
        // Position 0 should come first (index 0), None should come second (index 1)
        assert_eq!(notes_vec[0].position, Some(0), "First note should have position 0");
        assert_eq!(notes_vec[0].title, "Note with Position 0");
        assert_eq!(notes_vec[1].position, None, "Second note should have position None");
        assert_eq!(notes_vec[1].title, "Note with No Position");
        
        log_info!("POSITION_BUG_TEST", "✅ Position 0 vs None test passed");
    }

    #[tokio::test]
    async fn test_position_conflict_at_zero() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing multiple notes with position 0 (conflict)");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        // Create two notes both claiming position 0
        let notes = vec![
            create_test_note("note-first", "First Claim to 0", "First content", Some(0)),
            create_test_note("note-second", "Second Claim to 0", "Second content", Some(0)),
        ];
        
        let storage = FileNotesStorage::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
        }
        
        storage.save_all_notes(&notes_map).await.unwrap();
        
        // Load notes - FileStorage should fix position conflicts
        let loaded_notes = storage.load_notes().await.unwrap();
        print_hashmap_debug_info(&loaded_notes, "After Position Conflict Resolution");
        
        // Verify that position conflicts were resolved
        let positions: Vec<Option<i32>> = loaded_notes.values()
            .map(|n| n.position)
            .collect();
        
        // Should have positions 0 and 1 (or 1 and 2, depending on resolution order)
        let mut sorted_positions = positions.clone();
        sorted_positions.sort();
        
        assert_ne!(positions[0], positions[1], "Positions should be different after conflict resolution");
        
        // One should have position 0, the other should have position 1
        let has_zero = positions.iter().any(|&p| p == Some(0));
        let has_one = positions.iter().any(|&p| p == Some(1));
        assert!(has_zero, "One note should have position 0");
        assert!(has_one, "One note should have position 1");
        
        log_info!("POSITION_BUG_TEST", "✅ Position conflict test passed");
    }

    #[tokio::test]
    async fn test_selecting_different_notes_position_0_consistency() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing position 0 consistency when selecting different notes");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        // Create several notes with different positions
        let notes = vec![
            create_test_note("note-0", "Position Zero Note", "This should always be at position 0", Some(0)),
            create_test_note("note-1", "Position One Note", "This is at position 1", Some(1)),
            create_test_note("note-2", "Position Two Note", "This is at position 2", Some(2)),
        ];
        
        let storage = FileNotesStorage::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
        }
        
        storage.save_all_notes(&notes_map).await.unwrap();
        let loaded_notes = storage.load_notes().await.unwrap();
        
        // Get the position 0 note content for comparison
        let position_0_note = loaded_notes.values()
            .find(|n| n.position == Some(0))
            .expect("Should have a note with position 0");
        
        let expected_position_0_content = position_0_note.content.clone();
        log_info!("POSITION_BUG_TEST", "Position 0 note content: {}", expected_position_0_content);
        
        // Simulate multiple "get note by ID" calls for different notes
        for (i, (note_id, _)) in loaded_notes.iter().enumerate() {
            log_info!("POSITION_BUG_TEST", "Selecting note {} ({})", i, note_id);
            
            // Get the selected note
            let selected_note = loaded_notes.get(note_id).unwrap();
            log_info!("POSITION_BUG_TEST", "  Selected: {} (pos={:?})", selected_note.title, selected_note.position);
            
            // Re-get the sorted list (simulating frontend refresh)
            let mut sorted_notes: Vec<Note> = loaded_notes.values().cloned().collect();
            sorted_notes.sort_by(|a, b| {
                match (a.position, b.position) {
                    (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                    (Some(_), None) => std::cmp::Ordering::Less,
                    (None, Some(_)) => std::cmp::Ordering::Greater,
                    (None, None) => std::cmp::Ordering::Equal,
                }
            });
            
            // CRITICAL: Position 0 content should NEVER change regardless of what note was selected
            let current_position_0_note = &sorted_notes[0];
            assert_eq!(current_position_0_note.position, Some(0), 
                "After selecting {}, position 0 should still be position 0", selected_note.title);
            assert_eq!(current_position_0_note.content, expected_position_0_content,
                "After selecting {}, position 0 content should remain unchanged: expected '{}', got '{}'", 
                selected_note.title, expected_position_0_content, current_position_0_note.content);
            
            log_info!("POSITION_BUG_TEST", "  ✅ Position 0 remains consistent: {}", current_position_0_note.title);
        }
        
        log_info!("POSITION_BUG_TEST", "✅ Position 0 consistency test passed");
    }

    #[tokio::test]
    async fn test_database_vs_file_system_consistency() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing database vs file system consistency for position 0");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        let notes = vec![
            create_test_note("db-note-0", "Database Note 0", "DB content 0", Some(0)),
            create_test_note("db-note-1", "Database Note 1", "DB content 1", Some(1)),
        ];
        
        // Save via file storage
        let storage = FileStorageManager::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
            storage.save_note(note).await.unwrap();
        }
        storage.update_notes_index(&notes_map).await.unwrap();
        
        // Load via database
        let db = initialize_database(temp_dir.path()).unwrap();
        let db_notes = db.get_all_notes().unwrap();
        
        log_info!("POSITION_BUG_TEST", "Database notes:");
        for note in &db_notes {
            log_info!("POSITION_BUG_TEST", "  DB: {} (pos={})", note.title, note.position);
        }
        
        // Load via file storage
        let file_notes = storage.load_notes().await.unwrap();
        
        log_info!("POSITION_BUG_TEST", "File system notes:");
        for (_, note) in &file_notes {
            log_info!("POSITION_BUG_TEST", "  FILE: {} (pos={:?})", note.title, note.position);
        }
        
        // Compare position 0 notes
        let db_pos_0 = db_notes.iter().find(|n| n.position == 0).unwrap();
        let file_pos_0 = file_notes.values().find(|n| n.position == Some(0)).unwrap();
        
        assert_eq!(db_pos_0.id, file_pos_0.id, "Position 0 IDs should match between DB and file");
        assert_eq!(db_pos_0.title, file_pos_0.title, "Position 0 titles should match between DB and file");
        
        log_info!("POSITION_BUG_TEST", "✅ Database vs file system consistency test passed");
    }

    #[tokio::test] 
    async fn test_concurrent_note_access_position_0() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing concurrent access to position 0 note");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        let notes = vec![
            create_test_note("concurrent-0", "Concurrent Note 0", "Concurrent content 0", Some(0)),
            create_test_note("concurrent-1", "Concurrent Note 1", "Concurrent content 1", Some(1)),
            create_test_note("concurrent-2", "Concurrent Note 2", "Concurrent content 2", Some(2)),
        ];
        
        let storage = FileNotesStorage::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
        }
        
        storage.save_all_notes(&notes_map).await.unwrap();
        
        // Simulate concurrent reads (like multiple windows accessing notes)
        let mut handles = vec![];
        
        for i in 0..5 {
            let storage_clone = FileNotesStorage::new(&config).unwrap();
            let handle = tokio::spawn(async move {
                let loaded_notes = storage_clone.load_notes().await.unwrap();
                let mut sorted_notes: Vec<Note> = loaded_notes.values().cloned().collect();
                sorted_notes.sort_by(|a, b| {
                    match (a.position, b.position) {
                        (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                        (Some(_), None) => std::cmp::Ordering::Less,
                        (None, Some(_)) => std::cmp::Ordering::Greater,
                        (None, None) => std::cmp::Ordering::Equal,
                    }
                });
                
                (i, sorted_notes[0].clone()) // Return the position 0 note
            });
            handles.push(handle);
        }
        
        // Collect all results
        let mut results = vec![];
        for handle in handles {
            results.push(handle.await.unwrap());
        }
        
        // All position 0 notes should be identical
        let first_result = &results[0].1;
        for (i, (thread_id, note)) in results.iter().enumerate() {
            assert_eq!(note.id, first_result.id, 
                "Thread {} got different position 0 ID: {} vs {}", thread_id, note.id, first_result.id);
            assert_eq!(note.content, first_result.content,
                "Thread {} got different position 0 content", thread_id);
            log_info!("POSITION_BUG_TEST", "Thread {} got consistent position 0: {}", thread_id, note.title);
        }
        
        log_info!("POSITION_BUG_TEST", "✅ Concurrent access test passed");
    }

    #[tokio::test]
    async fn test_negative_position_handling() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing negative position handling");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        let notes = vec![
            create_test_note("negative-pos", "Negative Position Note", "Should be fixed", Some(-1)),
            create_test_note("zero-pos", "Zero Position Note", "Should stay at 0", Some(0)),
        ];
        
        let storage = FileStorageManager::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
        }
        
        // Load notes - should fix negative positions
        let loaded_notes = storage.load_notes().await.unwrap();
        
        // All positions should be >= 0
        for (_, note) in &loaded_notes {
            if let Some(pos) = note.position {
                assert!(pos >= 0, "Note {} has negative position {}", note.id, pos);
            }
        }
        
        // Should have notes at positions 0 and 1 (or higher)
        let positions: Vec<i32> = loaded_notes.values()
            .filter_map(|n| n.position)
            .collect();
        
        assert!(positions.contains(&0), "Should have a note at position 0");
        
        log_info!("POSITION_BUG_TEST", "✅ Negative position handling test passed");
    }

    #[tokio::test]
    async fn test_note_creation_position_assignment() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing position assignment for new notes");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        // Start with one note at position 0
        let existing_note = create_test_note("existing", "Existing Note", "Already here", Some(0));
        
        let storage = FileNotesStorage::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        notes_map.insert(existing_note.id.clone(), existing_note.clone());
        storage.save_all_notes(&notes_map).await.unwrap();
        
        // Simulate creating a new note (like create_note command does)
        let loaded_notes = storage.load_notes().await.unwrap();
        let max_position = loaded_notes.values()
            .filter_map(|n| n.position)
            .max()
            .unwrap_or(-1);
        
        let new_note = create_test_note("new-note", "New Note", "Just created", Some(max_position + 1));
        
        // Save the new note
        let mut updated_notes = loaded_notes;
        updated_notes.insert(new_note.id.clone(), new_note.clone());
        storage.save_all_notes(&updated_notes).await.unwrap();
        
        // Reload and verify positions
        let final_notes = storage.load_notes().await.unwrap();
        let mut sorted_notes: Vec<Note> = final_notes.values().cloned().collect();
        sorted_notes.sort_by(|a, b| {
            match (a.position, b.position) {
                (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
        
        assert_eq!(sorted_notes.len(), 2);
        assert_eq!(sorted_notes[0].position, Some(0));
        assert_eq!(sorted_notes[0].title, "Existing Note");
        assert_eq!(sorted_notes[1].position, Some(1));
        assert_eq!(sorted_notes[1].title, "New Note");
        
        log_info!("POSITION_BUG_TEST", "✅ Note creation position assignment test passed");
    }
}

/// Test position handling edge cases and database interactions
#[cfg(test)]
mod database_position_tests {
    use super::*;
    use test_utils::*;

    #[tokio::test]
    async fn test_database_position_uniqueness_constraint() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing database position uniqueness constraint");
        
        let temp_dir = TempDir::new().unwrap();
        let db = initialize_database(temp_dir.path()).unwrap();
        
        let note1 = NoteRecord {
            id: "db-test-1".to_string(),
            title: "First Note".to_string(),
            file_path: "first.md".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            tags: vec![],
            position: 0,
            file_hash: "hash1".to_string(),
        };
        
        let note2 = NoteRecord {
            id: "db-test-2".to_string(),
            title: "Second Note".to_string(),
            file_path: "second.md".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            tags: vec![],
            position: 0, // Same position as note1
            file_hash: "hash2".to_string(),
        };
        
        // Insert first note
        db.upsert_note(&note1).unwrap();
        
        // Try to insert second note with same position
        // This should either succeed (replacing) or fail (constraint violation)
        match db.upsert_note(&note2) {
            Ok(_) => {
                // If it succeeded, verify only one note has position 0
                let all_notes = db.get_all_notes().unwrap();
                let position_0_notes: Vec<_> = all_notes.iter()
                    .filter(|n| n.position == 0)
                    .collect();
                
                // Should have exactly one note at position 0
                assert_eq!(position_0_notes.len(), 1, 
                    "Should have exactly one note at position 0, got {}", position_0_notes.len());
                
                log_info!("POSITION_BUG_TEST", "Database allowed position override - {} is now at position 0", 
                    position_0_notes[0].title);
            }
            Err(e) => {
                log_info!("POSITION_BUG_TEST", "Database prevented position conflict: {}", e);
                // This is also acceptable behavior
            }
        }
        
        log_info!("POSITION_BUG_TEST", "✅ Database position uniqueness test passed");
    }

    #[tokio::test]
    async fn test_database_ordering_vs_application_ordering() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing database ordering vs application ordering");
        
        let temp_dir = TempDir::new().unwrap();
        let db = initialize_database(temp_dir.path()).unwrap();
        
        // Insert notes in non-sequential order
        let notes = vec![
            NoteRecord {
                id: "order-2".to_string(),
                title: "Should be Third".to_string(),
                file_path: "third.md".to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                tags: vec![],
                position: 2,
                file_hash: "hash3".to_string(),
            },
            NoteRecord {
                id: "order-0".to_string(),
                title: "Should be First".to_string(),
                file_path: "first.md".to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                tags: vec![],
                position: 0,
                file_hash: "hash1".to_string(),
            },
            NoteRecord {
                id: "order-1".to_string(),
                title: "Should be Second".to_string(),
                file_path: "second.md".to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                tags: vec![],
                position: 1,
                file_hash: "hash2".to_string(),
            },
        ];
        
        // Insert in random order
        for note in &notes {
            db.upsert_note(note).unwrap();
        }
        
        // Get notes from database (should be ordered by position)
        let db_notes = db.get_all_notes().unwrap();
        
        log_info!("POSITION_BUG_TEST", "Database returned notes in order:");
        for (i, note) in db_notes.iter().enumerate() {
            log_info!("POSITION_BUG_TEST", "  [{}] {} (pos={})", i, note.title, note.position);
        }
        
        // Verify database ordering
        assert_eq!(db_notes.len(), 3);
        assert_eq!(db_notes[0].position, 0);
        assert_eq!(db_notes[0].title, "Should be First");
        assert_eq!(db_notes[1].position, 1);
        assert_eq!(db_notes[1].title, "Should be Second");
        assert_eq!(db_notes[2].position, 2);
        assert_eq!(db_notes[2].title, "Should be Third");
        
        log_info!("POSITION_BUG_TEST", "✅ Database ordering test passed");
    }
}

/// Test race conditions and edge cases that might cause the position 0 bug
#[cfg(test)]
mod race_condition_tests {
    use super::*;
    use test_utils::*;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    #[tokio::test]
    async fn test_concurrent_note_updates_position_0() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing concurrent updates affecting position 0");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        // Setup initial notes
        let notes = vec![
            create_test_note("race-0", "Race Note 0", "Original content 0", Some(0)),
            create_test_note("race-1", "Race Note 1", "Original content 1", Some(1)),
        ];
        
        let storage = FileNotesStorage::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
        }
        storage.save_all_notes(&notes_map).await.unwrap();
        
        // Shared state for concurrent access
        let shared_storage = Arc::new(RwLock::new(storage));
        
        // Spawn concurrent tasks that modify different notes
        let mut handles = vec![];
        
        for i in 0..3 {
            let storage_clone = Arc::clone(&shared_storage);
            let handle = tokio::spawn(async move {
                let storage = storage_clone.read().await;
                
                // Each task updates a different note
                let mut loaded_notes = storage.load_notes().await.unwrap();
                
                if i == 0 {
                    // Update position 0 note
                    if let Some(note) = loaded_notes.get_mut("race-0") {
                        note.content = format!("Modified by task {} at position 0", i);
                        note.updated_at = chrono::Utc::now().to_rfc3339();
                    }
                } else if i == 1 {
                    // Update position 1 note
                    if let Some(note) = loaded_notes.get_mut("race-1") {
                        note.content = format!("Modified by task {} at position 1", i);
                        note.updated_at = chrono::Utc::now().to_rfc3339();
                    }
                } else {
                    // Task 2 just reads and returns position 0
                    let sorted_notes: Vec<Note> = {
                        let mut notes_vec: Vec<Note> = loaded_notes.values().cloned().collect();
                        notes_vec.sort_by(|a, b| {
                            match (a.position, b.position) {
                                (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                                (Some(_), None) => std::cmp::Ordering::Less,
                                (None, Some(_)) => std::cmp::Ordering::Greater,
                                (None, None) => std::cmp::Ordering::Equal,
                            }
                        });
                        notes_vec
                    };
                    
                    return (i, sorted_notes[0].content.clone());
                }
                
                // Save changes
                if i < 2 {
                    storage.save_all_notes(&loaded_notes).await.unwrap();
                }
                
                // Return the position 0 content after our operation
                let final_notes = storage.load_notes().await.unwrap();
                let mut sorted_notes: Vec<Note> = final_notes.values().cloned().collect();
                sorted_notes.sort_by(|a, b| {
                    match (a.position, b.position) {
                        (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                        (Some(_), None) => std::cmp::Ordering::Less,
                        (None, Some(_)) => std::cmp::Ordering::Greater,
                        (None, None) => std::cmp::Ordering::Equal,
                    }
                });
                
                (i, sorted_notes[0].content.clone())
            });
            handles.push(handle);
        }
        
        // Wait for all tasks to complete
        let results = futures::future::join_all(handles).await;
        
        log_info!("POSITION_BUG_TEST", "Race condition results:");
        for result in &results {
            let (task_id, content) = result.as_ref().unwrap();
            log_info!("POSITION_BUG_TEST", "  Task {}: Position 0 content = '{}'", task_id, content);
        }
        
        // After all concurrent operations, verify consistency
        let final_storage = FileNotesStorage::new(&config).unwrap();
        let final_notes = final_storage.load_notes().await.unwrap();
        let mut final_sorted: Vec<Note> = final_notes.values().cloned().collect();
        final_sorted.sort_by(|a, b| {
            match (a.position, b.position) {
                (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
        
        // Position 0 should still be at position 0
        assert_eq!(final_sorted[0].position, Some(0), "Position 0 should remain at position 0");
        assert_eq!(final_sorted[0].id, "race-0", "Position 0 should still be the same note ID");
        
        log_info!("POSITION_BUG_TEST", "Final position 0 content: '{}'", final_sorted[0].content);
        log_info!("POSITION_BUG_TEST", "✅ Concurrent update race condition test passed");
    }

    #[tokio::test]
    async fn test_position_0_content_corruption() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing for position 0 content corruption bug");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        // Create notes with very different content
        let notes = vec![
            create_test_note("content-0", "Note Zero", "CONTENT_ZERO_UNIQUE_MARKER_12345", Some(0)),
            create_test_note("content-1", "Note One", "CONTENT_ONE_DIFFERENT_MARKER_67890", Some(1)),
            create_test_note("content-2", "Note Two", "CONTENT_TWO_ANOTHER_MARKER_ABCDE", Some(2)),
        ];
        
        let storage = FileNotesStorage::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
        }
        storage.save_all_notes(&notes_map).await.unwrap();
        
        // Record the expected position 0 content
        let expected_position_0_content = "CONTENT_ZERO_UNIQUE_MARKER_12345";
        
        // Simulate the bug scenario: rapidly switching between notes
        for round in 0..10 {
            log_info!("POSITION_BUG_TEST", "Round {}: Simulating note selection switching", round);
            
            // Load notes (simulating app startup or refresh)
            let loaded_notes = storage.load_notes().await.unwrap();
            
            // "Select" each note by ID (simulating user clicks)
            for (note_id, note) in &loaded_notes {
                log_debug!("POSITION_BUG_TEST", "  Selecting note: {} ({})", note.title, &note_id[..8]);
                
                // Get sorted list (simulating get_notes command)
                let mut sorted_notes: Vec<Note> = loaded_notes.values().cloned().collect();
                sorted_notes.sort_by(|a, b| {
                    match (a.position, b.position) {
                        (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                        (Some(_), None) => std::cmp::Ordering::Less,
                        (None, Some(_)) => std::cmp::Ordering::Greater,
                        (None, None) => std::cmp::Ordering::Equal,
                    }
                });
                
                // CRITICAL CHECK: Position 0 content should never change
                let position_0_note = &sorted_notes[0];
                if position_0_note.content != expected_position_0_content {
                    log_error!("POSITION_BUG_TEST", "🚨 BUG DETECTED! Position 0 content corrupted!");
                    log_error!("POSITION_BUG_TEST", "  Expected: '{}'", expected_position_0_content);
                    log_error!("POSITION_BUG_TEST", "  Got:      '{}'", position_0_note.content);
                    log_error!("POSITION_BUG_TEST", "  After selecting: {}", note.title);
                    
                    panic!("Position 0 content corruption detected!");
                }
                
                // Also check that the position 0 note has the right ID
                assert_eq!(position_0_note.id, "content-0", 
                    "Position 0 note ID changed after selecting {}", note.title);
            }
        }
        
        log_info!("POSITION_BUG_TEST", "✅ Position 0 content corruption test passed (no corruption detected)");
    }
}

/// Integration tests that simulate the exact commands used by the frontend
#[cfg(test)]
mod integration_tests {
    use super::*;
    use test_utils::*;

    /// Simulate the exact sequence of calls that the frontend makes
    #[tokio::test]
    async fn test_frontend_command_sequence() {
        log_info!("POSITION_BUG_TEST", "🧪 Testing frontend command sequence simulation");
        
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        
        // Setup initial notes
        let notes = vec![
            create_test_note("frontend-0", "Frontend Note 0", "Frontend content 0", Some(0)),
            create_test_note("frontend-1", "Frontend Note 1", "Frontend content 1", Some(1)),
            create_test_note("frontend-2", "Frontend Note 2", "Frontend content 2", Some(2)),
        ];
        
        let storage = FileNotesStorage::new(&config).unwrap();
        let mut notes_map = HashMap::new();
        for note in &notes {
            notes_map.insert(note.id.clone(), note.clone());
        }
        storage.save_all_notes(&notes_map).await.unwrap();
        
        // Simulate frontend command sequence
        
        // 1. App starts, calls get_notes
        let loaded_notes = storage.load_notes().await.unwrap();
        let mut initial_notes_list = simulate_get_notes_command(&loaded_notes);
        print_notes_debug_info(&initial_notes_list, "Initial get_notes");
        
        let original_position_0_content = initial_notes_list[0].content.clone();
        log_info!("POSITION_BUG_TEST", "Original position 0 content: '{}'", original_position_0_content);
        
        // 2. User selects different notes (simulating get_note calls)
        for i in 0..initial_notes_list.len() {
            let selected_note_id = &initial_notes_list[i].id;
            log_info!("POSITION_BUG_TEST", "Simulating user selecting note {} ({})", i, selected_note_id);
            
            // Simulate get_note command
            let selected_note = simulate_get_note_command(&loaded_notes, selected_note_id).unwrap();
            log_info!("POSITION_BUG_TEST", "  Selected note: {} (pos={:?})", selected_note.title, selected_note.position);
            
            // Simulate get_notes command again (frontend refreshing list)
            let refreshed_notes_list = simulate_get_notes_command(&loaded_notes);
            
            // CRITICAL: Position 0 should be unchanged
            assert_eq!(refreshed_notes_list[0].content, original_position_0_content,
                "Position 0 content changed after selecting note {} ({})", i, selected_note.title);
            assert_eq!(refreshed_notes_list[0].id, initial_notes_list[0].id,
                "Position 0 ID changed after selecting note {} ({})", i, selected_note.title);
            
            log_info!("POSITION_BUG_TEST", "  ✅ Position 0 remained stable after selecting note {}", i);
        }
        
        log_info!("POSITION_BUG_TEST", "✅ Frontend command sequence test passed");
    }

    /// Simulate the get_notes command (from commands.rs)
    fn simulate_get_notes_command(notes_map: &HashMap<String, Note>) -> Vec<Note> {
        let mut notes_vec: Vec<Note> = notes_map.values().cloned().collect();
        
        // Exact same sorting logic as in commands.rs get_notes function
        notes_vec.sort_by(|a, b| {
            match (a.position, b.position) {
                (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
        
        notes_vec
    }
    
    /// Simulate the get_note command (from commands.rs)
    fn simulate_get_note_command(notes_map: &HashMap<String, Note>, id: &str) -> Option<Note> {
        notes_map.get(id).cloned()
    }
}