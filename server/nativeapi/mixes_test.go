package nativeapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/conf/configtest"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/core/auth"
	"github.com/navidrome/navidrome/core/mix"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/server"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("POST /mix/preview", func() {
	var (
		router   http.Handler
		ds       *tests.MockDataStore
		mfRepo   *tests.MockMediaFileRepo
		userRepo *tests.MockedUserRepo
		pqRepo   *tests.MockPlayQueueRepo
		testUser model.User
	)

	validBody := func() []byte {
		body, err := json.Marshal(mix.MixSpec{
			Mode:          mix.ModePureShuffle,
			Seed:          "repeatable",
			Limit:         2,
			ArtistSpacing: 1,
		})
		Expect(err).ToNot(HaveOccurred())
		return body
	}

	createUnauthenticatedRequest := func(body []byte) *http.Request {
		var reader *bytes.Reader
		if body != nil {
			reader = bytes.NewReader(body)
		} else {
			reader = bytes.NewReader(nil)
		}
		req := httptest.NewRequest(http.MethodPost, "/mix/preview", reader)
		req.Header.Set("Content-Type", "application/json")
		return req
	}

	createAuthenticatedRequest := func(body []byte) *http.Request {
		req := createUnauthenticatedRequest(body)
		token, err := auth.CreateToken(&testUser)
		Expect(err).ToNot(HaveOccurred())
		req.Header.Set(consts.UIAuthorizationHeader, "Bearer "+token)
		return req
	}

	BeforeEach(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.EnableSharing = false
		conf.Server.SessionTimeout = time.Minute

		mfRepo = tests.CreateMockMediaFileRepo()
		userRepo = tests.CreateMockUserRepo()
		pqRepo = &tests.MockPlayQueueRepo{}
		ds = &tests.MockDataStore{
			MockedMediaFile: mfRepo,
			MockedUser:      userRepo,
			MockedProperty:  &tests.MockedPropertyRepo{},
			MockedPlayQueue: pqRepo,
		}

		auth.Init(ds)

		testUser = model.User{
			ID:          "user-1",
			UserName:    "testuser",
			Name:        "Test User",
			IsAdmin:     false,
			NewPassword: "testpass",
		}
		Expect(userRepo.Put(&testUser)).To(Succeed())

		mfRepo.SetData(model.MediaFiles{
			{
				ID:       "song-1",
				Title:    "Test Song 1",
				ArtistID: "artist-1",
				Missing:  false,
			},
			{
				ID:       "song-2",
				Title:    "Test Song 2",
				ArtistID: "artist-2",
				Missing:  false,
			},
			{
				ID:       "missing-1",
				Title:    "Missing Song",
				ArtistID: "artist-3",
				Missing:  true,
			},
		})

		router = server.JWTVerifier(New(ds, nil, nil, nil, tests.NewMockLibraryService(), tests.NewMockUserService(), nil, nil, nil))
	})

	It("returns unauthorized when the user is not authenticated", func() {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, createUnauthenticatedRequest(validBody()))

		Expect(w.Code).To(Equal(http.StatusUnauthorized))
		Expect(pqRepo.Queue).To(BeNil())
	})

	It("returns a deterministic mix preview without mutating the queue", func() {
		first := httptest.NewRecorder()
		router.ServeHTTP(first, createAuthenticatedRequest(validBody()))
		Expect(first.Code).To(Equal(http.StatusOK))
		Expect(first.Header().Get("Content-Type")).To(ContainSubstring("application/json"))

		second := httptest.NewRecorder()
		router.ServeHTTP(second, createAuthenticatedRequest(validBody()))
		Expect(second.Code).To(Equal(http.StatusOK))
		Expect(second.Body.Bytes()).To(Equal(first.Body.Bytes()))

		var got mix.MixResult
		Expect(json.Unmarshal(first.Body.Bytes(), &got)).To(Succeed())

		want, err := mix.NewEngine().Generate(mix.MixSpec{
			Mode:          mix.ModePureShuffle,
			Seed:          "repeatable",
			Limit:         2,
			ArtistSpacing: 1,
		}, []mix.Candidate{
			{ID: "song-1", ArtistID: "artist-1"},
			{ID: "song-2", ArtistID: "artist-2"},
		})
		Expect(err).ToNot(HaveOccurred())
		Expect(got.Entries).To(Equal(want.Entries))
		Expect(got.Degraded).To(Equal(want.Degraded))
		Expect(got.Degradations).To(Equal(want.Degradations))
		Expect(pqRepo.Queue).To(BeNil())
	})

	It("queries playable media with missing=false and excludes missing tracks", func() {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, createAuthenticatedRequest(validBody()))

		Expect(w.Code).To(Equal(http.StatusOK))
		Expect(mfRepo.Options.Filters).To(Equal(squirrel.And{squirrel.Eq{"missing": false}}))

		var got mix.MixResult
		Expect(json.Unmarshal(w.Body.Bytes(), &got)).To(Succeed())
		ids := make([]string, len(got.Entries))
		for i, entry := range got.Entries {
			ids[i] = entry.ID
		}
		Expect(ids).To(ConsistOf("song-1", "song-2"))
		Expect(ids).ToNot(ContainElement("missing-1"))
		Expect(pqRepo.Queue).To(BeNil())
	})

	DescribeTable("rejects invalid JSON with HTTP 400",
		func(body string) {
			w := httptest.NewRecorder()
			router.ServeHTTP(w, createAuthenticatedRequest([]byte(body)))

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("invalid request body"))
			Expect(pqRepo.Queue).To(BeNil())
		},
		Entry("malformed JSON", `{"mode":"pure_shuffle","seed":"repeatable","limit":`),
		Entry("unknown field", `{"mode":"pure_shuffle","seed":"repeatable","limit":2,"unknown":true}`),
		Entry("trailing JSON", `{"mode":"pure_shuffle","seed":"repeatable","limit":2}{"extra":true}`),
		Entry("oversized JSON", `{"mode":"pure_shuffle","seed":"`+strings.Repeat("a", maxMixPreviewBody)+`","limit":2}`),
	)

	DescribeTable("rejects core validation failures with HTTP 400",
		func(spec mix.MixSpec) {
			body, err := json.Marshal(spec)
			Expect(err).ToNot(HaveOccurred())

			w := httptest.NewRecorder()
			router.ServeHTTP(w, createAuthenticatedRequest(body))

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("invalid request body"))
			Expect(pqRepo.Queue).To(BeNil())
		},
		Entry("empty seed", mix.MixSpec{Mode: mix.ModePureShuffle, Seed: "", Limit: 2}),
		Entry("limit too small", mix.MixSpec{Mode: mix.ModePureShuffle, Seed: "repeatable", Limit: 0}),
		Entry("limit too large", mix.MixSpec{Mode: mix.ModePureShuffle, Seed: "repeatable", Limit: mix.MaxLimit + 1}),
		Entry("unsupported mode", mix.MixSpec{Mode: "instant_mix", Seed: "repeatable", Limit: 2}),
		Entry("invalid library id", mix.MixSpec{Mode: mix.ModePureShuffle, Seed: "repeatable", Limit: 2, LibraryIDs: []int{-1}}),
		Entry("familiar_fresh adventure below range", mix.MixSpec{Mode: mix.ModeFamiliarFresh, Seed: "repeatable", Limit: 2, Adventure: -1}),
		Entry("familiar_fresh adventure above range", mix.MixSpec{Mode: mix.ModeFamiliarFresh, Seed: "repeatable", Limit: 2, Adventure: 101}),
	)

	It("constrains the preview to requested libraries", func() {
		body, err := json.Marshal(mix.MixSpec{
			Mode:       mix.ModePureShuffle,
			Seed:       "repeatable",
			Limit:      2,
			LibraryIDs: []int{2, 4},
		})
		Expect(err).ToNot(HaveOccurred())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, createAuthenticatedRequest(body))

		Expect(w.Code).To(Equal(http.StatusOK))
		Expect(mfRepo.Options.Filters).To(Equal(squirrel.And{
			squirrel.Eq{"missing": false},
			squirrel.Eq{"library_id": []int{2, 4}},
		}))
	})

	It("validates the spec before loading the library", func() {
		mfRepo.SetError(true)
		body, err := json.Marshal(mix.MixSpec{
			Mode:  mix.ModePureShuffle,
			Seed:  "",
			Limit: 2,
		})
		Expect(err).ToNot(HaveOccurred())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, createAuthenticatedRequest(body))

		Expect(w.Code).To(Equal(http.StatusBadRequest))
		Expect(w.Body.String()).To(ContainSubstring("invalid request body"))
		Expect(pqRepo.Queue).To(BeNil())
	})

	It("returns a redacted HTTP 500 when the repository fails", func() {
		mfRepo.SetError(true)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, createAuthenticatedRequest(validBody()))

		Expect(w.Code).To(Equal(http.StatusInternalServerError))
		Expect(w.Body.String()).To(Equal("Internal server error\n"))
		Expect(strings.ToLower(w.Body.String())).ToNot(ContainSubstring("sql"))
		Expect(strings.ToLower(w.Body.String())).ToNot(ContainSubstring("database"))
		Expect(strings.ToLower(w.Body.String())).ToNot(ContainSubstring("repository"))
		Expect(pqRepo.Queue).To(BeNil())
	})

	It("bounds the candidate pool query to min(limit*8, 4000) with seeded random sorting", func() {
		body, err := json.Marshal(mix.MixSpec{
			Mode:  mix.ModePureShuffle,
			Seed:  "repeatable",
			Limit: 2,
		})
		Expect(err).ToNot(HaveOccurred())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, createAuthenticatedRequest(body))

		Expect(w.Code).To(Equal(http.StatusOK))
		Expect(mfRepo.Options.Sort).To(Equal("random"))
		Expect(mfRepo.Options.Seed).To(Equal("repeatable"))
		Expect(mfRepo.Options.Max).To(Equal(16))
		Expect(mfRepo.Options.Filters).To(Equal(squirrel.And{squirrel.Eq{"missing": false}}))
	})

	It("caps the candidate pool query at 4000 when limit*8 would exceed it", func() {
		body, err := json.Marshal(mix.MixSpec{
			Mode:  mix.ModePureShuffle,
			Seed:  "repeatable",
			Limit: mix.MaxLimit,
		})
		Expect(err).ToNot(HaveOccurred())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, createAuthenticatedRequest(body))

		Expect(w.Code).To(Equal(http.StatusOK))
		Expect(mfRepo.Options.Max).To(Equal(4000))
	})

	It("returns a deterministic rediscover preview without mutating the queue", func() {
		spec := mix.MixSpec{
			Mode:  mix.ModeRediscover,
			Seed:  "repeatable",
			Limit: 2,
		}
		body, err := json.Marshal(spec)
		Expect(err).ToNot(HaveOccurred())

		first := httptest.NewRecorder()
		router.ServeHTTP(first, createAuthenticatedRequest(body))
		Expect(first.Code).To(Equal(http.StatusOK))

		second := httptest.NewRecorder()
		router.ServeHTTP(second, createAuthenticatedRequest(body))
		Expect(second.Code).To(Equal(http.StatusOK))
		Expect(second.Body.Bytes()).To(Equal(first.Body.Bytes()))

		var got mix.MixResult
		Expect(json.Unmarshal(first.Body.Bytes(), &got)).To(Succeed())
		ids := make([]string, len(got.Entries))
		for i, entry := range got.Entries {
			ids[i] = entry.ID
			Expect(entry.Reason).To(BeElementOf(mix.ReasonRediscoverNeverPlayed, mix.ReasonRediscoverStale))
		}
		Expect(ids).ToNot(ContainElement("missing-1"))
		Expect(pqRepo.Queue).To(BeNil())
	})

	It("returns a deterministic familiar_fresh preview without mutating the queue", func() {
		spec := mix.MixSpec{
			Mode:      mix.ModeFamiliarFresh,
			Seed:      "repeatable",
			Limit:     2,
			Adventure: 50,
		}
		body, err := json.Marshal(spec)
		Expect(err).ToNot(HaveOccurred())

		first := httptest.NewRecorder()
		router.ServeHTTP(first, createAuthenticatedRequest(body))
		Expect(first.Code).To(Equal(http.StatusOK))

		second := httptest.NewRecorder()
		router.ServeHTTP(second, createAuthenticatedRequest(body))
		Expect(second.Code).To(Equal(http.StatusOK))
		Expect(second.Body.Bytes()).To(Equal(first.Body.Bytes()))

		var got mix.MixResult
		Expect(json.Unmarshal(first.Body.Bytes(), &got)).To(Succeed())
		ids := make([]string, len(got.Entries))
		for i, entry := range got.Entries {
			ids[i] = entry.ID
			Expect(entry.Reason).To(BeElementOf(mix.ReasonFamiliarFreshFamiliar, mix.ReasonFamiliarFreshFresh))
		}
		Expect(ids).ToNot(ContainElement("missing-1"))
		Expect(pqRepo.Queue).To(BeNil())
	})
})
