import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Chip, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Tooltip, CircularProgress,
  LinearProgress, TablePagination, TextField, InputAdornment,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon, Error as ErrorIcon,
  ArrowForward as ArrowIcon, InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { transferApi } from '../../utils/api';
import { TransferJob, TransferRecord } from '../../types';
import { format } from 'date-fns';

export function HistoryPage() {
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [activeJobs, setActiveJobs] = useState<TransferJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const load = async () => {
    setLoading(true);
    try {
      const [histRes, jobsRes] = await Promise.all([
        transferApi.getHistory(rowsPerPage, page * rowsPerPage),
        transferApi.getActiveJobs(),
      ]);
      setRecords(histRes.data.records || []);
      setTotal(histRes.data.total || 0);
      setActiveJobs(jobsRes.data.jobs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, rowsPerPage]);

  // SSE for real-time job updates
  useEffect(() => {
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
        // Reload history when job completes
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          load();
        }
      }
    };
    return () => es.close();
  }, []);

  const formatDuration = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const runningJobs = activeJobs.filter(j => j.status === 'running' || j.status === 'queued');

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Transfer History</Typography>
        <Typography variant="body2" color="text.secondary">
          All image transfer operations and their results
        </Typography>
      </Box>

      {/* Active transfers */}
      {runningJobs.length > 0 && (
        <Paper sx={{ mb: 2, p: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" fontWeight={600}>Active Transfers</Typography>
            <Chip label={runningJobs.length} size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
          </Box>
          {runningJobs.map(job => (
            <Box key={job.id} sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" fontFamily="monospace" color="text.primary">{job.imageName}</Typography>
                  <ArrowIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" color="primary.main">{job.sourceNode}</Typography>
                  <ArrowIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" color="secondary.main">{job.destinationNodes.join(', ')}</Typography>
                </Box>
                <Chip label={job.status} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(0,212,255,0.2)', color: 'primary.main' }} />
              </Box>
              <LinearProgress variant="determinate" value={job.progress} sx={{ borderRadius: 1, height: 4 }} />
            </Box>
          ))}
        </Paper>
      )}

      {/* History table */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Image</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Destination</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    No transfers yet. Export an image to see history here.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              records.map(record => (
                <TableRow key={record.id} hover>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(record.startedAt), 'dd-MMM-yyyy HH:mm')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace" color="text.primary">
                      {record.imageName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={record.sourceNode}
                      size="small"
                      sx={{ height: 18, fontSize: '0.65rem', fontFamily: 'monospace', bgcolor: 'rgba(0,212,255,0.1)', color: 'primary.main' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={record.destinationNode}
                      size="small"
                      sx={{ height: 18, fontSize: '0.65rem', fontFamily: 'monospace', bgcolor: 'rgba(124,58,237,0.15)', color: '#9D6EF8' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {record.status === 'success'
                        ? <SuccessIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        : <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />
                      }
                      <Chip
                        label={record.status}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.65rem',
                          bgcolor: record.status === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: record.status === 'success' ? '#10B981' : '#EF4444',
                        }}
                      />
                    </Box>
                    {record.error && (
                      <Tooltip title={record.error}>
                        <Typography variant="caption" color="error.main" sx={{ display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.error}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {formatDuration(record.durationMs)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          sx={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        />
      </Paper>
    </Box>
  );
}
