import type { PermissionKey, StaffProfile } from '@edc/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { adminApi, ApiError } from './admin-api';

/**
 * The signed-in staff member for an admin page. Sends anyone without a session back to the
 * sign-in page, and turns API errors into a message the page can show.
 */
export function useStaff() {
  const navigate = useNavigate();
  const [me, setMe] = useState<StaffProfile | null>(null);

  const problem = useCallback(
    (caught: unknown, fallback = 'Could not reach the server.') => {
      if (caught instanceof ApiError && caught.status === 401) {
        navigate('/admin/login', { replace: true });
        return '';
      }
      return caught instanceof ApiError ? caught.message : fallback;
    },
    [navigate],
  );

  useEffect(() => {
    adminApi
      .me()
      .then(setMe)
      .catch((caught: unknown) => problem(caught));
  }, [problem]);

  const can = useCallback(
    (permission: PermissionKey) => me?.permissions.includes(permission) ?? false,
    [me],
  );

  return { me, can, problem };
}
