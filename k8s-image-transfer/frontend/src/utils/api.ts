import axios from 'axios';

const api = axios.create({
  baseURL: '/docker-ui/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;

// Node APIs
export const nodesApi = {
  getNodes: (discover = false) => api.get('/nodes', { params: { discover } }),
  addNode: (data: { name: string; ip: string; role?: string }) => api.post('/nodes', data),
  deleteNode: (name: string) => api.delete(`/nodes/${name}`),
  getConfigs: () => api.get('/node-configs'),
  saveConfig: (config: any) => api.post('/node-configs', config),
  deleteConfig: (nodeName: string) => api.delete(`/node-configs/${nodeName}`),
  testConnection: (nodeName: string) => api.get(`/node-configs/${nodeName}/test`),
};

// Image APIs
export const imagesApi = {
  getImages: (search?: string) => api.get('/images', { params: { search } }),
  refreshImages: (nodeName?: string) =>
    api.post('/images/refresh', undefined, { params: nodeName ? { nodeName } : {} }),
  getMissingNodes: (imageName: string) =>
    api.get(`/images/${encodeURIComponent(imageName)}/missing-nodes`),
};

// Transfer APIs
export const transferApi = {
  startTransfer: (data: { imageName: string; sourceNode: string; destinationNodes: string[] }) =>
    api.post('/transfer-image', data),
  getActiveJobs: () => api.get('/transfer-jobs'),
  getJob: (jobId: string) => api.get(`/transfer-jobs/${jobId}`),
  getHistory: (limit = 100, offset = 0) =>
    api.get('/history', { params: { limit, offset } }),
  getStats: () => api.get('/stats'),
};

// Settings APIs
export const settingsApi = {
  getSettings: () => api.get('/settings'),
  updateSettings: (settings: Record<string, string>) => api.put('/settings', settings),
};
