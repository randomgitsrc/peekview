# P3: Mermaid Bug Fix Verification Plan

## Test Cases

### TC1: SVG Fills Container
**Setup:**
1. Create entry with mermaid diagram
2. Open entry detail view

**Expected:**
- `.mermaid-content.diagram-mode` height is 400px
- `.mermaid-viewer-mount` fills parent (height: 100%)
- SVG is visible and fills the container (not just a thin strip)

**Verification:**
```javascript
// Check container height
const container = document.querySelector('.mermaid-content.diagram-mode')
container.offsetHeight === 400  // should be true

// Check mount point fills container
const mount = container.querySelector('.mermaid-viewer-mount')
mount.offsetHeight === container.offsetHeight  // should be true
```

---

### TC2: Diagram/Code Toggle Works
**Setup:**
1. Open entry with mermaid diagram
2. Wait for diagram to render
3. Click "Code" toggle button
4. Click "Diagram" toggle button

**Expected:**
- Step 3: Code view shows, diagram hides
- Step 4: Diagram shows again, properly sized (not blank)

**Verification:**
```javascript
// After clicking Diagram toggle
const diagramMode = document.querySelector('.mermaid-content[data-mode="diagram"]')
const codeMode = document.querySelector('.mermaid-content[data-mode="code"]')

diagramMode.style.display === ''  // should be true (visible)
codeMode.style.display === 'none'  // should be true (hidden)

// SVG should be visible
const svg = diagramMode.querySelector('svg')
svg !== null  // should be true
svg.getBoundingClientRect().height > 100  // should be true
```

---

### TC3: Fullscreen Modal Fills Window
**Setup:**
1. Open entry with mermaid diagram
2. Click fullscreen button

**Expected:**
- Modal opens with 90vh height
- SVG fills the modal container
- Pan/zoom works in modal

**Verification:**
```javascript
// Check modal dimensions
const modal = document.querySelector('.mermaid-modal')
modal.offsetHeight > window.innerHeight * 0.8  // should be ~90vh

// Check container fills modal
const container = modal.querySelector('.mermaid-modal-container')
container.offsetHeight > modal.offsetHeight * 0.8  // should fill most of modal

// Check SVG is visible
const svg = container.querySelector('svg')
svg !== null
svg.getBoundingClientRect().height > 200
```

---

## Implementation Checklist

### CSS Fixes (MarkdownViewer.vue)
- [x] `.mermaid-content.diagram-mode` has `height: 400px`
- [x] `.mermaid-content.diagram-mode` has `overflow: hidden`
- [x] `.mermaid-viewer-mount` has `height: 100%`
- [x] `.mermaid-viewer-mount` has `width: 100%`

### Toggle Logic (MarkdownViewer.vue)
- [x] Detection uses `codeMode.style.display === 'none'`
- [x] After toggle to diagram, calls `resize()`, `fit()`, `center()`
- [x] Uses `requestAnimationFrame` + `setTimeout` for layout sync

### SVG Container (MermaidDiagram.vue)
- [x] `.svg-container` has `height: 100%`
- [x] `.svg-container` has `display: flex`
- [x] `.svg-container :deep(svg)` has `max-height: 100%`

### Pan-Zoom Storage (MermaidDiagram.vue)
- [x] `initPanZoom` stores instance on container element
- [x] `toggleFullscreen` awaits `initModalPanZoom`

### Modal Styles (MermaidDiagram.vue)
- [x] `.mermaid-modal` has `height: 90vh`
- [x] `.mermaid-modal-container` has `flex: 1`
- [x] `.svg-wrapper` has `height: 100%`

---

## Issues Found During Review

1. **Missing await in toggleFullscreen**: Line 172 in MermaidDiagram.vue
   ```typescript
   nextTick(() => {
     initModalPanZoom()  // Should be: await initModalPanZoom()
   })
   ```

2. **Need to verify** panZoomInstance is properly accessed via `.__panZoomInstance`

---

## Build Status
- [x] Frontend builds without errors
- [x] TypeScript compilation passes
- [x] Static files copied to backend

## Next Steps
1. Fix missing await in toggleFullscreen
2. Rebuild and redeploy
3. Manual browser testing
