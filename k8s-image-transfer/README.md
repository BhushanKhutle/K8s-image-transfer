# K8s Image Transfer Manager

A production-grade web application for managing Docker image distribution across air-gapped Kubernetes cluster nodes — **manual-only, no automatic sync**.

## Architecture

```
Browser
  → LB (SSL 443) → https://<your-domain>/docker-ui
  → Worker Node nginx:<nodeport>
  → /docker-ui/      → Master Node:3002 (frontend container)
  → /docker-ui/api/  → Master Node:3001 (backend container)
```

```
┌─────────────────────────────────────────────────────┐
│           Browser (React + MUI Dark Theme)           │
│   Dashboard | Nodes | Images | History | Settings    │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS + SSE
┌─────────────────────▼───────────────────────────────┐
│           Backend (Node.js + Express + TS)           │
│   REST API │ SSE Events │ SSH Service │ SQLite DB    │
└──────┬──────────────────────────────────────────────┘
       │ SSH (node-ssh + execSync)
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
| SSH | node-ssh + execSync |
| Database | SQLite (better-sqlite3) |
| Deployment | Docker + Docker Compose |
| Web Server | Nginx |
| Process Manager | PM2 (for non-Docker deployments) |

## Transfer Mechanism

Images are transferred using the classic SSH pipe — runs entirely between nodes, backend just triggers it:

```bash
ssh source "docker save image:tag" | ssh dest "docker load"
```

- No temp files stored on backend
- No SFTP relay overhead
- Direct node-to-node streaming
- Private keys written as temp files locally with proper permissions

## Project Structure

```
k8s-image-transfer/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express entry point
│   │   ├── db/database.ts        # SQLite init + schema
│   │   ├── types/index.ts        # TypeScript interfaces
│   │   ├── services/
│   │   │   ├── sshService.ts     # SSH connect + transfer
│   │   │   ├── nodeService.ts    # Node discovery + config
│   │   │   ├── imageService.ts   # Image inventory + cache
│   │   │   └── transferService.ts # Job lifecycle + SSE
│   │   ├── controllers/          # Express route handlers
│   │   └── routes/index.ts       # All REST endpoints
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Router + theme
│   │   ├── theme/index.ts        # MUI dark theme
│   │   ├── utils/api.ts          # Axios API layer
│   │   ├── types/index.ts        # TypeScript interfaces
│   │   └── components/
│   │       ├── layout/           # Sidebar navigation
│   │       ├── dashboard/        # Stats + active jobs
│   │       ├── nodes/            # Node + SSH config mgmt
│   │       ├── images/           # Image inventory matrix
│   │       ├── transfer/         # Export dialog + progress
│   │       ├── history/          # Transfer audit log
│   │       └── settings/         # App configuration
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.ts
│   └── package.json
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

## Database Schema

```sql
node_configs      -- SSH credentials per node (host, port, user, key/password)
nodes             -- Discovered/manual nodes (name, IP, status, version)
image_cache       -- Cached image inventory from SSH scans
transfer_history  -- Complete transfer audit log
settings          -- App configuration key-value store
```

## REST API Reference

```
GET    /api/nodes                            List all nodes
POST   /api/nodes                            Add node manually
DELETE /api/nodes/:name                      Remove node

GET    /api/node-configs                     List SSH configs
POST   /api/node-configs                     Save SSH config
DELETE /api/node-configs/:nodeName           Remove SSH config
GET    /api/node-configs/:nodeName/test      Test SSH connection

GET    /api/images                           Image inventory (all nodes)
GET    /api/images?search=nginx              Search images
POST   /api/images/refresh                   Rescan all nodes
POST   /api/images/refresh?nodeName=w1       Rescan specific node
GET    /api/images/:imageName/missing-nodes  Get missing nodes for image

POST   /api/transfer-image                   Start transfer job(s)
GET    /api/transfer-jobs                    Active jobs
GET    /api/transfer-jobs/:id                Single job status
GET    /api/transfer-jobs/stream/events      SSE stream for live updates

GET    /api/history                          Transfer history (paginated)
GET    /api/stats                            Aggregate statistics

GET    /api/settings                         All settings
PUT    /api/settings                         Update settings

GET    /health                               Health check
```

---

## Deployment Guide

### Prerequisites

- Docker + Docker Compose
- Nginx on worker nodes
- SSH access to all Kubernetes worker nodes
- Load Balancer with SSL termination

---

### Step 1 — Clone the repository

```bash
git clone <repo>
cd k8s-image-transfer
```

---

### Step 2 — Build Docker images

**Update the base path if needed** (default is `/docker-ui`):

```bash
# frontend/vite.config.ts — already set to /docker-ui
# frontend/src/utils/api.ts — already set to /docker-ui/api
```

**Build images:**

```bash
docker build -t k8s-transfer-backend:1.1 ./backend
docker build -t k8s-transfer-frontend:1.1 ./frontend
```

---

### Step 3 — Deploy on Master Node

Create `/opt/deployment/docker-compose.yml`:

```yaml
version: '3.8'
services:
  backend:
    image: k8s-transfer-backend:1.1
    container_name: k8s-transfer-backend
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=/app/data/k8s-transfer.db
      - CORS_ORIGIN=https://your-domain.ril.com
    volumes:
      - db_data:/app/data
    ports:
      - "3001:3001"

  frontend:
    image: k8s-transfer-frontend:1.1
    container_name: k8s-transfer-frontend
    restart: always
    ports:
      - "3002:80"
    depends_on:
      - backend

volumes:
  db_data:
    name: k8s-transfer-db
```

```bash
docker compose -f /opt/deployment/docker-compose.yml up -d
```

---

### Step 4 — Configure Nginx on Worker Nodes

Add to existing `server` block in `/etc/nginx/nginx.conf` or `/etc/nginx/conf.d/*.conf`:

```nginx
# K8s Image Transfer Manager - Frontend
location /docker-ui/ {
    proxy_pass http://<MASTER_NODE_IP>:3002/docker-ui/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# K8s Image Transfer Manager - Backend API
location /docker-ui/api/ {
    proxy_pass http://<MASTER_NODE_IP>:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header X-Accel-Buffering no;
}
```

```bash
nginx -t && nginx -s reload
```

---

### Step 5 — Access the app

```
https://your-domain.ril.com/docker-ui
```

---

## Deploying to a New Cluster

Only 3 things change per cluster:

### 1. Update CORS in docker-compose

```yaml
environment:
  - CORS_ORIGIN=https://new-cluster-domain.ril.com
```

### 2. Update nginx on worker nodes

```nginx
proxy_pass http://<NEW_MASTER_NODE_IP>:3002/docker-ui/;
proxy_pass http://<NEW_MASTER_NODE_IP>:3001/api/;
```

### 3. Transfer Docker images to new cluster

```bash
# Save on source cluster
docker save k8s-transfer-backend:1.1 | gzip > backend.tar.gz
docker save k8s-transfer-frontend:1.1 | gzip > frontend.tar.gz

# Copy to new cluster master node
scp backend.tar.gz frontend.tar.gz root@<NEW_MASTER_IP>:/opt/

# Load on new cluster
docker load < /opt/backend.tar.gz
docker load < /opt/frontend.tar.gz

# Start
docker compose -f /opt/deployment/docker-compose.yml up -d
```

> **Note:** Frontend image stays the same across clusters as long as the `/docker-ui` base path doesn't change. Only `CORS_ORIGIN` needs updating in docker-compose.

---

## First-Time Setup in UI

1. **Nodes page** → Add nodes manually or click "Discover via kubectl"
2. **Nodes page** → SSH Configs tab → Add SSH credentials for each node → Test Connection
3. **Images page** → Click "Scan All Nodes" to populate inventory
4. Find image with gap (amber badge) → Click **Export To** → Select nodes → Click **Copy Image**

---

## SSH Configuration

Supports both password and private key authentication:

| Field | Description |
|-------|-------------|
| Node Name | Must match node name in cluster |
| Host | IP address of the node |
| Port | SSH port (default 22) |
| Username | SSH user (e.g. root, ubuntu) |
| Auth Type | password or privateKey |
| Private Key | Full PEM content including headers |

> **Important:** Private keys must include a trailing newline to be valid for system SSH commands.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend API port |
| `DB_PATH` | `/app/data/k8s-transfer.db` | SQLite file location |
| `SSH_TIMEOUT` | `30000` | SSH connect timeout (ms) |
| `TRANSFER_TIMEOUT` | `300000` | Max transfer time (ms) |
| `CORS_ORIGIN` | `http://localhost:3000` | Frontend URL for CORS |

---

## Security Notes

- SSH private keys stored in SQLite — use filesystem encryption in production
- Keys written as temp files (`/tmp/k8s-key-*.pem`) with `chmod 600`, deleted after use
- No credentials logged or exposed via API after initial save
- The app never auto-syncs — all transfers are user-initiated only

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Load key: error in libcrypto` | Private key missing trailing newline |
| `SCP failed: Permission denied` | Wrong SSH credentials or key format |
| Scan All Nodes 500 error | Frontend sending null body — ensure latest frontend build |
| Image cache stale after delete | Click Scan All Nodes to force refresh |
| Transfer stuck at 35% | Large image — wait, or check backend logs |
| Site not accessible via LB | Check LB pool, worker node nginx port, and master node containers |
