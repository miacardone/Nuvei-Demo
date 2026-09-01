import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LOGIN_ROUTE } from '@/data/navigation';

export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={LOGIN_ROUTE} replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default RequireAuth;
