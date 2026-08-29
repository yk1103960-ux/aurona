import { useEffect, useRef, useState } from "react";
import logoAsset from "@/assets/aurona-logo-2026.png.asset.json";

/**
 * Cinematic 5-phase intro. Plays once per session.
 * Phase 1 (0-1s): Darkness + single breathing particle
 * Phase 2 (1-2s): Energy awakens (plasma, orbit, arcs)
 * Phase 3 (2-4s): Explosion (thousands of particles, nebula)
 * Phase 4 (4-6s): Brand reveal (particles form logo)
 * Phase 5 (6-7s): Portal transition (shockwave, fly-through)
 */
export function CinematicIntro() {
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Skip the heavy canvas intro on phones / low-power devices and when the
    // visitor prefers reduced motion — it made first load feel sluggish.
    const heavyOk =
      window.innerWidth >= 1024 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      (navigator.hardwareConcurrency ?? 8) >= 4;
    if (!heavyOk) {
      try { sessionStorage.setItem("aurona_intro_played", "1"); } catch { /* ignore */ }
      return;
    }
    try {
      setShow(!sessionStorage.getItem("aurona_intro_played"));
    } catch {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    // Preload logo image and sample its pixels for particle target positions
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logoAsset.url;
    logoRef.current = img;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true })!;

    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 3);
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Logo target sampling (populated once image loads)
    let targets: { x: number; y: number }[] = [];
    const sampleLogo = () => {
      if (!img.complete || img.naturalWidth === 0) return;
      const off = document.createElement("canvas");
      const maxW = Math.min(W * 0.55, 640);
      const scale = maxW / img.naturalWidth;
      off.width = img.naturalWidth * scale;
      off.height = img.naturalHeight * scale;
      const octx = off.getContext("2d")!;
      octx.drawImage(img, 0, 0, off.width, off.height);
      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const step = 4; // sample density
      const pts: { x: number; y: number }[] = [];
      const cx = W / 2 - off.width / 2;
      const cy = H / 2 - off.height / 2;
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          const i = (y * off.width + x) * 4;
          const a = data[i + 3];
          const r = data[i], g = data[i + 1], b = data[i + 2];
          // pick opaque, non-white pixels (logo strokes)
          const lum = (r + g + b) / 3;
          if (a > 140 && lum < 210) {
            pts.push({ x: cx + x, y: cy + y });
          }
        }
      }
      targets = pts;
    };
    img.onload = sampleLogo;
    if (img.complete) sampleLogo();

    // Particles
    type P = {
      x: number; y: number; vx: number; vy: number;
      tx: number; ty: number;
      size: number; hue: number; life: number; born: number;
    };
    const NUM = Math.min(900, Math.floor((W * H) / 2200));
    const particles: P[] = [];
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < NUM; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 6;
      particles.push({
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        vx: 0, vy: 0,
        tx: cx, ty: cy,
        size: Math.random() * 1.6 + 0.4,
        hue: 200 + Math.random() * 30,
        life: 1,
        born: Math.random(),
      });
    }

    // Nebula clouds
    const clouds = Array.from({ length: 6 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 200 + Math.random() * 260,
      hue: 205 + Math.random() * 25,
      drift: Math.random() * 0.3 + 0.05,
      phase: Math.random() * Math.PI * 2,
    }));

    const DURATION = 7000;
    const start = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const t = (now - start) / DURATION; // 0..1
      const T = Math.min(t, 1);

      // Phase timings
      const p1 = Math.min(1, T / (1 / 7));           // 0-1s
      const p2 = Math.min(1, Math.max(0, (T - 1 / 7) / (1 / 7)));
      const p3 = Math.min(1, Math.max(0, (T - 2 / 7) / (2 / 7)));
      const p4 = Math.min(1, Math.max(0, (T - 4 / 7) / (2 / 7)));
      const p5 = Math.min(1, Math.max(0, (T - 6 / 7) / (1 / 7)));

      // Background - deep void → subtle blue haze in later phases
      const bgAlpha = 0.35 + p5 * 0.35;
      ctx.fillStyle = `rgba(2,6,18,${bgAlpha})`;
      ctx.fillRect(0, 0, W, H);

      // Nebula clouds (fade in during phase 3)
      if (p3 > 0) {
        ctx.globalCompositeOperation = "screen";
        for (const c of clouds) {
          c.phase += 0.003;
          const cxN = c.x + Math.cos(c.phase) * 20;
          const cyN = c.y + Math.sin(c.phase) * 20;
          const grad = ctx.createRadialGradient(cxN, cyN, 0, cxN, cyN, c.r);
          const a = 0.18 * p3 * (1 - p5 * 0.5);
          grad.addColorStop(0, `hsla(${c.hue},90%,60%,${a})`);
          grad.addColorStop(1, `hsla(${c.hue},90%,50%,0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(cxN - c.r, cyN - c.r, c.r * 2, c.r * 2);
        }
        ctx.globalCompositeOperation = "source-over";
      }

      // Core glow (phases 1-3)
      if (p1 > 0 && p4 < 0.5) {
        const coreT = Math.sin(now / 300) * 0.5 + 0.5;
        const coreR = 8 + p1 * 40 + p2 * 80 + coreT * 12 + p3 * 60;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
        grad.addColorStop(0, `rgba(180,220,255,${0.9 * (1 - p4)})`);
        grad.addColorStop(0.2, `rgba(80,160,255,${0.6 * (1 - p4)})`);
        grad.addColorStop(1, "rgba(10,40,120,0)");
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = grad;
        ctx.fillRect(cx - coreR * 3, cy - coreR * 3, coreR * 6, coreR * 6);
        ctx.globalCompositeOperation = "source-over";
      }

      // Lightning arcs (phase 2)
      if (p2 > 0 && p3 < 0.6) {
        const arcs = 3;
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < arcs; i++) {
          ctx.beginPath();
          const angle = (now / 200 + i * 2.1) % (Math.PI * 2);
          const r0 = 15 + p2 * 30;
          const r1 = 40 + p2 * 90 + p3 * 200;
          ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
          const segs = 8;
          for (let s = 1; s <= segs; s++) {
            const f = s / segs;
            const ang = angle + (Math.random() - 0.5) * 0.6;
            const rr = r0 + (r1 - r0) * f + (Math.random() - 0.5) * 20;
            ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
          }
          ctx.strokeStyle = `rgba(150,210,255,${0.5 * p2 * (1 - p3 * 0.8)})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      // Update particles based on phase
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (t < 1 / 7) {
          // Phase 1: tight orbit
          const a = (now / 800) + i * 0.02;
          const r = 4 + Math.sin(now / 400 + i) * 2;
          p.x = cx + Math.cos(a) * r;
          p.y = cy + Math.sin(a) * r;
        } else if (t < 2 / 7) {
          // Phase 2: expanding orbit
          const a = (now / 500) + i * 0.05;
          const r = 20 + p2 * 60 + Math.sin(now / 300 + i) * 8;
          p.x = cx + Math.cos(a) * r;
          p.y = cy + Math.sin(a) * r;
        } else if (t < 4 / 7) {
          // Phase 3: explosion — give initial velocity
          if (p.vx === 0 && p.vy === 0) {
            const a = Math.random() * Math.PI * 2;
            const v = 2 + Math.random() * 8;
            p.vx = Math.cos(a) * v;
            p.vy = Math.sin(a) * v;
          }
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.985;
          p.vy *= 0.985;
        } else if (t < 6 / 7) {
          // Phase 4: pull toward logo target
          if (!p.tx || (p.tx === cx && p.ty === cy)) {
            if (targets.length) {
              const tgt = targets[i % targets.length];
              p.tx = tgt.x;
              p.ty = tgt.y;
            }
          }
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          p.vx = p.vx * 0.86 + dx * 0.06;
          p.vy = p.vy * 0.86 + dy * 0.06;
          p.x += p.vx;
          p.y += p.vy;
        } else {
          // Phase 5: portal — accelerate outward from center along their vector
          const dx = p.x - cx;
          const dy = p.y - cy;
          const mag = Math.hypot(dx, dy) || 1;
          const push = 1 + p5 * 12;
          p.x += (dx / mag) * push * 4;
          p.y += (dy / mag) * push * 4;
        }

        const alpha = p4 > 0.3 ? 0.95 : 0.7 + p3 * 0.3;
        const size = p.size * (1 + p2 * 0.5 + p4 * 0.6);
        ctx.fillStyle = `hsla(${p.hue},95%,72%,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();

        // extra glow for larger ones
        if (p.size > 1.3) {
          ctx.fillStyle = `hsla(${p.hue},95%,80%,${alpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";

      // Light rays during phase 3-4
      if (p3 > 0.2 && p5 < 0.6) {
        ctx.globalCompositeOperation = "screen";
        const rayCount = 12;
        const rayAlpha = 0.08 * Math.min(1, p3 * 1.5) * (1 - p5);
        for (let i = 0; i < rayCount; i++) {
          const a = (i / rayCount) * Math.PI * 2 + now / 4000;
          const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * W, cy + Math.sin(a) * W);
          grad.addColorStop(0, `rgba(140,200,255,${rayAlpha})`);
          grad.addColorStop(1, "rgba(140,200,255,0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * W, cy + Math.sin(a) * W);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      // Shockwave (phase 5)
      if (p5 > 0) {
        ctx.globalCompositeOperation = "screen";
        const rings = 3;
        for (let i = 0; i < rings; i++) {
          const rProg = Math.min(1, p5 + i * 0.15);
          const r = rProg * Math.max(W, H);
          const a = (1 - rProg) * 0.6;
          ctx.strokeStyle = `rgba(160,220,255,${a})`;
          ctx.lineWidth = 3 * (1 - rProg) + 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        // white flash
        if (p5 > 0.6) {
          const flash = (p5 - 0.6) / 0.4;
          ctx.fillStyle = `rgba(255,255,255,${flash * 0.9})`;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.globalCompositeOperation = "source-over";
      }

      if (t < 1) {
        raf = requestAnimationFrame(draw);
      } else {
        setFadeOut(true);
        try { sessionStorage.setItem("aurona_intro_played", "1"); } catch {}
        setTimeout(() => setShow(false), 600);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [show]);

  if (!show) return null;

  const skip = () => {
    try { sessionStorage.setItem("aurona_intro_played", "1"); } catch {}
    setFadeOut(true);
    setTimeout(() => setShow(false), 500);
  };

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#02060f",
        pointerEvents: "none",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.6s cubic-bezier(0.65,0.05,0.1,1)",
        overflow: "hidden",
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {/* Logo reveal overlay — appears during phase 4-5 */}
      <img
        src={logoAsset.url}
        alt=""
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(58vw, 640px)",
          maxHeight: "38vh",
          objectFit: "contain",
          imageRendering: "auto",
          backfaceVisibility: "hidden",
          opacity: 0,
          filter: "drop-shadow(0 0 18px rgba(120,190,255,0.45))",
          animation: "aurona-logo-reveal 7s cubic-bezier(0.16,1,0.3,1) forwards",
        }}

      />
      {/* Small skip intro button */}
      <button
        type="button"
        onClick={skip}
        style={{
          position: "absolute",
          bottom: "max(14px, 2vh)",
          right: "max(14px, 2vw)",
          pointerEvents: "auto",
          padding: "6px 12px",
          fontSize: "11px",
          lineHeight: 1,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(180,215,255,0.85)",
          background: "rgba(8,18,36,0.55)",
          border: "1px solid rgba(120,180,255,0.25)",
          borderRadius: "999px",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(18,40,72,0.75)";
          e.currentTarget.style.borderColor = "rgba(140,200,255,0.5)";
          e.currentTarget.style.color = "rgba(220,240,255,1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(8,18,36,0.55)";
          e.currentTarget.style.borderColor = "rgba(120,180,255,0.25)";
          e.currentTarget.style.color = "rgba(180,215,255,0.85)";
        }}
      >
        Skip
      </button>
      <style>{`
        @keyframes aurona-logo-reveal {
          0%, 55% { opacity: 0; transform: translate(-50%, -50%) scale(0.94); filter: drop-shadow(0 0 0px rgba(120,190,255,0)); }
          70% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 34px rgba(120,190,255,0.85)); }
          90% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 44px rgba(180,220,255,0.95)); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.06); filter: drop-shadow(0 0 20px rgba(180,220,255,0.4)); }
        }
      `}</style>
    </div>
  );
}
