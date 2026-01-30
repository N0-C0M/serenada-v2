import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMessaging } from '../contexts/MessagingContext';
import { LogOut, Search, Video, MessageCircle, X, Plus } from 'lucide-react';

export const Chats: React.FC = () => {
  const { user, logout } = useAuth();
  const { chats, createChat, searchUsers } = useMessaging();
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ username: string; userId: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError('');
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results.filter(u => u.username !== user?.username));
    } catch (err) {
      setError('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async (username: string) => {
    setError('');
    try {
      const chatId = await createChat(username);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
      navigate(`/chat/${chatId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start chat');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Chats</h1>
              <p className="text-sm text-gray-600">@{user?.username}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/quick-call')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Quick Call"
            >
              <Video className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat List */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {chats.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No chats yet</h3>
            <p className="text-gray-600 mb-6">Search for users to start chatting</p>
            <button
              onClick={() => setShowSearch(true)}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all transform hover:scale-105"
            >
              <Search className="w-5 h-5 mr-2" />
              Find Users
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => {
              const otherUserId = chat.participants.find(id => id !== user?.userId);
              const otherUsername = otherUserId ? chat.participantUsernames[otherUserId] : 'Unknown';

              return (
                <div
                  key={chat.id}
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  className="bg-white rounded-xl p-4 hover:shadow-md transition-all cursor-pointer border border-gray-100 animate-slide-up hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-lg">
                          {otherUsername.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900 truncate">@{otherUsername}</h3>
                          {chat.lastMessage && (
                            <span className="text-xs text-gray-500 ml-2">
                              {formatTime(chat.lastMessage.timestamp)}
                            </span>
                          )}
                        </div>
                        {chat.lastMessage && (
                          <p className="text-sm text-gray-600 truncate">
                            {chat.lastMessage.senderId === user?.userId ? 'You: ' : ''}
                            {chat.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                    {chat.unreadCount > 0 && (
                      <div className="ml-3 bg-indigo-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {chat.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Search Button */}
      <button
        onClick={() => setShowSearch(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-110 flex items-center justify-center z-20"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-30 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md mt-20 shadow-2xl animate-slide-up">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Find Users</h2>
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    setError('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search username..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
              {error && (
                <div className="mt-2 text-sm text-red-600 animate-shake">{error}</div>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {isSearching ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {searchResults.map((result) => (
                    <div
                      key={result.userId}
                      onClick={() => handleStartChat(result.username)}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors flex items-center space-x-3"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {result.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">@{result.username}</span>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="p-8 text-center text-gray-500">No users found</div>
              ) : (
                <div className="p-8 text-center text-gray-500">Type to search users</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
