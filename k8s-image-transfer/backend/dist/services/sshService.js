"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sshService = exports.SshService = void 0;
const node_ssh_1 = require("node-ssh");
const database_1 = __importDefault(require("../db/database"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class SshService {
    getNodeConfig(nodeName) {
        const row = database_1.default.prepare(`
      SELECT id, node_name, host, port, username, auth_type, password, private_key, passphrase
      FROM node_configs WHERE node_name = ?
    `).get(nodeName);
        if (!row)
            return null;
        return {
            id: row.id,
            nodeName: row.node_name,
            host: row.host,
            port: row.port,
            username: row.username,
            authType: row.auth_type,
            password: row.password,
            privateKey: row.private_key,
            passphrase: row.passphrase,
        };
    }
    writeKeyFile(privateKey) {
        const keyPath = path.join(os.tmpdir(), `k8s-key-${Date.now()}-${Math.random().toString(36).slice(2)}.pem`);
        const keyContent = privateKey.replace(/\\n/g, '\n');
        const finalKey = keyContent.endsWith('\n') ? keyContent : keyContent + '\n';
        fs.writeFileSync(keyPath, finalKey, { mode: 0o600 });
        return keyPath;
    }
    async connect(nodeName) {
        const config = this.getNodeConfig(nodeName);
        if (!config)
            throw new Error(`No SSH configuration found for node: ${nodeName}`);
        const ssh = new node_ssh_1.NodeSSH();
        const sshConfig = {
            host: config.host,
            port: config.port,
            username: config.username,
            readyTimeout: parseInt(process.env.SSH_TIMEOUT || '30000'),
        };
        if (config.authType === 'password' && config.password) {
            sshConfig.password = config.password;
        }
        else if (config.authType === 'privateKey' && config.privateKey) {
            const keyPath = this.writeKeyFile(config.privateKey);
            sshConfig.privateKeyPath = keyPath;
            if (config.passphrase)
                sshConfig.passphrase = config.passphrase;
            setTimeout(() => { try {
                fs.unlinkSync(keyPath);
            }
            catch { } }, 10000);
        }
        await ssh.connect(sshConfig);
        return ssh;
    }
    async executeCommand(nodeName, command) {
        const ssh = await this.connect(nodeName);
        try {
            const result = await ssh.execCommand(command);
            return { stdout: result.stdout, stderr: result.stderr, code: result.code ?? 0 };
        }
        finally {
            ssh.dispose();
        }
    }
    async testConnection(nodeName) {
        try {
            const result = await this.executeCommand(nodeName, 'echo "connected"');
            return { success: result.code === 0 };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async getDockerImages(nodeName) {
        const result = await this.executeCommand(nodeName, 'docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null');
        if (result.code !== 0)
            throw new Error(`Failed to fetch images from ${nodeName}: ${result.stderr}`);
        return result.stdout.split('\n').map(l => l.trim()).filter(l => l && !l.includes('<none>'));
    }
    async transferImageViaRelay(imageName, sourceNode, destNode, onProgress) {
        const sourceConfig = this.getNodeConfig(sourceNode);
        const destConfig = this.getNodeConfig(destNode);
        if (!sourceConfig)
            throw new Error(`No config for source node: ${sourceNode}`);
        if (!destConfig)
            throw new Error(`No config for destination node: ${destNode}`);
        onProgress?.(`Connecting to ${sourceNode}...`);
        // Write both keys locally on the backend server
        let sourceKeyPath = null;
        let destKeyPath = null;
        if (sourceConfig.authType === 'privateKey' && sourceConfig.privateKey) {
            sourceKeyPath = this.writeKeyFile(sourceConfig.privateKey);
        }
        if (destConfig.authType === 'privateKey' && destConfig.privateKey) {
            destKeyPath = this.writeKeyFile(destConfig.privateKey);
        }
        try {
            onProgress?.(`Transferring ${imageName} from ${sourceNode} to ${destNode}...`);
            // Build the full pipe command that runs ON THE BACKEND SERVER
            // backend: ssh source "docker save img" | ssh dest "docker load"
            let sshSource;
            let sshDest;
            if (sourceConfig.authType === 'password' && sourceConfig.password) {
                const escaped = sourceConfig.password.replace(/'/g, "'\\''");
                sshSource = `sshpass -p '${escaped}' ssh -o StrictHostKeyChecking=no -p ${sourceConfig.port} ${sourceConfig.username}@${sourceConfig.host}`;
            }
            else if (sourceKeyPath) {
                sshSource = `ssh -i ${sourceKeyPath} -o StrictHostKeyChecking=no -p ${sourceConfig.port} ${sourceConfig.username}@${sourceConfig.host}`;
            }
            else {
                sshSource = `ssh -o StrictHostKeyChecking=no -p ${sourceConfig.port} ${sourceConfig.username}@${sourceConfig.host}`;
            }
            if (destConfig.authType === 'password' && destConfig.password) {
                const escaped = destConfig.password.replace(/'/g, "'\\''");
                sshDest = `sshpass -p '${escaped}' ssh -o StrictHostKeyChecking=no -p ${destConfig.port} ${destConfig.username}@${destConfig.host}`;
            }
            else if (destKeyPath) {
                sshDest = `ssh -i ${destKeyPath} -o StrictHostKeyChecking=no -p ${destConfig.port} ${destConfig.username}@${destConfig.host}`;
            }
            else {
                sshDest = `ssh -o StrictHostKeyChecking=no -p ${destConfig.port} ${destConfig.username}@${destConfig.host}`;
            }
            // Run the pipe from the backend server itself
            const cmd = `${sshSource} "docker save ${imageName}" | ${sshDest} "docker load"`;
            console.log(`[Transfer] Running: ${cmd.replace(/sshpass -p '[^']*'/g, 'sshpass -p ***')}`);
            (0, child_process_1.execSync)(cmd, {
                timeout: parseInt(process.env.TRANSFER_TIMEOUT || '300000'),
                maxBuffer: 1024 * 1024 * 1024, // 1GB
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            onProgress?.(`Image loaded on ${destNode} successfully`);
        }
        finally {
            if (sourceKeyPath)
                try {
                    fs.unlinkSync(sourceKeyPath);
                }
                catch { }
            if (destKeyPath)
                try {
                    fs.unlinkSync(destKeyPath);
                }
                catch { }
        }
    }
}
exports.SshService = SshService;
exports.sshService = new SshService();
//# sourceMappingURL=sshService.js.map