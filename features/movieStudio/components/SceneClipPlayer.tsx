import { useVideoPlayer, VideoView } from 'expo-video';

export function SceneClipPlayer({ uri, height = 220 }: { uri: string; height?: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} nativeControls contentFit="contain" style={{ width: '100%', height, backgroundColor: '#000' }} />;
}
