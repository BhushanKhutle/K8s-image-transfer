"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodesController = void 0;
const nodeService_1 = require("../services/nodeService");
const sshService_1 = require("../services/sshService");
exports.nodesController = {
    async getNodes(req, res) {
        try {
            const discover = req.query.discover === 'true';
            const nodes = discover
                ? await nodeService_1.nodeService.discoverNodes()
                : nodeService_1.nodeService.getCachedNodes();
            res.json({ nodes });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async addNode(req, res) {
        try {
            const { name, ip, role } = req.body;
            if (!name || !ip) {
                return res.status(400).json({ error: 'name and ip are required' });
            }
            const node = nodeService_1.nodeService.addManualNode(name, ip, role);
            res.status(201).json({ node });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async deleteNode(req, res) {
        try {
            const { name } = req.params;
            nodeService_1.nodeService.deleteNode(name);
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async getNodeConfigs(req, res) {
        try {
            const configs = nodeService_1.nodeService.getNodeConfigs();
            res.json({ configs });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async saveNodeConfig(req, res) {
        try {
            const config = req.body;
            if (!config.nodeName || !config.host || !config.username) {
                return res.status(400).json({ error: 'nodeName, host, and username are required' });
            }
            const saved = nodeService_1.nodeService.saveNodeConfig(config);
            // Don't return sensitive fields
            res.json({ config: { ...saved, password: undefined, privateKey: undefined, passphrase: undefined } });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async deleteNodeConfig(req, res) {
        try {
            const { nodeName } = req.params;
            nodeService_1.nodeService.deleteNodeConfig(nodeName);
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async testConnection(req, res) {
        try {
            const { nodeName } = req.params;
            const result = await sshService_1.sshService.testConnection(nodeName);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
};
//# sourceMappingURL=nodesController.js.map