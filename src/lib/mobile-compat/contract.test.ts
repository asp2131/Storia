import { describe, expect, it } from "vitest";
import {
  getActiveWordAlgorithmId,
  getBuiltinMobileFonts,
  getHighlightToken,
  getMobileCompatContractVersion,
  getSoundscapeRangePrecedence,
  isBuiltinMobileFont,
  isFlutterPreviewRequiredBeforePublish,
  isPublishBlockingSeverity,
  validateCustomFontMapping,
} from "@/lib/mobile-compat/contract";

describe("mobile compatibility contract loader", () => {
  it("loads contract version and key policy values", () => {
    expect(getMobileCompatContractVersion()).toBe("1.0.0");
    expect(getSoundscapeRangePrecedence()).toBe("newest_assignment_wins");
    expect(getActiveWordAlgorithmId()).toBe(
      "flutter_text_overlay_utils_computeActiveWordIndex"
    );
  });

  it("exposes highlight tokens", () => {
    expect(getHighlightToken("tapped")).toBe("#8B5CF6");
    expect(getHighlightToken("spoken")).toBe("#FFD54F");
    expect(getHighlightToken("narrationActive")).toBe("#D4EDBC");
  });

  it("enforces publish gate severity policy", () => {
    expect(isPublishBlockingSeverity("fail")).toBe(true);
    expect(isPublishBlockingSeverity("warn")).toBe(false);
    expect(isPublishBlockingSeverity("pass")).toBe(false);
  });

  it("recognizes builtin font support", () => {
    const builtins = getBuiltinMobileFonts();
    expect(builtins.length).toBeGreaterThan(0);
    expect(isBuiltinMobileFont("Inter")).toBe(true);
    expect(isBuiltinMobileFont("Some Custom Font")).toBe(false);
  });

  it("requires custom font mapping metadata for custom fonts", () => {
    const issues = validateCustomFontMapping(
      "My Custom Font",
      null,
      3,
      "overlay.elements[1].fontFamily"
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("fail");
    expect(issues[0].code).toBe("CUSTOM_FONT_MAPPING_REQUIRED");
  });

  it("passes custom font validation when mapping metadata is present", () => {
    const issues = validateCustomFontMapping(
      "My Custom Font",
      {
        flutterFamily: "MyCustomFlutterFamily",
        assetPath: "assets/fonts/MyCustom.ttf",
        fallbackFamily: "Inter",
      },
      2
    );

    expect(issues).toHaveLength(0);
  });

  it("enforces required Flutter preview policy", () => {
    expect(isFlutterPreviewRequiredBeforePublish()).toBe(true);
  });
});
