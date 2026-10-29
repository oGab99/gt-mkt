"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { formatTimestamp } from "@/lib/portal/rules";

export type VideoPlayerHandle = { seek: (ms: number) => void; pause: () => void; currentMs: () => number };

/**
 * Player responsivo com controles próprios: reproduzir/pausar, volume, tela
 * cheia, linha do tempo com marcações dos comentários e rótulo da versão.
 */
export const VideoPlayer = forwardRef<VideoPlayerHandle, {
  src: string;
  label: string;
  markers?: { id: string; ms: number; text: string }[];
  onMarkerClick?: (id: string) => void;
  onTime?: (ms: number) => void;
}>(function VideoPlayer({ src, label, markers = [], onMarkerClick, onTime }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [error, setError] = useState(false);

  useImperativeHandle(ref, () => ({
    seek: (ms) => {
      const v = video.current;
      if (!v) return;
      v.currentTime = ms / 1000;
      v.pause();
    },
    pause: () => video.current?.pause(),
    currentMs: () => Math.round((video.current?.currentTime ?? 0) * 1000),
  }));

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, []);

  const toggleFull = () => {
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (box.current?.requestFullscreen) void box.current.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    else v?.webkitEnterFullscreen?.(); // Safari no iPhone
  };

  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div
      ref={box}
      className={`group relative overflow-hidden bg-[#0d0d0d] ${full ? "flex h-full w-full items-center" : "rounded-2xl"}`}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement) return;
        if (e.key === " " || e.key === "k") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <video
        ref={video}
        src={src}
        playsInline
        preload="metadata"
        className={`mx-auto block w-full bg-black object-contain ${full ? "h-full" : "max-h-[72dvh]"}`}
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime);
          onTime?.(Math.round(e.currentTarget.currentTime * 1000));
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onError={() => setError(true)}
      />
      {error ? <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-[14px] text-white/80">Não foi possível carregar o vídeo. Verifique sua conexão e recarregue a página.</p> : null}
      {!playing && !error ? (
        <button type="button" onClick={toggle} className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-fg shadow-lg transition-transform hover:scale-105" aria-label="Reproduzir">
          <Play className="ml-1 size-7" fill="currentColor" />
        </button>
      ) : null}
      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur">{label}</span>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pt-10 pb-2.5 sm:px-4">
        <div className="relative h-5">
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/25" aria-hidden>
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          {duration
            ? markers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  title={`${formatTimestamp(m.ms)} — ${m.text}`}
                  aria-label={`Comentário em ${formatTimestamp(m.ms)}`}
                  onClick={() => {
                    if (video.current) {
                      video.current.currentTime = m.ms / 1000;
                      video.current.pause();
                    }
                    onMarkerClick?.(m.id);
                  }}
                  className="absolute top-1/2 z-[2] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#E9B949]"
                  style={{ left: `${Math.min(100, (m.ms / 1000 / duration) * 100)}%` }}
                />
              ))
            : null}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.05}
            value={time}
            onChange={(e) => {
              if (video.current) video.current.currentTime = Number(e.target.value);
            }}
            aria-label="Linha do tempo"
            aria-valuetext={`${formatTimestamp(time * 1000)} de ${formatTimestamp(duration * 1000)}`}
            className="absolute inset-0 z-[1] h-5 w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="mt-1 flex items-center gap-1 text-white">
          <button type="button" onClick={toggle} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10" aria-label={playing ? "Pausar" : "Reproduzir"}>
            {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!video.current) return;
              video.current.muted = !video.current.muted;
            }}
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10"
            aria-label={muted || volume === 0 ? "Ativar som" : "Silenciar"}
          >
            {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              if (!video.current) return;
              video.current.volume = Number(e.target.value);
              video.current.muted = Number(e.target.value) === 0;
            }}
            aria-label="Volume"
            className="hidden w-20 accent-white sm:block"
          />
          <span className="ml-2 text-[12.5px] tabular-nums text-white/85">
            {formatTimestamp(time * 1000)} / {formatTimestamp(duration * 1000)}
          </span>
          <button type="button" onClick={toggleFull} className="ml-auto inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10" aria-label={full ? "Sair da tela cheia" : "Tela cheia"}>
            {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
        </div>
      </div>
    </div>
  );
});
