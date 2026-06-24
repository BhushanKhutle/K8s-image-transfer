import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { sshService } from './sshService';
import { nodeService } from './nodeService';
import { ImageRow } from '../types';

export class ImageService {
  async fetchImagesFromNode(nodeName: string): Promise<string[]> {
    const images = await sshService.getDockerImages(nodeName);

    // Update cache
    const deleteStmt = db.prepare('DELETE FROM image_cache WHERE node_name = ?');
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO image_cache (id, node_name, image_name, repository, tag, fetched_at)
      VALUES (@id, @nodeName, @imageName, @repository, @tag, datetime('now'))
    `);

    const transaction = db.transaction(() => {
      deleteStmt.run(nodeName);
      for (const image of images) {
        const parts = image.split(':');
        const tag = parts.length > 1 ? parts[parts.length - 1] : 'latest';
        const repo = parts.slice(0, -1).join(':') || image;

        insertStmt.run({
          id: uuidv4(),
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

  async refreshAllNodes(): Promise<{ node: string; imageCount: number; error?: string }[]> {
    const nodes = nodeService.getCachedNodes();
    const results = [];

    for (const node of nodes) {
      const config = nodeService.getNodeConfig(node.name);
      if (!config) {
        // Clear cache for this node since we can't reach it
        db.prepare('DELETE FROM image_cache WHERE node_name = ?').run(node.name);
        results.push({ node: node.name, imageCount: 0, error: 'No SSH config' });
        continue;
      }

      try {
        const images = await this.fetchImagesFromNode(node.name);
        results.push({ node: node.name, imageCount: images.length });
      } catch (err: any) {
        // Clear stale cache on error so UI shows unknown state
        db.prepare('DELETE FROM image_cache WHERE node_name = ?').run(node.name);
        results.push({ node: node.name, imageCount: 0, error: err.message });
      }
    }

    return results;
  }

  getImageInventory(search?: string): ImageRow[] {
    const nodes = nodeService.getCachedNodes();
    const nodeNames = nodes.map(n => n.name);

    // Get all unique images from cache
    let query = `
      SELECT DISTINCT image_name, repository, tag
      FROM image_cache
    `;
    const params: any[] = [];

    if (search) {
      query += ` WHERE image_name LIKE ? OR repository LIKE ? OR tag LIKE ?`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY image_name';

    const images = db.prepare(query).all(...params) as any[];

    const getPresence = db.prepare(`
      SELECT node_name FROM image_cache WHERE image_name = ?
    `);

    return images.map(img => {
      const presentNodes = (getPresence.all(img.image_name) as any[]).map(r => r.node_name);

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

  getMissingNodes(imageName: string): string[] {
    const nodes = nodeService.getCachedNodes();
    const presentRows = db.prepare(
      'SELECT node_name FROM image_cache WHERE image_name = ?'
    ).all(imageName) as any[];

    const presentNodes = new Set(presentRows.map(r => r.node_name));
    return nodes
      .filter(n => !presentNodes.has(n.name))
      .map(n => n.name);
  }

  getSourceNodes(imageName: string): string[] {
    const rows = db.prepare(
      'SELECT node_name FROM image_cache WHERE image_name = ?'
    ).all(imageName) as any[];
    return rows.map(r => r.node_name);
  }

  getLastCacheTime(): string | null {
    const row = db.prepare(
      'SELECT MAX(fetched_at) as last_fetch FROM image_cache'
    ).get() as any;
    return row?.last_fetch || null;
  }

  markImagePresent(nodeName: string, imageName: string): void {
    const parts = imageName.split(':');
    const tag = parts.length > 1 ? parts[parts.length - 1] : 'latest';
    const repo = parts.slice(0, -1).join(':') || imageName;

    db.prepare(`
      INSERT OR REPLACE INTO image_cache (id, node_name, image_name, repository, tag, fetched_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(uuidv4(), nodeName, imageName, repo, tag);
  }
}

export const imageService = new ImageService();
