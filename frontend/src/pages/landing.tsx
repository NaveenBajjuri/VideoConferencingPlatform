import React, { useState } from 'react';
import "../App.css";
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import VideocamIcon from '@mui/icons-material/Videocam';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SpeedIcon from '@mui/icons-material/Speed';
import LayersIcon from '@mui/icons-material/Layers';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import BrushIcon from '@mui/icons-material/Brush';
import PollIcon from '@mui/icons-material/Poll';
import SecurityIcon from '@mui/icons-material/Security';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import MicIcon from '@mui/icons-material/Mic';

export default function LandingPage() {
    const router = useNavigate();
    const [roomInput, setRoomInput] = useState<string>("");

    const handleJoinWithCode = () => {
        if (roomInput.trim()) {
            router(`/${roomInput.trim()}`);
        }
    };

    const handleStartInstant = () => {
        // Generate a random clean room code (e.g. "pulse-xyz789")
        const randomCode = "meet-" + Math.random().toString(36).substring(2, 9);
        router(`/${randomCode}`);
    };

    return (
        <div className="landingPageContainer">
            {/* Glass Navigation Bar */}
            <nav>
                <div className="navHeader">
                    <Logo size="md" onClick={() => router("/")} />
                </div>
                <div className="navlist">
                    <a href="#features" className="navLink">Features</a>
                    <a href="#architecture" className="navLink">SFU Architecture</a>
                    <span
                        className="guestBadge"
                        role="button"
                        onClick={() => {
                            const guestRoom = "guest-" + Math.random().toString(36).substring(2, 8);
                            router(`/${guestRoom}`);
                        }}
                    >
                        Join as Guest
                    </span>
                    <Link to="/auth" className="loginBtn">
                        Sign In
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="landingHero">
                <div className="heroBadge">
                    <span className="pulseDot"></span>
                    Powered by Mediasoup C++ SFU &amp; WebRTC
                </div>

                <h1 className="heroTitle">
                    Ultra-Low Latency Video Meetings at{' '}
                    <span className="heroTitleGradient">Global Scale</span>
                </h1>

                <p className="heroSubtitle">
                    Experience crystal-clear multi-party collaboration powered by high-performance C++ SFU media routers,
                    3-layer adaptive simulcast, AI active speaker detection, and synchronized whiteboarding.
                </p>

                {/* Instant Launch & Room Code Actions */}
                <div className="heroActions">
                    <button className="btnPrimary" onClick={handleStartInstant}>
                        <VideocamIcon />
                        Start Instant Meeting
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="Enter room code..."
                            value={roomInput}
                            onChange={(e) => setRoomInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleJoinWithCode(); }}
                            style={{
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#ffffff',
                                padding: '0.85rem 1.25rem',
                                borderRadius: '9999px',
                                fontSize: '0.95rem',
                                outline: 'none',
                                width: '180px',
                                transition: 'border-color 0.2s ease',
                            }}
                        />
                        <button className="btnSecondary" onClick={handleJoinWithCode}>
                            Join
                        </button>
                    </div>

                    <Link to="/auth" style={{ textDecoration: 'none' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                            Or <strong style={{ color: '#06b6d4' }}>Get Started</strong> free <ArrowForwardIcon style={{ fontSize: 16 }} />
                        </span>
                    </Link>
                </div>

                {/* Interactive Hero Showcase Mockup */}
                <div className="heroMockupContainer">
                    <div className="heroMockupCard">
                        <div className="mockupHeader">
                            <div className="mockupDots">
                                <div className="mockupDot" style={{ background: '#ef4444' }}></div>
                                <div className="mockupDot" style={{ background: '#f59e0b' }}></div>
                                <div className="mockupDot" style={{ background: '#10b981' }}></div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <SignalCellularAltIcon style={{ color: '#10b981', fontSize: 16 }} />
                                    18ms RTT • 0% Loss
                                </span>
                                <span style={{ fontSize: '0.75rem', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                    Simulcast: 720p HD
                                </span>
                            </div>
                        </div>

                        <div className="mockupVideoGrid">
                            {/* Main Active Speaker Tile */}
                            <div className="mockupTile mockupTileActive">
                                <div className="mockupBadge mockupBadgeTopRight">
                                    <MicIcon style={{ fontSize: 14 }} />
                                    Active Speaker
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #6366f1)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
                                        JD
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <div className="mockupWaveAnimation">
                                            <div className="waveBar"></div>
                                            <div className="waveBar"></div>
                                            <div className="waveBar"></div>
                                            <div className="waveBar"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mockupBadge mockupBadgeBottomLeft">
                                    John Doe (Host)
                                </div>
                            </div>

                            {/* Secondary Remote Participant Tiles */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div className="mockupTile" style={{ height: '134px' }}>
                                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                                        AS
                                    </div>
                                    <div className="mockupBadge mockupBadgeBottomLeft">
                                        Alice Smith
                                    </div>
                                </div>
                                <div className="mockupTile" style={{ height: '134px' }}>
                                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                                        RK
                                    </div>
                                    <div className="mockupBadge mockupBadgeBottomLeft">
                                        Robert King
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Performance Metrics Section */}
            <section className="metricsSection" id="architecture">
                <div className="metricsGrid">
                    <div className="metricItem">
                        <div className="metricValue">&lt; 50ms</div>
                        <div className="metricLabel">Average SFU Latency</div>
                    </div>
                    <div className="metricItem">
                        <div className="metricValue">3-Layer</div>
                        <div className="metricLabel">Adaptive Simulcast (HD/SD/LD)</div>
                    </div>
                    <div className="metricItem">
                        <div className="metricValue">O(1)</div>
                        <div className="metricLabel">Flat Client Bandwidth Overhead</div>
                    </div>
                    <div className="metricItem">
                        <div className="metricValue">99.9%</div>
                        <div className="metricLabel">WebRTC Session Reliability</div>
                    </div>
                </div>
            </section>

            {/* Features Showcase Section */}
            <section className="featuresSection" id="features">
                <div className="featuresHeader">
                    <h2>Engineered for High-Frequency Video Collaboration</h2>
                    <p>
                        PulseMeet transitions beyond standard peer-to-peer limits with an enterprise C++ Selective Forwarding Unit.
                    </p>
                </div>

                <div className="featuresGrid">
                    {/* Card 1 */}
                    <div className="featureCard">
                        <div className="featureIconWrapper">
                            <SpeedIcon />
                        </div>
                        <h3>Mediasoup C++ SFU Engine</h3>
                        <p>
                            Replaces battery-draining $O(N^2)$ browser mesh architectures with flat $O(1)$ client uploads routed through low-level C++ worker threads.
                        </p>
                    </div>

                    {/* Card 2 */}
                    <div className="featureCard">
                        <div className="featureIconWrapper">
                            <LayersIcon />
                        </div>
                        <h3>3-Layer WebRTC Simulcast</h3>
                        <p>
                            Broadcasting at 180p, 360p, and 720p simultaneously. Remote thumbnails dynamically receive lightweight streams, slashing downstream packet consumption.
                        </p>
                    </div>

                    {/* Card 3 */}
                    <div className="featureCard">
                        <div className="featureIconWrapper">
                            <RecordVoiceOverIcon />
                        </div>
                        <h3>Active Speaker AI Detection</h3>
                        <p>
                            Server-side voice activity detection via Mediasoup AudioLevelObserver highlights the speaker instantly with glowing audio rings and auto-spotlight.
                        </p>
                    </div>

                    {/* Card 4 */}
                    <div className="featureCard">
                        <div className="featureIconWrapper">
                            <BrushIcon />
                        </div>
                        <h3>Collaborative Whiteboard</h3>
                        <p>
                            Interactive synchronized vector canvas with multi-color pens, eraser, real-time broadcast deltas, and one-click PNG export.
                        </p>
                    </div>

                    {/* Card 5 */}
                    <div className="featureCard">
                        <div className="featureIconWrapper">
                            <PollIcon />
                        </div>
                        <h3>Live In-Call Polling</h3>
                        <p>
                            Host-driven interactive polling engine featuring instant response aggregation and animated percentage progress bars.
                        </p>
                    </div>

                    {/* Card 6 */}
                    <div className="featureCard">
                        <div className="featureIconWrapper">
                            <SecurityIcon />
                        </div>
                        <h3>Host Controls &amp; Waiting Room</h3>
                        <p>
                            One-click mute-all, meeting lock barriers, admission gating with approval queue, and fine-grained participant permission controls.
                        </p>
                    </div>
                </div>
            </section>

            {/* Modern Footer */}
            <footer className="landingFooter">
                <div className="footerContent">
                    <Logo size="sm" />
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        © {new Date().getFullYear()} PulseMeet Inc. All rights reserved. Ultra-Low Latency SFU Video Collaboration.
                    </div>
                    <div className="footerStatus">
                        <span className="pulseDot" style={{ width: 6, height: 6 }}></span>
                        SFU Cluster Operational
                    </div>
                </div>
            </footer>
        </div>
    );
}
