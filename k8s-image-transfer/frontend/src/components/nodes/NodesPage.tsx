import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Table, TableBody, TableCell,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, IconButton,
  Tooltip, CircularProgress, Alert, Tabs, Tab, Switch, FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon, Refresh as RefreshIcon, Delete as DeleteIcon,
  Check as CheckIcon, Storage as StorageIcon, Wifi as WifiIcon,
  WifiOff as WifiOffIcon, Settings as SettingsIcon,
} from '@mui/icons-material';
import { nodesApi } from '../../utils/api';
import { Node, NodeConfig } from '../../types';

export function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [configs, setConfigs] = useState<NodeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [addNodeDialog, setAddNodeDialog] = useState(false);
  const [configDialog, setConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<NodeConfig>>({
    port: 22, authType: 'password',
  });
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [newNode, setNewNode] = useState({ name: '', ip: '', role: 'worker' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [nodesRes, configsRes] = await Promise.all([
        nodesApi.getNodes(),
        nodesApi.getConfigs(),
      ]);
      setNodes(nodesRes.data.nodes || []);
      setConfigs(configsRes.data.configs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDiscover = async () => {
    setLoading(true);
    try {
      const res = await nodesApi.getNodes(true);
      setNodes(res.data.nodes || []);
      setSuccess('Cluster nodes discovered via kubectl');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNode = async () => {
    if (!newNode.name || !newNode.ip) return;
    try {
      await nodesApi.addNode(newNode);
      setAddNodeDialog(false);
      setNewNode({ name: '', ip: '', role: 'worker' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteNode = async (name: string) => {
    if (!confirm(`Delete node ${name}?`)) return;
    try {
      await nodesApi.deleteNode(name);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await nodesApi.saveConfig(editingConfig);
      setConfigDialog(false);
      setEditingConfig({ port: 22, authType: 'password' });
      load();
      setSuccess('SSH config saved');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTestConnection = async (nodeName: string) => {
    setTestResults(prev => ({ ...prev, [nodeName]: null }));
    try {
      const res = await nodesApi.testConnection(nodeName);
      setTestResults(prev => ({ ...prev, [nodeName]: res.data.success }));
    } catch {
      setTestResults(prev => ({ ...prev, [nodeName]: false }));
    }
  };

  const openConfigFor = (nodeName?: string) => {
    if (nodeName) {
      const existing = configs.find(c => c.nodeName === nodeName);
      setEditingConfig(existing || { nodeName, port: 22, authType: 'password' });
    } else {
      setEditingConfig({ port: 22, authType: 'password' });
    }
    setConfigDialog(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Cluster Nodes</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage worker nodes and SSH configurations
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleDiscover}
            disabled={loading}
            sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary' }}
          >
            Discover via kubectl
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddNodeDialog(true)}
          >
            Add Node
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Nodes (${nodes.length})`} />
        <Tab label={`SSH Configs (${configs.length})`} />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Node Name</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>K8s Version</TableCell>
                <TableCell>SSH Config</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : nodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <StorageIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.3, mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography variant="body2" color="text.secondary">
                      No nodes found. Use "Discover via kubectl" or add manually.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                nodes.map(node => {
                  const hasConfig = configs.some(c => c.nodeName === node.name);
                  const testResult = testResults[node.name];
                  return (
                    <TableRow key={node.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" fontWeight={600} color="text.primary">
                          {node.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                          {node.ip || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={node.role}
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.65rem',
                            bgcolor: node.role === 'control-plane' ? 'rgba(124,58,237,0.2)' : 'rgba(0,212,255,0.1)',
                            color: node.role === 'control-plane' ? '#9D6EF8' : '#00D4FF',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={node.status}
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.65rem',
                            bgcolor: node.status === 'Ready' ? 'rgba(16,185,129,0.15)'
                              : node.status === 'NotReady' ? 'rgba(239,68,68,0.15)'
                              : 'rgba(148,163,184,0.1)',
                            color: node.status === 'Ready' ? '#10B981'
                              : node.status === 'NotReady' ? '#EF4444' : '#94A3B8',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {node.version || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {hasConfig ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label="Configured" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(16,185,129,0.15)', color: '#10B981' }} />
                            {testResult === true && <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />}
                            {testResult === false && <WifiOffIcon sx={{ fontSize: 14, color: 'error.main' }} />}
                          </Box>
                        ) : (
                          <Chip label="Not configured" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(239,68,68,0.1)', color: '#EF4444' }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="Test connection">
                            <IconButton size="small" onClick={() => handleTestConnection(node.name)} disabled={!hasConfig}>
                              <WifiIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Configure SSH">
                            <IconButton size="small" onClick={() => openConfigFor(node.name)}>
                              <SettingsIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete node">
                            <IconButton size="small" color="error" onClick={() => handleDeleteNode(node.name)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => openConfigFor()}>
              Add SSH Config
            </Button>
          </Box>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Node</TableCell>
                <TableCell>Host</TableCell>
                <TableCell>Port</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Auth Type</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No SSH configurations. Add one to enable image transfers.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : configs.map(cfg => (
                <TableRow key={cfg.nodeName} hover>
                  <TableCell><Typography variant="caption" fontFamily="monospace" fontWeight={600}>{cfg.nodeName}</Typography></TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace" color="text.secondary">{cfg.host}</Typography></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{cfg.port}</Typography></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{cfg.username}</Typography></TableCell>
                  <TableCell>
                    <Chip label={cfg.authType} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(0,212,255,0.1)', color: 'primary.main' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <IconButton size="small" onClick={() => openConfigFor(cfg.nodeName)}>
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={async () => {
                        await nodesApi.deleteConfig(cfg.nodeName);
                        load();
                      }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Add Node Dialog */}
      <Dialog open={addNodeDialog} onClose={() => setAddNodeDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Node Manually</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Node Name" value={newNode.name} onChange={e => setNewNode(p => ({ ...p, name: e.target.value }))} placeholder="worker1" fullWidth />
          <TextField label="IP Address" value={newNode.ip} onChange={e => setNewNode(p => ({ ...p, ip: e.target.value }))} placeholder="192.168.1.10" fullWidth />
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select value={newNode.role} onChange={e => setNewNode(p => ({ ...p, role: e.target.value }))} label="Role">
              <MenuItem value="worker">Worker</MenuItem>
              <MenuItem value="control-plane">Control Plane</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddNodeDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddNode}>Add Node</Button>
        </DialogActions>
      </Dialog>

      {/* SSH Config Dialog */}
      <Dialog open={configDialog} onClose={() => setConfigDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>SSH Configuration</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Node Name" value={editingConfig.nodeName || ''} onChange={e => setEditingConfig(p => ({ ...p, nodeName: e.target.value }))} fullWidth />
          <TextField label="Host / IP" value={editingConfig.host || ''} onChange={e => setEditingConfig(p => ({ ...p, host: e.target.value }))} fullWidth />
          <TextField label="Port" type="number" value={editingConfig.port || 22} onChange={e => setEditingConfig(p => ({ ...p, port: parseInt(e.target.value) }))} fullWidth />
          <TextField label="Username" value={editingConfig.username || ''} onChange={e => setEditingConfig(p => ({ ...p, username: e.target.value }))} fullWidth />
          <FormControl fullWidth size="small">
            <InputLabel>Auth Type</InputLabel>
            <Select value={editingConfig.authType || 'password'} onChange={e => setEditingConfig(p => ({ ...p, authType: e.target.value as any }))} label="Auth Type">
              <MenuItem value="password">Password</MenuItem>
              <MenuItem value="privateKey">Private Key</MenuItem>
            </Select>
          </FormControl>
          {editingConfig.authType === 'password' ? (
            <TextField label="Password" type="password" value={editingConfig.password || ''} onChange={e => setEditingConfig(p => ({ ...p, password: e.target.value }))} fullWidth />
          ) : (
            <>
              <TextField
                label="Private Key (PEM content)"
                multiline rows={4}
                value={editingConfig.privateKey || ''}
                onChange={e => setEditingConfig(p => ({ ...p, privateKey: e.target.value }))}
                fullWidth
                placeholder="-----BEGIN RSA PRIVATE KEY-----..."
              />
              <TextField label="Passphrase (optional)" type="password" value={editingConfig.passphrase || ''} onChange={e => setEditingConfig(p => ({ ...p, passphrase: e.target.value }))} fullWidth />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveConfig}>Save Config</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
