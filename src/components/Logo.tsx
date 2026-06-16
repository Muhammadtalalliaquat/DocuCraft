import React from "react";
import { motion } from "motion/react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const markSize = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-12 h-12",
  }[size];

  const textClass = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  // click handler: refresh app (accessible via Enter/Space)
  const handleActivate = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (!e) return;
    // allow keyboard activation on Enter or Space
    if ((e as React.KeyboardEvent).key) {
      const k = (e as React.KeyboardEvent).key;
      if (k !== "Enter" && k !== " ") return;
    }
    // smooth page reload to reflect fresh state
    window.location.reload();
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <motion.div
        role="button"
        tabIndex={0}
        onClick={(e) => handleActivate(e)}
        onKeyDown={(e) => handleActivate(e)}
        className={`${markSize} shrink-0 select-none cursor-pointer rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400`}
        whileHover={{ scale: 1.08, rotate: 6 }}
        whileTap={{ scale: 0.96, rotate: 2 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        aria-label="DocuCraft — click to refresh"
      >
        <svg
          viewBox="0 0 64 64"
          role="img"
          aria-label="DocuCraft logo"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            {/* more accessible, friendlier gradient */}
            <linearGradient id="dc-grad-a" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="60%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <linearGradient id="dc-grad-b" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.8" />
            </linearGradient>
            <filter id="soft-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feBlend in="SourceGraphic" in2="b" mode="screen" />
            </filter>
          </defs>

          {/* Background rounded badge */}
          <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#dc-grad-a)" filter="url(#soft-glow)" />

          {/* Document page with folded corner (higher contrast) */}
          <g transform="translate(14,12)">
            <path d="M0 0h28v32H0z" fill="#ffffff" fillOpacity="0.12" />
            <path d="M0 0h20l8 8v24H0z" fill="#ffffff" fillOpacity="0.18" />
            <path d="M20 0v8h8" fill="#ffffff" fillOpacity="0.22" />
            <rect x="3" y="6" width="20" height="3" rx="1.2" fill="url(#dc-grad-b)" />
            <rect x="3" y="12" width="18" height="3" rx="1.2" fill="url(#dc-grad-b)" />
            <rect x="3" y="18" width="14" height="3" rx="1.2" fill="url(#dc-grad-b)" />
          </g>

          {/* Craft swoosh (pen/feather) overlapping the page - subtle stroke */}
          <path
            d="M40 30c-4 2-10 6-16 6-2 0-4-1-6-2"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.95"
            transform="translate(-4,-2)"
          />

          {/* Accent mark: visible, interactive color */}
          <circle cx="46" cy="18" r="4" fill="#fff" opacity="0.95" />
        </svg>
      </motion.div>

      {showText && (
        <span className={`${textClass} font-sans font-bold tracking-tight text-slate-900`}>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-500 via-violet-600 to-rose-500 font-extrabold">
            DocuCraft
          </span>
        </span>
      )}
    </div>
  );
}
