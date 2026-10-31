import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
// 云端容器里没有 Remotion 自带的 Chrome，用预装的 headless shell；
// 本地运行可删掉这一行或用环境变量 REMOTION_BROWSER 覆盖。
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
