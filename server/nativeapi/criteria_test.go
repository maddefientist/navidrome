package nativeapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"time"

	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/conf/configtest"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/core/auth"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/server"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("GET /criteria/fields", func() {
	var (
		router   http.Handler
		ds       *tests.MockDataStore
		testUser model.User
	)

	createUnauthenticatedRequest := func() *http.Request {
		return httptest.NewRequest(http.MethodGet, "/criteria/fields", nil)
	}

	createAuthenticatedRequest := func() *http.Request {
		req := createUnauthenticatedRequest()
		token, err := auth.CreateToken(&testUser)
		Expect(err).ToNot(HaveOccurred())
		req.Header.Set(consts.UIAuthorizationHeader, "Bearer "+token)
		return req
	}

	decodeResponse := func(body []byte) criteriaFieldsResponse {
		var got criteriaFieldsResponse
		Expect(json.Unmarshal(body, &got)).To(Succeed())
		return got
	}

	fieldByName := func(fields []criteriaField, name string) criteriaField {
		idx := slices.IndexFunc(fields, func(f criteriaField) bool { return f.Name == name })
		Expect(idx).To(BeNumerically(">=", 0), "missing field %s", name)
		return fields[idx]
	}

	BeforeEach(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.EnableSharing = false
		conf.Server.SessionTimeout = time.Minute

		ds = &tests.MockDataStore{
			MockedUser:     tests.CreateMockUserRepo(),
			MockedProperty: &tests.MockedPropertyRepo{},
		}
		auth.Init(ds)

		testUser = model.User{
			ID:          "user-1",
			UserName:    "testuser",
			Name:        "Test User",
			IsAdmin:     false,
			NewPassword: "testpass",
		}
		Expect(ds.User(nil).Put(&testUser)).To(Succeed())

		router = server.JWTVerifier(New(ds, nil, nil, nil, tests.NewMockLibraryService(), tests.NewMockUserService(), nil, nil, nil))
	})

	It("returns unauthorized when the user is not authenticated", func() {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, createUnauthenticatedRequest())

		Expect(w.Code).To(Equal(http.StatusUnauthorized))
	})

	It("returns deterministic JSON with a sorted fields array", func() {
		first := httptest.NewRecorder()
		router.ServeHTTP(first, createAuthenticatedRequest())
		Expect(first.Code).To(Equal(http.StatusOK))
		Expect(first.Header().Get("Content-Type")).To(ContainSubstring("application/json"))

		second := httptest.NewRecorder()
		router.ServeHTTP(second, createAuthenticatedRequest())
		Expect(second.Code).To(Equal(http.StatusOK))
		Expect(second.Body.Bytes()).To(Equal(first.Body.Bytes()))

		got := decodeResponse(first.Body.Bytes())
		names := make([]string, len(got.Fields))
		for i, field := range got.Fields {
			names[i] = field.Name
		}
		Expect(names).ToNot(BeEmpty())
		Expect(slices.IsSorted(names)).To(BeTrue())
		Expect(got.Operators).To(Equal([]string{
			"after", "before", "contains", "endsWith", "gt", "inPlaylist",
			"inTheLast", "inTheRange", "is", "isMissing", "isNot", "isPresent",
			"lt", "notContains", "notInPlaylist", "notInTheLast", "startsWith",
		}))
		Expect(got.Conjunctions).To(Equal([]string{"all", "any"}))
		Expect(got.Orders).To(Equal([]string{"asc", "desc"}))
	})

	It("excludes the sort-only random pseudo-field", func() {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, createAuthenticatedRequest())
		Expect(w.Code).To(Equal(http.StatusOK))

		got := decodeResponse(w.Body.Bytes())
		for _, field := range got.Fields {
			Expect(field.Name).ToNot(Equal("random"))
			Expect(field.CanonicalName).ToNot(Equal("random"))
		}
	})

	It("returns metadata for a canonical field and an alias", func() {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, createAuthenticatedRequest())
		Expect(w.Code).To(Equal(http.StatusOK))

		got := decodeResponse(w.Body.Bytes())
		title := fieldByName(got.Fields, "title")
		Expect(title).To(Equal(criteriaField{
			Name:          "title",
			CanonicalName: "title",
			Alias:         "",
			Numeric:       false,
			Boolean:       false,
			Nullable:      false,
			Tag:           false,
			Role:          false,
		}))

		albumType := fieldByName(got.Fields, "albumtype")
		Expect(albumType).To(Equal(criteriaField{
			Name:          "albumtype",
			CanonicalName: "releasetype",
			Alias:         "releasetype",
			Numeric:       false,
			Boolean:       false,
			Nullable:      false,
			Tag:           true,
			Role:          false,
		}))
	})

	It("represents dynamically registered role and tag fields without mutating the registry", func() {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, createAuthenticatedRequest())
		Expect(w.Code).To(Equal(http.StatusOK))

		got := decodeResponse(w.Body.Bytes())
		genre := fieldByName(got.Fields, "genre")
		Expect(genre.Name).To(Equal("genre"))
		Expect(genre.CanonicalName).To(Equal("genre"))
		Expect(genre.Alias).To(BeEmpty())
		Expect(genre.Tag).To(BeTrue())
		Expect(genre.Role).To(BeFalse())

		composer := fieldByName(got.Fields, "composer")
		Expect(composer.Name).To(Equal("composer"))
		Expect(composer.CanonicalName).To(Equal("composer"))
		Expect(composer.Alias).To(BeEmpty())
		Expect(composer.Role).To(BeTrue())
		Expect(composer.Tag).To(BeFalse())
	})
})
