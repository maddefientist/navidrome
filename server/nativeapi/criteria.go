package nativeapi

import (
	"encoding/json"
	"net/http"
	"slices"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model/criteria"
)

// criteriaJSONOperators are the camelCase JSON DSL operator names accepted by
// model/criteria/json.go (keys are lowercased before matching) and emitted by
// operator MarshalJSON. Listed in json.go switch order, then sorted for output.
var criteriaJSONOperators = []string{
	"is",
	"isNot",
	"gt",
	"lt",
	"contains",
	"notContains",
	"startsWith",
	"endsWith",
	"inTheRange",
	"before",
	"after",
	"inTheLast",
	"notInTheLast",
	"inPlaylist",
	"notInPlaylist",
	"isMissing",
	"isPresent",
}

var (
	criteriaJSONConjunctions = []string{"all", "any"}
	criteriaJSONOrders       = []string{"asc", "desc"}
)

type criteriaField struct {
	Name          string `json:"name"`
	CanonicalName string `json:"canonicalName"`
	Alias         string `json:"alias"`
	Numeric       bool   `json:"numeric"`
	Boolean       bool   `json:"boolean"`
	Nullable      bool   `json:"nullable"`
	Tag           bool   `json:"tag"`
	Role          bool   `json:"role"`
}

type criteriaFieldsResponse struct {
	Fields       []criteriaField `json:"fields"`
	Operators    []string        `json:"operators"`
	Conjunctions []string        `json:"conjunctions"`
	Orders       []string        `json:"orders"`
}

func (api *Router) addCriteriaRoute(r chi.Router) {
	r.Get("/criteria/fields", getCriteriaFields)
}

func getCriteriaFields(w http.ResponseWriter, r *http.Request) {
	names := criteria.AllFieldNames()
	slices.Sort(names)

	fields := make([]criteriaField, 0, len(names))
	for _, name := range names {
		if name == "random" {
			continue
		}
		info, ok := criteria.LookupField(name)
		if !ok {
			continue
		}
		fields = append(fields, criteriaField{
			Name:          name,
			CanonicalName: info.Name(),
			Alias:         info.Alias,
			Numeric:       info.Numeric,
			Boolean:       info.Boolean,
			Nullable:      info.Nullable,
			Tag:           info.IsTag,
			Role:          info.IsRole,
		})
	}

	operators := slices.Clone(criteriaJSONOperators)
	slices.Sort(operators)

	payload, err := json.Marshal(criteriaFieldsResponse{
		Fields:       fields,
		Operators:    operators,
		Conjunctions: slices.Clone(criteriaJSONConjunctions),
		Orders:       slices.Clone(criteriaJSONOrders),
	})
	if err != nil {
		log.Error(r.Context(), "Error encoding criteria fields", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(payload) //nolint:gosec
}
