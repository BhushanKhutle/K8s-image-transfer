# K8s Image Transfer Manager

A web application for managing Docker image distribution across air-gapped Kubernetes cluster nodes — **manual-only, no automatic sync**.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser (React + MUI)               │
│   Dashboard | Nodes | Images | History | Settings    │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP + SSE
┌─────────────────────▼───────────────────────────────┐
│              Backend (Node.js + Express)             │
│   REST API │ SSE Events │ SSH Service │ SQLite DB    │
└──────┬──────────────────────────────────────────────┘
       │ SSH (node-ssh)
┌──────▼──────────────────────────────────────────────┐
│            Kubernetes Worker Nodes                   │
│   worker1 (docker) │ worker2 (docker) │ worker3 ...  │
└─────────────────────────────────────────────────────┘
```

## Features

- **Cluster Discovery** — fetch nodes via `kubectl get nodes` or add manually
- **Image Inventory** — SSH into each node, scan Docker images, display matrix view
- **Gap Detection** — instantly see which images are missing on which nodes
- **Manual Export** — select source node and destination nodes, copy image via SSH pipe
- **Real-time Progress** — Server-Sent Events for live job status
- **Transfer History** — complete audit log with timestamps, duration, and errors
- **No Auto-sync** — images are ONLY copied when you explicitly click "Copy Image"

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Material UI 5 |
| Backend | Node.js + Express + TypeScript |
| SSH | node-ssh |
| Database | SQLite (better-sqlite3) |
| Deployment | Docker + Docker Compose |

## Quick Start

### Using Docker Compose (recommended)

```bash
git clone <repo>
cd k8s-image-transfer

# Start the stack
docker-compose up -d

# View logs
docker-compose logs -f

# Open the UI
open http://localhost:3000
```

### Local Development

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
# Visit http://localhost:5173
```

## Setup Guide

### 1. Add Nodes

**Option A: kubectl discovery**
```
Go to Nodes page → Click "Discover via kubectl"
```

**Option B: Manual**
```
Go to Nodes page → Click "Add Node" → Enter name and IP
```

### 2. Configure SSH Access

For each node, add SSH credentials:
```
Nodes page → SSH Configs tab → Add SSH Config

Fields:
  Node Name: worker1
  Host: 192.168.1.10
  Port: 22
  Username: ubuntu
  Auth Type: password | privateKey
```

**Test the connection** with the wifi icon on each row.

### 3. Scan Images

```
Images page → Click "Scan All Nodes"
```
This SSHes into each node and runs `docker images`.

### 4. Export an Image

1. Find an image with gaps (amber `3/5 nodes` chip)
2. Click **Export To** button
3. Select source node (where image exists)
4. Select destination nodes (where image is missing)
5. Click **Copy Image**

The transfer runs:
```bash
# On source node: docker save → gzip → temp file
# SCP temp file to destination node
# On destination node: docker load
# Cleanup temp files
```

## REST API Reference

```
GET    /api/nodes                          List all nodes
POST   /api/nodes                          Add node manually
DELETE /api/nodes/:name                    Remove node

GET    /api/node-configs                   List SSH configs
POST   /api/node-configs                   Save SSH config
DELETE /api/node-configs/:nodeName         Remove SSH config
GET    /api/node-configs/:nodeName/test    Test SSH connection

GET    /api/images                         Image inventory (all nodes)
GET    /api/images?search=nginx            Search images
POST   /api/images/refresh                 Rescan all nodes
POST   /api/images/refresh?nodeName=w1     Rescan specific node
GET    /api/images/:imageName/missing-nodes  Get missing nodes for image

POST   /api/transfer-image                 Start transfer job(s)
GET    /api/transfer-jobs                  Active jobs
GET    /api/transfer-jobs/:id              Single job status
GET    /api/transfer-jobs/stream/events    SSE stream for live updates

GET    /api/history                        Transfer history (paginated)
GET    /api/stats                          Aggregate statistics

GET    /api/settings                       All settings
PUT    /api/settings                       Update settings

GET    /health                             Health check
```

## Database Schema

```sql
node_configs      -- SSH credentials per node
nodes             -- Discovered/manual nodes
image_cache       -- Cached image inventory from SSH scans
transfer_history  -- Complete transfer audit log
settings          -- App configuration key-value store
```

## Transfer Mechanism

Images are transferred in two phases:

**Phase 1: Save on source**
```bash
ssh worker3 "docker save nginx:1.25 | gzip > /tmp/transfer-XYZ.tar.gz"
```

**Phase 2: SCP to destination + load**
```bash
# SCP from source to dest
scp /tmp/transfer-XYZ.tar.gz worker1:/tmp/transfer-XYZ.tar.gz

# Load on destination
ssh worker1 "docker load < /tmp/transfer-XYZ.tar.gz && rm /tmp/transfer-XYZ.tar.gz"
```

Temp files are cleaned up on both nodes after transfer.

## Security Notes

- SSH private keys are stored in SQLite; use filesystem encryption in production
- The backend runs SSH commands as the configured user — use least-privilege accounts
- No credentials are logged or exposed via API after initial save
- Supports both password and private key authentication

## Environment Variables

```bash
PORT=3001                       # API port
DB_PATH=/app/data/k8s-transfer.db  # SQLite file location
SSH_TIMEOUT=30000               # SSH connect timeout (ms)
TRANSFER_TIMEOUT=300000         # Max transfer time (ms)
CORS_ORIGIN=http://localhost:3000  # Frontend URL
```
