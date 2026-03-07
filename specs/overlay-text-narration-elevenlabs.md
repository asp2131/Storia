# Overlay Text Narration with ElevenLabs

- **Status:** Draft
- **Owner:** Editor Platform Team
- **Date:** 2026-03-07
- **Scope:** Per-overlay narration generation for text overlays with reusable voice references

## 1) Summary

Add an implementation-ready workflow to generate narration audio per selected text overlay using ElevenLabs. Users can choose a reusable voice reference, generate audio, optionally ingest forced alignment, normalize timing to editor `MEDIA_MS`, and attach one narration as current for playback/highlighting while preserving historical attempts.

## 2) User Workflow

1. User selects a text overlay in the editor canvas/timeline.
2. PropertyPanel shows a **Narration** section for selected text overlay.
3. User selects voice (existing `voice_reference`) or creates one.
4. User clicks **Generate narration** (idempotent).
5. Backend calls ElevenLabs using `ELEVENLABS_API_KEY`, stores audio, and creates/updates an `overlay_narration` attempt.
6. If alignment is available/requested, backend normalizes and stores word timings.
7. User attaches a ready attempt as the overlay’s current narration.
8. User can regenerate, switch attached attempt, or detach narration.

## 3) Requirements

- Narration can be generated only for overlays with non-empty text.
- Voice references are reusable across overlays/pages/projects (permission-scoped).
- Generation is async with explicit lifecycle states.
- Exactly one **attached/current** narration per overlay at a time.
- Historical attempts are retained for rollback/audit.
- Optional forced alignment accepted from provider or produced by internal aligner.
- Timing normalization must output integer `MEDIA_MS` with deterministic rounding.
- Regeneration must not affect playback until attach action changes current narration.

## 4) Non-Goals

- Full dubbing/multi-speaker scene orchestration.
- Replacing global page narration pipeline.
- Building a custom TTS model training workflow in v1.

## 5) Data Model Changes

```ts
export type VoiceReference = {
  id: string;
  workspaceId: string;
  name: string;
  provider: "elevenlabs";
  providerVoiceId: string;
  language?: string;          // BCP-47
  labels?: string[];
  isDefault?: boolean;
  createdBy: string;
  createdAt: string;          // ISO8601
  updatedAt: string;          // ISO8601
};

export type OverlayNarrationStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "canceled";

export type OverlayNarration = {
  id: string;
  projectId: string;
  pageId: string;
  overlayId: string;
  sourceText: string;
  sourceTextHash: string;     // detect stale text
  voiceReferenceId: string;
  provider: "elevenlabs";
  providerRequestId?: string;
  idempotencyKey: string;
  status: OverlayNarrationStatus;
  isAttached: boolean;        // true for current narration used by renderer
  supersededById?: string;    // optional lineage pointer
  audioAssetId?: string;
  durationMs?: number;
  sampleRateHz?: number;
  alignmentAssetId?: string;  // normalized word timings JSON
  alignmentMode?: "provider" | "internal" | "none";
  alignmentAnchor?: "OVERLAY_RELATIVE_MS";
  errorCode?: string;
  errorMessage?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
```

Lifecycle + attach semantics:
- **Active set** for generation uniqueness: `{queued, processing}`.
- At most one active-set attempt per `(overlayId, sourceTextHash, voiceReferenceId, model, settingsHash)`.
- `ready/failed/canceled` are terminal and historical.
- Exactly one attached narration per overlay: partial unique index `(overlay_id) WHERE is_attached = true`.
- Attach operation is atomic transaction: set target `isAttached=true`, clear prior attached row.
- Detach clears attached row and overlay renders without per-overlay narration.

Storage/indexing:
- Unique active-set key as above.
- Partial unique index for attached narration.
- Indexes: `overlay_id`, `voice_reference_id`, `project_id/page_id`, `status`, `created_at`.

## 6) API Endpoints

```http
POST   /v1/voice-references
GET    /v1/voice-references?workspaceId=...
PATCH  /v1/voice-references/:id
DELETE /v1/voice-references/:id

POST   /v1/overlays/:overlayId/narrations/generate
GET    /v1/overlays/:overlayId/narrations
GET    /v1/overlay-narrations/:id
POST   /v1/overlay-narrations/:id/retry
POST   /v1/overlay-narrations/:id/attach
POST   /v1/overlay-narrations/:id/detach
```

Generate request:

```json
{
  "voiceReferenceId": "vr_123",
  "textOverride": "optional",
  "includeAlignment": true,
  "model": "eleven_multilingual_v2",
  "stability": 0.5,
  "similarityBoost": 0.75,
  "idempotencyKey": "uuid-v4"
}
```

Generate idempotency behavior:
- Same idempotency key + same payload within 10 minutes returns existing `202` job/narration.
- Same semantic request without key dedupes via active-set unique key.
- Duplicate Generate clicks should not create parallel active attempts.

## 7) ElevenLabs Integration (ELEVENLABS_API_KEY)

- Server-side only access to `ELEVENLABS_API_KEY` (never exposed to client).
- Use provider voice id from `voice_references.providerVoiceId`.
- Flow:
  1. Submit TTS request with selected model/voice/settings.
  2. Stream/download audio bytes.
  3. Persist audio as internal `audioAssetId`.
  4. Persist provider request metadata for traceability.
- Retries: exponential backoff on 429/5xx, capped attempts (e.g., 3).
- Timeouts and idempotency key per generate request.

## 8) Optional Forced Alignment + Normalization

- If provider returns alignment, ingest and normalize.
- If provider does not return alignment and `includeAlignment=true`, run internal aligner.
- Canonical anchor is **overlay-relative time** (`OVERLAY_RELATIVE_MS`), where `0` = overlay start.
- Store normalized words as overlay-relative integer ms.

Anchoring/conversion rules:
- Generation-time absolute conversion: `absMs = overlayStartMs_at_gen + relMs`.
- Renderer canonical conversion at playback: `absMs = currentOverlayStartMs + relMs`.
- If overlay timing is edited after generation:
  - Move overlay start/end: alignment remains valid (re-anchored by current start).
  - Trim end earlier than narration duration: playback/highlights clamp to overlay end.
  - Text changes (`sourceTextHash` mismatch): mark narration `stale` in UI; keep attached until user regenerates or detaches.
- Normalization rules:
  - Convert all times to integer ms (half-away-from-zero).
  - Clamp negative relative times to `0` during normalization.
  - Ensure monotonic `startMs <= endMs`; repair tiny inversions.
- Store normalized alignment JSON at `alignmentAssetId` with `alignmentAnchor=OVERLAY_RELATIVE_MS`.

## 9) UI Changes (PropertyPanel)

For selected text overlay, add **Narration** block:
- Voice selector + “Manage voices”.
- Generate/regenerate button.
- Status pill (`queued/processing/ready/failed/canceled`).
- Audio preview controls when ready.
- “Attach” / “Detach narration” and indication of current attached attempt.
- Optional toggle: “Generate word alignment”.
- Inline errors with retry action.

UI behavior:
- Hide Narration block for non-text overlays.
- Disable generate on empty/whitespace-only text.
- Warn when overlay text changed after generation (`sourceTextHash` mismatch).
- Duplicate clicks show “already generating” state (no extra attempts).

Error code taxonomy (UI-facing):
- `NARRATION_VALIDATION_ERROR` (bad text/settings)
- `NARRATION_AUTH_FORBIDDEN` (permissions)
- `NARRATION_RATE_LIMITED` (429)
- `NARRATION_PROVIDER_UNAVAILABLE` (provider 5xx/timeout)
- `NARRATION_ALIGNMENT_FAILED` (audio ok, alignment failed)
- `NARRATION_STORAGE_FAILED` (asset persistence)
- `NARRATION_CONFLICT_ACTIVE_JOB` (duplicate active generation)

## 10) Validation & Security

- Validate overlay ownership and edit permissions before generation/attach.
- Enforce max text length and reject unsupported control chars.
- Sanitize user-provided voice names/labels.
- Secrets: `ELEVENLABS_API_KEY` in server env/secret manager only.
- Audit log events: voice create/update/delete, generation, attach/detach, retry.
- Rate limits per workspace/user to prevent abuse.

## 11) Rollout Strategy (Feature Flags)

- `overlay_narration_enabled` (master)
- `overlay_narration_voice_references`
- `overlay_narration_elevenlabs_generation`
- `overlay_narration_forced_alignment`
- `overlay_narration_property_panel_ui`

Phased rollout:
1. Internal dev + dogfood.
2. 10% beta workspaces.
3. 50% beta workspaces.
4. 100% beta, then GA.

Kill switch: disable generation endpoint while preserving playback for already attached narrations.

## 12) Acceptance Criteria

- User can generate narration for selected text overlay using reusable voice references.
- Duplicate Generate clicks do not create duplicate active jobs.
- Lifecycle states and current attached narration are correctly represented in UI/API.
- Exactly one attached narration per overlay is enforced.
- Ready narration can be previewed and attached/detached without page reload.
- Alignment (when enabled) is stored as overlay-relative ms and correctly re-anchors if overlay timing shifts.
- Failed generations expose actionable error code + retry.
- API + permission checks prevent cross-workspace access.
- No client exposure of `ELEVENLABS_API_KEY`.
- Feature flags can fully disable generation path without breaking existing attached playback.
