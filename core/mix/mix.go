// Package mix implements deterministic, inspectable mix generation over a
// caller-scoped candidate pool. Supported modes:
//   - pure_shuffle: unbiased seeded library shuffle.
//   - rediscover: favors never-played tracks, then long-unplayed tracks.
//   - familiar_fresh: a tunable blend of familiar and fresh material.
package mix

import (
	"bytes"
	"cmp"
	"crypto/sha256"
	"errors"
	"slices"
	"time"
)

const (
	// MinLimit is the smallest number of tracks a mix may request.
	MinLimit = 1
	// MaxLimit is the largest number of tracks a mix may request.
	MaxLimit = 500
	// MaxLibraryIDs bounds caller-provided library selection filters.
	MaxLibraryIDs = 100

	// MinAdventure is the smallest allowed familiar_fresh Adventure value.
	MinAdventure = 0
	// MaxAdventure is the largest allowed familiar_fresh Adventure value.
	MaxAdventure = 100

	// FamiliarMinRating is the minimum rating that classifies a track as familiar.
	FamiliarMinRating = 4
	// FamiliarMinPlayCount is the minimum play count that classifies a track as familiar.
	FamiliarMinPlayCount = 3

	// ModePureShuffle is unbiased local random selection with a reproducibility seed.
	ModePureShuffle Mode = "pure_shuffle"
	// ModeRediscover favors accessible tracks that are unplayed or long-unplayed.
	ModeRediscover Mode = "rediscover"
	// ModeFamiliarFresh blends familiar (loved/high-rated/frequently played)
	// material with fresh (underplayed) material at a tunable ratio.
	ModeFamiliarFresh Mode = "familiar_fresh"

	// ReasonLibraryShuffle is attached to every pure_shuffle selection.
	ReasonLibraryShuffle ReasonCode = "library_shuffle"
	// ReasonRediscoverNeverPlayed is attached to rediscover selections with a zero play count.
	ReasonRediscoverNeverPlayed ReasonCode = "rediscover_never_played"
	// ReasonRediscoverStale is attached to rediscover selections that have been played
	// but not recently, or that have a low play count.
	ReasonRediscoverStale ReasonCode = "rediscover_stale"
	// ReasonFamiliarFreshFamiliar is attached to familiar_fresh selections classified as familiar.
	ReasonFamiliarFreshFamiliar ReasonCode = "familiar_fresh_familiar"
	// ReasonFamiliarFreshFresh is attached to familiar_fresh selections classified as fresh.
	ReasonFamiliarFreshFresh ReasonCode = "familiar_fresh_fresh"

	// DegradationArtistSpacing is reported when artist spacing cannot be maintained
	// without dropping eligible tracks.
	DegradationArtistSpacing = "artist_spacing"
	// DegradationAdventureTarget is reported when the requested familiar/fresh
	// proportion could not be met because one bucket had too few candidates.
	DegradationAdventureTarget = "adventure_target_unmet"
)

var (
	// ErrInvalidLimit is returned when MixSpec.Limit is outside 1..500.
	ErrInvalidLimit = errors.New("mix: limit must be between 1 and 500")
	// ErrEmptySeed is returned when MixSpec.Seed is empty.
	ErrEmptySeed = errors.New("mix: seed must be non-empty")
	// ErrUnsupportedMode is returned when MixSpec.Mode is not implemented.
	ErrUnsupportedMode = errors.New("mix: unsupported mode")
	// ErrInvalidLibraryIDs is returned for non-positive or excessive library IDs.
	ErrInvalidLibraryIDs = errors.New("mix: library IDs must be positive and contain at most 100 entries")
	// ErrInvalidAdventure is returned when MixSpec.Adventure is outside 0..100 for familiar_fresh.
	ErrInvalidAdventure = errors.New("mix: adventure must be between 0 and 100")
)

// Mode identifies a mix generation strategy.
type Mode string

// ReasonCode explains why a track was selected.
type ReasonCode string

// MixSpec is the stable input contract for mix generation.
type MixSpec struct {
	Mode          Mode   `json:"mode"`
	Seed          string `json:"seed"`
	Limit         int    `json:"limit"`
	ArtistSpacing int    `json:"artistSpacing"`
	LibraryIDs    []int  `json:"libraryIds,omitempty"`
	// Adventure tunes familiar_fresh: 0 is fully familiar, 100 is fully fresh.
	// Ignored by other modes.
	Adventure int `json:"adventure,omitempty"`
}

// Candidate is a caller-scoped, already access-checked media item.
type Candidate struct {
	ID       string
	ArtistID string
	AlbumID  string
	Missing  bool

	// PlayCount, PlayDate, Rating, and Starred are source-backed local
	// signals used for deterministic scoring in rediscover and familiar_fresh.
	PlayCount int64
	PlayDate  *time.Time
	Rating    int
	Starred   bool
}

// Entry is one inspectable track in a generated mix.
type Entry struct {
	ID     string     `json:"id"`
	Reason ReasonCode `json:"reason"`
}

// MixResult is the stable output contract for mix generation.
type MixResult struct {
	Entries      []Entry  `json:"entries"`
	Degraded     bool     `json:"degraded"`
	Degradations []string `json:"degradations"`
}

// Engine generates mixes from a caller-scoped candidate pool.
type Engine struct{}

// NewEngine returns a pure, stateless mix engine.
func NewEngine() *Engine {
	return &Engine{}
}

// Validate checks whether a mix specification can be generated without
// inspecting or loading a candidate pool.
func (e *Engine) Validate(spec MixSpec) error {
	return validateSpec(spec)
}

// Generate builds a mix from spec and candidates. The input slice is never
// mutated. Identical seed and logical candidate set (unique playable IDs with
// identical scoring fields) produce identical ordered IDs regardless of input
// order.
func (e *Engine) Generate(spec MixSpec, candidates []Candidate) (MixResult, error) {
	if err := e.Validate(spec); err != nil {
		return MixResult{}, err
	}

	pool := eligibleCandidates(candidates)

	var (
		ranked         []Candidate
		reasonByID     map[string]ReasonCode
		modeDegradedBy []string
	)
	switch spec.Mode {
	case ModeRediscover:
		ranked, reasonByID = rankRediscover(spec.Seed, pool)
	case ModeFamiliarFresh:
		ranked, reasonByID, modeDegradedBy = rankFamiliarFresh(spec.Seed, pool, spec.Adventure, spec.Limit)
	default:
		ranked = rankCandidates(spec.Seed, pool)
		reasonByID = uniformReason(pool, ReasonLibraryShuffle)
	}

	selected, spacingDegraded := applyArtistSpacing(ranked, spec.ArtistSpacing, spec.Limit)

	entries := make([]Entry, len(selected))
	for i, c := range selected {
		entries[i] = Entry{ID: c.ID, Reason: reasonByID[c.ID]}
	}

	degradations := slices.Clone(modeDegradedBy)
	if spacingDegraded {
		degradations = append(degradations, DegradationArtistSpacing)
	}

	result := MixResult{Entries: entries}
	if len(degradations) > 0 {
		result.Degraded = true
		result.Degradations = degradations
	}
	return result, nil
}

func validateSpec(spec MixSpec) error {
	switch spec.Mode {
	case ModePureShuffle, ModeRediscover, ModeFamiliarFresh:
	default:
		return ErrUnsupportedMode
	}
	if spec.Seed == "" {
		return ErrEmptySeed
	}
	if spec.Limit < MinLimit || spec.Limit > MaxLimit {
		return ErrInvalidLimit
	}
	if len(spec.LibraryIDs) > MaxLibraryIDs {
		return ErrInvalidLibraryIDs
	}
	for _, id := range spec.LibraryIDs {
		if id <= 0 {
			return ErrInvalidLibraryIDs
		}
	}
	if spec.Mode == ModeFamiliarFresh {
		if spec.Adventure < MinAdventure || spec.Adventure > MaxAdventure {
			return ErrInvalidAdventure
		}
	}
	return nil
}

func eligibleCandidates(candidates []Candidate) []Candidate {
	filtered := make([]Candidate, 0, len(candidates))
	for _, c := range candidates {
		if c.ID == "" || c.Missing {
			continue
		}
		filtered = append(filtered, c)
	}
	slices.SortFunc(filtered, func(a, b Candidate) int {
		if n := cmp.Compare(a.ID, b.ID); n != 0 {
			return n
		}
		return cmp.Compare(a.ArtistID, b.ArtistID)
	})

	uniq := make([]Candidate, 0, len(filtered))
	for _, c := range filtered {
		if len(uniq) > 0 && uniq[len(uniq)-1].ID == c.ID {
			continue
		}
		uniq = append(uniq, c)
	}
	return uniq
}

func uniformReason(pool []Candidate, reason ReasonCode) map[string]ReasonCode {
	out := make(map[string]ReasonCode, len(pool))
	for _, c := range pool {
		out[c.ID] = reason
	}
	return out
}

type rankedCandidate struct {
	cand Candidate
	key  [sha256.Size]byte
}

// rankCandidates orders candidates purely by their seeded hash key. The
// result depends only on spec.Seed and the logical candidate set, never on
// input slice order.
func rankCandidates(seed string, candidates []Candidate) []Candidate {
	ranked := make([]rankedCandidate, len(candidates))
	for i, c := range candidates {
		ranked[i] = rankedCandidate{cand: c, key: rankKey(seed, c.ID)}
	}
	slices.SortFunc(ranked, func(a, b rankedCandidate) int {
		if n := bytes.Compare(a.key[:], b.key[:]); n != 0 {
			return n
		}
		return cmp.Compare(a.cand.ID, b.cand.ID)
	})
	out := make([]Candidate, len(ranked))
	for i, r := range ranked {
		out[i] = r.cand
	}
	return out
}

func rankKey(seed, id string) [sha256.Size]byte {
	buf := make([]byte, 0, len(seed)+1+len(id))
	buf = append(buf, seed...)
	buf = append(buf, 0)
	buf = append(buf, id...)
	return sha256.Sum256(buf)
}

// rankRediscover orders candidates by: never-played first, then oldest play
// date first, then lowest play count first, with the seeded rank as the
// final, purely deterministic tie-breaker. It never reads the wall clock.
func rankRediscover(seed string, pool []Candidate) ([]Candidate, map[string]ReasonCode) {
	type scored struct {
		cand        Candidate
		neverPlayed bool
		playDate    time.Time
		key         [sha256.Size]byte
	}

	reasonByID := make(map[string]ReasonCode, len(pool))
	scoredList := make([]scored, len(pool))
	for i, c := range pool {
		never := c.PlayCount == 0
		var pd time.Time
		if c.PlayDate != nil {
			pd = *c.PlayDate
		}
		scoredList[i] = scored{cand: c, neverPlayed: never, playDate: pd, key: rankKey(seed, c.ID)}
		if never {
			reasonByID[c.ID] = ReasonRediscoverNeverPlayed
		} else {
			reasonByID[c.ID] = ReasonRediscoverStale
		}
	}

	slices.SortFunc(scoredList, func(a, b scored) int {
		if a.neverPlayed != b.neverPlayed {
			if a.neverPlayed {
				return -1
			}
			return 1
		}
		if !a.neverPlayed {
			if n := a.playDate.Compare(b.playDate); n != 0 {
				return n
			}
			if n := cmp.Compare(a.cand.PlayCount, b.cand.PlayCount); n != 0 {
				return n
			}
		}
		if n := bytes.Compare(a.key[:], b.key[:]); n != 0 {
			return n
		}
		return cmp.Compare(a.cand.ID, b.cand.ID)
	})

	out := make([]Candidate, len(scoredList))
	for i, s := range scoredList {
		out[i] = s.cand
	}
	return out, reasonByID
}

func isFamiliar(c Candidate) bool {
	return c.Starred || c.Rating >= FamiliarMinRating || c.PlayCount >= FamiliarMinPlayCount
}

// rankFamiliarFresh splits the pool into familiar and fresh buckets, targets
// the fresh proportion requested by adventure (0..100), tops up from the
// other bucket when one is insufficient, and deterministically interleaves
// the two selections. It reports DegradationAdventureTarget when the
// requested proportion could not be honored.
func rankFamiliarFresh(seed string, pool []Candidate, adventure, limit int) ([]Candidate, map[string]ReasonCode, []string) {
	fresh := make([]Candidate, 0, len(pool))
	familiar := make([]Candidate, 0, len(pool))
	for _, c := range pool {
		if isFamiliar(c) {
			familiar = append(familiar, c)
		} else {
			fresh = append(fresh, c)
		}
	}

	freshRanked := rankCandidates(seed, fresh)
	familiarRanked := rankCandidates(seed, familiar)

	wantFresh := (limit*adventure + 50) / 100
	if wantFresh > limit {
		wantFresh = limit
	}
	if wantFresh < 0 {
		wantFresh = 0
	}
	wantFamiliar := limit - wantFresh

	takeFresh := min(wantFresh, len(freshRanked))
	takeFamiliar := min(wantFamiliar, len(familiarRanked))
	remaining := limit - takeFresh - takeFamiliar

	var degradations []string
	if remaining > 0 {
		extraFresh := min(remaining, len(freshRanked)-takeFresh)
		takeFresh += extraFresh
		remaining -= extraFresh
		extraFamiliar := min(remaining, len(familiarRanked)-takeFamiliar)
		takeFamiliar += extraFamiliar
		remaining -= extraFamiliar
		if extraFresh > 0 || extraFamiliar > 0 {
			degradations = append(degradations, DegradationAdventureTarget)
		}
	}

	freshSelected := freshRanked[:takeFresh]
	familiarSelected := familiarRanked[:takeFamiliar]

	reasonByID := make(map[string]ReasonCode, takeFresh+takeFamiliar)
	for _, c := range freshSelected {
		reasonByID[c.ID] = ReasonFamiliarFreshFresh
	}
	for _, c := range familiarSelected {
		reasonByID[c.ID] = ReasonFamiliarFreshFamiliar
	}

	merged := interleave(freshSelected, familiarSelected)
	return merged, reasonByID, degradations
}

// interleave merges two already-ordered slices into one, distributing picks
// proportionally to their lengths using an integer Bresenham-style
// comparison. The result depends only on len(a), len(b), and the existing
// order of each slice.
func interleave(a, b []Candidate) []Candidate {
	na, nb := len(a), len(b)
	out := make([]Candidate, 0, na+nb)
	i, j := 0, 0
	for i < na || j < nb {
		pickA := false
		switch {
		case i >= na:
			pickA = false
		case j >= nb:
			pickA = true
		default:
			pickA = int64(i+1)*int64(nb) <= int64(j+1)*int64(na)
		}
		if pickA {
			out = append(out, a[i])
			i++
		} else {
			out = append(out, b[j])
			j++
		}
	}
	return out
}

func applyArtistSpacing(ranked []Candidate, spacing, limit int) ([]Candidate, bool) {
	if limit > len(ranked) {
		limit = len(ranked)
	}
	if limit == 0 {
		return nil, false
	}
	if spacing < 0 {
		spacing = 0
	}
	if spacing == 0 {
		return slices.Clone(ranked[:limit]), false
	}

	remaining := slices.Clone(ranked)
	out := make([]Candidate, 0, limit)
	degraded := false
	for len(out) < limit && len(remaining) > 0 {
		idx := -1
		for i, c := range remaining {
			if canPlace(out, c.ArtistID, spacing) {
				idx = i
				break
			}
		}
		if idx == -1 {
			idx = 0
			degraded = true
		}
		out = append(out, remaining[idx])
		remaining = append(remaining[:idx], remaining[idx+1:]...)
	}
	return out, degraded
}

func canPlace(out []Candidate, artistID string, spacing int) bool {
	if spacing == 0 || artistID == "" {
		return true
	}
	start := len(out) - spacing
	if start < 0 {
		start = 0
	}
	for _, c := range out[start:] {
		if c.ArtistID == artistID {
			return false
		}
	}
	return true
}
