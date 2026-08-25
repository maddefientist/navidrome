# Navidrome Evolution

This repository is a public experimental downstream fork of
[Navidrome](https://github.com/navidrome/navidrome), the GPL-3.0 personal music
server. It is not an official Navidrome release and is not affiliated with or
endorsed by the upstream project.

The goal is not to reproduce a commercial streaming catalog. It is to make an
owned music library feel faster, more expressive, and easier to rediscover while
preserving Navidrome's local-first character and broad client compatibility.

## What is working on the evolution branch

- A redesigned **Listen Now** home with a prominent library shuffle action.
- Art-forward Recently Added, Recently Played, Favourites, and local discovery rails.
- A deterministic local mix engine with reproducible seeds and bounded results.
- An authenticated mix-preview API that does not mutate playback state.
- Preview, retry, cancel, and explicit confirmation before replacing the queue.
- Selected-library access filtering and missing or duplicate candidate removal.
- A modernized dark visual system and docked player presentation.
- HTTP-LAN-safe shuffle and cache behavior for typical self-hosted deployments.

## Planned product layers

1. **Mix intelligence** — Rediscover, Familiar + Fresh, Instant Mix, continuation,
   history weighting, exclusions, and understandable selection reasons.
2. **Discovery** — optional ListenBrainz and sonic recommendations, local matching,
   provider health, and a separate inbox for music not present in the library.
3. **Listening experience** — richer history and resume surfaces, lyrics, and an
   accessible visualizer built on a shared Web Audio graph.
4. **Optional local AI** — Ollama may translate natural language into a validated
   mix specification or explain deterministic results. It will not choose arbitrary
   media IDs, stream audio, or silently change queues.
5. **Optional acquisition** — Lidarr integration will be server-side,
   preview-before-confirm, identifier-driven, and never an automatic download path.

The detailed architecture, constraints, and exit gates are maintained in
[PRODUCT_SCOPE.md](PRODUCT_SCOPE.md).

## Privacy and safety boundaries

- Playback and local mixing remain useful when every optional provider is offline.
- Provider credentials stay server-side and are never committed or exposed to the UI.
- External recommendations cannot enter a queue until they resolve to accessible
  local media.
- Private library metadata, listening history, deployment addresses, and production
  databases do not belong in this public repository.
- Public screenshots must use a synthetic or explicitly publishable demo library.
- Acquisition, queue replacement, and other consequential actions require clear
  user confirmation.

## Development status

The active work is intentionally published as a draft review branch. It is suitable
for source review and isolated staging, not as a drop-in production release. Test,
security, performance, migration, rendered-UI, and rollback evidence are recorded
before a release candidate is promoted.

The fork retains upstream copyright notices and the GPL-3.0 license. Changes intended
for upstream contribution should follow Navidrome's contribution requirements and be
submitted as focused, independently useful patches.
