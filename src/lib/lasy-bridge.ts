
// src/lib/lasy-bridge.ts
// Todas as chamadas da área admin ficam centralizadas aqui.
// Se os endpoints da sua API forem diferentes, é só ajustar estes fetch().

export type AdminOverview = {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  pendingReports: number;
};

export type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  isBanned: boolean;
  createdAt: string;
  lastActiveAt: string | null;
};

export type AdminReport = {
  id: string;
  commentId: string;
  commentPreview: string;
  reason: string;
  createdAt: string;
  reporterId: string;
  status: 'pending' | 'resolved' | 'rejected';
};

export type AdminBan = {
  id: string;
  userId: string;
  userEmail: string;
  reason: string | null;
  createdAt: string;
  active: boolean;
};

async function handleResponse(res: Response) {
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // ignora
    }
    throw new Error(
      `Erro na API admin. Status: ${res.status}. Resposta: ${body}`
    );
  }

  return res.json();
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const res = await fetch('/api/admin/overview', { credentials: 'include' });
  return handleResponse(res);
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await fetch('/api/admin/users', { credentials: 'include' });
  return handleResponse(res);
}

export async function getAdminReports(): Promise<AdminReport[]> {
  const res = await fetch('/api/admin/reports', { credentials: 'include' });
  return handleResponse(res);
}

export async function getAdminBans(): Promise<AdminBan[]> {
  const res = await fetch('/api/admin/bans', { credentials: 'include' });
  return handleResponse(res);
}

export async function updateUserStatus(
  userId: string,
  action: 'ban' | 'unban'
): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ action }),
  });

  await handleResponse(res);
}

export async function resolveReport(
  reportId: string,
  action: 'keep' | 'remove'
): Promise<void> {
  const res = await fetch(`/api/admin/reports/${reportId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ action }),
  });

  await handleResponse(res);
}
