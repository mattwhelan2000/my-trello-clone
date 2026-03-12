"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Music } from "lucide-react";

interface AudioPlayerProps {
    url: string;
    title?: string | null;
    onDelete?: () => void;
}

/** Convert Dropbox share links to direct-download (streaming) URLs */
function toStreamableUrl(url: string): string {
    if (url.includes("dropbox.com")) {
        return url
            .replace(/[?&]dl=0/, (m) => m.replace("dl=0", "dl=1"))
            .replace(/[?&]e=\d+/, ""); // strip ?e= param that sometimes blocks
    }
    return url;
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Extract a display-friendly filename from a URL */
function extractFilename(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const name = decodeURIComponent(pathname.split("/").pop() || "");
        // Strip common query-style cruft after the extension
        return name.replace(/\.(mp3|wav|flac|aac|m4a|ogg|wma).*$/i, ".$1").trim() || "Audio";
    } catch {
        return "Audio";
    }
}

export const AudioPlayer = ({ url, title, onDelete }: AudioPlayerProps) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const streamUrl = toStreamableUrl(url);
    const displayTitle = title || extractFilename(url);
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Sync audio events
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onTimeUpdate = () => { if (!isDragging) setCurrentTime(audio.currentTime); };
        const onDurationChange = () => setDuration(audio.duration);
        const onEnded = () => setIsPlaying(false);
        const onError = () => { setLoadError(true); setIsLoading(false); };
        const onCanPlay = () => setIsLoading(false);

        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("durationchange", onDurationChange);
        audio.addEventListener("loadedmetadata", onDurationChange);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("error", onError);
        audio.addEventListener("canplay", onCanPlay);

        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("durationchange", onDurationChange);
            audio.removeEventListener("loadedmetadata", onDurationChange);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("error", onError);
            audio.removeEventListener("canplay", onCanPlay);
        };
    }, [isDragging]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().then(() => setIsPlaying(true)).catch(() => setLoadError(true));
        }
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const onVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (audioRef.current) {
            audioRef.current.volume = v;
            setIsMuted(v === 0);
        }
    };

    /** Seek based on pointer X position within the timeline bar */
    const seekFromEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
        const bar = timelineRef.current;
        const audio = audioRef.current;
        if (!bar || !audio || !duration) return;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newTime = ratio * duration;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    const onTimelineMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        seekFromEvent(e);
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent) => seekFromEvent(e);
        const onUp = (e: MouseEvent) => { seekFromEvent(e); setIsDragging(false); };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isDragging, seekFromEvent]);

    return (
        <div className="w-full rounded-xl overflow-hidden border border-purple-900/30 bg-gradient-to-br from-[#1a0533] to-[#0f172a] shadow-xl">
            {/* Hidden audio element */}
            <audio ref={audioRef} src={streamUrl} preload="metadata" />

            {/* Top row: icon + title */}
            <div className="flex items-center gap-x-3 px-4 pt-4 pb-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-600/30 border border-purple-500/30 flex items-center justify-center">
                    <Music className="h-5 w-5 text-purple-300" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{displayTitle}</p>
                    <p className="text-[11px] text-purple-300/70 mt-0.5">
                        {loadError ? "⚠ Could not load audio" : isLoading ? "Loading…" : "Audio track"}
                    </p>
                </div>
            </div>

            {/* Timeline */}
            <div className="px-4 pb-1">
                <div
                    ref={timelineRef}
                    onMouseDown={onTimelineMouseDown}
                    className="relative w-full h-2 rounded-full bg-white/10 cursor-pointer group select-none"
                    title="Click or drag to seek"
                >
                    {/* Filled track */}
                    <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-[width] duration-75"
                        style={{ width: `${progress}%` }}
                    />
                    {/* Playhead dot */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-purple-500/50 border border-purple-300 transition-[left] duration-75 opacity-0 group-hover:opacity-100"
                        style={{ left: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-x-3 px-4 pb-4 pt-2">
                {/* Play / Pause */}
                <button
                    onClick={togglePlay}
                    disabled={loadError}
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shadow-lg shadow-purple-700/40"
                    title={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying
                        ? <Pause className="h-4 w-4 text-white fill-white" />
                        : <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                    }
                </button>

                {/* Time */}
                <span className="text-xs tabular-nums text-purple-200/80 select-none min-w-[72px]">
                    {formatTime(currentTime)}
                    <span className="text-purple-400/60"> / </span>
                    {formatTime(duration)}
                </span>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Volume */}
                <button
                    onClick={toggleMute}
                    className="text-purple-300/70 hover:text-purple-200 transition"
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted || volume === 0
                        ? <VolumeX className="h-4 w-4" />
                        : <Volume2 className="h-4 w-4" />
                    }
                </button>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={isMuted ? 0 : volume}
                    onChange={onVolumeChange}
                    className="w-20 h-1.5 accent-purple-400 cursor-pointer"
                    title="Volume"
                />
            </div>

            {/* Animated waveform bars when playing */}
            {isPlaying && (
                <div className="flex items-end justify-center gap-x-0.5 px-4 pb-3 h-5">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="w-1 rounded-full bg-purple-400/50"
                            style={{
                                height: `${30 + Math.sin(i * 0.8) * 50}%`,
                                animation: `audioWave ${0.6 + (i % 5) * 0.1}s ease-in-out infinite alternate`,
                                animationDelay: `${i * 0.04}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Waveform animation keyframes (injected inline) */}
            <style>{`
                @keyframes audioWave {
                    from { transform: scaleY(0.4); opacity: 0.5; }
                    to   { transform: scaleY(1);   opacity: 1;   }
                }
            `}</style>
        </div>
    );
};
