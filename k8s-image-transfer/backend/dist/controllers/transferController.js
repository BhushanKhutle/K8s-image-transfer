"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferController = void 0;
const transferService_1 = require("../services/transferService");
exports.transferController = {
    async startTransfer(req, res) {
        try {
            const request = req.body;
            if (!request.imageName || !request.sourceNode || !request.destinationNodes?.length) {
                return res.status(400).json({
                    error: 'imageName, sourceNode, and destinationNodes are required',
                });
            }
            if (request.destinationNodes.includes(request.sourceNode)) {
                return res.status(400).json({
                    error: 'Source node cannot be a destination node',
                });
            }
            const jobs = await transferService_1.transferService.startTransfer(request);
            res.status(202).json({ jobs });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async getActiveJobs(req, res) {
        try {
            const jobs = transferService_1.transferService.getActiveJobs();
            res.json({ jobs });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async getJob(req, res) {
        try {
            const job = transferService_1.transferService.getJob(req.params.jobId);
            if (!job)
                return res.status(404).json({ error: 'Job not found' });
            res.json({ job });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async getHistory(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;
            const result = transferService_1.transferService.getHistory(limit, offset);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async getStats(req, res) {
        try {
            const stats = transferService_1.transferService.getStats();
            res.json(stats);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    // Server-Sent Events for real-time job updates
    streamJobUpdates(req, res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();
        // Send current active jobs immediately
        const activeJobs = transferService_1.transferService.getActiveJobs();
        res.write(`data: ${JSON.stringify({ type: 'init', jobs: activeJobs })}\n\n`);
        const onUpdate = (job) => {
            res.write(`data: ${JSON.stringify({ type: 'job-update', job })}\n\n`);
        };
        transferService_1.transferEvents.on('job-update', onUpdate);
        // Heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
            res.write(': heartbeat\n\n');
        }, 30000);
        req.on('close', () => {
            transferService_1.transferEvents.off('job-update', onUpdate);
            clearInterval(heartbeat);
        });
    },
};
//# sourceMappingURL=transferController.js.map