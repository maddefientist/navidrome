package mix

import (
	"errors"
	"slices"
	"strconv"
	"testing"
	"time"
)

func TestGenerateValidation(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	pool := []Candidate{{ID: "a", ArtistID: "art-a"}}

	tests := []struct {
		name    string
		spec    MixSpec
		wantErr error
	}{
		{
			name:    "empty seed",
			spec:    MixSpec{Mode: ModePureShuffle, Seed: "", Limit: 10},
			wantErr: ErrEmptySeed,
		},
		{
			name:    "limit zero",
			spec:    MixSpec{Mode: ModePureShuffle, Seed: "seed", Limit: 0},
			wantErr: ErrInvalidLimit,
		},
		{
			name:    "limit negative",
			spec:    MixSpec{Mode: ModePureShuffle, Seed: "seed", Limit: -3},
			wantErr: ErrInvalidLimit,
		},
		{
			name:    "limit too large",
			spec:    MixSpec{Mode: ModePureShuffle, Seed: "seed", Limit: MaxLimit + 1},
			wantErr: ErrInvalidLimit,
		},
		{
			name:    "unsupported mode",
			spec:    MixSpec{Mode: "instant_mix", Seed: "seed", Limit: 10},
			wantErr: ErrUnsupportedMode,
		},
		{
			name:    "non-positive library id",
			spec:    MixSpec{Mode: ModePureShuffle, Seed: "seed", Limit: 10, LibraryIDs: []int{0}},
			wantErr: ErrInvalidLibraryIDs,
		},
		{
			name: "too many library ids",
			spec: MixSpec{
				Mode:       ModePureShuffle,
				Seed:       "seed",
				Limit:      10,
				LibraryIDs: make([]int, MaxLibraryIDs+1),
			},
			wantErr: ErrInvalidLibraryIDs,
		},
		{
			name:    "empty mode",
			spec:    MixSpec{Mode: "", Seed: "seed", Limit: 10},
			wantErr: ErrUnsupportedMode,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := eng.Generate(tc.spec, pool)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("Generate() error = %v, want %v", err, tc.wantErr)
			}
		})
	}

	t.Run("limit boundaries succeed", func(t *testing.T) {
		t.Parallel()
		for _, limit := range []int{MinLimit, MaxLimit} {
			res, err := eng.Generate(MixSpec{Mode: ModePureShuffle, Seed: "seed", Limit: limit}, pool)
			if err != nil {
				t.Fatalf("Generate(limit=%d) unexpected error: %v", limit, err)
			}
			if len(res.Entries) != 1 {
				t.Fatalf("Generate(limit=%d) got %d entries, want 1", limit, len(res.Entries))
			}
		}
	})
}

func TestGenerateFiltering(t *testing.T) {
	t.Parallel()
	eng := NewEngine()

	tests := []struct {
		name string
		pool []Candidate
		want []string
	}{
		{
			name: "excludes missing",
			pool: []Candidate{
				{ID: "playable", ArtistID: "a"},
				{ID: "gone", ArtistID: "b", Missing: true},
			},
			want: []string{"playable"},
		},
		{
			name: "excludes empty ids",
			pool: []Candidate{
				{ID: "", ArtistID: "a"},
				{ID: "keep", ArtistID: "b"},
				{ID: "", ArtistID: "c", Missing: true},
			},
			want: []string{"keep"},
		},
		{
			name: "deduplicates by media id",
			pool: []Candidate{
				{ID: "dup", ArtistID: "z"},
				{ID: "uniq", ArtistID: "a"},
				{ID: "dup", ArtistID: "a"},
				{ID: "dup", ArtistID: "m"},
			},
			want: []string{"dup", "uniq"},
		},
		{
			name: "empty pool",
			pool: nil,
			want: nil,
		},
		{
			name: "all unavailable",
			pool: []Candidate{
				{ID: "", ArtistID: "a"},
				{ID: "x", ArtistID: "b", Missing: true},
			},
			want: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			res, err := eng.Generate(MixSpec{Mode: ModePureShuffle, Seed: "seed", Limit: 50}, tc.pool)
			if err != nil {
				t.Fatalf("Generate() unexpected error: %v", err)
			}
			got := idsOf(res)
			if !sameIDs(got, tc.want) {
				t.Fatalf("result IDs = %v, want set %v", got, tc.want)
			}
			for _, e := range res.Entries {
				if e.ID == "" {
					t.Fatal("empty ID entered result")
				}
				if e.Reason != ReasonLibraryShuffle {
					t.Fatalf("entry %q reason = %q, want %q", e.ID, e.Reason, ReasonLibraryShuffle)
				}
			}
			for _, c := range tc.pool {
				if (c.ID == "" || c.Missing) && slices.Contains(got, c.ID) && c.ID != "" {
					t.Fatalf("unavailable candidate %q entered result", c.ID)
				}
			}
		})
	}
}

func TestGenerateLimit(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	pool := numberedPool(10)

	tests := []struct {
		name    string
		limit   int
		wantLen int
	}{
		{name: "caps to limit", limit: 3, wantLen: 3},
		{name: "limit one", limit: 1, wantLen: 1},
		{name: "limit equals pool", limit: 10, wantLen: 10},
		{name: "limit larger than pool", limit: 25, wantLen: 10},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			res, err := eng.Generate(MixSpec{Mode: ModePureShuffle, Seed: "seed", Limit: tc.limit}, pool)
			if err != nil {
				t.Fatalf("Generate() unexpected error: %v", err)
			}
			if len(res.Entries) != tc.wantLen {
				t.Fatalf("len(entries) = %d, want %d", len(res.Entries), tc.wantLen)
			}
			if dup := firstDuplicate(idsOf(res)); dup != "" {
				t.Fatalf("duplicate ID %q in result", dup)
			}
		})
	}
}

func TestGenerateDeterminism(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	spec := MixSpec{Mode: ModePureShuffle, Seed: "repeatable", Limit: 20, ArtistSpacing: 2}
	pool := numberedPool(40)

	first, err := eng.Generate(spec, pool)
	if err != nil {
		t.Fatalf("Generate() unexpected error: %v", err)
	}
	if len(first.Entries) != 20 {
		t.Fatalf("len(entries) = %d, want 20", len(first.Entries))
	}

	tests := []struct {
		name string
	}{
		{name: "second call"},
		{name: "third call"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := eng.Generate(spec, pool)
			if err != nil {
				t.Fatalf("Generate() unexpected error: %v", err)
			}
			if !slices.Equal(idsOf(got), idsOf(first)) {
				t.Fatalf("ordering drifted: got %v want %v", idsOf(got), idsOf(first))
			}
		})
	}
}

func TestGenerateInputOrderIndependence(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	spec := MixSpec{Mode: ModePureShuffle, Seed: "order", Limit: 15, ArtistSpacing: 1}
	base := append(numberedPool(12), Candidate{ID: "dup", ArtistID: "z"}, Candidate{ID: "dup", ArtistID: "a"})

	want, err := eng.Generate(spec, base)
	if err != nil {
		t.Fatalf("Generate() unexpected error: %v", err)
	}

	tests := []struct {
		name string
		pool []Candidate
	}{
		{name: "reversed", pool: reversed(base)},
		{name: "rotated", pool: rotated(base, 5)},
		{name: "stable sorted by id", pool: sortedByID(base)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := eng.Generate(spec, tc.pool)
			if err != nil {
				t.Fatalf("Generate() unexpected error: %v", err)
			}
			if !slices.Equal(idsOf(got), idsOf(want)) {
				t.Fatalf("order-dependent result: got %v want %v", idsOf(got), idsOf(want))
			}
		})
	}
}

func TestGenerateSeedVariation(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	pool := numberedPool(30)
	spec := MixSpec{Mode: ModePureShuffle, Limit: 20}

	tests := []struct {
		name  string
		seedA string
		seedB string
	}{
		{name: "distinct seeds", seedA: "alpha", seedB: "bravo"},
		{name: "nearby seeds", seedA: "seed-1", seedB: "seed-2"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			a := spec
			a.Seed = tc.seedA
			b := spec
			b.Seed = tc.seedB
			resA, err := eng.Generate(a, pool)
			if err != nil {
				t.Fatalf("Generate(%q) unexpected error: %v", tc.seedA, err)
			}
			resB, err := eng.Generate(b, pool)
			if err != nil {
				t.Fatalf("Generate(%q) unexpected error: %v", tc.seedB, err)
			}
			if slices.Equal(idsOf(resA), idsOf(resB)) {
				t.Fatalf("different seeds produced identical order %v", idsOf(resA))
			}
		})
	}
}

func TestGenerateNoInputMutation(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	tests := []struct {
		name    string
		spec    MixSpec
		pool    []Candidate
		wantErr error
	}{
		{
			name: "successful shuffle",
			spec: MixSpec{Mode: ModePureShuffle, Seed: "seed", Limit: 4, ArtistSpacing: 1},
			pool: []Candidate{
				{ID: "a", ArtistID: "1"},
				{ID: "b", ArtistID: "2"},
				{ID: "c", ArtistID: "1", Missing: true},
				{ID: "", ArtistID: "3"},
				{ID: "d", ArtistID: "3"},
			},
		},
		{
			name:    "validation error",
			spec:    MixSpec{Mode: ModePureShuffle, Seed: "", Limit: 4},
			pool:    numberedPool(5),
			wantErr: ErrEmptySeed,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			original := slices.Clone(tc.pool)
			_, err := eng.Generate(tc.spec, tc.pool)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("Generate() error = %v, want %v", err, tc.wantErr)
			}
			if !slices.Equal(tc.pool, original) {
				t.Fatalf("input mutated: got %#v want %#v", tc.pool, original)
			}
		})
	}
}

func TestGenerateArtistSpacingSuccess(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	uniqueArtists := make([]Candidate, 12)
	for i := range uniqueArtists {
		uniqueArtists[i] = Candidate{
			ID:       "t" + strconv.Itoa(i),
			ArtistID: "artist-" + strconv.Itoa(i),
		}
	}
	repeatedArtists := make([]Candidate, 12)
	for i := range repeatedArtists {
		repeatedArtists[i] = Candidate{
			ID:       "r" + strconv.Itoa(i),
			ArtistID: "artist-" + strconv.Itoa(i%6),
		}
	}

	tests := []struct {
		name    string
		pool    []Candidate
		spacing int
		limit   int
	}{
		{name: "spacing one", pool: uniqueArtists, spacing: 1, limit: 12},
		{name: "spacing two with enough artists", pool: uniqueArtists, spacing: 2, limit: 12},
		{name: "spacing one with repeated artists", pool: repeatedArtists, spacing: 1, limit: 12},
		{name: "spacing zero allows repeats", pool: uniqueArtists, spacing: 0, limit: 12},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			res, err := eng.Generate(MixSpec{
				Mode:          ModePureShuffle,
				Seed:          "spaced",
				Limit:         tc.limit,
				ArtistSpacing: tc.spacing,
			}, tc.pool)
			if err != nil {
				t.Fatalf("Generate() unexpected error: %v", err)
			}
			if len(res.Entries) != tc.limit {
				t.Fatalf("len(entries) = %d, want %d (tracks dropped)", len(res.Entries), tc.limit)
			}
			if tc.spacing > 0 {
				if res.Degraded {
					t.Fatalf("unexpected degradation %v", res.Degradations)
				}
				if viol := spacingViolations(res, tc.pool, tc.spacing); viol != 0 {
					t.Fatalf("artist spacing not maintained, violations=%d ids=%v", viol, idsOf(res))
				}
			}
			for _, e := range res.Entries {
				if e.Reason != ReasonLibraryShuffle {
					t.Fatalf("entry %q reason = %q, want %q", e.ID, e.Reason, ReasonLibraryShuffle)
				}
			}
		})
	}
}

func TestGenerateArtistSpacingDegradation(t *testing.T) {
	t.Parallel()
	eng := NewEngine()

	tests := []struct {
		name    string
		pool    []Candidate
		spacing int
		limit   int
		wantLen int
	}{
		{
			name:    "single artist cannot satisfy spacing",
			pool:    sameArtistPool("solo", 6),
			spacing: 2,
			limit:   6,
			wantLen: 6,
		},
		{
			name:    "two artists with large spacing still keep all tracks",
			pool:    twoArtistPool(5),
			spacing: 4,
			limit:   10,
			wantLen: 10,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			res, err := eng.Generate(MixSpec{
				Mode:          ModePureShuffle,
				Seed:          "tight",
				Limit:         tc.limit,
				ArtistSpacing: tc.spacing,
			}, tc.pool)
			if err != nil {
				t.Fatalf("Generate() unexpected error: %v", err)
			}
			if len(res.Entries) != tc.wantLen {
				t.Fatalf("len(entries) = %d, want %d (eligible tracks dropped)", len(res.Entries), tc.wantLen)
			}
			if !res.Degraded {
				t.Fatal("expected degraded=true when spacing cannot be maintained")
			}
			if !slices.Contains(res.Degradations, DegradationArtistSpacing) {
				t.Fatalf("degradations = %v, want to include %q", res.Degradations, DegradationArtistSpacing)
			}
			if viol := spacingViolations(res, tc.pool, tc.spacing); viol == 0 {
				t.Fatal("expected spacing violations in degraded result")
			}
			if dup := firstDuplicate(idsOf(res)); dup != "" {
				t.Fatalf("duplicate ID %q in result", dup)
			}
		})
	}
}

func idsOf(res MixResult) []string {
	out := make([]string, len(res.Entries))
	for i, e := range res.Entries {
		out[i] = e.ID
	}
	return out
}

func sameIDs(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	g := slices.Clone(got)
	w := slices.Clone(want)
	slices.Sort(g)
	slices.Sort(w)
	return slices.Equal(g, w)
}

func firstDuplicate(ids []string) string {
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if _, ok := seen[id]; ok {
			return id
		}
		seen[id] = struct{}{}
	}
	return ""
}

func numberedPool(n int) []Candidate {
	out := make([]Candidate, n)
	for i := range n {
		out[i] = Candidate{
			ID:       "id-" + strconv.Itoa(i),
			ArtistID: "artist-" + strconv.Itoa(i%7),
		}
	}
	return out
}

func sameArtistPool(artist string, n int) []Candidate {
	out := make([]Candidate, n)
	for i := range n {
		out[i] = Candidate{ID: "id-" + strconv.Itoa(i), ArtistID: artist}
	}
	return out
}

func twoArtistPool(perArtist int) []Candidate {
	out := make([]Candidate, 0, perArtist*2)
	for i := range perArtist {
		out = append(out,
			Candidate{ID: "a-" + strconv.Itoa(i), ArtistID: "A"},
			Candidate{ID: "b-" + strconv.Itoa(i), ArtistID: "B"},
		)
	}
	return out
}

func reversed(in []Candidate) []Candidate {
	out := slices.Clone(in)
	slices.Reverse(out)
	return out
}

func rotated(in []Candidate, n int) []Candidate {
	out := slices.Clone(in)
	if len(out) == 0 {
		return out
	}
	n %= len(out)
	return append(out[n:], out[:n]...)
}

func sortedByID(in []Candidate) []Candidate {
	out := slices.Clone(in)
	slices.SortFunc(out, func(a, b Candidate) int {
		if a.ID == b.ID {
			if a.ArtistID < b.ArtistID {
				return -1
			}
			if a.ArtistID > b.ArtistID {
				return 1
			}
			return 0
		}
		if a.ID < b.ID {
			return -1
		}
		return 1
	})
	return out
}

func spacingViolations(res MixResult, pool []Candidate, spacing int) int {
	artists := make(map[string]string, len(pool))
	for _, c := range pool {
		if c.ID == "" || c.Missing {
			continue
		}
		if _, ok := artists[c.ID]; !ok {
			artists[c.ID] = c.ArtistID
		}
	}
	viol := 0
	ids := idsOf(res)
	for i, id := range ids {
		artist := artists[id]
		if artist == "" {
			continue
		}
		start := i - spacing
		if start < 0 {
			start = 0
		}
		for _, prev := range ids[start:i] {
			if artists[prev] == artist {
				viol++
			}
		}
	}
	return viol
}

func TestValidateNewModes(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	pool := []Candidate{{ID: "a", ArtistID: "art-a"}}

	tests := []struct {
		name    string
		spec    MixSpec
		wantErr error
	}{
		{
			name:    "rediscover valid",
			spec:    MixSpec{Mode: ModeRediscover, Seed: "seed", Limit: 10},
			wantErr: nil,
		},
		{
			name:    "familiar_fresh valid at adventure zero",
			spec:    MixSpec{Mode: ModeFamiliarFresh, Seed: "seed", Limit: 10, Adventure: MinAdventure},
			wantErr: nil,
		},
		{
			name:    "familiar_fresh valid at adventure one hundred",
			spec:    MixSpec{Mode: ModeFamiliarFresh, Seed: "seed", Limit: 10, Adventure: MaxAdventure},
			wantErr: nil,
		},
		{
			name:    "familiar_fresh adventure below range",
			spec:    MixSpec{Mode: ModeFamiliarFresh, Seed: "seed", Limit: 10, Adventure: -1},
			wantErr: ErrInvalidAdventure,
		},
		{
			name:    "familiar_fresh adventure above range",
			spec:    MixSpec{Mode: ModeFamiliarFresh, Seed: "seed", Limit: 10, Adventure: MaxAdventure + 1},
			wantErr: ErrInvalidAdventure,
		},
		{
			name:    "pure_shuffle ignores out-of-range adventure",
			spec:    MixSpec{Mode: ModePureShuffle, Seed: "seed", Limit: 10, Adventure: 500},
			wantErr: nil,
		},
		{
			name:    "rediscover ignores out-of-range adventure",
			spec:    MixSpec{Mode: ModeRediscover, Seed: "seed", Limit: 10, Adventure: -50},
			wantErr: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := eng.Generate(tc.spec, pool)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("Generate() error = %v, want %v", err, tc.wantErr)
			}
		})
	}
}

func mustTime(t *testing.T, s string) time.Time {
	t.Helper()
	tm, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatalf("parse time %q: %v", s, err)
	}
	return tm
}

func TestRediscoverOrdering(t *testing.T) {
	t.Parallel()
	eng := NewEngine()

	old := mustTime(t, "2020-01-01T00:00:00Z")
	recent := mustTime(t, "2024-01-01T00:00:00Z")

	pool := []Candidate{
		{ID: "recent-high-count", ArtistID: "a1", PlayCount: 10, PlayDate: &recent},
		{ID: "old-low-count", ArtistID: "a2", PlayCount: 1, PlayDate: &old},
		{ID: "never-played-1", ArtistID: "a3", PlayCount: 0},
		{ID: "never-played-2", ArtistID: "a4", PlayCount: 0},
		{ID: "old-high-count", ArtistID: "a5", PlayCount: 20, PlayDate: &old},
	}

	res, err := eng.Generate(MixSpec{Mode: ModeRediscover, Seed: "seed", Limit: 5}, pool)
	if err != nil {
		t.Fatalf("Generate() unexpected error: %v", err)
	}
	ids := idsOf(res)

	neverPlayedIdx := map[string]int{}
	for i, id := range ids {
		if id == "never-played-1" || id == "never-played-2" {
			neverPlayedIdx[id] = i
		}
	}
	if len(neverPlayedIdx) != 2 {
		t.Fatalf("expected both never-played tracks present, got %v", ids)
	}
	oldLowIdx := slices.Index(ids, "old-low-count")
	oldHighIdx := slices.Index(ids, "old-high-count")
	recentHighIdx := slices.Index(ids, "recent-high-count")

	for _, i := range neverPlayedIdx {
		if i >= oldLowIdx || i >= oldHighIdx || i >= recentHighIdx {
			t.Fatalf("never-played track not prioritized first: ids=%v", ids)
		}
	}
	// Same old play date, lower play count should come before higher play count.
	if oldLowIdx >= oldHighIdx {
		t.Fatalf("lower play count should rank before higher play count on same date: ids=%v", ids)
	}
	// Oldest play date should rank ahead of the most recent play date.
	if oldHighIdx >= recentHighIdx {
		t.Fatalf("older play date should rank before more recent play date: ids=%v", ids)
	}

	reasons := map[string]ReasonCode{}
	for _, e := range res.Entries {
		reasons[e.ID] = e.Reason
	}
	if reasons["never-played-1"] != ReasonRediscoverNeverPlayed || reasons["never-played-2"] != ReasonRediscoverNeverPlayed {
		t.Fatalf("expected never-played reason codes, got %v", reasons)
	}
	if reasons["old-low-count"] != ReasonRediscoverStale || reasons["old-high-count"] != ReasonRediscoverStale || reasons["recent-high-count"] != ReasonRediscoverStale {
		t.Fatalf("expected stale reason codes for played tracks, got %v", reasons)
	}
}

func rediscoverPool(n int) []Candidate {
	base, err := time.Parse(time.RFC3339, "2021-06-01T00:00:00Z")
	if err != nil {
		panic(err)
	}
	out := make([]Candidate, n)
	for i := range n {
		var pd *time.Time
		count := int64(i % 5)
		if count > 0 {
			t := base.AddDate(0, 0, i)
			pd = &t
		}
		out[i] = Candidate{
			ID:        "rid-" + strconv.Itoa(i),
			ArtistID:  "artist-" + strconv.Itoa(i%6),
			PlayCount: count,
			PlayDate:  pd,
		}
	}
	return out
}

func TestRediscoverDeterminismAndOrderIndependence(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	spec := MixSpec{Mode: ModeRediscover, Seed: "rediscover-seed", Limit: 15, ArtistSpacing: 1}
	pool := rediscoverPool(30)

	want, err := eng.Generate(spec, pool)
	if err != nil {
		t.Fatalf("Generate() unexpected error: %v", err)
	}
	if len(want.Entries) != 15 {
		t.Fatalf("len(entries) = %d, want 15", len(want.Entries))
	}

	tests := []struct {
		name string
		pool []Candidate
	}{
		{name: "repeat call", pool: pool},
		{name: "reversed", pool: reversed(pool)},
		{name: "rotated", pool: rotated(pool, 7)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := eng.Generate(spec, tc.pool)
			if err != nil {
				t.Fatalf("Generate() unexpected error: %v", err)
			}
			if !slices.Equal(idsOf(got), idsOf(want)) {
				t.Fatalf("order-dependent or non-deterministic result: got %v want %v", idsOf(got), idsOf(want))
			}
		})
	}
}

func familiarFreshPool(nFamiliar, nFresh int) []Candidate {
	out := make([]Candidate, 0, nFamiliar+nFresh)
	for i := range nFamiliar {
		out = append(out, Candidate{
			ID:       "fam-" + strconv.Itoa(i),
			ArtistID: "fam-artist-" + strconv.Itoa(i%4),
			Starred:  true,
		})
	}
	for i := range nFresh {
		out = append(out, Candidate{
			ID:       "fresh-" + strconv.Itoa(i),
			ArtistID: "fresh-artist-" + strconv.Itoa(i%4),
		})
	}
	return out
}

func TestFamiliarFreshProportions(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	pool := familiarFreshPool(20, 20)

	t.Run("adventure zero is fully familiar", func(t *testing.T) {
		t.Parallel()
		res, err := eng.Generate(MixSpec{Mode: ModeFamiliarFresh, Seed: "seed", Limit: 10, Adventure: 0}, pool)
		if err != nil {
			t.Fatalf("Generate() unexpected error: %v", err)
		}
		for _, e := range res.Entries {
			if e.Reason != ReasonFamiliarFreshFamiliar {
				t.Fatalf("entry %q reason = %q, want %q", e.ID, e.Reason, ReasonFamiliarFreshFamiliar)
			}
		}
		if res.Degraded {
			t.Fatalf("unexpected degradation %v", res.Degradations)
		}
	})

	t.Run("adventure one hundred is fully fresh", func(t *testing.T) {
		t.Parallel()
		res, err := eng.Generate(MixSpec{Mode: ModeFamiliarFresh, Seed: "seed", Limit: 10, Adventure: 100}, pool)
		if err != nil {
			t.Fatalf("Generate() unexpected error: %v", err)
		}
		for _, e := range res.Entries {
			if e.Reason != ReasonFamiliarFreshFresh {
				t.Fatalf("entry %q reason = %q, want %q", e.ID, e.Reason, ReasonFamiliarFreshFresh)
			}
		}
		if res.Degraded {
			t.Fatalf("unexpected degradation %v", res.Degradations)
		}
	})

	t.Run("adventure fifty splits evenly", func(t *testing.T) {
		t.Parallel()
		res, err := eng.Generate(MixSpec{Mode: ModeFamiliarFresh, Seed: "seed", Limit: 10, Adventure: 50}, pool)
		if err != nil {
			t.Fatalf("Generate() unexpected error: %v", err)
		}
		var familiar, fresh int
		for _, e := range res.Entries {
			switch e.Reason {
			case ReasonFamiliarFreshFamiliar:
				familiar++
			case ReasonFamiliarFreshFresh:
				fresh++
			default:
				t.Fatalf("unexpected reason %q", e.Reason)
			}
		}
		if familiar != 5 || fresh != 5 {
			t.Fatalf("familiar=%d fresh=%d, want 5/5", familiar, fresh)
		}
		if res.Degraded {
			t.Fatalf("unexpected degradation %v", res.Degradations)
		}
	})
}

func TestFamiliarFreshTopUpDegradation(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	// Only 2 fresh candidates available but adventure requests far more than that.
	pool := familiarFreshPool(20, 2)

	res, err := eng.Generate(MixSpec{Mode: ModeFamiliarFresh, Seed: "seed", Limit: 10, Adventure: 100}, pool)
	if err != nil {
		t.Fatalf("Generate() unexpected error: %v", err)
	}
	if len(res.Entries) != 10 {
		t.Fatalf("len(entries) = %d, want 10 (top-up should fill from familiar pool)", len(res.Entries))
	}
	if !res.Degraded {
		t.Fatal("expected degraded=true when adventure target cannot be met")
	}
	if !slices.Contains(res.Degradations, DegradationAdventureTarget) {
		t.Fatalf("degradations = %v, want to include %q", res.Degradations, DegradationAdventureTarget)
	}
	var fresh, familiar int
	for _, e := range res.Entries {
		if e.Reason == ReasonFamiliarFreshFresh {
			fresh++
		} else if e.Reason == ReasonFamiliarFreshFamiliar {
			familiar++
		}
	}
	if fresh != 2 {
		t.Fatalf("fresh = %d, want 2 (all available fresh candidates used)", fresh)
	}
	if familiar != 8 {
		t.Fatalf("familiar = %d, want 8 (topped up from familiar pool)", familiar)
	}
}

func TestFamiliarFreshDeterminismAndOrderIndependence(t *testing.T) {
	t.Parallel()
	eng := NewEngine()
	spec := MixSpec{Mode: ModeFamiliarFresh, Seed: "ff-seed", Limit: 16, ArtistSpacing: 1, Adventure: 35}
	pool := familiarFreshPool(25, 25)

	want, err := eng.Generate(spec, pool)
	if err != nil {
		t.Fatalf("Generate() unexpected error: %v", err)
	}
	if len(want.Entries) != 16 {
		t.Fatalf("len(entries) = %d, want 16", len(want.Entries))
	}

	tests := []struct {
		name string
		pool []Candidate
	}{
		{name: "repeat call", pool: pool},
		{name: "reversed", pool: reversed(pool)},
		{name: "rotated", pool: rotated(pool, 9)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := eng.Generate(spec, tc.pool)
			if err != nil {
				t.Fatalf("Generate() unexpected error: %v", err)
			}
			if !slices.Equal(idsOf(got), idsOf(want)) {
				t.Fatalf("order-dependent or non-deterministic result: got %v want %v", idsOf(got), idsOf(want))
			}
			if !slices.Equal(reasonsOf(got), reasonsOf(want)) {
				t.Fatalf("reasons drifted: got %v want %v", reasonsOf(got), reasonsOf(want))
			}
		})
	}
}

func reasonsOf(res MixResult) []ReasonCode {
	out := make([]ReasonCode, len(res.Entries))
	for i, e := range res.Entries {
		out[i] = e.Reason
	}
	return out
}
