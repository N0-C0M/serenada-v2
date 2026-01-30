import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  timestamp: number;
  read: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  participantUsernames: { [userId: string]: string };
  lastMessage?: Message;
  unreadCount: number;
}

interface MessagingContextType {
  chats: Chat[];
  messages: { [chatId: string]: Message[] };
  sendMessage: (chatId: string, content: string) => Promise<void>;
  createChat: (username: string) => Promise<string>;
  loadMessages: (chatId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<{ username: string; userId: string }[]>;
  markAsRead: (chatId: string) => Promise<void>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const MessagingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<{ [chatId: string]: Message[] }>({});

  useEffect(() => {
    if (!user || !token) {
      setChats([]);
      setMessages({});
      return;
    }

    // Load chats
    loadChats();

    // Setup WebSocket for real-time messages
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws-msg?token=${token}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'new_message') {
        const msg: Message = data.message;
        setMessages(prev => ({
          ...prev,
          [msg.chatId]: [...(prev[msg.chatId] || []), msg]
        }));
        
        // Update chat list
        setChats(prev => {
          const updated = prev.map(chat => {
            if (chat.id === msg.chatId) {
              return {
                ...chat,
                lastMessage: msg,
                unreadCount: msg.senderId !== user.userId ? chat.unreadCount + 1 : chat.unreadCount
              };
            }
            return chat;
          });
          // Sort by last message time
          return updated.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
        });
      }
    };

    return () => {
      websocket.close();
    };
  }, [user, token]);

  const loadChats = async () => {
    if (!token) return;
    
    const response = await fetch('/api/chats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      setChats(data.chats || []);
    }
  };

  const loadMessages = async (chatId: string) => {
    if (!token) return;
    
    const response = await fetch(`/api/chats/${chatId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      setMessages(prev => ({
        ...prev,
        [chatId]: data.messages || []
      }));
    }
  };

  const sendMessage = async (chatId: string, content: string) => {
    if (!token) return;
    
    const response = await fetch(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
  };

  const createChat = async (username: string): Promise<string> => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch('/api/chats', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create chat');
    }
    
    const data = await response.json();
    await loadChats(); // Refresh chat list
    return data.chatId;
  };

  const searchUsers = async (query: string) => {
    if (!token || !query.trim()) return [];
    
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.users || [];
    }
    return [];
  };

  const markAsRead = async (chatId: string) => {
    if (!token) return;
    
    await fetch(`/api/chats/${chatId}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
    ));
  };

  return (
    <MessagingContext.Provider value={{ 
      chats, 
      messages, 
      sendMessage, 
      createChat, 
      loadMessages,
      searchUsers,
      markAsRead
    }}>
      {children}
    </MessagingContext.Provider>
  );
};

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within MessagingProvider');
  }
  return context;
};
