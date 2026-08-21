package mix

import (
	"strconv"
	"testing"
)

func BenchmarkGenerate100kCandidates(b *testing.B) {
	candidates := make([]Candidate, 100_000)
	for i := range candidates {
		candidates[i] = Candidate{
			ID:       "track-" + strconv.Itoa(i),
			ArtistID: "artist-" + strconv.Itoa(i%10_000),
		}
	}
	spec := MixSpec{
		Mode:          ModePureShuffle,
		Seed:          "benchmark-seed",
		Limit:         100,
		ArtistSpacing: 2,
	}
	engine := NewEngine()

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		if _, err := engine.Generate(spec, candidates); err != nil {
			b.Fatal(err)
		}
	}
}
