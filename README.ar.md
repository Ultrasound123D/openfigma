<p align="center">
  <img src="img/sign.jpeg" alt="OpenFigma" width="100%" />
</p>

# 🎨 OpenFigma — محرر تصميم متجهي يعمل في المتصفح

**OpenFigma** هو استنساخ عملي لمحرر تصميم على طراز **Figma**، مبني بالكامل باستخدام **Next.js 16 + React 19 + TypeScript**، مع محرك رسم قائم على **SVG** وإدارة حالة عبر **Zustand**. المشروع جاهز للاستخدام الفوري: بدون قاعدة بيانات ثقيلة وبدون تعقيد نشر — شغّله وابدأ التصميم.

---

## 📖 كيف بدأ المشروع

بدأت الفكرة في ديسمبر 2025 كتجربة لفهم **كيف تعمل محررات التصميم الحقيقية من الداخل**:

1. **تشريح الأصل** — درسنا سلوك فايغما على اللوحة ميزة بعلف: التحديد، الالتصاق، الأدلة الذكية، التخطيط، السجل الزمني.
2. **إعادة بناء نظيف بأدوات مفتوحة** — بدلاً من التقليد الأعمى، أُعيد بناء كل ميزة من الصفر: Next.js وReact بدل بنية واجهة فايغما الأصلية، وSVG بدل محرك C++/WebGL.
3. **سجل قرارات معمارية موثق** — كل قرار هام (SVG مقابل WebGL، Zustand مقابل Redux، حفظ مزدوج...) سُجل لحظة اتخاذه مع البدائل والتبريرات.
4. **تحقق منهجي** — تُختبر الميزات واحدة تلو الأخرى مقابل السلوك الأصلي: أكثر من 50 ميزة أساسية (أدلة ذكية، عمليات منطقية، Auto Layout، مكونات، Undo/Redo...) وصلت إلى ✅ **متحقق 100%**.

---

## 🧠 كيف يعمل المشروع (المعمارية)

```
┌────────────────────────────────────────────────────┐
│                     المتصفح                         │
│                                                    │
│  EditorLayout (الهيكل)                             │
│  ├── Toolbar         شريط الأدوات                   │
│  ├── Canvas.tsx      لوحة SVG (زوم/بان/أدوات/تحديد)  │
│  ├── LayerPanel      شجرة الطبقات                   │
│  └── PropertiesPanel لوحة الخصائص                   │
│            │                                       │
│            ▼                                       │
│  Zustand Store (editor-store.ts)                   │
│  العناصر · الصفحات · التحديد · السجل · الحافظة        │
│            │                                       │
│            ▼                                       │
│  منطق مجرد                                          │
│  element-utils · auto-layout · boolean-ops          │
│  snap-utils · export · image-utils                 │
│            │                                       │
│            ▼                                       │
│  الحفظ                                              │
│  IndexedDB (تلقائي كل 30ث) + JSON على السيرفر        │
└────────────────────────────────────────────────────┘
        ▲
        │ HTTP (25+ مسار API)
        │
   MCP Server ──── وكيل الذكاء الاصطناعي (Claude / opencode / Cursor)
```

### نموذج البيانات الأساسي
كل شيء على اللوحة هو `DesignElement` — شجرة عناصر مرتبطة بـ `parentId`:
- **الأنواع:** `rectangle, ellipse, text, line, polygon, star, arrow, frame, image, pen/mask, boolean`
- **الخصائص:** موضع وحجم وتدوير، طبقات تعبئة (تدرجات/صور)، حدود، ظلال وضباب، شفافية ووضع مزج
- الإطارات/المجموعات تضم أبناء، ومع **Auto Layout** يُعاد حساب التخطيط تلقائياً عند تغيّرهم

### تدفق تفاعل المستخدم
1. حدث المستخدم يلتقطه `Canvas.tsx` (ضغطة/سحب/كتابة)
2. أثناء الرسم: معاينة `<rect>` حية، وعند الإفلات يمر عبر `addElement`
3. إجراء على المخزن (70+ إجراء) يستدعي `pushHistory` (نقطة تراجع)
4. تحديث انتقائي عبر المحددات (selectors) — بدون إعادة رسم شامل

### الميزات الجاهزة فوراً
- **التحرير** — تحديد مفرد/متعدد + مربع السحب، مقابض تحجيم ثمانية، تدوير 15° مع Shift، تكرار Alt+Drag
- **الأدلة الذكية** — خطوط محاذاة حمراء منقطة، التصاق شبكي 6px، قياس المسافات بـ Alt+Hover
- **نص مضمّن** — نقرة مزدوجة للتحرير مباشرة في اللوحة
- **عمليات منطقية** — Union / Subtract / Intersect / Exclude على مسارات المتجهات
- **Auto Layout** — اتجاهات، فراغات، هامش داخلي، محاذاة وأنماط تحجيم
- **مكونات وVariants** — إنشاء/استنساخ/فصل، ولوحات ألوان وخطوط المستند
- **التصدير** — PNG / SVG / PDF عبر `ExportPanel` أو API
- **نظام صفحات متعدد**، وباني تفاعلات أولي (Prototype)، وتوليد كود CSS بتبويب Inspect
- **تراجع/إعادة** — سجل لقطات يُعبأ من 25+ موقع استدعاء

### طبقة الحفظ المزدوجة
| المسار | الملف | الاستخدام |
|---|---|---|
| المتصفح | `storage.ts` → IndexedDB | حفظ تلقائي كل 30 ثانية، يُحمل عند البدء |
| السيرفر | `server-state.ts` → `.design-data/<id>.json` | مصدر الحقيقة الواحد للـ API وخادم MCP |

نفس البيانات تمر عبر 8 مسارات Next.js App Router (`/api/designs`, `/api/export`, `/api/editor/projects/...`) — وهذا ما يجعل المحرر قابلاً للتحكم برمجياً وذكائياً.

---

## 🚀 التشغيل محلياً

```bash
npm install      # التبعيات
npm run dev      # سيرفر التطوير على http://localhost:3000
```

- لا تحتاج أي إعداد قاعدة بيانات — تصميم تجريبي ("VidVerse") يُحمّل تلقائياً عند أول زيارة
- يتطلب Node 18+

---

## 🤖 ربط المحرر بـ MCP (بروتوكول سياق النموذج)

### ما يعنيه MCP هنا
خادم MCP جاهز للعمل يقع في `mcp-server/` ويتصل عبر **بروتوكول JSON-RPC على قناة stdio**.
الوكيل الذكي (AI agent) يستهلكه ويتحدث مع المحرر: يرسل أوامر fetch إلى API السيرفر الذي يخلق/يعدل/يقرأ تصميمك.

```
الوكيل الذكي (Claude Desktop / opencode / Cursor)
        │  استدعاء أداة  مثال: create_rectangle({x:100,...})
        ▼
MCP Server (mcp-server/dist/index.js عبر stdio)
        │  fetch http://localhost:3000/api/...
        ▼
API Routes (Next.js)  ──►  server-state.ts  ──►  .design-data/<id>.json
        │
        ▼
التصميم يحدث ويحفظ — والتطبيق يعرضه حياً
```

> ⚠️ يجب أن يكون سيرفر المحرر يعمل (`npm run dev`) على المنفذ 3000 — MCP يتحدث معه عبر HTTP.

### خطوة 1 — بناء خادم MCP
```bash
cd mcp-server
npm install
npm run build     # ينتج mcp-server/dist/index.js
```
> المستودع جاء معه `dist` مبني مسبقاً — قد لا تحتاج هذه الخطوة.

### خطوة 2 — تكوين الاتصال
ملف `mcp-config.json` في جذر المشروع:
```json
{
  "mcpServers": {
    "figma-editor": {
      "command": "node",
      "args": ["C:\\Users\\HP\\Desktop\\figma_project (1)\\mcp-server\\dist\\index.js"],
      "env": { "EDITOR_API_URL": "http://localhost:3000" }
    }
  }
}
```
عدّل `args` ليطابق مسار `dist/index.js` على جهازك، و`EDITOR_API_URL` إن كان السيرفر على منفذ آخر.

### خطوة 3 — التسجيل حسب العميل

| العميل | الملف | المكان |
|---|---|---|
| **Claude Desktop** | `claude_desktop_config.json` | `%APPDATA%\Claude\` — أضف قسم `mcpServers` أعلاه |
| **opencode** | `opencode.json` | جذر المشروع: `"mcp": { "figma-editor": { "type": "local", "command": ["node", "...\\dist\\index.js"], "environment": { "EDITOR_API_URL": "http://localhost:3000" } } }` |
| **Cursor** | `mcp.json` | `.cursor/mcp.json` في المشروع أو `~/.cursor/` |
| **VS Code (Copilot)** | `mcp.json` | `.vscode/mcp.json` بنفس البنية |

بعد حفظ ملف التكوين **أعد فتح العميل** ليكتشف الأدوات.

### خطوة 4 — أول مهمة للذكاء الاصطناعي
اكتب مثل:
```
أنشئ مشروعاً "Login UI" وفيه إطار رمادي اللون
وداخله بطاقة بيضاء فيها زر أخضر "تسجيل الدخول"
```
الوكيل سينفذ التسلسل تلقائياً:
`list_projects → create_project → create_frame → create_text → update_element ...`

### جميع أدوات MCP المتاحة (52)

> العدّ متحقق من الكود المصدري: 16 تسجيلاً مباشراً + 36 أداة يولّدها `makeCreateTool` / `toolAction` = **52 أداة**.

| الفئة | الأدوات |
|---|---|
| 📂 المشاريع (4) | `create_project` · `list_projects` · `get_project` · `delete_project` |
| ✏️ إنشاء عناصر (8) | `create_rectangle` · `create_ellipse` · `create_frame` · `create_line` · `create_polygon` · `create_star` · `create_arrow` · `create_text` |
| 🔧 CRUD العناصر (4) | `get_element` · `update_element` · `delete_element` · `list_elements` |
| 🔄 تحريك وترتيب (11) | `move_element` · `move_element_to` · `resize_element` · `rotate_element` · `duplicate_element` · `group_elements` · `ungroup_elements` · `bring_forward` · `send_backward` · `bring_to_front` · `send_to_back` |
| 📐 محاذاة وتوزيع (2) | `align_elements` · `distribute_elements` |
| 🎨 تنسيق (8) | `set_fill` · `set_stroke` · `set_corner_radius` · `set_opacity` · `set_blend_mode` · `add_shadow` · `flip_horizontal` · `flip_vertical` |
| ✍️ نص (2) | `set_text_content` · `set_text_style` |
| 🔒 إظهار وبيانات (3) | `set_visible` · `set_locked` · `rename_element` |
| 🔍 استعلام (2) | `search_elements` · `get_all_elements` |
| 🧹 اللوحة (1) | `clear_canvas` |
| 📄 الصفحات (4) | `list_pages` · `create_page` · `set_active_page` · `delete_page` |
| 🧩 واجهات جاهزة (3) | `draw_ui_card` · `draw_button` · `draw_phone_frame` |

### استكشاف أخطاء MCP

| المشكلة | الحل |
|---|---|
| الأدوات لا تظهر في العميل | جرّب `node mcp-server\dist\index.js` يدوياً — إن استمر معلقاً فالسيرفر سليم؛ صحح تكوين العميل وأعد تشغيله |
| `fetch failed` في نتائج الأداة | سيرفر المحرر غير يعمل — شغّل `npm run dev` أولاً |
| `EADDRINUSE :3000` | يوجد سيرفر قديم يعمل: أوقفه أو استخدم منفذاً آخر (`next dev -p 3001`) |
| `project not found` | نفّذ `list_projects` وانسخ المعرف الصحيح |
| مسار `dist` تغيّر بعد التعديل | عدّل المسار في `mcp-config.json`/تكوين العميل |

---

## 🗂️ بنية المشروع

```
├── src/app/           صفحة المحرر + 8 مسارات API
├── src/components/
│   ├── editor/        18 مكوّن محرر (Canvas, Toolbar, Panels...)
│   └── ui/            48 مكوّن shadcn/ui
├── src/lib/           منطق المحرك (element-utils, auto-layout, boolean-ops,
│                      snap-utils, storage, server-state, export)
├── src/store/         editor-store.ts (Zustand، ~2150 سطر)
├── src/data/          demo-design.ts (التصميم التجريبي)
├── mcp-server/        خادم MCP (52 أداة) + config
├── prisma/            schema (اختياري)
└── img/               sign.jpeg (صورة الغلاف)
```

---

<p align="center">
  <sub>Built with Next.js 16 · React 19 · SVG · Zustand · shadcn/ui · MCP</sub>
</p>
