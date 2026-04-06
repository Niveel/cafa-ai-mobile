import { Ionicons } from '@expo/vector-icons';
import { GestureResponderEvent, Pressable, View } from 'react-native';

type UserPromptActionsRowProps = {
  borderColor: string;
  iconColor: string;
  onCopy: () => void;
  onEdit: () => void;
  onTooltip: (label: string, event: GestureResponderEvent) => void;
};

export function UserPromptActionsRow({
  borderColor,
  iconColor,
  onCopy,
  onEdit,
  onTooltip,
}: UserPromptActionsRowProps) {
  return (
    <View className="mt-1 flex-row items-center gap-1 self-end">
      <Pressable
        onPress={onCopy}
        onLongPress={(event) => onTooltip('Copy prompt', event)}
        accessibilityRole="button"
        accessibilityLabel="Copy prompt"
        accessibilityHint="Copies your prompt to clipboard."
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor }}
      >
        <Ionicons name="copy-outline" size={13} color={iconColor} />
      </Pressable>

      <Pressable
        onPress={onEdit}
        onLongPress={(event) => onTooltip('Edit prompt', event)}
        accessibilityRole="button"
        accessibilityLabel="Edit prompt"
        accessibilityHint="Copies this prompt into the input so you can edit and send it as a new message."
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor }}
      >
        <Ionicons name="create-outline" size={13} color={iconColor} />
      </Pressable>
    </View>
  );
}
