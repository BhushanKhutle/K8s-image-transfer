import { Request, Response } from 'express';
import { transferService, transferEvents } from '../services/transferService';
import { TransferRequest } from '../types';

export const transferController = {
  async startTransfer(req: Request, res: Response) {
    try {
      const request: TransferRequest = req.body;

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

      const jobs = await transferService.startTransfer(request);
      res.status(202).json({ jobs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getActiveJobs(req: Request, res: Response) {
    try {
      const jobs = transferService.getActiveJobs();
      res.json({ jobs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getJob(req: Request, res: Response) {
    try {
      const job = transferService.getJob(req.params.jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json({ job });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getHistory(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const result = transferService.getHistory(limit, offset);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getStats(req: Request, res: Response) {
    try {
      const stats = transferService.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // Server-Sent Events for real-time job updates
  streamJobUpdates(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send current active jobs immediately
    const activeJobs = transferService.getActiveJobs();
    res.write(`data: ${JSON.stringify({ type: 'init', jobs: activeJobs })}\n\n`);

    const onUpdate = (job: any) => {
      res.write(`data: ${JSON.stringify({ type: 'job-update', job })}\n\n`);
    };

    transferEvents.on('job-update', onUpdate);

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
      transferEvents.off('job-update', onUpdate);
      clearInterval(heartbeat);
    });
  },
};
