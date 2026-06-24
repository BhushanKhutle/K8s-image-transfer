import React, { useState } from 'react';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, IconButton, Tooltip, Chip, useMediaQuery, useTheme,
  AppBar, Toolbar,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Storage as StorageIcon,
  Image as ImageIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Hub as HubIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;
const DRAWER_COLLAPSED = 64;

interface LayoutProps {
  children: React.ReactNode;
  activeJobs?: number;
}

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { label: 'Nodes', icon: <StorageIcon />, path: '/nodes' },
  { label: 'Images', icon: <ImageIcon />, path: '/images' },
  { label: 'Transfer History', icon: <HistoryIcon />, path: '/history' },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

export function AppLayout({ children, activeJobs = 0 }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const drawerWidth = collapsed ? DRAWER_COLLAPSED : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #0D1422 0%, #0A0E1A 100%)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          },
        }}
        open={!isMobile || !collapsed}
        onClose={() => setCollapsed(true)}
      >
        {/* Logo */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          px: collapsed ? 1.5 : 2,
          py: 2,
          minHeight: 64,
          gap: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: '8px',
            background: 'linear-gradient(135deg, #00D4FF 0%, #7C3AED 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <HubIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          {!collapsed && (
            <Box>
              <Typography variant="body2" fontWeight={700} color="text.primary" lineHeight={1.2}>
                K8s Image
              </Typography>
              <Typography variant="caption" color="primary.main" lineHeight={1.2}>
                Transfer Manager
              </Typography>
            </Box>
          )}
          {!collapsed && (
            <IconButton
              size="small"
              onClick={() => setCollapsed(true)}
              sx={{ ml: 'auto', color: 'text.secondary' }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Nav items */}
        <List sx={{ flex: 1, py: 2, px: collapsed ? 0.5 : 1 }}>
          {navItems.map((item) => {
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <Tooltip title={collapsed ? item.label : ''} placement="right">
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: '6px',
                      minHeight: 40,
                      px: collapsed ? 1 : 1.5,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active
                        ? 'linear-gradient(90deg, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.05) 100%)'
                        : 'transparent',
                      borderLeft: active ? '2px solid #00D4FF' : '2px solid transparent',
                      '&:hover': {
                        background: 'rgba(0,212,255,0.08)',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: collapsed ? 0 : 1.5,
                        color: active ? 'primary.main' : 'text.secondary',
                        fontSize: 20,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: '0.85rem',
                          fontWeight: active ? 600 : 400,
                          color: active ? 'primary.main' : 'text.secondary',
                        }}
                      />
                    )}
                    {!collapsed && item.label === 'Transfer History' && activeJobs > 0 && (
                      <Chip
                        label={activeJobs}
                        size="small"
                        color="primary"
                        sx={{ height: 18, fontSize: '0.65rem', ml: 1 }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>

        {/* Footer */}
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        <Box sx={{ p: collapsed ? 1 : 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          {!collapsed ? (
            <>
              <CircleIcon sx={{ fontSize: 8, color: 'success.main' }} />
              <Typography variant="caption" color="text.secondary">
                API Connected
              </Typography>
              <IconButton
                size="small"
                onClick={() => setCollapsed(false)}
                sx={{ ml: 'auto', color: 'text.secondary', display: collapsed ? 'flex' : 'none' }}
              >
                <MenuIcon fontSize="small" />
              </IconButton>
            </>
          ) : (
            <Tooltip title="Expand sidebar" placement="right">
              <IconButton
                size="small"
                onClick={() => setCollapsed(false)}
                sx={{ color: 'text.secondary', mx: 'auto' }}
              >
                <MenuIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
