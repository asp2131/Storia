import { createOverlayEditorStore, type OverlayEditorStore } from "./overlayEditorStore";

const registry = new Map<string, OverlayEditorStore>();

export function getOverlayEditorStore(pageId: string): OverlayEditorStore {
  let store = registry.get(pageId);
  if (!store) {
    store = createOverlayEditorStore();
    registry.set(pageId, store);
  }
  return store;
}

export function getExistingOverlayEditorStore(pageId: string): OverlayEditorStore | undefined {
  return registry.get(pageId);
}

export function destroyOverlayEditorStore(pageId: string): void {
  registry.delete(pageId);
}

/**
 * Remap overlay stores after page reorder.
 * For each pair of (oldKey, newKey), if they differ, move the store from oldKey to newKey.
 */
export function remapOverlayEditorStores(oldKeys: string[], newKeys: string[]): void {
  if (oldKeys.length !== newKeys.length) {
    console.warn(
      "[overlayEditorRegistry] remapOverlayEditorStores called with mismatched key arrays",
      { oldKeysLength: oldKeys.length, newKeysLength: newKeys.length }
    );
    return;
  }

  // First, collect all stores that need remapping
  const toRemap: Array<{ oldKey: string; newKey: string; store: OverlayEditorStore }> = [];

  for (let i = 0; i < oldKeys.length; i++) {
    if (oldKeys[i] !== newKeys[i]) {
      const store = registry.get(oldKeys[i]);
      if (store) {
        toRemap.push({ oldKey: oldKeys[i], newKey: newKeys[i], store });
      }
    }
  }

  // Remove old entries
  for (const { oldKey } of toRemap) {
    registry.delete(oldKey);
  }

  // Insert under new keys
  for (const { newKey, store } of toRemap) {
    registry.set(newKey, store);
  }
}
