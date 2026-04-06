"use client";

import React, { useRef, useEffect, useState, forwardRef } from "react";
import { TimelineScrubbar } from "./timeline-scrubbar";

export interface VideoComment {
  id: string;
  content: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  timecodeSeconds: number | null;
  isInternal: boolean;
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoPlayerProps {
  src: string;
  mediaType: "POST_MEDIA" | "TASK_FILE";
  mediaId: string;
  comments?: VideoComment[];
  onCommentCreate?: (timecodeSeconds: number) => void;
  onSeek?: (timecodeSeconds: number) => void;
  readOnly?: boolean;
  className?: string;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  function VideoPlayerImpl(
    {
      src,
      mediaType,
      mediaId,
      comments = [],
      onCommentCreate,
      onSeek,
      readOnly = false,
      className = "",
    },
    ref: React.ForwardedRef<HTMLVideoElement>
  ) {
    const internalRef = useRef<HTMLVideoElement>(null);
    const videoRef = (ref as any) || internalRef;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Extract unique timestamps from comments
  const timestamps = Array.from(
    new Set(
      comments
        .filter((c) => c.timecodeSeconds !== null && c.timecodeSeconds !== undefined)
        .map((c) => c.timecodeSeconds!)
    )
  ).sort((a, b) => a - b);

  // Update currentTime as video plays
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Handle metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Handle play/pause
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  // Seek to timestamp
  const seekToComment = (secondsInto: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = secondsInto;
      setCurrentTime(secondsInto);
      onSeek?.(secondsInto);
    }
  };

  // Capture timecode when comment created (called from parent)
  const captureCurrentTime = () => {
    if (videoRef.current) {
      onCommentCreate?.(videoRef.current.currentTime);
    }
  };

  // Expose method to parent via ref-like pattern
  useEffect(() => {
    if (videoRef.current) {
      (videoRef.current as any).__captureTime = captureCurrentTime;
    }
  }, [captureCurrentTime]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Video element */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          controls
          className="w-full aspect-video object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          controlsList="nodownload"
        />
      </div>

      {/* Timeline with markers */}
      {duration > 0 && (
        <TimelineScrubbar
          duration={duration}
          currentTime={currentTime}
          markers={timestamps}
          onMarkerClick={seekToComment}
          readOnly={readOnly}
        />
      )}

      {/* Debug info (can be removed later) */}
      {!readOnly && (
        <div className="text-xs text-muted-foreground">
          {comments.length > 0 && `${comments.length} comentarios en esta publicación`}
          {timestamps.length > 0 && ` • ${timestamps.length} marcadores en la línea de tiempo`}
        </div>
      )}
    </div>
  );
  }
);
