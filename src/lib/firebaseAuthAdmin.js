import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export function getServiceAccount() {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    const cleaned = serviceAccountEnv.trim().replace(/^['"]|['"]$/g, '');
    if (!cleaned.includes('[SENSITIVE]')) {
      try {
        return JSON.parse(cleaned);
      } catch {
        return JSON.parse(cleaned.replace(/\\n/g, '\n'));
      }
    }
  }

  // Fallback to local service-account.json
  try {
    const path = require('path');
    const fs = require('fs');
    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }
  } catch (e) {
    // ignore
  }

  throw new Error('Firebase Service Account not configured.');
}

export async function getIdentityToolkitClient() {
  const serviceAccount = getServiceAccount();
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/identitytoolkit',
      'https://www.googleapis.com/auth/firebase'
    ],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token || tokenResponse;
  const projectId = serviceAccount.project_id;

  return { token, projectId };
}

export async function createAuthUser({ email, password, displayName }) {
  const { token, projectId } = await getIdentityToolkitClient();
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      displayName,
      emailVerified: true
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || 'Failed to create user in Firebase Auth';
    const err = new Error(msg);
    err.code = data?.error?.message;
    throw err;
  }

  return { uid: data.localId, email: data.email, displayName: data.displayName };
}

export async function updateAuthPassword({ uid, password }) {
  const { token, projectId } = await getIdentityToolkitClient();
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      localId: uid,
      password
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || 'Failed to update user password in Firebase Auth';
    throw new Error(msg);
  }

  return data;
}

export async function lookupAuthUser(email) {
  const { token, projectId } = await getIdentityToolkitClient();
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: [email]
    })
  });

  const data = await res.json();
  if (data.users && data.users.length > 0) {
    return {
      uid: data.users[0].localId,
      email: data.users[0].email,
      displayName: data.users[0].displayName
    };
  }
  return null;
}

export async function updateAuthUser({ uid, password, displayName }) {
  const { token, projectId } = await getIdentityToolkitClient();
  const body = { localId: uid };
  if (password) body.password = password;
  if (displayName) body.displayName = displayName;

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || 'Failed to update user in Firebase Auth';
    throw new Error(msg);
  }

  return { uid: data.localId, email: data.email, displayName: data.displayName };
}

export async function deleteAuthUser(uid) {
  const { token, projectId } = await getIdentityToolkitClient();
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts/${uid}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Firebase Auth delete failed (${res.status}): ${text}`);
  }
}
