import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMessaging } from '../contexts/MessagingContext';
import { ArrowLeft, Send, Video, Phone } from 'lucide-react';

export const Chat: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const { chats, messages, loadMessages, sendMessage, markAsRead } = useMessaging();
  const navigate = useNavigate();
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = chats.find(c => c.id === chatId);
  const chatMessages = chatId ? messages[chatId] || [] : [];

  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
      markAsRead(chatId);
    }
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !chatId || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(chatId, messageText);
      setMessageText('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartCall = () => {
    // Create a call room and navigate to it
    fetch('/api/room-id', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.roomId) {
          // Send call link as message
          const callLink = `${window.location.origin}/call/${data.roomId}`;
          sendMessage(chatId!, `📞 Video call: ${callLink}`);
          navigate(`/call/${data.roomId}`);
        }
      })
      .catch(err => console.error('Failed to create call:', err));
  };

  if (!chat) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Chat not found</p>
          <button
            onClick={() => navigate('/chats')}
            className="text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            Back to chats
          </button>
        </div>
      </div>
    );
  }

  const otherUserId = chat.participants.find(id => id !== user?.userId);
  const otherUsername = otherUserId ? chat.participantUsernames[otherUserId] : 'Unknown';

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/chats')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-lg">
                {otherUsername.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">@{otherUsername}</h2>
              <p className="text-xs text-gray-500">Online</p>
            </div>
          </div>
          <button
            onClick={handleStartCall}
            className="p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
            title="Start video call"
          >
            <Video className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6">
        {chatMessages.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Start chatting</h3>
            <p className="text-gray-600">Send a message or start a video call</p>
          </div>
        ) : (
          <div className="space-y-4">
            {chatMessages.map((msg, idx) => {
              const isOwn = msg.senderId === user?.userId;
              const showAvatar = idx === 0 || chatMessages[idx - 1].senderId !== msg.senderId;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-slide-up`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className={`flex items-end space-x-2 max-w-[70%] ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {!isOwn && showAvatar && (
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-semibold">
                          {otherUsername.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {!isOwn && !showAvatar && <div className="w-8" />}
                    <div className="flex flex-col">
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        <p className="text-sm break-words">{msg.content}</p>
                      </div>
                      <span className={`text-xs text-gray-500 mt-1 ${isOwn ? 'text-right' : 'text-left'} px-2`}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 sticky bottom-0">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={!messageText.trim() || isSending}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-indigo-200"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
