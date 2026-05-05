import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type ChatVideoCardProps = {
  uri: string;
  width: number;
  height: number;
  borderColor: string;
  backgroundColor: string;
  accessibilityLabel: string;
};

export function ChatVideoCard({
  uri,
  width,
  height,
  borderColor,
  backgroundColor,
  accessibilityLabel,
}: ChatVideoCardProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.muted = false;
  });

  return (
    <View
      className="overflow-hidden rounded-2xl border"
      style={{ width, height, borderColor, backgroundColor }}
    >
      <VideoView
        key={uri}
        style={StyleSheet.absoluteFillObject}
        player={player}
        nativeControls
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
        contentFit="cover"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

