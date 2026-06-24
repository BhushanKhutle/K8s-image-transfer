import { NodeSSH } from 'node-ssh';
import { NodeConfig } from '../types';
import db from '../db/database';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

export class SshService {

  private getNodeConfig(nodeName: string): NodeConfig | null {
    const row = db.prepare(`
      SELECT id, node_name, host, port, username, auth_type, password, private_key, passphrase
      FROM node_configs WHERE node_name = ?
    `).get(nodeName) as any;
    if (!row) return null;
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

  private writeKeyFile(privateKey: string): string {
    const keyPath = path.join(os.tmpdir(), `k8s-key-${Date.now()}-${Math.random().toString(36).slice(2)}.pem`);
    const keyContent = privateKey.replace(/\\n/g, '\n');
    const finalKey = keyContent.endsWith('\n') ? keyContent : keyContent + '\n';
    fs.writeFileSync(keyPath, finalKey, { mode: 0o600 });
    return keyPath;
  }

  async connect(nodeName: string): Promise<NodeSSH> {
    const config = this.getNodeConfig(nodeName);
    if (!config) throw new Error(`No SSH configuration found for node: ${nodeName}`);

    const ssh = new NodeSSH();
    const sshConfig: any = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: parseInt(process.env.SSH_TIMEOUT || '30000'),
    };

    if (config.authType === 'password' && config.password) {
      sshConfig.password = config.password;
    } else if (config.authType === 'privateKey' && config.privateKey) {
      const keyPath = this.writeKeyFile(config.privateKey);
      sshConfig.privateKeyPath = keyPath;
      if (config.passphrase) sshConfig.passphrase = config.passphrase;
      setTimeout(() => { try { fs.unlinkSync(keyPath); } catch {} }, 10000);
    }

    await ssh.connect(sshConfig);
    return ssh;
  }

  async executeCommand(nodeName: string, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
    const ssh = await this.connect(nodeName);
    try {
      const result = await ssh.execCommand(command);
      return { stdout: result.stdout, stderr: result.stderr, code: result.code ?? 0 };
    } finally {
      ssh.dispose();
    }
  }

  async testConnection(nodeName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.executeCommand(nodeName, 'echo "connected"');
      return { success: result.code === 0 };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getDockerImages(nodeName: string): Promise<string[]> {
    const result = await this.executeCommand(
      nodeName,
      'docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null'
    );
    if (result.code !== 0) throw new Error(`Failed to fetch images from ${nodeName}: ${result.stderr}`);
    return result.stdout.split('\n').map(l => l.trim()).filter(l => l && !l.includes('<none>'));
  }

  async transferImageViaRelay(
    imageName: string,
    sourceNode: string,
    destNode: string,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    const sourceConfig = this.getNodeConfig(sourceNode);
    const destConfig = this.getNodeConfig(destNode);
    if (!sourceConfig) throw new Error(`No config for source node: ${sourceNode}`);
    if (!destConfig) throw new Error(`No config for destination node: ${destNode}`);

    onProgress?.(`Connecting to ${sourceNode}...`);

    // Write both keys locally on the backend server
    let sourceKeyPath: string | null = null;
    let destKeyPath: string | null = null;

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
      let sshSource: string;
      let sshDest: string;

      if (sourceConfig.authType === 'password' && sourceConfig.password) {
        const escaped = sourceConfig.password.replace(/'/g, "'\\''");
        sshSource = `sshpass -p '${escaped}' ssh -o StrictHostKeyChecking=no -p ${sourceConfig.port} ${sourceConfig.username}@${sourceConfig.host}`;
      } else if (sourceKeyPath) {
        sshSource = `ssh -i ${sourceKeyPath} -o StrictHostKeyChecking=no -p ${sourceConfig.port} ${sourceConfig.username}@${sourceConfig.host}`;
      } else {
        sshSource = `ssh -o StrictHostKeyChecking=no -p ${sourceConfig.port} ${sourceConfig.username}@${sourceConfig.host}`;
      }

      if (destConfig.authType === 'password' && destConfig.password) {
        const escaped = destConfig.password.replace(/'/g, "'\\''");
        sshDest = `sshpass -p '${escaped}' ssh -o StrictHostKeyChecking=no -p ${destConfig.port} ${destConfig.username}@${destConfig.host}`;
      } else if (destKeyPath) {
        sshDest = `ssh -i ${destKeyPath} -o StrictHostKeyChecking=no -p ${destConfig.port} ${destConfig.username}@${destConfig.host}`;
      } else {
        sshDest = `ssh -o StrictHostKeyChecking=no -p ${destConfig.port} ${destConfig.username}@${destConfig.host}`;
      }

      // Run the pipe from the backend server itself
      const cmd = `${sshSource} "docker save ${imageName}" | ${sshDest} "docker load"`;
      console.log(`[Transfer] Running: ${cmd.replace(/sshpass -p '[^']*'/g, 'sshpass -p ***')}`);

      execSync(cmd, {
        timeout: parseInt(process.env.TRANSFER_TIMEOUT || '300000'),
        maxBuffer: 1024 * 1024 * 1024, // 1GB
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      onProgress?.(`Image loaded on ${destNode} successfully`);

    } finally {
      if (sourceKeyPath) try { fs.unlinkSync(sourceKeyPath); } catch {}
      if (destKeyPath) try { fs.unlinkSync(destKeyPath); } catch {}
    }
  }
}

export const sshService = new SshService();
