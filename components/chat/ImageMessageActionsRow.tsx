import { Ionicons } from '@expo/vector-icons';
import { GestureResponderEvent, Pressable, View } from 'react-native';

type ImageMessageActionsRowProps = {
  reaction?: 'like' | 'dislike';
  primaryColor: string;
  borderColor: string;
  iconColor: string;
  onCopyPrompt: () => void;
  onLike: () => void;
  onUnlike: () => void;
  onDownload: () => void;
  onShare: () => void;
  onTooltip: (label: string, event: GestureResponderEvent) => void;
  labels: {
    copy: string;
    copyHint: string;
    like: string;
    likeHint: string;
    unlike: string;
    unlikeHint: string;
    download: string;
    downloadHint: string;
    share: string;
    shareHint: string;
  };
};

export function ImageMessageActionsRow({
  reaction,
  primaryColor,
  borderColor,
  iconColor,
  onCopyPrompt,
  onLike,
  onUnlike,
  onDownload,
  onShare,
  onTooltip,
  labels,
}: ImageMessageActionsRowProps) {
  return (
    <View className="mt-1 flex-row items-center gap-1">
      <Pressable
        onPress={onCopyPrompt}
        delayLongPress={180}
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
        delayLongPress={180}
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
        onPress={onUnlike}
        delayLongPress={180}
        onLongPress={(event) => onTooltip(labels.unlike, event)}
        accessibilityRole="button"
        accessibilityLabel={labels.unlike}
        accessibilityHint={labels.unlikeHint}
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
        onPress={onDownload}
        delayLongPress={180}
        onLongPress={(event) => onTooltip(labels.download, event)}
        accessibilityRole="button"
        accessibilityLabel={labels.download}
        accessibilityHint={labels.downloadHint}
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor }}
      >
        <Ionicons name="download-outline" size={13} color={iconColor} />
      </Pressable>

      <Pressable
        onPress={onShare}
        delayLongPress={180}
        onLongPress={(event) => onTooltip(labels.share, event)}
        accessibilityRole="button"
        accessibilityLabel={labels.share}
        accessibilityHint={labels.shareHint}
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor }}
      >
        <Ionicons name="share-social-outline" size={13} color={iconColor} />
      </Pressable>
    </View>
  );
}
