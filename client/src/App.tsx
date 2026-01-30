import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MessagingProvider } from './contexts/MessagingContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Chats } from './pages/Chats';
import { Chat } from './pages/Chat';
import { QuickCall } from './pages/QuickCall';
import CallRoom from './pages/CallRoom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  return user ? <Navigate to="/chats" /> : <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MessagingProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/quick-call" element={<QuickCall />} />
            <Route path="/call/:roomId" element={<CallRoom />} />
            <Route path="/chats" element={<ProtectedRoute><Chats /></ProtectedRoute>} />
            <Route path="/chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          </Routes>
        </MessagingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
