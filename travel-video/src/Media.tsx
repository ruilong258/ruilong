import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { RouteMap } from "./map/RouteMap";
import { HEIGHT, WIDTH, type PlacedShot } from "./timeline";

const smooth = Easing.bezier(0.45, 0, 0.25, 1);

/** 每个镜头的运镜：视频用缓慢推近，照片用 Ken Burns */
const MOTION: Record<
  string,
  {
    s: [number, number];
    y?: [number, number];
    x?: [number, number];
    origin?: string;
    pos?: string; // object-position，决定照片裁切重心
    punch?: boolean;
    dim?: number;
  }
> = {
  bus: { s: [1.0, 1.08], dim: 0.8 }, // 开场压暗一点，衬托字幕
  arrive: { s: [1.02, 1.06], punch: true },
  gate: { s: [1.2, 1.3], y: [190, -90] }, // 从钟楼+蓝天慢慢下摇到城门拱洞
  hero: { s: [1.02, 1.07] },
  smoke: { s: [1.0, 1.07], origin: "50% 40%" },
  scarecrow: { s: [1.04, 1.16], origin: "50% 28%" },
  cage: { s: [1.08, 1.02] },
  ghosts: { s: [1.0, 1.06] },
  bubbles: { s: [1.04, 1.1], origin: "50% 30%" },
  bubblekids: { s: [1.08, 1.18], origin: "40% 45%", pos: "40% 50%" },
  hooded: { s: [1.06, 1.12], origin: "55% 45%" },
  angel: { s: [1.0, 1.08], origin: "40% 35%" },
  longhair: { s: [1.04, 1.1] },
  headless: { s: [1.02, 1.1], origin: "45% 35%" },
  nun: { s: [1.04, 1.1], origin: "35% 50%" },
  fire: { s: [1.1, 1.26], origin: "78% 45%", pos: "72% 50%" }, // 推向火舞者
  tower: { s: [1.0, 1.06], origin: "50% 30%" },
};

export const ShotLayer: React.FC<{ shot: PlacedShot; endCardFrom?: number }> = ({
  shot,
  endCardFrom,
}) => {
  const f = useCurrentFrame(); // 相对本镜头开始
  const m = MOTION[shot.id] ?? { s: [1, 1.05] };
  const p = interpolate(f, [0, shot.duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: shot.kind === "photo" ? smooth : Easing.linear,
  });
  let scale = m.s[0] + (m.s[1] - m.s[0]) * p;
  if (m.punch) {
    // 落拍时的轻微“冲镜”
    scale *= interpolate(f, [0, 14], [1.12, 1], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  }
  // 平移量不超过放大后多出来的边，防止露出黑边
  const maxY = ((scale - 1) * HEIGHT) / 2;
  const maxX = ((scale - 1) * WIDTH) / 2;
  const ty = Math.max(-maxY, Math.min(maxY, m.y ? m.y[0] + (m.y[1] - m.y[0]) * p : 0));
  const tx = Math.max(-maxX, Math.min(maxX, m.x ? m.x[0] + (m.x[1] - m.x[0]) * p : 0));

  const lead = shot.trans.type === "fade" ? shot.trans.frames : 0;
  const opacity = lead
    ? interpolate(f, [0, lead], [0, 1], { extrapolateRight: "clamp", easing: smooth })
    : 1;

  if (shot.kind === "map") {
    return (
      <AbsoluteFill style={{ opacity }}>
        <RouteMap duration={shot.duration} />
      </AbsoluteFill>
    );
  }

  // 片尾：背景虚化 + 压暗
  let filter = m.dim ? `brightness(${m.dim})` : "none";
  if (endCardFrom !== undefined) {
    const e = interpolate(f, [endCardFrom, endCardFrom + 30], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smooth,
    });
    filter = `blur(${e * 14}px) brightness(${1 - e * 0.45}) saturate(${1 - e * 0.25})`;
  }

  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: m.pos ?? "50% 50%",
    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    transformOrigin: m.origin ?? "50% 50%",
    filter,
  };

  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden", backgroundColor: "black" }}>
      {shot.kind === "video" ? (
        <OffthreadVideo src={staticFile(`clips/${shot.id}.mp4`)} muted style={style} />
      ) : (
        <Img src={staticFile(`photos/${shot.id}.jpg`)} style={style} />
      )}
    </AbsoluteFill>
  );
};
