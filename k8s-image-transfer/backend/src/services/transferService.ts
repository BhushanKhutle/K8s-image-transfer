import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import db from '../db/database';
import { sshService } from './sshService';
import { imageService } from './imageService';
import { TransferJob, TransferRecord, TransferRequest } from '../types';

export const transferEvents = new EventEmitter();

// In-memory active jobs
const activeJobs = new Map<string, TransferJob>();

export class TransferService {
  async startTransfer(request: TransferRequest): Promise<TransferJob[]> {
    const jobs: TransferJob[] = [];

    for (const destNode of request.destinationNodes) {
      const job: TransferJob = {
        id: uuidv4(),
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

  private async executeTransfer(job: TransferJob, destNode: string): Promise<void> {
    const startTime = Date.now();

    this.updateJob(job.id, { status: 'running', progress: 5 });

    try {
      await sshService.transferImageViaRelay(
        job.imageName,
        job.sourceNode,
        destNode,
        (msg: string) => {
          console.log(`[Transfer ${job.id}] ${msg}`);
          const progressMap: Record<string, number> = {
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
        }
      );

      const durationMs = Date.now() - startTime;
      this.updateJob(job.id, { status: 'completed', progress: 100, durationMs });

      // Update image cache
      imageService.markImagePresent(destNode, job.imageName);

      // Save to history
      this.saveHistory({
        id: uuidv4(),
        imageName: job.imageName,
        sourceNode: job.sourceNode,
        destinationNode: destNode,
        status: 'success',
        startedAt: job.startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
      });

    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      this.updateJob(job.id, {
        status: 'failed',
        progress: 0,
        error: err.message,
        durationMs,
      });

      this.saveHistory({
        id: uuidv4(),
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

  private updateJob(jobId: string, updates: Partial<TransferJob>): void {
    const job = activeJobs.get(jobId);
    if (!job) return;

    Object.assign(job, updates);
    if (updates.status === 'completed' || updates.status === 'failed') {
      job.completedAt = new Date().toISOString();
    }

    transferEvents.emit('job-update', { ...job });
  }

  private saveHistory(record: TransferRecord): void {
    db.prepare(`
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

  getActiveJobs(): TransferJob[] {
    return Array.from(activeJobs.values());
  }

  getJob(jobId: string): TransferJob | null {
    return activeJobs.get(jobId) || null;
  }

  getHistory(limit = 100, offset = 0): { records: TransferRecord[]; total: number } {
    const total = (db.prepare('SELECT COUNT(*) as count FROM transfer_history').get() as any).count;

    const rows = db.prepare(`
      SELECT * FROM transfer_history
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    const records: TransferRecord[] = rows.map(row => ({
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

  getStats(): { total: number; success: number; failed: number; avgDuration: number } {
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN status = 'success' THEN duration_ms ELSE NULL END) as avg_duration
      FROM transfer_history
    `).get() as any;

    return {
      total: row.total || 0,
      success: row.success || 0,
      failed: row.failed || 0,
      avgDuration: Math.round(row.avg_duration || 0),
    };
  }
}

export const transferService = new TransferService();
