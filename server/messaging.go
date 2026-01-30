package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Message struct {
	ID              string `json:"id"`
	ChatID          string `json:"chatId"`
	SenderID        string `json:"senderId"`
	SenderUsername  string `json:"senderUsername"`
	Content         string `json:"content"`
	Timestamp       int64  `json:"timestamp"`
	Read            bool   `json:"read"`
}

type ChatRoom struct {
	ID                   string            `json:"id"`
	Participants         []string          `json:"participants"`
	ParticipantUsernames map[string]string `json:"participantUsernames"`
	Messages             []*Message        `json:"-"`
	LastMessage          *Message          `json:"lastMessage,omitempty"`
	UnreadCount          map[string]int    `json:"-"`
	mu                   sync.Mutex
}

// ChatRoomForClient is a simplified version of ChatRoom for client-side consumption
type ChatRoomForClient struct {
	ID                   string            `json:"id"`
	Participants         []string          `json:"participants"`
	ParticipantUsernames map[string]string `json:"participantUsernames"`
	LastMessage          *Message          `json:"lastMessage,omitempty"`
	UnreadCount          int               `json:"unreadCount"` // Specific for the requesting user
}

type MessagingStore struct {
	chats       map[string]*ChatRoom   // chatID -> ChatRoom
	userChats   map[string][]string    // userID -> []chatID
	wsClients   map[string]*websocket.Conn // userID -> websocket
	mu          sync.RWMutex
}

func newMessagingStore() *MessagingStore {
	return &MessagingStore{
		chats:     make(map[string]*ChatRoom),
		userChats: make(map[string][]string),
		wsClients: make(map[string]*websocket.Conn),
	}
}

func (s *MessagingStore) getOrCreateChat(userID1, userID2, username1, username2 string) *ChatRoom {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if chat already exists
	for _, chatID := range s.userChats[userID1] {
		chat := s.chats[chatID]
		if chat != nil {
			for _, p := range chat.Participants {
				if p == userID2 {
					return chat
				}
			}
		}
	}

	// Create new chat
	chat := &ChatRoom{
		ID:           generateID("CHAT-"),
		Participants: []string{userID1, userID2},
		ParticipantUsernames: map[string]string{
			userID1: username1,
			userID2: username2,
		},
		Messages:    make([]*Message, 0),
		UnreadCount: make(map[string]int),
	}

	s.chats[chat.ID] = chat
	s.userChats[userID1] = append(s.userChats[userID1], chat.ID)
	s.userChats[userID2] = append(s.userChats[userID2], chat.ID)

	return chat
}

func (s *MessagingStore) getUserChats(userID string) []*ChatRoomForClient {
	s.mu.RLock()
	chatIDs := s.userChats[userID]
	s.mu.RUnlock()

	chats := make([]*ChatRoomForClient, 0, len(chatIDs))
	for _, chatID := range chatIDs {
		s.mu.RLock()
		chat := s.chats[chatID]
		s.mu.RUnlock()

		if chat != nil {
			chat.mu.Lock()
			currentUnreadCount := chat.UnreadCount[userID]
			chatCopy := &ChatRoomForClient{
				ID:                   chat.ID,
				Participants:         chat.Participants,
				ParticipantUsernames: chat.ParticipantUsernames,
				LastMessage:          chat.LastMessage,
				UnreadCount:          currentUnreadCount,
			}
			chat.mu.Unlock()
			chats = append(chats, chatCopy)
		}
	}

	return chats
}

func (s *MessagingStore) addMessage(chatID, senderID, senderUsername, content string) (*Message, error) {
	s.mu.RLock()
	chat := s.chats[chatID]
	s.mu.RUnlock()

	if chat == nil {
		return nil, nil
	}

	msg := &Message{
		ID:             generateID("MSG-"),
		ChatID:         chatID,
		SenderID:       senderID,
		SenderUsername: senderUsername,
		Content:        content,
		Timestamp:      time.Now().UnixMilli(),
		Read:           false,
	}

	chat.mu.Lock()
	chat.Messages = append(chat.Messages, msg)
	chat.LastMessage = msg
	
	// Increment unread for other participants
	for _, participantID := range chat.Participants {
		if participantID != senderID {
			chat.UnreadCount[participantID]++
		}
	}
	chat.mu.Unlock()

	// Broadcast to WebSocket clients
	s.broadcastMessage(msg)

	return msg, nil
}

func (s *MessagingStore) getMessages(chatID string) []*Message {
	s.mu.RLock()
	chat := s.chats[chatID]
	s.mu.RUnlock()

	if chat == nil {
		return []*Message{}
	}

	chat.mu.Lock()
	defer chat.mu.Unlock()

	messages := make([]*Message, len(chat.Messages))
	copy(messages, chat.Messages)
	return messages
}

func (s *MessagingStore) markAsRead(chatID, userID string) {
	s.mu.RLock()
	chat := s.chats[chatID]
	s.mu.RUnlock()

	if chat != nil {
		chat.mu.Lock()
		chat.UnreadCount[userID] = 0
		chat.mu.Unlock()
	}
}

func (s *MessagingStore) registerWSClient(userID string, conn *websocket.Conn) {
	s.mu.Lock()
	if oldConn, exists := s.wsClients[userID]; exists {
		oldConn.Close()
	}
	s.wsClients[userID] = conn
	s.mu.Unlock()
}

func (s *MessagingStore) unregisterWSClient(userID string) {
	s.mu.Lock()
	delete(s.wsClients, userID)
	s.mu.Unlock()
}

func (s *MessagingStore) broadcastMessage(msg *Message) {
	s.mu.RLock()
	chat := s.chats[msg.ChatID]
	s.mu.RUnlock()

	if chat == nil {
		return
	}

	data := map[string]interface{}{
		"type":    "new_message",
		"message": msg,
	}

	jsonData, _ := json.Marshal(data)

	for _, participantID := range chat.Participants {
		s.mu.RLock()
		conn := s.wsClients[participantID]
		s.mu.RUnlock()

		if conn != nil {
			if err := conn.WriteMessage(websocket.TextMessage, jsonData); err != nil {
				log.Printf("Failed to send message to %s: %v", participantID, err)
			}
		}
	}
}

// HTTP Handlers

func handleCreateChat(authStore *AuthStore, msgStore *MessagingStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := extractToken(r)
		user, err := authStore.getUserByToken(token)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			Username string `json:"username"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		authStore.mu.RLock()
		targetUser, exists := authStore.users[req.Username]
		authStore.mu.RUnlock()

		if !exists {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"message": "User not found"})
			return
		}

		chat := msgStore.getOrCreateChat(user.UserID, targetUser.UserID, user.Username, targetUser.Username)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"chatId": chat.ID})
	}
}

func handleGetChats(authStore *AuthStore, msgStore *MessagingStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := extractToken(r)
		user, err := authStore.getUserByToken(token)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		chats := msgStore.getUserChats(user.UserID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"chats": chats})
	}
}

func handleGetMessages(authStore *AuthStore, msgStore *MessagingStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := extractToken(r)
		_, err := authStore.getUserByToken(token)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 4 {
			http.Error(w, "Invalid chat ID", http.StatusBadRequest)
			return
		}
		chatID := parts[3]

		messages := msgStore.getMessages(chatID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"messages": messages})
	}
}

func handleSendMessage(authStore *AuthStore, msgStore *MessagingStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := extractToken(r)
		user, err := authStore.getUserByToken(token)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 4 {
			http.Error(w, "Invalid chat ID", http.StatusBadRequest)
			return
		}
		chatID := parts[3]

		var req struct {
			Content string `json:"content"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		msg, err := msgStore.addMessage(chatID, user.UserID, user.Username, req.Content)
		if err != nil || msg == nil {
			http.Error(w, "Failed to send message", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"message": msg})
	}
}

func handleMarkAsRead(authStore *AuthStore, msgStore *MessagingStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := extractToken(r)
		user, err := authStore.getUserByToken(token)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 4 {
			http.Error(w, "Invalid chat ID", http.StatusBadRequest)
			return
		}
		chatID := parts[3]

		msgStore.markAsRead(chatID, user.UserID)

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleMessagingWebSocket(authStore *AuthStore, msgStore *MessagingStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		user, err := authStore.getUserByToken(token)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("WebSocket upgrade error:", err)
			return
		}

		msgStore.registerWSClient(user.UserID, conn)
		defer msgStore.unregisterWSClient(user.UserID)

		// Keep connection alive
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}
}
