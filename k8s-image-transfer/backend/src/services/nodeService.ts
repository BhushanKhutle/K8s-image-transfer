import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { Node, NodeConfig } from '../types';

const execAsync = promisify(exec);

export class NodeService {
  async discoverNodes(): Promise<Node[]> {
    const kubectlPath = this.getSetting('kubectl_path') || '/usr/local/bin/kubectl';

    try {
      const { stdout } = await execAsync(
        `${kubectlPath} get nodes -o custom-columns=NAME:.metadata.name,IP:.status.addresses[0].address,STATUS:.status.conditions[-1].type,VERSION:.status.nodeInfo.kubeletVersion,ROLES:.metadata.labels.kubernetes\\.io/role --no-headers 2>/dev/null || ${kubectlPath} get nodes -o wide --no-headers`
      );

      const nodes = this.parseKubectlOutput(stdout);
      this.saveNodes(nodes);
      return nodes;
    } catch (err: any) {
      console.error('kubectl discovery failed, using cached nodes:', err.message);
      return this.getCachedNodes();
    }
  }

  private parseKubectlOutput(stdout: string): Node[] {
    const nodes: Node[] = [];
    const lines = stdout.trim().split('\n').filter(l => l.trim());

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;

      // Handle both 'kubectl get nodes -o wide' format and custom-columns format
      const name = parts[0];
      const status = parts[1] === 'Ready' || parts[1] === 'NotReady' ? parts[1] : 'Unknown';
      const version = parts.find(p => p.startsWith('v1.')) || '';
      const ip = parts.find(p => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(p)) || '';

      nodes.push({
        id: uuidv4(),
        name,
        ip,
        status: status as 'Ready' | 'NotReady' | 'Unknown',
        version,
        role: name.includes('master') || name.includes('control') ? 'control-plane' : 'worker',
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });
    }

    return nodes;
  }

  private saveNodes(nodes: Node[]): void {
    const stmt = db.prepare(`
      INSERT INTO nodes (id, name, ip, status, version, role, last_seen, created_at)
      VALUES (@id, @name, @ip, @status, @version, @role, @lastSeen, @createdAt)
      ON CONFLICT(name) DO UPDATE SET
        ip = excluded.ip,
        status = excluded.status,
        version = excluded.version,
        last_seen = excluded.last_seen
    `);

    const transaction = db.transaction((nodes: Node[]) => {
      for (const node of nodes) {
        stmt.run({
          id: node.id,
          name: node.name,
          ip: node.ip,
          status: node.status,
          version: node.version,
          role: node.role,
          lastSeen: node.lastSeen,
          createdAt: node.createdAt,
        });
      }
    });

    transaction(nodes);
  }

  getCachedNodes(): Node[] {
    const rows = db.prepare('SELECT * FROM nodes ORDER BY name').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      ip: row.ip,
      status: row.status,
      version: row.version,
      role: row.role,
      createdAt: row.created_at,
      lastSeen: row.last_seen,
    }));
  }

  getNodeConfigs(): NodeConfig[] {
    const rows = db.prepare('SELECT * FROM node_configs ORDER BY node_name').all() as any[];
    return rows.map(row => ({
      id: row.id,
      nodeName: row.node_name,
      host: row.host,
      port: row.port,
      username: row.username,
      authType: row.auth_type,
      password: row.password ? '***' : undefined,
      privateKey: row.private_key ? '***' : undefined,
    }));
  }

  getNodeConfig(nodeName: string): NodeConfig | null {
    const row = db.prepare('SELECT * FROM node_configs WHERE node_name = ?').get(nodeName) as any;
    if (!row) return null;
    return {
      id: row.id,
      nodeName: row.node_name,
      host: row.host,
      port: row.port,
      username: row.username,
      authType: row.auth_type,
      password: row.password,
      privateKey: row.private_key,
      passphrase: row.passphrase,
    };
  }

  saveNodeConfig(config: Omit<NodeConfig, 'id'>): NodeConfig {
    const existing = db.prepare('SELECT id FROM node_configs WHERE node_name = ?').get(config.nodeName) as any;
    const id = existing?.id || uuidv4();

    db.prepare(`
      INSERT INTO node_configs (id, node_name, host, port, username, auth_type, password, private_key, passphrase, updated_at)
      VALUES (@id, @nodeName, @host, @port, @username, @authType, @password, @privateKey, @passphrase, datetime('now'))
      ON CONFLICT(node_name) DO UPDATE SET
        host = excluded.host,
        port = excluded.port,
        username = excluded.username,
        auth_type = excluded.auth_type,
        password = excluded.password,
        private_key = excluded.private_key,
        passphrase = excluded.passphrase,
        updated_at = datetime('now')
    `).run({
      id,
      nodeName: config.nodeName,
      host: config.host,
      port: config.port,
      username: config.username,
      authType: config.authType,
      password: config.password || null,
      privateKey: config.privateKey || null,
      passphrase: config.passphrase || null,
    });

    // Also ensure node exists in nodes table
    const nodeExists = db.prepare('SELECT id FROM nodes WHERE name = ?').get(config.nodeName);
    if (!nodeExists) {
      db.prepare(`
        INSERT OR IGNORE INTO nodes (id, name, ip, status, version, role, last_seen, created_at)
        VALUES (?, ?, ?, 'Unknown', '', 'worker', datetime('now'), datetime('now'))
      `).run(uuidv4(), config.nodeName, config.host);
    }

    return { ...config, id };
  }

  deleteNodeConfig(nodeName: string): void {
    db.prepare('DELETE FROM node_configs WHERE node_name = ?').run(nodeName);
  }

  private getSetting(key: string): string | null {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    return row?.value || null;
  }

  addManualNode(name: string, ip: string, role?: string): Node {
    const id = uuidv4();
    const node: Node = {
      id,
      name,
      ip,
      status: 'Unknown',
      version: '',
      role: role || 'worker',
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };

    db.prepare(`
      INSERT OR REPLACE INTO nodes (id, name, ip, status, version, role, last_seen, created_at)
      VALUES (@id, @name, @ip, @status, @version, @role, @lastSeen, @createdAt)
    `).run({
      id: node.id, name: node.name, ip: node.ip, status: node.status,
      version: node.version, role: node.role, lastSeen: node.lastSeen, createdAt: node.createdAt
    });

    return node;
  }

  deleteNode(name: string): void {
    db.prepare('DELETE FROM nodes WHERE name = ?').run(name);
    db.prepare('DELETE FROM node_configs WHERE node_name = ?').run(name);
    db.prepare('DELETE FROM image_cache WHERE node_name = ?').run(name);
  }
}

export const nodeService = new NodeService();
