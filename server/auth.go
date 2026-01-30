package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	UserID       string    `json:"userId"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
}

type AuthStore struct {
	users        map[string]*User // username -> User
	usersByID    map[string]*User // userID -> User
	tokens       map[string]string // token -> userID
	mu           sync.RWMutex
}

func newAuthStore() *AuthStore {
	return &AuthStore{
		users:     make(map[string]*User),
		usersByID: make(map[string]*User),
		tokens:    make(map[string]string),
	}
}

func (s *AuthStore) createUser(username, password string) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.users[username]; exists {
		return nil, errors.New("username already exists")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &User{
		UserID:       generateID("U-"),
		Username:     username,
		PasswordHash: string(hash),
		CreatedAt:    time.Now(),
	}

	s.users[username] = user
	s.usersByID[user.UserID] = user

	return user, nil
}

func (s *AuthStore) verifyUser(username, password string) (*User, error) {
	s.mu.RLock()
	user, exists := s.users[username]
	s.mu.RUnlock()

	if !exists {
		return nil, errors.New("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	return user, nil
}

func (s *AuthStore) createToken(userID string) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}

	token := base64.RawURLEncoding.EncodeToString(tokenBytes)

	s.mu.Lock()
	s.tokens[token] = userID
	s.mu.Unlock()

	return token, nil
}

func (s *AuthStore) getUserByToken(token string) (*User, error) {
	s.mu.RLock()
	userID, exists := s.tokens[token]
	s.mu.RUnlock()

	if !exists {
		return nil, errors.New("invalid token")
	}

	s.mu.RLock()
	user, exists := s.usersByID[userID]
	s.mu.RUnlock()

	if !exists {
		return nil, errors.New("user not found")
	}

	return user, nil
}

func (s *AuthStore) searchUsers(query string) []*User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*User
	for _, user := range s.users {
		if len(user.Username) >= len(query) && user.Username[:len(query)] == query {
			results = append(results, user)
		}
	}

	return results
}

func handleRegister(authStore *AuthStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if len(req.Username) < 3 || len(req.Password) < 6 {
			http.Error(w, "Username must be at least 3 characters and password at least 6 characters", http.StatusBadRequest)
			return
		}

		user, err := authStore.createUser(req.Username, req.Password)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
			return
		}

		token, err := authStore.createToken(user.UserID)
		if err != nil {
			http.Error(w, "Failed to create token", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"token":    token,
			"username": user.Username,
			"userId":   user.UserID,
		})
	}
}

func handleLogin(authStore *AuthStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		user, err := authStore.verifyUser(req.Username, req.Password)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
			return
		}

		token, err := authStore.createToken(user.UserID)
		if err != nil {
			http.Error(w, "Failed to create token", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"token":    token,
			"username": user.Username,
			"userId":   user.UserID,
		})
	}
}

func handleSearchUsers(authStore *AuthStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := extractToken(r)
		if token == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		_, err := authStore.getUserByToken(token)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		query := r.URL.Query().Get("q")
		if query == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"users": []interface{}{}})
			return
		}

		users := authStore.searchUsers(query)
		
		results := make([]map[string]string, 0, len(users))
		for _, user := range users {
			results = append(results, map[string]string{
				"userId":   user.UserID,
				"username": user.Username,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"users": results})
	}
}

func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	}
	return ""
}
