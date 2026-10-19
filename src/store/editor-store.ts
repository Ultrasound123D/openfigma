'use client'

import { create } from 'zustand'
import { findElementInList, updateElementInList, removeElementFromList, deepCloneElements, getAllElements, findAncestors } from '@/lib/element-utils'
import { computeAutoLayout } from '@/lib/auto-layout'
import { normalizeServerElement, normalizeServerProject } from '@/lib/server-project'
import {
  isBooleanOperandType, flattenOperand, polysToContours, contoursBounds, foldElementPolys,
  getBooleanGroupContours, booleanGroupPathD,
} from '@/lib/boolean-ops'
import { computeOutlineStroke, isOutlineStrokeCandidate } from '@/lib/outline-stroke'
// PHASE 18 — parametric shape → editable vector conversion + split-vector
import { shapeToVectorNetwork, isShapeToVectorCandidate } from '@/lib/shape-to-vector'
import type { Poly } from '@/lib/polygon-clip'
import type { Interaction, PrototypeAction, OverlayBackground } from '@/types/prototype'
// PHASE 7 — style helpers (types are import()'d above to avoid a value cycle)
import {
  applyStyleUpdates, detachStyleUpdates, paintFromElement, textFromElement, effectsFromElement,
} from '@/lib/styles'
// PHASE 9 — constraints engine
import { constrainChildren, inferConstraints } from '@/lib/constraints'
// PHASE 10 — real text measurement for auto-resize
import { measureText, buildTextLines } from '@/lib/text-measure'

/**
 * PHASE 12 — run the auto layout engine over each auto-layout frame in the
 * ancestor chains of the given start ids (deepest first), writing positioned
 * children + hug frame sizes back into the tree. Pure data pass: no history.
 */
/* ============================================================
 * PHASE 17 helpers — outline stroke (P2) & flatten (P3).
 * Module-level pure functions over DesignElement; the store actions
 * (outlineStrokeSelection / flattenSelection) map the tree through them.
 * ============================================================ */

/** One element → outline-stroked replacement (same id/slot). null if unsupported. */
function outlineOne(el: DesignElement): DesignElement | null {
  if (!isOutlineStrokeCandidate(el)) return null
  const r = computeOutlineStroke(el)
  if (!r) return null
  return {
    ...el,
    type: 'path',
    // place at computed bounds (contours are relative to 0,0)
    x: el.x + r.bounds.x,
    y: el.y + r.bounds.y,
    width: Math.max(1, r.bounds.width),
    height: Math.max(1, r.bounds.height),
    // band becomes the fill (Figma: outline result paints with the stroke color)
    fill: el.stroke,
    fills: el.fills?.length ? [{ ...el.fills[0], type: 'solid', color: el.stroke }] : undefined,
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    booleanContours: r.contours,
    booleanSourceIds: undefined,
    booleanOperation: undefined,
  }
}

/** One live boolean group → baked static path element (same id/slot). null on failure. */
function flattenOne(group: DesignElement): DesignElement | null {
  if (group.type !== 'boolean') return null
  const contours = getBooleanGroupContours(group)
  if (!contours?.length) return null
  const b = contoursBounds(contours)
  if (b.width <= 0 || b.height <= 0) return null
  return {
    ...group,
    type: 'path',
    x: group.x + b.x,
    y: group.y + b.y,
    width: b.width,
    height: b.height,
    booleanContours: contours,
    booleanSourceIds: undefined,
    booleanOperation: undefined,
    children: undefined,
  }
}

function applyAutoLayoutSync(elements: DesignElement[], startIds: string[]): DesignElement[] {
  let out = elements
  for (const startId of startIds) {
    const start = findElementInList(out, startId)
    if (!start) continue
    const chain: DesignElement[] = [start, ...findAncestors(out, startId)]
    for (const node of chain) {
      const cur = findElementInList(out, node.id)
      if (!cur || cur.type !== 'frame' || !cur.autoLayout || !cur.children) continue
      const res = computeAutoLayout(cur)
      out = updateElementInList(out, cur.id, { children: res.children, width: res.width, height: res.height })
    }
  }
  return out
}

/** Stable per-tab client id used for SSE echo suppression. */
function generateClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `tab-${crypto.randomUUID().slice(0, 8)}`
  }
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export type ToolType = 'move' | 'frame' | 'rectangle' | 'ellipse' | 'line' | 'pen' | 'text' | 'comment' | 'hand' | 'polygon' | 'star' | 'pencil' | 'eyedropper' | 'slice' | 'arrow' | 'image' | 'scale' | 'section' | 'table' | 'sticky'

export type ElementType = 'rectangle' | 'frame' | 'group' | 'ellipse' | 'line' | 'text' | 'path' | 'polygon' | 'star' | 'boolean' | 'slice' | 'arrow' | 'component-set' | 'section' | 'table' | 'sticky'

export interface PathPoint {
  x: number
  y: number
  cx1?: number
  cy1?: number
  cx2?: number
  cy2?: number
}

/**
 * VectorNetwork data model (Figma source: 9456-*.min.js line 1712).
 * Exact parity with Figma's Zod schema:
 *   vertices: array of {x, y, strokeCap?, strokeJoin?, cornerRadius?}
 *   segments: array of {start, end, tangentStart?, tangentEnd?}
 *   regions:  array of {windingRule, loops, fillStyleId?} (optional)
 *
 * Tangents are RELATIVE offsets from the vertex (not absolute positions),
 * so they stay correct when the element is moved/resized.
 *
 * handleMirroring is stored on the NODE level in Figma (not on segments),
 * but we keep it on segments for our rendering convenience.
 */
export interface VectorVertex {
  x: number
  y: number
  cornerRadius?: number
  strokeCap?: 'NONE' | 'ROUND' | 'SQUARE' | 'ARROW_LINES' | 'ARROW_EQUILATERAL' | 'DIAMOND_FILLED' | 'TRIANGLE_FILLED' | 'CIRCLE_FILLED'
  strokeJoin?: 'MITER' | 'BEVEL' | 'ROUND'
}

export interface VectorTangent {
  x: number
  y: number
}

export type HandleMirroring = 'NONE' | 'ANGLE' | 'ANGLE_AND_LENGTH'

export interface VectorSegment {
  start: number
  end: number
  /** Tangent at start vertex, RELATIVE offset from vertex (optional in Figma) */
  tangentStart?: VectorTangent
  /** Tangent at end vertex, RELATIVE offset from vertex (optional in Figma) */
  tangentEnd?: VectorTangent
}

export interface VectorRegion {
  windingRule: 'NONZERO' | 'ODDEVEN'
  loops: number[][]
  fillStyleId?: string
}

export interface VectorNetwork {
  vertices: VectorVertex[]
  segments: VectorSegment[]
  /** Figma source parity: regions define fill areas */
  regions?: VectorRegion[]
  /** Whether the path is closed (last segment wraps to vertex 0) */
  closed?: boolean
}

export interface GradientStop {
  offset: number
  color: string
  opacity: number
}

export interface FillStyle {
  /** PHASE 17 + 'pattern' — image tile repeat (source: addPaintOfType +
   *  <pattern patternUnits="userSpaceOnUse"><image …/> rendering, 9456/3835).
   *  Tile size = image natural size × patternScale (default 1). */
  type: 'solid' | 'linear-gradient' | 'radial-gradient' | 'angular-gradient' | 'diamond-gradient' | 'image' | 'pattern'
  color: string
  opacity: number
  gradientStops?: GradientStop[]
  gradientAngle?: number
  gradientX1?: number
  gradientY1?: number
  gradientX2?: number
  gradientY2?: number
  imageUrl?: string
  visible?: boolean
  /** PHASE 10 — image fill modes (Figma parity)
   *  fill: cover (slice) — default; fit: contain (meet, letterboxed);
   *  crop: manual scale + offset */
  scaleMode?: 'fill' | 'fit' | 'crop'
  scale?: number
  offsetX?: number
  offsetY?: number
  /** PHASE 17 — pattern paint: tile = natural image size × patternScale.
   *  patternW/H: measured natural dimensions (async Image() probe, stored so
   *  rendering is deterministic without re-measuring). */
  patternScale?: number
  patternW?: number
  patternH?: number
}

export interface StrokeStyle {
  color: string
  width: number
  style: 'solid' | 'dashed' | 'dotted'
  opacity: number
  align?: 'inside' | 'center' | 'outside'
  visible?: boolean
}

export interface ShadowEffect {
  type: 'drop-shadow' | 'inner-shadow'
  x: number
  y: number
  blur: number
  spread: number
  color: string
  opacity: number
  visible: boolean
}

export interface BlurEffect {
  type: 'blur' | 'background-blur'
  radius: number
  visible: boolean
}

export interface AutoLayout {
  direction: 'horizontal' | 'vertical'
  gap: number
  paddingTop: number
  paddingBottom: number
  paddingLeft: number
  paddingRight: number
  alignItems: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justifyContent: 'start' | 'center' | 'end' | 'space-between'
  /** PHASE 12 — Figma parity (source: layoutWrap 2 / HUG 8 / FILL 81 / FIXED 18 refs) */
  /** wrap children into lines when main-axis extent overflows a fixed frame */
  wrap?: boolean
  /** gap between wrap lines (source: counterAxisSpacing) */
  counterAxisGap?: number
  /** line stacking alignment when wrapping (source: counterAxisAlignContent) */
  counterAxisAlignContent?: 'start' | 'center' | 'end' | 'space-between'
  /** frame sizing along main axis (source: primaryAxisSizingMode FIXED/HUG/FILL) */
  primaryAxisSizing?: 'fixed' | 'hug' | 'fill'
  /** frame sizing across main axis (source: counterAxisSizingMode FIXED/HUG/FILL) */
  counterAxisSizing?: 'fixed' | 'hug' | 'fill'
}

/**
 * Component Variant data model (Figma source: 9456-*.min.js lines 1020, 1685).
 * Source parity:
 *   ComponentPropertyType enum: BOOLEAN, TEXT, INSTANCE_SWAP, IMAGE, SLOT, NUMBER, VARIANT
 *   ComponentSetNode: defaultVariant, variantGroupProperties, componentPropertyDefinitions
 *   ComponentNode: variantProperties, componentPropertyDefinitions, createInstance
 *   InstanceNode: componentProperties, componentPropertyReferences, swapComponent, detachInstance
 */
export type ComponentPropertyType = 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'IMAGE' | 'SLOT' | 'NUMBER' | 'VARIANT'

export interface BooleanPropertyDefinition {
  type: 'BOOLEAN'
  defaultValue: boolean
  variantOptions?: string[]
}

export interface TextPropertyDefinition {
  type: 'TEXT'
  defaultValue: string
}

export interface InstanceSwapPropertyDefinition {
  type: 'INSTANCE_SWAP'
  defaultValue: string | null
  preferredValues?: string[]
}

export interface ImagePropertyDefinition {
  type: 'IMAGE'
  defaultValue: { imageRef: string } | null
}

export interface SlotPropertyDefinition {
  type: 'SLOT'
  defaultValue: string | null
}

export interface NumberPropertyDefinition {
  type: 'NUMBER'
  defaultValue: number
}

export interface VariantPropertyDefinition {
  type: 'VARIANT'
  defaultValue: string
  variantOptions?: string[]
}

export type ComponentPropertyDefinition =
  | BooleanPropertyDefinition
  | TextPropertyDefinition
  | InstanceSwapPropertyDefinition
  | ImagePropertyDefinition
  | SlotPropertyDefinition
  | NumberPropertyDefinition
  | VariantPropertyDefinition

export type ComponentPropertyValue = boolean | string | number | null

export interface ComponentPropertyReferences {
  visible?: boolean
  characters?: boolean
  mainComponent?: boolean
  slotContentId?: boolean
}

export interface VariantGroupProperty {
  values: string[]
}

export interface Guide {
  orientation: 'horizontal' | 'vertical'
  position: number
  id: string
}

export interface DesignElement {
  id: string
  name: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  strokeStyle: 'solid' | 'dashed' | 'dotted'
  strokeAlign?: 'inside' | 'center' | 'outside'
  cornerRadius: number
  cornerRadiusTL: number
  cornerRadiusTR: number
  cornerRadiusBL: number
  cornerRadiusBR: number
  /** PHASE 16 — corner smoothing 0..100% (source: cornerSmoothing 9 refs):
   *  0 = circular corners, 100 = fully smooth (squircle-like bezier corners) */
  cornerSmoothing?: number
  opacity: number
  rotation: number
  visible: boolean
  locked: boolean
  children?: DesignElement[]
  // Text properties
  textContent?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline' | 'strikethrough'
  textAlign?: 'left' | 'center' | 'right' | 'justified'
  lineHeight?: number
  letterSpacing?: number
  textColor?: string
  // Path properties (legacy PathPoint[] model)
  pathPoints?: PathPoint[]
  pathClosed?: boolean
  /** VectorNetwork model (Figma source parity) — preferred over pathPoints when present */
  vectorNetwork?: VectorNetwork
  // Polygon/Star properties
  sides?: number
  innerRadius?: number
  // Advanced fills
  fills?: FillStyle[]
  strokes?: StrokeStyle[]
  // Effects
  shadows?: ShadowEffect[]
  blurs?: BlurEffect[]
  // Auto layout (for frames)
  autoLayout?: AutoLayout
  /** PHASE 12 — auto layout child sizing (source: layoutSizingHorizontal/Vertical, FILL 81/HUG 8/FIXED 18) */
  layoutSizingH?: 'fixed' | 'hug' | 'fill'
  layoutSizingV?: 'fixed' | 'hug' | 'fill'
  /** PHASE 12 — absolute positioning inside auto-layout parent (source: layoutPositioning) */
  layoutPositioning?: 'auto' | 'absolute'
  /** PHASE 12 — min/max dimensions (source: minWidth/minHeight/maxWidth/maxHeight 13 refs each) */
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  // Export settings (PHASE 3: format/scale/quality per row)
  exportSettings?: { format: string; scale: number; quality?: number; suffix?: string }[]
  // Blend mode
  blendMode?: string
  // Component system
  isComponent?: boolean
  componentId?: string
  overrides?: Record<string, any>
  // Component Variant system
  isComponentSet?: boolean
  componentSetId?: string
  componentPropertyDefinitions?: Record<string, ComponentPropertyDefinition>
  variantProperties?: Record<string, string>
  variantGroupProperties?: Record<string, VariantGroupProperty>
  defaultVariant?: string
  componentProperties?: Record<string, ComponentPropertyValue>
  componentPropertyReferences?: ComponentPropertyReferences
  // Arrow properties
  arrowStartId?: string
  arrowEndId?: string
  arrowHeadStyle?: 'none' | 'arrow' | 'circle' | 'diamond'
  // Flip
  flipH?: boolean
  flipV?: boolean
  // Constraints
  constraints?: { horizontal: string; vertical: string }
  /** PHASE 9: true once the user set constraints manually — disables auto re-inference on moves */
  constraintsEdited?: boolean
  // Clip content (for frames)
  clipContent?: boolean
  // Boolean operation result
  booleanOperation?: 'union' | 'subtract' | 'intersect' | 'exclude'
  booleanSourceIds?: string[]
  /** PHASE 6: multi-contour result loops (rendered fillRule=evenodd). Primary contour is vectorNetwork. */
  booleanContours?: VectorNetwork[]
  /** PHASE 6: mask — clips all PREVIOUS siblings + itself within the same parent. */
  isMask?: boolean
  // Prototype interactions (PHASE 2) — optional for backward compatibility
  interactions?: Interaction[]
  // PHASE 7 — project style references (see lib/styles.ts)
  fillStyleId?: string
  strokeStyleId?: string
  textStyleId?: string
  effectStyleId?: string
  // PHASE 8 — per-frame layout grids (see lib/layout-grids.ts)
  layoutGrids?: import('@/lib/layout-grids').LayoutGrid[]
  // PHASE 10 — text sizing/case/strikethrough
  textAutoResize?: 'fixed' | 'hug' | 'grow'
  textCase?: 'original' | 'upper' | 'lower' | 'title'
  /** PHASE 13 — vertical alignment inside the text box (source: TOP 33 / MIDDLE / BOTTOM 35) */
  textAlignVertical?: 'top' | 'middle' | 'bottom'
  /** PHASE 13 — lists (source: ordered 12 / unordered 6 refs) */
  listType?: 'none' | 'ordered' | 'unordered'
  /** PHASE 13 — list indent before the bullet/number */
  listIndent?: number
  /** PHASE 15 — table model (source: TABLE 58 refs). Grid of text cells with
   *  per-column widths and per-row heights; width/height derive from the sums. */
  tableData?: {
    colWidths: number[]
    rowHeights: number[]
    /** cell texts [row][col] */
    cells: string[][]
    /** render first row as a header (tinted) */
    headerRow?: boolean
  }
  /** PHASE 17 — ellipse arc (source: transform_panel arcToolStart/Sweep/Ratio).
   *  start: degrees (0 = 3 o'clock, cw positive); sweep: degrees extent;
   *  innerRatio: 0..1 (0 = pie, >0 = donut). See lib/arc.ts. */
  arc?: import('@/lib/arc').EllipseArc
}

export interface Page {
  id: string
  name: string
  elements: DesignElement[]
  backgroundColor?: string
}

/** PHASE 16 — comment thread anchored to a canvas point. */
export interface CommentMessage {
  id: string
  author: string
  text: string
  ts: number
}
export interface CommentPin {
  id: string
  /** anchor in page/canvas coordinates */
  x: number
  y: number
  resolved: boolean
  messages: CommentMessage[]
}

interface HistoryEntry {
  elements: DesignElement[]
  selectedElementIds: string[]
}

interface EditorState {
  // Elements
  elements: DesignElement[]
  
  // Selection
  selectedElementIds: string[]
  
  // Tool
  activeTool: ToolType
  
  // Canvas
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  snapToGrid: boolean
  snapToElements: boolean
  gridSize: number
  showRulers: boolean
  // PHASE 8 — view options (see lib/layout-grids.ts for units/DPI)
  showPixelGrid: boolean
  showLayoutGrids: boolean
  snapToPixels: boolean
  rulerUnit: 'px' | 'in' | 'cm' | 'mm'
  
  // Guides
  guides: Guide[]
  
  // UI State
  leftTab: 'file' | 'assets'
  rightTab: 'design' | 'prototype' | 'inspect'
  editorMode: 'design' | 'prototype' | 'dev'
  leftSidebarVisible: boolean
  rightSidebarVisible: boolean
  
  // Pages
  pages: Page[]
  activePageId: string
  fileName: string
  
  // Clipboard
  clipboard: DesignElement[]
  
  // History (undo/redo)
  history: HistoryEntry[]
  historyIndex: number
  maxHistory: number
  
  // Frame navigation
  currentFrameId: string | null
  frameBreadcrumb: string[]
  
  // Save state
  lastSavedAt: number | null
  isSaving: boolean
  isDirty: boolean

  // Live sync (SSE) state
  /** Id of the server project currently open, or null for a local-only draft */
  currentProjectId: string | null
  /** Stable per-tab id used to suppress SSE echoes of our own writes */
  clientId: string
  /** 'offline' | 'connecting' | 'live' — reflects the SSE connection */
  syncStatus: 'offline' | 'connecting' | 'live'
  /** Human-readable origin of the last remote change (e.g. 'mcp-server', 'tab-…') */
  lastRemoteOrigin: string | null

  // Prototype player state (PHASE 2)
  /** Fullscreen prototype playback is active */
  isPreviewing: boolean
  /** Frame currently shown in the player (top-level frame id) */
  previewFrameId: string | null
  /** Open overlays, innermost last: { frameId, background, closeOnClickOutside } */
  overlayStack: { frameId: string; background: OverlayBackground; closeOnClickOutside: boolean }[]
  /** Navigation history for the 'back' action */
  previewHistory: string[]
  
  // Actions - Selection
  setSelectedElementIds: (ids: string[]) => void
  toggleElementSelection: (id: string) => void
  
  // Actions - Tool
  setActiveTool: (tool: ToolType) => void
  setEditorMode: (mode: 'design' | 'prototype' | 'dev') => void
  
  // Actions - Canvas
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  setShowGrid: (show: boolean) => void
  setSnapToGrid: (snap: boolean) => void
  setSnapToElements: (snap: boolean) => void
  setGridSize: (size: number) => void
  setShowRulers: (show: boolean) => void
  
  // Actions - UI State
  setLeftTab: (tab: 'file' | 'assets') => void
  setRightTab: (tab: 'design' | 'prototype' | 'inspect') => void
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
  
  // Actions - Element CRUD
  updateElement: (id: string, updates: Partial<DesignElement>) => void
  /** PHASE 12 — re-run the auto layout engine for an element's frame chain */
  syncAutoLayoutTree: (elementId: string) => void
  /** PHASE 12 — re-run the engine starting at a specific frame (then up the chain) */
  syncAutoLayoutFrame: (frameId: string) => void
  /** PHASE 12 — reorder a child inside its parent (auto layout re-flows) */
  reorderChild: (frameId: string, childId: string, toIndex: number) => void
  /** PHASE 15 — table cell / structure edits */
  updateTableCell: (elementId: string, row: number, col: number, text: string) => void
  addTableRow: (elementId: string, at?: number) => void
  removeTableRow: (elementId: string, at?: number) => void
  addTableColumn: (elementId: string, at?: number) => void
  removeTableColumn: (elementId: string, at?: number) => void
  resizeTableColumn: (elementId: string, col: number, width: number) => void
  resizeTableRow: (elementId: string, row: number, height: number) => void
  moveElement: (id: string, dx: number, dy: number) => void
  addElement: (element: DesignElement) => void
  deleteElement: (id: string) => void
  deleteSelectedElements: () => void
  duplicateElement: (id: string) => void
  duplicateSelectedElements: () => void
  
  // Actions - Z-order
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  
  // Actions - Group/Ungroup
  groupElements: (ids: string[]) => void
  ungroupElements: (id: string) => void
  renameElement: (id: string, name: string) => void
  selectAll: () => void
  // Actions - Boolean ops & masks (PHASE 6)
  applyBooleanOperation: (op: 'union' | 'subtract' | 'intersect' | 'exclude') => { ok: boolean; reason?: string; id?: string }
  setElementAsMask: (id: string, isMask: boolean) => void
  /** PHASE 17 (P2) — convert each selected stroked shape into a filled outline
   *  path (source: OUTLINE_STROKE=233). Returns count converted. */
  outlineStrokeSelection: () => number
  /** PHASE 17 (P3) — bake selected live boolean groups into static path
   *  elements carrying booleanContours (source: FLATTEN_SELECTION). Returns count flattened. */
  flattenSelection: () => number
  /** PHASE 18 (V5) — convert a parametric shape in place to an editable vector
   *  path (source: isVectorEditMode — Figma converts the shape on edit-entry).
   *  Returns the element id (still same id/slot) or null. */
  convertShapeToVector: (id: string) => string | null
  /** PHASE 18 — split multi-contour vector paths into separate path elements
   *  (source: break-vector-network-into-paths / fullscreen_actions.split_vector).
   *  Returns count of elements produced (0 = nothing eligible). */
  splitVectorSelection: () => number

  // Actions - Page
  addPage: (name: string) => void
  deletePage: (id: string) => void
  renamePage: (id: string, name: string) => void
  setActivePage: (id: string) => void
  duplicatePage: (id: string) => void
  reorderPages: (startIndex: number, endIndex: number) => void
  moveElementsToPage: (elementIds: string[], targetPageId: string) => void
  setPageBackground: (id: string, color: string) => void
  
  // Actions - Clipboard
  copySelected: () => void
  pasteClipboard: () => void
  
  // Actions - History
  undo: () => void
  redo: () => void
  pushHistory: () => void
  
  // Actions - File
  setFileName: (name: string) => void
  setLastSavedAt: (time: number | null) => void
  setSaving: (saving: boolean) => void
  setDirty: (dirty: boolean) => void
  loadElements: (elements: DesignElement[]) => void
  /** PHASE 4: insert imported elements (images/SVG) as one undoable batch. */
  importElementsBatch: (elements: DesignElement[]) => void
  /** PHASE 4: replace the whole document with an imported project file. */
  loadImportedProject: (pages: Page[], fileName: string | null, guides?: unknown[]) => void
  loadServerProject: (projectId: string) => Promise<void>
  closeServerProject: () => void

  // Actions - Live sync (SSE)
  setSyncStatus: (status: 'offline' | 'connecting' | 'live') => void
  applyRemoteElement: (element: DesignElement, pageId?: string) => void
  applyRemoteElementUpdate: (element: DesignElement, pageId?: string) => void
  applyRemoteElementDelete: (elementId: string, pageId?: string) => void
  applyRemoteProject: (project: unknown) => void
  
  // Actions - Component system
  addComponent: (id: string) => void
  createInstance: (componentId: string) => void
  resetOverrides: (instanceId: string) => void
  detachInstance: (instanceId: string) => void
  propagateComponentChanges: (componentId: string) => void
  // Actions - Component Variant system
  addComponentSet: (ids: string[], name: string) => void
  addComponentPropertyDefinition: (componentId: string, propName: string, def: ComponentPropertyDefinition) => void
  editComponentPropertyDefinition: (componentId: string, propName: string, def: Partial<ComponentPropertyDefinition>) => void
  deleteComponentPropertyDefinition: (componentId: string, propName: string) => void
  addVariantPropertyDefinition: (componentSetId: string, propName: string, values: string[]) => void
  setVariantPropertyValue: (variantId: string, propName: string, value: string) => void
  setComponentPropertyValue: (instanceId: string, propName: string, value: ComponentPropertyValue) => void
  swapInstanceComponent: (instanceId: string, newComponentId: string) => void
  setDefaultVariant: (componentSetId: string, variantId: string) => void
  
  // Actions - Fill/Stroke layers
  addFill: (id: string, fill: FillStyle) => void
  removeFill: (id: string, fillIndex: number) => void
  updateFill: (id: string, fillIndex: number, fill: Partial<FillStyle>) => void
  addStroke: (id: string, stroke: StrokeStyle) => void
  removeStroke: (id: string, strokeIndex: number) => void
  updateStroke: (id: string, strokeIndex: number, stroke: Partial<StrokeStyle>) => void
  
  // Actions - Effects
  addEffect: (id: string, effect: ShadowEffect | BlurEffect) => void
  removeEffect: (id: string, effectIndex: number) => void
  updateEffect: (id: string, effectIndex: number, effect: Partial<ShadowEffect | BlurEffect>) => void
  
  // Actions - Export settings
  addExportSetting: (id: string, setting: { format: string; scale: number; quality?: number }) => void
  removeExportSetting: (id: string, index: number) => void

  // Actions - Styles (PHASE 7) — see lib/styles.ts for the model
  /** All project styles (paint/text/effect) for the open document. */
  styles: import('@/lib/styles').ProjectStyle[]

  // PHASE 16 — comments (source: comment tool in ToolType + Figma comment pins)
  /** Comment pins on the current page (canvas coordinates). */
  comments: CommentPin[]
  /** Pin whose thread popover is open. */
  activeCommentId: string | null
  /** New-comment composer position (canvas coords) when open. */
  composerPos: { x: number; y: number } | null
  /** Create a pin with the first message. */
  addComment: (x: number, y: number, text: string) => void
  /** Append a reply to a thread. */
  replyToComment: (commentId: string, text: string) => void
  /** Toggle a thread's resolved state. */
  toggleResolveComment: (commentId: string) => void
  /** Delete a pin and its thread. */
  deleteComment: (commentId: string) => void
  /** Open/close the thread popover. */
  setActiveCommentId: (commentId: string | null) => void
  /** Open the new-comment composer at canvas coords. */
  openComposer: (x: number, y: number) => void
  /** Close the composer. */
  closeComposer: () => void
  /** Load comments (server load / import). */
  loadComments: (comments: CommentPin[]) => void
  /** Create a style from the given slot of an element and attach it. */
  createStyleFromElement: (elementId: string, slot: import('@/lib/styles').StyleSlot, name: string) => string | null
  /** Apply a style to every currently selected element (where the slot applies). */
  applyStyleToSelection: (styleId: string) => void
  /** Detach a style from selection (values are kept). */
  detachStyleFromSelection: (styleId: string) => void
  /** Update a style definition and re-broadcast to all referencing elements. */
  updateStyle: (styleId: string, updates: Partial<import('@/lib/styles').ProjectStyle>) => void
  /** Rename a style. */
  renameStyle: (styleId: string, name: string) => void
  /** Delete a style and detach all references. */
  deleteStyle: (styleId: string) => void
  /** Load styles (project import / server load). */
  loadStyles: (styles: import('@/lib/styles').ProjectStyle[]) => void

  // Actions - Layout grids (PHASE 8)
  /** Add a layout grid to a frame. */
  addLayoutGrid: (frameId: string, pattern: 'columns' | 'rows' | 'grid') => void
  /** Update one layout grid of a frame. */
  updateLayoutGrid: (frameId: string, gridId: string, updates: Partial<import('@/lib/layout-grids').LayoutGrid>) => void
  /** Remove one layout grid from a frame. */
  removeLayoutGrid: (frameId: string, gridId: string) => void

  // Actions - View options (PHASE 8)
  setShowPixelGrid: (show: boolean) => void
  setShowLayoutGrids: (show: boolean) => void
  setSnapToPixels: (snap: boolean) => void
  setRulerUnit: (unit: 'px' | 'in' | 'cm' | 'mm') => void

  // Actions - Constraints (PHASE 9)
  /** Resize a frame and reposition/resize its children according to their
   *  constraints (left/center/right/left-right, top/center/bottom/top-bottom). */
  resizeFrameWithConstraints: (frameId: string, next: { x?: number; y?: number; width: number; height: number }) => void
  /** Infer constraints for a child from its position in parent (creation-time). */
  inferChildConstraints: (childId: string, parentFrameId: string) => void

  // Actions - Text auto-size (PHASE 10)
  /** Recompute a text element's width/height from its content per textAutoResize mode. */
  applyTextAutoSize: (elementId: string) => void

  // Actions - Prototype (PHASE 2)
  addInteraction: (elementId: string, interaction: Interaction) => void
  updateInteraction: (elementId: string, interactionId: string, updates: Partial<Interaction>) => void
  removeInteraction: (elementId: string, interactionId: string) => void
  /** Start fullscreen prototype playback (optionally from a given frame). */
  startPreview: (frameId?: string | null) => void
  stopPreview: () => void
  /** Execute a prototype action during playback (navigate/overlay/url/back). */
  previewNavigate: (action: PrototypeAction) => void
  
  // Actions - Transform
  setBlendMode: (id: string, mode: string) => void
  flipHorizontal: (id: string) => void
  flipVertical: (id: string) => void
  alignElements: (ids: string[], alignment: string) => void
  distributeElements: (ids: string[], direction: string) => void
  booleanOperation: (ids: string[], operation: string) => void
  
  // Actions - Guides
  addGuide: (guide: Guide) => void
  removeGuide: (id: string) => void
  clearGuides: () => void
  
  // Actions - Save/Load
  saveToFile: () => Promise<void>
  loadFromFile: () => Promise<void>
  
  // Actions - Frame navigation
  setCurrentFrameId: (id: string | null) => void
  enterFrame: (id: string) => void
  exitFrame: () => void
  moveElementToFrame: (elementId: string, frameId: string) => void
  moveElementOutOfFrame: (elementId: string) => void

  // Helper
  getElementById: (id: string) => DesignElement | null
  getSelectedElements: () => DesignElement[]
  reorderElement: (id: string, newIndex: number) => void
}

let elementCounter = 0

export function generateId(prefix: string = 'el'): string {
  elementCounter++
  return `${prefix}-${Date.now()}-${elementCounter}`
}

export function createDefaultElement(type: ElementType, overrides?: Partial<DesignElement>): DesignElement {
  const id = generateId(type)
  const typeDefaults: Record<ElementType, Partial<DesignElement>> = {
    rectangle: { name: `Rectangle ${elementCounter}`, fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 },
    ellipse: { name: `Ellipse ${elementCounter}`, fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 },
    line: { name: `Line ${elementCounter}`, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 0 },
    text: { name: `Text ${elementCounter}`, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0, textContent: 'Text', fontFamily: 'Inter', fontSize: 18, fontWeight: 400, textAlign: 'left' as const, textColor: '#000000', lineHeight: 1.4, letterSpacing: 0, textAutoResize: 'grow' as const },
    frame: { name: `Frame ${elementCounter}`, fill: '#FFFFFF', stroke: '#E0E0E0', strokeWidth: 1, cornerRadius: 0, clipContent: true },
    group: { name: `Group ${elementCounter}`, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 },
    path: { name: `Path ${elementCounter}`, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 0, pathPoints: [], pathClosed: false },
    polygon: { name: `Polygon ${elementCounter}`, fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0, sides: 6 },
    star: { name: `Star ${elementCounter}`, fill: '#FFD93D', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0, sides: 5, innerRadius: 40 },
    boolean: { name: `Boolean ${elementCounter}`, fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 },
    arrow: { name: `Arrow ${elementCounter}`, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 0, arrowHeadStyle: 'arrow' },
    slice: { name: `Slice ${elementCounter}`, fill: 'transparent', stroke: '#0D99FF', strokeWidth: 1, cornerRadius: 0 },
    'component-set': { name: `Component Set ${elementCounter}`, fill: '#2C2C2C', stroke: '#A259FF', strokeWidth: 1, cornerRadius: 0, isComponentSet: true, isComponent: true },
    // PHASE 15 — section / table / sticky (source: SECTION 116 / TABLE 58 / STICKY 52)
    section: { name: `Section ${elementCounter}`, fill: '#B3D6F2', stroke: 'transparent', strokeWidth: 0, cornerRadius: 12, clipContent: false, width: 480, height: 360 },
    table: { name: `Table ${elementCounter}`, fill: '#FFFFFF', stroke: '#383838', strokeWidth: 1, cornerRadius: 0, width: 420, height: 180,
      tableData: { colWidths: [140, 140, 140], rowHeights: [44, 44, 44], cells: [['Header A', 'Header B', 'Header C'], ['', '', ''], ['', '', '']], headerRow: true } },
    sticky: { name: `Sticky ${elementCounter}`, fill: '#F5D90A', stroke: 'transparent', strokeWidth: 0, cornerRadius: 4, width: 200, height: 160, textContent: 'Sticky note', fontFamily: 'Inter', fontSize: 14, fontWeight: 400, textAlign: 'left', textColor: '#1E1E1E', lineHeight: 1.4, letterSpacing: 0, textAlignVertical: 'top' },
  }
  
  const td = typeDefaults[type] || {}
  return {
    id,
    name: td.name || `${type} ${elementCounter}`,
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fill: td.fill ?? 'transparent',
    stroke: td.stroke ?? 'transparent',
    strokeWidth: td.strokeWidth ?? 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: td.cornerRadius ?? 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    ...(td.textContent !== undefined ? { textContent: td.textContent } : {}),
    ...(td.fontFamily !== undefined ? { fontFamily: td.fontFamily } : {}),
    ...(td.fontSize !== undefined ? { fontSize: td.fontSize } : {}),
    ...(td.fontWeight !== undefined ? { fontWeight: td.fontWeight } : {}),
    ...(td.textAlign !== undefined ? { textAlign: td.textAlign } : {}),
    ...(td.textColor !== undefined ? { textColor: td.textColor } : {}),
    ...(td.lineHeight !== undefined ? { lineHeight: td.lineHeight } : {}),
    ...(td.letterSpacing !== undefined ? { letterSpacing: td.letterSpacing } : {}),
    ...(td.pathPoints !== undefined ? { pathPoints: td.pathPoints } : {}),
    ...(td.pathClosed !== undefined ? { pathClosed: td.pathClosed } : {}),
    ...(td.sides !== undefined ? { sides: td.sides } : {}),
    ...(td.innerRadius !== undefined ? { innerRadius: td.innerRadius } : {}),
    ...(td.clipContent !== undefined ? { clipContent: td.clipContent } : {}),
    ...(td.arrowHeadStyle !== undefined ? { arrowHeadStyle: td.arrowHeadStyle } : {}),
    ...overrides,
  }
}

const initialElements: DesignElement[] = [
  {
    id: 'rect-1',
    name: 'Rectangle 1',
    type: 'rectangle',
    x: -600,
    y: -200,
    width: 200,
    height: 150,
    fill: '#D9D9D9',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
  },
  {
    id: 'rect-2',
    name: 'Rectangle 2',
    type: 'rectangle',
    x: -350,
    y: -100,
    width: 180,
    height: 120,
    fill: '#FF6B6B',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 12,
    cornerRadiusTL: 12,
    cornerRadiusTR: 12,
    cornerRadiusBL: 12,
    cornerRadiusBR: 12,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    shadows: [{ type: 'drop-shadow', x: 0, y: 4, blur: 12, spread: 0, color: '#000000', opacity: 15, visible: true }],
  },
  {
    id: 'ellipse-1',
    name: 'Ellipse 1',
    type: 'ellipse',
    x: -100,
    y: -250,
    width: 160,
    height: 160,
    fill: '#4ECDC4',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
  },
  {
    id: 'rect-3',
    name: 'Card',
    type: 'rectangle',
    x: 100,
    y: -100,
    width: 280,
    height: 180,
    fill: '#FFFFFF',
    stroke: '#E0E0E0',
    strokeWidth: 1,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 16,
    cornerRadiusTL: 16,
    cornerRadiusTR: 16,
    cornerRadiusBL: 16,
    cornerRadiusBR: 16,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    shadows: [{ type: 'drop-shadow', x: 0, y: 2, blur: 8, spread: 0, color: '#000000', opacity: 10, visible: true }],
  },
  {
    id: 'text-1',
    name: 'Heading',
    type: 'text',
    x: 120,
    y: -70,
    width: 240,
    height: 36,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    textContent: 'Hello, Figma!',
    fontFamily: 'Inter',
    fontSize: 28,
    fontWeight: 700,
    textAlign: 'left',
    textColor: '#1A1A1A',
    lineHeight: 1.3,
    letterSpacing: -0.5,
  },
  {
    id: 'text-2',
    name: 'Body Text',
    type: 'text',
    x: 120,
    y: -30,
    width: 240,
    height: 60,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    textContent: 'Design beautiful interfaces with this Figma-like editor.',
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: 400,
    textAlign: 'left',
    textColor: '#666666',
    lineHeight: 1.5,
    letterSpacing: 0,
  },
  {
    id: 'line-1',
    name: 'Line 1',
    type: 'line',
    x: -600,
    y: 50,
    width: 400,
    height: 0,
    fill: 'transparent',
    stroke: '#0D99FF',
    strokeWidth: 2,
    strokeStyle: 'dashed',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
  },
  {
    id: 'star-1',
    name: 'Star 1',
    type: 'star',
    x: 500,
    y: -200,
    width: 120,
    height: 120,
    fill: '#FFD93D',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    sides: 5,
    innerRadius: 40,
  },
  {
    id: 'group-1',
    name: 'iPhone Frame',
    type: 'group',
    x: -471.5,
    y: -437,
    width: 393,
    height: 852,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    children: [
      {
        id: 'iphone-frame',
        name: 'iPhone 16',
        type: 'frame',
        x: 0,
        y: 0,
        width: 393,
        height: 852,
        fill: '#FFFFFF',
        stroke: '#E0E0E0',
        strokeWidth: 1,
        strokeStyle: 'solid',
        strokeAlign: 'center',
        cornerRadius: 40,
        cornerRadiusTL: 40,
        cornerRadiusTR: 40,
        cornerRadiusBL: 40,
        cornerRadiusBR: 40,
        opacity: 100,
        rotation: 0,
        visible: true,
        locked: false,
        blendMode: 'normal',
        flipH: false,
        flipV: false,
        clipContent: true,
      },
      {
        id: 'iphone-status',
        name: 'Status Bar',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 393,
        height: 54,
        fill: '#F8F8F8',
        stroke: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        strokeAlign: 'center',
        cornerRadius: 0,
        cornerRadiusTL: 0,
        cornerRadiusTR: 0,
        cornerRadiusBL: 0,
        cornerRadiusBR: 0,
        opacity: 100,
        rotation: 0,
        visible: true,
        locked: false,
        blendMode: 'normal',
        flipH: false,
        flipV: false,
        clipContent: false,
      },
      {
        id: 'iphone-island',
        name: 'Dynamic Island',
        type: 'rectangle',
        x: 76,
        y: 12,
        width: 126,
        height: 32,
        fill: '#000000',
        stroke: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        strokeAlign: 'center',
        cornerRadius: 20,
        cornerRadiusTL: 20,
        cornerRadiusTR: 20,
        cornerRadiusBL: 20,
        cornerRadiusBR: 20,
        opacity: 100,
        rotation: 0,
        visible: true,
        locked: false,
        blendMode: 'normal',
        flipH: false,
        flipV: false,
        clipContent: false,
      },
    ],
  },
  // ---- PHASE 2 demo flow: two wireframe screens wired with prototype
  // interactions so playback (▶) works out of the box. The button on
  // "Home" smart-animates to "Detail" (matching children by name path);
  // the back button returns. Keep names in sync across both frames so
  // smart-animate matching (DECISION-005) finds the pairs.
  {
    id: 'proto-home',
    name: 'Home',
    type: 'frame',
    x: 700,
    y: -380,
    width: 320,
    height: 480,
    fill: '#FFFFFF',
    stroke: '#E0E0E0',
    strokeWidth: 1,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 12,
    cornerRadiusTL: 12,
    cornerRadiusTR: 12,
    cornerRadiusBL: 12,
    cornerRadiusBR: 12,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: true,
    children: [
      {
        id: 'proto-home-title',
        name: 'Title',
        type: 'text',
        x: 24, y: 32, width: 272, height: 32,
        fill: 'transparent', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
        opacity: 100, rotation: 0, visible: true, locked: false, blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
        textContent: 'Prototype demo', fontFamily: 'Inter', fontSize: 22, fontWeight: 700, textAlign: 'left',
        textColor: '#1A1A1A', lineHeight: 1.3, letterSpacing: -0.4,
      },
      {
        id: 'proto-home-card',
        name: 'Card',
        type: 'rectangle',
        x: 24, y: 84, width: 272, height: 180,
        fill: '#F5F5F5', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 12, cornerRadiusTL: 12, cornerRadiusTR: 12, cornerRadiusBL: 12, cornerRadiusBR: 12,
        opacity: 100, rotation: 0, visible: true, locked: false, blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
      },
      {
        id: 'proto-home-cta',
        name: 'CTA Button',
        type: 'rectangle',
        x: 24, y: 300, width: 272, height: 48,
        fill: '#0D99FF', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 8, cornerRadiusTL: 8, cornerRadiusTR: 8, cornerRadiusBL: 8, cornerRadiusBR: 8,
        opacity: 100, rotation: 0, visible: true, locked: false, blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
        interactions: [
          {
            id: 'ix-demo-1',
            trigger: { type: 'click' },
            action: { type: 'navigate', destinationId: 'proto-detail' },
            animation: { type: 'smart-animate', durationMs: 400, easing: 'ease-in-out' },
          },
        ],
      },
      {
        id: 'proto-home-cta-label',
        name: 'CTA Label',
        type: 'text',
        x: 24, y: 312, width: 272, height: 24,
        fill: 'transparent', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
        opacity: 100, rotation: 0, visible: true, locked: false, blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
        textContent: 'Open detail →', fontFamily: 'Inter', fontSize: 15, fontWeight: 550, textAlign: 'center',
        textColor: '#FFFFFF', lineHeight: 1.2, letterSpacing: 0,
        interactions: [
          {
            id: 'ix-demo-2',
            trigger: { type: 'click' },
            action: { type: 'navigate', destinationId: 'proto-detail' },
            animation: { type: 'smart-animate', durationMs: 400, easing: 'ease-in-out' },
          },
        ],
      },
    ],
  },
  {
    id: 'proto-detail',
    name: 'Detail',
    type: 'frame',
    x: 1080,
    y: -380,
    width: 320,
    height: 480,
    fill: '#FFFFFF',
    stroke: '#E0E0E0',
    strokeWidth: 1,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 12,
    cornerRadiusTL: 12,
    cornerRadiusTR: 12,
    cornerRadiusBL: 12,
    cornerRadiusBR: 12,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: true,
    children: [
      {
        id: 'proto-detail-title',
        name: 'Title',
        type: 'text',
        x: 24, y: 32, width: 272, height: 32,
        fill: 'transparent', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
        opacity: 100, rotation: 0, visible: true, locked: false, blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
        textContent: 'Detail screen', fontFamily: 'Inter', fontSize: 22, fontWeight: 700, textAlign: 'left',
        textColor: '#1A1A1A', lineHeight: 1.3, letterSpacing: -0.4,
      },
      {
        id: 'proto-detail-card',
        name: 'Card',
        type: 'rectangle',
        x: 24, y: 84, width: 272, height: 280,
        fill: '#EEF6FF', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 12, cornerRadiusTL: 12, cornerRadiusTR: 12, cornerRadiusBL: 12, cornerRadiusBR: 12,
        opacity: 100, rotation: 0, visible: true, locked: false, blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
      },
      {
        id: 'proto-detail-back',
        name: 'CTA Button',
        type: 'rectangle',
        x: 24, y: 396, width: 272, height: 48,
        fill: '#2C2C2C', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 8, cornerRadiusTL: 8, cornerRadiusTR: 8, cornerRadiusBL: 8, cornerRadiusBR: 8,
        opacity: 100, rotation: 0, visible: true, locked: false, blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
        interactions: [
          {
            id: 'ix-demo-3',
            trigger: { type: 'click' },
            action: { type: 'back' },
            animation: { type: 'smart-animate', durationMs: 400, easing: 'ease-in-out' },
          },
        ],
      },
      {
        id: 'proto-detail-back-label',
        name: 'CTA Label',
        type: 'text',
        x: 24, y: 408, width: 272, height: 24,
        fill: 'transparent', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
        opacity: 100, rotation: 0, visible: true, locked: false, blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
        textContent: '← Back home', fontFamily: 'Inter', fontSize: 15, fontWeight: 550, textAlign: 'center',
        textColor: '#FFFFFF', lineHeight: 1.2, letterSpacing: 0,
        interactions: [
          {
            id: 'ix-demo-4',
            trigger: { type: 'click' },
            action: { type: 'back' },
            animation: { type: 'smart-animate', durationMs: 400, easing: 'ease-in-out' },
          },
        ],
      },
    ],
  },
]

const initialPage: Page = {
  id: 'page-1',
  name: 'Page 1',
  elements: initialElements,
}

// Flatten all elements (including children) to a flat list
function flattenElements(elements: DesignElement[]): DesignElement[] {
  return getAllElements(elements)
}

function regenerateIds(el: DesignElement): DesignElement {
  const newEl: DesignElement = {
    ...JSON.parse(JSON.stringify(el)),
    id: generateId(el.type),
  }
  if (newEl.children) {
    newEl.children = newEl.children.map(regenerateIds)
  }
  return newEl
}

export const useEditorStore = create<EditorState>((set, get) => ({
  elements: initialElements,
  selectedElementIds: [],
  activeTool: 'move',
  zoom: 0.45,
  panX: 0,
  panY: 0,
  showGrid: true,
  snapToGrid: false,
  snapToElements: true,
  gridSize: 8,
  showRulers: true,
  // PHASE 8 — view options (defaults match Figma: pixel grid on, layout grids on,
  // snap-to-pixels on, ruler unit px @ DPI 72)
  showPixelGrid: true,
  showLayoutGrids: true,
  snapToPixels: true,
  rulerUnit: 'px' as 'px' | 'in' | 'cm' | 'mm',
  // PHASE 7 — project styles
  styles: [],
  // PHASE 16 — comments
  comments: [],
  activeCommentId: null,
  composerPos: null,
  guides: [],
  leftTab: 'file',
  rightTab: 'design',
  editorMode: 'design',
  leftSidebarVisible: true,
  rightSidebarVisible: true,
  pages: [initialPage],
  activePageId: 'page-1',
  fileName: 'Untitled',
  clipboard: [],
  history: [{ elements: deepCloneElements(initialElements), selectedElementIds: [] }],
  historyIndex: 0,
  maxHistory: 50,
  currentFrameId: null,
  frameBreadcrumb: [],
  lastSavedAt: null,
  isSaving: false,
  isDirty: false,
  currentProjectId: null,
  clientId: generateClientId(),
  syncStatus: 'offline',
  lastRemoteOrigin: null,

  isPreviewing: false,
  previewFrameId: null,
  overlayStack: [],
  previewHistory: [],

  setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),
  
  toggleElementSelection: (id) =>
    set((state) => {
      const isSelected = state.selectedElementIds.includes(id)
      if (isSelected) {
        return { selectedElementIds: state.selectedElementIds.filter((i) => i !== id) }
      }
      return { selectedElementIds: [...state.selectedElementIds, id] }
    }),

  setActiveTool: (tool) => set({ activeTool: tool }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  setZoom: (zoom) => set({ zoom: isFinite(zoom) ? Math.min(64, Math.max(0.01, zoom)) : 1 }),
  setPan: (x, y) => set({ panX: isFinite(x) ? x : 0, panY: isFinite(y) ? y : 0 }),
  setShowGrid: (show) => set({ showGrid: show }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setShowPixelGrid: (show) => set({ showPixelGrid: show }),
  setShowLayoutGrids: (show) => set({ showLayoutGrids: show }),
  setSnapToPixels: (snap) => set({ snapToPixels: snap }),
  setRulerUnit: (unit) => set({ rulerUnit: unit }),

  // ---------- PHASE 7: styles -------------------------------------------
  createStyleFromElement: (elementId, slot, name) => {
    const el = findElementInList(get().elements, elementId)
    if (!el) return null
    let style: import('@/lib/styles').ProjectStyle | null = null
    if (slot === 'fill' || slot === 'stroke') {
      const paint = paintFromElement(el)
      if (!paint) return null
      style = { id: generateId('style'), name, kind: 'paint', paint, createdAt: Date.now() }
    } else if (slot === 'text') {
      const text = textFromElement(el)
      if (!text) return null
      style = { id: generateId('style'), name, kind: 'text', text, createdAt: Date.now() }
    } else {
      const effects = effectsFromElement(el)
      if (!effects) return null
      style = { id: generateId('style'), name, kind: 'effect', effects, createdAt: Date.now() }
    }
    set((state) => {
      // attach to the source element
      const updates: Partial<DesignElement> =
        slot === 'fill' ? { fillStyleId: style!.id } :
        slot === 'stroke' ? { strokeStyleId: style!.id } :
        slot === 'text' ? { textStyleId: style!.id } :
        { effectStyleId: style!.id }
      return {
        styles: [...state.styles, style!],
        elements: updateElementInList(state.elements, elementId, updates),
        isDirty: true,
      }
    })
    return style.id
  },

  applyStyleToSelection: (styleId) => {
    const state = get()
    const style = state.styles.find((s) => s.id === styleId)
    if (!style) return
    set({
      elements: state.selectedElementIds.reduce((els, id) => {
        const el = findElementInList(els, id)
        if (!el) return els
        if (style.kind === 'text' && el.type !== 'text') return els
        if (style.kind === 'paint' && el.fillStyleId === styleId) return els
        const updates = applyStyleUpdates(el, style)
        // stroke slot only applied when explicitly asked — fill slot is default
        return updateElementInList(els, id, updates)
      }, state.elements),
      isDirty: true,
    })
  },

  detachStyleFromSelection: (styleId) => {
    const state = get()
    set({
      elements: state.selectedElementIds.reduce((els, id) => {
        const el = findElementInList(els, id)
        if (!el) return els
        return updateElementInList(els, id, detachStyleUpdates(el, styleId))
      }, state.elements),
      isDirty: true,
    })
  },

  updateStyle: (styleId, updates) => {
    const state = get()
    const style = state.styles.find((s) => s.id === styleId)
    if (!style) return
    const next = { ...style, ...updates }
    // re-broadcast to every referencing element (deep)
    const rebroadcast = (els: DesignElement[]): DesignElement[] =>
      els.map((el) => {
        let updated = el
        if (el.fillStyleId === styleId || el.strokeStyleId === styleId ||
            el.textStyleId === styleId || el.effectStyleId === styleId) {
          updated = { ...el, ...applyStyleUpdates(el, next), }
        }
        if (el.children) return { ...updated, children: rebroadcast(el.children) }
        return updated
      })
    set({ styles: state.styles.map((s) => (s.id === styleId ? next : s)), elements: rebroadcast(state.elements), isDirty: true })
  },

  renameStyle: (styleId, name) =>
    set((state) => ({ styles: state.styles.map((s) => (s.id === styleId ? { ...s, name } : s)), isDirty: true })),

  deleteStyle: (styleId) => {
    const state = get()
    const clear = (els: DesignElement[]): DesignElement[] =>
      els.map((el) => {
        let updated = el
        if (el.fillStyleId === styleId || el.strokeStyleId === styleId ||
            el.textStyleId === styleId || el.effectStyleId === styleId) {
          updated = { ...el, ...detachStyleUpdates(el, styleId) }
        }
        if (el.children) return { ...updated, children: clear(el.children) }
        return updated
      })
    set({ styles: state.styles.filter((s) => s.id !== styleId), elements: clear(state.elements), isDirty: true })
  },

  loadStyles: (styles) => set({ styles }),

  // ---------- PHASE 16: comments ----------------------------------------
  addComment: (x, y, text) =>
    set((state) => ({
      comments: [...state.comments, {
        id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        x, y, resolved: false,
        messages: [{ id: `msg-${Date.now()}`, author: 'You', text, ts: Date.now() }],
      }],
      composerPos: null,
      isDirty: true,
    })),

  replyToComment: (commentId, text) =>
    set((state) => ({
      comments: state.comments.map(c => c.id === commentId
        ? { ...c, messages: [...c.messages, { id: `msg-${Date.now()}`, author: 'You', text, ts: Date.now() }] }
        : c),
      isDirty: true,
    })),

  toggleResolveComment: (commentId) =>
    set((state) => ({
      comments: state.comments.map(c => c.id === commentId ? { ...c, resolved: !c.resolved } : c),
      isDirty: true,
    })),

  deleteComment: (commentId) =>
    set((state) => ({
      comments: state.comments.filter(c => c.id !== commentId),
      activeCommentId: state.activeCommentId === commentId ? null : state.activeCommentId,
      isDirty: true,
    })),

  setActiveCommentId: (commentId) => set({ activeCommentId: commentId }),
  openComposer: (x, y) => set({ composerPos: { x, y }, activeCommentId: null }),
  closeComposer: () => set({ composerPos: null }),
  loadComments: (comments) => set({ comments: comments || [] }),

  // ---------- PHASE 8: layout grids -------------------------------------
  addLayoutGrid: (frameId, pattern) =>
    set((state) => {
      const frame = findElementInList(state.elements, frameId)
      if (!frame) return state
      const grid: import('@/lib/layout-grids').LayoutGrid =
        pattern === 'grid'
          ? { id: generateId('grid'), pattern, visible: true, size: 8, color: '#FF3B30' }
          : pattern === 'columns'
            ? { id: generateId('grid'), pattern, visible: true, count: 12, gutter: 16, margin: 32, type: 'stretch', color: '#FF3B30' }
            : { id: generateId('grid'), pattern, visible: true, count: 6, gutter: 16, margin: 32, type: 'start', color: '#FF3B30' }
      return {
        elements: updateElementInList(state.elements, frameId, { layoutGrids: [...(frame.layoutGrids || []), grid] }),
        isDirty: true,
      }
    }),

  updateLayoutGrid: (frameId, gridId, updates) =>
    set((state) => {
      const frame = findElementInList(state.elements, frameId)
      if (!frame || !frame.layoutGrids) return state
      return {
        elements: updateElementInList(state.elements, frameId, {
          layoutGrids: frame.layoutGrids.map((g) => (g.id === gridId ? { ...g, ...updates } : g)),
        }),
        isDirty: true,
      }
    }),

  removeLayoutGrid: (frameId, gridId) =>
    set((state) => {
      const frame = findElementInList(state.elements, frameId)
      if (!frame || !frame.layoutGrids) return state
      return {
        elements: updateElementInList(state.elements, frameId, {
          layoutGrids: frame.layoutGrids.filter((g) => g.id !== gridId),
        }),
        isDirty: true,
      }
    }),

  // ---------- PHASE 9: constraints --------------------------------------
  resizeFrameWithConstraints: (frameId, next) =>
    set((state) => {
      const frame = findElementInList(state.elements, frameId)
      if (!frame) return state
      const constrainedChildren = constrainChildren(frame, frame.width, frame.height, next.width, next.height)
      return {
        elements: updateElementInList(state.elements, frameId, {
          ...next,
          ...(constrainedChildren ? { children: constrainedChildren } : {}),
        }),
        isDirty: true,
      }
    }),

  inferChildConstraints: (childId, parentFrameId) =>
    set((state) => {
      const frame = findElementInList(state.elements, parentFrameId)
      if (!frame || !frame.children) return state
      const child = frame.children.find((c) => c.id === childId)
      if (!child) return state
      const inferred = inferConstraints(child, frame.width, frame.height)
      return {
        elements: updateElementInList(state.elements, parentFrameId, {
          children: frame.children.map((c) => (c.id === childId ? { ...c, constraints: inferred } : c)),
        }),
        isDirty: false, // inference is bookkeeping, not a user edit
      }
    }),

  // ---------- PHASE 10: text auto-size ---------------------------------
  applyTextAutoSize: (elementId) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || el.type !== 'text') return state
      const mode = el.textAutoResize || 'fixed'
      if (mode === 'fixed') return state
      // PHASE 13: list-aware line building so heights match the renderer
      const params = {
        text: el.textContent || '',
        fontFamily: el.fontFamily || 'Inter',
        fontSize: el.fontSize || 18,
        fontWeight: el.fontWeight || 400,
        lineHeight: el.lineHeight || 1.4,
        letterSpacing: el.letterSpacing || 0,
        fontStyle: el.fontStyle,
      }
      if (el.listType && el.listType !== 'none') {
        const lines = buildTextLines(params, {
          listType: el.listType,
          listIndent: el.listIndent,
          autoResize: mode,
          boxWidth: el.width,
        })
        const lineH = (el.fontSize || 18) * (el.lineHeight || 1.4)
        const updates: Partial<DesignElement> = { height: Math.max(1, Math.ceil(lines.length * lineH)) }
        if (mode === 'hug') {
          // width: longest line content + its x offset (prefix + indent)
          let maxW = 0
          for (const l of lines) {
            const w = measureText({ ...params, text: l.text || ' ' }, 'hug', el.width).width
            maxW = Math.max(maxW, l.x + w)
          }
          updates.width = Math.max(1, Math.ceil(maxW))
        }
        return { elements: updateElementInList(state.elements, elementId, updates), isDirty: true }
      }
      const m = measureText(params, mode, el.width)
      const updates: Partial<DesignElement> = { height: Math.max(1, Math.round(m.height)) }
      if (mode === 'hug') updates.width = Math.max(1, Math.round(m.width))
      return { elements: updateElementInList(state.elements, elementId, updates), isDirty: true }
    }),
  setSnapToElements: (snap) => set({ snapToElements: snap }),
  setGridSize: (size) => set({ gridSize: size }),
  setShowRulers: (show) => set({ showRulers: show }),

  updateElement: (id, updates) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      let applied = updates
      // PHASE 12: manually resizing a hug-sized auto-layout frame switches that
      // axis to fixed (Figma behavior) so the resize sticks instead of snapping back.
      // NOTE: the switch applies on top of the INCOMING autoLayout (if the same
      // update also changes direction/sizing, those win — never clobber them).
      if (el?.autoLayout && (updates.width !== undefined || updates.height !== undefined)) {
        const al = { ...(updates.autoLayout ?? el.autoLayout) }
        const horiz = al.direction === 'horizontal'
        if (updates.width !== undefined && (horiz ? al.primaryAxisSizing : al.counterAxisSizing) === 'hug') {
          if (horiz) al.primaryAxisSizing = 'fixed'; else al.counterAxisSizing = 'fixed'
        }
        if (updates.height !== undefined && (horiz ? al.counterAxisSizing : al.primaryAxisSizing) === 'hug') {
          if (horiz) al.counterAxisSizing = 'fixed'; else al.primaryAxisSizing = 'fixed'
        }
        applied = { ...updates, autoLayout: al }
      }
      const elements = applyAutoLayoutSync(updateElementInList(state.elements, id, applied), [id])
      return { elements, isDirty: true }
    }),

  // PHASE 12 — auto layout sync actions
  syncAutoLayoutTree: (elementId) =>
    set((state) => ({
      elements: applyAutoLayoutSync(state.elements, [elementId]),
      isDirty: true,
    })),

  syncAutoLayoutFrame: (frameId) =>
    set((state) => ({
      elements: applyAutoLayoutSync(state.elements, [frameId]),
      isDirty: true,
    })),

  reorderChild: (frameId, childId, toIndex) =>
    set((state) => {
      const frame = findElementInList(state.elements, frameId)
      if (!frame || !frame.children) return state
      const from = frame.children.findIndex(c => c.id === childId)
      if (from === -1) return state
      const children = [...frame.children]
      const [moved] = children.splice(from, 1)
      const idx = Math.max(0, Math.min(children.length, toIndex))
      children.splice(idx, 0, moved)
      return {
        elements: applyAutoLayoutSync(
          updateElementInList(state.elements, frameId, { children }),
          [frameId]
        ),
        isDirty: true,
      }
    }),

  // PHASE 15 — table actions: keep tableData consistent and re-derive width/height
  updateTableCell: (elementId, row, col, text) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || !el.tableData) return state
      const cells = el.tableData.cells.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? text : c)))
      return {
        elements: updateElementInList(state.elements, elementId, { tableData: { ...el.tableData, cells } }),
        isDirty: true,
      }
    }),

  addTableRow: (elementId, at) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || !el.tableData) return state
      const cols = el.tableData.colWidths.length
      const idx = at ?? el.tableData.rowHeights.length
      const rowHeights = [...el.tableData.rowHeights]
      rowHeights.splice(idx, 0, 44)
      const cells = [...el.tableData.cells]
      cells.splice(idx, 0, Array.from({ length: cols }, () => ''))
      return {
        elements: updateElementInList(state.elements, elementId, {
          tableData: { ...el.tableData, rowHeights, cells },
          height: rowHeights.reduce((a, b) => a + b, 0),
        }),
        isDirty: true,
      }
    }),

  removeTableRow: (elementId, at) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || !el.tableData || el.tableData.rowHeights.length <= 1) return state
      const idx = at ?? el.tableData.rowHeights.length - 1
      const rowHeights = el.tableData.rowHeights.filter((_, i) => i !== idx)
      const cells = el.tableData.cells.filter((_, i) => i !== idx)
      return {
        elements: updateElementInList(state.elements, elementId, {
          tableData: { ...el.tableData, rowHeights, cells },
          height: rowHeights.reduce((a, b) => a + b, 0),
        }),
        isDirty: true,
      }
    }),

  addTableColumn: (elementId, at) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || !el.tableData) return state
      const idx = at ?? el.tableData.colWidths.length
      const colWidths = [...el.tableData.colWidths]
      colWidths.splice(idx, 0, 140)
      const cells = el.tableData.cells.map(r => { const nr = [...r]; nr.splice(idx, 0, ''); return nr })
      return {
        elements: updateElementInList(state.elements, elementId, {
          tableData: { ...el.tableData, colWidths, cells },
          width: colWidths.reduce((a, b) => a + b, 0),
        }),
        isDirty: true,
      }
    }),

  removeTableColumn: (elementId, at) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || !el.tableData || el.tableData.colWidths.length <= 1) return state
      const idx = at ?? el.tableData.colWidths.length - 1
      const colWidths = el.tableData.colWidths.filter((_, i) => i !== idx)
      const cells = el.tableData.cells.map(r => r.filter((_, i) => i !== idx))
      return {
        elements: updateElementInList(state.elements, elementId, {
          tableData: { ...el.tableData, colWidths, cells },
          width: colWidths.reduce((a, b) => a + b, 0),
        }),
        isDirty: true,
      }
    }),

  resizeTableColumn: (elementId, col, width) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || !el.tableData || width < 20) return state
      const colWidths = el.tableData.colWidths.map((w, i) => (i === col ? Math.round(width) : w))
      return {
        elements: updateElementInList(state.elements, elementId, {
          tableData: { ...el.tableData, colWidths },
          width: colWidths.reduce((a, b) => a + b, 0),
        }),
        isDirty: true,
      }
    }),

  resizeTableRow: (elementId, row, height) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || !el.tableData || height < 20) return state
      const rowHeights = el.tableData.rowHeights.map((h, i) => (i === row ? Math.round(height) : h))
      return {
        elements: updateElementInList(state.elements, elementId, {
          tableData: { ...el.tableData, rowHeights },
          height: rowHeights.reduce((a, b) => a + b, 0),
        }),
        isDirty: true,
      }
    }),

  setLeftTab: (tab) => set({ leftTab: tab }),
  setRightTab: (tab) => set({ rightTab: tab }),
  toggleLeftSidebar: () => set((state) => ({ leftSidebarVisible: !state.leftSidebarVisible })),
  toggleRightSidebar: () => set((state) => ({ rightSidebarVisible: !state.rightSidebarVisible })),

  moveElement: (id, dx, dy) =>
    set((state) => ({
      elements: updateElementInList(state.elements, id, { 
        x: (findElementInList(state.elements, id)?.x ?? 0) + dx, 
        y: (findElementInList(state.elements, id)?.y ?? 0) + dy 
      }),
      isDirty: true,
    })),

  addElement: (element) =>
    set((state) => {
      // If a frame is currently being edited, add element as a child of that frame
      if (state.currentFrameId) {
        const frame = findElementInList(state.elements, state.currentFrameId)
        if (frame && ((frame.type === 'frame' || frame.type === 'group' || frame.type === 'section'))) {
          const existingChildren = frame.children || []
          const relChild = {
            ...element,
            x: element.x - frame.x,
            y: element.y - frame.y,
          }
          // PHASE 9: infer constraints at creation time
          const childElement = element.constraintsEdited
            ? relChild
            : { ...relChild, constraints: inferConstraints(relChild, frame.width, frame.height) }
          const elements = applyAutoLayoutSync(
            updateElementInList(state.elements, state.currentFrameId, {
              children: [...existingChildren, childElement],
            }),
            [state.currentFrameId]
          )
          return {
            elements,
            isDirty: true,
          }
        }
      }
      return {
        elements: [...state.elements, element],
        isDirty: true,
      }
    }),

  deleteElement: (id) =>
    set((state) => {
      // PHASE 12: capture the parent chain before removal so auto-layout frames re-flow
      const ancestors = findAncestors(state.elements, id)
      return {
        elements: applyAutoLayoutSync(removeElementFromList(state.elements, id), ancestors.map(a => a.id)),
        selectedElementIds: state.selectedElementIds.filter((i) => i !== id),
        isDirty: true,
      }
    }),

  deleteSelectedElements: () =>
    set((state) => {
      // PHASE 12: capture all ancestor chains before removal (auto-layout re-flow)
      const ancestorIds = new Set<string>()
      for (const id of state.selectedElementIds) {
        for (const a of findAncestors(state.elements, id)) ancestorIds.add(a.id)
      }
      const removed = state.selectedElementIds.reduce(
        (els, id) => removeElementFromList(els, id),
        state.elements
      )
      return {
        elements: applyAutoLayoutSync(removed, [...ancestorIds]),
        selectedElementIds: [],
        isDirty: true,
      }
    }),

  duplicateElement: (id) =>
    set((state) => {
      const element = findElementInList(state.elements, id)
      if (!element) return state
      const newEl = regenerateIds({ ...element, name: `${element.name} copy`, x: element.x + 20, y: element.y + 20 })
      return { elements: [...state.elements, newEl], isDirty: true }
    }),

  duplicateSelectedElements: () => {
    const state = get()
    const newElements: DesignElement[] = []
    const newIds: string[] = []
    for (const id of state.selectedElementIds) {
      const element = findElementInList(state.elements, id)
      if (element) {
        const newEl = regenerateIds({ ...element, name: `${element.name} copy`, x: element.x + 20, y: element.y + 20 })
        newElements.push(newEl)
        newIds.push(newEl.id)
      }
    }
    set({ elements: [...state.elements, ...newElements], selectedElementIds: newIds, isDirty: true })
  },

  bringForward: (id) =>
    set((state) => {
      const idx = state.elements.findIndex((el) => el.id === id)
      if (idx < 0 || idx >= state.elements.length - 1) return state
      const newElements = [...state.elements]
      const temp = newElements[idx]
      newElements[idx] = newElements[idx + 1]
      newElements[idx + 1] = temp
      return { elements: newElements, isDirty: true }
    }),

  sendBackward: (id) =>
    set((state) => {
      const idx = state.elements.findIndex((el) => el.id === id)
      if (idx <= 0) return state
      const newElements = [...state.elements]
      const temp = newElements[idx]
      newElements[idx] = newElements[idx - 1]
      newElements[idx - 1] = temp
      return { elements: newElements, isDirty: true }
    }),

  bringToFront: (id) =>
    set((state) => {
      const idx = state.elements.findIndex((el) => el.id === id)
      if (idx < 0 || idx >= state.elements.length - 1) return state
      const newElements = [...state.elements]
      const [el] = newElements.splice(idx, 1)
      newElements.push(el)
      return { elements: newElements, isDirty: true }
    }),

  sendToBack: (id) =>
    set((state) => {
      const idx = state.elements.findIndex((el) => el.id === id)
      if (idx <= 0) return state
      const newElements = [...state.elements]
      const [el] = newElements.splice(idx, 1)
      newElements.unshift(el)
      return { elements: newElements, isDirty: true }
    }),

  groupElements: (ids) =>
    set((state) => {
      if (ids.length < 2) return state
      const elementsToGroup = ids
        .map((id) => findElementInList(state.elements, id))
        .filter(Boolean) as DesignElement[]
      
      if (elementsToGroup.length < 2) return state
      
      // Compute absolute positions for all elements to group
      // (they might be inside frames with relative coords)
      const getAbsolutePos = (el: DesignElement): { x: number; y: number } => {
        let absX = el.x, absY = el.y
        const findParentOffset = (elements: DesignElement[], gpX: number, gpY: number): { x: number; y: number } | null => {
          for (const parent of elements) {
            if (parent.children) {
              const pX = gpX + parent.x
              const pY = gpY + parent.y
              if (parent.children.some(c => c.id === el.id)) return { x: pX, y: pY }
              const nested = findParentOffset(parent.children, pX, pY)
              if (nested) return nested
            }
          }
          return null
        }
        const parentOffset = findParentOffset(state.elements, 0, 0)
        if (parentOffset) {
          absX = parentOffset.x + el.x
          absY = parentOffset.y + el.y
        }
        return { x: absX, y: absY }
      }

      const absoluteElements = elementsToGroup.map(el => {
        const abs = getAbsolutePos(el)
        return { ...el, x: abs.x, y: abs.y }
      })

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      absoluteElements.forEach((el) => {
        minX = Math.min(minX, el.x)
        minY = Math.min(minY, el.y)
        maxX = Math.max(maxX, el.x + el.width)
        maxY = Math.max(maxY, el.y + el.height)
      })
      
      const groupId = generateId('group')
      // Convert children to relative coordinates (relative to group's origin)
      const relativeChildren = absoluteElements.map(el => ({
        ...el,
        x: el.x - minX,
        y: el.y - minY,
      }))
      const group: DesignElement = {
        id: groupId,
        name: 'Group',
        type: 'group',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        strokeAlign: 'center',
        cornerRadius: 0,
        cornerRadiusTL: 0,
        cornerRadiusTR: 0,
        cornerRadiusBL: 0,
        cornerRadiusBR: 0,
        opacity: 100,
        rotation: 0,
        visible: true,
        locked: false,
        blendMode: 'normal',
        flipH: false,
        flipV: false,
        clipContent: false,
        children: relativeChildren,
      }
      
      // Remove ALL grouped elements from the tree (both root and nested children)
      let remainingElements = state.elements
      for (const id of ids) {
        remainingElements = removeElementFromList(remainingElements, id)
      }
      return {
        elements: [...remainingElements, group],
        selectedElementIds: [groupId],
        isDirty: true,
      }
    }),

  ungroupElements: (id) =>
    set((state) => {
      const element = findElementInList(state.elements, id)
      if (!element || element.type !== 'group' || !element.children) return state
      
      // Convert children back to absolute coordinates
      const absoluteChildren = element.children.map(c => ({
        ...c,
        x: c.x + element.x,
        y: c.y + element.y,
      }))
      // Use removeElementFromList to properly remove from anywhere in the tree
      const remainingElements = removeElementFromList(state.elements, id)
      return {
        elements: [...remainingElements, ...absoluteChildren],
        selectedElementIds: absoluteChildren.map((c) => c.id),
        isDirty: true,
      }
    }),

  renameElement: (id, name) =>
    set((state) => ({
      elements: updateElementInList(state.elements, id, { name }),
      isDirty: true,
    })),

  selectAll: () =>
    set((state) => ({
      selectedElementIds: state.elements
        .filter((el) => !el.locked)
        .map((el) => el.id),
    })),

  // ---- PHASE 6: Boolean operations & masks (REBUILT per PORT-PLAN-6-11) ----
  applyBooleanOperation: (op) => {
    const state = get()
    // z-order = getAllElements depth-first pre-order (back → front)
    const all = getAllElements(state.elements)
    const sel = new Set(state.selectedElementIds)
    const candidates = all.filter((el) => sel.has(el.id) && isBooleanOperandType(el))
    if (candidates.length < 2) {
      return { ok: false, reason: 'Select at least 2 vector shapes (rectangle/ellipse/polygon/star/path)' }
    }

    // parent chain + absolute ancestor offset per operand (ancestor rotation not unfolded — documented)
    const findChain = (targetId: string): { chain: DesignElement[]; parent: DesignElement | null } => {
      const walk = (list: DesignElement[], acc: DesignElement[]): { chain: DesignElement[]; parent: DesignElement | null } | null => {
        for (const el of list) {
          if (el.children) {
            if (el.children.some((c) => c.id === targetId)) return { chain: acc, parent: el }
            const nested = walk(el.children, [...acc, el])
            if (nested) return nested
          }
        }
        return null
      }
      const direct = state.elements.some((e) => e.id === targetId) ? { chain: [] as DesignElement[], parent: null } : null
      return direct ?? walk(state.elements, []) ?? { chain: [], parent: null }
    }
    const chains = candidates.map((el) => findChain(el.id))
    const absOffset = (chain: DesignElement[]) => ({
      x: chain.reduce((s, e) => s + e.x, 0),
      y: chain.reduce((s, e) => s + e.y, 0),
    })

    // flatten operands (absolute coords incl. own flip + rotation)
    const flat: Poly[][] = []
    for (const el of candidates) {
      const polys = flattenOperand(el, absOffset(chains[candidates.indexOf(el)].chain))
      if (!polys) return { ok: false, reason: `unsupported operand: ${el.name} (${el.type})` }
      flat.push(polys)
    }

    // fold through evenodd algebra
    const folded = foldElementPolys(flat, op)
    if (!Array.isArray(folded)) return { ok: false, reason: (folded as { reason: string }).reason }
    const loops = folded as Poly[]

    // result element in the BACKMOST operand's parent space (array order = back→front)
    const backmost = candidates[0]
    const backChain = chains[0]
    const parentAbs = absOffset(backChain.chain)
    const contours = polysToContours(loops, parentAbs)
    const b = contoursBounds(contours)
    if (b.width <= 0 || b.height <= 0) return { ok: false, reason: 'result is empty' }
    const base = op === 'union' ? 'Union' : op === 'subtract' ? 'Subtract' : op === 'intersect' ? 'Intersect' : 'Exclude'
    const usedCount = all.filter((e) => (e.name || '').startsWith(base)).length
    const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

    const resultEl: DesignElement = {
      id: generateId('path'),
      type: 'path',
      name: usedCount ? `${base} ${usedCount + 1}` : base,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      fill: backmost.fill,
      stroke: backmost.stroke,
      strokeWidth: backmost.strokeWidth,
      strokeStyle: backmost.strokeStyle,
      cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
      opacity: backmost.opacity,
      rotation: 0,
      visible: true,
      locked: false,
      blendMode: backmost.blendMode || 'normal',
      fills: clone(backmost.fills),
      shadows: clone(backmost.shadows),
      blurs: clone(backmost.blurs),
      vectorNetwork: contours[0],
      booleanContours: contours,
      booleanOperation: op,
      booleanSourceIds: candidates.map((e) => e.id),
      pathClosed: true,
    }

    // remove all operands, insert result at the backmost operand's z-slot
    let elements = state.elements
    for (const c of candidates) elements = removeElementFromList(elements, c.id)

    if (backChain.parent) {
      const parentNow = findElementInList(elements, backChain.parent.id)
      if (parentNow?.children) {
        const siblings = backChain.parent.children ?? []
        const origIdx = siblings.findIndex((c) => c.id === backmost.id)
        const removedBefore = candidates.filter(
          (c) => siblings.includes(c) && siblings.indexOf(c) < origIdx
        ).length
        const idx = Math.max(0, origIdx - removedBefore)
        const nextChildren = [...parentNow.children]
        nextChildren.splice(idx, 0, resultEl)
        elements = updateElementInList(elements, parentNow.id, { children: nextChildren })
      } else {
        elements = [...elements, resultEl]
      }
    } else {
      const origIdx = state.elements.findIndex((e) => e.id === backmost.id)
      const removedBefore = candidates.filter(
        (c, i) => chains[i].parent === null && state.elements.indexOf(c) < origIdx
      ).length
      const idx = Math.max(0, origIdx - removedBefore)
      elements = [...elements.slice(0, idx), resultEl, ...elements.slice(idx)]
    }

    set({ elements, selectedElementIds: [resultEl.id], isDirty: true })
    return { ok: true, id: resultEl.id }
  },

  setElementAsMask: (id, isMask) =>
    set((state) => ({
      elements: updateElementInList(state.elements, id, { isMask }),
      isDirty: true,
    })),

  // Page actions
  addPage: (name) =>
    set((state) => {
      const id = generateId('page')
      const newPage: Page = { id, name, elements: [] }
      return { pages: [...state.pages, newPage], activePageId: id, elements: [], isDirty: true }
    }),

  deletePage: (id) =>
    set((state) => {
      if (state.pages.length <= 1) return state
      const newPages = state.pages.filter((p) => p.id !== id)
      const newActiveId = state.activePageId === id ? newPages[0].id : state.activePageId
      const activePage = newPages.find((p) => p.id === newActiveId)
      return {
        pages: newPages,
        activePageId: newActiveId,
        elements: activePage?.elements || [],
        isDirty: true,
      }
    }),

  renamePage: (id, name) =>
    set((state) => ({
      pages: state.pages.map((p) => (p.id === id ? { ...p, name } : p)),
      isDirty: true,
    })),

  setActivePage: (id) =>
    set((state) => {
      const newPages = state.pages.map((p) =>
        p.id === state.activePageId ? { ...p, elements: state.elements } : p
      )
      const targetPage = newPages.find((p) => p.id === id)
      return {
        pages: newPages,
        activePageId: id,
        elements: targetPage?.elements || [],
        selectedElementIds: [],
        isDirty: true,
      }
    }),

  duplicatePage: (id) =>
    set((state) => {
      const sourcePage = state.pages.find((p) => p.id === id)
      if (!sourcePage) return state
      const elements = id === state.activePageId ? state.elements : sourcePage.elements
      const newId = generateId('page')
      const newPage: Page = {
        id: newId,
        name: `${sourcePage.name} copy`,
        elements: JSON.parse(JSON.stringify(elements)),
        backgroundColor: sourcePage.backgroundColor,
      }
      const idx = state.pages.findIndex((p) => p.id === id)
      const newPages = [...state.pages]
      newPages.splice(idx + 1, 0, newPage)
      return { pages: newPages, isDirty: true }
    }),

  reorderPages: (startIndex, endIndex) =>
    set((state) => {
      const newPages = [...state.pages]
      const [moved] = newPages.splice(startIndex, 1)
      newPages.splice(endIndex, 0, moved)
      return { pages: newPages, isDirty: true }
    }),

  moveElementsToPage: (elementIds, targetPageId) =>
    set((state) => {
      if (targetPageId === state.activePageId) return state
      const removeIds = new Set(elementIds)
      const removed: DesignElement[] = []
      const stripElements = (els: DesignElement[]): DesignElement[] =>
        els.filter((el) => {
          if (removeIds.has(el.id)) { removed.push(el); return false }
          if (el.children) el.children = stripElements(el.children)
          return true
        })
      const newElements = stripElements([...state.elements])
      const newPages = state.pages.map((p) => {
        if (p.id === state.activePageId) return { ...p, elements: newElements }
        if (p.id === targetPageId) return { ...p, elements: [...p.elements, ...removed] }
        return p
      })
      return { pages: newPages, elements: newElements, selectedElementIds: [], isDirty: true }
    }),

  setPageBackground: (id, color) =>
    set((state) => ({
      pages: state.pages.map((p) => (p.id === id ? { ...p, backgroundColor: color } : p)),
      isDirty: true,
    })),

  // Clipboard
  copySelected: () =>
    set((state) => ({
      clipboard: state.selectedElementIds
        .map((id) => findElementInList(state.elements, id))
        .filter(Boolean) as DesignElement[],
    })),

  pasteClipboard: () => {
    const state = get()
    if (state.clipboard.length === 0) return
    
    const newElements = state.clipboard.map((el) => {
      return regenerateIds({ ...el, name: `${el.name} copy`, x: el.x + 20, y: el.y + 20 })
    })
    
    set({
      elements: [...state.elements, ...newElements],
      selectedElementIds: newElements.map((el) => el.id),
      isDirty: true,
    })
  },

  // History - pushHistory saves the CURRENT state after a mutation has been applied.
  // Each history entry represents a snapshot AFTER a change, so undo goes back to the
  // previous entry (the state before the last change).
  pushHistory: () =>
    set((state) => {
      const entry: HistoryEntry = {
        elements: deepCloneElements(state.elements),
        selectedElementIds: [...state.selectedElementIds],
      }
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(entry)
      if (newHistory.length > state.maxHistory) {
        newHistory.shift()
      }
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      }
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state
      const newIndex = state.historyIndex - 1
      const entry = state.history[newIndex]
      return {
        elements: deepCloneElements(entry.elements),
        selectedElementIds: [...entry.selectedElementIds],
        historyIndex: newIndex,
        isDirty: true,
      }
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state
      const newIndex = state.historyIndex + 1
      const entry = state.history[newIndex]
      return {
        elements: deepCloneElements(entry.elements),
        selectedElementIds: [...entry.selectedElementIds],
        historyIndex: newIndex,
        isDirty: true,
      }
    }),

  setFileName: (name) => set({ fileName: name, isDirty: true }),
  setLastSavedAt: (time) => set({ lastSavedAt: time }),
  setSaving: (saving) => set({ isSaving: saving }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  
  loadElements: (elements) => set({ elements, selectedElementIds: [], isDirty: true }),

  importElementsBatch: (newElements) =>
    set((state) => ({
      elements: [...state.elements, ...newElements],
      selectedElementIds: newElements.map((e) => e.id),
      isDirty: true,
    })),

  loadImportedProject: (pages, fileName, guides) =>
    set((state) => ({
      pages,
      activePageId: pages[0]?.id ?? state.activePageId,
      elements: pages[0]?.elements ?? [],
      fileName: fileName ?? state.fileName,
      guides: Array.isArray(guides) && guides.length > 0 ? (guides as typeof state.guides) : state.guides,
      selectedElementIds: [],
      isDirty: true,
    })),

  loadServerProject: async (projectId: string) => {
    try {
      const res = await fetch(`/api/editor/projects/${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      const data = await res.json()
      const project = data.project
      if (!project) throw new Error('Project not found')

      const normalized = normalizeServerProject(project)

      set({
        elements: normalized.activePageElements,
        pages: normalized.pages,
        activePageId: normalized.activePageId,
        fileName: normalized.name,
        selectedElementIds: [],
        styles: (normalized.styles || []) as EditorState['styles'],
        comments: (normalized.comments || []) as EditorState['comments'],
        history: [{ elements: deepCloneElements(normalized.activePageElements), selectedElementIds: [] }],
        historyIndex: 0,
        isDirty: false,
        currentProjectId: projectId,
        lastRemoteOrigin: null,
      })
    } catch (err) {
      console.error('loadServerProject failed:', err)
    }
  },

  closeServerProject: () =>
    set({ currentProjectId: null, syncStatus: 'offline', lastRemoteOrigin: null }),

  // ---- Live sync (SSE) actions -------------------------------------------
  // Remote changes are merged into the store WITHOUT setting isDirty,
  // so they never echo back to the server through the autosave push.

  setSyncStatus: (status) => set({ syncStatus: status }),

  applyRemoteElement: (element, pageId) =>
    set((state) => {
      const normalized = normalizeServerElement(element)
      // Skip if already present (e.g. event replay after reconnect)
      const alreadyActive = state.elements.some((e) => e.id === normalized.id)
      const targetPageId = pageId || state.activePageId
      const alreadyInPage = state.pages
        .find((p) => p.id === targetPageId)
        ?.elements.some((e) => e.id === normalized.id)
      if (alreadyActive && alreadyInPage) return {}
      const isTargetActivePage = targetPageId === state.activePageId
      return {
        elements: isTargetActivePage && !alreadyActive
          ? [...state.elements, normalized]
          : state.elements,
        pages: state.pages.map((p) =>
          p.id === targetPageId && !p.elements.some((e) => e.id === normalized.id)
            ? { ...p, elements: [...p.elements, normalized] }
            : p
        ),
        isDirty: false,
      }
    }),

  applyRemoteElementUpdate: (element, pageId) =>
    set((state) => {
      const normalized = normalizeServerElement(element)
      const targetPageId = pageId || state.activePageId
      return {
        elements: updateElementInList(state.elements, normalized.id, normalized),
        pages: state.pages.map((p) =>
          p.id === targetPageId
            ? { ...p, elements: updateElementInList(p.elements, normalized.id, normalized) }
            : p
        ),
        isDirty: false,
      }
    }),

  applyRemoteElementDelete: (elementId, pageId) =>
    set((state) => {
      const targetPageId = pageId || state.activePageId
      return {
        elements: removeElementFromList(state.elements, elementId),
        pages: state.pages.map((p) =>
          p.id === targetPageId
            ? { ...p, elements: removeElementFromList(p.elements, elementId) }
            : p
        ),
        selectedElementIds: state.selectedElementIds.filter((id) => id !== elementId),
        isDirty: false,
      }
    }),

  applyRemoteProject: (project) =>
    set((state) => {
      const normalized = normalizeServerProject(project)
      // Preserve the user's selection when the selected elements still exist.
      const preservedSelection = state.selectedElementIds.filter((id) =>
        normalized.activePageElements.some((e) => e.id === id)
      )
      return {
        elements: normalized.activePageElements,
        pages: normalized.pages,
        activePageId: normalized.activePageId,
        fileName: normalized.name,
        selectedElementIds: preservedSelection,
        styles: (normalized.styles || []) as EditorState['styles'],
        isDirty: false,
      }
    }),

  // Component system
  addComponent: (id) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el) return state
      return {
        elements: updateElementInList(state.elements, id, { isComponent: true }),
        isDirty: true,
      }
    }),

  createInstance: (componentId) =>
    set((state) => {
      const master = findElementInList(state.elements, componentId)
      if (!master || !master.isComponent) return state
      const instance = regenerateIds({
        ...master,
        name: `${master.name} Instance`,
        x: master.x + 20,
        y: master.y + 20,
        componentId: master.id,
        componentSetId: master.componentSetId,
        isComponent: false,
        componentProperties: {},
        overrides: {},
      })
      return {
        elements: [...state.elements, instance],
        selectedElementIds: [instance.id],
        isDirty: true,
      }
    }),

  resetOverrides: (instanceId) =>
    set((state) => {
      const instance = findElementInList(state.elements, instanceId)
      if (!instance || !instance.componentId) return state
      const master = findElementInList(state.elements, instance.componentId)
      if (!master) return state
      const reset = { ...master, id: instanceId, componentId: instance.componentId, overrides: {}, x: instance.x, y: instance.y }
      return {
        elements: updateElementInList(state.elements, instanceId, reset),
        isDirty: true,
      }
    }),

  detachInstance: (instanceId) =>
    set((state) => {
      const instance = findElementInList(state.elements, instanceId)
      if (!instance || !instance.componentId) return state
      return {
        elements: updateElementInList(state.elements, instanceId, { componentId: undefined, overrides: undefined }),
        isDirty: true,
      }
    }),

  propagateComponentChanges: (componentId) =>
    set((state) => {
      const master = findElementInList(state.elements, componentId)
      if (!master || !master.isComponent) return state
      const allElements = flattenElements(state.elements)
      const instances = allElements.filter(el => el.componentId === componentId)
      let newElements = state.elements
      for (const instance of instances) {
        const overrideKeys = instance.overrides ? Object.keys(instance.overrides) : []
        const updates: Partial<DesignElement> = {}
        const masterCopy = { ...master }
        delete (masterCopy as any).id
        delete (masterCopy as any).x
        delete (masterCopy as any).y
        delete (masterCopy as any).componentId
        delete (masterCopy as any).overrides
        delete (masterCopy as any).isComponent
        delete (masterCopy as any).name
        Object.keys(masterCopy).forEach(key => {
          if (!overrideKeys.includes(key)) {
            (updates as any)[key] = (masterCopy as any)[key]
          }
        })
        newElements = updateElementInList(newElements, instance.id, updates)
      }
      return { elements: newElements, isDirty: true }
    }),

  // Component Variant actions
  addComponentSet: (ids, name) =>
    set((state) => {
      if (ids.length < 2) return state
      const children = ids.map(id => findElementInList(state.elements, id)).filter(Boolean) as DesignElement[]
      if (children.length < 2) return state
      const setId = generateId('comp')
      const bbox = {
        minX: Math.min(...children.map(c => c.x)),
        minY: Math.min(...children.map(c => c.y)),
        maxX: Math.max(...children.map(c => c.x + c.width)),
        maxY: Math.max(...children.map(c => c.y + c.height)),
      }
      let elList = state.elements
      for (const child of children) {
        elList = removeElementFromList(elList, child.id)
      }
      const setElement: DesignElement = {
        id: setId,
        name,
        type: 'component-set',
        x: bbox.minX,
        y: bbox.minY,
        width: bbox.maxX - bbox.minX,
        height: bbox.maxY - bbox.minY,
        fill: '#2C2C2C',
        stroke: '#A259FF',
        strokeWidth: 1,
        strokeStyle: 'solid',
        cornerRadius: 0,
        cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
        opacity: 1,
        rotation: 0,
        visible: true,
        locked: false,
        isComponentSet: true,
        isComponent: true,
        children: children.map(c => ({
          ...c,
          isComponent: true,
          componentSetId: setId,
          variantProperties: {},
        })),
        variantGroupProperties: {},
      }
      return {
        elements: [...elList, setElement],
        selectedElementIds: [setId],
        isDirty: true,
      }
    }),

  addComponentPropertyDefinition: (componentId, propName, def) =>
    set((state) => {
      const el = findElementInList(state.elements, componentId)
      if (!el) return state
      const existing = el.componentPropertyDefinitions || {}
      if (existing[propName]) return state
      return {
        elements: updateElementInList(state.elements, componentId, {
          componentPropertyDefinitions: { ...existing, [propName]: def },
        }),
        isDirty: true,
      }
    }),

  editComponentPropertyDefinition: (componentId, propName, def) =>
    set((state) => {
      const el = findElementInList(state.elements, componentId)
      if (!el || !el.componentPropertyDefinitions?.[propName]) return state
      return {
        elements: updateElementInList(state.elements, componentId, {
          componentPropertyDefinitions: {
            ...el.componentPropertyDefinitions,
            [propName]: { ...el.componentPropertyDefinitions[propName], ...def } as ComponentPropertyDefinition,
          },
        }),
        isDirty: true,
      }
    }),

  deleteComponentPropertyDefinition: (componentId, propName) =>
    set((state) => {
      const el = findElementInList(state.elements, componentId)
      if (!el || !el.componentPropertyDefinitions?.[propName]) return state
      const { [propName]: _, ...rest } = el.componentPropertyDefinitions
      return {
        elements: updateElementInList(state.elements, componentId, {
          componentPropertyDefinitions: rest,
        }),
        isDirty: true,
      }
    }),

  addVariantPropertyDefinition: (componentSetId, propName, values) =>
    set((state) => {
      const el = findElementInList(state.elements, componentSetId)
      if (!el || !el.isComponentSet || !el.children) return state
      const existing = el.variantGroupProperties || {}
      return {
        elements: updateElementInList(state.elements, componentSetId, {
          variantGroupProperties: { ...existing, [propName]: { values } },
        }),
        isDirty: true,
      }
    }),

  setVariantPropertyValue: (variantId, propName, value) =>
    set((state) => {
      for (const el of state.elements) {
        if (!el.isComponentSet || !el.children) continue
        const idx = el.children.findIndex(c => c.id === variantId)
        if (idx !== -1) {
          const variant = el.children[idx]
          const updatedChildren = [...el.children]
          updatedChildren[idx] = {
            ...variant,
            variantProperties: { ...(variant.variantProperties || {}), [propName]: value },
          }
          return {
            elements: updateElementInList(state.elements, el.id, { children: updatedChildren }),
            isDirty: true,
          }
        }
      }
      return state
    }),

  setComponentPropertyValue: (instanceId, propName, value) =>
    set((state) => {
      const instance = findElementInList(state.elements, instanceId)
      if (!instance || !instance.componentId) return state
      return {
        elements: updateElementInList(state.elements, instanceId, {
          componentProperties: { ...(instance.componentProperties || {}), [propName]: value },
          overrides: { ...(instance.overrides || {}), [propName]: value },
        }),
        isDirty: true,
      }
    }),

  swapInstanceComponent: (instanceId, newComponentId) =>
    set((state) => {
      const instance = findElementInList(state.elements, instanceId)
      const newMaster = findElementInList(state.elements, newComponentId)
      if (!instance || !instance.componentId || !newMaster) return state
      return {
        elements: updateElementInList(state.elements, instanceId, {
          componentId: newMaster.id,
          componentProperties: {},
          overrides: {},
        }),
        isDirty: true,
      }
    }),

  setDefaultVariant: (componentSetId, variantId) =>
    set((state) => {
      const el = findElementInList(state.elements, componentSetId)
      if (!el || !el.isComponentSet) return state
      return {
        elements: updateElementInList(state.elements, componentSetId, { defaultVariant: variantId }),
        isDirty: true,
      }
    }),

  // Fill/Stroke layers
  addFill: (id, fill) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el) return state
      const fills = [...(el.fills || []), fill]
      return { elements: updateElementInList(state.elements, id, { fills }), isDirty: true }
    }),

  removeFill: (id, fillIndex) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el || !el.fills) return state
      const fills = el.fills.filter((_, i) => i !== fillIndex)
      return { elements: updateElementInList(state.elements, id, { fills }), isDirty: true }
    }),

  updateFill: (id, fillIndex, fill) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el || !el.fills) return state
      const fills = el.fills.map((f, i) => i === fillIndex ? { ...f, ...fill } : f)
      return { elements: updateElementInList(state.elements, id, { fills }), isDirty: true }
    }),

  addStroke: (id, stroke) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el) return state
      const strokes = [...(el.strokes || []), stroke]
      return { elements: updateElementInList(state.elements, id, { strokes }), isDirty: true }
    }),

  removeStroke: (id, strokeIndex) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el || !el.strokes) return state
      const strokes = el.strokes.filter((_, i) => i !== strokeIndex)
      return { elements: updateElementInList(state.elements, id, { strokes }), isDirty: true }
    }),

  updateStroke: (id, strokeIndex, stroke) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el || !el.strokes) return state
      const strokes = el.strokes.map((s, i) => i === strokeIndex ? { ...s, ...stroke } : s)
      return { elements: updateElementInList(state.elements, id, { strokes }), isDirty: true }
    }),

  // Effects
  addEffect: (id, effect) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el) return state
      const shadows = el.shadows || []
      const blurs = el.blurs || []
      if (effect.type === 'drop-shadow' || effect.type === 'inner-shadow') {
        return { elements: updateElementInList(state.elements, id, { shadows: [...shadows, effect as ShadowEffect] }), isDirty: true }
      } else {
        return { elements: updateElementInList(state.elements, id, { blurs: [...blurs, effect as BlurEffect] }), isDirty: true }
      }
    }),

  removeEffect: (id, effectIndex) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el) return state
      const shadows = el.shadows || []
      const blurs = el.blurs || []
      if (effectIndex < shadows.length) {
        return { elements: updateElementInList(state.elements, id, { shadows: shadows.filter((_, i) => i !== effectIndex) }), isDirty: true }
      } else {
        const blurIdx = effectIndex - shadows.length
        return { elements: updateElementInList(state.elements, id, { blurs: blurs.filter((_, i) => i !== blurIdx) }), isDirty: true }
      }
    }),

  updateEffect: (id, effectIndex, effect) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el) return state
      const shadows = el.shadows || []
      const blurs = el.blurs || []
      if (effectIndex < shadows.length) {
        const newShadows = shadows.map((s, i) => i === effectIndex ? { ...s, ...effect } as ShadowEffect : s)
        return { elements: updateElementInList(state.elements, id, { shadows: newShadows }), isDirty: true }
      } else {
        const blurIdx = effectIndex - shadows.length
        const newBlurs = blurs.map((b, i) => i === blurIdx ? { ...b, ...effect } as BlurEffect : b)
        return { elements: updateElementInList(state.elements, id, { blurs: newBlurs }), isDirty: true }
      }
    }),

  // Export settings
  addExportSetting: (id, setting) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el) return state
      const exportSettings = [...(el.exportSettings || []), setting]
      return { elements: updateElementInList(state.elements, id, { exportSettings }), isDirty: true }
    }),

  removeExportSetting: (id, index) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el || !el.exportSettings) return state
      const exportSettings = el.exportSettings.filter((_, i) => i !== index)
      return { elements: updateElementInList(state.elements, id, { exportSettings }), isDirty: true }
    }),

  // Prototype interactions (PHASE 2)
  addInteraction: (elementId, interaction) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el) return state
      const interactions = [...(el.interactions || []), interaction]
      return { elements: updateElementInList(state.elements, elementId, { interactions }), isDirty: true }
    }),

  updateInteraction: (elementId, interactionId, updates) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || !el.interactions) return state
      const interactions = el.interactions.map((i) =>
        i.id === interactionId
          ? {
              ...i,
              ...updates,
              trigger: updates.trigger ? { ...i.trigger, ...updates.trigger } : i.trigger,
              action: updates.action ? { ...i.action, ...updates.action } : i.action,
              animation: updates.animation ? { ...i.animation, ...updates.animation } : i.animation,
            }
          : i
      )
      return { elements: updateElementInList(state.elements, elementId, { interactions }), isDirty: true }
    }),

  removeInteraction: (elementId, interactionId) =>
    set((state) => {
      const el = findElementInList(state.elements, elementId)
      if (!el || !el.interactions) return state
      const interactions = el.interactions.filter((i) => i.id !== interactionId)
      return { elements: updateElementInList(state.elements, elementId, { interactions }), isDirty: true }
    }),

  startPreview: (frameId) =>
    set((state) => {
      // Default: the selected top-level frame, else the first frame on the page.
      // state.elements holds top-level elements only (children are nested),
      // so this filter already excludes nested frames.
      const frames = state.elements.filter((el) => el.type === 'frame')
      const selectedFrame = state.selectedElementIds
        .map((id) => state.elements.find((el) => el.id === id))
        .find((el) => el && el.type === 'frame')
      const start = frameId ?? (selectedFrame && selectedFrame.type === 'frame' ? selectedFrame.id : null) ?? frames[0]?.id ?? null
      if (!start) return state
      return {
        isPreviewing: true,
        previewFrameId: start,
        overlayStack: [],
        previewHistory: [],
      }
    }),

  stopPreview: () => set({ isPreviewing: false, overlayStack: [], previewHistory: [] }),

  previewNavigate: (action) =>
    set((state) => {
      if (!action) return state
      switch (action.type) {
        case 'navigate': {
          if (!action.destinationId) return state
          return {
            previewFrameId: action.destinationId,
            previewHistory: state.previewFrameId
              ? [...state.previewHistory, state.previewFrameId]
              : state.previewHistory,
            overlayStack: [],
          }
        }
        case 'open-overlay': {
          if (!action.destinationId) return state
          return {
            overlayStack: [
              ...state.overlayStack,
              {
                frameId: action.destinationId,
                background: action.background || { type: 'none' },
                closeOnClickOutside: action.closeOnClickOutside ?? true,
              },
            ],
          }
        }
        case 'close-overlay': {
          if (state.overlayStack.length === 0) return state
          return { overlayStack: state.overlayStack.slice(0, -1) }
        }
        case 'back': {
          if (state.overlayStack.length > 0) {
            // back inside overlays closes the innermost one first (Figma behavior)
            return { overlayStack: state.overlayStack.slice(0, -1) }
          }
          if (state.previewHistory.length === 0) return state
          const history = [...state.previewHistory]
          const previous = history.pop()!
          return { previewFrameId: previous, previewHistory: history }
        }
        case 'url': {
          if (action.url) {
            if (typeof window !== 'undefined') {
              if (action.newTab) window.open(action.url, '_blank', 'noopener')
              else window.location.href = action.url
            }
          }
          return state
        }
        default:
          return state
      }
    }),

  // Transform
  setBlendMode: (id, mode) =>
    set((state) => ({
      elements: updateElementInList(state.elements, id, { blendMode: mode }),
      isDirty: true,
    })),

  flipHorizontal: (id) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el) return state
      return { elements: updateElementInList(state.elements, id, { flipH: !el.flipH }), isDirty: true }
    }),

  flipVertical: (id) =>
    set((state) => {
      const el = findElementInList(state.elements, id)
      if (!el) return state
      return { elements: updateElementInList(state.elements, id, { flipV: !el.flipV }), isDirty: true }
    }),

  alignElements: (ids, alignment) =>
    set((state) => {
      if (ids.length < 2) return state
      const elements = ids.map(id => findElementInList(state.elements, id)).filter(Boolean) as DesignElement[]
      if (elements.length < 2) return state

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      let sumX = 0, sumY = 0
      elements.forEach(el => {
        minX = Math.min(minX, el.x)
        minY = Math.min(minY, el.y)
        maxX = Math.max(maxX, el.x + el.width)
        maxY = Math.max(maxY, el.y + el.height)
        sumX += el.x + el.width / 2
        sumY += el.y + el.height / 2
      })
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const totalW = maxX - minX
      const totalH = maxY - minY

      let newElements = state.elements
      for (const el of elements) {
        let updates: Partial<DesignElement> = {}
        switch (alignment) {
          case 'left':
            updates = { x: minX }
            break
          case 'center-h':
            updates = { x: centerX - el.width / 2 }
            break
          case 'right':
            updates = { x: maxX - el.width }
            break
          case 'top':
            updates = { y: minY }
            break
          case 'center-v':
            updates = { y: centerY - el.height / 2 }
            break
          case 'bottom':
            updates = { y: maxY - el.height }
            break
        }
        newElements = updateElementInList(newElements, el.id, updates)
      }
      return { elements: newElements, isDirty: true }
    }),

  distributeElements: (ids, direction) =>
    set((state) => {
      if (ids.length < 3) return state
      const elements = ids.map(id => findElementInList(state.elements, id)).filter(Boolean) as DesignElement[]
      if (elements.length < 3) return state

      let newElements = state.elements
      if (direction === 'horizontal') {
        const sorted = [...elements].sort((a, b) => a.x - b.x)
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        const totalGap = (last.x + last.width) - first.x - sorted.reduce((sum, el) => sum + el.width, 0)
        const gap = totalGap / (sorted.length - 1)
        let currentX = first.x
        for (const el of sorted) {
          newElements = updateElementInList(newElements, el.id, { x: Math.round(currentX) })
          currentX += el.width + gap
        }
      } else {
        const sorted = [...elements].sort((a, b) => a.y - b.y)
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        const totalGap = (last.y + last.height) - first.y - sorted.reduce((sum, el) => sum + el.height, 0)
        const gap = totalGap / (sorted.length - 1)
        let currentY = first.y
        for (const el of sorted) {
          newElements = updateElementInList(newElements, el.id, { y: Math.round(currentY) })
          currentY += el.height + gap
        }
      }
      return { elements: newElements, isDirty: true }
    }),

  booleanOperation: (ids, operation) =>
    set((state) => {
      if (ids.length < 2) return state
      const elements = ids.map(id => findElementInList(state.elements, id)).filter(Boolean) as DesignElement[]
      if (elements.length < 2) return state

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      elements.forEach(el => {
        minX = Math.min(minX, el.x)
        minY = Math.min(minY, el.y)
        maxX = Math.max(maxX, el.x + el.width)
        maxY = Math.max(maxY, el.y + el.height)
      })

      const resultId = generateId('boolean')
      const result: DesignElement = {
        id: resultId,
        name: `${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
        type: 'boolean',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        fill: elements[0].fill,
        stroke: elements[0].stroke,
        strokeWidth: elements[0].strokeWidth,
        strokeStyle: 'solid',
        strokeAlign: 'center',
        cornerRadius: 0,
        cornerRadiusTL: 0,
        cornerRadiusTR: 0,
        cornerRadiusBL: 0,
        cornerRadiusBR: 0,
        opacity: elements[0].opacity,
        rotation: 0,
        visible: true,
        locked: false,
        blendMode: 'normal',
        flipH: false,
        flipV: false,
        clipContent: false,
        booleanOperation: operation as any,
        booleanSourceIds: ids,
        children: elements,
      }

      const remainingElements = state.elements.filter(el => !ids.includes(el.id))
      return {
        elements: [...remainingElements, result],
        selectedElementIds: [resultId],
        isDirty: true,
      }
    }),

  // PHASE 17 (P2) — outline stroke (source: OUTLINE_STROKE=233 / "outline-stroke").
  // Converts each selected stroked shape into a filled outline path element
  // (booleanContours, evenodd). Paint: original stroke color; stroke removed.
  outlineStrokeSelection: () => {
    const r = get()
    let converted = 0
    const next = r.elements.map(function walk(el: DesignElement): DesignElement {
      if (r.selectedElementIds.includes(el.id)) {
        const out = outlineOne(el)
        if (out) { converted++; return out }
      }
      if (el.children?.length) {
        return { ...el, children: el.children.map(walk) }
      }
      return el
    })
    if (converted > 0) set({ elements: next, isDirty: true })
    return converted
  },

  // PHASE 17 (P3) — flatten (source: FLATTEN_SELECTION / "flatten-selection").
  // Bakes each selected live boolean group into a static path element.
  flattenSelection: () => {
    const r = get()
    let flattened = 0
    const next = r.elements.map(function walk(el: DesignElement): DesignElement {
      if (el.type === 'boolean' && r.selectedElementIds.includes(el.id)) {
        const out = flattenOne(el)
        if (out) { flattened++; return out }
      }
      if (el.children?.length) {
        return { ...el, children: el.children.map(walk) }
      }
      return el
    })
    if (flattened > 0) set({ elements: next, isDirty: true })
    return flattened
  },

  // PHASE 18 (V5) — convert parametric shape → editable vector, in place.
  convertShapeToVector: (id) => {
    const el = findElementInList(get().elements, id)
    if (!el || !isShapeToVectorCandidate(el)) return null
    const net = shapeToVectorNetwork(el)
    if (!net || !net.segments.length) return null
    // Figma behavior: entering edit converts the shape; paint/transform/id kept.
    get().updateElement(id, {
      type: 'path',
      vectorNetwork: net,
      pathPoints: undefined,
      pathClosed: net.closed,
      arc: undefined,
      sides: undefined,
      innerRadius: undefined,
      cornerRadius: 0,
    } as Partial<DesignElement>)
    return id
  },

  // PHASE 18 — split multi-contour paths (flatten/outline results) into
  // separate path elements, one contour each.
  splitVectorSelection: () => {
    const r = get()
    let produced = 0
    const out: DesignElement[] = []
    for (const el of r.elements) {
      const selected = r.selectedElementIds.includes(el.id)
      if (selected && el.type === 'path' && el.booleanContours && el.booleanContours.length > 1) {
        for (const contour of el.booleanContours) {
          if (!contour.vertices.length || !contour.segments.length) continue
          out.push({
            ...el,
            id: generateId('path'),
            booleanContours: undefined,
            booleanOperation: undefined,
            booleanSourceIds: undefined,
            vectorNetwork: contour,
            pathPoints: undefined,
            pathClosed: contour.closed !== false,
            children: undefined,
          })
          produced++
        }
      } else {
        out.push(el)
      }
    }
    if (produced > 0) {
      set({ elements: out, isDirty: true })
    }
    return produced
  },

  // Guides
  addGuide: (guide) => set((state) => ({ guides: [...state.guides, guide], isDirty: true })),
  removeGuide: (id) => set((state) => ({ guides: state.guides.filter(g => g.id !== id), isDirty: true })),
  clearGuides: () => set({ guides: [], isDirty: true }),

  // Save/Load
  saveToFile: async () => {
    const state = get()
    set({ isSaving: true })
    try {
      const data = {
        elements: state.elements,
        pages: state.pages,
        fileName: state.fileName,
        guides: state.guides,
        savedAt: Date.now(),
      }
      const dbName = 'figma-editor'
      const db = await openDB(dbName)
      const tx = db.transaction('projects', 'readwrite')
      const store = tx.objectStore('projects')
      await wrapRequest(store.put({ id: 'current', ...data }))
      set({ lastSavedAt: Date.now(), isSaving: false, isDirty: false })
    } catch (e) {
      console.error('Save failed:', e)
      set({ isSaving: false })
    }
  },

  loadFromFile: async () => {
    try {
      const dbName = 'figma-editor'
      const db = await openDB(dbName)
      const tx = db.transaction('projects', 'readonly')
      const store = tx.objectStore('projects')
      const data = await wrapRequest(store.get('current')) as any
      if (data && data.elements) {
        set({
          elements: data.elements,
          pages: data.pages || [{ id: 'page-1', name: 'Page 1', elements: data.elements }],
          fileName: data.fileName || 'Untitled',
          guides: data.guides || [],
          selectedElementIds: [],
          lastSavedAt: data.savedAt || null,
          isDirty: false,
        })
      }
    } catch (e) {
      console.error('Load failed:', e)
    }
  },

  setCurrentFrameId: (id) => set({ currentFrameId: id, selectedElementIds: [] }),

  enterFrame: (id) => set((state) => {
    const el = findElementInList(state.elements, id)
    if (!el) return state
    const name = el.name || id
    return {
      currentFrameId: id,
      frameBreadcrumb: [...state.frameBreadcrumb, name],
      selectedElementIds: [],
    }
  }),

  exitFrame: () => set((state) => {
    const newBreadcrumb = state.frameBreadcrumb.slice(0, -1)
    return {
      currentFrameId: null,
      frameBreadcrumb: newBreadcrumb,
      selectedElementIds: [],
    }
  }),

  moveElementToFrame: (elementId, frameId) =>
    set((state) => {
      const element = findElementInList(state.elements, elementId)
      const frame = findElementInList(state.elements, frameId)
      if (!element || !frame || (frame.type !== 'frame' && frame.type !== 'group')) return state

      // Helper: recursively find absolute position of any element in the tree
      const getAbsolutePos = (targetId: string, targetEl: DesignElement): { absX: number; absY: number } => {
        let absX = targetEl.x
        let absY = targetEl.y
        const findParent = (elements: DesignElement[], parentAbsX: number, parentAbsY: number): boolean => {
          for (const el of elements) {
            if (el.children) {
              const elAbsX = parentAbsX + el.x
              const elAbsY = parentAbsY + el.y
              if (el.children.some(c => c.id === targetId)) {
                absX = elAbsX + targetEl.x
                absY = elAbsY + targetEl.y
                return true
              }
              if (findParent(el.children, elAbsX, elAbsY)) {
                return true
              }
            }
          }
          return false
        }
        findParent(state.elements, 0, 0)
        return { absX, absY }
      }

      // Get absolute position of the element (accounting for parent offsets)
      const { absX, absY } = getAbsolutePos(elementId, element)

      // Get absolute position of the target frame (also recursive for nested frames)
      const { absX: frameAbsX, absY: frameAbsY } = getAbsolutePos(frameId, frame)

      // FIRST: Remove element from its current position in the tree
      const elementsWithout = removeElementFromList(state.elements, elementId)

      // SECOND: Re-find the frame after removal (its position may have shifted if it was a sibling)
      const updatedFrame = findElementInList(elementsWithout, frameId)
      if (!updatedFrame) return state // frame was somehow removed, bail

      // Adjust coordinates to be relative to the frame (using absolute positions)
      const childElement = {
        ...element,
        x: absX - frameAbsX,
        y: absY - frameAbsY,
      }

      // PHASE 9: infer constraints from the child's position in its new frame
      // (auto-inference from creation/drop position — manual edits later win)
      const withConstraints = childElement.constraintsEdited
        ? childElement
        : { ...childElement, constraints: inferConstraints(childElement, updatedFrame.width, updatedFrame.height) }

      // Add element to frame's children
      const existingChildren = updatedFrame.children || []
      const newChildren = [...existingChildren, withConstraints]
      const newElements = updateElementInList(elementsWithout, frameId, { children: newChildren })

      // PHASE 12: re-flow the target frame (and its chain) when it uses auto layout
      const synced = applyAutoLayoutSync(newElements, [frameId])

      return {
        elements: synced,
        isDirty: true,
      }
    }),

  moveElementOutOfFrame: (elementId) =>
    set((state) => {
      // Find which frame contains this element (search recursively)
      let parentFrame: DesignElement | null = null
      let parentAbsX = 0
      let parentAbsY = 0

      const findParent = (elements: DesignElement[], grandParentAbsX: number, grandParentAbsY: number): boolean => {
        for (const el of elements) {
          if (el.children) {
            if (el.children.some(c => c.id === elementId)) {
              parentFrame = el
              parentAbsX = grandParentAbsX + el.x
              parentAbsY = grandParentAbsY + el.y
              return true
            }
            if (findParent(el.children, grandParentAbsX + el.x, grandParentAbsY + el.y)) {
              return true
            }
          }
        }
        return false
      }

      findParent(state.elements, 0, 0)
      if (!parentFrame) return state
      // Type narrowing doesn't work for let variables assigned in closures,
      // so we use a const binding with explicit type assertion
      const foundFrame: DesignElement = parentFrame
      if (!foundFrame.children || foundFrame.children.length === 0) return state

      const foundChildren: DesignElement[] = foundFrame.children
      const element = foundChildren.find(c => c.id === elementId)
      if (!element) return state

      // Remove from frame's children
      const newChildren = foundChildren.filter(c => c.id !== elementId)
      const elementsWithoutFrameUpdate = updateElementInList(state.elements, foundFrame.id, { children: newChildren })

      // Adjust coordinates to be absolute (using computed parent absolute position)
      const absElement = {
        ...element,
        x: parentAbsX + element.x,
        y: parentAbsY + element.y,
      }

      // Add element back to top-level
      return {
        elements: [...elementsWithoutFrameUpdate, absElement],
        isDirty: true,
      }
    }),

  getElementById: (id) => findElementInList(get().elements, id),
  
  getSelectedElements: () => {
    const state = get()
    return state.selectedElementIds
      .map((id) => findElementInList(state.elements, id))
      .filter(Boolean) as DesignElement[]
  },

  reorderElement: (id, newIndex) =>
    set((state) => {
      const oldIndex = state.elements.findIndex((el) => el.id === id)
      if (oldIndex !== -1) {
        if (oldIndex === newIndex) return state
        const newElements = [...state.elements]
        const [element] = newElements.splice(oldIndex, 1)
        newElements.splice(newIndex, 0, element)
        return { elements: newElements, isDirty: true }
      }
      // PHASE 12: child reorder — find the parent and reorder inside it
      const parent = findAncestors(state.elements, id)[0]
      if (!parent || !parent.children) return state
      const childIndex = parent.children.findIndex(c => c.id === id)
      if (childIndex === -1) return state
      const children = [...parent.children]
      const [moved] = children.splice(childIndex, 1)
      children.splice(Math.max(0, Math.min(children.length, newIndex)), 0, moved)
      return {
        elements: applyAutoLayoutSync(
          updateElementInList(state.elements, parent.id, { children }),
          [parent.id]
        ),
        isDirty: true,
      }
    }),
}))

// IndexedDB helpers
function openDB(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// PHASE 12 — test/debug hook: expose the store on window so live browser
// verification (and future phase checks) can seed state and assert geometry
// without going through synthetic DOM events. Harmless in production builds
// (no credentials, no server surface — the API whitelist still guards writes).
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__openfigma = useEditorStore
}
