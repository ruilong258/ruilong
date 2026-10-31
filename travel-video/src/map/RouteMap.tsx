import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH } from "../timeline";
import data from "./mapData.json";

/**
 * 普拉托 → Gradara 大巴路线图（矢量，单位：公里）
 * 镜头：意大利全景 → 推近托斯卡纳/艾米利亚-罗马涅/马尔凯 → 金色路线逐段绘出，小巴点沿路前进
 */

type P = [number, number];
const SERIF = '"Cormorant Garamond", "Noto Serif SC", serif';
const SANS = 'Inter, "Noto Serif SC", sans-serif';
const CN = '"Noto Serif SC", serif';
const IVORY = "#F6F0E6";
const GOLD = "#D8B67C";
const GOLD_HI = "#F1D8A6";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = Easing.bezier(0.65, 0, 0.35, 1);

const route = data.route as unknown as P[];
const cum = data.routeCum as number[];
const total = cum[cum.length - 1];
const city = data.cities as unknown as Record<string, P>;
const pts = data.points as unknown as Record<string, P>;

// 镜头参数
const Z0 = 1.05; // 意大利全景（px/km）
const Z1 = 6.0; // 线路特写
const C0: P = pts.italyCenter;
const C1: P = [-5, -30];
const Y_CENTER = 1010;

// 沿线到某个距离为止的折线 + 末端点
function partial(dist: number): { pts: P[]; head: P } {
  if (dist <= 0) return { pts: [route[0]], head: route[0] };
  const out: P[] = [route[0]];
  for (let i = 1; i < route.length; i++) {
    if (cum[i] <= dist) {
      out.push(route[i]);
      continue;
    }
    const t = (dist - cum[i - 1]) / (cum[i] - cum[i - 1]);
    const head: P = [
      route[i - 1][0] + (route[i][0] - route[i - 1][0]) * t,
      route[i - 1][1] + (route[i][1] - route[i - 1][1]) * t,
    ];
    out.push(head);
    return { pts: out, head };
  }
  return { pts: out, head: route[route.length - 1] };
}

// 某城市在路线上的“到达进度”（最近路线点的累计距离）
function progressAt(p: P) {
  let best = 0;
  let bd = Infinity;
  route.forEach((r, i) => {
    const d = Math.hypot(r[0] - p[0], r[1] - p[1]);
    if (d < bd) {
      bd = d;
      best = cum[i];
    }
  });
  return best / total;
}
const PASS = { Bologna: progressAt(city.Bologna), Rimini: progressAt(city.Rimini) };

export const RouteMap: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();

  // ---------- 镜头 ----------
  const fly = interpolate(f, [10, 64], [0, 1], { ...clamp, easing: inOut });
  const z = Z0 * Math.pow(Z1 / Z0, fly);
  const cx = C0[0] + (C1[0] - C0[0]) * fly;
  const cy = C0[1] + (C1[1] - C0[1]) * fly;
  const drift = interpolate(f, [64, duration], [1, 1.04], clamp); // 结束前轻微推近
  const zz = z * drift;
  const S = ([x, y]: P): P => [WIDTH / 2 + (x - cx) * zz, Y_CENTER + (y - cy) * zz];

  // ---------- 路线 ----------
  const q = interpolate(f, [58, duration - 16], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.3, 1) });
  const part = partial(q * total);
  const line = part.pts.map(S);
  const lineD = line.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const head = S(part.head);
  const arrived = interpolate(q, [0.985, 1], [0, 1], clamp);

  const near = interpolate(fly, [0.75, 1], [0, 1], clamp); // 特写阶段才显示细节
  const overview = interpolate(f, [0, 8, 22, 40], [0.0, 1, 1, 0], clamp);
  const headerIn = interpolate(f, [30, 50], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const footerIn = interpolate(f, [58, 74], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const pulse = (period: number, offset = 0) => ((f + offset) % period) / period;

  const groupT = `translate(${WIDTH / 2} ${Y_CENTER}) scale(${zz}) translate(${-cx} ${-cy})`;
  const hiRegions = new Set(["Toscana", "Emilia-Romagna", "Marche"]);

  const Label: React.FC<{
    at: P;
    dx?: number;
    dy?: number;
    align?: "left" | "center" | "right";
    opacity: number;
    children: React.ReactNode;
  }> = ({ at, dx = 0, dy = 0, align = "center", opacity, children }) => {
    const [x, y] = S(at);
    const tx = align === "center" ? "-50%" : align === "right" ? "-100%" : "0";
    return (
      <div
        style={{
          position: "absolute",
          left: x + dx,
          top: y + dy,
          transform: `translate(${tx}, -50%)`,
          opacity,
          whiteSpace: "nowrap",
          color: IVORY,
          textAlign: align,
          textShadow: "0 1px 8px rgba(0,0,0,0.6)",
        }}
      >
        {children}
      </div>
    );
  };

  const smallCaps = (size: number, spacing = "0.32em"): React.CSSProperties => ({
    fontFamily: SANS,
    fontWeight: 300,
    fontSize: size,
    letterSpacing: spacing,
    textTransform: "uppercase",
  });

  const dot = (name: string, show: number, lit = 0) => {
    const [x, y] = S(city[name]);
    return (
      <g key={name} opacity={show}>
        <circle cx={x} cy={y} r={5 + lit * 2} fill={lit > 0.5 ? GOLD_HI : IVORY} opacity={0.85} />
        {lit > 0 && <circle cx={x} cy={y} r={14 * lit} fill="none" stroke={GOLD} strokeWidth={1.5} opacity={1 - lit * 0.6} />}
      </g>
    );
  };

  const passed = (k: keyof typeof PASS) => interpolate(q, [PASS[k] - 0.02, PASS[k] + 0.04], [0, 1], clamp);
  const [px, py] = S(city.Prato);
  const [gx, gy] = S(city.Gradara);

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 120% 80% at 50% 45%, #13212B 0%, #0B141B 70%, #081016 100%)" }}>
      {/* ---------- 底图 ---------- */}
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="coastGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={GOLD} floodOpacity="0.28" />
          </filter>
          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <g transform={groupT}>
          {data.others.map((c) => (
            <path
              key={c.name}
              d={c.d}
              fill="#152029"
              stroke="rgba(246,240,230,0.07)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <g filter="url(#coastGlow)">
            {data.regions.map((r) => (
              <path
                key={r.name}
                d={r.d}
                fill={hiRegions.has(r.name) ? `rgba(${34 + 12 * near},${48 + 12 * near},${58 + 9 * near},1)` : "#212F39"}
                stroke="rgba(246,240,230,0.16)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <path d={data.sanMarino} fill="#2E3E48" stroke={GOLD} strokeOpacity={0.5 * near} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>

        {/* 全景时的目标区域提示 */}
        {overview > 0 && (
          <circle
            cx={S([-5, -30])[0]}
            cy={S([-5, -30])[1]}
            r={28 + 30 * pulse(30)}
            fill="none"
            stroke={GOLD}
            strokeWidth={2}
            opacity={overview * (1 - pulse(30))}
          />
        )}

        {/* ---------- 路线 ---------- */}
        {q > 0 && (
          <>
            <path d={lineD} fill="none" stroke={GOLD} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} filter="url(#routeGlow)" />
            <path d={lineD} fill="none" stroke={GOLD_HI} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* 城市点 */}
        {dot("Bologna", near, passed("Bologna"))}
        {dot("Rimini", near, passed("Rimini"))}
        {dot("San Marino", near * 0.7)}

        {/* 起点：普拉托 */}
        <g opacity={interpolate(fly, [0.6, 0.9], [0, 1], clamp)}>
          <circle cx={px} cy={py} r={9} fill={GOLD} />
          <circle cx={px} cy={py} r={9 + 22 * pulse(36)} fill="none" stroke={GOLD} strokeWidth={2} opacity={1 - pulse(36)} />
        </g>

        {/* 终点：Gradara */}
        <g opacity={near}>
          <circle cx={gx} cy={gy} r={8 + 4 * arrived} fill={arrived > 0 ? GOLD_HI : "none"} stroke={GOLD} strokeWidth={2.5} />
          {arrived > 0 && (
            <circle cx={gx} cy={gy} r={10 + 34 * pulse(24, 6)} fill="none" stroke={GOLD_HI} strokeWidth={2} opacity={arrived * (1 - pulse(24, 6))} />
          )}
        </g>

        {/* 行进中的大巴光点 */}
        {q > 0 && q < 1 && (
          <g>
            <circle cx={head[0]} cy={head[1]} r={22} fill={GOLD} opacity={0.25} filter="url(#routeGlow)" />
            <circle cx={head[0]} cy={head[1]} r={9} fill="#FFF6E4" stroke={GOLD} strokeWidth={3} />
          </g>
        )}
      </svg>

      {/* ---------- 文字 ---------- */}
      {overview > 0 && (
        <Label at={[40, 230]} opacity={overview * 0.9}>
          <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 64, letterSpacing: "0.5em", paddingLeft: "0.5em" }}>ITALIA</div>
        </Label>
      )}

      <Label at={pts.toscana} opacity={near * 0.42}>
        <div style={smallCaps(18, "0.55em")}>Toscana</div>
      </Label>
      <Label at={pts.emilia} opacity={near * 0.42}>
        <div style={smallCaps(18, "0.55em")}>Emilia-Romagna</div>
      </Label>
      <Label at={pts.marche} opacity={near * 0.42}>
        <div style={smallCaps(18, "0.55em")}>Marche</div>
      </Label>
      <Label at={pts.adriatic} align="center" opacity={near * 0.55}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 300, fontSize: 34, transform: "rotate(-62deg)" }}>
          Mare Adriatico
        </div>
      </Label>

      <Label at={city.Bologna} dx={0} dy={-34} opacity={near * (0.6 + 0.4 * passed("Bologna"))}>
        <div style={{ ...smallCaps(21), color: passed("Bologna") > 0.5 ? GOLD_HI : IVORY }}>Bologna</div>
      </Label>
      <Label at={city.Rimini} dy={-32} opacity={near * (0.6 + 0.4 * passed("Rimini"))}>
        <div style={{ ...smallCaps(21), color: passed("Rimini") > 0.5 ? GOLD_HI : IVORY }}>Rimini</div>
      </Label>
      <Label at={city["San Marino"]} dy={-26} opacity={near * 0.5}>
        <div style={smallCaps(16)}>San Marino</div>
      </Label>

      {/* 起点 / 终点标签 */}
      <Label at={city.Prato} dy={58} align="left" dx={-24} opacity={interpolate(fly, [0.7, 1], [0, 1], clamp)}>
        <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 40, letterSpacing: "0.12em" }}>PRATO</div>
        <div style={{ ...smallCaps(20, "0.3em"), color: GOLD, marginTop: 6 }}>09:10 出发</div>
      </Label>
      <Label at={city.Gradara} dy={60} align="right" dx={24} opacity={near * (0.55 + 0.45 * arrived)}>
        <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 40, letterSpacing: "0.12em", color: arrived > 0.5 ? GOLD_HI : IVORY }}>
          GRADARA
        </div>
        <div style={{ ...smallCaps(20, "0.3em"), color: GOLD, marginTop: 6, opacity: arrived }}>12:25 抵达</div>
      </Label>

      {/* 标题 */}
      <div
        style={{
          position: "absolute",
          top: 270,
          left: 0,
          right: 0,
          textAlign: "center",
          color: IVORY,
          opacity: headerIn,
          transform: `translateY(${(1 - headerIn) * 20}px)`,
          textShadow: "0 2px 18px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ ...smallCaps(22, "0.6em"), paddingLeft: "0.6em", color: GOLD }}>The Route · 行程</div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 300, fontSize: 112, lineHeight: 1.1, marginTop: 22 }}>
          Prato — Gradara
        </div>
        <div style={{ fontFamily: CN, fontSize: 32, letterSpacing: "0.4em", paddingLeft: "0.4em", marginTop: 22, opacity: 0.9 }}>
          托斯卡纳 → 马尔凯
        </div>
      </div>

      {/* 里程 */}
      <div
        style={{
          position: "absolute",
          top: 1430,
          left: 0,
          right: 0,
          textAlign: "center",
          color: IVORY,
          opacity: footerIn,
          textShadow: "0 2px 18px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ width: 120 * footerIn, height: 1.5, background: GOLD, margin: "0 auto 34px" }} />
        <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 132, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(q * data.distanceKm)}
          <span style={{ ...smallCaps(30, "0.3em"), marginLeft: 18 }}>km</span>
        </div>
        <div style={{ fontFamily: CN, fontSize: 28, letterSpacing: "0.5em", paddingLeft: "0.5em", marginTop: 20, opacity: 0.8 }}>
          翻越亚平宁 · 奔向亚得里亚海
        </div>
      </div>

      {/* 数据来源（小字） */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          left: 0,
          right: 0,
          textAlign: "center",
          ...smallCaps(13, "0.15em"),
          textTransform: "none",
          color: "rgba(246,240,230,0.32)",
          opacity: near,
        }}
      >
        Map data © OpenStreetMap contributors · Natural Earth · ISTAT
      </div>
    </AbsoluteFill>
  );
};
