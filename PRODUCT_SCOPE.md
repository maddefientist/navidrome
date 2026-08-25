# Navidrome Product and Technical Scope

Status: active downstream evolution, Phase 1

Updated: 2026-08-25

Upstream repository: `navidrome/navidrome`

Audited upstream master: `dff9e47c2ea53e040ddac2fcc36f4563e53053be`

Latest stable release checked: `v0.63.2` (`be10f89c117925fabf10394b8d2962a370108b97`)

This is a public downstream design and engineering document. It deliberately
contains no deployment addresses, private library metadata, credentials, or
operator-specific infrastructure details.

## Current implementation state

The evolution branch currently includes:

- a local-first **Listen Now** home with a prominent library shuffle action and
  art-forward Recently Added, Recently Played, Favourites, and local discovery rails;
- a deterministic `core/mix` engine with bounded selection, duplicate removal,
  artist spacing, and explicit degradation metadata;
- an authenticated, non-mutating `POST /api/mix/preview` endpoint;
- preview-before-play library shuffle, retry and cancellation handling, selected
  library filtering, and safe fallback seed generation on HTTP LAN origins;
- a modernized dark visual system and docked player presentation without changing
  the underlying playback or queue contracts.

ListenBrainz enrichment, a Discovery Inbox, sonic and mood layers, advanced history,
lyrics presentation, Lidarr handoff, visualizers, and Ollama routing remain roadmap
items. They are not represented as connected or production-ready today.

## Product decision

Do not build a Spotify or Apple Music clone. Build a sovereign music intelligence layer for a library the user owns.

The durable product advantages are:

1. Complete-catalog integrity: mixes operate on the user's actual library and say when a candidate is missing.
2. Inspectable personalization: every selected track can explain which local signal, rule, similarity source, or provider contributed it.
3. Optional intelligence: external discovery, sonic analysis, Lidarr, and Ollama enhance the experience but never become playback dependencies.

The first product milestone should make shuffle understandable and mixes useful. It should not begin with a framework rewrite, a visualizer, or an LLM chat surface.

## Provenance and assumptions

- The `master` branch is explicitly described upstream as potentially unstable. It is 604 files and roughly 49,000 added lines beyond `v0.63.2` at this snapshot.
- Most important discovery primitives are already present in `v0.63.2`: smart playlists, similar-song agents, Last.fm, ListenBrainz, Deezer, the WASM plugin system, and sonic similarity.
- Some fallback logic and compatibility surfaces are more developed on current `master`; they are not treated as stable-release guarantees.
- “Lidar” is assumed to mean **Lidarr**, the music collection manager. If physical LiDAR was intended, that is a different product requirement.
- `core/agents` is a metadata and discovery-provider composition layer. It is not an LLM subsystem.

## What is already built

| Capability                 | Verified state                                                                                                                                                     | Product implication                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Shuffle All                | The UI requests one server-randomized page capped at 500 tracks in `ui/src/common/ShuffleAllButton.jsx`.                                                           | The main gap is semantics, discoverability, session continuity, and transparency—not the existence of random playback. |
| Client shuffle             | `ui/src/actions/player.js` and `ui/src/common/playbackActions.js` contain separate randomization paths.                                                            | Consolidate behavior before adding modes.                                                                              |
| Instant Mix                | The UI calls `getSimilarSongs2`; the backend can use track, album, and artist similarity providers.                                                                | Reuse it as a candidate source, not as a second mix engine.                                                            |
| Smart playlists            | The criteria system supports play counts, last-played time, ratings, loved state, BPM, dates, tags, roles, random order, percentage limits, and library filtering. | Named offline mix presets can compile into existing criteria rather than bespoke SQL.                                  |
| Sonic similarity           | `core/sonic` and the `SonicSimilarity` plugin capability exist in stable.                                                                                          | Content-based similarity is already an optional extension point.                                                       |
| External discovery         | Last.fm, ListenBrainz, and Deezer adapters exist. ListenBrainz Labs supplies similar-artist and similar-recording data.                                            | Improve matching, source health, and presentation before adding more providers.                                        |
| External-to-local matching | `core/matcher` resolves candidates by identifiers and conservative fuzzy matching and excludes missing files.                                                      | All discovery sources should pass through this boundary.                                                               |
| Plugin isolation           | WASM plugins expose typed capabilities. HTTP access uses explicit host allowlists; private and loopback access is blocked without one.                             | A local Ollama or Lidarr connection requires an explicit, reviewable permission boundary.                              |
| Queue persistence          | Native and Subsonic play-queue APIs persist per-user queues.                                                                                                       | Mixes should materialize into the existing queue instead of inventing playback state.                                  |
| Multi-library access       | Repository queries apply per-user library filtering.                                                                                                               | Mix candidates must be selected under the caller's context and external/plugin matches rechecked.                      |
| UI foundation              | React 17, react-admin 3, Material UI 4, Redux, redux-saga, Vite, PWA tooling, and `navidrome-music-player` 4.25.4.                                                 | Local improvements are realistic; a wholesale UI rewrite is not a prerequisite.                                        |
| Visualizer                 | No analyzer or visualizer implementation was found. ReplayGain conditionally creates a Web Audio graph.                                                            | A visualizer requires a shared audio-graph abstraction first.                                                          |
| Ollama                     | No Ollama, OpenAI, prompt, model, or inference implementation was found.                                                                                           | Treat it as an optional new adapter, not as an extension of `core/agents`.                                             |
| Lidarr                     | No Lidarr implementation was found.                                                                                                                                | Treat acquisition as a separate, confirmed workflow after discovery—not part of mix generation.                        |

## Problems worth solving

### 1. Shuffle is technically present but conceptually fragmented

The UI currently presents different operations with the same shuffle language:

- fetch a random server-side sample;
- shuffle a selected client-side collection;
- use the player's continuous shuffle mode;
- create an artist “radio” through similar songs.

These need distinct names and predictable effects:

- **Shuffle this list**: reshuffle only the visible/selected collection.
- **Shuffle library**: start a server-backed, reproducible session across the accessible library.
- **Instant mix**: build similar tracks from one or more seeds.
- **Play mode: shuffle**: choose how the current queue advances.

The 500-track cap is acceptable as a playback window, but it must not be presented as if all tracks were loaded. A production design should use a seeded, refillable session instead of pushing an entire large library into the browser.

### 2. Mix quality needs a deterministic core

Create a new `core/mix` package with a small contract:

```text
MixSpec
  user and accessible libraries
  mode
  seed tracks, albums, artists, playlists, or genres
  requested length
  reproducibility seed
  explicit constraints

MixResult
  ordered local media IDs
  reason codes per track
  source contribution counts
  degraded or unavailable sources
  continuation token for refill
```

Candidate sources, in order of reliability:

1. Local criteria and per-user listening state.
2. Existing local similar-song and smart-playlist logic.
3. Optional sonic-similarity plugin.
4. Optional external agents, resolved through `core/matcher`.
5. Optional Ollama interpretation of user intent—not track selection.

The engine should perform deduplication, artist and album spacing, recent-repeat suppression, library access checks, deterministic tie-breaking, and bounded top-up. External failures should produce a locally generated mix with degradation metadata, not an error that blocks playback.

### 3. Discovery should distinguish owned from missing music

Discovery results should be separated into:

- **Playable now**: candidates matched to accessible local media IDs.
- **Not in library**: unmatched candidates with provider and identifier evidence.

The second group belongs in a **Discovery Inbox**, not in the playback queue. A future Lidarr handoff should require explicit confirmation and should be idempotent by MusicBrainz identifier where available. It must never silently download content or expose the Lidarr API key to the browser.

### 4. The UI should feel immediate without pretending network work is instant

Use immediate local state for button feedback, queue previews, and reversible queue changes. Keep server reconciliation explicit:

- show a pressed/loading state within one animation frame;
- cancel superseded mix requests;
- preview the first tracks before replacing a queue;
- roll back optimistic changes on failure;
- preserve current playback until the replacement queue is valid;
- label why a track was selected;
- honor reduced-motion preferences;
- pause visual work when the page is hidden.

Avoid a React/MUI migration until profiling proves the current stack prevents a specific interaction target.

## Recommended mix modes

Start with four modes whose inputs already exist:

1. **Pure Shuffle** — unbiased local random selection with a reproducibility seed and session refill.
2. **Rediscover** — favors accessible tracks not played recently, then unseen or low-play-count tracks.
3. **Familiar + Fresh** — a configurable blend of loved/high-rated material and underplayed tracks.
4. **Instant Mix** — seed-based similarity using local, sonic, and external tiers with clear fallback reporting.

Add only after metadata coverage is measured:

- **Flow** — BPM, genre, and sonic continuity.
- **Deep Cuts** — album and artist catalog exploration with popular tracks suppressed.
- **Era Journey** — chronological progression with spacing controls.
- **Focus / Energy** — only if BPM/mood/sonic coverage is sufficient; do not infer mood from titles with an LLM.

Every mode should expose lightweight tuning:

- familiar ↔ adventurous;
- strict seed similarity ↔ broader exploration;
- session length;
- allow or exclude explicit tracks, genres, artists, and recently played material.

## Ollama boundary

Ollama can be useful for two bounded tasks:

1. Convert natural language such as “upbeat 2010s tracks I have not heard lately” into a strict `MixSpec` JSON document.
2. Explain a completed deterministic mix using the engine's reason codes.

Ollama must not:

- sit on play, pause, seek, queue-next, or audio streaming paths;
- invent track IDs or bypass `core/matcher`;
- make downloads or Lidarr changes;
- receive another user's library or listening history;
- silently use a remote Ollama endpoint;
- mutate a queue without a validated preview or explicit user action.

Use Ollama structured output with a JSON schema, then validate the result again server-side. A syntactically valid model response is still untrusted input.

Ship only if all of these gates pass:

- disabled by default and explicitly configured;
- local deterministic mix remains fully functional when Ollama is offline;
- warm p95 intent-parsing latency is at most two seconds on the target host;
- every returned selector validates against the allowed schema and caller permissions;
- zero model-proposed media IDs bypass server lookup;
- an offline evaluation shows a measurable improvement over non-LLM intent controls;
- disabling the feature leaves no queue or configuration residue.

## Lidarr boundary

Lidarr is acquisition infrastructure, not a recommendation engine. Introduce it only after the Discovery Inbox exists.

The first supported action should be **Send to Lidarr preview**:

1. Resolve the candidate to a MusicBrainz artist or album identifier.
2. Show whether Lidarr already knows it.
3. Show the selected root folder, metadata profile, and quality profile.
4. Require confirmation.
5. Send one idempotent server-side request.
6. Report Lidarr's command status without claiming a download or import succeeded.

Secrets stay server-side, are redacted from logs, and are never placed in plugin output or frontend state.

## Visualizer decision

Defer visualizers until the player has one shared Web Audio graph. `Player.jsx` currently creates a media-element source for ReplayGain only under certain settings; attempting to create a second source for a visualizer is unsafe.

When implemented, use an opt-in analyzer node in the shared graph and enforce:

- reduced-motion support;
- hidden-tab suspension;
- a frame-rate cap;
- no playback failure if Web Audio initialization fails;
- a simple spectrum/waveform first, not a GPU-heavy product pillar;
- mobile battery and CPU budgets measured on real devices.

## Delivery phases

### Phase 0 — production baseline

- Create a release-based development line from `v0.63.2`.
- Keep a separate upstream-radar branch for master changes.
- Record which master-only improvements are intentionally backported.
- Run the existing Go, plugin-generator, UI, lint, formatting, migration, and race-test gates.
- Capture a representative anonymized library fixture and latency baseline.

Exit gate: reproducible build and tests from a pinned release revision, with no application feature changes.

### Phase 1 — honest shuffle and first deterministic mix

- Add `core/mix` contracts and a deterministic local engine.
- Add one native preview endpoint; do not add a Subsonic extension yet.
- Implement Pure Shuffle, Rediscover, Familiar + Fresh, and Instant Mix.
- Consolidate UI shuffle labels and actions.
- Preview before replacing the active queue.
- Display reason and degradation metadata.

Exit gates:

- identical user, library snapshot, spec, and seed return the same ordered IDs;
- no missing or inaccessible media can enter a result;
- external and sonic providers can fail without preventing a local result;
- repeated artists and albums obey configured spacing when the candidate pool permits it;
- a 100-track mix meets the agreed p95 latency budget on the target production library;
- UI keyboard, mobile, and reduced-motion tests pass.

### Phase 2 — feedback and session intelligence

- Add per-user “less like this” and “exclude from mixes” controls.
- Incorporate skips, completions, ratings, loved state, and recency with documented weights.
- Preserve mix continuation and refill across devices through existing queue persistence.
- Add “Save as smart playlist” where the mode can be expressed declaratively.

Exit gate: replayable offline evaluation plus an opt-in live comparison shows lower early-skip rate than Pure Shuffle without reducing catalog diversity.

### Phase 3 — discovery inbox and sonic enrichment

- Surface provider contribution and local match ratios.
- Integrate sonic similarity as a first-class optional tier.
- Add a Discovery Inbox for unmatched external recommendations.
- Add provider health, timeout, cache, and rate-limit diagnostics.

Exit gate: provider outage, malformed results, and incomplete identifiers fail closed and never produce unplayable queue entries.

### Phase 4 — optional Ollama assistant

- Add natural-language-to-`MixSpec` preview.
- Add engine-grounded explanations.
- Keep the model adapter isolated and replaceable.

Exit gate: all Ollama gates above pass against the exact production model and host route.

### Phase 5 — explicit Lidarr handoff and restrained visual polish

- Add confirmed Lidarr preview and dispatch.
- Refactor to a shared audio graph.
- Add one accessible, resource-bounded visualizer.

Exit gate: no automatic acquisition, no credential exposure, and no playback regression when either optional feature is unavailable.

## First implementation slice

The first code slice should be one vertical path, not a broad redesign:

**Seeded Library Shuffle Preview**

- `core/mix`: `MixSpec`, `MixResult`, deterministic candidate ordering, recent-repeat exclusion, and artist spacing.
- Native API: preview 100 accessible local tracks and return reason codes plus a continuation token.
- UI: replace the ambiguous global Shuffle button with a short menu and preview state.
- Queue: commit only after a valid result is returned.
- Tests: determinism, access control, missing-track exclusion, insufficient-candidate behavior, cancellation, and UI rollback.

This slice proves the architectural seam, improves the product immediately, and does not depend on external APIs, sonic plugins, Lidarr, or Ollama.

## Production and upstream rules

- Preserve Navidrome's GPLv3 license obligations for any distributed fork.
- Follow upstream's issue-first contribution process, DCO sign-off, conventional commits, and focused pull requests when proposing changes upstream.
- Prefer new packages and thin registration points to minimize rebase conflicts.
- Never log API keys, access tokens, prompts containing private library history, or full external response bodies.
- Apply per-user library filtering before scoring and again after plugin/external resolution.
- Bound provider requests, candidate counts, caches, and model timeouts.
- Add feature flags and a deterministic local fallback for every optional subsystem.
- Do not call a container healthy, an HTTP response successful, or a model receipt valid proof of usable mixes; run end-to-end playback and permission checks.

## Downstream development policy

- Track stable upstream releases and keep upstream integrations reviewable rather
  than performing an unbounded framework rewrite.
- Keep the web experience as the first product surface; consider OpenSubsonic
  extensions only after the server contracts stabilize.
- Measure mix latency and memory against anonymized large-library fixtures and
  isolated staging before any production claim.
- Keep model and provider choices configurable. No external service, acquisition
  tool, or local LLM may become a playback dependency.
- Use bounded changes, isolated review branches, independent verification, and
  explicit rollback for every deployable slice.
