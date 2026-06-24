"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeService = exports.NodeService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../db/database"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class NodeService {
    async discoverNodes() {
        const kubectlPath = this.getSetting('kubectl_path') || '/usr/local/bin/kubectl';
        try {
            const { stdout } = await execAsync(`${kubectlPath} get nodes -o custom-columns=NAME:.metadata.name,IP:.status.addresses[0].address,STATUS:.status.conditions[-1].type,VERSION:.status.nodeInfo.kubeletVersion,ROLES:.metadata.labels.kubernetes\\.io/role --no-headers 2>/dev/null || ${kubectlPath} get nodes -o wide --no-headers`);
            const nodes = this.parseKubectlOutput(stdout);
            this.saveNodes(nodes);
            return nodes;
        }
        catch (err) {
            console.error('kubectl discovery failed, using cached nodes:', err.message);
            return this.getCachedNodes();
        }
    }
    parseKubectlOutput(stdout) {
        const nodes = [];
        const lines = stdout.trim().split('\n').filter(l => l.trim());
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 3)
                continue;
            // Handle both 'kubectl get nodes -o wide' format and custom-columns format
            const name = parts[0];
            const status = parts[1] === 'Ready' || parts[1] === 'NotReady' ? parts[1] : 'Unknown';
            const version = parts.find(p => p.startsWith('v1.')) || '';
            const ip = parts.find(p => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(p)) || '';
            nodes.push({
                id: (0, uuid_1.v4)(),
                name,
                ip,
                status: status,
                version,
                role: name.includes('master') || name.includes('control') ? 'control-plane' : 'worker',
                createdAt: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
            });
        }
        return nodes;
    }
    saveNodes(nodes) {
        const stmt = database_1.default.prepare(`
      INSERT INTO nodes (id, name, ip, status, version, role, last_seen, created_at)
      VALUES (@id, @name, @ip, @status, @version, @role, @lastSeen, @createdAt)
      ON CONFLICT(name) DO UPDATE SET
        ip = excluded.ip,
        status = excluded.status,
        version = excluded.version,
        last_seen = excluded.last_seen
    `);
        const transaction = database_1.default.transaction((nodes) => {
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
    getCachedNodes() {
        const rows = database_1.default.prepare('SELECT * FROM nodes ORDER BY name').all();
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
    getNodeConfigs() {
        const rows = database_1.default.prepare('SELECT * FROM node_configs ORDER BY node_name').all();
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
    getNodeConfig(nodeName) {
        const row = database_1.default.prepare('SELECT * FROM node_configs WHERE node_name = ?').get(nodeName);
        if (!row)
            return null;
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
    saveNodeConfig(config) {
        const existing = database_1.default.prepare('SELECT id FROM node_configs WHERE node_name = ?').get(config.nodeName);
        const id = existing?.id || (0, uuid_1.v4)();
        database_1.default.prepare(`
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
        const nodeExists = database_1.default.prepare('SELECT id FROM nodes WHERE name = ?').get(config.nodeName);
        if (!nodeExists) {
            database_1.default.prepare(`
        INSERT OR IGNORE INTO nodes (id, name, ip, status, version, role, last_seen, created_at)
        VALUES (?, ?, ?, 'Unknown', '', 'worker', datetime('now'), datetime('now'))
      `).run((0, uuid_1.v4)(), config.nodeName, config.host);
        }
        return { ...config, id };
    }
    deleteNodeConfig(nodeName) {
        database_1.default.prepare('DELETE FROM node_configs WHERE node_name = ?').run(nodeName);
    }
    getSetting(key) {
        const row = database_1.default.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row?.value || null;
    }
    addManualNode(name, ip, role) {
        const id = (0, uuid_1.v4)();
        const node = {
            id,
            name,
            ip,
            status: 'Unknown',
            version: '',
            role: role || 'worker',
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
        };
        database_1.default.prepare(`
      INSERT OR REPLACE INTO nodes (id, name, ip, status, version, role, last_seen, created_at)
      VALUES (@id, @name, @ip, @status, @version, @role, @lastSeen, @createdAt)
    `).run({
            id: node.id, name: node.name, ip: node.ip, status: node.status,
            version: node.version, role: node.role, lastSeen: node.lastSeen, createdAt: node.createdAt
        });
        return node;
    }
    deleteNode(name) {
        database_1.default.prepare('DELETE FROM nodes WHERE name = ?').run(name);
        database_1.default.prepare('DELETE FROM node_configs WHERE node_name = ?').run(name);
        database_1.default.prepare('DELETE FROM image_cache WHERE node_name = ?').run(name);
    }
}
exports.NodeService = NodeService;
exports.nodeService = new NodeService();
//# sourceMappingURL=nodeService.js.map