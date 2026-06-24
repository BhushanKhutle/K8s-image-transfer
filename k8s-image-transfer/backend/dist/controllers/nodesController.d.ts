import { Request, Response } from 'express';
export declare const nodesController: {
    getNodes(req: Request, res: Response): Promise<void>;
    addNode(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteNode(req: Request, res: Response): Promise<void>;
    getNodeConfigs(req: Request, res: Response): Promise<void>;
    saveNodeConfig(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteNodeConfig(req: Request, res: Response): Promise<void>;
    testConnection(req: Request, res: Response): Promise<void>;
};
//# sourceMappingURL=nodesController.d.ts.map