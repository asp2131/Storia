# Hybrid Rust+WASM Book Creator Editor Migration Plan

- **Status:** Draft
- **Owner:** Editor Platform Team
- **Date:** 2026-03-07
- **Scope:** Narration / highlighting / overlay consistency across Book Creator editor surfaces

## 1) Summary

This document defines a migration plan to move the Book Creator editor’s narration, text highlighting, and overlay synchronization pipeline to a hybrid Rust + WASM architecture. The goal is deterministic cross-platform behavior, reduced timing drift, and a single source of truth for tokenization and alignment while preserving existing authoring workflows.

The migration introduces a Rust core for tokenization/alignment primitives and overlay timing normalization, compiled to WASM for browser/editor runtime use and packaged as native Rust for server-side verification and offline tooling. JavaScript orchestration remains initially, then delegates contract-critical logic to the shared core.

## 2) Goals / Non-Goals

### Goals

- Establish a shared canonical contract for text tokens, audio words, alignment I/O, clock conversion, and overlay events.
- Eliminate inconsistent highlighting and overlay timing behavior across editor modes and preview surfaces.
- Reduce narration drift and token mismatches through deterministic tokenization and stable IDs/remap rules.
- Enable parity validation between browser (WASM) and backend/offline (native Rust) execution.
- Provide staged rollout controls and hard fallback semantics.

### Non-Goals

- Replacing all editor business logic with Rust in this migration.
- Redesigning author-facing narration UX.
- Rebuilding media ingestion/transcoding pipeline.
- Introducing new overlay feature types beyond current product roadmap needs.

## 3) Success Metrics

- **Highlight synchronization accuracy:** ≥ 99.5% token-level agreement against golden fixtures.
- **Overlay timing consistency:** p95 drift ≤ 40ms between narration cursor and overlay activation points.
- **Cross-runtime parity:** 100% contract tests pass between WASM and native Rust on CI.
- **Fallback incidence:** < 0.5% sessions trigger hybrid fallback after phased rollout.
- **Editor performance:** no >5% regression in median timeline scrubbing latency.

## 4) Current State

- Tokenization and punctuation handling vary between editor surfaces.
- Alignment payloads are loosely typed and frequently transformed ad hoc.
- Overlay triggers are normalized differently by preview vs export path.
- Multiple timing bases (wall-clock, media time, scrub time) are mixed with implicit assumptions.
- Drift correction is not consistently applied, causing visible highlight jitter.

## 5) Architecture Decisions

1. **Shared Core in Rust**
   - Implement contract-critical functions in Rust: canonical tokenization, alignment mapping, overlay timing normalization, clock conversion.
   - Compile to WASM for browser/editor; ship native Rust crate for backend parity tooling.

2. **Contracts First**
   - Freeze explicit interface contracts (types + invariants) before implementation migration.
   - Validate all adapters against these contracts with strict schema checks.

3. **Compatibility Adapters**
   - Use thin JS/TS adapters at boundaries (UI model, API DTOs, persistence format).
   - Maintain backward compatibility with legacy persisted projects through adapter layer.

4. **Feature-Flagged Rollout + Hard Fallback**
   - Use progressive flags for shadow, read-compare, partial write, and full switch phases.
   - Enforce render-pass atomicity: one engine (legacy or hybrid) per pass.

## 6) Target Architecture

- **Editor UI Layer (TS/React):** unchanged rendering/control flow, consuming normalized outputs.
- **Bridge Layer (TS):** marshals data to/from WASM, owns clock conversion calls and fallback routing.
- **Rust Core (WASM):** tokenization, alignment transformation, overlay normalization, deterministic IDs/remap.
- **Validation Layer (CI + backend jobs):** native Rust execution against same fixtures to guarantee parity.
- **Telemetry Layer:** mismatch counters, drift histograms, fallback reason tagging.

Data flow:

1. Text + narration metadata enter bridge.
2. Bridge performs canonical clock conversion and calls Rust/WASM tokenizer + aligner.
3. Normalized alignment output drives highlighting and overlay scheduling.
4. Telemetry records drift, mismatch, and fallback metrics.
5. Optional shadow comparison against legacy outputs during rollout.

## 7) Interface Contracts

```ts
// Clock contract: all engine-internal times are timeline-relative integer ms.
export type TimelineBase = "MEDIA_MS"; // canonical base for hybrid engine

export type ClockConversion = {
  base: TimelineBase;                 // always MEDIA_MS in v1
  mediaOffsetMs: number;              // can be negative
  scrubAnchorMs: number;              // current scrub/playhead media position
  rounding: "HALF_AWAY_FROM_ZERO";   // deterministic rounding for float->int ms
  allowNegativeMs: true;              // allowed pre-clamp in conversion stage
  owner: "bridge";                   // TS bridge is single conversion owner
};

export type SeekEvent = {
  fromMs: number;
  toMs: number;
  reason: "scrub" | "play" | "programmatic";
};
```

```ts
// Canonical token emitted by tokenizer and consumed by aligner/highlighter.
export type Token = {
  id: string;                 // stable id: `${segmentId}:${anchorHash}:${localIndex}`
  segmentId: string;          // logical text segment/paragraph id
  localIndex: number;         // 0-based within identical anchor bucket
  anchorHash: string;         // xxh3_64 over normalized token + bounded context window
  text: string;               // original surface text slice
  normalized: string;         // Unicode NFKC + full casefold (locale-independent)
  startChar: number;          // inclusive UTF-16 index in segment source
  endChar: number;            // exclusive UTF-16 index
  kind: "word" | "punct" | "whitespace" | "symbol";
  language?: string;          // BCP-47 when known
};
```

```ts
// Word-level timing data from ASR or narration timing source.
export type AudioWord = {
  id: string;
  text: string;
  normalized: string;         // Unicode NFKC + full casefold
  startMs: number;            // MEDIA_MS, inclusive
  endMs: number;              // MEDIA_MS, exclusive
  confidence?: number;        // [0..1]
  speaker?: string;
};
```

```ts
export type AlignmentInput = {
  projectId: string;
  pageId: string;
  segmentId: string;
  clock: ClockConversion;
  tokens: Token[];
  audioWords: AudioWord[];
  options?: {
    maxWordGapMs?: number;    // default 400
    allowFuzzy?: boolean;     // default true
    fuzzyThreshold?: number;  // default 0.82
    preservePunctuation?: boolean; // default true
  };
};

export type AlignmentOutput = {
  segmentId: string;
  tokenTimings: Array<{
    tokenId: string;
    startMs: number | null;
    endMs: number | null;
    sourceWordIds: string[];
    confidence: number;
    status: "aligned" | "inferred" | "unaligned";
  }>;
  remap: {
    applied: boolean;
    rulesVersion: "v1";
    unchangedIds: number;
    remappedIds: number;
  };
  stats: {
    alignedCount: number;
    inferredCount: number;
    unalignedCount: number;
    meanConfidence: number;
  };
  warnings: Array<{
    code:
      | "TOKEN_AUDIO_LENGTH_MISMATCH"
      | "LOW_CONFIDENCE_CLUSTER"
      | "NON_MONOTONIC_WORD_TIMES"
      | "EMPTY_INPUT";
    message: string;
  }>;
};
```

```ts
export type OverlayKind =
  | "caption"
  | "highlight"
  | "image"
  | "shape"
  | "callout"
  | "sticker"
  | "emphasis";

export type OverlayAnchor =
  | { type: "token"; tokenId: string }
  | { type: "segment"; segmentId: string }
  | { type: "absolute"; startMs: number; endMs: number };

export type OverlayTiming = {
  startMs: number;
  endMs: number;
  enterMs?: number;
  exitMs?: number;
  source: "authored" | "derived" | "normalized";
};

export type OverlaySpec = {
  id: string;
  kind: OverlayKind;
  anchor: OverlayAnchor;
  timing: OverlayTiming;
  zIndex: number;
  payload: Record<string, unknown>;
  constraints?: {
    clampToSegment?: boolean;
    avoidOverlapGroup?: string;
  };
};

export type OverlayNormalizationInput = {
  segmentId: string;
  clock: ClockConversion;
  overlays: OverlaySpec[];
  alignment: AlignmentOutput;
  segmentStartMs: number;
  segmentEndMs: number;
};

export type OverlayNormalizationOutput = {
  segmentId: string;
  overlays: OverlaySpec[];
  diagnostics: Array<{
    overlayId: string;
    code:
      | "CLAMPED_TO_SEGMENT"
      | "EXPANDED_MIN_DURATION"
      | "ANCHOR_UNRESOLVED"
      | "OVERLAP_ADJUSTED";
    detail: string;
  }>;
};
```

Contract invariants:

- Canonical timeline base is `MEDIA_MS`; conversion is owned by bridge only (single owner, no double conversion).
- Float-to-ms conversion uses `HALF_AWAY_FROM_ZERO`; tie-breaks are deterministic and cross-runtime identical.
- Negative times may exist only pre-normalization; rendering path clamps to segment/page bounds.
- Scrub seeks are explicit `SeekEvent`s; seek does not mutate token IDs, only active cursor state.
- Token IDs remain stable via `anchorHash + localIndex` for unchanged token/context.
- Remap is deterministic on edits: exact anchor match > bounded-context match > monotonic nearest-neighbor; final tie-break by lowest old `startChar`, then lexical token text.
- Unicode normalization is NFKC + locale-independent full casefold for `normalized` fields.
- Alignment output token order matches input token order.
- Overlay normalization is deterministic for identical inputs.

## 8) Phased Milestones

### Phase 0 — Contract Freeze & Fixtures

- Finalize type contracts above in `@editor/contracts`.
- Build golden fixtures (multi-language punctuation, contractions, abbreviations, mixed scripts, Unicode edge cases).
- Add CI parity harness scaffold (JS legacy vs Rust reference).

### Phase 1 — Rust Tokenizer in Shadow Mode

- Implement canonical tokenizer + stable ID generation/remap in Rust.
- Compile and load WASM in editor behind flag.
- Run shadow comparison only; UI continues using legacy tokenizer output.
- Emit mismatch telemetry with segment/token diffs.

### Phase 2 — Alignment Core Migration

- Implement Rust alignment mapping with deterministic inference rules.
- Enable read-compare path in internal/beta cohorts.
- Use Rust output for diagnostics only; rendering remains legacy.

### Phase 3 — Overlay Normalization Migration

- Implement overlay normalization + clock conversion checks in Rust core.
- Shadow and compare overlay activation timelines.
- Add mismatch budget alerts tied to p95 drift.

### Phase 4 — Hybrid Rendering Switch

- Switch highlighting + overlay scheduling to Rust/WASM outputs for flagged cohorts.
- Enforce one-engine-per-render-pass (no mixed legacy+hybrid outputs in a pass).
- Keep fallback to legacy on contract violation or runtime capability failure.
- Enable dual-write of alignment artifacts for auditing.

### Phase 5 — Default On + Legacy Decommission

- Make hybrid path default.
- Retain kill switch and read-only legacy comparator for one release cycle.
- Remove unused legacy normalization code after stability SLOs are met.

## 9) Rollout Strategy

Feature flags (progressive order):

- `editor_hybrid_contract_validation` (shadow comparisons + telemetry only)
- `editor_hybrid_tokenizer_read` (Rust tokenizer read path)
- `editor_hybrid_alignment_read` (Rust alignment read/diagnostics)
- `editor_hybrid_overlay_read` (Rust overlay normalization read path)
- `editor_hybrid_render_write` (Rust outputs drive rendering/scheduling)
- `editor_hybrid_dual_write_artifacts` (store legacy + hybrid artifacts)
- `editor_hybrid_default_on` (global default)
- `editor_hybrid_kill_switch` (global forced fallback)

Fallback semantics (hard rules):

- **Scope:** fallback can trigger at `segment`, `page`, or `session` scope.
- **Escalation:** 2 segment fallbacks on one page within 60s escalates to page fallback; 2 page fallbacks within 10m escalates to session fallback.
- **Sticky behavior:** once a scope falls back, it remains legacy for the rest of that scope lifetime (segment until re-tokenize, page until reload, session until editor restart).
- **No mixed pass:** renderer must not compose legacy highlights with hybrid overlays (or inverse) in the same render pass.
- **Mid-pass failure handling:** abort hybrid pass, replay full pass from legacy snapshot, emit `FALLBACK_REPLAY` telemetry.

Cohort progression:

1. Local/dev
2. Internal dogfood
3. 5% beta creators
4. 25% beta creators
5. 100% beta creators
6. 10% GA
7. 50% GA
8. 100% GA

Gate criteria (7 consecutive days unless noted):

- Contract mismatch rate < 0.30% (warn), must be < 0.15% to advance.
- Fallback rate < 0.50% sessions (warn), must be < 0.25% to advance.
- Overlay drift p95 ≤ 40ms, p99 ≤ 75ms.
- Parity failures in CI = 0 for 5 consecutive days.
- No Sev-1/Sev-2 incidents attributable to hybrid path.

Operational alerts:

- **Page-level:** mismatch > 1.0% for 5m (page fallback auto-enable).
- **Fleet-level warn:** fallback > 0.8% sessions for 15m.
- **Fleet-level critical:** fallback > 1.5% sessions for 10m (auto-enable kill switch recommendation).
- **Drift critical:** p95 drift > 60ms for 10m.

## 10) Risks & Mitigations

- **Risk: Token ID churn on minor edits causing overlay detachment**  
  **Mitigation:** anchor-hash IDs with deterministic remap ladder and tie-breakers.

- **Risk: WASM startup overhead on low-end devices**  
  **Mitigation:** lazy initialization, worker offload, warm cache, fallback threshold.

- **Risk: Legacy projects with malformed timing data**  
  **Mitigation:** strict adapter sanitization, diagnostics, auto-clamp normalization.

- **Risk: Divergence between WASM and native Rust builds**  
  **Mitigation:** shared fixtures, deterministic rounding policy, CI parity enforcement.

- **Risk: Mixed-engine visual inconsistencies**  
  **Mitigation:** render-pass atomicity + sticky scoped fallback + replay from legacy snapshot.

## 11) Testing & Validation

- **Contract tests:** schema validation and invariants for all I/O types.
- **Golden fixtures:** multilingual tokenization/alignment plus Unicode normalization/casefold edge cases.
- **Parity tests:** WASM vs native Rust exact output comparisons (including rounding ties).
- **Clock tests:** negative offsets, seek storms, scrub jumps, conversion ownership assertions.
- **Remap tests:** insertion/deletion/substitution scenarios with expected stable IDs.
- **Compatibility tests:** legacy persisted project import/export round-trips.
- **Performance tests:** scrub latency, memory footprint, WASM init time.
- **E2E tests:** narration playback with synchronized highlighting and overlays.

Exit criteria for migration completion:

- 30 days with `editor_hybrid_default_on` at 100% GA and SLO compliance.
- Fallback rate < 0.2% and no unresolved high-severity defects.

## 12) Rough Timeline

- **Week 1-2:** Phase 0 (contracts, fixtures, parity harness)
- **Week 3-4:** Phase 1 (tokenizer + stable IDs in shadow)
- **Week 5-7:** Phase 2 (alignment read-compare)
- **Week 8-9:** Phase 3 (overlay normalization + clock conformance)
- **Week 10-11:** Phase 4 (hybrid render/write rollout)
- **Week 12-14:** Phase 5 (default on, stabilization, legacy decommission prep)

Contingency: +2 weeks buffer for parity/performance regressions.

## 13) Ownership

- **Editor Platform Team (Primary):** Rust core, WASM bridge, contracts, flags, fallback controller.
- **Narration Experience Team:** highlighting UX validation, playback integration, author-facing QA.
- **Media Infra Team:** audio timing ingestion quality and offset correctness.
- **QA / Release Engineering:** test matrix, canary verification, staged rollout governance.
- **SRE / Observability:** telemetry pipelines, SLO alerts, incident response playbooks.

## 14) Open Questions

1. Final bounded context window for `anchorHash` (e.g., ±16 vs ±24 code points)?
2. Minimum overlay duration clamp (120ms vs 160ms) for readability/accessibility?
3. Should export pipeline consume hybrid artifacts immediately or lag one release cycle?
4. Dual-write artifact retention period for forensics (14 vs 30 days)?
5. Auto kill-switch policy: recommendation-only or hard automatic trigger at fleet critical thresholds?
