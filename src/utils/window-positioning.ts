interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate grid position for window deployment (1-9 grid layout)
 * @param slotNumber - Grid slot number (1-9)
 * @returns Position and dimensions for the window
 */
export function getGridPosition(slotNumber: number): GridPosition {
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const windowWidth = 600;
  const windowHeight = 400;
  
  // Create 3x3 grid with some padding from edges
  const cols = 3;
  const rows = 3;
  const padding = 100;
  const usableWidth = screenWidth - 2 * padding - windowWidth;
  const usableHeight = screenHeight - 2 * padding - windowHeight;
  
  const col = (slotNumber - 1) % cols;
  const row = Math.floor((slotNumber - 1) / cols);
  
  const x = padding + (col * usableWidth / (cols - 1));
  const y = padding + (row * usableHeight / (rows - 1));
  
  return { 
    x: Math.round(x), 
    y: Math.round(y), 
    width: windowWidth, 
    height: windowHeight 
  };
}

/**
 * Get center position for a window
 * @param width - Window width
 * @param height - Window height
 * @returns Centered position
 */
export function getCenterPosition(width: number = 600, height: number = 400): GridPosition {
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  return {
    x: Math.round((screenWidth - width) / 2),
    y: Math.round((screenHeight - height) / 2),
    width,
    height
  };
}