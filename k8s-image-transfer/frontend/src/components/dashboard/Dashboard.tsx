import React, { useEffect, useState } from 'react';
import {
  Box, Grid, Paper, Typography, Chip, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  IconButton, Tooltip, CircularProgress, Button,
} from '@mui/material';
import {
  Storage as StorageIcon, Image as ImageIcon,
  CheckCircle as CheckIcon, Error as ErrorIcon,
  HourglassTop as PendingIcon, Refresh as RefreshIcon,
  ArrowForward as ArrowIcon, Speed as SpeedIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { nodesApi, imagesApi, transferApi } from '../../utils/api';
import { Node, ImageRow, TransferJob, Stats } from '../../types';
import { formatDistanceToNow } from 'date-fns';

function StatCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: string | number;
  color: string; sub?: string;
}) {
  return (
    <Paper sx={{ p: 2.5, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{
        position: 'absolute', top: -10, right: -10, width: 80, height: 80,
        borderRadius: '50%', background: color, opacity: 0.08,
      }} />
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ color, mt: 0.5, lineHeight: 1 }}>
            {value}
          </Typography>
          {sub && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {sub}
            </Typography>
          )}
        </Box>
        <Box sx={{
          width: 40, height: 40, borderRadius: '8px',
          background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {icon}
        </Box>
      </Box>
    </Paper>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [activeJobs, setActiveJobs] = useState<TransferJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [nodesRes, imagesRes, jobsRes, statsRes] = await Promise.all([
        nodesApi.getNodes(),
        imagesApi.getImages(),
        transferApi.getActiveJobs(),
        transferApi.getStats(),
      ]);
      setNodes(nodesRes.data.nodes || []);
      setImages(imagesRes.data.images || []);
      setActiveJobs(jobsRes.data.jobs || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    // SSE for real-time job updates
    const es = new EventSource('/api/transfer-jobs/stream/events');
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'init') {
        setActiveJobs(data.jobs);
      } else if (data.type === 'job-update') {
        setActiveJobs(prev => {
          const idx = prev.findIndex(j => j.id === data.job.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data.job;
            return next;
          }
          return [...prev, data.job];
        });
      }
    };
    return () => es.close();
  }, []);

  const readyNodes = nodes.filter(n => n.status === 'Ready').length;
  const totalImages = images.length;
  const imagesWithGaps = images.filter(img =>
    img.nodes.some(n => !n.present) && img.nodes.some(n => n.present)
  ).length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="text.primary">
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Air-gapped cluster image management
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={load}
          sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary' }}
        >
          Refresh
        </Button>
      </Box>

      {/* Stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard
            icon={<StorageIcon fontSize="small" />}
            label="Cluster Nodes"
            value={nodes.length}
            color="#00D4FF"
            sub={`${readyNodes} ready`}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            icon={<ImageIcon fontSize="small" />}
            label="Total Images"
            value={totalImages}
            color="#7C3AED"
            sub={`${imagesWithGaps} with gaps`}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            icon={<CheckIcon fontSize="small" />}
            label="Transfers Done"
            value={stats?.success || 0}
            color="#10B981"
            sub={`${stats?.failed || 0} failed`}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            icon={<SpeedIcon fontSize="small" />}
            label="Avg Duration"
            value={stats?.avgDuration ? `${(stats.avgDuration / 1000).toFixed(1)}s` : '—'}
            color="#F59E0B"
            sub="per transfer"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Active Jobs */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 0, overflow: 'hidden' }}>
            <Box sx={{
              px: 2.5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Typography variant="body2" fontWeight={700} color="text.primary">
                Active Transfers
              </Typography>
              <Chip
                label={activeJobs.filter(j => j.status === 'running' || j.status === 'queued').length}
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>

            {activeJobs.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <PendingIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.3, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No active transfers
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
                {activeJobs.map(job => (
                  <Box key={job.id} sx={{
                    px: 2.5, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" fontFamily="monospace" color="text.primary">
                        {job.imageName}
                      </Typography>
                      <Chip
                        label={job.status}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.65rem',
                          bgcolor: job.status === 'completed' ? 'success.dark'
                            : job.status === 'failed' ? 'error.dark'
                            : job.status === 'running' ? 'primary.dark'
                            : 'grey.800',
                          color: '#fff',
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="caption" color="primary.main">{job.sourceNode}</Typography>
                      <ArrowIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                      <Typography variant="caption" color="secondary.main">
                        {job.destinationNodes.join(', ')}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={job.progress}
                      color={job.status === 'failed' ? 'error' : 'primary'}
                      sx={{ borderRadius: 1 }}
                    />
                    {job.error && (
                      <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
                        {job.error}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Nodes status */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 0, overflow: 'hidden' }}>
            <Box sx={{
              px: 2.5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Typography variant="body2" fontWeight={700} color="text.primary">
                Cluster Nodes
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowIcon fontSize="small" />}
                onClick={() => navigate('/nodes')}
                sx={{ color: 'primary.main', fontSize: '0.75rem' }}
              >
                View All
              </Button>
            </Box>

            {nodes.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <StorageIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.3, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No nodes configured
                </Typography>
                <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/nodes')}>
                  Add Nodes
                </Button>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Node</TableCell>
                    <TableCell>IP</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Version</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {nodes.slice(0, 8).map(node => (
                    <TableRow key={node.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" color="text.primary">
                          {node.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                          {node.ip || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={node.status}
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.65rem',
                            bgcolor: node.status === 'Ready' ? 'rgba(16,185,129,0.15)'
                              : node.status === 'NotReady' ? 'rgba(239,68,68,0.15)'
                              : 'rgba(148,163,184,0.15)',
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        {/* Images with gaps */}
        <Grid item xs={12}>
          <Paper sx={{ p: 0, overflow: 'hidden' }}>
            <Box sx={{
              px: 2.5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Typography variant="body2" fontWeight={700} color="text.primary">
                Images with Gaps
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowIcon fontSize="small" />}
                onClick={() => navigate('/images')}
                sx={{ color: 'primary.main', fontSize: '0.75rem' }}
              >
                View All Images
              </Button>
            </Box>

            {imagesWithGaps === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CheckIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.5, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  All images are in sync across nodes
                </Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Image</TableCell>
                    {nodes.slice(0, 6).map(n => (
                      <TableCell key={n.name} align="center">{n.name}</TableCell>
                    ))}
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {images
                    .filter(img => img.nodes.some(n => !n.present) && img.nodes.some(n => n.present))
                    .slice(0, 5)
                    .map(img => (
                      <TableRow key={img.name} hover>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace" color="text.primary">
                            {img.name}
                          </Typography>
                        </TableCell>
                        {img.nodes.slice(0, 6).map(np => (
                          <TableCell key={np.nodeName} align="center">
                            {np.present
                              ? <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                              : <ErrorIcon sx={{ fontSize: 14, color: 'error.main', opacity: 0.5 }} />
                            }
                          </TableCell>
                        ))}
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate('/images')}
                            sx={{ fontSize: '0.7rem', py: 0.25, borderColor: 'primary.main', color: 'primary.main' }}
                          >
                            Export
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
