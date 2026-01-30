package main

import (
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	// Initialize stores
	authStore := newAuthStore()
	msgStore := newMessagingStore()

	// Simple CORS middleware
	enableCors := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
			if r.Method == "OPTIONS" {
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				w.WriteHeader(http.StatusNoContent)
				return
			}
			h(w, r)
		}
	}

	// Auth endpoints
	http.HandleFunc("/api/auth/register", enableCors(handleRegister(authStore)))
	http.HandleFunc("/api/auth/login", enableCors(handleLogin(authStore)))
	http.HandleFunc("/api/users/search", enableCors(handleSearchUsers(authStore)))

	// Messaging endpoints
	http.HandleFunc("/api/chats", enableCors(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handleGetChats(authStore, msgStore)(w, r)
		case http.MethodPost:
			handleCreateChat(authStore, msgStore)(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// Chat-specific endpoints - we'll handle routing manually
	http.HandleFunc("/api/chats/", enableCors(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path[len(r.URL.Path)-9:] == "/messages" {
			switch r.Method {
			case http.MethodGet:
				handleGetMessages(authStore, msgStore)(w, r)
			case http.MethodPost:
				handleSendMessage(authStore, msgStore)(w, r)
			}
		} else if r.URL.Path[len(r.URL.Path)-5:] == "/read" {
			handleMarkAsRead(authStore, msgStore)(w, r)
		} else {
			http.Error(w, "Not found", http.StatusNotFound)
		}
	}))

	// WebSocket for messaging
	http.HandleFunc("/ws-msg", handleMessagingWebSocket(authStore, msgStore))

	// Room ID endpoint for quick calls
    http.HandleFunc("/api/room-id", enableCors(handleRoomID()))

	http.HandleFunc("/.well-known/assetlinks.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.serenada_v2",
      "sha256_cert_fingerprints": [
        "53:4C:45:58:80:B4:35:D2:DD:42:1F:7A:11:23:09:15:DD:5C:2C:8E:ED:A9:2B:B2:B9:A4:BF:86:93:2D:A9:F1"
      ]
    }
  }
]`))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

    log.Printf("Server starting on :%s", port)

    if err := InitPushService(); err != nil {
        log.Fatalf("Failed to initialize push service: %v", err)
    }

    // Push endpoints
    http.HandleFunc("/api/push/vapid-public-key", enableCors(handlePushVapidKey))
    http.HandleFunc("/api/push/subscribe", enableCors(handlePushSubscribe))
    http.HandleFunc("/api/push/recipients", enableCors(handlePushRecipients))
    http.Handle("/api/push/snapshot/", enableCors(http.StripPrefix("/api/push/snapshot", http.HandlerFunc(handlePushSnapshot))))
	server := &http.Server{
		Addr:              ":" + port,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      0,
		IdleTimeout:       60 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
