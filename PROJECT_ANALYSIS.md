# PROJECT_ANALYSIS — openfigma × Figma UI3 port
> الحالة: **مُعاد بناؤه** (REBUILT) بعد فقدان بيئة التشغيل. المصدر المرجعي المُستخرج منه `port-source/figmajsx/` **مفقود (LOST-SOURCE)** — البيانات أدناه من نتائج الاستخراج الموثقة في جلسة PHASE 0 الأصلية (1,281 متغير CSS من مصدر حقيقي 7.7MB JS + 3.7MB CSS + 253 chunk).

## 1) مصدر النقل (reference — LOST-SOURCE)
- أصول Figma web UI3: core JS 7.7MB + CSS 3.7MB + 253 chunks (chunk 3835 = 12.7MB محرك واجهة المحرر)
- قرار DECISION-001: **قراءة مرجعية فقط — لا نسخ كود**. النقل ثلاث طبقات: قيم token حرفية + بنية UI + سلوك وظيفي.

## 2) نظام التصميم المستخرج (PHASE 0 — verified anchors)
- **242 لون ramp / 15 تدرّجاً** لكل عائلة، من أصل 1,281 متغير CSS. المراسي المؤكدة:
  - blue-500 `#0D99FF` — purple-500 `#9747FF` — red-500 `#F24822` — green-500 `#14AE5C`
  - grey-800 `#2C2C2C` (سطح الشريط العائم) — حدود `#383838` — hover `#3C3C3C` — سطح لوحة `#1E1E1E`
  - component-purple `#A259FF` (السطر المرجعي موجود في `createDefaultElement`)
- **80 typography token**: body-medium = 11px/16px، Inter أوزان 450/550 (ليست 400/500)، Roboto Mono للأرقام/الكود
- **radius**: 2 / 5 / 13 / full — **spacers**: 4→40 — **elevation**: 100→500
- ملاحظة هندسية: قيم المراسي أعلاه مؤكدة من جلسة الاستخراج؛ درجات ramp الكاملة (×15) ستُولَّد خوارزمياً حول المراسي (مسار داكن→فاتح) لأن المصدر مفقود — موثّق كـ REGENERATED وليس منسوخاً.

## 3) أبعاد UI3 المؤكدة
| عنصر | القيمة |
|---|---|
| أزرار الأدوات | **32×32** hit-target، أيقونة 16px |
| الشريط العائم السفلي | pill 48px داخلياً (قياس 80px في اللقطة شمل الظل والقائمة المنسدلة) |
| اللوحة اليسرى | **241px** |
| اللوحة اليمنى | **320px** |
| صف الطبقات | **28px** |

## 4) حالة openfigma الحالية (baseline after Task-5 old worklog)
- 17 مكون محرر + 6 hooks في `canvas/` (تقسيم P4 منجز) + 5 مكونات ui + 9 مسارات API (منها SSE `/events`)
- مزامنة حية SSE منجزة (Task 3 قديم) — نقاء تبعيات منجز (Task 4 قديم: 23 حزمة)
- `editor-store.ts` 2,290 سطراً: نموذج DesignElement غني (VectorNetwork، Component Variants، AutoLayout، Effects)
- خطوط حالية: Geist/Geist_Mono — ستُستبدل بـ Inter/Roboto Mono

## 5) مصفوفة الفجوات GAP
| # | الفجوة | الحالة |
|---|---|---|
| G1 | tokens غير موجودة (globals.css قالب أصلي 212 سطراً) | PHASE 1 |
| G2 | أبعاد UI3 للأشرطة/اللوحات غير مطبقة | PHASE 1 |
| G3 | لا يوجد نظام Prototype حقيقي (تبويب فارغ) | PHASE 2 |
| G4 | تصدير PNG/SVG/PDF بدائي؛ لا JPG/WEBP ولا إعدادات | PHASE 3 |
| G5 | استيراد محدود (لا منتقي صور، لا SVG parser، لا JSON مشروع) | PHASE 4 |
| G6 | تفاصيل UI3 الدقيقة (كثافة، مسافات) | مستمر |
