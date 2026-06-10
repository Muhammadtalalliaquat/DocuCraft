import React from "react";
import { motion } from "motion/react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  // Define dimensions based on size
  const markSize = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-12 h-12",
  }[size];

  const textClass = {
    sm: "text-md",
    md: "text-xl",
    lg: "text-2xl",
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Dynamic SVG logo mark */}
      <div className={`relative ${markSize} shrink-0 select-none group`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full transform transition-transform duration-500 ease-out group-hover:scale-105 group-hover:rotate-6"
        >
          {/* Defs for nice gradients and filters */}
          <defs>
            <linearGradient id="prism-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4338ca" /> {/* Indigo 700 */}
              <stop offset="50%" stopColor="#6366f1" /> {/* Indigo 500 */}
              <stop offset="100%" stopColor="#a855f7" /> {/* Purple 500 */}
            </linearGradient>
            <linearGradient id="prism-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" /> {/* Pink 500 */}
              <stop offset="100%" stopColor="#3b82f6" /> {/* Sky Blue 500 */}
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer geometric shield/polygon */}
          <path
            d="M20 2L35 11V29L20 38L5 29V11L20 2Z"
            stroke="url(#prism-grad-1)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className="opacity-45"
          />

          {/* Stacked isometric sheets (representing document handling) */}
          <path
            d="M11 13L20 8L29 13V25L20 30L11 25V13Z"
            fill="url(#prism-grad-1)"
            fillOpacity="0.15"
            stroke="url(#prism-grad-1)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          <path
            d="M14 16.5L20 13L26 16.5V22.5L20 26L14 22.5V16.5Z"
            fill="url(#prism-grad-2)"
            fillOpacity="0.25"
            stroke="url(#prism-grad-2)"
            strokeWidth="1"
            strokeLinejoin="round"
          />

          {/* Glowing AI star / lens in the center */}
          <path
            d="M20 15.5C20 15.5 20.2 17.2 21.2 18.2C22.2 19.2 23.9 19.5 23.9 19.5C23.9 19.5 22.2 19.8 21.2 20.8C20.2 21.8 20 23.5 20 23.5C20 23.5 19.8 21.8 18.8 20.8C17.8 19.8 16.1 19.5 16.1 19.5C16.1 19.5 17.8 19.2 18.8 18.2C19.8 17.2 20 15.5 20 15.5Z"
            fill="#ffffff"
            filter="url(#glow)"
          />
        </svg>

        {/* Decorative background ambient glow */}
        <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-75 transition-opacity duration-500 pointer-events-none" />
      </div>

      {showText && (
        <span className={`${textClass} font-sans font-bold tracking-tight text-slate-900`}>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 font-extrabold pr-0.5">
            AI
          </span>{" "}
          <span className="text-slate-800 font-semibold tracking-wide">
            Studio
          </span>
        </span>
      )}
    </div>
  );
}
