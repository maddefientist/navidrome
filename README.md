# Navidrome Evolution

This repository is an **experimental downstream fork** of
[Navidrome](https://github.com/navidrome/navidrome). It is not an official
Navidrome release and is not affiliated with or endorsed by the upstream project.

The active evolution branch adds a local-first Listen Now home, inspectable
deterministic library mixes, preview-before-play shuffle, and a more immediate
art-forward interface. ListenBrainz enrichment, a Discovery Inbox, advanced
history, lyrics presentation, Lidarr handoff, visualizers, and Ollama routing are
planned layers; they are not connected features today.

- [Current capabilities, roadmap, and privacy boundaries](EVOLUTION.md)
- [Detailed product and technical scope](PRODUCT_SCOPE.md)
- [Draft evolution review](https://github.com/maddefientist/navidrome/pull/1)
- [Official upstream Navidrome repository](https://github.com/navidrome/navidrome)

This branch is published for source review and isolated staging. There is no
supported evolution binary or production release yet. Please report fork-specific
problems in this fork's [issue tracker](https://github.com/maddefientist/navidrome/issues),
not to the upstream Navidrome project.

## Upstream foundation

Navidrome is an open-source web music collection server and streamer. This fork
retains the upstream GPL-3.0 license, copyright notices, server architecture,
Subsonic compatibility, and core feature set while developing the downstream
experience described above.

For the official stable product, releases, documentation, demo, community, and
hosted offerings, use [navidrome.org](https://www.navidrome.org/) or the
[official upstream repository](https://github.com/navidrome/navidrome). Those
resources describe upstream Navidrome, not this experimental fork.

## Upstream feature foundation

- Handles very **large music collections**
- Streams virtually **any audio format** available
- Reads and uses all your beautifully curated **metadata**
- Great support for **compilations** (Various Artists albums) and **box sets** (multi-disc albums)
- **Multi-user**, each user has their own play counts, playlists, favourites, etc...
- Very **low resource usage**
- **Multi-platform**, runs on macOS, Linux and Windows. **Docker** images are also provided
- Ready to use binaries for all major platforms, including **Raspberry Pi**
- Automatically **monitors your library** for changes, importing new files and reloading new metadata
- Supports **lyrics** from sidecar .ttml, .yaml/.yml Lyricsfile, .elrc, .lrc, .srt, .txt files and embedded TTML, Enhanced LRC, LRC, SRT, and plain-text tags (via `lyricspriority`)
- **Themeable**, modern and responsive **Web interface** based on [Material UI](https://material-ui.com)
- **Compatible** with all Subsonic/Madsonic/Airsonic [clients](https://www.navidrome.org/docs/overview/#apps)
- **Transcoding** on the fly. Can be set per user/player. **Opus encoding is supported**
- Translated to **various languages**

## Upstream translations

Navidrome uses [POEditor](https://poeditor.com/) for translations, and we are always looking
for [more contributors](https://www.navidrome.org/docs/developers/translations/)

<a href="https://poeditor.com/"> 
<img height="32" src="https://github.com/user-attachments/assets/c19b1d2b-01e1-4682-a007-12356c42147c">
</a>

## Upstream documentation

All documentation can be found in the project's website: https://www.navidrome.org/docs.
Here are some useful direct links:

- [Overview](https://www.navidrome.org/docs/overview/)
- [Installation](https://www.navidrome.org/docs/installation/)
  - [Docker](https://www.navidrome.org/docs/installation/docker/)
  - [Binaries](https://www.navidrome.org/docs/installation/pre-built-binaries/)
  - [Build from source](https://www.navidrome.org/docs/installation/build-from-source/)
- [Development](https://www.navidrome.org/docs/developers/)
- [Subsonic API Compatibility](https://www.navidrome.org/docs/developers/subsonic-api/)

## Upstream screenshots

These inherited screenshots show official upstream Navidrome. They do not show
the evolution branch's Listen Now interface.

<p align="left">
    <img height="550" src="https://raw.githubusercontent.com/navidrome/navidrome/master/.github/screenshots/ss-mobile-login.png">
    <img height="550" src="https://raw.githubusercontent.com/navidrome/navidrome/master/.github/screenshots/ss-mobile-player.png">
    <img height="550" src="https://raw.githubusercontent.com/navidrome/navidrome/master/.github/screenshots/ss-mobile-album-view.png">
    <img width="550" src="https://raw.githubusercontent.com/navidrome/navidrome/master/.github/screenshots/ss-desktop-player.png">
</p>
