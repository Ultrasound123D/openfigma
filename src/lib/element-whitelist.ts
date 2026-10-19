/**
 * PHASE 13 — shared element field whitelist (DECISION-006).
 * The PUT route has enforced a whitelist since PHASE 2 to prevent arbitrary
 * field injection; the POST route was spreading raw overrides (defect found
 * during PHASE 13 verification — junk fields could enter the store on create).
 * Both routes now pick from this single source of truth.
 */
export const ELEMENT_FIELD_WHITELIST = [
  // identity & geometry
  'name', 'type', 'x', 'y', 'width', 'height', 'rotation', 'opacity',
  'visible', 'locked', 'flipH', 'flipV', 'blendMode',
  // fills & strokes
  'fill', 'stroke', 'strokeWidth', 'strokeStyle', 'strokeAlign',
  'cornerRadius', 'cornerRadiusTL', 'cornerRadiusTR', 'cornerRadiusBL', 'cornerRadiusBR',
  'fills', 'strokes',
  // effects
  'shadows', 'blurs',
  // text
  'textContent', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'textDecoration', 'textAlign', 'lineHeight', 'letterSpacing', 'textColor',
  // vector / shape
  'pathPoints', 'pathClosed', 'vectorNetwork', 'sides', 'innerRadius',
  // structure
  'children', 'autoLayout', 'clipContent', 'constraints', 'constraintsEdited',
  'booleanOperation', 'booleanSourceIds', 'booleanContours', 'isMask',
  // PHASE 12 — auto layout child sizing + positioning + min/max
  'layoutSizingH', 'layoutSizingV', 'layoutPositioning',
  'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  // component system
  'isComponent', 'componentId', 'overrides',
  'isComponentSet', 'componentSetId', 'componentPropertyDefinitions',
  'variantProperties', 'variantGroupProperties', 'defaultVariant',
  'componentProperties', 'componentPropertyReferences',
  // arrows
  'arrowStartId', 'arrowEndId', 'arrowHeadStyle',
  // export settings (PHASE 3)
  'exportSettings',
  // prototype interactions (PHASE 2)
  'interactions',
  // PHASE 7 — style references
  'fillStyleId', 'strokeStyleId', 'textStyleId', 'effectStyleId',
  // PHASE 8 — per-frame layout grids
  'layoutGrids',
  // PHASE 10 — text sizing/case
  'textAutoResize', 'textCase',
  // PHASE 13 — text depth: vertical align + lists
  'textAlignVertical', 'listType', 'listIndent',
  // PHASE 15 — table model
  'tableData',
] as const

/** Pick only whitelisted keys from a raw body (defensive against injection). */
export function pickElementFields(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) return {}
  const source = body as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of ELEMENT_FIELD_WHITELIST) {
    if (key in source) out[key] = source[key]
  }
  return out
}
