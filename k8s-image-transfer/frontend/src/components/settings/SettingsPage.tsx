import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Alert,
  Divider, Grid, CircularProgress,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { settingsApi } from '../../utils/api';

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    kubectl_path: '/usr/local/bin/kubectl',
    ssh_timeout: '30000',
    transfer_timeout: '300000',
    auto_refresh_interval: '60',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    settingsApi.getSettings()
      .then(res => setSettings(res.data.settings || {}))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.updateSettings(settings);
      setSuccess('Settings saved successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ p: 3, maxWidth: 640 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure cluster connectivity and transfer behavior
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ mb: 2 }}>
          Kubernetes
        </Typography>
        <TextField
          label="kubectl Path"
          value={settings.kubectl_path || ''}
          onChange={e => update('kubectl_path', e.target.value)}
          fullWidth
          helperText="Full path to kubectl binary for cluster discovery"
          sx={{ mb: 3 }}
        />

        <Divider sx={{ mb: 3 }} />

        <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ mb: 2 }}>
          SSH Timeouts
        </Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6}>
            <TextField
              label="SSH Connect Timeout (ms)"
              type="number"
              value={settings.ssh_timeout || '30000'}
              onChange={e => update('ssh_timeout', e.target.value)}
              fullWidth
              helperText="Connection timeout in milliseconds"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Transfer Timeout (ms)"
              type="number"
              value={settings.transfer_timeout || '300000'}
              onChange={e => update('transfer_timeout', e.target.value)}
              fullWidth
              helperText="Max time for a single image transfer"
            />
          </Grid>
        </Grid>

        <Divider sx={{ mb: 3 }} />

        <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ mb: 2 }}>
          UI Behavior
        </Typography>
        <TextField
          label="Auto-refresh Interval (seconds)"
          type="number"
          value={settings.auto_refresh_interval || '60'}
          onChange={e => update('auto_refresh_interval', e.target.value)}
          helperText="Set to 0 to disable auto-refresh of active jobs"
          sx={{ mb: 3, width: 260 }}
        />

        <Divider sx={{ mb: 3 }} />

        <Box sx={{
          p: 2, bgcolor: 'rgba(239,68,68,0.05)', borderRadius: 1,
          border: '1px solid rgba(239,68,68,0.15)', mb: 3,
        }}>
          <Typography variant="body2" fontWeight={600} color="error.main" sx={{ mb: 0.5 }}>
            Manual-only Transfer Policy
          </Typography>
          <Typography variant="caption" color="text.secondary">
            This application never synchronizes images automatically.
            Images are only copied when you explicitly click "Copy Image" in the Export dialog.
            There are no background sync jobs or scheduled tasks.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          Save Settings
        </Button>
      </Paper>
    </Box>
  );
}
