import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Chip, Table, TableBody,
  TableCell, TableHead, TableRow, IconButton,
} from '@mui/material';
import {
  CheckCircle as CheckIcon, Cancel as CrossIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { ImageRow } from '../../types';

interface ImageDetailsProps {
  open: boolean;
  onClose: () => void;
  image: ImageRow | null;
  onExport: () => void;
}

export function ImageDetailsDialog({ open, onClose, image, onExport }: ImageDetailsProps) {
  if (!image) return null;

  const presentCount = image.nodes.filter(n => n.present).length;
  const totalNodes = image.nodes.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Image Details</Typography>
          <Typography variant="caption" fontFamily="monospace" color="primary.main">
            {image.name}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Repository</Typography>
            <Typography variant="body2" fontFamily="monospace" color="text.primary">{image.repository}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Tag</Typography>
            <Chip label={image.tag} size="small" sx={{ mt: 0.5, bgcolor: 'rgba(124,58,237,0.2)', color: '#9D6EF8', fontFamily: 'monospace' }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Coverage</Typography>
            <Typography variant="body2" color={presentCount === totalNodes ? 'success.main' : 'warning.main'}>
              {presentCount}/{totalNodes} nodes
            </Typography>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', mb: 1 }}>
          Node Presence
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Node</TableCell>
              <TableCell align="center">Present</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {image.nodes.map(np => (
              <TableRow key={np.nodeName}>
                <TableCell>
                  <Typography variant="caption" fontFamily="monospace">{np.nodeName}</Typography>
                </TableCell>
                <TableCell align="center">
                  {np.present
                    ? <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                    : <CrossIcon sx={{ fontSize: 16, color: 'error.main', opacity: 0.5 }} />
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Close</Button>
        <Button variant="contained" onClick={() => { onClose(); onExport(); }}>
          Export Image To...
        </Button>
      </DialogActions>
    </Dialog>
  );
}
