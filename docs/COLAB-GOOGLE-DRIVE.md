# Colab + Google Drive - Free Persistent Storage - $0 Budget

**For**: Users with $0 budget constraint who need persistence without Postgres
**Cost**: $0 - Colab free tier + Google Drive free 15GB
**Alternative to**: Postgres ($5-30/month) for Vercel/Lambda

---

## Problem

- v1.0.0 File JSON persistence fails on Vercel/Lambda (ephemeral FS)
- Postgres solution costs $5-30/month (breaks $0 budget)
- Need free persistent storage for $0 budget

## Solution: Colab + Google Drive

Google Drive provides free persistent storage that survives Colab restarts.

---

## Setup

### 1. Mount Google Drive in Colab

```python
from google.colab import drive
drive.mount('/content/drive')

# Now /content/drive/MyDrive/ is persistent
# Even after Colab restart, files in Drive persist
```

### 2. Clone CeliaOS to Drive

```python
%cd /content/drive/MyDrive/
!git clone https://github.com/sayedelazameydesign-crypto/12pro.git
%cd 12pro
!git checkout arena/01a0a9e0-12pro
```

### 3. Setup Persistence Path to Drive

```python
import os
os.environ['PERSISTENCE_PATH'] = '/content/drive/MyDrive/12pro/certification'
os.environ['NODE_ENV'] = 'production'

# Create persistence dirs in Drive
!mkdir -p /content/drive/MyDrive/12pro/certification/memory-fabric
!mkdir -p /content/drive/MyDrive/12pro/certification/mission-ledger
```

### 4. Install and Run

```python
!npm install
!cd apps/web && npm install && cd ../..

# Terminal 1: Backend with Drive persistence
!PERSISTENCE_PATH=/content/drive/MyDrive/12pro/certification npx tsx services/api-server/src/index.ts &
```

```python
# Terminal 2: Frontend
%cd /content/drive/MyDrive/12pro/apps/web
!npm run dev &
```

### 5. Verify Persistence Survives Restart

```python
# Create conversation
import requests
conv = requests.post('http://localhost:3001/api/v1/conversations', json={'title': 'test'}).json()
print(f"Created: {conv['id']}")

# Simulate Colab restart - runtime dies, but Drive persists
# After restart, mount Drive again and check:

from google.colab import drive
drive.mount('/content/drive')
%cd /content/drive/MyDrive/12pro

# Check if file exists in Drive
!ls -lh /content/drive/MyDrive/12pro/certification/memory-fabric/
!cat /content/drive/MyDrive/12pro/certification/memory-fabric/memories.json | head -n 20

# Restart server - should load from Drive
!PERSISTENCE_PATH=/content/drive/MyDrive/12pro/certification npx tsx services/api-server/src/index.ts &
```

---

## Architecture

```
Colab Runtime (Ephemeral - dies every 12 hours)
    ↓
Google Drive Mount (/content/drive/MyDrive/ - Persistent)
    ↓
/content/drive/MyDrive/12pro/certification/
    ├── memory-fabric/memories.json (Persistent - survives restart)
    ├── mission-ledger/missions.json (Persistent)
    └── conversations (if using file persistence)
    ↓
API Server reads from Drive (PERSISTENCE_PATH env)
```

**Comparison**:

| Storage | Cost | Persistence | Survives Colab Restart | Survives Vercel Redeploy |
|---------|------|-------------|------------------------|--------------------------|
| Colab /tmp | $0 | ❌ Ephemeral | ❌ No | N/A |
| File JSON local | $0 | ❌ Ephemeral (without volume) | ❌ No | ❌ No |
| File JSON + Volume | $0 local, $5 VPS | ✅ Persistent | ✅ Yes (if volume) | ❌ No (Vercel no volume) |
| Google Drive | $0 (15GB free) | ✅ Persistent | ✅ Yes | N/A (Colab only) |
| Postgres (Neon/Supabase) | $5-30/month | ✅ Persistent | ✅ Yes | ✅ Yes |

---

## Advantages for $0 Budget

- ✅ $0 cost - Colab free + Drive free 15GB
- ✅ Persistent - survives Colab restarts (12 hour limit, but Drive persists)
- ✅ No database setup - just mount Drive
- ✅ Backup included - Drive has version history
- ✅ Easy - 2 lines of code to mount
- ✅ Works for v1.0.0 File JSON persistence

## Limitations

- ⚠️ Colab only - not for Vercel/Lambda (need Postgres for those)
- ⚠️ Manual mount required after each Colab restart (2 lines)
- ⚠️ Drive API rate limits (but generous for 15GB)
- ⚠️ Not for production with 1000+ users (use Fly.io/Render with volume for production)

---

## For Production with $0 Budget

**Option 1: Colab + Drive (for personal/research)**:
- Cost: $0
- Persistence: Drive
- Use case: Personal, research, education
- Scale: 1-10 users

**Option 2: Local Docker + Volume (for dev)**:
- Cost: $0 (local machine)
- Persistence: Volume mount
- Use case: Local dev
- Scale: 1 user

**Option 3: Fly.io/Render with Volume (for small production)**:
- Cost: $5-7/month
- Persistence: Persistent volume/disk
- Use case: Small production
- Scale: 10-100 users

**Option 4: VPS with Docker (for full control)**:
- Cost: $5-20/month (Hetzner, DigitalOcean)
- Persistence: Volume
- Use case: Production with full control
- Scale: 100-1000 users

**For Vercel/Lambda (serverless)**:
- Need v1.1.0 Postgres adapter
- Cost: $5-30/month for Postgres + $0-20 for Vercel/Lambda
- Use case: Serverless, multi-region
- Scale: 1000+ users

---

## Recommendation for $0 Budget

**If you are on Colab**:

Use Google Drive persistence - it's free, persistent, and works with v1.0.0 File JSON.

**If you are on local**:

Use Docker with volume mount - `docker-compose` with `celiaos-data` volume.

**If you need Vercel/Lambda**:

Wait for v1.1.0 Postgres adapter, or accept $5-30/month cost for Postgres.

**For now (v1.0.0)**:

Containers only (Docker+Volume, Fly.io, Render, VPS, Local, Colab+Drive) is sufficient and $0-7/month.

Vercel/Lambda is v1.1.0 with Postgres.

---

## Quick Start for Colab

```python
# Cell 1: Mount Drive
from google.colab import drive
drive.mount('/content/drive')

# Cell 2: Clone and setup
%cd /content/drive/MyDrive/
!git clone https://github.com/sayedelazameydesign-crypto/12pro.git
%cd 12pro
!git checkout arena/01a0a9e0-12pro
!npm install
!mkdir -p /content/drive/MyDrive/12pro/certification/memory-fabric

# Cell 3: Run backend with Drive persistence
import os
os.environ['PERSISTENCE_PATH'] = '/content/drive/MyDrive/12pro/certification'
!PERSISTENCE_PATH=/content/drive/MyDrive/12pro/certification npx tsx services/api-server/src/index.ts &
```

**Done** - Persistence now survives Colab restarts via Drive.

---

**Cost**: $0
**Persistence**: ✅ Survives Colab restart via Drive
**For**: $0 budget users on Colab
**Alternative to**: Postgres $5-30/month for serverless
