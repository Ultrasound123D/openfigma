# WORKLOG (project-level) — قرارات ومراحل
> سجل القرارات الهندسية. التفاصيل اليومية في /home/z/my-project/worklog.md.

| # | القرار | المضمون |
|---|---|---|
| 001 | مصدر قراءة فقط | أصول Figma مرجع بنيوي/قيمي — لا نسخ كود |
| 002 | نموذج Interaction | Trigger+Action+Animation+Easing على عنصر (مطابق فئات Figma) |
| 003 | تصدير بلا حزم جديدة | JPG/WEBP عبر canvas.toBlob و PDF عبر jsPDF الموجودين |
| 004 | استيراد DOMParser | SVG يُحلَّل محلياً إلى عناصر قابلة للتحرير (لا استيراد كصورة) |
| 005 | smart-animate بالمطابقة الاسمية | مطابقة العناصر بين الإطارين عبر المسار الكامل للاسم |
| 006 | PUT whitelist | API يقبل حقولاً بيضاء فقط، والحقول الجديدة اختيارية |
| 007 | ramp REGENERATED | درجات الألوان الكاملة تُولَّد حول مراسٍ مؤكدة لأن port-source مفقود (LOST-SOURCE) |
| 008 | ترتيب التنفيذ بعد فقدان البيئة | PHASE 4 لا تبدأ قبل إغلاق 1-3 (قاعدة اكتمال المراحل) — نُفِّذت 1→4 تسلسلياً |

## تنفيذ هذه الجلسة
- PHASE 1: globals.css tokens v2 + layout Inter/RobotoMono + UI3 dims (Toolbar 32×32، لوحات 241/320px، صفوف 28px)
- PHASE 2: types/prototype.ts + lib/prototype/{transitions,smart-animate} + prototype/{PrototypePlayer,InteractionsPanel} + store + API whitelist
- PHASE 3: export.ts موحّد 5 صيغ + ExportPanel إعدادات كاملة
- PHASE 4: lib/import/{image,svg,project} + تكامل TopBar + إفلات موحّد

## تنفيذ هذه الجلسة (تفصيل تقني)
- PHASE 1: globals.css — كتلة @theme بخمس ramps (blue/purple/red/green/grey) حول مراسٍ مؤكدة (DECISION-007، سكريبت scripts/gen_fig_ramps.py) + ألوان دلالية (surface/panel/border/hover/accent/danger/success/component) + tokens طباعة (body 11/16، أوزان 450/550، mono) + radius/spacers/shadows + أبعاد UI3 كمتغيرات. layout.tsx: Inter+Roboto_Mono. Toolbar: أزرار 32×32 عبر var(--fig-toolbar-btn)، pill radius 13px، ظل 400. EditorLayout: defaultSize مشتق من 241/320px مع قياس viewport حي. LayerPanel: صفوف 28px.
- PHASE 2: types/prototype.ts (النموذج + التسميات) — lib/prototype/transitions.ts (EASING_BEZIERS + enterFrom/exitTo/transitionCss) — lib/prototype/smart-animate.ts (indexByNamePath + matchFrames + diff) — store: interactions على DesignElement + حالة isPreviewing/previewFrameId/overlayStack/previewHistory + أفعال add/update/removeInteraction + start/stopPreview + previewNavigate (navigate يضيف للتاريخ، back يغلق overlay أولاً) — prototype/FrameRenderer.tsx (عارض SVG إنتاجي كامل الأنواع + defs تدرجات/صور/ظلال + elementStyle للـsmart-animate) — prototype/PrototypePlayer.tsx (ملء الشاشة، fit-scale، محفزات خمسة، سحب بعتبة 6px، كومة overlays بخلفيات none/solid/blur، HUD، Esc/R) — prototype/InteractionsPanel.tsx (محرر تفاعلات حقيقي) — RightSidebar: استبدال اللوحة الوهمية — TopBar: زر ▶ — API PUT whitelist (DECISION-006) — إصلاح حرج: normalizeServerElement صار يحفظ كل الحقول (كان يسقط fills/effects/interactions في المزامنة الحية) — مشهد توضيحي Home/Detail بتفاعلات جاهزة.
- PHASE 3: lib/export.ts مُعاد كتابته — exportDesign (المشهد الحي) + exportElement (شجرة DOM خارج الشاشة renderTree تغطي rect/ellipse/line/text/polygon/star/path/groups/auto-layout) + reencodeToBlob لـJPG/WEBP + jsPDF باتجاه تلقائي — ExportPanel (صيغة/مقياس/جودة/لاحقة) — TopBar: خمسة أوامر تصدير سريعة.
- PHASE 4: lib/import/{image-import,svg-import,project-import,handlers}.ts — svg-import: DOMParser + parsePoints + تقطيع مسارات عبر getPointAtLength + حل url(#grad) + تغليف بإطار — project-import: تحقق looksLikeElement + regenerateTreeIds للدمج — handlers: توجيه بالنوع + شمّ SVG + pickFiles بدون حزم + toasts — TopBar: قائمة Import — use-element-interactions: handleDrop يوجّه للـhandlers عند نقطة الإفلات.
- تحقق: tsc صفر / eslint صفر / build ناجح 10 مسارات / smoke API: whitelist يمرر interactions ويحجب الحقن، round-trip سليم، SSE حي.
- PHASE 5 (تنظيف وتسليم): git rm لـ`src/app/api/route.ts` (سقالة Hello-world بدون أي مراجع — تحقق rg على src/ وmcp-server) — mcp-config.json: `mcp-server/dist/index.js` نسبي بدل `C:\Users\HP\...` — next.config.ts: حذف `typescript.ignoreBuildErrors` مع تعليق يوثق السبب (tsc صفر أخطاء مثبت قبل الحذف) — README ثنائي اللغة: قسم What's new v0.2.0 + إزالة ادعاء dist المبني مسبقاً (كاذب) + سرد ميزات 1-4 (5 صيغ تصدير، نظام Prototype، استيراد ثلاثي، tokens UI3) + توحيد عدد مسارات API إلى 8 (كان 9/8/25+ متضاربة) + تصحيح وصف المشهد الافتتاحي (iPhone 16 بدل VidVerse) + إصلاح خطأ مطبعي عربي — تدقيق ملفات ميتة (audit_dead_files.py): 64 ملف src، صفر ملفات ميتة (9 "مرشحات" كلها مسارات API دخول) — ملفات JSON الجذرية (els/check/souf/sport/appicon): بلا مراجع كود، بيانات مؤلف أصلي متتبعة في git → بقيت كما هي — تحقق ثلاثي بعد التنظيف + دخان 7/7 على standalone الجديد.

## تنفيذ جلسة المراحل 7←11 (بعد فقدان بيئة ثالث)
- قرار 009: الأنماط على مستوى المشروع — تركب نقل المشروع الكامل (styles في PUT/GET المشروع) لا مساراً مستقلاً؛ حقول المرجع فقط على العنصر تُدرج في whitelist العنصر
- قرار 010: snap-to-pixels صار خيار عرض فعلياً (كان Math.round مُصلّباً) — السحب/التحجيم يحترمانه
- قرار 011: شطب النص يُرسم يدوياً بخط SVG لأن دعم line-through على <text> متقلب بين المتصفحات
- قرار 012: الاستنتاج التلقائي للقيود يعمل عند الإنشاء/الإسقاط فقط، وعلامة constraintsEdited تحمي التعديل اليدوي من إعادة الاستنتاج (سلوك Figma المنشور)
- قرار 013: أداة Scale تعمل من لقطة أصلية (deep clone عند بدء السحب) فلا انجراف تراكمي؛ مرساة الزاوية المقابلة لمقبض السحب
- قرار 014: شبكة البكسل تظهر عند ≥400% فقط (سلوك Figma)؛ إعادة توزيع الاختصارات: ⌘' بكسل / ⇧⌘' snap / ⌘\ شبكات تخطيط / ⌘⇧; شبكة نقطية
- تفصيل التنفيذ في PROGRESS.md قسم "جلسة المراحل 7←11"

### DECISION-015 — PHASE 17: baked-geometry display model for boolean groups + wave-2 plan
- Live verification (scripts/p17_baseline.sh) PROVED the latent PHASE 6 defect: boolean
  groups rendered as a bbox rect (first operand's fill); children never rendered; no
  compositing anywhere (Canvas 'boolean' → default rect; FrameRenderer had no case).
- Fix model (documented): groups render their TRUE folded geometry (Greiner-Hormann,
  same engine as export) painted with the group's own fill/stroke. Per-child paint
  compositing inside live groups is UNKNOWN at minified-source level — not modeled.
- flattenSelection bakes exactly the same geometry permanently (parity by construction).
- KNOWN LIMITATION (documented, not silently fixed): booleanOperation() treats operand
  x/y as page-absolute — consistent with the only existing creation path (operands were
  top-level at grouping time). Grouping nested-children across levels is not supported
  by the store action; out of P17 scope.
- Wave-2 plan (PORT-PLAN-17-22.md): 21 evidence-verified gaps; rejected items documented
  (voice = AI-chat only; search-palette SRC-ABSENT; bend subsumed by vector-edit; .fig =
  URL false positives; annotate = a11y lint; blur already ported — audit pattern too literal).
