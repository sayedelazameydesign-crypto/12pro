# النشر على Fly.io - مجاناً 24/7 بدون جهازك - بديل Colab للإنتاج

**التاريخ**: 2026-09-16
**البروتوكول**: التحليل التأسيسي، التوزيع المنطقي، التنفيذ التدريجي، التدقيق الذاتي
**القيد**: $0 Gate - الانضباط المالي الصارم
**المشكلة**: Colab ليس خادم 24/7 - ينقطع بعد 12 ساعة، يحتاج متصفح مفتوح
**الحل**: Fly.io - مجاني 24/7 مع Volume دائم - $0

---

## 1. التحليل التأسيسي - لماذا Colab لا يصلح للإنتاج

### مشاكل Colab كخادم إنتاج

```
Colab Free Tier Limitations:
├── Idle Timeout: ينقطع إذا أغلقت المتصفح أو انقطع الإنترنت
├── Max Duration: 12 ساعة كحد أقصى، ثم Runtime Reset
├── Requires: جهازك يعمل، متصفح مفتوح، تحريك ماوس أو إضافات تمنع Idle
├── Result: لا يصلح لبيئة إنتاج حقيقية 24/7
└── Use Case: R&D والاختبار فقط، ليس Endpoint دائم للعملاء
```

**الاستنتاج**: نعم، لكي يبقى النظام متاحاً عبر Colab، يجب أن يظل جهازك يعمل والمتصفح مفتوحاً، وحتى مع ذلك سيتوقف كل 12 ساعة. هذا **لا يصلح لبيئة إنتاج**.

### البدائل المجانية الحقيقية ($0 Gate) - التوزيع المنطقي

| المنصة | التكلفة | الاستدامة (Persistence) | تعمل 24/7 بدون جهازك؟ | ملاحظات معمارية (v1.0.0) |
|--------|---------|------------------------|----------------------|--------------------------|
| **Fly.io** | **$0 (الباقة المجانية)** | **✅ نعم (fly_volume)** | **✅ نعم** | **3 VMs صغيرة + 3GB تخزين مجاناً دائماً - مثالية كبديل لـ Colab** |
| Render | $0 (مجاني) | ❌ لا (مجاني) | ✅ نعم (لكن تنام بعد 15 دقيقة) | لا تدعم Disks مجاناً، ستفقد Memories عند الاستيقاظ - لا تناسب v1.0.0 المجاني |
| Koyeb | $0 (مجاني) | ❌ لا (مؤقت) | ✅ نعم | نفس مشكلة Render، تخزين البيانات سيفقد |
| **Oracle Cloud** | **$0 (مجاني مدى الحياة)** | **✅ نعم (200GB!)** | **✅ نعم (24/7)** | **أقوى خيار مجاني (Always Free VPS)، يدعم Docker+Volumes بكفاءة، لكن التسجيل صعب** |
| Railway | $5 credit ثم مدفوع | ✅ نعم | ✅ نعم | يكسر $0 بعد الفترة المجانية |
| Local Docker | $0 | ✅ مع Volume | ❌ لا (يحتاج جهازك) | للتطوير فقط |

**التوصية**: Fly.io للـ $0 المجاني 24/7 مع Volume دائم، أو Oracle Cloud VPS مجاني مدى الحياة.

---

## 2. الحل الأمثل - Fly.io ضمن الخطة المجانية - $0

### لماذا Fly.io

- **$0**: 3 أجهزة افتراضية صغيرة (256MB RAM) + 3GB تخزين مجاناً دائماً (Free Tier)
- **✅ Persistence**: `fly_volume` - تخزين دائم، لا يفقد البيانات عند إعادة النشر (يعالج Gap #2)
- **✅ 24/7**: يعمل بدون جهازك - يمكنك إغلاق الكمبيوتر تماماً
- **✅ Terraform جاهز**: كود Terraform موجود في `terraform/modules/fly/main.tf` (المسار C)
- **✅ Docker**: يدعم Dockerfile مباشرة
- **✅ Close to Cairo**: Region `cdg` (Paris) قريب من القاهرة - latency منخفض

### مقارنة Fly.io vs Colab

| الميزة | Colab | Fly.io Free |
|--------|-------|-------------|
| التكلفة | $0 | $0 |
| 24/7 بدون جهازك | ❌ لا (يحتاج متصفح مفتوح) | ✅ نعم |
| Persistence | ❌ /tmp ephemeral | ✅ Volume دائم 3GB |
| Max Duration | 12 ساعة ثم Reset | ♾️ دائم |
| Idle Timeout | ينقطع إذا أغلقت المتصفح | ✅ لا ينقطع |
| Production Ready | ❌ R&D فقط | ✅ نعم - production-grade |
| Terraform | ❌ يدوي | ✅ Terraform module جاهز |
| Rollback | ❌ يدوي | ✅ `fly deploy --image v0.9.0` <5 min |

---

## 3. خطوات النشر على Fly.io - 24/7 مجاناً - تنفيذ تدريجي

### المتطلبات

- حساب Fly.io مجاني (https://fly.io - تسجيل بـ GitHub)
- `flyctl` مثبت (Fly CLI)
- Docker (للبناء المحلي) أو استخدام GitHub Actions

### الطريقة 1: النشر السريع بدون Terraform (5 دقائق) - للمبتدئين

```bash
# 1. تثبيت flyctl
curl -L https://fly.io/install.sh | sh
# أو
brew install flyctl

# 2. تسجيل الدخول
fly auth login
# → يفتح المتصفح، سجل بـ GitHub

# 3. إنشاء التطبيق
cd /home/user/12pro
fly launch --name celiaos --region cdg --no-deploy
# → يكتشف Dockerfile تلقائياً
# → اختر: Would you like to set up a Postgresql database? → No (v1.0.0 File JSON)
# → Would you like to set up an Upstash Redis database? → No (اختياري)

# 4. إنشاء Volume دائم - CRITICAL لـ v1.0.0 (Gap #2)
fly volumes create celiaos_data --region cdg --size 3
# → 3GB مجاناً ضمن Free Tier
# → هذا Volume يحفظ /app/certification حيث memories.json و missions.json
# → بدون Volume، البيانات ستفقد عند إعادة النشر!

# 5. إعداد fly.toml - إضافة Volume mount
cat fly.toml
# يجب أن يحتوي على:
# [mounts]
#   source = "celiaos_data"
#   destination = "/app/certification"

# إذا لم يكن موجوداً، أضفه:
cat >> fly.toml <<'TOML'

[mounts]
  source = "celiaos_data"
  destination = "/app/certification"
TOML

# 6. إعداد متغيرات البيئة (اختياري)
fly secrets set NODE_ENV=production
# لا تضع DATABASE_URL لـ v1.0.0 (File JSON)
# لـ v1.1.0: fly secrets set DATABASE_URL=postgres://...

# 7. النشر
fly deploy --image ghcr.io/sayedelazameydesign-crypto/12pro:v1.0.0
# أو بناء محلي:
# fly deploy

# 8. التحقق - Raw Artifacts
fly status
# → Should show 1 machine running

fly logs
# → Should show:
# [api-server] Starting on 0.0.0.0:3001...
# [api-server] - File limit: 50MB
# [persistence] Using File JSON - ensure volume mount for production
# [api-server] Listening on 0.0.0.0:3001

curl https://celiaos.fly.dev/api/v1/health
# → {"status":"ok","version":"0.1.0"}

curl https://celiaos.fly.dev/api/v1/sse/stats
# → {"clients":0,"maxClients":100,"heartbeat":15000}

curl https://celiaos.fly.dev/api/v1/providers
# → {"spend":{"total":0,"max":0},"costGuard":"ENABLED"} - $0 gate

# 9. اختبار Persistence - يبقى بعد إعادة النشر
# إنشاء محادثة
CONV_ID=$(curl -s -X POST https://celiaos.fly.dev/api/v1/conversations -H "Content-Type: application/json" -d '{"title":"test-flyio"}' | jq -r .id)
echo "Created: $CONV_ID"

# إعادة النشر
fly deploy --image ghcr.io/sayedelazameydesign-crypto/12pro:v1.0.0

# التحقق أن المحادثة لا تزال موجودة (Volume يحفظ البيانات)
curl https://celiaos.fly.dev/api/v1/conversations | jq length
# → Should be >=1 - persistence survives redeploy WITH volume

# 10. إغلاق جهازك - النظام يعمل 24/7 بدونك!
# يمكنك إغلاق الكمبيوتر، Fly.io يعمل 24/7 مجاناً مع Volume دائم
```

**التكلفة**: $0 - ضمن Free Tier (3 VMs صغيرة + 3GB storage مجاناً دائماً)

**الوقت**: 5 دقائق

---

### الطريقة 2: النشر عبر Terraform (موصى به - للإنتاج) - 10 دقائق

**الميزة**: أمر واحد، قابل لإعادة الإنتاج، قابل للتدقيق، Infrastructure as Code

```bash
# 1. تثبيت Terraform
# https://developer.hashicorp.com/terraform/downloads

# 2. إعداد Fly.io API token
fly auth token
# → انسخ Token

export FLY_API_TOKEN="your-token-here"
# أو ضعه في terraform.tfvars

# 3. استخدام Module الجاهز
cd /home/user/12pro/terraform/modules/fly

# إنشاء terraform.tfvars
cat > terraform.tfvars <<'TFVARS'
app_name = "celiaos"
region = "cdg"
volume_size = 3
env_vars = {
  NODE_ENV = "production"
}
TFVARS

# 4. النشر
terraform init
terraform plan
# → يظهر: 1 app + 1 volume + 1 machine

terraform apply
# → Yes
# → ينشئ: app + volume 3GB + machine
# → يطبع: URL, volume ID, deployment instructions

# 5. التحقق
terraform output
# app_url = "https://celiaos.fly.dev"
# volume_id = "vol_xxx"
# deployment_instructions = "..."

curl $(terraform output -raw app_url)/api/v1/health
# → {"status":"ok"}

# 6. Rollback إذا لزم الأمر (Gap #8)
fly deploy --image ghcr.io/sayedelazameydesign-crypto/12pro:v0.9.0 -a celiaos
# → Rollback <5 min - see docs/ROLLBACK-PLAN.md

# 7. إغلاق جهازك - يعمل 24/7
# Terraform يحفظ الحالة، يمكنك إغلاق الكمبيوتر
```

**التكلفة**: $0 - Terraform free + Fly.io free tier

**الوقت**: 10 دقائق

**الميزة**: Infrastructure as Code - كل شيء في Git، قابل لإعادة الإنتاج

---

### الطريقة 3: Oracle Cloud Always Free VPS - الأقوى - $0 مدى الحياة

**الميزة**: VPS مجاني مدى الحياة مع 200GB تخزين، يدعم Docker+Volumes بكفاءة هائلة

**العيب**: التسجيل قد يكون صعباً (يحتاج بطاقة ائتمان للتحقق، لكن لا يتم خصم شيء)

```bash
# 1. إنشاء حساب Oracle Cloud Free Tier
# https://www.oracle.com/cloud/free/
# → Always Free: 2 AMD VMs (1GB RAM each) + 200GB storage free forever

# 2. إنشاء VM
# Console → Compute → Instances → Create Instance
# → Image: Ubuntu 22.04
# → Shape: VM.Standard.E2.1.Micro (Always Free)
# → Add SSH key

# 3. الاتصال بالـ VM
ssh ubuntu@<public-ip>

# 4. تثبيت Docker
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu
# Logout and login again

# 5. Clone CeliaOS
git clone https://github.com/sayedelazameydesign-crypto/12pro.git
cd 12pro
git checkout arena/01a0a9e0-12pro

# 6. تشغيل مع docker-compose.v1.0.0.yml
cd terraform/modules/docker-compose
docker-compose -f docker-compose.v1.0.0.yml up -d --build

# 7. التحقق
curl http://localhost:3001/api/v1/health
curl http://localhost:3000 # Frontend

docker volume ls | grep celiaos-data
# → Should exist - persistent volume

# 8. إعداد Nginx + SSL (اختياري)
# للإنتاج مع دومين

# 9. يعمل 24/7 مجاناً مع 200GB تخزين!
# يمكنك إغلاق جهازك، Oracle VPS يعمل 24/7
```

**التكلفة**: $0 مدى الحياة - Always Free Tier (2 VMs + 200GB)

**الوقت**: 30 دقيقة (التسجيل + إعداد VM)

**الميزة**: أقوى خيار مجاني - 200GB تخزين، VPS كامل، يدعم Docker+Volumes

---

## 4. التدقيق الذاتي والقرار

### الخطأ الذي تم تصحيحه

**الاعتماد على Colab كنهاية مطاف (Endpoint) دائم ومجاني هو تصور خاطئ لبيئة الإنتاج**:

- Colab: Idle Timeout، 12 ساعة max، يحتاج متصفح مفتوح، جهاز يعمل
- Production: يحتاج 24/7 بدون جهازك، persistence دائم، لا ينقطع

### الحل المعماري

**الانتقال فوراً لنشر الحاوية على Fly.io عبر قوالب Terraform التي قمنا بإعدادها، مما يضمن عمل المنصة 24/7 واحتفاظها بالبيانات (Volumes) وبنفس التكلفة ($0)**:

- **Fly.io Free Tier**: 3 VMs صغيرة + 3GB storage مجاناً دائماً - $0
- **Volume دائم**: `fly_volume` mounted to `/app/certification` - يعالج Gap #2
- **24/7 بدون جهازك**: يمكنك إغلاق الكمبيوتر تماماً
- **Terraform جاهز**: `terraform/modules/fly/main.tf` - أمر واحد `terraform apply`
- **Rollback <5 min**: `fly deploy --image v0.9.0` - Gap #8
- **Close to Cairo**: Region `cdg` (Paris) - latency منخفض

**أو Oracle Cloud Always Free VPS**: 200GB تخزين مجاناً مدى الحياة، أقوى خيار مجاني، لكن التسجيل صعب.

### التوصية النهائية

**للـ $0 Gate مع 24/7 بدون جهازك**:

1. **الخيار الأول: Fly.io Free Tier** - موصى به - $0، 24/7، Volume دائم، Terraform جاهز، 5 دقائق نشر
2. **الخيار الثاني: Oracle Cloud Always Free** - $0 مدى الحياة، 200GB، VPS كامل، لكن تسجيل صعب
3. **Colab + Drive**: للبحث والتطوير والاختبار فقط، ليس للإنتاج 24/7

**البقاء على v1.0.0 مع تحسينات B+C - $0 - مع Fly.io كبديل لـ Colab للإنتاج**:

- v1.0.0: 8.8/10، 15 raw artifact، 6 منصات، $0 gate، production-grade for containers
- Fly.io: $0 free tier، Volume دائم، 24/7 بدون جهازك، Terraform module جاهز
- Colab+Drive: للبحث والاختبار فقط، ليس للإنتاج

---

## 5. خطوات النشر على Fly.io - ملخص سريع - 5 دقائق - $0

```bash
# تثبيت flyctl
curl -L https://fly.io/install.sh | sh
fly auth login

# إنشاء التطبيق + Volume
cd /home/user/12pro
fly launch --name celiaos --region cdg --no-deploy
fly volumes create celiaos_data --region cdg --size 3

# إضافة Volume mount إلى fly.toml
cat >> fly.toml <<'TOML'
[mounts]
  source = "celiaos_data"
  destination = "/app/certification"
TOML

# النشر
fly deploy --image ghcr.io/sayedelazameydesign-crypto/12pro:v1.0.0

# التحقق
curl https://celiaos.fly.dev/api/v1/health # ok
curl https://celiaos.fly.dev/api/v1/providers | jq .spend.total # 0 - $0 gate

# إغلاق جهازك - يعمل 24/7 مجاناً!
```

**التكلفة**: $0 - Free Tier (3 VMs + 3GB storage مجاناً دائماً)
**الوقت**: 5 دقائق
**النتيجة**: 24/7 بدون جهازك، Volume دائم، $0 gate، production-grade

---

## 6. الأسئلة الشائعة

**س: هل Fly.io مجاني حقاً 24/7؟**
ج: نعم، Free Tier: 3 shared-cpu VMs (256MB RAM) + 3GB persistent volume + 160GB outbound data transfer مجاناً دائماً. كافي لـ CeliaOS v1.0.0.

**س: ماذا عن Render المجاني؟**
ج: Render free tier ينام بعد 15 دقيقة خمول ولا يدعم Disks مجاناً، لذا ستفقد Memories عند الاستيقاظ. لا يناسب v1.0.0 المجاني الذي يحتاج persistence.

**س: هل يمكنني استخدام Oracle Cloud بدلاً من Fly.io؟**
ج: نعم، Oracle Cloud Always Free أقوى (200GB storage مجاناً مدى الحياة)، لكن التسجيل قد يكون صعباً ويحتاج بطاقة ائتمان للتحقق (لا يتم خصم شيء). Fly.io أسهل للتسجيل.

**س: ماذا عن Colab + Drive؟**
ج: Colab + Drive يصلح للبحث والتطوير والاختبار فقط، ليس للإنتاج 24/7. يحتاج متصفح مفتوح وينقطع بعد 12 ساعة. Fly.io أو Oracle Cloud للإنتاج 24/7.

**س: كيف أتأكد أن البيانات لا تفقد؟**
ج: Fly.io Volume دائم - `fly volumes list` يظهر Volume. حتى بعد `fly deploy`، البيانات تبقى لأن Volume منفصل عن Machine. اختبر: إنشاء محادثة → إعادة نشر → المحادثة لا تزال موجودة.

**س: ماذا لو فشل النشر؟**
ج: Rollback <5 min: `fly deploy --image ghcr.io/...:v0.9.0 -a celiaos` - see `docs/ROLLBACK-PLAN.md`

---

**القرار**: الانتقال من Colab (R&D فقط) إلى Fly.io (Production 24/7) - $0 - مع Volume دائم

**التاريخ**: 2026-09-16
**البروتوكول**: التحليل التأسيسي، التوزيع المنطقي، التنفيذ التدريجي، التدقيق الذاتي
**القيد**: $0 Gate - الانضباط المالي الصارم
**الحالة**: ✅ جاهز للنشر 24/7 مجاناً - Terraform module موجود - 5 دقائق
