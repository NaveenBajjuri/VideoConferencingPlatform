import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import VideocamIcon from '@mui/icons-material/Videocam';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import Logo from '../components/Logo';

export default function History() {
    const { getHistoryOfUser } = useContext(AuthContext);

    const [meetings, setMeetings] = useState<any[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [search, setSearch] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [copiedCode, setCopiedCode] = useState<string>("");

    const routeTo = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const data = await getHistoryOfUser(page, 10, search);
                setMeetings(data.meetings || []);
                setTotalPages(data.pagination?.totalPages || 1);
            } catch (e: any) {
                setError(e?.response?.data?.message || "Could not load meeting history. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();

        return `${day}/${month}/${year}`;
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
                maxWidth: '800px',
                margin: '0 auto 24px auto',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => routeTo('/home')}
                        sx={{ color: '#94a3b8', textTransform: 'none', '&:hover': { color: '#ffffff' } }}
                    >
                        Back
                    </Button>
                    <Logo size="sm" onClick={() => routeTo('/home')} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Meeting History</h2>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {/* Search Bar */}
                <div style={{ marginBottom: '24px' }}>
                    <TextField
                        fullWidth
                        placeholder="Search by meeting code..."
                        size="small"
                        value={search}
                        onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ color: '#64748b', mr: 1 }} />
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                borderRadius: '12px',
                                color: '#ffffff',
                                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                                '&:hover fieldset': { borderColor: '#06b6d4' },
                            }
                        }}
                    />
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", marginTop: "40px" }}>
                        <CircularProgress sx={{ color: '#06b6d4' }} />
                    </div>
                ) : meetings.length !== 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {meetings.map((e, i) => (
                            <div
                                key={e._id || i}
                                style={{
                                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '14px',
                                    padding: '16px 20px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{
                                            fontFamily: 'monospace',
                                            fontSize: '1rem',
                                            fontWeight: 700,
                                            color: '#06b6d4',
                                            background: 'rgba(6, 182, 212, 0.1)',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(6, 182, 212, 0.25)'
                                        }}>
                                            {e.meetingCode}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                        <CalendarTodayIcon sx={{ fontSize: 14 }} />
                                        {formatDate(e.date)}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Button
                                        size="small"
                                        startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
                                        onClick={() => copyToClipboard(e.meetingCode)}
                                        sx={{
                                            color: copiedCode === e.meetingCode ? '#10b981' : '#94a3b8',
                                            textTransform: 'none',
                                            fontSize: '0.8rem',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            borderRadius: '8px',
                                            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                                        }}
                                    >
                                        {copiedCode === e.meetingCode ? "Copied!" : "Copy"}
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<VideocamIcon />}
                                        onClick={() => routeTo(`/${e.meetingCode}`)}
                                        sx={{
                                            background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                                            borderRadius: '8px',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                        }}
                                    >
                                        Rejoin
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                        <p style={{ fontSize: '1.1rem', margin: '0 0 8px 0' }}>No meeting history found.</p>
                        <p style={{ fontSize: '0.9rem', margin: 0 }}>Completed meetings will be logged here automatically.</p>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "center", marginTop: "24px" }}>
                        <Button
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            sx={{ color: '#06b6d4', textTransform: 'none' }}
                        >
                            Previous
                        </Button>
                        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Page {page} of {totalPages}</span>
                        <Button
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            sx={{ color: '#06b6d4', textTransform: 'none' }}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </div>

            <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError("")}>
                <Alert severity="error" onClose={() => setError("")}>{error}</Alert>
            </Snackbar>
        </div>
    );
}
