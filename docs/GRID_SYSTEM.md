# Blink Grid System Documentation

## Overview

This document defines the comprehensive grid system for consistent spacing and positioning throughout the Blink application. The goal is to ensure visual harmony across all views and components.

## Base Unit System

Our grid system is based on a 4px base unit, following the Tailwind CSS spacing scale:

- **Base unit**: 4px (0.25rem)
- **Spacing scale**: Multipliers of the base unit

### Spacing Values

| Token | Pixels | Rem | Usage |
|-------|--------|-----|--------|
| 0     | 0px    | 0rem | No spacing |
| 0.5   | 2px    | 0.125rem | Hairline spacing |
| 1     | 4px    | 0.25rem | Tight spacing |
| 1.5   | 6px    | 0.375rem | Small gaps |
| 2     | 8px    | 0.5rem | Default small spacing |
| 3     | 12px   | 0.75rem | Default medium spacing |
| 4     | 16px   | 1rem | Standard spacing |
| 5     | 20px   | 1.25rem | Large spacing |
| 6     | 24px   | 1.5rem | Extra large spacing |
| 8     | 32px   | 2rem | Section spacing |

## Component Grid Structure

### Window Layout

```
┌─────────────────────────────────────────┐
│ Title Bar (height: 32px)                │
├─────┬───────────────────────────────────┤
│ Nav │ Content Area                      │
│ Bar │                                   │
│(32px)│                                   │
├─────┴───────────────────────────────────┤
│ Status Bar (height: 24px)               │
└─────────────────────────────────────────┘
```

**Note**: Implementation found the title bar was set to 48px (h-12) which was causing inconsistent spacing. This has been corrected to 32px (h-8) to match the navigation bar width and create visual harmony.

### Navigation Bar
- **Width**: 32px (8 units)
- **Icon size**: 12px (3 units)
- **Button size**: 20px × 20px (w-5 h-5)
- **Button margin**: 2px (0.5 units)
- **Top padding**: 4px (1 unit)
- **Bottom padding**: 4px (1 unit)
- **Buttons use flexbox centering for perfect icon alignment**

### Title Bar
- **Height**: 32px (8 units) - corrected from 48px
- **Horizontal padding**: 16px (4 units) 
- **Vertical alignment**: center (flex items-center)
- **Title font size**: 11px
- **Stats font size**: 10px
- **Border**: bottom border with 30% opacity

### Status Bar  
- **Height**: 24px (6 units)
- **Horizontal padding**: 12px (3 units)
- **Vertical alignment**: center (flex items-center)
- **Font size**: 12px (text-xs)
- **Icon size**: 16px (w-4 h-4)
- **Gap between items**: 12px (gap-3)

### Content Panels

#### Notes List Panel
- **Header height**: 76px total (fixed height container)
  - **Uses flexbox centering for consistent alignment**
  - **Title + button row**: flex items with 12px gap
  - **Search input**: separate row below title
- **List item padding**: 12px (3 units)
- **List item margin**: 8px (2 units) 
- **List container padding**: 8px (2 units)

#### Settings Panel
- **Section headers**: 76px height (matching notes panel headers)
  - **Title**: 14px font size
  - **Subtitle**: 12px font size, 60% opacity
  - **Icon**: 14px size with 8px gap
- **Section spacing**: 16px (4 units) between sections
- **Card padding**: 16px (4 units)
- **Card spacing**: 12px (3 units) between cards

#### Editor Panel
- **Default padding**: 24px (6 units)
- **Focus mode padding**: 32px horizontal, 48px vertical (8/12 units)
- **Line height**: 1.6 (editor), 1.65 (preview)

## Standardized Component Spacing

### Headers
All headers should follow this structure:
```tsx
<div className="p-4 border-b border-border/20">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-medium text-foreground">Title</h2>
    <button className="...">Action</button>
  </div>
  <!-- Optional subtitle or search -->
</div>
```

### Section Headers
```tsx
<div className="mb-4">
  <h2 className="text-sm font-semibold text-foreground mb-1">
    Section Title
  </h2>
  <p className="text-xs text-muted-foreground/60">
    Section description
  </p>
</div>
```

### Cards
```tsx
<div className="bg-card/20 rounded-lg p-4 border border-border/10">
  <h3 className="text-xs font-medium mb-3">Card Title</h3>
  <!-- Card content -->
</div>
```

### Form Controls
- **Label margin bottom**: 8px (2 units)
- **Input height**: 32px (8 units)
- **Input padding**: 8px horizontal (2 units)
- **Control group spacing**: 12px (3 units)

### Buttons
- **Small button padding**: 4px (1 unit)
- **Default button padding**: 8px horizontal, 6px vertical
- **Large button padding**: 12px horizontal, 8px vertical
- **Icon button size**: 20px (5 units)

## Alignment Guidelines

### Vertical Rhythm
Maintain consistent vertical spacing using multiples of 4px:
- **Tight**: 4px, 8px
- **Default**: 12px, 16px
- **Loose**: 24px, 32px

### Horizontal Alignment
- **Container padding**: 16px (4 units) standard
- **Narrow containers**: 12px (3 units)
- **Wide containers**: 24px (6 units)

### Icon Alignment
- Icons should be optically centered, not mathematically centered
- Use consistent icon sizes: 12px (small), 14px (default), 16px (large)
- Maintain 4px minimum padding around interactive icons

## Responsive Considerations

### Minimum Sizes
- **Minimum button size**: 20px × 20px
- **Minimum input height**: 28px
- **Minimum clickable area**: 44px × 44px (on touch devices)

### Maximum Widths
- **Search inputs**: 100% of container
- **Settings cards**: 100% with max-width constraints
- **Editor content**: Responsive to window size

## Implementation Checklist

When implementing UI components, verify:

- [x] Headers maintain consistent 76px height across views (Notes and Settings panels)
- [x] Navigation buttons are 20px × 20px with 12px icons
- [x] All spacing uses the defined scale (multiples of 4px)
- [x] Section headers use 76px height with flexbox centering (consistent across notes and settings)
- [x] Cards use standardized padding (16px)
- [x] Form controls follow the defined spacing
- [x] Icons are properly sized and aligned (12px nav, 14px sections)
- [x] Hover states maintain spatial consistency
- [x] Focus states don't cause layout shifts

## Fixes Applied

1. **Title Bar Height**: Reduced from 48px to 32px to match navigation width
2. **Section Headers**: Standardized to 76px height (updated from 60px) for consistency
3. **Navigation Buttons**: Fixed to exact 20px × 20px dimensions
4. **Panel Headers**: Standardized Notes and Settings headers to 76px
5. **Status Bar**: Confirmed 24px height with proper spacing
6. **Title Font Size**: Updated from 11px to 13px for improved hierarchy
7. **Note Footer Height**: Standardized to 24px height (h-6)
8. **Small Icons**: Updated from 11px to 12px minimum size
9. **Rounded Corners**: Fixed transparent window background interference
10. **Settings Navigation Icons**: Added consistent 14px icons to sidebar header and 12px icons to sections
11. **Save Button Optimization**: Reduced from px-4 py-2 to px-3 py-1.5 with text-xs
12. **Button Icon Consistency**: Aligned Save button icons to 12px (w-3 h-3)
13. **Backdrop Blur**: Added backdrop-blur-sm to Save button background
14. **Footer Text Contrast**: Enhanced directory text to text-foreground/90

## CSS Variables

Consider adding these CSS variables for easier maintenance:

```css
:root {
  --spacing-unit: 0.25rem; /* 4px */
  --nav-width: 2rem; /* 32px */
  --title-bar-height: 2rem; /* 32px */
  --status-bar-height: 1.5rem; /* 24px */
  --header-height: 4.75rem; /* 76px */
  --icon-small: 0.75rem; /* 12px */
  --icon-default: 0.875rem; /* 14px */
  --icon-large: 1rem; /* 16px */
}
```

## Design Consistency Standards

### Typography Hierarchy
Established visual hierarchy with consistent font sizing:
- **App Title**: 13px (improved from 11px for better prominence)
- **Section Headers**: 14px (text-sm)
- **Subsection Text**: 12px (text-xs) 
- **Button Text**: 12px (text-xs) for proportional design
- **Footer Text**: 12px with enhanced contrast (text-foreground/90 for directory)

### Icon Size System
Consistent iconography throughout the application:
- **Navigation Icons**: 12px (w-3 h-3) - sidebar buttons
- **Section Header Icons**: 14px (w-3.5 h-3.5) - main section headers  
- **Subsection Icons**: 12px (w-3 h-3) - settings sidebar sections
- **Footer Icons**: 16px (w-4 h-4) - status bar elements
- **Button Icons**: 12px (w-3 h-3) - action buttons

### Visual Treatment Standards
Enhanced visual consistency with proper transparency:
- **Save Button**: px-3 py-1.5 with backdrop-blur-sm background
- **Footer Text**: Improved contrast hierarchy (directory at 90% opacity)
- **Section Headers**: Consistent 76px height with flexbox centering
- **Icon Alignment**: Proper optical centering in all containers

### Navigation Structure Consistency
Unified navigation patterns across all views:
- **Sidebar Headers**: Icon + title + optional action button
- **Section Navigation**: Icon + title + subtitle structure
- **Visual States**: Consistent hover, active, and selected states

## Common Patterns

### Flex Spacing
Use gap utilities for consistent spacing in flex containers:
```tsx
<div className="flex items-center gap-2"> <!-- 8px gap -->
<div className="flex flex-col gap-3"> <!-- 12px gap -->
<div className="space-y-4"> <!-- 16px vertical spacing -->
```

### Margin/Padding Shortcuts
- `m-0.5` = 2px
- `p-1` = 4px
- `p-2` = 8px
- `p-3` = 12px
- `p-4` = 16px

## Debugging Grid Issues

When spacing appears inconsistent:

1. Check for conflicting margin/padding
2. Verify parent containers don't override spacing
3. Ensure consistent use of border-box sizing
4. Use browser DevTools grid overlay
5. Check for CSS specificity issues
6. Verify theme variables are applied correctly

## Future Considerations

- Consider implementing a spacing debug mode that visualizes the grid
- Add visual regression tests for spacing consistency
- Create Figma/design tool templates matching this grid
- Consider accessibility implications of spacing (WCAG target sizes)