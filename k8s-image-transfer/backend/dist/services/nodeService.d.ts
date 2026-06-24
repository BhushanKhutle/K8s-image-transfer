import { Node, NodeConfig } from '../types';
export declare class NodeService {
    discoverNodes(): Promise<Node[]>;
    private parseKubectlOutput;
    private saveNodes;
    getCachedNodes(): Node[];
    getNodeConfigs(): NodeConfig[];
    getNodeConfig(nodeName: string): NodeConfig | null;
    saveNodeConfig(config: Omit<NodeConfig, 'id'>): NodeConfig;
    deleteNodeConfig(nodeName: string): void;
    private getSetting;
    addManualNode(name: string, ip: string, role?: string): Node;
    deleteNode(name: string): void;
}
export declare const nodeService: NodeService;
//# sourceMappingURL=nodeService.d.ts.map