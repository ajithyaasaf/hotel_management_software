import { Router } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

const router = Router();
router.use(authenticate);

// GET /api/permissions — list all permissions with role assignments
router.get('/', requirePermission('permission.manage'), async (_req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      include: { rolePermissions: { select: { role: true } } },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
    res.json(permissions);
  } catch { res.status(500).json({ error: 'Failed to fetch permissions' }); }
});

// GET /api/permissions/matrix — role-permission matrix for admin UI
router.get('/matrix', requirePermission('permission.manage'), async (_req, res) => {
  try {
    const [permissions, rolePermissions] = await Promise.all([
      prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] }),
      prisma.rolePermission.findMany({ include: { permission: { select: { code: true } } } }),
    ]);

    const roles = ['MD', 'ACCOUNT_MANAGER', 'OPERATIONAL_MANAGER', 'RESTAURANT_MANAGER', 'RECEPTIONIST'];
    const matrix: Record<string, Record<string, boolean>> = {};

    for (const perm of permissions) {
      matrix[perm.code] = {};
      for (const role of roles) {
        matrix[perm.code][role] = rolePermissions.some(rp => rp.permission.code === perm.code && rp.role === role);
      }
    }

    res.json({ permissions, roles, matrix });
  } catch { res.status(500).json({ error: 'Failed to fetch permission matrix' }); }
});

// PUT /api/permissions/grant — grant a permission to a role
router.put('/grant', requirePermission('permission.manage'), async (req: AuthRequest, res) => {
  try {
    const { role, permissionCode } = req.body;
    if (!role || !permissionCode) { res.status(400).json({ error: 'role and permissionCode are required' }); return; }

    const permission = await prisma.permission.findUnique({ where: { code: permissionCode } });
    if (!permission) { res.status(404).json({ error: 'Permission not found' }); return; }

    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role, permissionId: permission.id } },
      update: {},
      create: { role, permissionId: permission.id },
    });

    await createAuditLog({
      action: 'PERMISSION_GRANTED',
      entity: 'permission',
      entityId: permission.id,
      details: `Granted "${permission.name}" to role ${role}`,
      userId: req.user!.id,
      newValue: { role, permission: permissionCode },
    });

    res.json({ message: 'Permission granted' });
  } catch { res.status(500).json({ error: 'Failed to grant permission' }); }
});

// PUT /api/permissions/revoke — revoke a permission from a role
router.put('/revoke', requirePermission('permission.manage'), async (req: AuthRequest, res) => {
  try {
    const { role, permissionCode } = req.body;
    if (!role || !permissionCode) { res.status(400).json({ error: 'role and permissionCode are required' }); return; }

    const permission = await prisma.permission.findUnique({ where: { code: permissionCode } });
    if (!permission) { res.status(404).json({ error: 'Permission not found' }); return; }

    await prisma.rolePermission.deleteMany({ where: { role, permissionId: permission.id } });

    await createAuditLog({
      action: 'PERMISSION_REVOKED',
      entity: 'permission',
      entityId: permission.id,
      details: `Revoked "${permission.name}" from role ${role}`,
      userId: req.user!.id,
      oldValue: { role, permission: permissionCode },
    });

    res.json({ message: 'Permission revoked' });
  } catch { res.status(500).json({ error: 'Failed to revoke permission' }); }
});

export default router;
