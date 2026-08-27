package nativeapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/Masterminds/squirrel"
	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/core/mix"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
)

const (
	maxMixPreviewBody = 64 << 10
	// candidatePoolMultiplier and maxCandidatePool bound the preview query so a
	// mix preview never loads the whole library: min(limit*8, 4000).
	candidatePoolMultiplier = 8
	maxCandidatePool        = 4000
)

func (api *Router) addMixPreviewRoute(r chi.Router) {
	r.Post("/mix/preview", api.previewMix)
}

func (api *Router) previewMix(w http.ResponseWriter, r *http.Request) {
	spec, err := decodeMixSpec(w, r)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := api.mixEngine.Validate(spec); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	filters := squirrel.And{squirrel.Eq{"missing": false}}
	if len(spec.LibraryIDs) > 0 {
		filters = append(filters, squirrel.Eq{"library_id": spec.LibraryIDs})
	}
	poolMax := min(spec.Limit*candidatePoolMultiplier, maxCandidatePool)
	files, err := api.ds.MediaFile(r.Context()).GetAll(model.QueryOptions{
		Filters: filters,
		Sort:    "random",
		Seed:    spec.Seed,
		Max:     poolMax,
	})
	if err != nil {
		log.Error(r.Context(), "Error loading mix candidates", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	candidates := make([]mix.Candidate, len(files))
	for i, mf := range files {
		candidates[i] = mix.Candidate{
			ID:        mf.ID,
			ArtistID:  mf.ArtistID,
			AlbumID:   mf.AlbumID,
			Missing:   mf.Missing,
			PlayCount: mf.PlayCount,
			PlayDate:  mf.PlayDate,
			Rating:    mf.Rating,
			Starred:   mf.Starred,
		}
	}

	result, err := api.mixEngine.Generate(spec, candidates)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	payload, err := json.Marshal(result)
	if err != nil {
		log.Error(r.Context(), "Error encoding mix preview", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(payload) //nolint:gosec
}

func decodeMixSpec(w http.ResponseWriter, r *http.Request) (mix.MixSpec, error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxMixPreviewBody)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var spec mix.MixSpec
	if err := dec.Decode(&spec); err != nil {
		return mix.MixSpec{}, err
	}
	if dec.More() {
		return mix.MixSpec{}, errors.New("trailing data")
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return mix.MixSpec{}, errors.New("trailing data")
	}
	return spec, nil
}
