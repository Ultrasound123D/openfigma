# PROGRESS — تتبع المراحل
> إيقاع العمل: مرحلة تُغلق بتحقق ثلاثي (tsc/lint/build) + توثيق + "NEXT TASK READY".

| المرحلة | النطاق | الحالة |
|---|---|---|
| PHASE 0 | تحليل + تخطيط (5 مستندات) | ✅ مُعاد بناؤها بعد فقدان البيئة (LOST-SOURCE موسوم) |
| PHASE 1 | tokens `--fig-*`/`--color-fig-*` v2 + خطوط Inter/Roboto Mono + أبعاد UI3 (G1+G2) | ✅ |
| PHASE 2 | نظام Prototype كامل (G3) | ✅ |
| PHASE 3 | تصدير 5 صيغ + إعدادات scale/quality (G4) | ✅ |
| PHASE 4 | استيراد صور/SVG/JSON + إفلات موحّد (G5) | ✅ |
| PHASE 5 | تنظيف + توثيق نهائي + حزمة تسليم | ✅ |
| PHASE 6 | عمليات منطقية (Greiner-Hormann) + الأقنعة isMask | ✅ (جلسة سابقة — verify_phase6.sh + لقطات p6)
| PHASE 7 | نظام الأنماط: paint/text/effect + تطبيق/فصل/تسمية/عدّاد استخدام + StylesPanel | ✅ |
| PHASE 8 | شبكات التخطيط Columns/Rows/Grid × 6 أنماط + شبكة بكسل ⌘' + snap-to-pixels + خيارات العرض + مساطر px/in/cm/mm @DPI 72 | ✅ |
| PHASE 9 | القيود: سلوك إعادة تموضع/تحجيم الأبناء عند تحجيم الإطار + استنتاج تلقائي + منتقي 9 مربعات | ✅ |
| PHASE 10 | عمق النص: textAutoResize (fixed/hug/grow بقياس canvas حقيقي) + textCase + شطب + أنماط تعبئة الصورة fill/fit/crop | ✅ |
| PHASE 11 | أدوات الدقة + الختام: Scale tool (K) + Deep select (⌘نقرة) + قياس المسافات (alt+تحويم) + حزمة تسليم | ✅ |

> **المراحل 0 ← 11 كلها مغلقة.** المنفذ الكامل جاهز.

## سجل التحقق
- Baseline (قبل PHASE 1): tsc ✅ / lint ✅ / build ✅
- PHASE 1: tsc ✅ / lint ✅
- PHASE 2: tsc ✅ / lint ✅ (على كل الملفات المُنشأة والمُعدّلة)
- PHASE 3: tsc ✅ / lint ✅
- PHASE 4: tsc ✅ / lint ✅ (كامل src/)
- **نهائي (بعد 1→4): tsc صفر أخطاء ✅ / eslint صفر أخطاء ✅ / `next build` ناجح ✅ (10 مسارات)**
- اختبار دخاني فعلي (scripts/smoke_phase.sh فوق خادم الإنتاج 3113):
  الصفحة 200 ✅ — إنشاء مشروع/عنصر ✅ — **PUT whitelist: interactions تُحفظ والحقن (evilField) يُحجب ✅** — interactions تنجو من GET round-trip ✅ — SSE حي ✅
- **PHASE 5**: tsc صفر أخطاء ✅ / eslint صفر أخطاء ✅ / `next build` ناجح **مع فحص TypeScript مفروضاً على مستوى البناء** (أُزيل `ignoreBuildErrors` — سجل البناء يظهر "Running TypeScript... Finished") ✅ — دخان كامل 7/7 على البناء الجديد ✅ — لقطات متصفح موثقة (4 لقطات مع تحقق VLM) ✅
- **PHASE 7→11 (هذه الجلسة)**: بعد اكتشاف فقدان بيئة ثالث (القرص كان عند PHASE 6 فقط: boolean-ops.ts + لقطات p6 — لا أثر للـ7/8 رغم ذكر ملخص الجلسة السابقة) نُفّذت 7←11 تسلسلياً وفق قاعدة 008:
  - tsc صفر أخطاء ✅ / eslint صفر أخطاء (كامل src/) ✅ / `next build` ناجح (9 مسارات، فحص TS مفروض) ✅
  - تحقق حي بالمتصفح + VLM للقطات: p7-styles ✅ — p8-layoutgrids ✅ — p8-viewoptions ✅ (بعد إصلاح موضع النافذة: bottom-9 لأن الشريط سفلي) — p8-pixelgrid @447% ✅ — p9-constraints ✅ — p10-text ✅ (VLM للوحة + DOM للتحويل UPPERCASE وخطوط الشطب 11 خطاً) — p11-scale ✅ — p11-distances ✅
  - سكربتات: scripts/capture_p7_11.sh + retake_p9.sh + retake_p8vo.sh + retake_p11dist.sh + capture_p8pixel.sh + debug_p10.sh

## ما نُفّذ بالتفصيل (هذه الجلسة)
- **PHASE 1**: نظام tokens كامل في globals.css (5 ramps × 10 درجات حول مراسٍ مؤكدة + دلالية UI3 + طباعة 450/550 + radius 2/5/13 + spacers 4-40 + elevation 100-500) — خطوط Inter/Roboto Mono عبر next/font — أزرار أدوات 32×32 + شريط pill 48px بظل 400 — لوحات 241/320px مرتكزة بالبكسل (قابلة للتحجيم) — صفوف طبقات 28px
- **PHASE 2**: نموذج Interaction كامل (5 محفزات + 5 أفعال + 8 حركات + 9 easings) — محرك transitions (cubic-beziers مسماة) — smart-animate بمطابقة المسار الاسمي + diff — FrameRenderer إنتاجي — مشغّل ملء الشاشة (click/hover/drag/keypress/delay، overlays بخلفيات، back، Esc/R) — InteractionsPanel حقيقي حلّ محل الواجهة الوهمية — زر ▶ يعمل — إصلاح خلل فقدان بيانات normalizeServerElement (كان يسقط fills/effects/interactions عبر SSE) — مشهد عرض توضيحي Home→Detail بـ smart-animate
- **PHASE 3**: `export.ts` موحّد: PNG (html-to-image)، JPG/WEBP (re-encode عبر canvas.toBlob بخلفية بيضاء للـJPG)، SVG (serializer مع namespace)، PDF (jsPDF باتجاه تلقائي) — تصدير عنصر مفرد بشجاعة كاملة (renderTree DOM يغطي كل الأنواع) — ExportPanel: 5 صيغ + مقياس 1/2/4x + منزلق جودة لـJPG/WEBP — قائمة TopBar: 5 أوامر تصدير
- **PHASE 4**: منتقي صور (dataURL → fill صورة بأبعاد طبيعية مقيّدة 640px) — SvgImport عبر DOMParser (rect/circle/ellipse/line/polygon/polyline/path بتقطيع getPointAtLength + text + image + مجموعات متداخلة + viewBox scaling + حل التدرجات بأول لون) — استيراد مشروع JSON (تحقق صارم + وضعا استبدال/دمج مع توليد معرفات) — قائمة Import في TopBar — إفلات موحّد على الكانفس يوجّه حسب النوع عند نقطة الإفلات
- **PHASE 5**: حذف مسار سقالة `src/app/api/route.ts` (Hello-world ميت — لا مراجع له) — `mcp-config.json` بمسار نسبي محمول بدل مسار ويندوز المؤلف الأصلي — إزالة `ignoreBuildErrors` من next.config.ts (البناء يفرض فحص TS الآن) — README.md/README.ar.md: قسم "What's new in v0.2.0" + تصحيح ادعاء "dist مبني مسبقاً" (غير صحيح) + ميزات المراحل 1-4 + أرقام دقيقة (8 مسارات API، ~2600 سطر store) — حزمة تسليم أرشيف مصدر

## ما نُفّذ بالتفصيل (جلسة المراحل 7←11)
- **PHASE 7 (الأنماط)**: `lib/styles.ts` (ProjectStyle: paint/text/effect + applyStyleUpdates/detachStyleUpdates + countStyleUsage) — حقول مرجعية على العنصر (fillStyleId/strokeStyleId/textStyleId/effectStyleId) — إجراءات store (createStyleFromElement/applyStyleToSelection/detachStyleFromSelection/updateStyle مع إعادة بث للعناصر المرجعية بعمق/renameStyle/deleteStyle/loadStyles) — StylesPanel في تبويب Assets (swatch + عدّاد استخدام + إعادة تسمية بنقرة مزدوجة + فصل/حذف) — قائمة الأنماط (four-dots) في ترويسات Fill/Stroke/Text/Effects في PropertiesPanel — الأنماط تركب نقل المشروع الكامل (pushProjectToServer + loadServerProject/applyRemoteProject) + whitelist PUT للعنصر
- **PHASE 8 (شبكات التخطيط والعرض)**: `lib/layout-grids.ts` (LayoutGrid: columns/rows/grid × stretch/center/start/end/min/max + computeGridRects + وحدات المساطر px/in/cm/mm @DPI 72 + rulerTickSteps تكيفي) — LayoutGridsPanel (عدّ/فراغ/هامش/حجم مسار/لون/رؤية لكل شبكة + إضافة Columns/Rows/Grid) — FrameGrids يرسم شبكات كل إطار (حل محل التراكب 12-عموداً المُصلّب) — شبكة بكسل تظهر ≥400% فقط (⌘') — snap-to-pixels خيار عرض يؤثر فعلياً على السحب والتحجيم (⇧⌘') — ViewOptionsPopup (فوق الشريط السفلي) — ترقية المساطر بالوحدات وخطوات تكيفية — اختصارات: ⌘' بكسل / ⌘\ شبكات تخطيط / ⌘⇧; شبكة نقطية
- **PHASE 9 (القيود)**: `lib/constraints.ts` (inferConstraints من موضع الإنشاء + constrainChild/constrainChildren بفضاء إحداثيات الأب) — إجراء resizeFrameWithConstraints يُستدعى من مقابض التحجيم (RAF) واللوحة الرقمية — الاستنتاج التلقائي عند الإنشاء/الإسقاط داخل إطار (addElement + moveElementToFrame) مع علامة constraintsEdited تحمي التعديل اليدوي — منتقي 9 مربعات بصري + قوائم Left/Right/Center/Left&Right و Top/Bottom/Center/Top&Bottom — القسم يظهر فقط لأبناء إطار/مجموعة
- **PHASE 10 (عمق النص والطلاء)**: `lib/text-measure.ts` (قياس canvas 2D حقيقي بـctx.measureText + wrapText جشّاء + applyTextCase) — textAutoResize: fixed/hug (تغليف عرض)/grow (التفاف على العرض) مفعّل عند الإنشاء الافتراضي grow + عند التحرير (InlineTextEditor) + عند تغيير خصائص الخط — textCase original/upper/lower/title — شطب يدوي بخط SVG (دعم line-through متقلب) — أنماط صورة fill(cover)/fit(contain)/crop(مقياس+إزاحة يدوية) في generateSVGDefs + واجهة في FillLayerItem
- **PHASE 11 (أدوات الدقة + الختام)**: `lib/scale-element.ts` (تحجيم متسق لكل شيء: هندسة/حواف/خط/مسارات متجهية/تأثيرات/حشوات auto-layout + أبناء تكرارياً) — أداة Scale (K) في قائمة المزيد بالشريط: مقابض زوايا bbox أي كان عدد المحدد، مرساة الزاوية المقابلة، Shift=خطوات 0.1، لقطة أصلية بلا انجراف — Deep select (⌘نقرة) عبر findElementAtPosition(deep) لأعمق عنصر — قياس المسافات (alt+تحويم): فجوات أفقية عند تراكب عمودي والعكس + فجوات قطرية، خطوط وردية بوسوم بكسل
