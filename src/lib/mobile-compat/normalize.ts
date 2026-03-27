/**
 * Text shadow normalization utilities for web/mobile compatibility.
 *
 * The web overlay editor uses `offsetX`/`offsetY` for text shadows,
 * but Flutter expects `x`/`y`. These utilities normalize at save boundaries
 * so the persisted JSON always uses the canonical mobile-compatible form.
 */

export interface MobileTextShadow {
  color: string;
  x: number;
  y: number;
  blur: number;
}

/**
 * Normalize a text shadow to mobile-compatible form.
 * Accepts both legacy (offsetX/offsetY) and canonical (x/y) inputs.
 */
export function normalizeTextShadow(
  shadow: Record<string, unknown>
): MobileTextShadow {
  return {
    color: String(shadow.color ?? "#000000"),
    x: Number(shadow.x ?? shadow.offsetX ?? 0),
    y: Number(shadow.y ?? shadow.offsetY ?? 0),
    blur: Number(shadow.blur ?? 0),
  };
}

/**
 * Normalize an entire overlay config's shadows to mobile-compatible form.
 * Returns a new config object (does not mutate input).
 */
export function normalizeOverlayForMobile(overlay: {
  version: number;
  elements: Array<Record<string, unknown>>;
}): { version: number; elements: Array<Record<string, unknown>> } {
  return {
    version: overlay.version,
    elements: overlay.elements.map((element) => {
      if (
        element.shadow != null &&
        typeof element.shadow === "object" &&
        !Array.isArray(element.shadow)
      ) {
        return {
          ...element,
          shadow: normalizeTextShadow(
            element.shadow as Record<string, unknown>
          ),
        };
      }
      return { ...element };
    }),
  };
}
