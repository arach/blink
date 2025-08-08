use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteRecord {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tags: Vec<String>,
    pub position: i32,
    pub file_hash: String,
}

pub struct NotesDatabase {
    conn: Mutex<Connection>,
}

impl NotesDatabase {
    /// Create a new database connection and initialize tables
    pub fn new(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        
        // Create tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                file_path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                position INTEGER NOT NULL,
                file_hash TEXT NOT NULL,
                UNIQUE(position)
            )",
            [],
        )?;
        
        // Create indexes for common queries
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notes_position ON notes(position)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at)",
            [],
        )?;
        
        // Create a metadata table for future use
        conn.execute(
            "CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;
        
        // Store database version
        conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES (?1, ?2, ?3)",
            params!["db_version", "1.0", Utc::now().to_rfc3339()],
        )?;
        
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
    
    /// Get all notes ordered by position
    pub fn get_all_notes(&self) -> Result<Vec<NoteRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, file_path, created_at, updated_at, tags, position, file_hash 
             FROM notes 
             ORDER BY position ASC"
        )?;
        
        let notes = stmt.query_map([], |row| {
            let tags_json: String = row.get(5)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            
            Ok(NoteRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                file_path: row.get(2)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                        3,
                        rusqlite::types::Type::Text,
                        Box::new(e)
                    ))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                        4,
                        rusqlite::types::Type::Text,
                        Box::new(e)
                    ))?
                    .with_timezone(&Utc),
                tags,
                position: row.get(6)?,
                file_hash: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        
        Ok(notes)
    }
    
    /// Get a note by ID
    pub fn get_note(&self, id: &str) -> Result<Option<NoteRecord>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT id, title, file_path, created_at, updated_at, tags, position, file_hash 
             FROM notes 
             WHERE id = ?1",
            params![id],
            |row| {
                let tags_json: String = row.get(5)?;
                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
                
                Ok(NoteRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    file_path: row.get(2)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                            3,
                            rusqlite::types::Type::Text,
                            Box::new(e)
                        ))?
                        .with_timezone(&Utc),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                            4,
                            rusqlite::types::Type::Text,
                            Box::new(e)
                        ))?
                        .with_timezone(&Utc),
                    tags,
                    position: row.get(6)?,
                    file_hash: row.get(7)?,
                })
            },
        ).optional()?;
        
        Ok(result)
    }
    
    /// Insert or update a note
    pub fn upsert_note(&self, note: &NoteRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let tags_json = serde_json::to_string(&note.tags)?;
        
        conn.execute(
            "INSERT OR REPLACE INTO notes 
             (id, title, file_path, created_at, updated_at, tags, position, file_hash)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                note.id,
                note.title,
                note.file_path,
                note.created_at.to_rfc3339(),
                note.updated_at.to_rfc3339(),
                tags_json,
                note.position,
                note.file_hash,
            ],
        )?;
        
        Ok(())
    }
    
    /// Delete a note by ID
    pub fn delete_note(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let rows_affected = conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(rows_affected > 0)
    }
    
    /// Update note position
    pub fn update_position(&self, id: &str, new_position: i32) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE notes SET position = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_position, Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }
    
    /// Get the next available position
    pub fn get_next_position(&self) -> Result<i32> {
        let conn = self.conn.lock().unwrap();
        let max_position: Option<i32> = conn
            .query_row(
                "SELECT MAX(position) FROM notes",
                [],
                |row| row.get(0),
            )
            .optional()?
            .flatten();
        
        Ok(max_position.unwrap_or(0) + 1)
    }
    
    /// Check if a note with the given ID exists
    pub fn note_exists(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM notes WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }
    
    /// Migrate from index.json to database
    pub fn migrate_from_json(&self, json_path: &Path) -> Result<()> {
        if !json_path.exists() {
            return Ok(());
        }
        
        let json_content = std::fs::read_to_string(json_path)?;
        let index_data: serde_json::Value = serde_json::from_str(&json_content)?;
        
        if let Some(notes) = index_data["notes"].as_object() {
            for (_key, value) in notes.iter() {
                let note = NoteRecord {
                    id: value["id"].as_str().unwrap_or_default().to_string(),
                    title: value["title"].as_str().unwrap_or_default().to_string(),
                    file_path: value["file_path"].as_str().unwrap_or_default().to_string(),
                    created_at: DateTime::parse_from_rfc3339(
                        value["created_at"].as_str().unwrap_or("2025-01-01T00:00:00Z")
                    )?.with_timezone(&Utc),
                    updated_at: DateTime::parse_from_rfc3339(
                        value["updated_at"].as_str().unwrap_or("2025-01-01T00:00:00Z")
                    )?.with_timezone(&Utc),
                    tags: value["tags"]
                        .as_array()
                        .map(|arr| arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                        )
                        .unwrap_or_default(),
                    position: value["position"].as_i64().unwrap_or(0) as i32,
                    file_hash: value["file_hash"].as_str().unwrap_or_default().to_string(),
                };
                
                self.upsert_note(&note)?;
            }
            
            log::info!("Successfully migrated {} notes from index.json to database", notes.len());
        }
        
        Ok(())
    }
    
    /// Reorder notes to ensure sequential positions
    pub fn reorder_positions(&self) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        
        // Get all notes ordered by current position
        let note_ids: Vec<String> = {
            let mut stmt = conn.prepare("SELECT id FROM notes ORDER BY position ASC")?;
            let mapped_rows = stmt.query_map([], |row| row.get(0))?;
            let ids: Result<Vec<_>, _> = mapped_rows.collect();
            ids?
        };
        
        // Update positions to be sequential
        let tx = conn.transaction()?;
        for (new_pos, id) in note_ids.iter().enumerate() {
            tx.execute(
                "UPDATE notes SET position = ?1 WHERE id = ?2",
                params![new_pos as i32 + 1, id],
            )?;
        }
        tx.commit()?;
        
        Ok(())
    }
}

/// Get the database path
pub fn get_database_path(data_dir: &Path) -> PathBuf {
    data_dir.join(".blink").join("notes.db")
}

/// Initialize the database, migrating from JSON if needed
pub fn initialize_database(data_dir: &Path) -> Result<NotesDatabase> {
    let db_path = get_database_path(data_dir);
    
    // Ensure .blink directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    
    let db = NotesDatabase::new(&db_path)?;
    
    // Migrate from index.json if it exists
    let json_path = data_dir.join(".blink").join("index.json");
    if json_path.exists() {
        log::info!("Found index.json, migrating to database...");
        db.migrate_from_json(&json_path)?;
        
        // Backup the old index.json
        let backup_path = json_path.with_extension("json.backup");
        std::fs::rename(&json_path, &backup_path)?;
        log::info!("Backed up index.json to {:?}", backup_path);
    }
    
    Ok(db)
}