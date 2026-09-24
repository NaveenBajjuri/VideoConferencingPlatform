import React from 'react';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showBadge?: boolean;
    showText?: boolean;
    className?: string;
    onClick?: () => void;
}

export default function Logo({
    size = 'md',
    showBadge = true,
    showText = true,
    className = '',
    onClick
}: LogoProps) {
    // Sizing maps
    const dimensions = {
        sm: { icon: 24, fontSize: '1.1rem', badgeSize: '0.65rem', gap: '8px' },
        md: { icon: 34, fontSize: '1.45rem', badgeSize: '0.7rem', gap: '10px' },
        lg: { icon: 44, fontSize: '1.85rem', badgeSize: '0.75rem', gap: '12px' },
        xl: { icon: 56, fontSize: '2.4rem', badgeSize: '0.85rem', gap: '14px' },
    }[size];

    return (
        <div
            onClick={onClick}
            className={`pulse-logo-container ${className}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: dimensions.gap,
                cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
                textDecoration: 'none',
            }}
        >
            {/* SVG Vector Logo Icon */}
            <div
                style={{
                    position: 'relative',
                    width: dimensions.icon,
                    height: dimensions.icon,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <svg
                    width={dimensions.icon}
                    height={dimensions.icon}
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.45))' }}
                >
                    <defs>
                        {/* Gradients */}
                        <linearGradient id="pulseGradientPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#06B6D4" />
                            <stop offset="50%" stopColor="#6366F1" />
                            <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>

                        <linearGradient id="pulseGradientAccent" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>

                        <filter id="pulseGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* Outer Rounded Hexagon / Chamber Frame */}
                    <path
                        d="M24 4L41.32 14V34L24 44L6.68 34V14L24 4Z"
                        stroke="url(#pulseGradientPrimary)"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                        fill="rgba(15, 23, 42, 0.75)"
                    />

                    {/* Dynamic Soundwave / Video Frequency Pulses */}
                    {/* Left small bar */}
                    <rect x="14" y="21" width="3" height="6" rx="1.5" fill="url(#pulseGradientAccent)" />

                    {/* Mid-left tall bar */}
                    <rect x="19" y="15" width="3" height="18" rx="1.5" fill="url(#pulseGradientPrimary)" />

                    {/* Center peak pulse bar */}
                    <rect x="24" y="11" width="3.5" height="26" rx="1.75" fill="#06B6D4" filter="url(#pulseGlow)" />

                    {/* Mid-right tall bar */}
                    <rect x="29.5" y="17" width="3" height="14" rx="1.5" fill="url(#pulseGradientPrimary)" />

                    {/* Right small bar */}
                    <rect x="34.5" y="22" width="3" height="4" rx="1.5" fill="url(#pulseGradientAccent)" />

                    {/* Dynamic Camera Aperture dot */}
                    <circle cx="24" cy="24" r="2.5" fill="#FFFFFF" />
                </svg>
            </div>

            {/* Brand Wordmark */}
            {showText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                        style={{
                            fontSize: dimensions.fontSize,
                            fontWeight: 800,
                            letterSpacing: '-0.03em',
                            color: '#FFFFFF',
                            fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        Pulse
                        <span
                            style={{
                                background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                fontWeight: 800,
                                marginLeft: '1px',
                            }}
                        >
                            Meet
                        </span>
                    </span>

                    {/* SFU Architecture Pill Badge */}
                    {showBadge && (
                        <span
                            style={{
                                fontSize: dimensions.badgeSize,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: 'rgba(6, 182, 212, 0.12)',
                                color: '#06B6D4',
                                border: '1px solid rgba(6, 182, 212, 0.3)',
                                padding: '1px 6px',
                                borderRadius: '6px',
                                marginLeft: '2px',
                            }}
                        >
                            SFU
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
