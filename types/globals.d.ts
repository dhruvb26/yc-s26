export {}

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      onboardingComplete?: boolean
    }
  }
}

// ffmpeg-static provides the path to the bundled ffmpeg binary
declare module "ffmpeg-static" {
  const ffmpegPath: string;
  export default ffmpegPath;
}