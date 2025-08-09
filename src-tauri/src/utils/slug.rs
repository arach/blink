use std::collections::HashSet;

/// Generate a slug from a title with explicit rules:
/// 1. Convert to lowercase
/// 2. Replace spaces with single hyphen
/// 3. Replace multiple consecutive spaces with single hyphen
/// 4. Allow only: a-z, 0-9, hyphen, underscore
/// 5. Replace any other character with hyphen
/// 6. Collapse multiple consecutive hyphens into one
/// 7. Trim hyphens from start and end
pub fn generate_slug(title: &str) -> String {
    let slug = title
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'a'..='z' | '0'..='9' => c,
            ' ' | '-' | '_' => '-',  // spaces and special chars become hyphens
            _ => '-',  // any other character becomes hyphen
        })
        .collect::<String>();
    
    // Collapse multiple hyphens and trim
    let parts: Vec<&str> = slug
        .split('-')
        .filter(|s| !s.is_empty())
        .collect();
    
    if parts.is_empty() {
        // If title was all special characters, generate a default
        "untitled".to_string()
    } else {
        parts.join("-")
    }
}

/// Generate a unique slug by appending a number if needed
pub fn generate_unique_slug(title: &str, existing_ids: &HashSet<String>) -> String {
    let base_slug = generate_slug(title);
    
    // If the base slug doesn't exist, use it
    if !existing_ids.contains(&base_slug) {
        return base_slug;
    }
    
    // Otherwise, append a number until we find a unique one
    let mut counter = 2;
    loop {
        let slug = format!("{}-{}", base_slug, counter);
        if !existing_ids.contains(&slug) {
            return slug;
        }
        counter += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_slug() {
        assert_eq!(generate_slug("Hello World"), "hello-world");
        assert_eq!(generate_slug("Test  Multiple   Spaces"), "test-multiple-spaces");
        assert_eq!(generate_slug("Special!@#$%^&*()Characters"), "special-characters");
        assert_eq!(generate_slug("Mix123Numbers"), "mix123numbers");
        assert_eq!(generate_slug("UPPERCASE"), "uppercase");
        assert_eq!(generate_slug(""), "");
    }

    #[test]
    fn test_generate_unique_slug() {
        let mut existing = HashSet::new();
        existing.insert("hello-world".to_string());
        existing.insert("hello-world-2".to_string());
        
        assert_eq!(generate_unique_slug("Hello World", &existing), "hello-world-3");
        assert_eq!(generate_unique_slug("New Title", &existing), "new-title");
    }
}