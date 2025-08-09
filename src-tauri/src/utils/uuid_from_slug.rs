use uuid::{Uuid, uuid};

// Define a namespace UUID for Blink notes
// This is a random UUID v4 that we use as our namespace
const BLINK_NAMESPACE: Uuid = uuid!("6ba7b810-9dad-11d1-80b4-00c04fd430c8");

/// Generate a deterministic UUID v5 from a slug
/// The same slug will always produce the same UUID
pub fn uuid_from_slug(slug: &str) -> String {
    Uuid::new_v5(&BLINK_NAMESPACE, slug.as_bytes()).to_string()
}

/// Extract the slug from a UUID if it was generated from one
/// This is mainly for debugging/logging purposes
pub fn slug_from_uuid_filename(filename: &str) -> String {
    // If the filename is a UUID pattern, we can't reverse it to get the slug
    // So we just use the filename as-is for now
    filename.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic_uuid() {
        let slug = "my-awesome-note";
        let uuid1 = uuid_from_slug(slug);
        let uuid2 = uuid_from_slug(slug);
        
        // Same slug should always produce the same UUID
        assert_eq!(uuid1, uuid2);
        
        // Should be a valid UUID format
        assert!(Uuid::parse_str(&uuid1).is_ok());
    }
    
    #[test]
    fn test_different_slugs_different_uuids() {
        let uuid1 = uuid_from_slug("note-one");
        let uuid2 = uuid_from_slug("note-two");
        
        // Different slugs should produce different UUIDs
        assert_ne!(uuid1, uuid2);
    }
}