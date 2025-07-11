// Test script to verify window lifecycle event tracking
// Run this in the browser console of the main Blink window

async function testWindowLifecycle() {
  console.log('=== WINDOW LIFECYCLE TEST ===');
  
  // 1. Get current window state truth
  console.log('\n1. Getting initial window state truth...');
  try {
    const truth = await window.__TAURI__.invoke('get_window_state_truth');
    console.log(truth);
  } catch (e) {
    console.error('Failed to get window state truth:', e);
  }
  
  // 2. Create a test note if needed
  console.log('\n2. Creating test note...');
  const testNoteId = 'test-lifecycle-' + Date.now();
  try {
    await window.__TAURI__.invoke('create_note', {
      request: {
        title: 'Lifecycle Test Note',
        content: 'This note is for testing window lifecycle events',
        tags: ['test']
      }
    });
    console.log('Created test note:', testNoteId);
  } catch (e) {
    console.log('Using existing note for test');
  }
  
  // 3. Get the first available note
  const notes = await window.__TAURI__.invoke('get_notes');
  const testNote = notes[0];
  console.log('Using note for test:', testNote.id, testNote.title);
  
  // 4. Create a detached window
  console.log('\n3. Creating detached window...');
  try {
    const window = await window.__TAURI__.invoke('create_detached_window', {
      request: {
        note_id: testNote.id,
        x: 500,
        y: 300,
        width: 600,
        height: 400
      }
    });
    console.log('Created window:', window);
  } catch (e) {
    console.error('Failed to create window:', e);
  }
  
  // 5. Wait and check state
  console.log('\n4. Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 6. Get window state truth again
  console.log('\n5. Getting window state truth after creation...');
  try {
    const truth2 = await window.__TAURI__.invoke('get_window_state_truth');
    console.log(truth2);
  } catch (e) {
    console.error('Failed to get window state truth:', e);
  }
  
  console.log('\n=== TEST COMPLETE ===');
  console.log('Now manually close the detached window and run:');
  console.log('await window.__TAURI__.invoke("get_window_state_truth")');
  console.log('to see if the window is properly cleaned up from state.');
}

// Run the test
testWindowLifecycle();