import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPerspective, isValidPerspective } from '@/data/perspectives';
import { navFor, navLeavesFor, routesFor, landingRouteFor, titleForPath } from '@/data/navigation';
import brand from '@/brand/brand.config';

/**
 * Reads the active perspective straight from the URL's `:perspective`
 * segment — there is no separate state to fall out of sync with the route.
 * Must be called from inside the `/:perspective/*` route tree.
 */
export function usePerspective() {
  const { perspective: param } = useParams();
  const navigate = useNavigate();
  const id = isValidPerspective(param) ? param : 'merchant';
  const meta = getPerspective(id);

  const terms = useMemo(() => ({ ...brand.terms, ...meta.terms }), [meta]);
  const routes = useMemo(() => routesFor(id), [id]);
  const nav = useMemo(() => navFor(id), [id]);
  const navLeaves = useMemo(() => navLeavesFor(id), [id]);

  return {
    id,
    meta,
    terms,
    nav,
    navLeaves,
    routes,
    titleForPath: (pathname) => titleForPath(pathname, id),
    /** Switches perspective and jumps to its landing page — a lens change, not a re-login. */
    switchTo: (nextId) => navigate(landingRouteFor(nextId)),
  };
}

export default usePerspective;
