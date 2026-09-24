import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import withAuth from '../utils/withAuth';
import {
    Button,
    TextField,
    Snackbar,
    Alert,
    CircularProgress,
    type AlertColor,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventIcon from '@mui/icons-material/Event';
import VideocamIcon from '@mui/icons-material/Videocam';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Logo from '../components/Logo';
import "../App.css";

function Schedule() {
    const { scheduleMeeting, getScheduledMeetings } = useContext(AuthContext);
    const navigate = useNavigate();

    const [title, setTitle] = useState<string>("");
    const [scheduledTime, setScheduledTime] = useState<string>("");
    const [emails, setEmails] = useState<string>("");
    const [meetings, setMeetings] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [copiedCode, setCopiedCode] = useState<string>("");
    const [snack, setSnack] = useState<{ open: boolean; message: string; severity: AlertColor }>({
        open: false,
        message: "",
        severity: "success",
    });

    const loadMeetings = async () => {
        setLoading(true);
        try {
            const data = await getScheduledMeetings();
            setMeetings(data || []);
        } catch (e) {
            setSnack({ open: true, message: "Could not load scheduled meetings.", severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMeetings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSchedule = async () => {
        setSubmitting(true);
        try {
            const invitedEmails = emails
                .split(",")
                .map((e) => e.trim())
                .filter(Boolean);

            const result = await scheduleMeeting({ title, scheduledTime, invitedEmails });
            setSnack({
                open: true,
                message: `Meeting scheduled successfully. Code: ${result.meeting.meetingCode}`,
                severity: "success",
            });
            setTitle("");
            setScheduledTime("");
            setEmails("");
            loadMeetings();
        } catch (e: any) {
            setSnack({
                open: true,
                message: e?.response?.data?.message || "Failed to schedule meeting.",
                severity: "error",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(""), 2500);
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#070a13', color: '#f8fafc', padding: '24px 32px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                maxWidth: '840px',
                margin: '0 auto 24px auto',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate('/home')}
                        sx={{ color: '#94a3b8', textTransform: 'none', '&:hover': { color: '#ffffff' } }}
                    >
                        Back
                    </Button>
                    <Logo size="sm" onClick={() => navigate('/home')} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Schedule a Meeting</h2>
            </div>

            <div style={{ maxWidth: '840px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '28px' }}>
                {/* Left: Schedule Form */}
                <div style={{
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '24px',
                }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <EventIcon sx={{ color: '#06b6d4' }} />
                        New Meeting Details
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <TextField
                            label="Meeting Title"
                            placeholder="e.g. SFU Architecture Sync"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                                    '&:hover fieldset': { borderColor: '#06b6d4' },
                                }
                            }}
                        />
                        <TextField
                            label="Date & Time"
                            type="datetime-local"
                            InputLabelProps={{ shrink: true }}
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                                    '&:hover fieldset': { borderColor: '#06b6d4' },
                                }
                            }}
                        />
                        <TextField
                            label="Invite Attendees"
                            placeholder="alice@example.com, bob@example.com"
                            value={emails}
                            onChange={(e) => setEmails(e.target.value)}
                            helperText="Comma separated email addresses. Leave blank to generate code only."
                            FormHelperTextProps={{ sx: { color: '#64748b', fontSize: '0.75rem' } }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                                    '&:hover fieldset': { borderColor: '#06b6d4' },
                                }
                            }}
                        />
                        <Button
                            variant="contained"
                            onClick={handleSchedule}
                            disabled={submitting}
                            sx={{
                                background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                                borderRadius: '9999px',
                                py: 1.2,
                                fontWeight: 700,
                                textTransform: 'none',
                                fontSize: '0.95rem',
                                boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #0891b2 0%, #4f46e5 100%)',
                                }
                            }}
                        >
                            {submitting ? <CircularProgress size={22} sx={{ color: '#ffffff' }} /> : "Schedule Meeting"}
                        </Button>
                    </div>
                </div>

                {/* Right: Scheduled List */}
                <div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 700 }}>
                        Your Scheduled Meetings
                    </h3>

                    {loading ? (
                        <div style={{ textAlign: "center", padding: '30px 0' }}>
                            <CircularProgress sx={{ color: '#06b6d4' }} />
                        </div>
                    ) : meetings.length === 0 ? (
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.5)',
                            border: '1px dashed rgba(255, 255, 255, 0.15)',
                            borderRadius: '14px',
                            padding: '36px 20px',
                            textAlign: 'center',
                            color: '#64748b'
                        }}>
                            <EventIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>No scheduled meetings yet.</p>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem' }}>Create one using the form to reserve a slot.</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {meetings.map((m) => (
                                <div
                                    key={m._id}
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '14px',
                                        padding: '16px 20px',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                                            {m.title || "Untitled Meeting"}
                                        </h4>
                                        <span style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            color: '#06b6d4',
                                            background: 'rgba(6, 182, 212, 0.1)',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(6, 182, 212, 0.25)'
                                        }}>
                                            {m.meetingCode}
                                        </span>
                                    </div>

                                    {m.scheduledTime && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '12px' }}>
                                            <AccessTimeIcon sx={{ fontSize: 14 }} />
                                            {new Date(m.scheduledTime).toLocaleString()}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <Button
                                            size="small"
                                            startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                                            onClick={() => copyToClipboard(m.meetingCode)}
                                            sx={{
                                                color: copiedCode === m.meetingCode ? '#10b981' : '#94a3b8',
                                                textTransform: 'none',
                                                fontSize: '0.8rem',
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                borderRadius: '8px',
                                                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                                            }}
                                        >
                                            {copiedCode === m.meetingCode ? "Copied!" : "Copy Code"}
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="contained"
                                            startIcon={<VideocamIcon />}
                                            onClick={() => navigate(`/${m.meetingCode}`)}
                                            sx={{
                                                background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                                                borderRadius: '8px',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                            }}
                                        >
                                            Join Now
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Snackbar
                open={snack.open}
                autoHideDuration={5000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
            >
                <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
                    {snack.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default withAuth(Schedule);
