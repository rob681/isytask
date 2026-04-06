"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TimelineScrubbarProps {
  duration: number;
  currentTime: number;
  markers: number[]; // Array of timestamps where comments exist
  onMarkerClick?: (secondsInto: number) => void;
  onSeek?: (secondsInto: number) => void;
  readOnly?: boolean;
}

// Format seconds to HH:MM:SS or MM:SS
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function TimelineScrubbar({
  duration,
  currentTime,
  markers,
  onMarkerClick,
  onSeek,
  readOnly = false,
}: TimelineScrubbarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle click on timeline to seek
  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !barRef.current) return;

    const rect = barRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;

    onSeek?.(newTime);
  };

  // Handle mouse move for hover tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;

    const rect = barRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
    const hoverTime = percentage * duration;

    setHoveredTime(hoverTime);
  };

  const handleMouseLeave = () => {
    setHoveredTime(null);
  };

  return (
    <div className="space-y-1.5">
      {/* Timeline bar with markers */}
      <div
        ref={barRef}
        className={cn(
          "relative h-8 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-md overflow-hidden group",
          !readOnly && "cursor-pointer hover:from-slate-300 hover:to-slate-400 dark:hover:from-slate-600 dark:hover:to-slate-700"
        )}
        onClick={handleBarClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Progress bar */}
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-100"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Comment markers (dots) */}
        {markers.length > 0 &&
          markers.map((markerTime) => {
            const markerPercent = (markerTime / duration) * 100;
            return (
              <button
                key={`marker-${markerTime}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkerClick?.(markerTime);
                }}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg transition-all hover:scale-125 focus:outline-none focus:ring-2 focus:ring-offset-1",
                  "bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-500"
                )}
                style={{
                  left: `calc(${markerPercent}% - 10px)`,
                }}
                title={`Comentario en ${formatTime(markerTime)}`}
                type="button"
              >
                <span className="sr-only">Comentario en {formatTime(markerTime)}</span>
              </button>
            );
          })}

        {/* Playhead (current position) */}
        <div
          className="absolute top-0 w-1 h-full bg-white shadow-lg transition-none"
          style={{
            left: `${progressPercent}%`,
            transform: "translateX(-50%)",
          }}
        />

        {/* Hover tooltip */}
        {hoveredTime !== null && (
          <div
            className="absolute bottom-full left-0 mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none"
            style={{
              left: `${(hoveredTime / duration) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            {formatTime(hoveredTime)}
          </div>
        )}
      </div>

      {/* Time display */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
