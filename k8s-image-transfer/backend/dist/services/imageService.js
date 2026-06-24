"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageService = exports.ImageService = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../db/database"));
const sshService_1 = require("./sshService");
const nodeService_1 = require("./nodeService");
class ImageService {
    async fetchImagesFromNode(nodeName) {
        const images = await sshService_1.sshService.getDockerImages(nodeName);
        // Update cache
        const deleteStmt = database_1.default.prepare('DELETE FROM image_cache WHERE node_name = ?');
        const insertStmt = database_1.default.prepare(`
      INSERT OR REPLACE INTO image_cache (id, node_name, image_name, repository, tag, fetched_at)
      VALUES (@id, @nodeName, @imageName, @repository, @tag, datetime('now'))
    `);
        const transaction = database_1.default.transaction(() => {
            deleteStmt.run(nodeName);
            for (const image of images) {
                const parts = image.split(':');
                const tag = parts.length > 1 ? parts[parts.length - 1] : 'latest';
                const repo = parts.slice(0, -1).join(':') || image;
                insertStmt.run({
                    id: (0, uuid_1.v4)(),
                    nodeName,
                    imageName: image,
                    repository: repo,
                    tag,
                });
            }
        });
        transaction();
        return images;
    }
    async refreshAllNodes() {
        const nodes = nodeService_1.nodeService.getCachedNodes();
        const results = [];
        for (const node of nodes) {
            const config = nodeService_1.nodeService.getNodeConfig(node.name);
            if (!config) {
                // Clear cache for this node since we can't reach it
                database_1.default.prepare('DELETE FROM image_cache WHERE node_name = ?').run(node.name);
                results.push({ node: node.name, imageCount: 0, error: 'No SSH config' });
                continue;
            }
            try {
                const images = await this.fetchImagesFromNode(node.name);
                results.push({ node: node.name, imageCount: images.length });
            }
            catch (err) {
                // Clear stale cache on error so UI shows unknown state
                database_1.default.prepare('DELETE FROM image_cache WHERE node_name = ?').run(node.name);
                results.push({ node: node.name, imageCount: 0, error: err.message });
            }
        }
        return results;
    }
    getImageInventory(search) {
        const nodes = nodeService_1.nodeService.getCachedNodes();
        const nodeNames = nodes.map(n => n.name);
        // Get all unique images from cache
        let query = `
      SELECT DISTINCT image_name, repository, tag
      FROM image_cache
    `;
        const params = [];
        if (search) {
            query += ` WHERE image_name LIKE ? OR repository LIKE ? OR tag LIKE ?`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY image_name';
        const images = database_1.default.prepare(query).all(...params);
        const getPresence = database_1.default.prepare(`
      SELECT node_name FROM image_cache WHERE image_name = ?
    `);
        return images.map(img => {
            const presentNodes = getPresence.all(img.image_name).map(r => r.node_name);
            return {
                name: img.image_name,
                repository: img.repository,
                tag: img.tag,
                nodes: nodeNames.map(nodeName => ({
                    nodeName,
                    present: presentNodes.includes(nodeName),
                })),
            };
        });
    }
    getMissingNodes(imageName) {
        const nodes = nodeService_1.nodeService.getCachedNodes();
        const presentRows = database_1.default.prepare('SELECT node_name FROM image_cache WHERE image_name = ?').all(imageName);
        const presentNodes = new Set(presentRows.map(r => r.node_name));
        return nodes
            .filter(n => !presentNodes.has(n.name))
            .map(n => n.name);
    }
    getSourceNodes(imageName) {
        const rows = database_1.default.prepare('SELECT node_name FROM image_cache WHERE image_name = ?').all(imageName);
        return rows.map(r => r.node_name);
    }
    getLastCacheTime() {
        const row = database_1.default.prepare('SELECT MAX(fetched_at) as last_fetch FROM image_cache').get();
        return row?.last_fetch || null;
    }
    markImagePresent(nodeName, imageName) {
        const parts = imageName.split(':');
        const tag = parts.length > 1 ? parts[parts.length - 1] : 'latest';
        const repo = parts.slice(0, -1).join(':') || imageName;
        database_1.default.prepare(`
      INSERT OR REPLACE INTO image_cache (id, node_name, image_name, repository, tag, fetched_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run((0, uuid_1.v4)(), nodeName, imageName, repo, tag);
    }
}
exports.ImageService = ImageService;
exports.imageService = new ImageService();
//# sourceMappingURL=imageService.js.map