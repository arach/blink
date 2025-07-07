use chrono::Local;

// Custom logger macro for Blink
#[macro_export]
macro_rules! notes_log {
    ($level:expr, $category:expr, $($arg:tt)*) => {{
        println!("[BLINK] [{}] [{}] [{}] {}", 
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"), 
            $level, 
            $category, 
            format!($($arg)*));
    }};
}

#[macro_export]
macro_rules! log_info {
    ($category:expr, $($arg:tt)*) => {{
        crate::notes_log!("INFO", $category, $($arg)*);
    }};
}

#[macro_export]
macro_rules! log_error {
    ($category:expr, $($arg:tt)*) => {{
        crate::notes_log!("ERROR", $category, $($arg)*);
    }};
}

#[macro_export]
macro_rules! log_debug {
    ($category:expr, $($arg:tt)*) => {{
        crate::notes_log!("DEBUG", $category, $($arg)*);
    }};
}