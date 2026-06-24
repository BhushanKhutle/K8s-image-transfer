import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Checkbox, FormControlLabel,
  Chip, LinearProgress, Alert, Divider, CircularProgress,
  IconButton,
} from '@mui/material';
import {
  ArrowForward as ArrowIcon, Close as CloseIcon,
  CheckCircle as CheckIcon, Error as ErrorIcon,
} from '@mui/icons-material';
import { imagesApi, transferApi } from '../../utils/api';
import { TransferJob } from '../../types';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  imageName: string;
}

export function ExportImageDialog({ open, onClose, imageName }: ExportDialogProps) {
  const [missingNodes, setMissingNodes] = useState<string[]>([]);
  const [sourceNodes, setSourceNodes] = useState<string[]>([]);
  const [selectedDest, setSelectedDest] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [jobs, setJobs] = useState<TransferJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'select' | 'transferring' | 'done'>('select');

  useEffect(() => {
    if (!open || !imageName) return;
    setPhase('select');
    setJobs([]);
    setError('');

    imagesApi.getMissingNodes(imageName).then(res => {
      setMissingNodes(res.data.missingNodes || []);
      setSourceNodes(res.data.sourceNodes || []);
      setSelectedDest(res.data.missingNodes || []);
      setSelectedSource(res.data.sourceNodes?.[0] || '');
    }).catch(err => setError(err.message));
  }, [open, imageName]);

  // Subscribe to job updates via SSE when transferring
  useEffect(() => {
    if (phase !== 'transferring' || jobs.length === 0) return;

    const es = new EventSource('/api/transfer-jobs/stream/events');
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'job-update') {
        setJobs(prev => prev.map(j => j.id === data.job.id ? data.job : j));
      }
    };

    return () => es.close();
  }, [phase, jobs.length]);

  // Check if all done
  useEffect(() => {
    if (phase !== 'transferring' || jobs.length === 0) return;
    const allDone = jobs.every(j => j.status === 'completed' || j.status === 'failed');
    if (allDone) setPhase('done');
  }, [jobs, phase]);

  const handleTransfer = async () => {
    if (!selectedSource || selectedDest.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await transferApi.startTransfer({
        imageName,
        sourceNode: selectedSource,
        destinationNodes: selectedDest,
      });
      setJobs(res.data.jobs || []);
      setPhase('transferring');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDest = (node: string) => {
    setSelectedDest(prev =>
      prev.includes(node) ? prev.filter(n => n !== node) : [...prev, node]
    );
  };

  return (
    <Dialog open={open} onClose={phase === 'transferring' ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Export Image</Typography>
          <Typography variant="caption" fontFamily="monospace" color="primary.main">
            {imageName}
          </Typography>
        </Box>
        {phase !== 'transferring' && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {phase === 'select' && (
          <>
            {/* Source node */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', mb: 1 }}>
                Source Node (image available on)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {sourceNodes.length === 0 ? (
                  <Typography variant="body2" color="error.main">No source node found</Typography>
                ) : sourceNodes.map(node => (
                  <Chip
                    key={node}
                    label={node}
                    clickable
                    onClick={() => setSelectedSource(node)}
                    sx={{
                      bgcolor: selectedSource === node ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                      color: selectedSource === node ? 'primary.main' : 'text.secondary',
                      border: selectedSource === node ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      fontFamily: 'monospace',
                    }}
                  />
                ))}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Divider sx={{ flex: 1 }} />
              <ArrowIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Divider sx={{ flex: 1 }} />
            </Box>

            {/* Destination nodes */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', mb: 1 }}>
                Destination Nodes (image missing on)
              </Typography>

              {missingNodes.length === 0 ? (
                <Alert severity="success" icon={<CheckIcon />}>
                  This image is already present on all nodes.
                </Alert>
              ) : (
                <Box sx={{
                  bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1,
                  border: '1px solid rgba(255,255,255,0.08)', p: 1,
                }}>
                  {missingNodes.map(node => (
                    <FormControlLabel
                      key={node}
                      control={
                        <Checkbox
                          size="small"
                          checked={selectedDest.includes(node)}
                          onChange={() => toggleDest(node)}
                          sx={{ color: 'text.secondary', '&.Mui-checked': { color: 'primary.main' } }}
                        />
                      }
                      label={
                        <Typography variant="body2" fontFamily="monospace">{node}</Typography>
                      }
                      sx={{ display: 'flex', m: 0, px: 1, py: 0.5, borderRadius: 0.5,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </>
        )}

        {(phase === 'transferring' || phase === 'done') && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Transfer progress for <strong style={{ color: '#00D4FF' }}>{imageName}</strong>
            </Typography>
            {jobs.map(job => (
              <Box key={job.id} sx={{
                mb: 2, p: 2, bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 1, border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" fontFamily="monospace" color="primary.main">
                      {job.sourceNode}
                    </Typography>
                    <ArrowIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                    <Typography variant="caption" fontFamily="monospace" color="secondary.main">
                      {job.destinationNodes[0]}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {job.status === 'running' && <CircularProgress size={12} />}
                    {job.status === 'completed' && <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />}
                    {job.status === 'failed' && <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />}
                    <Chip
                      label={job.status}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.65rem',
                        bgcolor: job.status === 'completed' ? 'rgba(16,185,129,0.2)'
                          : job.status === 'failed' ? 'rgba(239,68,68,0.2)'
                          : job.status === 'running' ? 'rgba(0,212,255,0.2)'
                          : 'rgba(148,163,184,0.1)',
                        color: job.status === 'completed' ? '#10B981'
                          : job.status === 'failed' ? '#EF4444'
                          : job.status === 'running' ? '#00D4FF' : '#94A3B8',
                      }}
                    />
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={job.progress}
                  color={job.status === 'failed' ? 'error' : 'primary'}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">{job.progress}%</Typography>
                  {job.durationMs && (
                    <Typography variant="caption" color="text.secondary">
                      {(job.durationMs / 1000).toFixed(1)}s
                    </Typography>
                  )}
                </Box>
                {job.error && (
                  <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                    Error: {job.error}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {phase === 'select' && (
          <>
            <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleTransfer}
              disabled={loading || !selectedSource || selectedDest.length === 0 || missingNodes.length === 0}
              startIcon={loading ? <CircularProgress size={14} /> : <ArrowIcon />}
            >
              Copy Image to {selectedDest.length} node{selectedDest.length !== 1 ? 's' : ''}
            </Button>
          </>
        )}
        {(phase === 'transferring' || phase === 'done') && (
          <Button
            variant={phase === 'done' ? 'contained' : 'outlined'}
            onClick={onClose}
            disabled={phase === 'transferring'}
          >
            {phase === 'done' ? 'Done' : 'Please wait...'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
