import * as React from 'react';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import LayersIcon from '@mui/icons-material/Layers';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Premium dark theme for MUI components
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#06b6d4',
            light: '#38bdf8',
            dark: '#0891b2',
        },
        secondary: {
            main: '#6366f1',
        },
        background: {
            default: '#070a13',
            paper: '#0f172a',
        },
        text: {
            primary: '#f8fafc',
            secondary: '#94a3b8',
        },
    },
    typography: {
        fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
    },
    shape: {
        borderRadius: 12,
    },
});

export default function Authentication() {
    const [username, setUsername] = React.useState<string>("");
    const [password, setPassword] = React.useState<string>("");
    const [name, setName] = React.useState<string>("");
    const [error, setError] = React.useState<string>("");
    const [message, setMessage] = React.useState<string>("");

    const [formState, setFormState] = React.useState<number>(0);
    const [open, setOpen] = React.useState<boolean>(false);

    const { handleRegister, handleLogin } = React.useContext(AuthContext);
    const navigate = useNavigate();

    const handleAuth = async () => {
        try {
            if (formState === 0) {
                await handleLogin(username, password);
            }
            if (formState === 1) {
                const result = await handleRegister(name, username, password);
                setUsername("");
                setMessage(result);
                setOpen(true);
                setError("");
                setFormState(0);
                setPassword("");
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Authentication failed. Please check your credentials.";
            setError(msg);
        }
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <Grid container component="main" sx={{ minHeight: '100vh', backgroundColor: '#070a13' }}>
                <CssBaseline />

                {/* Left Brand Showcase Panel */}
                <Grid
                    item
                    xs={false}
                    sm={4}
                    md={6}
                    sx={{
                        background: 'radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.25) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(6, 182, 212, 0.2) 0%, transparent 60%), #0b0f19',
                        display: { xs: 'none', sm: 'flex' },
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: { sm: 4, md: 6 },
                        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                            <Button
                                startIcon={<ArrowBackIcon />}
                                onClick={() => navigate('/')}
                                sx={{ color: '#94a3b8', textTransform: 'none', '&:hover': { color: '#ffffff' } }}
                            >
                                Back to Home
                            </Button>
                        </div>
                        <Logo size="lg" />
                        <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '2.5rem', marginBottom: '1rem', lineHeight: 1.2, color: '#ffffff' }}>
                            Next-Generation SFU Video Collaboration.
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.6, maxWidth: '440px' }}>
                            Connect with team members worldwide using ultra-low latency C++ SFU media streaming, 3-layer adaptive simulcast, and interactive whiteboards.
                        </p>
                    </div>

                    {/* Highlights Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <SpeedIcon sx={{ color: '#06b6d4' }} />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>Mediasoup C++ Architecture</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Flat $O(1)$ client upload bandwidth overhead</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <LayersIcon sx={{ color: '#6366f1' }} />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>3-Layer Adaptive Simulcast</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Auto-scaled resolutions (180p, 360p, 720p HD)</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <SecurityIcon sx={{ color: '#10b981' }} />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>Host Protection &amp; Waiting Rooms</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Gated participant admissions and lock toggles</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2rem' }}>
                        © {new Date().getFullYear()} PulseMeet Inc. Enterprise Real-Time WebRTC.
                    </div>
                </Grid>

                {/* Right Authentication Form Panel */}
                <Grid
                    item
                    xs={12}
                    sm={8}
                    md={6}
                    component={Paper}
                    elevation={0}
                    square
                    sx={{
                        backgroundColor: '#070a13',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: { xs: 3, sm: 5, md: 8 },
                    }}
                >
                    <Box
                        sx={{
                            width: '100%',
                            maxWidth: 440,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        {/* Mobile Logo */}
                        <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 3 }}>
                            <Logo size="md" />
                        </Box>

                        {/* Segmented Auth Mode Switcher */}
                        <div
                            style={{
                                display: 'flex',
                                background: 'rgba(15, 23, 42, 0.85)',
                                padding: '4px',
                                borderRadius: '9999px',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                width: '100%',
                                marginBottom: '24px',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => { setFormState(0); setError(""); }}
                                style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    background: formState === 0 ? 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)' : 'transparent',
                                    color: formState === 0 ? '#ffffff' : '#94a3b8',
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: formState === 0 ? '0 0 15px rgba(6, 182, 212, 0.35)' : 'none',
                                }}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                onClick={() => { setFormState(1); setError(""); }}
                                style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    background: formState === 1 ? 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)' : 'transparent',
                                    color: formState === 1 ? '#ffffff' : '#94a3b8',
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: formState === 1 ? '0 0 15px rgba(6, 182, 212, 0.35)' : 'none',
                                }}
                            >
                                Sign Up
                            </button>
                        </div>

                        <div style={{ textAlign: 'center', marginBottom: '20px', width: '100%' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
                                {formState === 0 ? "Welcome back" : "Create your PulseMeet account"}
                            </h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                                {formState === 0 ? "Enter your credentials to access your meetings" : "Get started with your free enterprise workspace"}
                            </p>
                        </div>

                        <Box component="form" noValidate sx={{ width: '100%' }}>
                            {formState === 1 && (
                                <TextField
                                    margin="normal"
                                    required
                                    fullWidth
                                    id="name"
                                    label="Full Name"
                                    name="name"
                                    value={name}
                                    autoFocus
                                    onChange={(e) => setName(e.target.value)}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                        }
                                    }}
                                />
                            )}

                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="username"
                                label="Username"
                                name="username"
                                value={username}
                                autoFocus={formState === 0}
                                onChange={(e) => setUsername(e.target.value)}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                    }
                                }}
                            />

                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                value={password}
                                type="password"
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAuth(); }}
                                id="password"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                    }
                                }}
                            />

                            {error && (
                                <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                                    {error}
                                </Alert>
                            )}

                            <Button
                                type="button"
                                fullWidth
                                variant="contained"
                                sx={{
                                    mt: 3,
                                    mb: 2,
                                    py: 1.4,
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    borderRadius: '9999px',
                                    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
                                    boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
                                    textTransform: 'none',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #0891b2 0%, #4f46e5 100%)',
                                        boxShadow: '0 0 25px rgba(6, 182, 212, 0.5)',
                                    },
                                }}
                                onClick={handleAuth}
                            >
                                {formState === 0 ? "Sign In" : "Create Account"}
                            </Button>

                            {/* Guest option */}
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Want to try without an account? </span>
                                <span
                                    role="button"
                                    onClick={() => {
                                        const guestRoom = "guest-" + Math.random().toString(36).substring(2, 8);
                                        navigate(`/${guestRoom}`);
                                    }}
                                    style={{
                                        color: '#06b6d4',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                    }}
                                >
                                    Join as Guest
                                </span>
                            </div>
                        </Box>
                    </Box>
                </Grid>
            </Grid>

            <Snackbar
                open={open}
                autoHideDuration={4000}
                onClose={() => setOpen(false)}
            >
                <Alert severity="success" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
                    {message}
                </Alert>
            </Snackbar>
        </ThemeProvider>
    );
}
