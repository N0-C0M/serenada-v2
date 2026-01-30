import React from 'react';
import { Link } from 'react-router-dom';
import { Video, LogIn, UserPlus } from 'lucide-react';

export const Home: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Serenada
          </h1>
          <p className="text-gray-600 mt-2">Connect with anyone, anywhere</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 animate-slide-up space-y-4">
          {/* Quick Call Button */}
          <Link
            to="/quick-call"
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-200 flex items-center justify-center"
          >
            <Video className="w-5 h-5 mr-2" />
            Start Instant Call
          </Link>

          {/* Login Button */}
          <Link
            to="/login"
            className="w-full bg-white border border-indigo-400 text-indigo-600 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center justify-center"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Sign In
          </Link>

          {/* Register Button */}
          <Link
            to="/register"
            className="w-full bg-white border border-indigo-400 text-indigo-600 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center justify-center"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};
