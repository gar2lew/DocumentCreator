import { useAppStore } from '../../store';
import type { User } from '../types';

type Role = User['role'];

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

interface Props {
  /** Minimum role required to see children */
  minRole: Role;
  /** Rendered when the user lacks permission */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({ minRole, fallback = null, children }: Props) {
  const { currentUser } = useAppStore();
  if (!currentUser) return <>{fallback}</>;

  const userLevel = ROLE_LEVEL[currentUser.role] ?? 0;
  const requiredLevel = ROLE_LEVEL[minRole] ?? 0;

  if (userLevel < requiredLevel) return <>{fallback}</>;
  return <>{children}</>;
}

/** Returns true if the current user meets the minimum role */
export function useCanDo(minRole: Role): boolean {
  const { currentUser } = useAppStore();
  if (!currentUser) return false;
  return (ROLE_LEVEL[currentUser.role] ?? 0) >= (ROLE_LEVEL[minRole] ?? 0);
}
