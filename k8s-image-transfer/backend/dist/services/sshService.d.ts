import { NodeSSH } from 'node-ssh';
export declare class SshService {
    private getNodeConfig;
    private writeKeyFile;
    connect(nodeName: string): Promise<NodeSSH>;
    executeCommand(nodeName: string, command: string): Promise<{
        stdout: string;
        stderr: string;
        code: number;
    }>;
    testConnection(nodeName: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getDockerImages(nodeName: string): Promise<string[]>;
    transferImageViaRelay(imageName: string, sourceNode: string, destNode: string, onProgress?: (msg: string) => void): Promise<void>;
}
export declare const sshService: SshService;
//# sourceMappingURL=sshService.d.ts.map