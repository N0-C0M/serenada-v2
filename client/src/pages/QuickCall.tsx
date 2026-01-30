import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Share2 } from 'lucide-react';
import { generateRandomRoomId } from '../utils/callHistory'; // Assuming this utility exists
import { useToast } from '../contexts/ToastContext';

export const QuickCall: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleStartCall = () => {
    setIsLoading(true);
    const roomId = generateRandomRoomId();
    navigate(`/call/${roomId}`);
  };

  const handleShareLink = () => {
    const roomId = generateRandomRoomId();
    const callLink = `${window.location.origin}/call/${roomId}`;
    navigator.clipboard.writeText(callLink)
      .then(() => showToast('success', 'Call link copied to clipboard!'))
      .catch(() => showToast('error', 'Failed to copy link.'));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Serenada Quick Call
          </h1>
          <p className="text-gray-600 mt-2">Start an instant video call or share a link</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 animate-slide-up space-y-6">
          <button
            onClick={handleStartCall}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center justify-center"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Starting call...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Video className="w-5 h-5 mr-2" />
                Start Instant Call
              </span>
            )}
          </button>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-400">OR</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <button
            onClick={handleShareLink}
            className="w-full bg-white border border-indigo-400 text-indigo-600 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center justify-center"
          >
            <Share2 className="w-5 h-5 mr-2" />
            Share Call Link
          </button>
        </div>
      </div>
    </div>
  );
};
