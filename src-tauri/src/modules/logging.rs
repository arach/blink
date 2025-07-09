use chrono::Local;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use dirs;

// Initialize file logging
pub fn init_file_logging() -> Result<PathBuf, String> {
    // Create logs directory in app data folder
    let app_data_dir = dirs::data_dir()
        .ok_or("Could not find data directory")?
        .join("com.blink.dev");
    
    let logs_dir = app_data_dir.join("logs");
    std::fs::create_dir_all(&logs_dir)
        .map_err(|e| format!("Failed to create logs directory: {}", e))?;
    
    let log_file = logs_dir.join("blink.log");
    
    // Initialize env_logger to write to file
    let log_file_clone = log_file.clone();
    env_logger::Builder::from_default_env()
        .target(env_logger::Target::Pipe(Box::new(std::fs::File::create(&log_file_clone)
            .map_err(|e| format!("Failed to create log file: {}", e))?)))
        .format(|buf, record| {
            writeln!(buf, "[BLINK] [{}] [{}] [{}] {}",
                Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                record.level(),
                record.target(),
                record.args())
        })
        .init();
    
    println!("[BLINK] [{}] [LOGGING] Log file initialized at: {}", 
        Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
        log_file.display());
    
    Ok(log_file)
}

// Custom logger macro for Blink that logs to both console and file
#[macro_export]
macro_rules! blink_log {
    ($level:expr, $category:expr, $($arg:tt)*) => {{
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let message = format!($($arg)*);
        
        // Log to console (visible in dev mode)
        println!("[BLINK] [{}] [{}] [{}] {}", timestamp, $level, $category, message);
        
        // Log to file using standard log crate
        match $level {
            "ERROR" => log::error!(target: $category, "{}", message),
            "WARN" => log::warn!(target: $category, "{}", message),
            "INFO" => log::info!(target: $category, "{}", message),
            "DEBUG" => log::debug!(target: $category, "{}", message),
            _ => log::info!(target: $category, "{}", message),
        }
    }};
}

#[macro_export]
macro_rules! log_info {
    ($category:expr, $($arg:tt)*) => {{
        crate::blink_log!("INFO", $category, $($arg)*);
    }};
}

#[macro_export]
macro_rules! log_error {
    ($category:expr, $($arg:tt)*) => {{
        crate::blink_log!("ERROR", $category, $($arg)*);
    }};
}

#[macro_export]
macro_rules! log_debug {
    ($category:expr, $($arg:tt)*) => {{
        crate::blink_log!("DEBUG", $category, $($arg)*);
    }};
}

#[macro_export]
macro_rules! log_warn {
    ($category:expr, $($arg:tt)*) => {{
        crate::blink_log!("WARN", $category, $($arg)*);
    }};
}

// Command to get log file path
#[tauri::command]
pub async fn get_log_file_path() -> Result<String, String> {
    let app_data_dir = dirs::data_dir()
        .ok_or("Could not find data directory")?
        .join("com.blink.dev")
        .join("logs")
        .join("blink.log");
    
    Ok(app_data_dir.to_string_lossy().to_string())
}

// Command to get recent log entries
#[tauri::command]
pub async fn get_recent_logs(lines: Option<usize>) -> Result<String, String> {
    let app_data_dir = dirs::data_dir()
        .ok_or("Could not find data directory")?
        .join("com.blink.dev")
        .join("logs")
        .join("blink.log");
    
    if !app_data_dir.exists() {
        return Ok("Log file not found".to_string());
    }
    
    let content = std::fs::read_to_string(&app_data_dir)
        .map_err(|e| format!("Failed to read log file: {}", e))?;
    
    let lines_to_show = lines.unwrap_or(100);
    let recent_lines: Vec<&str> = content
        .lines()
        .rev()
        .take(lines_to_show)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    
    Ok(recent_lines.join("\n"))
}