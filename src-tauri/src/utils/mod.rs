pub mod slug;
pub mod uuid_from_slug;

pub use slug::{generate_slug, generate_unique_slug};
pub use uuid_from_slug::uuid_from_slug;