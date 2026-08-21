// Package mix implements deterministic, inspectable mix generation over a
// caller-scoped candidate pool. The first production mode is pure_shuffle:
// a seeded library shuffle with best-effort artist spacing.
package mix

import (
	"bytes"
	"cmp"
	"crypto/sha256"
	"errors"
	"slices"
)

const (
	// MinLimit is the smallest number of tracks a mix may request.
	MinLimit = 1
	// MaxLimit is the largest number of tracks a mix may request.
	MaxLimit = 500

	// ModePureShuffle is unbiased local random selection with a reproducibility seed.
	ModePureShuffle Mode = "pure_shuffle"

	// ReasonLibraryShuffle is attached to every pure_shuffle selection.
	ReasonLibraryShuffle ReasonCode = "library_shuffle"

	// DegradationArtistSpacing is reported when artist spacing cannot be maintained
	// without dropping eligible tracks.
	DegradationArtistSpacing = "artist_spacing"
)

var (
	// ErrInvalidLimit is returned when MixSpec.Limit is outside 1..500.
	ErrInvalidLimit = errors.New("mix: limit must be between 1 and 500")
	// ErrEmptySeed is returned when MixSpec.Seed is empty.
	ErrEmptySeed = errors.New("mix: seed must be non-empty")
	// ErrUnsupportedMode is returned when MixSpec.Mode is not implemented.
	ErrUnsupportedMode = errors.New("mix: unsupported mode")
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
}

// Candidate is a caller-scoped, already access-checked media item.
type Candidate struct {
	ID       string
	ArtistID string
	Missing  bool
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

// Generate builds a pure_shuffle mix from spec and candidates.
// The input slice is never mutated. Identical seed and logical candidate set
// (unique playable IDs) produce identical ordered IDs regardless of input order.
func (e *Engine) Generate(spec MixSpec, candidates []Candidate) (MixResult, error) {
	if err := e.Validate(spec); err != nil {
		return MixResult{}, err
	}

	pool := eligibleCandidates(candidates)
	ranked := rankCandidates(spec.Seed, pool)
	selected, degraded := applyArtistSpacing(ranked, spec.ArtistSpacing, spec.Limit)

	entries := make([]Entry, len(selected))
	for i, c := range selected {
		entries[i] = Entry{ID: c.ID, Reason: ReasonLibraryShuffle}
	}

	result := MixResult{Entries: entries}
	if degraded {
		result.Degraded = true
		result.Degradations = []string{DegradationArtistSpacing}
	}
	return result, nil
}

func validateSpec(spec MixSpec) error {
	if spec.Mode != ModePureShuffle {
		return ErrUnsupportedMode
	}
	if spec.Seed == "" {
		return ErrEmptySeed
	}
	if spec.Limit < MinLimit || spec.Limit > MaxLimit {
		return ErrInvalidLimit
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

type rankedCandidate struct {
	cand Candidate
	key  [sha256.Size]byte
}

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
