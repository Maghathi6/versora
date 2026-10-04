import React from 'react';

interface BrandLogoProps {
  size?: number;
  showText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, showText = true }) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', userSelect: 'none' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="versoraGrad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="0.5" stopColor="#818CF8" />
            <stop offset="1" stopColor="#06B6D4" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Traceability Connection Paths */}
        {/* Main Trunk (Version lineage) */}
        <line x1="8" y1="8" x2="8" y2="28" stroke="url(#versoraGrad)" strokeWidth="3" strokeLinecap="round" />
        
        {/* Branching Connection to Impact Node */}
        <path
          d="M8 18C8 18 14 18 20 22C24 24.6 28 27 28 28"
          stroke="url(#versoraGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 0"
        />

        {/* Upstream Root Node */}
        <circle cx="8" cy="8" r="4.5" fill="#0E1422" stroke="#6366F1" strokeWidth="2.5" />
        <circle cx="8" cy="8" r="2" fill="#818CF8" />

        {/* Forking Version Node */}
        <circle cx="8" cy="18" r="4.5" fill="#0E1422" stroke="#818CF8" strokeWidth="2.5" />
        <circle cx="8" cy="18" r="2" fill="#FFFFFF" />

        {/* Downstream Impact Node (Target of Traceability) */}
        <circle cx="28" cy="28" r="4.5" fill="#0E1422" stroke="#06B6D4" strokeWidth="2.5" filter="url(#glow)" />
        <circle cx="28" cy="28" r="2" fill="#22D3EE" />

        {/* Baseline Tip Node */}
        <circle cx="8" cy="28" r="3.5" fill="#0E1422" stroke="#6366F1" strokeWidth="2" />
      </svg>

      {showText && (
        <span
          style={{
            fontSize: `${size * 0.65}px`,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #ffffff 40%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block',
          }}
        >
          VERSORA
        </span>
      )}
    </div>
  );
};
