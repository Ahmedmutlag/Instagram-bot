import { prisma } from "../lib/prisma";

interface RecordAuditParams {
  adminId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

export async function recordAudit(params: RecordAuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      adminId: params.adminId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      oldValue: params.oldValue as any,
      newValue: params.newValue as any,
      ipAddress: params.ipAddress ?? null,
    },
  });
}
