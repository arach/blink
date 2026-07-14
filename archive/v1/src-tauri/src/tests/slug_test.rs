#[cfg(test)]
mod tests {
    use crate::utils::slug::{generate_slug, generate_unique_slug};
    use std::collections::HashSet;

    #[test]
    fn test_slug_generation() {
        // Test basic slug generation
        assert_eq!(generate_slug("Hello World"), "hello-world");
        assert_eq!(generate_slug("Test  Multiple   Spaces"), "test-multiple-spaces");
        assert_eq!(generate_slug("Special!@#$%^&*()Characters"), "special-characters");
        assert_eq!(generate_slug("Mix123Numbers"), "mix123numbers");
        assert_eq!(generate_slug("UPPERCASE"), "uppercase");
        assert_eq!(generate_slug(""), "");
        
        // Test uniqueness
        let mut existing = HashSet::new();
        existing.insert("hello-world".to_string());
        existing.insert("hello-world-2".to_string());
        
        assert_eq!(generate_unique_slug("Hello World", &existing), "hello-world-3");
        assert_eq!(generate_unique_slug("New Title", &existing), "new-title");
    }
    
    #[test]
    fn test_deterministic_slugs() {
        // Slugs should be deterministic - same input = same output
        let title = "My Amazing Note Title!";
        let slug1 = generate_slug(title);
        let slug2 = generate_slug(title);
        assert_eq!(slug1, slug2);
        assert_eq!(slug1, "my-amazing-note-title");
    }
}