import { Navigate, Route, Routes, useLocation } from 'react-router';
import { NotFoundPage } from './components/states/States';
import { ExplorerPage } from './pages/ExplorerPage';

/** `/` keeps any query string when it forwards to `/explorer`. */
function RootRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/explorer', search }} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/explorer" element={<ExplorerPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
