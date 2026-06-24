import { Request, Response } from 'express';
export declare const transferController: {
    startTransfer(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getActiveJobs(req: Request, res: Response): Promise<void>;
    getJob(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getHistory(req: Request, res: Response): Promise<void>;
    getStats(req: Request, res: Response): Promise<void>;
    streamJobUpdates(req: Request, res: Response): void;
};
//# sourceMappingURL=transferController.d.ts.map