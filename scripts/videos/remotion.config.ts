import { Config } from "@remotion/cli/config";

// scripts/record.mjs --remotion writes .recordings/<name>/{video.mp4,timeline.json}.
Config.setPublicDir("../../.recordings");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
