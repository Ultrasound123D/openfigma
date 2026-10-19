#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_BASE = process.env.EDITOR_API_URL || 'http://localhost:3000';

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Identifies MCP as the actor so live-sync (SSE) events are tagged
      // with origin "mcp-server" and browser tabs can show AI-driven changes.
      'X-Client-Id': 'mcp-server',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

const server = new McpServer({ name: 'figma-editor', version: '1.0.0' });

// --- PROJECTS ---
server.tool('create_project', 'Create a new design project', { name: z.string() }, async ({ name }) => {
  const r = await api('POST', '/api/editor/projects', { name });
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

server.tool('list_projects', 'List all saved projects', {}, async () => {
  const r = await api('GET', '/api/editor/projects');
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

server.tool('get_project', 'Get project details', { projectId: z.string() }, async ({ projectId }) => {
  const r = await api('GET', `/api/editor/projects/${projectId}`);
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

server.tool('delete_project', 'Delete a project', { projectId: z.string() }, async ({ projectId }) => {
  const r = await api('DELETE', `/api/editor/projects/${projectId}`);
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

// --- CREATE ELEMENTS ---
const elSchema = {
  projectId: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  cornerRadius: z.number().optional(),
  name: z.string().optional(),
  parentId: z.string().optional(),
};

function makeCreateTool(type: string, desc: string, extra?: Record<string, any>) {
  const schema = { ...elSchema, ...(extra || {}) };
  server.tool(`create_${type}`, desc, schema, async (params: any) => {
    const r = await api('POST', `/api/editor/projects/${params.projectId}/elements`, { type, ...params });
    return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
  });
}

makeCreateTool('rectangle', 'Create a rectangle element');
makeCreateTool('ellipse', 'Create an ellipse element');
makeCreateTool('frame', 'Create a frame (container)', { clipContent: z.boolean().optional() });
makeCreateTool('line', 'Create a line element');
makeCreateTool('polygon', 'Create a polygon', { sides: z.number().optional() });
makeCreateTool('star', 'Create a star', { sides: z.number().optional(), innerRadius: z.number().optional() });
makeCreateTool('arrow', 'Create an arrow', { arrowHeadStyle: z.enum(['arrow', 'circle', 'diamond', 'none']).optional() });

server.tool('create_text', 'Create a text element', {
  projectId: z.string(), x: z.number(), y: z.number(),
  textContent: z.string(), fontSize: z.number().optional(),
  fontFamily: z.string().optional(), fontWeight: z.number().optional(),
  textColor: z.string().optional(), width: z.number().optional(),
  height: z.number().optional(), name: z.string().optional(),
  parentId: z.string().optional(),
}, async (params: any) => {
  const r = await api('POST', `/api/editor/projects/${params.projectId}/elements`, { type: 'text', ...params });
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

// --- ELEMENT CRUD ---
server.tool('get_element', 'Get element by ID', {
  projectId: z.string(), elementId: z.string(),
}, async ({ projectId, elementId }) => {
  const r = await api('GET', `/api/editor/projects/${projectId}/elements/${elementId}`);
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

server.tool('update_element', 'Update element properties', {
  projectId: z.string(), elementId: z.string(), updates: z.record(z.any()),
}, async ({ projectId, elementId, updates }) => {
  const r = await api('PUT', `/api/editor/projects/${projectId}/elements/${elementId}`, updates);
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

server.tool('delete_element', 'Delete an element', {
  projectId: z.string(), elementId: z.string(),
}, async ({ projectId, elementId }) => {
  const r = await api('DELETE', `/api/editor/projects/${projectId}/elements/${elementId}`);
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

server.tool('list_elements', 'List all elements', { projectId: z.string() }, async ({ projectId }) => {
  const r = await api('GET', `/api/editor/projects/${projectId}/elements`);
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

// --- TOOLS (transform, style, etc) ---
function toolAction(name: string, desc: string, extraSchema: Record<string, any>, handler: (params: any) => any) {
  server.tool(name, desc, { projectId: z.string(), ...extraSchema }, async (params: any) => {
    const r = await api('POST', `/api/editor/projects/${params.projectId}/tools`, handler(params));
    return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
  });
}

toolAction('move_element', 'Move element by offset', { elementId: z.string(), dx: z.number(), dy: z.number() },
  (p) => ({ action: 'move', id: p.elementId, dx: p.dx, dy: p.dy }));

toolAction('move_element_to', 'Move element to position', { elementId: z.string(), x: z.number(), y: z.number() },
  (p) => ({ action: 'moveTo', id: p.elementId, x: p.x, y: p.y }));

toolAction('resize_element', 'Resize element', { elementId: z.string(), width: z.number(), height: z.number() },
  (p) => ({ action: 'resize', id: p.elementId, width: p.width, height: p.height }));

toolAction('rotate_element', 'Rotate element', { elementId: z.string(), rotation: z.number() },
  (p) => ({ action: 'rotate', id: p.elementId, rotation: p.rotation }));

toolAction('duplicate_element', 'Duplicate element', { elementId: z.string() },
  (p) => ({ action: 'duplicate', id: p.elementId }));

toolAction('group_elements', 'Group elements', { elementIds: z.array(z.string()) },
  (p) => ({ action: 'group', ids: p.elementIds }));

toolAction('ungroup_elements', 'Ungroup a group', { elementId: z.string() },
  (p) => ({ action: 'ungroup', id: p.elementId }));

toolAction('bring_forward', 'Bring forward', { elementId: z.string() },
  (p) => ({ action: 'bringForward', id: p.elementId }));

toolAction('send_backward', 'Send backward', { elementId: z.string() },
  (p) => ({ action: 'sendBackward', id: p.elementId }));

toolAction('bring_to_front', 'Bring to front', { elementId: z.string() },
  (p) => ({ action: 'bringToFront', id: p.elementId }));

toolAction('send_to_back', 'Send to back', { elementId: z.string() },
  (p) => ({ action: 'sendToBack', id: p.elementId }));

toolAction('align_elements', 'Align elements', {
  elementIds: z.array(z.string()),
  alignment: z.enum(['left', 'center-h', 'right', 'top', 'center-v', 'bottom']),
}, (p) => ({ action: 'align', ids: p.elementIds, alignment: p.alignment }));

toolAction('distribute_elements', 'Distribute elements', {
  elementIds: z.array(z.string()),
  direction: z.enum(['horizontal', 'vertical']),
}, (p) => ({ action: 'distribute', ids: p.elementIds, direction: p.direction }));

toolAction('set_fill', 'Set fill color', { elementId: z.string(), fill: z.string() },
  (p) => ({ action: 'setFill', id: p.elementId, fill: p.fill }));

toolAction('set_stroke', 'Set stroke', { elementId: z.string(), stroke: z.string().optional(), strokeWidth: z.number().optional() },
  (p) => ({ action: 'setStroke', id: p.elementId, stroke: p.stroke, strokeWidth: p.strokeWidth }));

toolAction('set_corner_radius', 'Set corner radius', { elementId: z.string(), cornerRadius: z.number() },
  (p) => ({ action: 'setCornerRadius', id: p.elementId, cornerRadius: p.cornerRadius }));

toolAction('set_opacity', 'Set opacity', { elementId: z.string(), opacity: z.number() },
  (p) => ({ action: 'setOpacity', id: p.elementId, opacity: p.opacity }));

toolAction('set_blend_mode', 'Set blend mode', { elementId: z.string(), blendMode: z.string() },
  (p) => ({ action: 'setBlendMode', id: p.elementId, blendMode: p.blendMode }));

toolAction('add_shadow', 'Add shadow', {
  elementId: z.string(),
  x: z.number().optional(), y: z.number().optional(),
  blur: z.number().optional(), spread: z.number().optional(),
  color: z.string().optional(), opacity: z.number().optional(),
}, (p) => ({
  action: 'addShadow', id: p.elementId,
  shadow: { type: 'drop-shadow', x: p.x ?? 0, y: p.y ?? 4, blur: p.blur ?? 8, spread: p.spread ?? 0, color: p.color ?? '#000000', opacity: p.opacity ?? 25, visible: true },
}));

toolAction('flip_horizontal', 'Flip horizontal', { elementId: z.string() },
  (p) => ({ action: 'flipHorizontal', id: p.elementId }));

toolAction('flip_vertical', 'Flip vertical', { elementId: z.string() },
  (p) => ({ action: 'flipVertical', id: p.elementId }));

toolAction('set_text_content', 'Set text', { elementId: z.string(), textContent: z.string() },
  (p) => ({ action: 'setTextContent', id: p.elementId, textContent: p.textContent }));

toolAction('set_text_style', 'Set text style', {
  elementId: z.string(),
  fontFamily: z.string().optional(), fontSize: z.number().optional(),
  fontWeight: z.number().optional(), textAlign: z.enum(['left', 'center', 'right', 'justified']).optional(),
  textColor: z.string().optional(), lineHeight: z.number().optional(), letterSpacing: z.number().optional(),
}, (p) => ({ action: 'setTextStyle', ...p }));

toolAction('set_visible', 'Set visibility', { elementId: z.string(), visible: z.boolean() },
  (p) => ({ action: 'setVisible', id: p.elementId, visible: p.visible }));

toolAction('set_locked', 'Set lock', { elementId: z.string(), locked: z.boolean() },
  (p) => ({ action: 'setLocked', id: p.elementId, locked: p.locked }));

toolAction('rename_element', 'Rename', { elementId: z.string(), name: z.string() },
  (p) => ({ action: 'rename', id: p.elementId, name: p.name }));

toolAction('search_elements', 'Search elements', {
  query: z.string().optional(), type: z.string().optional(), name: z.string().optional(),
}, (p) => ({ action: 'search', query: p.query, type: p.type, name: p.name }));

toolAction('clear_canvas', 'Clear all', {}, () => ({ action: 'clearCanvas' }));

toolAction('get_all_elements', 'Get all flat', {}, () => ({ action: 'getAllElements' }));

// --- PAGES ---
server.tool('list_pages', 'List pages', { projectId: z.string() }, async ({ projectId }) => {
  const r = await api('GET', `/api/editor/projects/${projectId}/pages`);
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

server.tool('create_page', 'Create page', { projectId: z.string(), name: z.string() }, async ({ projectId, name }) => {
  const r = await api('POST', `/api/editor/projects/${projectId}/pages`, { name });
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

server.tool('set_active_page', 'Set active page', { projectId: z.string(), pageId: z.string() }, async ({ projectId, pageId }) => {
  const r = await api('PUT', `/api/editor/projects/${projectId}/pages/${pageId}`, { active: true });
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

server.tool('delete_page', 'Delete page', { projectId: z.string(), pageId: z.string() }, async ({ projectId, pageId }) => {
  const r = await api('DELETE', `/api/editor/projects/${projectId}/pages/${pageId}`);
  return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
});

// --- COMPLEX DRAWING ---
server.tool('draw_ui_card', 'Draw a UI card', {
  projectId: z.string(), x: z.number(), y: z.number(),
  width: z.number(), height: z.number(),
  title: z.string(), body: z.string(),
  backgroundColor: z.string().optional(), borderRadius: z.number().optional(),
}, async ({ projectId, x, y, width, height, title, body, backgroundColor, borderRadius }) => {
  const card = await api('POST', `/api/editor/projects/${projectId}/elements`, {
    type: 'rectangle', x, y, width, height,
    fill: backgroundColor ?? '#FFFFFF', stroke: '#E0E0E0', strokeWidth: 1,
    cornerRadius: borderRadius ?? 16, name: 'Card',
  });
  const titleEl = await api('POST', `/api/editor/projects/${projectId}/elements`, {
    type: 'text', x: x + 16, y: y + 16, width: width - 32, height: 30,
    textContent: title, fontFamily: 'Inter', fontSize: 18, fontWeight: 700,
    textColor: '#1A1A1A', name: 'Card Title',
  });
  const bodyEl = await api('POST', `/api/editor/projects/${projectId}/elements`, {
    type: 'text', x: x + 16, y: y + 50, width: width - 32, height: height - 66,
    textContent: body, fontFamily: 'Inter', fontSize: 14, fontWeight: 400,
    textColor: '#666666', name: 'Card Body',
  });
  return { content: [{ type: 'text', text: JSON.stringify({ card, titleEl, bodyEl }, null, 2) }] };
});

server.tool('draw_button', 'Draw a button', {
  projectId: z.string(), x: z.number(), y: z.number(),
  width: z.number(), height: z.number(), label: z.string(),
  backgroundColor: z.string().optional(), textColor: z.string().optional(),
  borderRadius: z.number().optional(),
}, async ({ projectId, x, y, width, height, label, backgroundColor, textColor, borderRadius }) => {
  const btn = await api('POST', `/api/editor/projects/${projectId}/elements`, {
    type: 'rectangle', x, y, width, height,
    fill: backgroundColor ?? '#007AFF', cornerRadius: borderRadius ?? 8, name: 'Button',
  });
  const txt = await api('POST', `/api/editor/projects/${projectId}/elements`, {
    type: 'text', x: x + 16, y: y + (height - 20) / 2, width: width - 32, height: 20,
    textContent: label, fontFamily: 'Inter', fontSize: 14, fontWeight: 600,
    textColor: textColor ?? '#FFFFFF', textAlign: 'center', name: 'Button Label',
  });
  return { content: [{ type: 'text', text: JSON.stringify({ btn, txt }, null, 2) }] };
});

server.tool('draw_phone_frame', 'Draw iPhone frame', {
  projectId: z.string(), x: z.number(), y: z.number(),
  width: z.number().optional(), height: z.number().optional(), name: z.string().optional(),
}, async ({ projectId, x, y, width, height, name }) => {
  const w = width ?? 393, h = height ?? 852;
  const frame = await api('POST', `/api/editor/projects/${projectId}/elements`, {
    type: 'frame', x, y, width: w, height: h, fill: '#FFFFFF',
    stroke: '#E0E0E0', strokeWidth: 1, cornerRadius: 40, clipContent: true,
    name: name ?? 'Phone Frame',
  });
  const fid = frame.element?.id;
  if (fid) {
    await api('POST', `/api/editor/projects/${projectId}/elements`, {
      type: 'rectangle', x, y, width: w, height: 54, fill: '#F8F8F8', name: 'Status Bar', parentId: fid,
    });
    await api('POST', `/api/editor/projects/${projectId}/elements`, {
      type: 'rectangle', x: x + (w - 126) / 2, y: y + 12, width: 126, height: 32,
      fill: '#000000', cornerRadius: 20, name: 'Dynamic Island', parentId: fid,
    });
  }
  return { content: [{ type: 'text', text: JSON.stringify(frame, null, 2) }] };
});

// --- START ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Figma Editor MCP Server running');
}

main().catch(console.error);
