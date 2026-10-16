'use client'

import { create } from 'zustand'
import { findElementInList, updateElementInList, removeElementFromList, deepCloneElements, getAllElements } from '@/lib/element-utils'

export type ToolType = 'move' | 'frame' | 'rectangle' | 'ellipse' | 'line' | 'pen' | 'text' | 'comment' | 'hand' | 'polygon' | 'star' | 'pencil' | 'eyedropper' | 'slice' | 'arrow' | 'image'

export type ElementType = 'rectangle' | 'frame' | 'group' | 'ellipse' | 'line' | 'text' | 'path' | 'polygon' | 'star' | 'boolean' | 'slice' | 'arrow' | 'component-set'

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
  type: 'solid' | 'linear-gradient' | 'radial-gradient' | 'image'
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
  alignItems: 'start' | 'center' | 'end' | 'stretch'
  justifyContent: 'start' | 'center' | 'end' | 'space-between'
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
  textDecoration?: 'none' | 'underline'
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
  // Export settings
  exportSettings?: { format: string; scale: number; suffix?: string }[]
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
  // Clip content (for frames)
  clipContent?: boolean
  // Boolean operation result
  booleanOperation?: 'union' | 'subtract' | 'intersect' | 'exclude'
  booleanSourceIds?: string[]
}

export interface Page {
  id: string
  name: string
  elements: DesignElement[]
  backgroundColor?: string
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
  loadServerProject: (projectId: string) => Promise<void>
  
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
  addExportSetting: (id: string, setting: { format: string; scale: number }) => void
  removeExportSetting: (id: string, index: number) => void
  
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
    text: { name: `Text ${elementCounter}`, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0, textContent: 'Text', fontFamily: 'Inter', fontSize: 18, fontWeight: 400, textAlign: 'left' as const, textColor: '#000000', lineHeight: 1.4, letterSpacing: 0 },
    frame: { name: `Frame ${elementCounter}`, fill: '#FFFFFF', stroke: '#E0E0E0', strokeWidth: 1, cornerRadius: 0, clipContent: true },
    group: { name: `Group ${elementCounter}`, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 },
    path: { name: `Path ${elementCounter}`, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 0, pathPoints: [], pathClosed: false },
    polygon: { name: `Polygon ${elementCounter}`, fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0, sides: 6 },
    star: { name: `Star ${elementCounter}`, fill: '#FFD93D', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0, sides: 5, innerRadius: 40 },
    boolean: { name: `Boolean ${elementCounter}`, fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 },
    arrow: { name: `Arrow ${elementCounter}`, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 0, arrowHeadStyle: 'arrow' },
    slice: { name: `Slice ${elementCounter}`, fill: 'transparent', stroke: '#0D99FF', strokeWidth: 1, cornerRadius: 0 },
    'component-set': { name: `Component Set ${elementCounter}`, fill: '#2C2C2C', stroke: '#A259FF', strokeWidth: 1, cornerRadius: 0, isComponentSet: true, isComponent: true },
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
  setSnapToElements: (snap) => set({ snapToElements: snap }),
  setGridSize: (size) => set({ gridSize: size }),
  setShowRulers: (show) => set({ showRulers: show }),

  updateElement: (id, updates) =>
    set((state) => ({
      elements: updateElementInList(state.elements, id, updates),
      isDirty: true,
    })),

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
        if (frame && (frame.type === 'frame' || frame.type === 'group')) {
          const existingChildren = frame.children || []
          const childElement = {
            ...element,
            x: element.x - frame.x,
            y: element.y - frame.y,
          }
          return {
            elements: updateElementInList(state.elements, state.currentFrameId, {
              children: [...existingChildren, childElement],
            }),
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
    set((state) => ({
      elements: removeElementFromList(state.elements, id),
      selectedElementIds: state.selectedElementIds.filter((i) => i !== id),
      isDirty: true,
    })),

  deleteSelectedElements: () =>
    set((state) => ({
      elements: state.selectedElementIds.reduce(
        (els, id) => removeElementFromList(els, id),
        state.elements
      ),
      selectedElementIds: [],
      isDirty: true,
    })),

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

  loadServerProject: async (projectId: string) => {
    try {
      const res = await fetch(`/api/editor/projects/${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      const data = await res.json()
      const project = data.project
      if (!project) throw new Error('Project not found')

      function ensureElement(el: any): DesignElement {
        const base: DesignElement = {
          id: el.id || `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: el.name || 'Element',
          type: el.type || 'rectangle',
          x: el.x ?? 0,
          y: el.y ?? 0,
          width: el.width ?? 100,
          height: el.height ?? 100,
          fill: el.fill ?? 'transparent',
          stroke: el.stroke ?? 'transparent',
          strokeWidth: el.strokeWidth ?? 0,
          strokeStyle: el.strokeStyle ?? 'solid',
          cornerRadius: el.cornerRadius ?? 0,
          cornerRadiusTL: el.cornerRadiusTL ?? 0,
          cornerRadiusTR: el.cornerRadiusTR ?? 0,
          cornerRadiusBL: el.cornerRadiusBL ?? 0,
          cornerRadiusBR: el.cornerRadiusBR ?? 0,
          opacity: el.opacity ?? 100,
          rotation: el.rotation ?? 0,
          visible: el.visible !== false,
          locked: el.locked === true,
          blendMode: el.blendMode || 'normal',
          clipContent: el.clipContent ?? false,
          flipH: el.flipH ?? false,
          flipV: el.flipV ?? false,
        }
        if (el.type === 'text') {
          base.textContent = el.textContent ?? 'Text'
          base.fontFamily = el.fontFamily ?? 'Inter'
          base.fontSize = el.fontSize ?? 18
          base.fontWeight = el.fontWeight ?? 400
          base.fontStyle = el.fontStyle
          base.textDecoration = el.textDecoration
          base.textAlign = el.textAlign ?? 'left'
          base.lineHeight = el.lineHeight ?? 1.4
          base.letterSpacing = el.letterSpacing ?? 0
          base.textColor = el.textColor ?? '#000000'
        }
        if (el.children && Array.isArray(el.children)) {
          base.children = el.children.map(ensureElement)
        }
        return base
      }

      const pages = project.pages || []
      const firstPage = pages[0]
      const pageElements = firstPage?.elements || project.elements || []

      const converted = pageElements.map(ensureElement)
      const convertedPages = pages.map((p: any) => ({
        id: p.id,
        name: p.name || 'Page 1',
        elements: (p.elements || []).map(ensureElement),
      }))

      set({
        elements: converted,
        pages: convertedPages.length > 0 ? convertedPages : [{ id: 'page-1', name: 'Page 1', elements: converted }],
        activePageId: firstPage?.id || 'page-1',
        fileName: project.name || 'Untitled',
        selectedElementIds: [],
        history: [{ elements: deepCloneElements(converted), selectedElementIds: [] }],
        historyIndex: 0,
        isDirty: false,
      })
    } catch (err) {
      console.error('loadServerProject failed:', err)
    }
  },

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

      // Add element to frame's children
      const existingChildren = updatedFrame.children || []
      const newChildren = [...existingChildren, childElement]
      const newElements = updateElementInList(elementsWithout, frameId, { children: newChildren })

      return {
        elements: newElements,
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
      if (oldIndex === -1 || oldIndex === newIndex) return state
      const newElements = [...state.elements]
      const [element] = newElements.splice(oldIndex, 1)
      newElements.splice(newIndex, 0, element)
      return { elements: newElements, isDirty: true }
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
