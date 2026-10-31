import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile } from "remotion";
import { ShotLayer } from "./Media";
import { FadeBlack, Flash, Grain, Vignette } from "./Overlays";
import { SHOTS, TOTAL_FRAMES } from "./timeline";
import { Titles } from "./Titles";

const FONT_PROBES = [
  '300 100px "Cormorant Garamond"',
  'italic 300 100px "Cormorant Garamond"',
  '300 30px "Inter"',
];
const CN_PROBE = '400 40px "Noto Serif SC"';
const CN_TEXT = "出发去古堡过万圣节抵达意大利最美小镇有些地方本身就是童话瑞龙旅行·";

export const GradaraTrip: React.FC = () => {
  // 字体加载完成前不截帧，避免首帧出现回退字体
  const [handle] = useState(() => delayRender("load fonts"));
  useEffect(() => {
    Promise.all([
      ...FONT_PROBES.map((p) => document.fonts.load(p, "GRADARA On the Road 0123456789")),
      document.fonts.load(CN_PROBE, CN_TEXT),
      document.fonts.load('600 40px "Noto Serif SC"', CN_TEXT),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);

  const last = SHOTS[SHOTS.length - 1];
  const endCardLocal = 5 * 18 + (last.trans.type === "fade" ? last.trans.frames : 0);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {SHOTS.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}>
          <ShotLayer shot={s} endCardFrom={s.id === "courtyard" ? endCardLocal : undefined} />
        </Sequence>
      ))}

      {SHOTS.filter((s) => s.trans.type === "flash").map((s) => (
        <Flash key={`flash-${s.id}`} at={s.cut} frames={s.trans.frames} />
      ))}

      <Vignette />
      <Titles />
      <Grain opacity={0.08} />

      <FadeBlack range={[0, SHOTS[0].trans.frames]} dir="in" />
      <FadeBlack range={[TOTAL_FRAMES - 14, TOTAL_FRAMES - 1]} dir="out" />

      <Audio src={staticFile("music.wav")} />
    </AbsoluteFill>
  );
};
