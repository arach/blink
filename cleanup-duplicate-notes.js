#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(
  process.env.HOME,
  'Library/Application Support/com.blink.dev/data'
);

console.log('🔍 Scanning notes directory:', DATA_DIR);
console.log('=' .repeat(60));

// Track IDs we've seen
const idToFiles = new Map();
const filesToProcess = [];

// Read all markdown files
const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.md'));

files.forEach(filename => {
  const filepath = path.join(DATA_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  
  // Check if file has frontmatter
  if (content.startsWith('---\n')) {
    const frontmatterMatch = content.match(/^---\n(.*?)\n---/s);
    if (frontmatterMatch) {
      try {
        const frontmatter = yaml.load(frontmatterMatch[1]);
        const id = frontmatter.id;
        
        if (!idToFiles.has(id)) {
          idToFiles.set(id, []);
        }
        idToFiles.get(id).push({
          filename,
          filepath,
          frontmatter,
          content: content.split(/---\n.*?\n---\n/s)[1] || ''
        });
      } catch (e) {
        console.error(`❌ Error parsing ${filename}:`, e.message);
      }
    }
  } else {
    console.log(`ℹ️  ${filename} - No frontmatter (will generate new ID)`);
    filesToProcess.push({
      filename,
      filepath,
      needsId: true,
      content
    });
  }
});

// Find duplicates
let duplicatesFound = false;
idToFiles.forEach((files, id) => {
  if (files.length > 1) {
    duplicatesFound = true;
    console.log(`\n⚠️  DUPLICATE ID FOUND: ${id}`);
    console.log('   Files with this ID:');
    files.forEach(file => {
      const stats = fs.statSync(file.filepath);
      const isEmpty = file.content.trim() === '';
      console.log(`   - ${file.filename} (${stats.size} bytes)${isEmpty ? ' [EMPTY]' : ''}`);
      console.log(`     Title: "${file.frontmatter.title}"`);
      console.log(`     Updated: ${file.frontmatter.updated_at}`);
    });
  }
});

if (!duplicatesFound) {
  console.log('\n✅ No duplicate IDs found!');
} else {
  console.log('\n' + '=' .repeat(60));
  console.log('🔧 FIXING DUPLICATES...\n');
  
  // Fix duplicates - keep the first, regenerate IDs for others
  idToFiles.forEach((files, id) => {
    if (files.length > 1) {
      console.log(`Fixing ID ${id}:`);
      
      // Sort by updated_at to keep the most recent with original ID
      files.sort((a, b) => {
        const dateA = new Date(a.frontmatter.updated_at);
        const dateB = new Date(b.frontmatter.updated_at);
        return dateB - dateA; // Most recent first
      });
      
      files.forEach((file, index) => {
        if (index === 0) {
          console.log(`  ✓ Keeping original ID for: ${file.filename}`);
        } else {
          const newId = uuidv4();
          console.log(`  → Assigning new ID to: ${file.filename}`);
          console.log(`    Old ID: ${id}`);
          console.log(`    New ID: ${newId}`);
          
          // Update frontmatter
          file.frontmatter.id = newId;
          const newFrontmatter = yaml.dump(file.frontmatter);
          const newContent = `---\n${newFrontmatter}---\n${file.content}`;
          
          // Write back to file
          fs.writeFileSync(file.filepath, newContent);
          console.log(`    ✅ File updated`);
        }
      });
    }
  });
}

// Handle files without frontmatter
if (filesToProcess.length > 0) {
  console.log('\n' + '=' .repeat(60));
  console.log('🔧 ADDING FRONTMATTER TO FILES...\n');
  
  filesToProcess.forEach(file => {
    if (file.needsId) {
      const title = path.basename(file.filename, '.md');
      const now = new Date().toISOString();
      const newId = uuidv4();
      
      const frontmatter = {
        id: newId,
        title: title,
        created_at: now,
        updated_at: now,
        tags: []
      };
      
      const frontmatterYaml = yaml.dump(frontmatter);
      const newContent = `---\n${frontmatterYaml}---\n${file.content}`;
      
      fs.writeFileSync(file.filepath, newContent);
      console.log(`✅ Added frontmatter to ${file.filename} with ID: ${newId}`);
    }
  });
}

// Final check for empty files
console.log('\n' + '=' .repeat(60));
console.log('🔍 CHECKING FOR EMPTY FILES...\n');

let emptyFiles = [];
files.forEach(filename => {
  const filepath = path.join(DATA_DIR, filename);
  const stats = fs.statSync(filepath);
  const content = fs.readFileSync(filepath, 'utf8');
  
  // Check if only frontmatter exists (no actual content)
  const bodyContent = content.split(/---\n.*?\n---\n/s)[1] || '';
  if (bodyContent.trim() === '') {
    emptyFiles.push({ filename, size: stats.size });
  }
});

if (emptyFiles.length > 0) {
  console.log('⚠️  Found empty note files:');
  emptyFiles.forEach(file => {
    console.log(`   - ${file.filename} (${file.size} bytes)`);
  });
  console.log('\nThese files contain only frontmatter with no content.');
} else {
  console.log('✅ No empty files found!');
}

console.log('\n' + '=' .repeat(60));
console.log('✨ Cleanup complete!');
console.log('\n⚠️  IMPORTANT: Restart the Tauri dev server to reload the cleaned notes.');