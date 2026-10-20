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
| PHASE 12 | Auto Layout كامل: WRAP + أحجام FIXED/HUG/FILL (إطار+أبناء) + min/max + محاذاة counter منفصلة + baseline + أبناء absolute + reorder-on-drop + لوحة UI بتعادل Figma | ✅ |
| PHASE 13 | نص متقدم: محاذاة عمودية top/middle/bottom + justified (توزيع كلمات فعلي) + قوائم ordered/unordered بمسافة بادئة معلّقة + إصلاح أمني (whitelist موحّد POST/PUT) | ✅ |
| PHASE 14 | تدرجات كاملة: Angular (مخروطي بقطاعات فعلية) + Diamond (مقياس |dx|+|dy| رباعي الأرباع بدقة متجهية) + إصلاح خلل كامن في فهرسة أنماط التعبئة (العنصر الثاني بتدرج/صورة لم يكن يُرسم) | ✅ |
| PHASE 15 | عناصر جديدة: Section (حاوية بتسمية علوية + children) + Table (نموذج صفوف/أعمدة/خلايا مع تحرير خلية بنقرة مزدوجة وإضافة/حذف صفوف/أعمدة ورأس مظلل) + Sticky (ملاحظة بزاوية مطوية) — أدوات + اختصارات Shift+S/T/N | ✅ |
| PHASE 16 | الختام: نظام تعليقات كامل (دبابيس + خيوط + ردود + resolve + نقل عبر المشروع) + محفزات منفصلة mouse-enter/leave/down/up + Shift+1/0 تكبير + cornerSmoothing (منزلق + مسار بيزييه) + حزمة تسليم v0.4.0 | ✅ |

> **المراحل 0 ← 16 كلها مغلقة — النقل الكامل مكتمل (12←16 فوق 0←11).** خطة النقل الكامل: PORT-PLAN-12-16.md (12✅ ← 16).

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

## PHASE 12 — تفصيل التنفيذ والتحقق (2026-10-20)
- **المحرك** `lib/auto-layout.ts` أعيد بناؤه بالكامل: `computeAutoLayout` يرجع children + حجم الإطار النهائي. يدعم: wrap متعدد الأسطر (counterAxisGap + counterAxisAlignContent)، أحجام الإطار primaryAxisSizing/counterAxisSizing (fixed/hug/fill)، أحجام الأبناء layoutSizingH/V (fixed/hug/fill — fill موزّع بالتساوي على المحور الرئيسي، hug للنص عبر قياس canvas حقيقي وللإطارات المتداخلة تكرارياً)، محاذاة baseline للنص، أبناء absolute خارج التدفق، قيود minWidth/maxWidth/minHeight/maxHeight على الإطار والأبناء، وتوافق legacy مع alignItems=stretch.
- **النموذج** store: AutoLayout + wrap/counterAxisGap/counterAxisAlignContent/primaryAxisSizing/counterAxisSizing + DesignElement + layoutSizingH/layoutSizingV/layoutPositioning/min-max. إجراءات جديدة: syncAutoLayoutTree/syncAutoLayoutFrame/reorderChild. updateElement يدمج المحرك (applyAutoLayoutSync على سلسلة الأسلاف) ويحوّل hug→fixed عند التحجيم اليدوي (بلا كبس للقادم الجديد). إضافات على addElement/delete/deleteSelected/moveElementToFrame/reorderElement (reorder يعمل الآن للأبناء أيضاً).
- **التفاعل**: reorder-on-drop داخل إطارات auto layout (مؤشر الإسقاط يحدد الفهرسة على محور التخطيط) في use-element-interactions.
- **الواجهة**: لوحة Auto Layout بتعادل Figma (اتجاه أسهم + wrap + محاذاة محورين أيقونات + gap + حشوات + صفوف Size: W/H fixed/hug/fill) + قسم Layout Sizing للأبناء (W/H selects + زر absolute + min/max) في PropertiesPanel.
- **النقل**: whitelist PUT بكل الحقول الجديدة (round-trip مؤكد مع حجب evilField) + normalizeServerElement يمررها (spread).
- **التحقق**: tsc صفر / eslint صفر / next build ناجح. حي بالمتصفح عبر خطاف اختبار window.__openfigma: hug×hug (96×108 مطابقة تامة)، fill عرضي (80=96-16 ثم 184=200-16)، wrap بفجوة صفوف (H=102، سطران، نص hug مقاس 50px)، min/max (150→180)، reorder (B للأمام)، absolute (خارج التدفق بموضع يدوي). VLM أكّد: إطار ملتف على المحتوى + سطرا wrap مرئيان + لوحة AL كاملة. لقطات: download/openfigma-p12-{hug,fill,wrap,child-sizing,absolute}.png
- **إصلاح أثناء التحقق**: خلل كبس autoLayout في updateElement (كان يستبدل القادم بالقديم عند تحجيم hug) — أُصلح على الوارد الجديد.
- **بنية**: `npm run build` ينسخ static إلى standalone (شغّل البناء به دائماً لا `npx next build` مباشرة) — خلل 404 chunks كُشف عبر خطاف الاختبار.

## PHASE 13 — تفصيل التنفيذ والتحقق (2026-10-20)
- **buildTextLines** (lib/text-measure.ts): بناء أسطر واعٍ بالقوائم — كل فقرة = عنصر قائمة، بادئة •/رقم بمسافة بادئة معلّقة (الأسطر الملتفة تصطف تحت النص لا تحت البادئة)، أوضاع hug/grow محترمة.
- **النموذج**: textAlignVertical (top/middle/bottom) + listType (none/ordered/unordered) + listIndent. applyTextAutoSize أصبح واعياً بالقوائم (الارتفاع/العرض hug يطابق الرندر).
- **الرندر** (Canvas + FrameRenderer بتعادل): محاذاة عمودية حقيقية (إزاحة السطر الأول top=0/middle/bottom)، justified بتوزيع كلمات فعلي عبر العرض (آخر سطر يبقى يساراً)، بادئات القوائم + مسافة معلّقة، ضبط الشطب والمحاذاة center/right مع القوائم.
- **UI**: أزرار V-Align الثلاثة + أزرار List (—/•/1.) + حقل Indent يظهر عند تفعيل القائمة. زر justified الرابع كان موجوداً.
- **إصلاح أمني (عيب قديم كُشف بالتحقق)**: مسار POST للعناصر كان ينشر جسم العميل خاماً بلا whitelist (PUT فقط كان محمياً) — أُنشئ src/lib/element-whitelist.ts كمصدر واحد للقائمتين، مع تكريم id العميل (تعتمد عليه اختبارات الدخان وMCP).
- **التحقق**: tsc/eslint/build صفر. API round-trip للحقول الثلاثة + justified مع حجب evilField على POST وPUT. حي بالمتصفح: أعلى y=18 مقابل أسفل y=102 (دقة كاملة)، قائمة مرقمة 1./2./3. بمسافة معلّقة (بادئة x=12، نص x=30/33)، نقاط •، justified موزّع (First@0/line@105/of@203/text@288). VLM أكّد القائمة المرقمة وأزرار V-Align/List. لقطات: download/openfigma-p13-{valign-bottom,list-ordered,justified}.png

## PHASE 14 — تفصيل التنفيذ والتحقق (2026-10-20)
- **lib/gradient-paints.tsx**: AngularPatternContent (قطاعات دائرية حول المركز، إزاحة stop تُخطط لمسح 0→360° بدوران gradientAngle، ألوان مُستوفاة بين النقاط) + DiamondPatternContent (مقياس Figma |dx|+|dy| خطي داخل كل رُبيع محورى → 4 مستطيلات رباعية بتدرجات خطية 45° نحو الزوايا — مطابقة قِياسية للماس) + mixHex/colorAt + معاينات CSS.
- **النموذج**: FillStyle.type += 'angular-gradient' | 'diamond-gradient'.
- **الرندر**: Canvas generateSVGDefs + getFillForElement + FrameRenderer (fillOf + ElementDefs) — الأنماط بـ patternUnits وpatternContentUnits معاً objectBoundingBox.
- **UI**: خيارا Angular/Diamond في منتقي نوع التعبئة + معاينة العيّنة عبر gradientPreviewCSS (conic للـangular).
- **إصلاح خلل كامن (كُشف بالتحقق الحي)**: معرّفات أنماط التدرج/الصورة كانت تستخدم عدّاداً شاملاً بينما getFillForElement يحلّ بفهرس التعبئة داخل مصفوفة fills — أي عنصر ثانٍ بتدرج/صورة كان يُرسم بلا تعبئة (مرجع لمعرّف غير موجود). أُصلح بفهرس لكل عنصر.
- **إصلاح ثانٍ**: تدرجات userSpaceOnUse داخل أنماط objectBoundingBox لا تُحل في Chromium — استُبدلت بـobjectBoundingBox نسبةً لصندوق كل رُباع.
- **التحقق**: tsc/eslint/build صفر. حي: نمط angular بـ30 قطاعاً (أول لون مُستوفى #ea4b29)، نمط diamond بأربعة مستطيلات + 4 تدرجات، كلا العنصرين بملء url(#grad-*-0) متطابق، تبديل النوع والزاوية يثبت. بكسلياً: مركز الماس (133,65,218) بنفسجي، الزاوية (239,208,25) أصفر (#F5D90A=(245,217,10)). VLM أكّد المربعين. لقطة: download/openfigma-p14-gradients.png

## PHASE 15 — تفصيل التنفيذ والتحقق (2026-10-20)
- **النموذج**: ElementType/ToolType += section/table/sticky + tableData (colWidths/rowHeights/cells/headerRow) + إجراءات store: updateTableCell/addTableRow/removeTableRow/addTableColumn/removeTableColumn/resizeTableColumn/resizeTableRow (كلها تُعيد اشتقاق width/height من مجاميع الأبعاد) + افتراضات الإنشاء (قسم أزرق فاتح 480×360 بزاوية 12، جدول 3×3 برأس، ملاحظة صفراء 200×160).
- **Section**: حاوية كاملة — توسيع كل فحوصات frame/group (children/clip/drop-into/move-to/hit/نقل المشروع) لتشمل section + تسمية فوق الحدود + أيقونة SquareDashed بأداة رئيسية (Shift+S).
- **Table**: رندر شبكي (خطوط أعمدة/صفوف + رأس مظلل + نصوص خلايا 12px) في Canvas وFrameRenderer + تحرير خلية بنقرة مزدوجة (حساب الصف/العمود من النقطة المحلية + محرر input فوق الخلية، Enter/blur يحفظ، Esc يلغي) + لوحة Table في Properties (عدادات + أزرار +/- صف/عمود + مفتاح Header + مدخلات عرض كل عمود وارتفاع كل صف).
- **Sticky**: بطاقة ملونة بزاوية مطوية + نص أعلى-يسار + تحرير النص بنقرة مزدوجة عبر InlineTextEditor.
- **أدوات**: Table/Sticky في قائمة المزيد بأدوات الأشكال (Shift+T/Shift+N) + Section في المجموعة الرئيسية + تسميات LayerPanel.
- **النقل**: tableData في whitelist (round-trip مؤكد).
- **التحقق**: tsc/eslint/build صفر. API: قسم بابن + جدول ببياناته + ملاحظة — كلها تُخزَّن وتُسترجع. حي: تسمية القسم y=-8 فوق الحدود والابن داخل، 9 نصوص خلايا + 4 خطوط شبكة + مستطيل رأس، bg+fold+نص الملاحظة، +عمود (cols 4, w 560, خلايا 4)، +صف (rows 4, h 176 = 44×4)، تحرير خلية $15، Shift+S يفعل أداة القسم، Table/Sticky في قائمة المزيد. VLM أكّد الثلاثة. لقطات: download/openfigma-p15-{elements,table-controls}.png

## PHASE 16 — تفصيل التنفيذ والتحقق (2026-10-20)
- **cornerSmoothing** (0-100%): lib/smooth-corners.ts يبني كل زاوية كبيزييه تكعيبية — معامل المقبض 0.5523 (قوس دائري تام) عند 0% يمتد حتى ~1.29 عند 100% (تقريب Figma squircle) — يُرسم كـ<path> للمستطيلات/الإطارات ذات أنصاف أقطار + منزلق في لوحة Corner Radius + whitelist.
- **اختصارات التكبير**: Shift+1 ملاءمة الشاشة، Shift+0 تكبير 100%، Shift+2 تحديد (إضافة لموجود ⌘).
- **محفزات منفصلة** (المصدر: MOUSE_ENTER/LEAVE/DOWN/UP ×11): أنواع mouse-enter/mouse-leave/mouse-down/mouse-up (hover يبقى كاسم قديم) + FrameRenderer يبث أحداث enter/leave/down/up عبر onElementEvent + المشغّل يفلتر المحفز المطابق + تسميات في منتقي المحفزات.
- **نظام التعليقات**: CommentPin (id/x/y/resolved/messages) + إجراءات store (add/reply/toggleResolve/delete/setActive/openComposer/closeComposer/loadComments) + أداة comment تنقر لفتح مؤلف التعليق عند النقطة + دبابيس مرقمة (أزرق/أخضر للمحلول) + خيط منبثق (ردود + Resolve + Delete) + نقل كامل عبر PUT/GET المشروع (pushProjectToServer + normalizeServerProject + loadServerProject).
- **التحقق**: tsc/eslint/build صفر. حي: مستطيل smoothing=80 يُرسم كمسار ببيزييه (C 123.44 0 160 36.56 160 32) بينما العادي يبقى <rect>، Shift+0 → 100%، أداة التعليق → مؤلف → نشر → دبوس برقم 1 → خيط → رد "Reply from teammate" → resolved=true، محفز mouse-enter يُخزَّن، تعليقات المشروع تُدرج في PUT/GET. VLM أكّد الفرق البصري للتنعيم. لقطات: download/openfigma-p16-{corner-smoothing,comments}.png

> **النقل الكامل مكتمل** — المراحل 0←16: نظام تصميم UI3 + بروتوتايب + تصدير/استيراد + عمليات منطقية/أقنعة + أنماط + شبكات/مساطر + قيود + عمق نص ×2 + أدوات دقة + Auto Layout كامل + نص متقدم + تدرجات كاملة + Section/Table/Sticky + تعليقات/تنعيم/محفزات.

## PHASE 17 — تفصيل التنفيذ والتحقق (2026-10-20)
- **السياق**: تدقيق جديد شامل بعد استرداد البيئة (audit/audit_report.md + round-2) — 21 فجوة مثبتة عبر 6 مراحل (PORT-PLAN-17-22.md)؛ هذه أولها.
- **إصلاح عيب كامن من المرحلة 6 (مُثبت حيًا)**: المجموعات المنطقية كانت تُعرض كمستطيل bbox بملء المعامل الأول — بلا أبناء ولا تركيب (case 'boolean' في Canvas يسقط لـrect؛ FrameRenderer بلا حالة boolean أصلًا). أُصلح: getBooleanGroupContours (طبخ هندسة Greiner-Hormann + كاش WeakMap) وbooleanGroupPathD — تعرض في Canvas وFrameRenderer والتصدير كمسار حقيقي evenodd.
- **P1 Pattern paint**: نوع ملء 'pattern' — بلاطة صورة تتكرر (tile = الحجم الطبيعي × patternScale) عبر <pattern patternUnits="userSpaceOnUse"> — بدلالة المصدر حرفيًا (9456/3835: width=imgW*scalingFactor + <image>). قياس طبيعي غير متزامن (new Image()) يُخزن patternW/H — URL + مقياس البلاطة في اللوحة + خيار في قائمة نوع الملء + defs/resolve/تصدير.
- **P2 Outline stroke** (الأمر 233): lib/outline-stroke.ts — أخذ عينات getPointAtLength بمماسات، حلقة خارجية +w/2 وداخلية −w/2 على العمودي، تبسيط Douglas-Peucker (موجود أصلًا)، مفتوح=شريط واحد مغلق / مغلق=حلقتان evenodd → عنصر path يحمل booleanContours، الملء=لون الحد الأصلي، الحد يُزال. مدخلا قائمة السياق + إجراء store.
- **P3 Flatten** (FLATTEN_SELECTION): خبز المجموعة الحية إلى عنصر path ثابت بنفس الهندسة (نفس getBooleanGroupContours) — children تُزال، booleanOperation/SourceIds تُمسح. قائمة السياق + إجراء.
- **P4 Arc tool** (arcToolStart/Sweep/Ratio + CREATE_ARC=231): lib/arc.ts — بداية(درجات)/مدى(±)/نسبة داخلية 0..1؛ مكافئ الدلالات: sweep≥360+ratio>0=دونات كاملة (حلقتان evenodd)، ratio=0=قطاع، وإلا مسار قوس خارجي + داخلي معكوس. قسم Arc في اللوحة (منزلقات + مدخلات + زر Full ellipse) للقطوع الناقصة؛ الرندر arc-aware في Canvas/FrameRenderer/الأقنعة/التصدير.
- **whitelist**: + arc (fills تحمل حقول النمط داخليها) — round-trip API سليم.
- **التحقق**: tsc صفر / eslint صفر / next build ناجح (rm -rf .next كامل بعد اكتشاف كاش webpack فاسد من حقبة ما قبل الاسترداد). حي بالمتصفح (أدلة DOM): union يُعرض <path> بهندسة مخبوزة (boolHasPath:true)، flatten → typeAfter:'path'+contours:true+childrenAfter:0، outline → fill=#9C27B0 (لون الحد) وحلقتان [33,33]، القوس → <path> donut (خارجي r=110 + داخلي r=49.5=110×0.45)، النمط → fill=url(#pat-p1-0) وبلاطة width=20 (40 طبيعي × 0.5). VLM أكّد 4/4 (union مدمج، حلقة أرجوانية، donut كهرماني، لوح قرمادي متكرر). لقطة: download/openfigma-p17-1-live-verify.png

## PHASE 18 — تفصيل التنفيذ والتحقق (2026-10-20)
- **V5 دخول التحرير المتجهي للأشكال البارامترية** (المصدر: isVectorEditMode/vectorEditableNodeCount): lib/shape-to-vector.ts — تحويل عند الدخول (نقرة مزدوجة أو Enter) مع الحفاظ على المعرف/الطلاء/التحويل: قطع ناقصة → **بيزييه 4 قطع مضبوطة** (kappa 0.5522848، 4 رؤوس بمماسات نسبية = تمثيل دائري تام)، مستطيل بزوايا دائرية → **8 مراسي** (2/زاوية) بأقواس kappa·r، مضلع/نجمة → رؤوس مستقيمة، خط/سهم → شبكة مفتوحة من رأسين، قطوع ناقصة ببيانات arc → عينات مقوّسة (DP tol 0.6). مسار الدخول: dblclick في use-element-interactions + Enter في use-canvas-keyboard (كلاهما يستدعي convertShapeToVector ثم setEditingPathId) — تحرير المراسي/المقابض موجود أصلًا (use-path-editing).
- **split vector network** (المصدر: break-vector-network-into-paths / fullscreen_actions.split_vector): splitVectorSelection — مسارات متعددة الأ contours (نتائج flatten/outline) → عنصر مسار لكل contour (vectorNetwork مستقل، نفس الطلاء)؛ مدخل قائمة سياق Split Vector بشرط booleanContours>1.
- **التحقق**: tsc/eslint/build صفر. حي بالبيانات: قطع ناقصة → path(v4, 4 مقابض بيزييه)؛ مستطيل دائري → path(v8, 4 أقواس زوايا)؛ exclude دائرتين → flatten → **contours=2** → split → **pathElements: 2×path(v48)** كل منها بشبكة مستقلة. عرض exclude حسمًا بكسليًا: مركز العدسة (نقطة التقاطع) فارغ 0/900 وردية داخل سحابة 21274 بكسل وردية — هلالان بعضاهما. لقطات: openfigma-p18-{vector,exclude}.png
- **ملاحظة توثيقية صادقة**: ربط حدث dblclick/Enter مُنفّذ ومُدقّق بالنوع؛ التحقق الحي على مستوى الفعل قاطع؛ أتمتة حدث dblclick الاصطناعي في المتصفح كانت متذبذبة هذه الجولة (أثر إحداثيات العينة) — الحدث الحقيقي سيقوم بالتحويل بنفس المسار المُتحقق منه (نفس الاستدعاء).

## PHASE 19 — تفصيل التنفيذ والتحقق (2026-10-20)
- **T6 النص على مسار** (المصدر: vectors.text_on_path_tool_announcement): نموذج {onPathId, pathOffset} على عنصر النص + lib/text-on-path.ts (هندسة الهدف بتحويله إلى فضاء النص: إزاحة + دوران) + رندر <textPath startOffset> في Canvas وFrameRenderer — الهدف: path (بما فيه مسارات القلم) أو ellipse (مع arc) أو line/arrow. محرر في اللوحة: منتقي أهداف (كل العناصر المؤهلة) + منزلق إزاحة 0..1 + إزالة.
- **T7 روابط نصية** (المصدر: علامة HYPERLINK في 1517-f945): نموذج links: {start,end,url}[] + buildTextLines أُثري بـcontentStart (wrapTextRanges الجديدة تتبع المؤشرات المطلقة عبر الالتفاف — مرآة خوارزمية wrapText مع محاسبة فراغات) + رندر tspan مقيس بقياس canvas (أزرق #0D99FF + underline) في Canvas واللاعب، والنقر في المشغّل يفتح أول رابط (window.open noopener). محرر قوائم روابط في اللوحة (بداية/نهاية/رابط).
- **T8 الإيموجي** (المصدر: comments.emojiPicker + insertEmoji + علامة EMOJI): lib/emoji.ts (مجموعة محلية ~230 إيموجي في 5 فئات، بلا API خارجي) + مكوّن EmojiPickerButton (بحث + فئات + شبكة) في مؤلف التعليقات وزر إدراج في محتوى النص باللوحة.
- **T9 وضع وضع الصور** (المصدر: editMode PLACE_IMAGE + "toolbar-place-image: click or drag to place"): منتقي متعدد؛ عند >1 صورة يُفتح طابور وضع: نقرة = حجم طبيعي متمركز، سحب = ملاءمة مستطيل السحب ب сохранان النسبة، Esc = إلغاء البقية، إشعارات toast لكل خطوة. خطاف اختبار window.__openfigmaPlaceImages (نمط المرحلة 12).
- **whitelist** += onPathId/pathOffset/links.
- **التحقق**: tsc/eslint/build صفر. حي بالـDOM: textPath مع startOffset=10% وdefs تحمل مسار بيزييه؛ tspan رابط واحد نصه "Figma" (الأحرف 6-11) أزرق underline؛ **VLM أكّد**: نص يتبع المسار بمنحناه مع 🎨 بنهايته + "Figma" زرقاء مسطّرة ومقطع ✨ مرتبط (لقطة openfigma-p19-text.png). Esc ألغى الطابور حيًا (remaining 2→0). **توثيق صادق**: مسار click→place لم يُتحقق آليًا هذه الجلسة (العدادات أظهرت وصول الحدث لقمة handleMouseDown لكن فرع الأداة لم يسقط — قيد فتح للفحص اليدوي؛ الكود مُدقّق بالنوع ومُبنى).

## PHASE 20 — تفصيل التنفيذ والتحقق (2026-10-20)
- **PR13 نقاط بداية التدفق** (المصدر: getFlowStartingPoints + flowStartingPointNameInput): حالة flowStartingPoints + إجراءات إضافة/إزالة/إعادة تسمية + شارات "▶ الاسم" فوق الإطارات (نقر مزدوج = إدخال إعادة تسمية عائم + ✕ إزالة) + مدخل قائمة سياق للأطر + **أسبقية startPreview: أول نقطة بداية قبل الاختيار** (مكافئ getEffectivePrototypeStartNodeId) + نقل كامل عبر PUT/GET المشروع (body + ProjectState + normalize + load).
- **PR10 التمرير الثابت** (المصدر: scrollBehavior=FIXED_WHEN_CHILD_OF_SCROLLING_FRAME + isAncestorFixed): خاصية scrollBehavior على العناصر (زر Fixed باللوحة) + **وضع تمرير المشغّل**: إطار أطول من الشاشة بعد ملاءمة العرض → حاوية تمرير (playScale=widthFit) + طبقة عائمة فوقية للأبناء الثابتين فقط (مفصولة بطبقتي رندر) + FrameRenderer يدعم childFilter صريحاً (threading عبر renderFrameInternal/renderInteractive/TreeNode — بعد إثبات فشل متغير الوحدة مع الرسم الكسول لReact، وفشل السياق بقواعد hooks).
- **PR11 Change To** (المصدر: SWAP_STATE/CHANGE_TO): نوع إجراء جديد + منتقي أهداف (كل العقد) + خريطة swapMap محلية باللاعب (عرض شجرة محوّلة cloneWithNewIds — لا تلمس التصميم) + runInteraction(interaction, sourceEl) بتمرير المصدر من كل المحفزات (نقر/سحب/حوّم/لوحة مفاتيح/تأخير).
- **PR12 Scroll To** (المصدر: SCROLL_TO): إجراء + مشغّل تمرير سلس scrollTo (behavior smooth) إلى العقدة داخل الإطار (إزاحة مطلقة محسوبة عبر الشجرة).
- **النموذج**: PrototypeActionType += change-to/scroll-to + تسميات + لوحة التفاعلات (منتقي أهداف لكل منهما) + whitelist scrollBehavior.
- **التحقق (مُثبت حياً)**: شارة ▶ Flow 1 + **startPreview يبدأ من نقطة التدفق** (previewFrame=tall1)؛ حاوية تمرير scrollHeight=4533 (1400×widthFit)؛ **scroll-to بنقرة حقيقية عبر الطبقة التفاعلية → scrollTop=3247** (تمرير سلس لعقدة العمق)؛ إعادة تسمية النقطة (Flow 1→Checkout) حيةً. tsc/eslint/build صفر بعد 3 إصلاحات بنيوية (متغير وحدة→سياق→خاصية صريحة).
- **مفتوح (موثق بأدلة كاملة، يحتاج جلسة تالية)**: عزل طبقة الثوابت (C) — كلا الطبقتين تعرضان كل الأبناء رغم وصول threading للباقة (chunks-with-childFilter:1) وتطابق JSX الثابت مع التحليل؛ وتبديل change-to المرئي (E) — النقر عبر hitrect وصل لكن لا تبديل ظهر. المساران يشتركان في جذر واحد محتمل؛ مسار البحث مسجل في p20_verify.sh.
- لقطة: openfigma-p20-player.png
