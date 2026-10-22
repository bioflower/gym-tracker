import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { AuthGuard } from './components/AuthGuard';
import { Navigation } from './components/Navigation';
import { TodayPage } from './pages/TodayPage';
import { PlanPage } from './pages/PlanPage';
import { ExerciseLibraryPage } from './pages/ExerciseLibraryPage';
import { HistoryPage } from './pages/HistoryPage';
import { OneRepMaxPage } from './pages/OneRepMaxPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/*" element={
            <AuthGuard>
              <div className="app">
                <Navigation />
                <main className="main-content">
                  <Routes>
                    <Route path="/" element={<TodayPage />} />
                    <Route path="/plan" element={<PlanPage />} />
                    <Route path="/exercises" element={<ExerciseLibraryPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/one-rep-max" element={<OneRepMaxPage />} />
                  </Routes>
                </main>
              </div>
            </AuthGuard>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
