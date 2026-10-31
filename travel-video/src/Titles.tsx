import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BRAND } from "./config";
import { BEAT, shotById, TOTAL_FRAMES } from "./timeline";

const SERIF = '"Cormorant Garamond", "Noto Serif SC", serif';
const SANS = 'Inter, "Noto Serif SC", sans-serif';
const CN = '"Noto Serif SC", serif';
const IVORY = "#F6F0E6";
const GOLD = "#D8B67C";
const SHADOW = "0 2px 18px rgba(0,0,0,0.35), 0 0 2px rgba(0,0,0,0.25)";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 淡入 + 去模糊 + 轻微上浮；淡出时轻微模糊 */
const reveal = (f: number, start: number, end: number, inDur = 18, outDur = 12) => {
  const a = interpolate(f, [start, start + inDur], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const b = interpolate(f, [end - outDur, end], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  return {
    visible: f >= start && f <= end,
    style: {
      opacity: Math.min(a, b),
      filter: `blur(${(1 - a) * 10 + (1 - b) * 6}px)`,
      transform: `translateY(${(1 - a) * 22}px)`,
    } as React.CSSProperties,
  };
};

const Line: React.FC<{ f: number; start: number; end: number; width?: number; color?: string }> = ({
  f,
  start,
  end,
  width = 200,
  color = GOLD,
}) => {
  const w = interpolate(f, [start, start + 22], [0, width], { ...clamp, easing: Easing.out(Easing.cubic) });
  const o = interpolate(f, [end - 12, end], [1, 0], clamp);
  return <div style={{ width: w, height: 1.5, background: color, opacity: o, margin: "0 auto" }} />;
};

const Tracked: React.FC<{ spacing: string; style?: React.CSSProperties; children: React.ReactNode }> = ({
  spacing,
  style,
  children,
}) => (
  // letter-spacing 会在末尾多出一格，用 padding-left 抵消，保证居中
  <div style={{ letterSpacing: spacing, paddingLeft: spacing, ...style }}>{children}</div>
);

/** 柔和暗角托底，保证白字在亮背景上可读 */
const Scrim: React.FC<{ y: string; opacity: number; h?: string; k?: number }> = ({ y, opacity, h = "38%", k = 1 }) => (
  <AbsoluteFill
    style={{
      opacity,
      background: `radial-gradient(ellipse 95% ${h} at 50% ${y}, rgba(10,8,6,${0.66 * k}) 0%, rgba(10,8,6,${0.4 * k}) 48%, rgba(10,8,6,0) 100%)`,
    }}
  />
);

const Center: React.FC<{ top: number; children: React.ReactNode }> = ({ top, children }) => (
  <div style={{ position: "absolute", top, left: 0, right: 0, textAlign: "center", color: IVORY, textShadow: SHADOW }}>
    {children}
  </div>
);

/** 左上角的时间戳小标签：像旅行日记一样串起一天 */
const TimeTag: React.FC<{ f: number; start: number; end: number; time: string; label: string }> = ({
  f,
  start,
  end,
  time,
  label,
}) => {
  const r = reveal(f, start, end, 16, 10);
  if (!r.visible) return null;
  return (
    <>
      <AbsoluteFill
        style={{
          opacity: Number(r.style.opacity),
          background:
            "radial-gradient(ellipse 60% 16% at 22% 17%, rgba(10,8,6,0.55) 0%, rgba(10,8,6,0.25) 55%, rgba(10,8,6,0) 100%)",
        }}
      />
      <div style={{ position: "absolute", left: 92, top: 250, color: IVORY, textShadow: SHADOW, ...r.style }}>
        <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 92, lineHeight: 1 }}>{time}</div>
        <div style={{ width: 70, height: 1.5, background: GOLD, margin: "18px 0 16px" }} />
        <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 21, letterSpacing: "0.42em", whiteSpace: "nowrap" }}>
          {label}
        </div>
      </div>
    </>
  );
};

export const Titles: React.FC = () => {
  const f = useCurrentFrame();
  const bus = shotById("bus");
  const map = shotById("map");
  const gate = shotById("gate");
  const smoke = shotById("smoke");
  const bubbles = shotById("bubbles");
  const angel = shotById("angel");
  const tower = shotById("tower");
  const endOf = (s: ReturnType<typeof shotById>) => s.cut + s.beats * BEAT;
  const endCard = tower.cut + 4 * BEAT; // 第 56 拍：片尾卡

  // ---------- 01 出发（大巴） ----------
  const iEnd = map.cut - 2;
  const iDate = reveal(f, bus.cut + 8, iEnd);
  const iTitle = reveal(f, bus.cut + 16, iEnd, 22);
  const iCn = reveal(f, bus.cut + 28, iEnd);

  // ---------- 02 GRADARA ----------
  const gEnd = endOf(gate) - 4;
  const gSub = reveal(f, gate.cut + 34, gEnd);
  const gCn = reveal(f, gate.cut + 44, gEnd);
  const letters = "GRADARA".split("");

  // ---------- 03 万圣节 ----------
  const sEnd = endOf(smoke) - 2;
  const sTitle = reveal(f, smoke.cut + 2, sEnd, 18, 10);
  const sCn = reveal(f, smoke.cut + 12, sEnd, 16, 10);

  // ---------- 黄昏 · 金句 ----------
  const qEnd = endCard - 2;
  const q1 = reveal(f, tower.cut + 6, qEnd, 22, 14);
  const q2 = reveal(f, tower.cut + 18, qEnd, 22, 14);
  const q3 = reveal(f, tower.cut + 32, qEnd, 22, 14);

  // ---------- 片尾 ----------
  const eT = reveal(f, endCard + 2, TOTAL_FRAMES + 30, 24);
  const eDate = reveal(f, endCard + 12, TOTAL_FRAMES + 30, 18);
  const eBrand = reveal(f, endCard + 20, TOTAL_FRAMES + 30, 18);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* 01 出发 */}
      {iDate.visible && <Scrim y="52%" opacity={Number(iDate.style.opacity)} h="30%" />}
      {iDate.visible && (
        <Center top={780}>
          <div style={iDate.style}>
            <Tracked spacing="0.5em" style={{ fontFamily: SANS, fontWeight: 300, fontSize: 26 }}>
              31 · 10 · 2026
            </Tracked>
          </div>
          <div style={{ ...iTitle.style, marginTop: 26 }}>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 300, fontSize: 138, lineHeight: 1 }}>
              On the Road
            </div>
          </div>
          <div style={{ marginTop: 34 }}>
            <Line f={f} start={bus.cut + 22} end={iEnd} />
          </div>
          <div style={{ ...iCn.style, marginTop: 34 }}>
            <Tracked spacing="0.38em" style={{ fontFamily: CN, fontSize: 38 }}>
              出发 · 去古堡过万圣节
            </Tracked>
          </div>
        </Center>
      )}

      {/* 02 GRADARA */}
      {f >= gate.cut && f <= gEnd && (
        <>
          <Scrim y="22%" opacity={interpolate(f, [gate.cut, gate.cut + 16, gEnd - 12, gEnd], [0, 1, 1, 0], clamp)} h="28%" k={1.25} />
          <Center top={260}>
            <div style={{ display: "flex", justifyContent: "center", paddingLeft: "0.17em", fontSize: 150 }}>
              {letters.map((ch, i) => {
                const r = reveal(f, gate.cut + 6 + i * 3, gEnd, 20, 12);
                return (
                  <span
                    key={i}
                    style={{ ...r.style, display: "inline-block", fontFamily: SERIF, fontWeight: 300, lineHeight: 1, marginRight: "0.17em" }}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
            <div style={{ marginTop: 30 }}>
              <Line f={f} start={gate.cut + 26} end={gEnd} width={260} />
            </div>
            <div style={{ ...gSub.style, marginTop: 30 }}>
              <Tracked spacing="0.5em" style={{ fontFamily: SANS, fontWeight: 400, fontSize: 24 }}>
                BORGO DEI BORGHI · 2018
              </Tracked>
            </div>
            <div style={{ ...gCn.style, marginTop: 22 }}>
              <Tracked spacing="0.42em" style={{ fontFamily: CN, fontSize: 36 }}>
                意大利最美小镇
              </Tracked>
            </div>
          </Center>
        </>
      )}

      {/* 03 万圣节 */}
      {sTitle.visible && (
        <>
          <Scrim y="27%" opacity={Number(sTitle.style.opacity)} h="24%" />
          <Center top={380}>
            <div style={sTitle.style}>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 300, fontSize: 156, lineHeight: 1 }}>
                Halloween
              </div>
            </div>
            <div style={{ ...sCn.style, marginTop: 30 }}>
              <Tracked spacing="0.42em" style={{ fontFamily: CN, fontSize: 34 }}>
                古堡万圣节
              </Tracked>
            </div>
          </Center>
        </>
      )}

      {/* 时间戳 */}
      <TimeTag f={f} start={bubbles.cut + 2} end={endOf(bubbles) + 30} time="15:44" label="AFTERNOON · 午后" />
      <TimeTag f={f} start={angel.cut + 2} end={endOf(angel) - 2} time="16:38" label="THE SHOW · 演出" />
      <TimeTag f={f} start={tower.cut + 4} end={endCard - 4} time="16:58" label="DUSK · 黄昏" />

      {/* 黄昏金句 */}
      {q1.visible && (
        <>
          <Scrim y="55%" opacity={Number(q1.style.opacity)} h="22%" k={1.2} />
          <Center top={930}>
            <div style={q1.style}>
              <Tracked spacing="0.28em" style={{ fontFamily: CN, fontSize: 54, lineHeight: 1.6 }}>
                有些地方
              </Tracked>
            </div>
            <div style={q2.style}>
              <Tracked spacing="0.28em" style={{ fontFamily: CN, fontSize: 54, lineHeight: 1.6 }}>
                本身就是童话
              </Tracked>
            </div>
            <div style={{ ...q3.style, marginTop: 22 }}>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 300, fontSize: 44, opacity: 0.9 }}>
                some places are fairy tales
              </div>
            </div>
          </Center>
        </>
      )}

      {/* 片尾 */}
      {eT.visible && (
        <Center top={700}>
          <div style={eT.style}>
            <Tracked spacing="0.26em" style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 132, lineHeight: 1 }}>
              GRADARA
            </Tracked>
          </div>
          <div style={{ marginTop: 34 }}>
            <Line f={f} start={endCard + 8} end={TOTAL_FRAMES + 30} width={240} />
          </div>
          <div style={{ ...eDate.style, marginTop: 34 }}>
            <Tracked spacing="0.5em" style={{ fontFamily: SANS, fontWeight: 300, fontSize: 24 }}>
              ITALIA · 31.10.2026
            </Tracked>
          </div>
          {BRAND.show && (
            <div style={{ ...eBrand.style, marginTop: 200 }}>
              <Tracked spacing="0.6em" style={{ fontFamily: SANS, fontWeight: 300, fontSize: 20, opacity: 0.85 }}>
                {BRAND.en}
              </Tracked>
              <Tracked spacing="0.5em" style={{ fontFamily: CN, fontSize: 30, marginTop: 14 }}>
                {BRAND.cn}
              </Tracked>
            </div>
          )}
        </Center>
      )}
    </AbsoluteFill>
  );
};
