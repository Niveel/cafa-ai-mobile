const drawerRestoreTargets = new Set<string>();

export function markDrawerShouldReopenOnFocus(routeName?: string | null) {
  if (!routeName) return;
  drawerRestoreTargets.add(routeName);
}

export function consumeDrawerShouldReopenOnFocus(routeName?: string | null) {
  if (!routeName) return false;
  if (!drawerRestoreTargets.has(routeName)) return false;
  drawerRestoreTargets.delete(routeName);
  return true;
}
