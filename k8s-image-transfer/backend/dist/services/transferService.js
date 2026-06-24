"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferService = exports.TransferService = exports.transferEvents = void 0;
const uuid_1 = require("uuid");
const events_1 = require("events");
const database_1 = __importDefault(require("../db/database"));
const sshService_1 = require("./sshService");
const imageService_1 = require("./imageService");
exports.transferEvents = new events_1.EventEmitter();
// In-memory active jobs
const activeJobs = new Map();
class TransferService {
    async startTransfer(request) {
        const jobs = [];
        for (const destNode of request.destinationNodes) {
            const job = {
                id: (0, uuid_1.v4)(),
                imageName: request.imageName,
                sourceNode: request.sourceNode,
                destinationNodes: [destNode],
                status: 'queued',
                progress: 0,
                startedAt: new Date().toISOString(),
            };
            activeJobs.set(job.id, job);
            jobs.push(job);
            // Start async transfer
            this.executeTransfer(job, destNode).catch(err => {
                console.error(`Transfer ${job.id} failed:`, err);
            });
        }
        return jobs;
    }
    async executeTransfer(job, destNode) {
        const startTime = Date.now();
        this.updateJob(job.id, { status: 'running', progress: 5 });
        try {
            await sshService_1.sshService.transferImageViaRelay(job.imageName, job.sourceNode, destNode, (msg) => {
                console.log(`[Transfer ${job.id}] ${msg}`);
                const progressMap = {
                    'Connecting to source': 10,
                    'Connecting to destination': 20,
                    'Saving image': 35,
                    'Transferring image': 60,
                    'Loading image': 80,
                    'Image loaded': 95,
                };
                const matchedKey = Object.keys(progressMap).find(k => msg.includes(k));
                if (matchedKey) {
                    this.updateJob(job.id, { progress: progressMap[matchedKey] });
                }
            });
            const durationMs = Date.now() - startTime;
            this.updateJob(job.id, { status: 'completed', progress: 100, durationMs });
            // Update image cache
            imageService_1.imageService.markImagePresent(destNode, job.imageName);
            // Save to history
            this.saveHistory({
                id: (0, uuid_1.v4)(),
                imageName: job.imageName,
                sourceNode: job.sourceNode,
                destinationNode: destNode,
                status: 'success',
                startedAt: job.startedAt,
                completedAt: new Date().toISOString(),
                durationMs,
            });
        }
        catch (err) {
            const durationMs = Date.now() - startTime;
            this.updateJob(job.id, {
                status: 'failed',
                progress: 0,
                error: err.message,
                durationMs,
            });
            this.saveHistory({
                id: (0, uuid_1.v4)(),
                imageName: job.imageName,
                sourceNode: job.sourceNode,
                destinationNode: destNode,
                status: 'failed',
                startedAt: job.startedAt,
                completedAt: new Date().toISOString(),
                durationMs,
                error: err.message,
            });
        }
        // Remove from active jobs after 5 minutes
        setTimeout(() => {
            activeJobs.delete(job.id);
        }, 5 * 60 * 1000);
    }
    updateJob(jobId, updates) {
        const job = activeJobs.get(jobId);
        if (!job)
            return;
        Object.assign(job, updates);
        if (updates.status === 'completed' || updates.status === 'failed') {
            job.completedAt = new Date().toISOString();
        }
        exports.transferEvents.emit('job-update', { ...job });
    }
    saveHistory(record) {
        database_1.default.prepare(`
      INSERT INTO transfer_history
        (id, image_name, source_node, destination_node, status, started_at, completed_at, duration_ms, error, created_at)
      VALUES
        (@id, @imageName, @sourceNode, @destinationNode, @status, @startedAt, @completedAt, @durationMs, @error, datetime('now'))
    `).run({
            id: record.id,
            imageName: record.imageName,
            sourceNode: record.sourceNode,
            destinationNode: record.destinationNode,
            status: record.status,
            startedAt: record.startedAt,
            completedAt: record.completedAt,
            durationMs: record.durationMs,
            error: record.error || null,
        });
    }
    getActiveJobs() {
        return Array.from(activeJobs.values());
    }
    getJob(jobId) {
        return activeJobs.get(jobId) || null;
    }
    getHistory(limit = 100, offset = 0) {
        const total = database_1.default.prepare('SELECT COUNT(*) as count FROM transfer_history').get().count;
        const rows = database_1.default.prepare(`
      SELECT * FROM transfer_history
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
        const records = rows.map(row => ({
            id: row.id,
            imageName: row.image_name,
            sourceNode: row.source_node,
            destinationNode: row.destination_node,
            status: row.status,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            durationMs: row.duration_ms,
            error: row.error,
        }));
        return { records, total };
    }
    getStats() {
        const row = database_1.default.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN status = 'success' THEN duration_ms ELSE NULL END) as avg_duration
      FROM transfer_history
    `).get();
        return {
            total: row.total || 0,
            success: row.success || 0,
            failed: row.failed || 0,
            avgDuration: Math.round(row.avg_duration || 0),
        };
    }
}
exports.TransferService = TransferService;
exports.transferService = new TransferService();
//# sourceMappingURL=transferService.js.map