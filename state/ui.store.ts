import { createStore } from './createStore';

type UiState = {
  activeConversationId: string | null;
  drawerSearch: string;
};

export const uiStore = createStore<UiState>({
  activeConversationId: null,
  drawerSearch: '',
});
