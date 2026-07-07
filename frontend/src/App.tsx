import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CompareProvider } from './context/CompareContext';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ESCExplorer } from './pages/ESCExplorer';
import { PropellerExplorer } from './pages/PropellerExplorer';
import { PerformanceAnalytics } from './pages/PerformanceAnalytics';

// Admin Pages
import { AdminUsers } from './pages/AdminUsers';
import { AdminAccessRequests } from './pages/AdminAccessRequests';
import { AdminSchemaCustomizer } from './pages/AdminSchemaCustomizer';
import { AdminAuditLogs } from './pages/AdminAuditLogs';
import { AdminImports } from './pages/AdminImports';
import { AdminExports } from './pages/AdminExports';
import { Profile } from './pages/Profile';
import { ItemProfile } from './pages/ItemProfile';

// Admin Route checks
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-xs font-semibold text-slate-400 font-mono">
        Verifying administrative role policies...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-xs font-semibold text-rose-500 font-mono p-4 text-center">
        <span>Access Denied: Administrative role required for the admin portal.</span>
        <button onClick={() => window.location.href = '/'} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg cursor-pointer">
          Go back to Login
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CompareProvider>
          <Router>
            <Routes>
              {/* Public Login Route */}
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />

              {/* Admin Portal Views */}
              <Route path="/admin/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
              
              <Route path="/admin/escs" element={<AdminRoute><ESCExplorer /></AdminRoute>} />
              <Route path="/escs" element={<Navigate to="/admin/escs" replace />} />

              <Route path="/admin/propellers" element={<AdminRoute><PropellerExplorer /></AdminRoute>} />
              <Route path="/propellers" element={<Navigate to="/admin/propellers" replace />} />

              <Route path="/admin/analytics" element={<AdminRoute><PerformanceAnalytics /></AdminRoute>} />
              <Route path="/analytics" element={<Navigate to="/admin/analytics" replace />} />

              <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
              <Route path="/admin/access-requests" element={<AdminRoute><AdminAccessRequests /></AdminRoute>} />
              <Route path="/admin/schema-customizer" element={<AdminRoute><AdminSchemaCustomizer /></AdminRoute>} />
              <Route path="/admin/audit-logs" element={<AdminRoute><AdminAuditLogs /></AdminRoute>} />
              <Route path="/admin/imports" element={<AdminRoute><AdminImports /></AdminRoute>} />
              <Route path="/admin/exports" element={<AdminRoute><AdminExports /></AdminRoute>} />
              <Route path="/admin/profile" element={<AdminRoute><Profile /></AdminRoute>} />

              {/* Specification Profile Dedicated Routes */}
              <Route path="/admin/motor/profile/:name" element={<AdminRoute><ItemProfile type="motor" /></AdminRoute>} />
              <Route path="/admin/motor/:name" element={<AdminRoute><ItemProfile type="motor" /></AdminRoute>} />
              <Route path="/motor/profile/:name" element={<AdminRoute><ItemProfile type="motor" /></AdminRoute>} />
              <Route path="/motor/:name" element={<AdminRoute><ItemProfile type="motor" /></AdminRoute>} />

              <Route path="/admin/esc/profile/:name" element={<AdminRoute><ItemProfile type="esc" /></AdminRoute>} />
              <Route path="/admin/esc/:name" element={<AdminRoute><ItemProfile type="esc" /></AdminRoute>} />
              <Route path="/esc/profile/:name" element={<AdminRoute><ItemProfile type="esc" /></AdminRoute>} />
              <Route path="/esc/:name" element={<AdminRoute><ItemProfile type="esc" /></AdminRoute>} />

              <Route path="/admin/propeller/profile/:name" element={<AdminRoute><ItemProfile type="propeller" /></AdminRoute>} />
              <Route path="/admin/propeller/:name" element={<AdminRoute><ItemProfile type="propeller" /></AdminRoute>} />
              <Route path="/propeller/profile/:name" element={<AdminRoute><ItemProfile type="propeller" /></AdminRoute>} />
              <Route path="/propeller/:name" element={<AdminRoute><ItemProfile type="propeller" /></AdminRoute>} />

              {/* Fallback routes redirects */}
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
          </Router>
        </CompareProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
