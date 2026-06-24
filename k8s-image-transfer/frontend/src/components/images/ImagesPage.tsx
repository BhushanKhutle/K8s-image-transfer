import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Chip, Table,
  TableBody, TableCell, TableHead, TableRow, IconButton,
  Tooltip, CircularProgress, Alert, InputAdornment,
  LinearProgress, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  Refresh as RefreshIcon, Search as SearchIcon,
  CheckCircle as CheckIcon, Cancel as CrossIcon,
  IosShare as ExportIcon, InfoOutlined as InfoIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { imagesApi, nodesApi } from '../../utils/api';
import { ImageRow, Node } from '../../types';
import { ExportImageDialog } from '../transfer/ExportImageDialog';
import { ImageDetailsDialog } from './ImageDetailsDialog';

export function ImagesPage() {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'gaps' | 'complete'>('all');

  const [exportDialog, setExportDialog] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageRow | null>(null);

  const load = useCallback(async (searchTerm?: string) => {
    setLoading(true);
    try {
      const [imagesRes, nodesRes] = await Promise.all([
        imagesApi.getImages(searchTerm),
        nodesApi.getNodes(),
      ]);
      setImages(imagesRes.data.images || []);
      setLastRefresh(imagesRes.data.lastRefresh);
      setNodes(nodesRes.data.nodes || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    load(e.target.value);
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    setError('');
    try {
      await imagesApi.refreshImages();
      await new Promise(r => setTimeout(r, 2000)); // wait for cache to update
      // Force fresh load after scan
      const [imagesRes, nodesRes] = await Promise.all([
        imagesApi.getImages(search),
        nodesApi.getNodes(),
      ]);
      setImages(imagesRes.data.images || []);
      setLastRefresh(imagesRes.data.lastRefresh);
      setNodes(nodesRes.data.nodes || []);
    } catch (err: any) {
      // still try to reload even on error
      try { await load(search); } catch {}
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshNode = async (nodeName: string) => {
    try {
      await imagesApi.refreshImages(nodeName);
      await load(search);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openExport = (img: ImageRow) => {
    setSelectedImage(img);
    setExportDialog(true);
  };

  const openDetails = (img: ImageRow) => {
    setSelectedImage(img);
    setDetailsDialog(true);
  };

  const filteredImages = images.filter(img => {
    if (filter === 'gaps') return img.nodes.some(n => !n.present) && img.nodes.some(n => n.present);
    if (filter === 'complete') return img.nodes.every(n => n.present);
    return true;
  });

  const gapCount = images.filter(img => img.nodes.some(n => !n.present) && img.nodes.some(n => n.present)).length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Image Inventory</Typography>
          <Typography variant="body2" color="text.secondary">
            {images.length} images across {nodes.length} nodes
            {lastRefresh && (
              <span style={{ marginLeft: 8, opacity: 0.6 }}>
                · Last scan: {new Date(lastRefresh).toLocaleString()}
              </span>
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={refreshing ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
          onClick={handleRefreshAll}
          disabled={refreshing}
        >
          Scan All Nodes
        </Button>
      </Box>

      {refreshing && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search images, repositories, tags..."
          value={search}
          onChange={handleSearch}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Filter</InputLabel>
          <Select value={filter} onChange={e => setFilter(e.target.value as any)} label="Filter">
            <MenuItem value="all">All Images ({images.length})</MenuItem>
            <MenuItem value="gaps">With Gaps ({gapCount})</MenuItem>
            <MenuItem value="complete">Complete ({images.length - gapCount})</MenuItem>
          </Select>
        </FormControl>

        {/* Per-node refresh buttons */}
        {nodes.slice(0, 4).map(node => (
          <Tooltip key={node.name} title={`Rescan ${node.name}`}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleRefreshNode(node.name)}
              sx={{ borderColor: 'rgba(255,255,255,0.12)', color: 'text.secondary', fontSize: '0.7rem' }}
            >
              <RefreshIcon sx={{ fontSize: 12, mr: 0.5 }} />
              {node.name}
            </Button>
          </Tooltip>
        ))}
      </Box>

      <Paper sx={{ overflow: 'auto' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 280 }}>Image</TableCell>
              {nodes.map(node => (
                <TableCell key={node.name} align="center" sx={{ minWidth: 80 }}>
                  <Tooltip title={node.ip}>
                    <Typography variant="caption" fontWeight={700}>{node.name}</Typography>
                  </Tooltip>
                </TableCell>
              ))}
              <TableCell align="right" sx={{ minWidth: 160 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={nodes.length + 2} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : filteredImages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={nodes.length + 2} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {search ? `No images matching "${search}"` : 'No images found. Scan nodes to populate inventory.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredImages.map(img => {
                const presentCount = img.nodes.filter(n => n.present).length;
                const hasGap = img.nodes.some(n => !n.present) && img.nodes.some(n => n.present);

                return (
                  <TableRow
                    key={img.name}
                    hover
                    sx={{
                      bgcolor: hasGap ? 'rgba(245,158,11,0.03)' : 'transparent',
                      '&:hover': { bgcolor: hasGap ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)' },
                    }}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="caption" fontFamily="monospace" fontWeight={600} color="text.primary">
                          {img.repository}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                          <Chip
                            label={img.tag}
                            size="small"
                            sx={{
                              height: 16, fontSize: '0.65rem',
                              bgcolor: 'rgba(124,58,237,0.15)', color: '#9D6EF8',
                              fontFamily: 'monospace',
                            }}
                          />
                          {hasGap && (
                            <Chip
                              label={`${presentCount}/${img.nodes.length}`}
                              size="small"
                              sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
                            />
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    {img.nodes.map(np => (
                      <TableCell key={np.nodeName} align="center">
                        {np.present
                          ? <CheckIcon sx={{ fontSize: 16, color: '#10B981' }} />
                          : <CrossIcon sx={{ fontSize: 16, color: 'rgba(239,68,68,0.4)' }} />
                        }
                      </TableCell>
                    ))}
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="View image details">
                          <IconButton size="small" onClick={() => openDetails(img)}>
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={hasGap ? 'Export to missing nodes' : 'Image is on all nodes'}>
                          <span>
                            <Button
                              size="small"
                              variant={hasGap ? 'contained' : 'outlined'}
                              startIcon={<ExportIcon sx={{ fontSize: 14 }} />}
                              onClick={() => openExport(img)}
                              disabled={!hasGap}
                              sx={{
                                fontSize: '0.7rem', py: 0.375, px: 1,
                                ...(hasGap ? {} : { borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }),
                              }}
                            >
                              Export To
                            </Button>
                          </span>
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

      <ExportImageDialog
        open={exportDialog}
        onClose={() => setExportDialog(false)}
        imageName={selectedImage?.name || ''}
      />

      <ImageDetailsDialog
        open={detailsDialog}
        onClose={() => setDetailsDialog(false)}
        image={selectedImage}
        onExport={() => openExport(selectedImage!)}
      />
    </Box>
  );
}
