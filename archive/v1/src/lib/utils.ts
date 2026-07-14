import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Convert markdown to plain text for previews
export function markdownToPlainText(markdown: string): string {
  return markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`([^`]+)`/g, '$1')
    // Remove headers
    .replace(/#{1,6}\s+/g, '')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image]')
    // Remove lists
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Clean up whitespace
    .replace(/\n\s*\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract title from markdown content (first header or line)
export function extractTitleFromContent(content: string): string {
  if (!content.trim()) return 'Untitled';
  
  // Always use first non-empty line as title
  const firstLine = content.split('\n').find(line => line.trim());
  if (!firstLine) return 'Untitled';
  
  // Clean up the line and extract title
  let title = firstLine.trim();
  
  // Remove markdown formatting if present
  title = title.replace(/^#+\s*/, ''); // Remove markdown headers
  title = title.replace(/^\*\*(.+)\*\*$/, '$1'); // Remove bold
  title = title.replace(/^\*(.+)\*$/, '$1'); // Remove italic
  title = title.replace(/^[-*+]\s+/, ''); // Remove list markers
  
  // Limit length and ensure we have something
  return title.substring(0, 50).trim() || 'Untitled';
}

// Count words in text content
export function getWordCount(content: string): number {
  if (!content.trim()) return 0;
  return content.split(/\s+/).filter(word => word.length > 0).length;
}