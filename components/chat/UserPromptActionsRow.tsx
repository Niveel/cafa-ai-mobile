import { Ionicons } from '@expo/vector-icons';
import { GestureResponderEvent, Pressable, View } from 'react-native';

type UserPromptActionsRowProps = {
  borderColor: string;
  iconColor: string;
  onCopy: () => void;
  onEdit: () => void;
  onTooltip: (label: string, event: GestureResponderEvent) => void;
  labels: {
    copy: string;
    copyHint: string;
    edit: string;
    editHint: string;
  };
};

export function UserPromptActionsRow({
  borderColor,
  iconColor,
  onCopy,
  onEdit,
  onTooltip,
  labels,
}: UserPromptActionsRowProps) {
  return (
    <View className="mt-1 flex-row items-center gap-1 self-end">
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
        onPress={onEdit}
        onLongPress={(event) => onTooltip(labels.edit, event)}
        accessibilityRole="button"
        accessibilityLabel={labels.edit}
        accessibilityHint={labels.editHint}
        className="h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor }}
      >
        <Ionicons name="create-outline" size={13} color={iconColor} />
      </Pressable>
    </View>
  );
}
