import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthListener } from './features/auth/hooks/useAuth';
import { useAppStore } from './store';
import { LoginForm } from './features/auth/components/LoginForm';
import { Layout } from './shared/components/Layout';
import { Dashboard } from './pages/Dashboard';
import { TemplateList } from './features/templates/components/TemplateList';
import { TemplateEditorPage } from './pages/TemplateEditorPage';
import { ProjectList } from './features/projects/components/ProjectList';
import { DocumentHistory } from './features/export/components/DocumentHistory';
import { DealCreatorPage } from './pages/DealCreatorPage';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, authLoading } = useAppStore();
  if (authLoading) return <SplashScreen />;
  if (!currentUser?.organisationId) return <LoginForm />;
  return <>{children}</>;
}

function SplashScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  useAuthListener();

  return (
    <BrowserRouter>
      <AuthGuard>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/templates" element={<TemplateList />} />
            <Route path="/templates/:id" element={<TemplateEditorPage />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/deals/new" element={<DealCreatorPage />} />
            <Route path="/history" element={<DocumentHistory />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  );
}
