# PORT-PLAN 12→16 — النقل الكامل (complete port)
> الأساس: port-source/analysis/phase12_16_gap_analysis.md (استخراج حرفي من المصدر المستعاد 9awtas.zip).
> القاعدة: كل مرحلة = استخراج → مقارنة → تنفيذ → tsc/eslint/build صفر أخطاء → متصفح حي + لقطات VLM إلى
> download/openfigma-pN-*.png → تحديث PROGRESS/WORKLOG/worklog → git commit + bundle في download/.

| المرحلة | النطاق | الأدلة |
|---|---|---|
| **12** | **Auto Layout كامل**: WRAP + أحجام FIXED/HUG/FILL (primaryAxisSizing/counterAxisSizing للإطار + layoutSizing للأبناء) + min/max width/height + محاذاة counter-axis منفصلة + أبناء absolute-positioned + لوحة UI بتعادل Figma (اتجاه/فراغات/حواشي 4/محاذاة محورين/قوائم sizing/wrap) + تفعيل المحرك عند كل التحجيمات | WRAP 14 / FILL 81 / HUG 8 / FIXED 18 |
| **13** | **نص متقدم**: textAlignVertical (top/middle/bottom) في الرندر واللوحة + textAlign justified (زر رابع) + قوائم listType ordered/unordered (ترقيم/نقاط تلقائية في الرندر + مسافة بادئة) + تحقق تعادل decoration | TOP 33/BOTTOM 35/JUSTIFIED 12/ordered 12 |
| **14** | **تدرجات كاملة**: نوعا angular (conic) و diamond في النموذج (FillStyle) + محرر GradientEditor (منتقي نوع 4 + مقابض) + رندر Canvas (angular: توليد مسار SVG متعدد القطاعات؛ diamond: 4 مثلثات بتدرجات خطية) + تصدير يتماشى | DIAMOND 8 / LINEAR 33 / RADIAL 4 |
| **15** | **Section + Table + Sticky**: نوع section (حاوية بتسمية علوية وخلفية tint وclip) + نوع table (صفوف/أعمدة/خلايا نصية، سحب تغيير عرض عمود/ارتفاع صف، خلية رأس) + نوع sticky (ملاحظة بخلفية ملونة وزاوية مطوية) — أدوات في Toolbar + خصائص لكل نوع | SECTION 116 / TABLE 58 / STICKY 52 |
| **16** | **تعليقات + دقة ختامية**: أداة comment فعالة (دبابيس على الكانفس + خيوط رد + resolve + تخزين/نقل/whitelist) + محفزات منفصلة mouse-enter/leave/down/up (بدل hover المظلة) + Shift+1 zoom-to-fit و Shift+0 100% + cornerSmoothing (حقل + منزلق + رندر بيزييه) + مسح نهائي وحزمة تسليم v0.4.0 | MOUSE_* ×11 + cornerSmoothing 9 |

## مستبعد عمداً (موثق في التحليل)
WIDGET (sandbox إضافات) — GAMEPAD/DIRECTIONAL (عتاد) — PASS_THROUGH (لا مقابل CSS).
