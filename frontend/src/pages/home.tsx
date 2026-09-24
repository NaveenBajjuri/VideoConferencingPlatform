import React, { useContext, useState } from 'react';
import withAuth from '../utils/withAuth';
import { useNavigate } from 'react-router-dom';
import "../App.css";
import { Button, IconButton, TextField, Snackbar, Alert, Tooltip } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import EventIcon from '@mui/icons-material/Event';
import LogoutIcon from '@mui/icons-material/Logout';
import VideocamIcon from '@mui/icons-material/Videocam';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { AuthContext } from '../contexts/AuthContext';
import Logo from '../components/Logo';

function HomeComponent() {
    const navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState<string>("");
    const [error, setError] = useState<string>("");

    const { addToUserHistory, handleLogout } = useContext(AuthContext);

    const handleJoinVideoCall = async () => {
        if (!meetingCode.trim()) {
            setError("Please enter a meeting code before joining.");
            return;
        }
        try {
            await addToUserHistory(meetingCode.trim());
            navigate(`/${meetingCode.trim()}`);
        } catch (e) {
            navigate(`/${meetingCode.trim()}`);
        }
    };

    const handleStartInstantMeeting = async () => {
        const randomCode = "pulse-" + Math.random().toString(36).substring(2, 9);
        try {
            await addToUserHistory(randomCode);
            navigate(`/${randomCode}`);
        } catch (e) {
            navigate(`/${randomCode}`);
        }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#070a13', color: '#f8fafc' }}>
            {/* Top Navigation Bar */}
            <div className="navBar">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Logo size="md" onClick={() => navigate('/home')} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Tooltip title="Schedule a meeting">
                        <Button
                            startIcon={<EventIcon />}
                            onClick={() => navigate("/schedule")}
                            sx={{
                                color: '#94a3b8',
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.05)' }
                            }}
                        >
                            Schedule
                        </Button>
                    </Tooltip>

                    <Tooltip title="View meeting history">
                        <Button
                            startIcon={<RestoreIcon />}
                            onClick={() => navigate("/history")}
                            sx={{
                                color: '#94a3b8',
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.05)' }
                            }}
                        >
                            History
                        </Button>
                    </Tooltip>

                    <Tooltip title="Sign out of your account">
                        <IconButton
                            onClick={() => handleLogout()}
                            aria-label="Logout"
                            sx={{
                                color: '#ef4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.2)' }
                            }}
                        >
                            <LogoutIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </div>
            </div>

            {/* Main Dashboard Body */}
            <div className="dashboardContainer">
                {/* Welcome Hero Banner */}
                <div className="welcomeCard">
                    <div style={{ maxWidth: '640px' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(6, 182, 212, 0.12)',
                            color: '#06b6d4',
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            marginBottom: '14px',
                            border: '1px solid rgba(6, 182, 212, 0.25)'
                        }}>
                            <SpeedIcon fontSize="inherit" />
                            MEDIASOUP SFU CLUSTER ACTIVE
                        </span>
                        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                            Premium Video Collaboration for High-Performance Teams
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '1.05rem', margin: 0, lineHeight: 1.6 }}>
                            Host crystal-clear video calls, collaborate on real-time synchronized whiteboards, run interactive polls, and share screens with zero friction.
                        </p>
                    </div>
                </div>

                {/* Quick Action Cards Grid */}
                <div className="actionGrid">
                    {/* Card 1: Start Instant Meeting */}
                    <div className="actionCard" onClick={handleStartInstantMeeting}>
                        <div style={{
                            width: 50,
                            height: 50,
                            borderRadius: 14,
                            background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            marginBottom: '16px',
                            boxShadow: '0 0 20px rgba(6, 182, 212, 0.35)'
                        }}>
                            <VideocamIcon fontSize="medium" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
                            Instant Meeting
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                            Generate an immediate meeting room and invite participants via link.
                        </p>
                        <Button
                            variant="contained"
                            size="small"
                            sx={{
                                background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                                borderRadius: '9999px',
                                textTransform: 'none',
                                fontWeight: 700,
                                px: 2,
                            }}
                        >
                            Start Now
                        </Button>
                    </div>

                    {/* Card 2: Join with Meeting Code */}
                    <div className="actionCard" style={{ cursor: 'default' }}>
                        <div style={{
                            width: 50,
                            height: 50,
                            borderRadius: 14,
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#06b6d4',
                            marginBottom: '16px'
                        }}>
                            <KeyboardIcon fontSize="medium" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
                            Join via Code
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                            Enter an existing room code or invitation link to join.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <TextField
                                size="small"
                                placeholder="e.g. pulse-room1"
                                variant="outlined"
                                value={meetingCode}
                                onChange={(e) => setMeetingCode(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleJoinVideoCall(); }}
                                sx={{
                                    flex: 1,
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                        borderRadius: '9999px',
                                        color: '#ffffff',
                                        fontSize: '0.9rem',
                                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                                        '&:hover fieldset': { borderColor: '#06b6d4' },
                                    }
                                }}
                            />
                            <Button
                                onClick={handleJoinVideoCall}
                                variant="contained"
                                sx={{
                                    background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                                    borderRadius: '9999px',
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    px: 2.5,
                                }}
                            >
                                Join
                            </Button>
                        </div>
                    </div>

                    {/* Card 3: Schedule Calendar */}
                    <div className="actionCard" onClick={() => navigate("/schedule")}>
                        <div style={{
                            width: 50,
                            height: 50,
                            borderRadius: 14,
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#818cf8',
                            marginBottom: '16px'
                        }}>
                            <EventIcon fontSize="medium" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
                            Schedule Meeting
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                            Plan upcoming meetings, invite attendees, and generate calendar entries.
                        </p>
                        <Button
                            variant="outlined"
                            size="small"
                            sx={{
                                borderColor: 'rgba(99, 102, 241, 0.4)',
                                color: '#a5b4fc',
                                borderRadius: '9999px',
                                textTransform: 'none',
                                fontWeight: 600,
                                px: 2,
                                '&:hover': { borderColor: '#818cf8', backgroundColor: 'rgba(99, 102, 241, 0.1)' }
                            }}
                        >
                            View Calendar
                        </Button>
                    </div>
                </div>

                {/* Features & Architecture Status Pill */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '18px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CheckCircleOutlineIcon sx={{ color: '#10b981' }} />
                        <div>
                            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#ffffff' }}>Mediasoup C++ Media Router Connected</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '8px' }}>• Simulcast (180p/360p/720p) Enabled</span>
                        </div>
                    </div>
                    <Button
                        size="small"
                        onClick={() => navigate('/history')}
                        sx={{ color: '#06b6d4', textTransform: 'none', fontWeight: 600 }}
                    >
                        View Past Activity →
                    </Button>
                </div>
            </div>

            <Snackbar
                open={Boolean(error)}
                autoHideDuration={4000}
                onClose={() => setError("")}
            >
                <Alert severity="warning" onClose={() => setError("")} sx={{ borderRadius: 2 }}>
                    {error}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default withAuth(HomeComponent);
