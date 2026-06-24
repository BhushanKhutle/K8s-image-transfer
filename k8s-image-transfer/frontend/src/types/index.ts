export interface Node {
  id: string;
  name: string;
  ip: string;
  status: 'Ready' | 'NotReady' | 'Unknown';
  version: string;
  role: string;
  createdAt: string;
  lastSeen: string;
}

export interface NodeConfig {
  id?: string;
  nodeName: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface ImagePresence {
  nodeName: string;
  present: boolean;
}

export interface ImageRow {
  name: string;
  repository: string;
  tag: string;
  nodes: ImagePresence[];
}

export interface TransferJob {
  id: string;
  imageName: string;
  sourceNode: string;
  destinationNodes: string[];
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface TransferRecord {
  id: string;
  imageName: string;
  sourceNode: string;
  destinationNode: string;
  status: 'success' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  error?: string;
}

export interface TransferRequest {
  imageName: string;
  sourceNode: string;
  destinationNodes: string[];
}

export interface Stats {
  total: number;
  success: number;
  failed: number;
  avgDuration: number;
}
