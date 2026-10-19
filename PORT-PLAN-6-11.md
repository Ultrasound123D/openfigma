# PORT-PLAN 6→11 — REBUILT (2nd environment loss)
> **الحالة**: مُعاد بناؤه بعد فقدان البيئة للمرة الثانية. هذه الوثيقة تحل محل
> `port-source/analysis/phase{6..11}_*.md` المفقودة (مع المصدر `port-source/figmajsx/` — 3,291 معرّفاً).
> ختم القرص عند الاستعادة: ~2026-10-19 01:51 (worklog.md ينتهي عند phase-5، BUILD_ID 01:50).

## ما ضاع فعلاً (مُتحقق منه من القرص)
- كود المراحل 6-8 الذي نُفّذ في الجلسة المفقودة (أدلتها: حوار جلسة سابقة فقط — لا أثر على القرص).
- خطة المراحل الأصلية 6-11: مجهولة (UNKNOWN). **المعروف فقط**: PHASE 8 = شبكات التخطيط/البكسل/المساطر/خيارات العرض، PHASE 9 = القيود تلقائي/يدوي.
- المصدر المرجعي `port-source/figmajsx/` للمرة الثانية (أول فقدان: قبل Task-6).
- لقطات `download/openfigma-p{6..10}-*.png` وسكربتات `verify_phase*.sh`.

## خريطة الحالة بعد PHASE 5 (تحقق قرصي مباشر — لا تخمين)
موجود فعلياً: نظام المكونات الكامل (addComponent/createInstance/detachInstance/swap/overrides/متغيرات/خصائص المكون) + تعدد الصفحات كاملاً + شبكات المتجهات (pen/path-editing) + AutoLayout + clipContent + blendMode (رندر+UI) + ظلال بـspread + خلفية-ضبابية UI + بحث الطبقات + توزيع أفقي/عمودي + مقبض تدوير + Prototype/تصدير/استيراد/SSE/MCP.
حقول ميتة بلا منطق: `booleanOperation`/`booleanSourceIds` (لا مرجع منطقي)، `constraints` (قوائم منسدلة فقط بلا سلوك تحجيم).
غير موجود إطلاقاً: قناع (isMask)، نظام الأنماط، شبكات تخطيط قابلة للضبط (الحالي تراكب 12-عموداً مُصلّباً في Canvas.tsx:1210)، شبكة البكسل/خيارات العرض/وحدات المساطر، textAutoResize/textCase/شطب، أنماط تعبئة الصورة (fill/fit/crop)، أداة القياس، Scale tool، Deep select.

## الخطة المعاد بناؤها (ترقيم 6-11 محفوظ؛ 8 و9 بنطاق معروف من الجلسة المفقودة، الباقي نطاق هندسي مُعاد تصميمه — REGENERATED بمراساة سلوك Figma العام المنشور، لا ادعاء مصدر)
| المرحلة | النطاق | أساس النطاق |
|---|---|---|
| 6 | عمليات منطقية (union/subtract/intersect/exclude برياضيات قصّ مضلعات Greiner-Hormann + ترتيب عشوائي للمحاولات الفاسدة) + نظام الأقنعة (isMask: يقصّ كل الأشقاء السابقين في نفس الأب) | REBUILT |
| 7 | نظام الأنماط: أنماط لون/نص/تأثير على مستوى المشروع + تطبيق/فصل/تسمية + عدّاد استخدام + لوحة | REBUILT |
| 8 | شبكات التخطيط: Grid/Columns/Rows × MIN/CENTER/MAX/STRETCH لكل إطار + لوحة LayoutGridsPanel + رندر FrameGrids + شبكة بكسل (⌘'، تظهر ≥400% فقط) + snap-to-pixels + نافذة خيارات العرض + ترقية المساطر (px/in/cm/mm على DPI 72) | KNOWN من الجلسة المفقودة — إعادة تنفيذ (نموذج المصدر nR/nN مفقود → REGENERATED) |
| 9 | [...] ✅ منفذة |
| 10 | عمق النص والطلاء: textAutoResize (fixed/hug/grow بقياس حقيقي) + textCase + شطب + أنماط تعبئة الصورة (fill/fit/crop بمقياس وإزاحة) | REBUILT |
| 11 | [...] ✅ منفذة |

## قواعد تنفيذ كل مرحلة (إلزامية)
1. تُنفّذ بالترتيب 6→11 (قاعدة المستخدم 008).
2. كل حقل جديد يُضاف إلى PUT whitelist في مسار العنصر + normalizeServerElement/server-state لضمان البقاء عبر SSE.
3. تحقق ثلاثي بعد كل مرحلة: tsc --noEmit صفر / eslint صفر / next build ناجح.
4. تحقق حي بالمتصفح + لقطات VLM إلى `download/openfigma-p{N}-*.png`.
5. تحديث ثلاثي للتوثيق: PROGRESS.md + WORKLOG.md (المشروع) + /home/z/my-project/worklog.md.
