# ARCHITECTURE — خطة النقل الطبقية (REBUILT)
> L0–L5 + خطوط أنابيب Prototype / Export / Import. مبنية على قرارات DECISION-001..006 من جلسة PHASE 0.

## الطبقات
- **L0 النموذج**: `src/store/editor-store.ts` (DesignElement + Page + حالة التحرير) — مصدر الحقيقة الوحيد عبر Zustand.
- **L1 المنطق الخالص**: `src/lib/*` بلا React (element-utils, auto-layout, snap-utils, server-project, …).
- **L2 hooks التفاعل**: `src/components/editor/canvas/*` (viewport, hittest, pen, path-editing, interactions, keyboard).
- **L3 مكونات المحرر**: Toolbar/TopBar/LayerPanel/PropertiesPanel/… + `prototype/*` + لوحات الاستيراد.
- **L4 API**: 9 مسارات تحت `src/app/api/editor/` + SSE bus. عقد PUT بقائمة بيضاء (DECISION-006).
- **L5 البصريات**: `globals.css` — نظام `--fig-*` tokens (PHASE 1).

## PHASE 2 — نظام Prototype (DECISION-002/005)
- `src/types/prototype.ts`: `Interaction` = Trigger (click/hover/drag/keypress/delay) + Action (navigate/open-overlay/close-overlay/url/back) + Animation (instant/dissolve/move-in/slide-in/push/smart-animate) + Easing + duration + overlay settings.
- `src/lib/prototype/transitions.ts`: محرك الانتقالات (تطبيع الأهداف، حِزم easing، تنفيذ dissolve/move-in/slide-in/push).
- `src/lib/prototype/smart-animate.ts`: مطابقة بالاسم عبر المسار الكامل (DECISION-005) + diff (موضع/حجم/تعتيم/تدوير) وإطارات keyframe.
- Store: `interactions?: Interaction[]` على DesignElement + حالة المشغّل (isPreviewing, previewFlow) + أفعال add/update/remove interaction + start/stop/navigate.
- `components/editor/prototype/PrototypePlayer.tsx`: مشغّل ملء الشاشة — Esc للخروج، مؤشرات hotspot، كومة overlays، سجل back.
- `components/editor/prototype/InteractionsPanel.tsx`: تبويب Prototype في اللوحة اليمنى.

## PHASE 3 — خط التصدير (DECISION-003)
- `src/lib/export.ts` الموحّد: `exportDesign(opts)` + `exportElement(el, opts)` بصيغ PNG/JPG/SVG/PDF/WEBP.
- PNG/JPG/WEBP: html-to-image → canvas → `canvas.toBlob` (JPG بخلفية بيضاء، WEBP بجودة قابلة للضبط).
- SVG: XMLSerializer مع namespace + viewBox. PDF: jsPDF بضبط الاتجاه من الأبعاد.
- `ExportPanel.tsx`: تنسيق + مقياس 1x/2x/4x + جودة (JPG/WEBP) + لاحقة.

## PHASE 4 — خط الاستيراد (DECISION-004)
- `src/lib/import/image-import.ts`: منتقي ملفات → dataURL → أبعاد طبيعية → عنصر بتعبئة صورة.
- `src/lib/import/svg-import.ts`: DOMParser → مشي شجرة SVG (rect/circle/ellipse/line/polygon/path/text/g/image) → DesignElement[] مع تحويل viewBox.
- `src/lib/import/project-import.ts`: JSON مشروع (صفحتنا) → تحقق → تحميل/دمج.
- تكامل: قائمة File في TopBar + معالج إفلات موحّد في Canvas يوجّه حسب نوع الملف.

## عقود التوافق
- كل حقول PHASE 2/3/4 على DesignElement اختيارية (optional) — الملفات القديمة تُفتح بلا كسر.
- PUT elements: قائمة بيضاء بالحقول المسموح تحديثها (تمنع حقن معرّفات/أدوار).
