import { Request, Response } from 'express';
import { nodeService } from '../services/nodeService';
import { sshService } from '../services/sshService';

export const nodesController = {
  async getNodes(req: Request, res: Response) {
    try {
      const discover = req.query.discover === 'true';
      const nodes = discover
        ? await nodeService.discoverNodes()
        : nodeService.getCachedNodes();
      res.json({ nodes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async addNode(req: Request, res: Response) {
    try {
      const { name, ip, role } = req.body;
      if (!name || !ip) {
        return res.status(400).json({ error: 'name and ip are required' });
      }
      const node = nodeService.addManualNode(name, ip, role);
      res.status(201).json({ node });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteNode(req: Request, res: Response) {
    try {
      const { name } = req.params;
      nodeService.deleteNode(name);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getNodeConfigs(req: Request, res: Response) {
    try {
      const configs = nodeService.getNodeConfigs();
      res.json({ configs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async saveNodeConfig(req: Request, res: Response) {
    try {
      const config = req.body;
      if (!config.nodeName || !config.host || !config.username) {
        return res.status(400).json({ error: 'nodeName, host, and username are required' });
      }
      const saved = nodeService.saveNodeConfig(config);
      // Don't return sensitive fields
      res.json({ config: { ...saved, password: undefined, privateKey: undefined, passphrase: undefined } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteNodeConfig(req: Request, res: Response) {
    try {
      const { nodeName } = req.params;
      nodeService.deleteNodeConfig(nodeName);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async testConnection(req: Request, res: Response) {
    try {
      const { nodeName } = req.params;
      const result = await sshService.testConnection(nodeName);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
