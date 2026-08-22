import blue from '@material-ui/core/colors/blue'
import stylesheet from './dark.css.js'

const surface = '#141820'
const elevated = '#1c2330'
const ink = '#e8eef8'

export default {
  themeName: 'Dark',
  typography: {
    fontFamily:
      'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    h4: {
      fontWeight: 750,
      letterSpacing: '-0.03em',
    },
    h6: {
      fontSize: '1.05rem',
      fontWeight: 650,
    },
    button: {
      textTransform: 'none',
      fontWeight: 650,
    },
  },
  palette: {
    primary: {
      light: '#b9e0ff',
      main: '#8ec8ff',
      dark: '#4f8ec8',
      contrastText: '#071018',
    },
    secondary: blue,
    background: {
      default: '#0e1218',
      paper: surface,
    },
    text: {
      primary: ink,
      secondary: '#a9b4c7',
    },
    type: 'dark',
  },
  overrides: {
    MuiCssBaseline: {
      '@global': {
        body: {
          backgroundColor: '#0e1218',
        },
      },
    },
    MuiFormGroup: {
      root: {
        color: 'white',
      },
    },
    MuiButton: {
      root: {
        minHeight: 48,
        borderRadius: 12,
      },
      textPrimary: {
        color: '#fff',
      },
      containedPrimary: {
        boxShadow: 'none',
      },
    },
    MuiIconButton: {
      root: {
        '&:focus-visible': {
          outline: '2px solid #8ec8ff',
          outlineOffset: 2,
        },
      },
    },
    MuiPaper: {
      rounded: {
        borderRadius: 16,
      },
      elevation1: {
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.24)',
      },
    },
    MuiAppBar: {
      colorSecondary: {
        backgroundColor: 'rgba(14, 18, 24, 0.88)',
        backdropFilter: 'blur(16px)',
        color: ink,
      },
    },
    MuiDrawer: {
      paper: {
        backgroundColor: '#10151d',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      },
    },
    RaLayout: {
      content: {
        background:
          'linear-gradient(180deg, #182033 0%, #0e1218 280px, #0e1218 100%)',
      },
    },
    RaMenuItemLink: {
      root: {
        minHeight: 48,
        borderRadius: 12,
      },
      active: {
        backgroundColor: 'rgba(142, 200, 255, 0.12)',
      },
    },
    NDListenNow: {
      root: {
        backgroundImage:
          'linear-gradient(135deg, rgba(142,200,255,0.28) 0%, rgba(28,35,48,0.94) 58%, #1c2330 100%)',
      },
      title: {
        color: ink,
      },
    },
    NDHomeRail: {
      title: {
        color: ink,
      },
      source: {
        color: '#a9b4c7',
      },
    },
    NDMediaCard: {
      root: {
        backgroundColor: elevated,
      },
    },
    NDLogin: {
      systemNameLink: {
        color: '#8ec8ff',
      },
      icon: {},
      welcome: {
        color: '#eee',
      },
      card: {
        minWidth: 300,
        backgroundColor: '#1c2330ed',
      },
      avatar: {},
      button: {
        boxShadow: '3px 3px 5px #000000a3',
      },
    },
    NDMobileArtistDetails: {
      bgContainer: {
        background:
          'linear-gradient(to bottom, rgba(20 24 32 / 72%), rgb(14 18 24))!important',
      },
    },
  },
  player: {
    theme: 'dark',
    stylesheet,
  },
}
