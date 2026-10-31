import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BRAND } from "./config";
import { shotById, TOTAL_FRAMES } from "./timeline";

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

export const Titles: React.FC = () => {
  const f = useCurrentFrame();
  const bus = shotById("bus");
  const arrive = shotById("arrive");
  const gate = shotById("gate");
  const smoke = shotById("smoke");
  const court = shotById("courtyard");
  const endCard = court.cut + 5 * 18; // 第 46 拍：片尾卡

  // ---------- 01 出发（大巴） ----------
  const iEnd = arrive.cut - 6;
  const iDate = reveal(f, bus.cut + 10, iEnd);
  const iTitle = reveal(f, bus.cut + 22, iEnd, 24);
  const iCn = reveal(f, bus.cut + 36, iEnd);
  const iGeo = reveal(f, bus.cut + 50, iEnd);

  // ---------- 抵达 ----------
  const aIn = reveal(f, arrive.cut + 6, gate.cut - 2, 14, 10);

  // ---------- 02 GRADARA ----------
  const gEnd = gate.cut + gate.beats * 18 - 4;
  const gSub = reveal(f, gate.cut + 34, gEnd);
  const gCn = reveal(f, gate.cut + 44, gEnd);
  const letters = "GRADARA".split("");

  // ---------- 03 万圣节 ----------
  const sEnd = smoke.cut + smoke.beats * 18 - 2;
  const sTitle = reveal(f, smoke.cut + 4, sEnd, 20, 10);
  const sCn = reveal(f, smoke.cut + 16, sEnd, 18, 10);

  // ---------- 庭院 · 金句 ----------
  const qEnd = endCard - 2;
  const q1 = reveal(f, court.cut + 10, qEnd, 22, 14);
  const q2 = reveal(f, court.cut + 22, qEnd, 22, 14);
  const q3 = reveal(f, court.cut + 36, qEnd, 22, 14);

  // ---------- 片尾 ----------
  const eT = reveal(f, endCard + 2, TOTAL_FRAMES + 30, 24);
  const eDate = reveal(f, endCard + 12, TOTAL_FRAMES + 30, 18);
  const eBrand = reveal(f, endCard + 20, TOTAL_FRAMES + 30, 18);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* 01 出发 */}
      {iDate.visible && <Scrim y="52%" opacity={Number(iDate.style.opacity)} h="34%" />}
      {iDate.visible && (
        <Center top={760}>
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
            <Line f={f} start={bus.cut + 30} end={iEnd} />
          </div>
          <div style={{ ...iCn.style, marginTop: 34 }}>
            <Tracked spacing="0.38em" style={{ fontFamily: CN, fontSize: 38 }}>
              出发 · 去古堡过万圣节
            </Tracked>
          </div>
          <div style={{ ...iGeo.style, marginTop: 200, opacity: Number(iGeo.style.opacity) * 0.85 }}>
            <Tracked spacing="0.32em" style={{ fontFamily: SANS, fontWeight: 300, fontSize: 21 }}>
              09:10 · 43.86°N 11.10°E
            </Tracked>
          </div>
        </Center>
      )}

      {/* 抵达 */}
      {aIn.visible && (
        <AbsoluteFill
          style={{
            opacity: Number(aIn.style.opacity),
            background:
              "radial-gradient(ellipse 70% 22% at 22% 68%, rgba(10,8,6,0.6) 0%, rgba(10,8,6,0.3) 50%, rgba(10,8,6,0) 100%)",
          }}
        />
      )}
      {aIn.visible && (
        <div
          style={{
            position: "absolute",
            left: 92,
            top: 1180,
            color: IVORY,
            textShadow: SHADOW,
            ...aIn.style,
          }}
        >
          <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 132, lineHeight: 1 }}>12:25</div>
          <div style={{ width: 90, height: 1.5, background: GOLD, margin: "22px 0 20px" }} />
          <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 22, letterSpacing: "0.45em", whiteSpace: "nowrap" }}>
            ARRIVED IN GRADARA
          </div>
          <div style={{ fontFamily: CN, fontSize: 32, letterSpacing: "0.4em", marginTop: 14, whiteSpace: "nowrap" }}>
            抵达古堡
          </div>
        </div>
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
                    style={{
                      ...r.style,
                      display: "inline-block",
                      fontFamily: SERIF,
                      fontWeight: 300,
                      lineHeight: 1,
                      marginRight: "0.17em",
                    }}
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

      {/* 庭院金句 */}
      {q1.visible && (
        <>
          <Scrim y="38%" opacity={Number(q1.style.opacity) * 0.9} h="26%" />
          <Center top={590}>
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
