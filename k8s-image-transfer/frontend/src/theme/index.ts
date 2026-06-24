import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00D4FF',
      light: '#33DDFF',
      dark: '#0099BB',
    },
    secondary: {
      main: '#7C3AED',
      light: '#9D6EF8',
      dark: '#5B21B6',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
    },
    warning: {
      main: '#F59E0B',
      light: '#FCD34D',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
    },
    background: {
      default: '#0A0E1A',
      paper: '#0F1629',
    },
    divider: 'rgba(255,255,255,0.08)',
    text: {
      primary: '#E2E8F0',
      secondary: '#94A3B8',
    },
  },
  typography: {
    fontFamily: '"Inter", "JetBrains Mono", system-ui, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    body1: { fontSize: '0.9rem' },
    body2: { fontSize: '0.8rem' },
    caption: { fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace' },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(135deg, #0A0E1A 0%, #0D1422 100%)',
          minHeight: '100vh',
        },
        '::-webkit-scrollbar': { width: '6px', height: '6px' },
        '::-webkit-scrollbar-track': { background: '#0A0E1A' },
        '::-webkit-scrollbar-thumb': { background: '#1E293B', borderRadius: '3px' },
        '::-webkit-scrollbar-thumb:hover': { background: '#334155' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: '6px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 16px',
        },
        head: {
          background: 'rgba(0,0,0,0.3)',
          fontWeight: 700,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#94A3B8',
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
            '&:hover fieldset': { borderColor: 'rgba(0,212,255,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#00D4FF' },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.1)',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: '4px', height: '6px' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: '#1E293B',
          fontSize: '0.75rem',
          border: '1px solid rgba(255,255,255,0.1)',
        },
      },
    },
  },
});
