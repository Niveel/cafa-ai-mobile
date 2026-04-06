import { Ionicons } from '@expo/vector-icons';
import { GestureResponderEvent, Pressable, View } from 'react-native';

type MessageActionsRowProps = {
  isReading: boolean;
  reaction?: 'like' | 'dislike';
  primaryColor: string;
  borderColor: string;
  iconColor: string;
  onCopy: () => void;
  onLike: () => void;
  onDislike: () => void;
  onShare: () => void;
  onReadAloud: () => void;
  onTooltip: (label: string, event: GestureResponderEvent) => void;
  labels: {
    copy: string;
    copyHint: string;
    like: string;
    likeHint: string;
    dislike: string;
    dislikeHint: string;
    share: string;
    shareHint: string;
    read: string;
    stopRead: string;
    readHint: string;
  };
};

export function MessageActionsRow({
  isReading,
  reaction,
  primaryColor,
  borderColor,
  iconColor,
  onCopy,
  onLike,
  onDislike,
  onShare,
  onReadAloud,
  onTooltip,
  labels,
}: MessageActionsRowProps) {
  return (
    <View className="mt-1 flex-row items-center gap-1">
      <Pressable
        onPress={onCopy}
        onLongPress={(event) => onTooltip(labels.copy, event)}
        accessibilityRole="button"
        accessibilityLabel={labels.copy}
        accessibilityHint={labels.copyHint}
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor }}
      >
        <Ionicons name="copy-outline" size={13} color={iconColor} />
      </Pressable>

      <Pressable
        onPress={onLike}
        onLongPress={(event) => onTooltip(labels.like, event)}
        accessibilityRole="button"
        accessibilityLabel={labels.like}
        accessibilityHint={labels.likeHint}
        accessibilityState={{ selected: reaction === 'like' }}
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor: reaction === 'like' ? primaryColor : borderColor }}
      >
        <Ionicons
          name={reaction === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
          size={13}
          color={reaction === 'like' ? primaryColor : iconColor}
        />
      </Pressable>

      <Pressable
        onPress={onDislike}
        onLongPress={(event) => onTooltip(labels.dislike, event)}
        accessibilityRole="button"
        accessibilityLabel={labels.dislike}
        accessibilityHint={labels.dislikeHint}
        accessibilityState={{ selected: reaction === 'dislike' }}
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor: reaction === 'dislike' ? primaryColor : borderColor }}
      >
        <Ionicons
          name={reaction === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
          size={13}
          color={reaction === 'dislike' ? primaryColor : iconColor}
        />
      </Pressable>

      <Pressable
        onPress={onShare}
        onLongPress={(event) => onTooltip(labels.share, event)}
        accessibilityRole="button"
        accessibilityLabel={labels.share}
        accessibilityHint={labels.shareHint}
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor }}
      >
        <Ionicons name="share-social-outline" size={13} color={iconColor} />
      </Pressable>

      <Pressable
        onPress={onReadAloud}
        onLongPress={(event) => onTooltip(isReading ? labels.stopRead : labels.read, event)}
        accessibilityRole="button"
        accessibilityLabel={isReading ? labels.stopRead : labels.read}
        accessibilityHint={labels.readHint}
        accessibilityState={{ selected: isReading }}
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor: isReading ? primaryColor : borderColor }}
      >
        <Ionicons
          name={isReading ? 'stop-circle-outline' : 'volume-high-outline'}
          size={13}
          color={isReading ? primaryColor : iconColor}
        />
      </Pressable>
    </View>
  );
}
