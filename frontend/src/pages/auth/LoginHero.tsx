import { useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Lock, ShieldCheck } from "lucide-react";

type P = [number, number];
const bez = (a: P, b: P, c: P, d: P, t: number): P => { const u = 1 - t; return [u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0], u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]]; };
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

// wealth curve: two smooth cubic segments (second reflects the first's last control point)
const P0: P = [110, 610], C1: P = [270, 600], C2: P = [370, 530], P3: P = [490, 450], C3: P = [610, 370], C4: P = [740, 270], P5: P = [890, 140];
const CURVE = `M${P0} C${C1} ${C2} ${P3} S${C4} ${P5}`;
const MILESTONES: { at: P; label: string; year: string; frac: number; below?: boolean; dx?: number }[] = [
  { at: bez(P0, C1, C2, P3, 0.5), label: "Emergency fund", year: "Year 1", frac: 0.22 },
  { at: bez(P3, C3, C4, P5, 0.3), label: "Dream home", year: "2035", frac: 0.5, dx: -128 },
  { at: bez(P3, C3, C4, P5, 0.68), label: "Child's education", year: "2036", frac: 0.72, below: true, dx: 14 },
  { at: P5, label: "Retirement", year: "2048", frac: 0.97, dx: -128 },
];

function useCountUp(target: number, ms = 2400, delay = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0; const t0 = performance.now() + delay;
    const tick = (t: number) => { const p = Math.min(1, Math.max(0, (t - t0) / ms)); setV(target * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

const WORDS = ["child's education", "dream home", "peaceful retirement", "every milestone"];

export default function LoginHero({ compact = false }: { compact?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const [w, setW] = useState(0); const nw = useCountUp(1.84);
  useEffect(() => { if (reduce || compact) return; const i = setInterval(() => setW((x) => (x + 1) % WORDS.length), 2600); return () => clearInterval(i); }, [reduce, compact]);
  useEffect(() => {
    if (reduce || compact) return; const el = root.current; if (!el) return;
    const mv = (e: MouseEvent) => { const r = el.getBoundingClientRect(); el.style.setProperty("--mx", String(((e.clientX - r.left) / r.width - 0.5).toFixed(3))); el.style.setProperty("--my", String(((e.clientY - r.top) / r.height - 0.5).toFixed(3))); };
    window.addEventListener("mousemove", mv); return () => window.removeEventListener("mousemove", mv);
  }, [reduce, compact]);

  const scene = useMemo(() => {
    const r = rng(7);
    const stars = Array.from({ length: 70 }, () => ({ x: r() * 1000, y: r() * 420, s: 0.6 + r() * 1.4, d: r() * 4 }));
    const coins = Array.from({ length: 9 }, (_, i) => ({ x: 60 + i * 100 + r() * 30, y: 880, t: ["₹", "$", "AED", "₹", "$", "₹", "£", "$", "₹"][i], d: i * 1.3, dur: 9 + r() * 5 }));
    const build = (x0: number, n: number, seed: number, tall: number) => { const q = rng(seed); let x = x0; return Array.from({ length: n }, () => { const w = 22 + q() * 26, h = 28 + q() * tall; const b = { x, w, h }; x += w + 3 + q() * 4; return b; }); };
    return { stars, coins, dubai: build(20, 8, 3, 70), blr: build(700, 7, 5, 62) };
  }, []);
  const lit = (i: number, j: number) => (i * 7 + j * 3) % 5 === 0;
  const fmt = (v: number) => `₹${v.toFixed(2)} Cr`;

  return (
    <div ref={root} className="mw-anim absolute inset-0 overflow-hidden bg-[#08122a]" style={{ ["--mx" as any]: 0, ["--my" as any]: 0 }}>
      {/* optional photograph: drop frontend/public/login-hero.jpg to blend a real photo into the scene */}
      <div className="absolute inset-0 opacity-30 mix-blend-luminosity" style={{ backgroundImage: 'url("/login-hero.jpg")', backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="mw-aurora absolute -left-24 -top-24 h-[55%] w-[60%] rounded-full bg-[#C7A45B]/25 blur-3xl" />
      <div className="mw-aurora absolute -right-16 top-1/3 h-[50%] w-[45%] rounded-full bg-[#4B6FD1]/25 blur-3xl" style={{ animationDelay: "-6s" }} />

      <svg viewBox="0 0 1000 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#060d22" /><stop offset=".55" stopColor="#0f2250" /><stop offset=".86" stopColor="#7a5a2c" /><stop offset="1" stopColor="#C7A45B" /></linearGradient>
          <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFE7A8" stopOpacity=".95" /><stop offset=".35" stopColor="#E9C46F" stopOpacity=".45" /><stop offset="1" stopColor="#C7A45B" stopOpacity="0" /></radialGradient>
          <linearGradient id="curve" x1="0" x2="1"><stop offset="0" stopColor="#F0B38A" /><stop offset=".5" stopColor="#E9C46F" /><stop offset="1" stopColor="#9CE08A" /></linearGradient>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E9C46F" stopOpacity=".38" /><stop offset="1" stopColor="#E9C46F" stopOpacity="0" /></linearGradient>
          <linearGradient id="fx" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".2" stopColor="#fff" /><stop offset=".78" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <mask id="fadeX" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="900"><rect x="110" width="780" height="900" fill="url(#fx)" /></mask>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width="1000" height="900" fill="url(#sky)" />
        <g>{scene.stars.map((s, i) => <circle key={i} className="mw-tw" cx={s.x} cy={s.y} r={s.s} fill="#fff" style={{ animationDelay: `${s.d}s`, animationDuration: `${2.5 + (i % 4)}s` }} />)}</g>
        <circle className="mw-sun" cx="760" cy="610" r="190" fill="url(#sun)" />

        {/* far hills */}
        <g className="mw-layer" style={{ transform: "translate(calc(var(--mx) * -14px), calc(var(--my) * -6px))" }}>
          <path d="M-40 760 C 140 690 250 740 390 700 S 650 650 800 715 S 980 700 1040 730 V 920 H-40Z" fill="#0b1a3d" opacity=".9" />
        </g>
        {/* skylines: Dubai (left) and Bengaluru (right) */}
        <g className="mw-layer" style={{ transform: "translate(calc(var(--mx) * -26px), calc(var(--my) * -10px))" }}>
          {scene.dubai.map((b, i) => (<g key={"d" + i}><rect x={b.x} y={810 - b.h} width={b.w} height={b.h + 40} fill="#0a1636" />{Array.from({ length: Math.floor(b.h / 12) }, (_, j) => lit(i, j) && <rect key={j} className="mw-tw" x={b.x + 5 + ((j * 7) % Math.max(4, b.w - 12))} y={810 - b.h + 6 + j * 12} width="3" height="4" fill="#FFD98A" style={{ animationDelay: `${(i + j) % 5}s` }} />)}</g>))}
          <path d="M170 810 V 600 L 174 560 L 178 600 V 810Z" fill="#0a1636" /><path d="M161 810 V 690 L 174 540 L 187 690 V 810Z" fill="#0d1d44" />
          {scene.blr.map((b, i) => (<g key={"b" + i}><rect x={b.x} y={812 - b.h} width={b.w} height={b.h + 40} fill="#0a1636" />{Array.from({ length: Math.floor(b.h / 12) }, (_, j) => lit(i + 2, j) && <rect key={j} className="mw-tw" x={b.x + 5 + ((j * 5) % Math.max(4, b.w - 12))} y={812 - b.h + 6 + j * 12} width="3" height="4" fill="#FFD98A" style={{ animationDelay: `${(i * 2 + j) % 5}s` }} />)}</g>))}
          <path d="M740 812 V 748 H 810 V 812Z" fill="#0d1d44" /><path d="M749 748 C 749 716 801 716 801 748Z" fill="#0d1d44" /><rect x="774" y="700" width="2" height="18" fill="#0d1d44" />
        </g>
        {/* near hills */}
        <g className="mw-layer" style={{ transform: "translate(calc(var(--mx) * -40px), calc(var(--my) * -14px))" }}>
          <path d="M-40 830 C 180 790 350 850 530 820 S 830 790 1040 840 V 920 H-40Z" fill="#050c22" />
        </g>

        {/* remittance arc: Dubai -> Bengaluru */}
        <g className="mw-layer" style={{ transform: "translate(calc(var(--mx) * -20px), calc(var(--my) * -8px))" }}>
          <path id="arc" d="M174 552 Q 470 380 775 698" fill="none" stroke="#F4E2B0" strokeOpacity=".55" strokeWidth="1.6" className="mw-flow" />
          {!reduce && <circle r="5" fill="#FFE7A8" filter="url(#glow)"><animateMotion dur="5.5s" repeatCount="indefinite" path="M174 552 Q 470 380 775 698" /></circle>}
          <g fontSize="13" fill="#F4E2B0" fontFamily="Inter, sans-serif"><text x="100" y="530">Abroad · AED / USD</text><text x="690" y="690">India · ₹</text></g>
        </g>

        {/* wealth curve + milestones */}
        <g className="mw-layer" style={{ transform: "translate(calc(var(--mx) * -8px), calc(var(--my) * -4px))" }}>
          <path className="mw-area" mask="url(#fadeX)" d={`${CURVE} V 900 H 110Z`} fill="url(#area)" />
          <path className="mw-draw" d={CURVE} pathLength={1} fill="none" stroke="url(#curve)" strokeWidth="4.5" strokeLinecap="round" filter="url(#glow)" />
          {MILESTONES.map((m, i) => { const delay = 0.5 + 3.6 * m.frac; return (
            <g key={i}>
              <circle className="mw-ring" cx={m.at[0]} cy={m.at[1]} r="7" fill="none" stroke="#FFE7A8" strokeWidth="1.5" style={{ animationDelay: `${delay + 0.6}s` }} />
              <g className="mw-pop" style={{ animationDelay: `${delay}s` }}>
                <circle cx={m.at[0]} cy={m.at[1]} r="8" fill="#fff" stroke="#E9C46F" strokeWidth="3" />
                <g transform={`translate(${m.at[0] + (m.dx ?? -62)}, ${m.at[1] + (m.below ? 20 : -56)})`}>
                  <rect width="124" height="38" rx="12" fill="#ffffff" fillOpacity=".14" stroke="#ffffff" strokeOpacity=".3" />
                  <text x="62" y="16" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff" fontFamily="Inter, sans-serif">{m.label}</text>
                  <text x="62" y="30" textAnchor="middle" fontSize="10.5" fill="#F4E2B0" fontFamily="Inter, sans-serif">{m.year}</text>
                </g>
              </g>
            </g>); })}
        </g>
        {/* rising currency symbols */}
        <g fill="#F4E2B0" fontFamily="Fraunces, serif" opacity=".7">{scene.coins.map((c, i) => <text key={i} className="mw-coin" x={c.x} y={c.y} fontSize={i % 3 === 0 ? 26 : 18} style={{ animationDelay: `${c.d}s`, animationDuration: `${c.dur}s` }}>{c.t}</text>)}</g>
      </svg>

      {!compact && (<>
        <div className="absolute inset-x-0 top-0 p-10 xl:p-14 text-white pointer-events-none">
          <div className="mw-rise" style={{ animationDelay: ".1s" }}><div className="font-serif text-3xl leading-none">MetaWealth</div><div className="text-[11px] tracking-[0.34em] text-[#E9C46F] mt-2">CAPITAL</div></div>
          <h1 className="font-serif text-[2.6rem] xl:text-5xl leading-[1.1] mt-12 max-w-2xl min-h-[2.2em] mw-rise" style={{ animationDelay: ".35s" }}>One plan for<br />your <span key={w} className="inline-block text-[#E9C46F] mw-rise" style={{ animationDelay: "0s", animationDuration: ".6s" }}>{WORDS[w]}</span>.</h1>
          <p className="mt-4 max-w-sm text-white/70 text-[15px] mw-rise" style={{ animationDelay: ".6s" }}>Wherever you earn, in rupees or dirhams or dollars, your advisor plans it as one.</p>
        </div>
        {/* illustrative live card */}
        <div className="hidden xl:block absolute right-[4%] top-[47%] w-64 mw-layer" style={{ transform: "translate(calc(var(--mx) * 18px), calc(var(--my) * 12px))" }}>
          <div className="mw-rise rounded-3xl border border-white/25 bg-white/10 backdrop-blur-xl p-5 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,.6)]" style={{ animationDelay: "1.2s" }}>
            <div className="flex items-center justify-between text-[10px] tracking-widest text-white/60"><span>SAMPLE PLAN</span><span className="rounded-full bg-white/15 px-2 py-0.5 normal-case tracking-normal">Illustrative</span></div>
            <div className="mt-3 text-[11px] text-white/60">Net worth</div><div className="text-3xl font-semibold tabular-nums">{fmt(nw)}</div>
            <svg viewBox="0 0 200 44" className="w-full mt-2"><path d="M0 40 C 30 38 50 30 80 26 S 130 18 200 4" fill="none" stroke="#9CE08A" strokeWidth="2.5" strokeLinecap="round" pathLength={1} className="mw-draw" style={{ animationDelay: "1.6s" }} /></svg>
            <div className="mt-3 flex items-center justify-between text-xs"><span className="text-white/70">Goals on track</span><b>12 / 14</b></div>
            <div className="mt-2 flex flex-wrap gap-1">{Array.from({ length: 14 }, (_, i) => <i key={i} className="h-2.5 w-2.5 rounded-[4px]" style={{ background: i < 12 ? "#9CE08A" : i === 12 ? "#E9C46F" : "#F0B38A" }} />)}</div>
          </div>
        </div>
        <div className="absolute left-0 bottom-0 p-10 xl:p-14 flex flex-wrap gap-3 text-xs text-white/85">
          {[[ShieldCheck, "Advisor-reviewed plans"], [Globe2, "INR · USD · AED"], [Lock, "Protected sign-in"]].map(([I, t]: any, i) => <span key={t} className="mw-rise inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-3.5 py-2" style={{ animationDelay: `${1.6 + i * 0.15}s` }}><I size={14} className="text-[#E9C46F]" />{t}</span>)}
        </div>
      </>)}
    </div>
  );
}
