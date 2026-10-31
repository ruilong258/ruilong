import "./fonts.css";
import { Composition } from "remotion";
import { GradaraTrip } from "./GradaraTrip";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="GradaraTrip"
    component={GradaraTrip}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
