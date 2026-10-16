<p align="center">
  <img src="img/sign.jpeg" alt="OpenFigma" width="100%" />
</p>

# 🎨 OpenFigma — محرر تصميم متجهي يعمل في المتصفح

**OpenFigma** (اسم مستودع: openfigma) هو استنساخ عملي لمحرر تصميم على طراز **Figma**، مبني بالكامل باستخدام **Next.js 16 + React 19 + TypeScript**، مع محرك رسم قائم على **SVG** وإدارة حالة عبر **Zustand**. المشروع جاهز للاستخدام الفوري: بدون قاعدة بيانات ثقيلة وبدون تعقيد نشر — شغّله وابدأ التصميم.

---

## 📖 كيف بدأ المشروع

بدأت الفكرة في ديسمبر 2025 كتجربة لفهم **كيف تعمل محررات التصميم الحقيقية من الداخل**:

1. **الدرس من سيرفر فايغما الحقيقي** — تم حفظ ودراسة لقطة من واجهة موقع figma.com الفعلية (مجلد `figmajsx/` المرجعي: 128+ حزمة JS ~89MB، غير منشور في المستودع) لفهم بنية التطبيق الأصلي وأنماط عمله.
2. **إعادة البناء النظيف** — بدلاً من التقليد الأعمى، أُعيد بناء كامل الميزات بأدوات مفتوحة: Next.js 16 وReact 19 بدل بنية واجهة فايغما الأصلية، وSVG بدل محرك WebGL/C++.
3. **سجل قرارات معمارية موثق** — كل قرار (SVG مقابل WebGL، Zustand مقابل Redux، حفظ مزدوج...) مسجل في `WORKLOG.md` حسب التاريخ مع البدائل والتبريرات.
4. **التحقق المنهجي** — تُختبر الميزات واحدة تلو الأخرى وتوثَّق حالة التحقق في `docs/PORTING_STATUS.md`: أكثر من 50 ميزة أساسية (تدوير، أدلة ذكية، عمليات منطقية، Auto Layout، مكونات، Undo/Redo...) وصلت إلى ✅ **مُتحقق 100%**.

---

## 🧠 كيف يعمل المشروع (المعمارية)

```
┌────────────────────────────────────────────────────┐
│                    المتصفح                          │
│                                                    │
│  EditorLayout (الهيكل)                             │
│  ├── Toolbar        شريط الأدوات                    │
│  ├── Canvas.tsx     لوحة SVG (زوم/بان/أدوات/تحديد)   │
│  ├── LayerPanel     شجرة الطبقات                    │
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
│  الحفظ                                             │
│  IndexedDB (تلقائي كل 30ث) + JSON على السيرفر        │
└────────────────────────────────────────────────────┘
        ▲
        │ HTTP (25+ مسار API)
        │
   MCP Server ──── وكيل الذكاء الاصطناعي (Claude/Any)
```

### نموذج البيانات الأساسي
كل شيء على اللوحة هو `DesignElement` — شجرة عناصر مرتبطة بـ `parentId`:
- أنواعها: `rectangle, ellipse, text, line, polygon, star, arrow, frame, image, pen/mask, boolean`
- خصائصها: موضع وحجم وتدوير، طبقات تعبئة (تدرجات/صور)، حدود، ظلال وضباب، شفافية ووضع مزج
- الإطارات/المجموعات تضم أبناء، ومع Auto Layout يُعاد حساب التخطيط تلقائياً عند تغيّرهم

### تدفق تفاعل المستخدم
1. حدث المستخدم يلتقطه `Canvas.tsx` (ضغطة/سحب/كتابة)
2. إن كان رسمًا: معاينة `<rect>` مباشرة، وعند الإفلات مرور بـ `addElement`
3. إجراء على المخزن (70+ إجراء) يلمس `pushHistory` (نقطة تراجع)
4. تحديث انتقائي عبر المحددات (selectors) — بدون إعادة رسم شامل

### أنظمة قابلة للاستخدام فوراً
- **التعديل** تحديد مفرد/متعدد + مربع السحب، تحجيم المقابض الثمانية، تدوير 15° مع Shift، تكرار Alt+Drag
- **الأدلة الذكية** خطوط محاذاة حمراء منقطة، لصق شبكي 6px، وقياس المسافات بـ Alt+Hover
- **نص مضمّن** نقرة مزدوجة للتحرير داخل اللوحة
- **عمليات منطقية** Union / Subtract / Intersect / Exclude على مسارات المتجهات
- **Auto Layout** اتجاهات، فراغات، هامش داخلي، محاذاة وتحجيم
- **مكونات وVariants** إنشاء/استنساخ/فصل، مع لوحات ألوان وخطوط المستند
- **التصدير** PNG / SVG / PDF عبر `ExportPanel` أو API
- **نظام صفحات** متعدد، ومصمم تفاعلات أولي (Prototype)، وتوليد كود CSS بتبويب Inspect
- **تراجع/إعادة** سجل لقطات يُعبأ من 25+ موقع استدعاء

### طبقة الحفظ المزدوجة
| المسار | ملف | الاستخدام |
|---|---|---|
| المتصفح | `storage.ts` → IndexedDB | حفظ تلقائي كل 30 ثانية، يُستلم عند التحميل |
| السيرفر | `server-state.ts` → `.design-data/<id>.json` | مصدر الحقيقة الواحد للـ API وخادم MCP |

نفس البيانات تمر عبر 8 مسارات Next.js App Router (`/api/designs`, `/api/export`, `/api/editor/projects/...`) — هذا ما يجعل المحرر قابلاً للتحكم برمجياً وذكائياً.

---

## 🚀 التشغيل محلياً

```bash
npm install      # وحدة المشروع
npm run dev      # سيرفر التطوير على http://localhost:3000
```

- لا تحتاج أي إعداد قاعدة بيانات — البيانات الافتراضية مدمجة عبر `src/data/demo-design.ts`
- عند أول زيارة يُحمّل تصميم تجريبي باسم "VidVerse" تلقائياً على اللوحة

---

## 🤖 ربط المشروع بـ MCP (بروتوكول سياق النموذج)

### ما هي MCP هنا؟
خادم MCP جاهز للعمل يقع في `mcp-server/` ويتصل عبر **بروتوكول JSON-RPC على قناة stdio**.
الوكيل الذكي (AI agent) يستهلكه عن بُعد: يرسل أوامر fetch إلى API السيرفر الذي يخلق/يعدل/يقرأ تصميمك.

```
وكيل الذكاء الاصطناعي (Claude Desktop / opencode / Cursor)
        │  استدعاء أداة  مثال: create_rectangle({x:100,...})
        ▼
MCP Server (mcp-server/dist/index.js عبر stdio)
        │  fetch http://localhost:3000/api/...
        ▼
API Routes (Next.js)  ──►  server-state.ts  ──►  .design-data/<id>.json
        │
        ▼
التصميم يحدّث/يُخزن — والتطبيق يعرضه فوراً
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
عدّل `args` ليطابق مسار `dist/index.js` على جهازك، و`EDITOR_API_URL` إن كان السيرفر على منفذ/منفذ آخر.

### خطوة 3 — التسجيل حسب العميل

| العميل | الملف | المكان |
|---|---|---|
| **Claude Desktop** | `claude_desktop_config.json` | `%APPDATA%\Claude\` — ضع قسم `mcpServers` فوق |
| **opencode** | `opencode.json` | في جذر المشروع: `"mcp": { "figma-editor": { "type": "local", "command": ["node", "...\\dist\\index.js"], "environment": { "EDITOR_API_URL": "http://localhost:3000" } } }` |
| **Cursor** | `mcp.json` | `.cursor/mcp.json` في المشروع أو `~/.cursor/` |
| **VS Code (Copilot)** | `mcp.json` | `.vscode/mcp.json` بنفس البنية أعلاه |

بعد حفظ ملف التكوين **أعد فتح العميل** ليكتشف الأدوات.

### خطوة 4 — مرر أول مهمة للذكاء الاصطناعي
في شريط العميل اكتب مثل:
```
أنشئ مشروعاً "Login UI" وفيه إطار رمادي اللون
وبه زر «تسجيل» أخضر ينحصر داخل بطاقة بيضاء
```
الوكيل سينفذ التسلسل تلقائياً:
`list_projects → create_project → create_frame → create_text → update_element ...`

### جميع أدوات MCP المتاحة (24)

| الفئة | الأدوات |
|---|---|
| 📂 المشاريع | `create_project` · `list_projects` · `get_project` · `delete_project` |
| ✏️ إنشاء عناصر | `create_rectangle` · `create_ellipse` · `create_frame` · `create_line` · `create_polygon` · `create_star` · `create_arrow` · `create_text` |
| 🔧 التحرير | `get_element` · `update_element` · `delete_element` · `list_elements` |
| 📄 الصفحات | `list_pages` · `create_page` · `set_active_page` · `delete_page` |
| 🧩 واجهات جاهزة | `draw_ui_card` · `draw_button` · `draw_phone_frame` |

### استكشاف أخطاء MCP

| المشكلة | الحل |
|---|---|
| الأدوات لا تظهر في العميل | جرّب `node mcp-server\dist\index.js` يدوياً — إن استمر معلقاً فالسيرفر سليم والمشكلة في تكوين العميل؛ أعد تشغيل العميل |
| `fetch failed` في نتائج الأداة | سيرفر المحرر غير يعمل — `npm run dev` أولًا |
| `EADDRINUSE :3000` | يوجد سيرفر قديم يعمل: أوقفه أو استخدم منفذاً آخر (`next dev -p 3001`) |
| `project not found` | نفّذ `list_projects` وانسخ المعرف الصحيح |
| مسار `dist` تغيّر بعد التعديل | عدّل مسار الملف في `mcp-config.json`/تكوين العميل |

---

## 🗂️ بنية المشروع

```
├── src/app/           صفحة المحرر + 8 مسارات API
├── src/components/
│   ├── editor/        18 مكوّن محرر (Canvas, Toolbar, Panels...)
│   └── ui/            48 مكوّن shadcn/ui
├── src/lib/           المنطق (element-utils, auto-layout, boolean-ops,
│                      snap-utils, storage, server-state, export)
├── src/store/         editor-store.ts (Zustand، ~2150 سطر)
├── src/data/          demo-design.ts (تصميم البداية)
├── mcp-server/        خادم MCP (24 أداة) + config
├── prisma/            schema (اختياري)
├── docs/              PORTING_STATUS · DEVIATIONS · SYSTEM_MAP (محلي)
├── WORKLOG.md         سجل القرارات المعمارية (محلي)
└── img/               sign.jpeg (صورة الغلاف)
```

---

<p align="center">
  <sub>Built with Next.js 16 · React 19 · SVG · Zustand · shadcn/ui · MCP</sub>
</p>
