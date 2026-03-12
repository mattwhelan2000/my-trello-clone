"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";

interface MiniAudioPlayerProps {
    url: string;
    title?: string | null;
}

function toStreamableUrl(url: string): string {
    if (url.includes("dropbox.com")) {
        return url.replace(/([?&])dl=0/, "$1dl=1").replace(/[?&]e=\d+/, "");
    }
    return url;
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Compact audio player designed to sit inside a card tile.
 * All pointer events call stopPropagation so they don't trigger
 * the drag-and-drop listeners or the double-click modal open.
 */
export const MiniAudioPlayer = ({ url, title }: MiniAudioPlayerProps) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const streamUrl = toStreamableUrl(url);
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onTimeUpdate = () => { if (!isDragging) setCurrentTime(audio.currentTime); };
        const onDuration = () => setDuration(audio.duration);
        const onEnded = () => setIsPlaying(false);
        const onError = () => setLoadError(true);

        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("durationchange", onDuration);
        audio.addEventListener("loadedmetadata", onDuration);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("error", onError);
        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("durationchange", onDuration);
            audio.removeEventListener("loadedmetadata", onDuration);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("error", onError);
        };
    }, [isDragging]);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().then(() => setIsPlaying(true)).catch(() => setLoadError(true));
        }
    };

    const seekFromEvent = useCallback((clientX: number) => {
        const bar = timelineRef.current;
        const audio = audioRef.current;
        if (!bar || !audio || !duration) return;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newTime = ratio * duration;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    const onTimelineMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(true);
        seekFromEvent(e.clientX);
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent) => seekFromEvent(e.clientX);
        const onUp = (e: MouseEvent) => { seekFromEvent(e.clientX); setIsDragging(false); };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isDragging, seekFromEvent]);

    return (
        <div
            className="w-full mt-1.5 rounded-lg overflow-hidden bg-gradient-to-r from-[#1a0533] to-[#0f172a] border border-purple-900/40 shadow-md"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <audio ref={audioRef} src={streamUrl} preload="metadata" />

            <div className="flex items-center gap-x-2 px-2.5 py-2">
                {/* Play/Pause */}
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={togglePlay}
                    disabled={loadError}
                    className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shadow-md shadow-purple-900/50"
                    title={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying
                        ? <Pause className="h-3 w-3 text-white fill-white" />
                        : <Play className="h-3 w-3 text-white fill-white ml-0.5" />
                    }
                </button>

                {/* Timeline + time */}
                <div className="flex-1 flex flex-col gap-y-1 min-w-0">
                    {/* Track title */}
                    {title && (
                        <p className="text-[10px] text-purple-200/70 truncate leading-none">{title}</p>
                    )}

                    {/* Scrub bar */}
                    <div
                        ref={timelineRef}
                        onMouseDown={onTimelineMouseDown}
                        className="relative w-full h-1.5 rounded-full bg-white/10 cursor-pointer group select-none"
                    >
                        <div
                            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                            style={{ width: `${progress}%`, transition: isDragging ? "none" : "width 0.075s linear" }}
                        />
                        <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border border-purple-300 shadow opacity-0 group-hover:opacity-100"
                            style={{ left: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Time display */}
                <span className="flex-shrink-0 text-[10px] tabular-nums text-purple-300/70 select-none">
                    {formatTime(currentTime)}<span className="opacity-50">/{formatTime(duration)}</span>
                </span>
            </div>

            {/* Mini waveform when playing */}
            {isPlaying && (
                <div className="flex items-end justify-center gap-x-px px-2.5 pb-1.5 h-3">
                    {[...Array(16)].map((_, i) => (
                        <div
                            key={i}
                            className="w-px rounded-full bg-purple-400/60"
                            style={{
                                height: `${40 + Math.sin(i * 0.9) * 50}%`,
                                animation: `miniWave ${0.5 + (i % 4) * 0.1}s ease-in-out infinite alternate`,
                                animationDelay: `${i * 0.05}s`,
                            }}
                        />
                    ))}
                </div>
            )}
            <style>{`
                @keyframes miniWave {
                    from { transform: scaleY(0.3); opacity: 0.4; }
                    to   { transform: scaleY(1);   opacity: 1;   }
                }
            `}</style>
        </div>
    );
};
