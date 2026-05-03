import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAdmin from './components/RequireAdmin';
import { ThemeProvider } from './context/ThemeContext';
import { AdminPanel2 } from './components/AdminPanel2';
import AdminExternalPage from './pages/AdminExternalPage';
import AdminGalleryPage from './pages/AdminGalleryPage';
import AdminHelpPage from './pages/AdminHelpPage';
import AdminLoginPage from './pages/AdminLoginPage';
import ArchivePage from './pages/ArchivePage';
import ExpenseTrackerPage from './pages/ExpenseTrackerPage';
import FrontendPage from './pages/FrontendPage';
import GalleryPage from './pages/GalleryPage';
import MenuAdminPanel from './pages/MenuAdminPanel';
import ProfitCalculator from './pages/ProfitCalculator';

function App() {
  return (
    <ThemeProvider>
    <Routes>
      <Route path="/" element={<FrontendPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={(
          <RequireAdmin>
            <AdminPanel2 />
          </RequireAdmin>
        )}
      />
      <Route
        path="/admin/external"
        element={(
          <RequireAdmin>
            <AdminExternalPage />
          </RequireAdmin>
        )}
      />
      <Route
        path="/admin/help"
        element={(
          <RequireAdmin>
            <AdminHelpPage />
          </RequireAdmin>
        )}
      />
      <Route
        path="/admin/archive"
        element={(
          <RequireAdmin>
            <ArchivePage />
          </RequireAdmin>
        )}
      />
      <Route
        path="/admin/profit-calculator"
        element={(
          <RequireAdmin>
            <ProfitCalculator />
          </RequireAdmin>
        )}
      />
      <Route
        path="/admin/expense-tracker"
        element={(
          <RequireAdmin>
            <ExpenseTrackerPage />
          </RequireAdmin>
        )}
      />
      <Route
        path="/admin/menu"
        element={(
          <RequireAdmin>
            <MenuAdminPanel />
          </RequireAdmin>
        )}
      />
      <Route
        path="/admin/gallery"
        element={(
          <RequireAdmin>
            <AdminGalleryPage />
          </RequireAdmin>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ThemeProvider>
  );
}

export default App;
