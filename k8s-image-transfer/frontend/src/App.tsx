import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { theme } from './theme';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './components/dashboard/Dashboard';
import { NodesPage } from './components/nodes/NodesPage';
import { ImagesPage } from './components/images/ImagesPage';
import { HistoryPage } from './components/history/HistoryPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { transferApi } from './utils/api';

export default function App() {
  const [activeJobCount, setActiveJobCount] = useState(0);

  useEffect(() => {
    transferApi.getActiveJobs()
      .then(res => {
        const running = (res.data.jobs || []).filter(
          (j: any) => j.status === 'running' || j.status === 'queued'
        );
        setActiveJobCount(running.length);
      })
      .catch(() => {});

    const es = new EventSource('/api/transfer-jobs/stream/events');
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'init') {
        const running = data.jobs.filter((j: any) => j.status === 'running' || j.status === 'queued');
        setActiveJobCount(running.length);
      } else if (data.type === 'job-update') {
        transferApi.getActiveJobs()
          .then(res => {
            const running = (res.data.jobs || []).filter(
              (j: any) => j.status === 'running' || j.status === 'queued'
            );
            setActiveJobCount(running.length);
          })
          .catch(() => {});
      }
    };
    return () => es.close();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <BrowserRouter>
          <AppLayout activeJobs={activeJobCount}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/nodes" element={<NodesPage />} />
              <Route path="/images" element={<ImagesPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
