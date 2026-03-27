import rawContract from "../../../specs/mobile-compat-contract.json";

export type MobileCompatSeverity = "pass" | "warn" | "fail";

export type HighlightRole = "tapped" | "spoken" | "narrationActive";

export interface CustomFontMapping {
  flutterFamily: string;
  assetPath: string;
  fallbackFamily: string;
}

export interface MobileCompatIssue {
  code: string;
  severity: MobileCompatSeverity;
  message: string;
  pageNumber: number;
  fieldPath: string;
}

type MobileCompatContract = typeof rawContract;

const contract = rawContract as MobileCompatContract;

export function getMobileCompatContract(): MobileCompatContract {
  return contract;
}

export function getMobileCompatContractVersion(): string {
  return contract.version;
}

export function isPublishBlockingSeverity(
  severity: MobileCompatSeverity
): boolean {
  return contract.policy.publishGate.blockOn.includes(severity);
}

export function getHighlightToken(role: HighlightRole): string {
  return contract.highlight.tokens[role];
}

export function getHighlightPrecedence(): readonly string[] {
  return contract.highlight.precedence;
}

export function getBuiltinMobileFonts(): readonly string[] {
  return contract.fonts.builtinSupported;
}

export function isBuiltinMobileFont(fontFamily: string): boolean {
  return contract.fonts.builtinSupported.includes(fontFamily);
}

export function requiresCustomFontMapping(fontFamily: string): boolean {
  return !isBuiltinMobileFont(fontFamily) && contract.fonts.customFonts.allowed;
}

/**
 * Validate a custom font mapping against the mobile compatibility contract.
 * Returns issue(s) if the font is custom and missing required mapping metadata.
 */
export function validateCustomFontMapping(
  fontFamily: string,
  mapping: CustomFontMapping | null | undefined,
  pageNumber: number,
  fieldPath = "overlay.elements[*].fontFamily"
): MobileCompatIssue[] {
  if (!requiresCustomFontMapping(fontFamily)) {
    return [];
  }

  if (!mapping || !mapping.flutterFamily || !mapping.assetPath || !mapping.fallbackFamily) {
    return [
      {
        code: "CUSTOM_FONT_MAPPING_REQUIRED",
        severity: contract.fonts.customFonts
          .missingMappingSeverity as MobileCompatSeverity,
        message:
          `Custom font \"${fontFamily}\" requires Flutter asset registration and fallback mapping before publish.`,
        pageNumber,
        fieldPath,
      },
    ];
  }

  return [];
}

export function getActiveWordAlgorithmId(): string {
  return contract.timestamps.activeWordIndexAlgorithm;
}

export function getSoundscapeRangePrecedence(): string {
  return contract.audio.soundscapeRangePrecedence;
}

export function isFlutterPreviewRequiredBeforePublish(): boolean {
  return contract.preview.flutterPreviewRequiredBeforePublish;
}
