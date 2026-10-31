import tl from "../timeline.json";

export type TransType = "cut" | "fade" | "flash" | "fadeFromBlack";

export interface Shot {
  id: string;
  kind: "video" | "photo";
  beats: number;
  trans: { type: TransType; frames: number };
}

export const FPS = tl.fps;
export const WIDTH = tl.width;
export const HEIGHT = tl.height;
export const BEAT = tl.beatFrames; // 18 帧 = 100 BPM 的一拍
export const TOTAL_FRAMES = tl.totalBeats * BEAT; // 50 拍 = 900 帧 = 30 秒

export interface PlacedShot extends Shot {
  cut: number; // 这一镜在节拍上“落地”的帧
  from: number; // 实际开始渲染的帧（叠化镜头会提前进入）
  duration: number;
}

export const SHOTS: PlacedShot[] = (() => {
  let cursor = 0;
  return (tl.shots as Shot[]).map((s) => {
    const cut = cursor;
    cursor += s.beats * BEAT;
    const lead = s.trans.type === "fade" ? s.trans.frames : 0;
    return { ...s, cut, from: cut - lead, duration: s.beats * BEAT + lead };
  });
})();

export const shotById = (id: string) => {
  const s = SHOTS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown shot ${id}`);
  return s;
};

export const beat = (n: number) => n * BEAT;
