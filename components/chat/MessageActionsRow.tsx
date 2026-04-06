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
}: MessageActionsRowProps) {
  return (
    <View className="mt-1 flex-row items-center gap-1">
      <Pressable
        onPress={onCopy}
        onLongPress={(event) => onTooltip('Copy response', event)}
        accessibilityRole="button"
        accessibilityLabel="Copy response"
        accessibilityHint="Copies this response to clipboard."
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor }}
      >
        <Ionicons name="copy-outline" size={13} color={iconColor} />
      </Pressable>

      <Pressable
        onPress={onLike}
        onLongPress={(event) => onTooltip('Like response', event)}
        accessibilityRole="button"
        accessibilityLabel="Like response"
        accessibilityHint="Marks this response as helpful."
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
        onLongPress={(event) => onTooltip('Dislike response', event)}
        accessibilityRole="button"
        accessibilityLabel="Dislike response"
        accessibilityHint="Marks this response as unhelpful."
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
        onLongPress={(event) => onTooltip('Share response', event)}
        accessibilityRole="button"
        accessibilityLabel="Share response"
        accessibilityHint="Opens the share sheet for this response."
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor }}
      >
        <Ionicons name="share-social-outline" size={13} color={iconColor} />
      </Pressable>

      <Pressable
        onPress={onReadAloud}
        onLongPress={(event) => onTooltip('Read response aloud', event)}
        accessibilityRole="button"
        accessibilityLabel={isReading ? 'Stop reading response aloud' : 'Read response aloud'}
        accessibilityHint="Uses device speech to read this response."
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
