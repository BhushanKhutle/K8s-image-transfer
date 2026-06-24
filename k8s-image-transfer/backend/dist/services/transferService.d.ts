import { EventEmitter } from 'events';
import { TransferJob, TransferRecord, TransferRequest } from '../types';
export declare const transferEvents: EventEmitter<[never]>;
export declare class TransferService {
    startTransfer(request: TransferRequest): Promise<TransferJob[]>;
    private executeTransfer;
    private updateJob;
    private saveHistory;
    getActiveJobs(): TransferJob[];
    getJob(jobId: string): TransferJob | null;
    getHistory(limit?: number, offset?: number): {
        records: TransferRecord[];
        total: number;
    };
    getStats(): {
        total: number;
        success: number;
        failed: number;
        avgDuration: number;
    };
}
export declare const transferService: TransferService;
//# sourceMappingURL=transferService.d.ts.map