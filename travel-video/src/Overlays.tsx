import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";

/** 胶片颗粒：低分辨率 SVG 噪点放大，每帧换种子 */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(random(`grain-${frame}`) * 1000);
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity, pointerEvents: "none" }}>
      <svg width="100%" height="100%" viewBox="0 0 540 960" preserveAspectRatio="none">
        <filter id={`g${frame}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="540" height="960" filter={`url(#g${frame})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(ellipse 85% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(8,6,4,0.55) 100%)",
    }}
  />
);

/** 暖色漏光闪白，用在落拍转场 */
export const Flash: React.FC<{ at: number; frames: number }> = ({ at, frames }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at - 4, at, at + frames], [0, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (o <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: o,
        background:
          "radial-gradient(ellipse 90% 60% at 30% 40%, rgba(255,236,205,1) 0%, rgba(255,186,120,0.75) 45%, rgba(255,140,80,0.0) 100%)",
      }}
    />
  );
};

export const FadeBlack: React.FC<{ range: [number, number]; dir: "in" | "out" }> = ({
  range,
  dir,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, range, dir === "in" ? [1, 0] : [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (o <= 0) return null;
  return <AbsoluteFill style={{ backgroundColor: "black", opacity: o, pointerEvents: "none" }} />;
};
