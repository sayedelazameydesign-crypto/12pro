# Knowledge Audit — تدقيق طبقة المعرفة (`ml-from-zero`)

> تدقيق **READ-ONLY** لسلسلة التكامل كاملةً:
> Knowledge → Loader → Retrieval → API → Memory Fabric → Skills Registry → Agent Runtime → Evidence.
>
> القاعدة التي حكمت هذا التدقيق: **نجاح الاختبارات ليس PASS**. صحة الكود شيء، وصحة المحتوى شيء،
> وصحة التكامل وقت التشغيل شيء ثالث — وكل واحد منها يحتاج دليله الخاص.

Reproduce everything in one command (≈70s, no network, no installs):

```bash
bash scripts/audit/run-knowledge-audit.sh          # full audit incl. regression gates
FAST=1 bash scripts/audit/run-knowledge-audit.sh   # skip full suite / lint / typecheck
```

Artifacts land in [`certification/knowledge/`](../../certification/knowledge/) — every number quoted
below is read back out of those files, never retyped by hand.

---

## 1. Gate table — جدول البوابات

| Gate | الخطوة | الاسم | الحالة | الدليل |
|---|---|---|---|---|
| G1 | 1 · inspect commit | فحص الالتزام (بلا مخلفات بناء/أسرار) | ✅ PASS 3/3 | `static-audit-raw.json` (C1–C3) |
| G2 | 2 · package boundaries | حدود الحزمة (صفر تبعيات، loader للقراءة فقط) | ✅ PASS 8/8 | `static-audit-raw.json` (B1–B8) |
| G3 | 3 · knowledge unit tests | اختبارات الوحدة (بلا skip صامت) | ✅ PASS 32/32 | `unit-tests-raw.json` |
| G4 | 4 · python labs | المختبرات: نجاح + حتمية + عزل + عدم تأثر بـ cwd + بلا آثار | ✅ PASS 5/5 | `python-labs-audit-raw.json` |
| G5 | 5 · API vs real files | الـ API يخدم الملفات المؤلَّفة حرفيًا | ⚠️ PASS 13/14 (1 WARN) | `api-audit-raw.json` |
| G5b | 5 · degraded mode | عند غياب الملفات: 503 بسبب حقيقي، بلا بيانات مختلَقة | ✅ PASS 3/3 | `api-unavailable-raw.json` |
| G6 | 6 · memory fabric | الحقن في `MemoryFabric` حقيقية + بقاء بعد إعادة التشغيل | ✅ PASS 6/6 | `runtime-audit-raw.json` (M1–M6) |
| G7 | 7 · skills registry | المرشّحات تعبر خط الترقية الحقيقي | ✅ PASS 3/3 | `runtime-audit-raw.json` (S1–S3) |
| G8 | 8 · answer-key leakage | `answerIndex` والشرح لا يغادران مسار التصحيح | ✅ PASS 6/6 | `runtime-audit-raw.json` (L1–L3) + `api-audit-raw.json` (A5/A6/A12) |
| G9 | 9 · record evidence | كل خطوة كتبت دليلًا آلي القراءة | ✅ PASS 2/2 | `certification/knowledge/*.json` |
| G10 | — · regression | لا تراجع في المستودع (101/101، lint 0 أخطاء، typecheck) | ✅ PASS 3/3 | `full-suite-raw.json`, `lint-raw.json`, `typecheck-raw.json` |
| G11 | — · delivery | مسار GitHub (بلا طلب أو طباعة أي توكن) | ✅ PASS 1/1 | `github-status-raw.json` |
| G12 | — · read-only proof | التدقيق لم يغيّر بايتًا واحدًا من السطح المُدقَّق | ✅ PASS 2/2 | snapshot diff داخل `audit-summary-raw.json` |

**12 PASS + 1 PASS_WITH_WARNINGS · 0 FAIL** → `certification/knowledge/audit-summary-raw.json`

---

## 2. What was actually proven — ما الذي ثبت فعلًا

### الحدود (G2)
`@agi-system/knowledge` declares `dependencies: {}` و`peerDependencies: {}`. المصادر الستة تستورد
`fs/path/url` ووحداتها النسبية فقط، ولا تحتوي على أي استدعاء كتابة (13 API كتابة مفحوصة) —
الحزمة **قراءة فقط** بطبيعتها. `services/api-server` يستورد `fs/http/path/url` فقط؛ ذكر
`@agi-system/knowledge` فيه appears في 3 أسطر **كلها تعليقات**، فلا اقتران وقت التشغيل.
مصدر الحقيقة واحد: لا نسخة ثانية من `curriculum.json`/`glossary.json`/الدروس في أي مكان.

### المحتوى (G3 + content audit)
`content-audit-raw.json` — 13/13 PASS بمحلّل Python مستقل:
8 مراحل، 16 درسًا، 49 مصطلحًا، 255 مرادفًا، 26 سؤالًا، 10 ملفات مختبر، 7504 كلمات، 48 هدفًا تعليميًا.
بلا أسرار، بلا حشو نائبي (placeholders)، كل درس ثنائي اللغة، كل الروابط تُحلّ، وكل المختبرات
تُصرَّف (compile) وتعتمد على المكتبة القياسية فقط.

### المختبرات (G4)
ليست «8/8 وانتهينا» — بل خمس خصائص: نجاح قانوني، **حتمية** (نسختان متطابقتان بايت-ببايت بعد حذف
التوقيتات)، **عزل** (`env -i python3 -S -I` → 8/8)، **عدم تأثر بمجلد العمل** (من `/tmp` → 8/8)،
و**صفر آثار جانبية** على نظام الملفات (التغيير الوحيد المسموح: `__pycache__` المتجاهَل في git).

### الـ API مقابل الملفات الحقيقية (G5/G5b)
140 طلبًا، 0 أخطاء نقل، أبطأ استجابة 3.4ms. أهم ما ثبت:

* **A4**: نص الدرس المُعاد من الـ API يطابق `lessons/*.md` **بايت-ببايت** (16/16) — أي أن الخادم يقرأ
  الملفات المؤلَّفة، لا نسخة مخزّنة في الكود.
* **A11**: 7/7 سلاسل موجودة فقط داخل الملفات ظهرت حرفيًا في النقطة التي يجب أن تخدمها — دليل
  provenance لا يمكن تزويره بتعليق.
* **A3**: 16 درسًا × محدِّدان (id ورقم الترتيب) — صفر اختلاف في أي حقل، ومؤشر `next` صحيح، ومرجعيات
  المصطلحات إلى `glossary.json` سليمة.
* **A7**: 8/8 استعلامات تحقق top-1 صحيح (عربي وإنجليزي)، والنتائج مرتبة تنازليًا، و`limit` محترم.
* **A20/A21**: أُقلِع خادم ثانٍ من `/tmp` حيث مجلد البيانات **غير موجود فعلًا** → المسارات الستة أعادت
  503 مع سبب حقيقي، و`/api/v1/health` ظل 200، ولا جسم استجابة احتوى درسًا أو نتائج بحث مختلَقة.

### احتواء مفتاح الإجابة (G8) — التفصيل الأهم
الفحص **بنيوي لا نصي**: كل استجابة JSON تُحلَّل وتُمسح كل مسارات المفاتيح فيها.

| المقياس | القيمة |
|---|---|
| نقاط النهاية الممسوحة | 46 |
| مسارات مفاتيح JSON متميزة | 1115 |
| أسماء مفاتيح ممنوعة | 11 (`answerIndex`, `answer`, `explanation`, `answerKey`, `isCorrect`, …) |
| سلاسل شرح فريدة من `curriculum.json` | 52 |
| تسريبات | **0** |
| مفاتيح كائن السؤال المخدوم | `{id, lessonId, question, options, optionCount}` فقط |

لماذا بنيوي؟ لأن المسح النصي الساذج أعطى **5 إيجابيات كاذبة**: عبارة «الإجابة الصحيحة» موجودة في
نص تعليمي مؤلَّف (تعريف Accuracy والـ labels)، وهي مفردات تدريس لا مفتاح إجابة. المفاتيح لا تكذب؛
النثر قد يبدو كذلك. كذلك ثبت (A12) أن نصوص الشرح الـ52 **لا تظهر داخل أجسام الدروس إطلاقًا**، فلا
يمكن «اصطيادها» من الشرح.

### الذاكرة والمهارات (G6/G7) — ضد كائنات حقيقية لا محاكاة
* **M1**: حقن 73 سجلًا في `MemoryFabric` حقيقية: 65 `semantic` (16 درسًا + 49 مصطلحًا) و8 `procedural` (المراحل).
* **M2**: **صفر** تحذيرات `Unknown embedding dim`؛ كل التضمينات 384-بعدية كما يتوقع `EMBEDDING_CONFIG`.
* **M3**: بعد «إعادة تشغيل» (نسخة `MemoryFabric` جديدة على نفس الملف): 73 → 73، وسجل الدرس مسترجَع بمحتواه.
* **M4**: مسار الوكيل `retrieveForTask()` أعاد 5 حقائق، **كلها** سجلات معرفة.
* **M6**: إعادة الحقن لا تضاعف شيئًا (73 → 73) — idempotent.
* **S1**: 16 مرشّحًا عبر `proposeCandidate` → `promoteCandidate` → **16 مُرقّى**، وكل خطوة تشير إلى ملف
  مختبر موجود فعلًا، و`registry.get()` يعيد المهارة بخطواتها.
* **S2**: أمانة البوابة: مرشّح بنسبة نجاح 0.5 **رُفض** برمي استثناء (`successRate < 0.8`) — فالترقية ليست شكلية.

---

## 3. Findings — النتائج (بما فيها غير المريح)

| # | الخطورة | النتيجة | الدليل | التوصية | تحجب الواجهة؟ |
|---|---|---|---|---|---|
| FINDING-1 | **high** | لا يوجد أي bootstrap وقت التشغيل يستدعي `ingestInto`/`toSkillCandidates`/`KnowledgeBase` — التكامل مُثبت **بالاستدعاء المباشر** لا بالأسلاك التلقائية | `runtime-audit-raw.json` W1 (0 إصابة في 149 ملفًا) | تغيير مُصرَّح به منفصل: حقن مرة واحدة عند الإقلاع (idempotent بحسب M6) + تسجيل المرشّحات | لا (الواجهة مسار قراءة عبر API) |
| FINDING-2 | medium | المهارات المُرقّاة **غير دائمة**: `SkillsRegistry` في الذاكرة فقط، بينما سجلات الذاكرة تبقى | S3 | تخزين المهارات كسجلات `skill` في memory-fabric أو في mission-ledger | لا (لكن لا تدّعِ تعلمًا دائمًا في النصوص) |
| FINDING-3 | medium | ترتيب متجهي ضعيف: كل الدروس **قابلة للاسترجاع** (5/5) لكن 1/5 فقط في أول 3؛ المراتب المقاسة `[1, 8, 7, 13, 7]` | M5 | الترتيب عبر `/knowledge/search` (lexical+IDF، 8/8 top-1)؛ ترقية التضمينات إلى `nomic-embed-text` | لا (شرط على مصدر الترتيب) |
| FINDING-4 | medium | مواضع الإجابة قابلة للتخمين: **76.9%** من الأسئلة (20/26) الإجابة الصحيحة فيها عند الفهرس 1، وأطول تتابع متطابق 5 | `api-audit-raw.json` A13 (WARN) | خلط ترتيب الخيارات في `curriculum.json` (تغيير تأليف، لا تغيير API) | **نعم — لسطح الاختبار/التقييم فقط** |
| FINDING-5 | low | `package-lock.json` لم يكن يحتوي مدخل الـ workspace الجديد — اكتشفه التدقيق وأصلحه `npm install` (8 أسطر) | git status أثناء التدقيق | يُلتزَم مع هذا التدقيق (بدونه `npm ci` لا يربط الحزمة) | لا |
| OBS-1 | info | البحث المعجمي يطابق أجزاء الرموز: `zzzqqq-no-such-token` أعاد نتيجتين لأن `token` مصطلح حقيقي؛ الرمز الخالي من أي كلمة حقيقية يعيد 0 | A7 | لا تغيير مطلوب — سلوك معجمي متوقع | لا |

### أخطاء أدوات التدقيق نفسها (صُحّحت أثناء التدقيق)
الأمانة تقتضي ذكرها، لأنها توضح أن المدقّق نفسه كان تحت الاختبار:

1. نشر قاموس الأدلة داخل سجل الفحص (`**evidence`) كان **يستبدل** معرّف الفحص (C12 ظهر باسم `ml-from-zero`) → عُشّشت الأدلة تحت مفتاح `evidence`.
2. مسح نصي للبحث عن مفتاح الإجابة أنتج 88 «تسريبًا» كاذبًا، لأن نص الخيار الصحيح **يجب** أن يظهر كأحد الخيارات → قُسّم الفحص إلى: مفاتيح ممنوعة (بنيوي) + نصوص شرح (نصي) + إنتروبيا المواضع (مقياس).
3. نمط regex لاستيراد الوحدات طابق قائمة كلمات التوقف (stopwords) الإنجليزية داخل `retrieval.ts` (التي تحتوي الرمز `'from'`) → رُسِيَ النمط على شكل الجملة الاستيرادية.
4. فحص استيراد المختبرات كان نصيًا فالتقط سطرًا داخل docstring → استُبدل بتحليل `ast` حقيقي مع `sys.stdlib_module_names`.
5. عدّاد typecheck كان يشترط **المساواة** مع الخط الأساسي، فاعتبر التحسّن فشلًا → صار: صفر أخطاء في مسارات التسليم/التدقيق + عدم تجاوز الخط الأساسي.

---

## 4. Read-only proof — دليل عدم التعديل

| البند | القيمة |
|---|---|
| ملفات مُجزَّمة (sha256) قبل/بعد | 79 / 79 |
| تغييرات في السطح المُدقَّق | **صفر** |
| السطح المُدقَّق | `packages/knowledge`, `examples/ml-course`, `services/api-server/src`, `tests/unit/knowledge`, `tests/integration/knowledge-api.test.ts`, `docs/knowledge`, `docs/api`, `README.md`, `CHANGELOG.md` |

ما أضافه التدقيق (مُفصَح عنه بالكامل، وكله **جديد** باستثناء سلكين):

| المسار | النوع |
|---|---|
| `scripts/audit/` (7 ملفات) | أدوات تدقيق جديدة: static / content / labs / api / github / assemble / boot launcher |
| `tests/audit/knowledge-runtime.audit.test.ts` | اختبار تدقيق وقت التشغيل (13 فحصًا) |
| `certification/knowledge/` (14 ملفًا) | أدلة آلية القراءة |
| `vitest.config.ts` | **سلك مُفصَح**: alias لـ`@agi-system/skills-registry` (سطر واحد) كي يستطيع اختبار التدقيق استيراده |
| `package-lock.json` | **سلك مُفصَح**: مدخل workspace للحزمة الجديدة (FINDING-5) |
| `docs/knowledge/AUDIT-ml-from-zero.md` | هذا التقرير (كُتب بعد اكتمال تشغيل التدقيق) |

---

## 5. Decision — قرار واجهة `/learn`

```
learnUI = AUTHORIZED_WITH_CONDITIONS
blockingGateFailures = []
```

الشروط الستة (محسوبة من الأدلة، لا من التقدير):

1. **النشر**: ادفع التزام التدقيق وافتح PR من `arena/01a0c57e-12pro` ليصبح الدليل عامًا (G11 = `DELIVERY_READY`).
2. **مسار قراءة فقط**: الواجهة تستهلك نقاط `/api/v1/knowledge*` المُثبتة (G5/G5b). الأسلاك التلقائية
   لوقت التشغيل تبقى تغييرًا منفصلًا مُصرَّحًا به (FINDING-1).
3. **مصدر الترتيب**: `/api/v1/knowledge/search` (lexical+IDF) — لا `memory-fabric` vector top-k حتى تُرقّى
   التضمينات (FINDING-3).
4. **الاختبارات**: تُعرَض للتدرّب، ولا تُقدَّم كتقييم ولا تُحتسب درجات علنًا حتى يُخلط ترتيب الخيارات (FINDING-4).
5. **النصوص**: لا ادعاء بتعلّم مهاراتي دائم — المهارات المُرقّاة في الذاكرة فقط (FINDING-2).
6. **الالتزام**: يشمل تصحيح `package-lock.json` (FINDING-5).

### الحالة الصادقة

> **IMPLEMENTED · LOCALLY VERIFIED BY READ-ONLY AUDIT · 13/13 GATES PASS (1 WARN) ·
> RUNTIME AUTO-WIRING PENDING (FINDING-1)**

لم يُقل «PASS كامل» في أي مكان: التكامل مُثبت بالاستدعاء المباشر ضد كائنات حقيقية،
وبقاؤه تلقائيًا عند إقلاع النظام **لم يُنفَّذ بعد** — وهو بند مُصرَّح به لاحقًا، لا شيء مُدَّعى.

---

## 6. CI attribution — إسناد فحوصات CI

Check أحمر لا يعني شيئًا قبل إسناده. قورنت كل workflow في فرع العمل بنفسها في `main`
(`scripts/audit/ci-attribution-check.py` → `certification/knowledge/ci-attribution-raw.json`):

```
verdict = NO_REGRESSION
  PRE_EXISTING  CI - Build / Lint / Typecheck / Unit          head=failure  base=failure
  PRE_EXISTING  Attestations - Build Provenance & SBOM        head=failure  base=failure
  PRE_EXISTING  Benchmarks - Latency / Memory / Planning      head=failure  base=failure
  PRE_EXISTING  Test Serverless Matrix - File Persistence     head=failure  base=failure
```

| Job (CI workflow) | `main` | هذا الفرع |
|---|---|---|
| install | ✅ success | ✅ success |
| lint | ✅ success | ✅ success |
| **unit-test** | ❌ **failure** | ✅ **success** |
| typecheck | ❌ failure | ❌ failure (1141 خطأً سابقًا للوجود، كلها في `apps/web`) |
| build | ⏭ skipped | ⏭ skipped |

إسناد `typecheck` مثبت بطريقتين مستقلتين:

1. `git diff --stat c314199..HEAD -- apps/web` → **فارغ**: الالتزامان لم يلمسا `apps/web` إطلاقًا،
   بينما كل الأخطاء الـ1141 فيه.
2. `apps/web/tsconfig.json` يتضمن `.next/types/**/*.ts` وهو غير موجود في بيئة التدقيق — وهذا يفسّر
   فرق −7 مقابل الخط الأساسي المسجَّل سابقًا (1148). وإزالة `node_modules/@agi-system/knowledge`
   لا تغيّر العدد (1147 في الحالتين) → الانحراف بيئي لا بسبب هذا العمل.

**الخلاصة الصادقة**: لا يوجد أي فحص CI تحوّل من أخضر إلى أحمر بسبب هذا العمل، وفحص واحد
(`unit-test`) تحسّن من أحمر إلى أخضر. ما يبقى أحمر هو حالة المستودع السابقة، ويُذكر هنا بصراحة
بدل إخفائه خلف «CI أحمر لأسباب غير معروفة».
