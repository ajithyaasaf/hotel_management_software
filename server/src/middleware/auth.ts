import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    permissions?: string[]; // permission codes loaded from DB
  };
}

/**
 * Authenticate via JWT and verify the user still exists in the database.
 * Also loads the user's permission codes for downstream authorization checks.
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

    // Best Practice check: Verify user still exists in the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User account has been removed or deactivated. Please log in again.' });
      return;
    }

    // Load permissions for this role
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role: user.role },
      include: { permission: { select: { code: true } } },
    });

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      permissions: rolePermissions.map(rp => rp.permission.code),
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Legacy role-based authorization (kept for backward compatibility).
 * Prefer requirePermission() for new code.
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
};

/**
 * Permission-based authorization middleware.
 * Checks if the user's role has ANY of the specified permission codes.
 * MD role always passes (superadmin).
 *
 * Usage: requirePermission('tariff.edit')
 *        requirePermission('booking.cancel', 'booking.cancel.request')
 */
export const requirePermission = (...permissionCodes: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // MD always has all permissions (superadmin)
    if (req.user.role === 'MD') {
      next();
      return;
    }

    const userPerms = req.user.permissions || [];
    const hasPermission = permissionCodes.some(code => userPerms.includes(code));

    if (!hasPermission) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }
    next();
  };
};

/**
 * Check if the authenticated user has a specific permission.
 * Useful for conditional logic inside route handlers.
 */
export function hasPermission(req: AuthRequest, permissionCode: string): boolean {
  if (!req.user) return false;
  if (req.user.role === 'MD') return true;
  return (req.user.permissions || []).includes(permissionCode);
}
