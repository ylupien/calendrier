async function request(method, url, body) {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function upload(url, file) {
  const res = await fetch(`/api${url}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const api = {
  me: () => request('GET', '/me'),
  saveMe: (profile) => request('PUT', '/me', profile),
  occasions: () => request('GET', '/occasions'),
  createOccasion: (data) => request('POST', '/occasions', data),
  occasion: (slug) => request('GET', `/occasions/${encodeURIComponent(slug)}`),
  archiveOccasion: (slug, archived) => request('POST', `/occasions/${encodeURIComponent(slug)}/archive`, { archived }),
  updateOccasion: (slug, data) => request('PATCH', `/occasions/${encodeURIComponent(slug)}`, data),
  addSlot: (slug, slot) => request('POST', `/occasions/${encodeURIComponent(slug)}/slots`, slot),
  updateSlot: (slug, id, range) => request('PATCH', `/occasions/${encodeURIComponent(slug)}/slots/${id}`, range),
  createLink: () => request('POST', '/link'),
  linkStatus: (id) => request('GET', `/link/${id}/status`),
  linkPreview: (token) => request('GET', `/link/preview/${encodeURIComponent(token)}`),
  claimLink: (token, merge) => request('POST', '/link/claim', { token, merge }),
  organizations: () => request('GET', '/organizations'),
  organization: (id) => request('GET', `/organizations/${id}`),
  createOrganization: (data) => request('POST', '/organizations', data),
  updateOrganization: (id, data) => request('PATCH', `/organizations/${id}`, data),
  deleteOrganization: (id) => request('DELETE', `/organizations/${id}`),
  setMember: (id, userId, data) => request('PUT', `/organizations/${id}/members/${userId}`, data),
  removeMember: (id, userId) => request('DELETE', `/organizations/${id}/members/${userId}`),
  restoreMember: (id, userId) => request('POST', `/organizations/${id}/members/${userId}/restore`),
  guestCandidates: (slug) => request('GET', `/occasions/${encodeURIComponent(slug)}/candidates`),
  addGuests: (slug, userIds) => request('POST', `/occasions/${encodeURIComponent(slug)}/participants`, { userIds }),
  transferOwner: (slug, userId) => request('POST', `/occasions/${encodeURIComponent(slug)}/owner`, { userId }),
  removeGuest: (slug, userId) => request('DELETE', `/occasions/${encodeURIComponent(slug)}/participants/${userId}`),
  uploadLogo: (id, file) => upload(`/organizations/${id}/logo`, file),
  deleteLogo: (id) => request('DELETE', `/organizations/${id}/logo`),
  deleteSlot: (slug, id) => request('DELETE', `/occasions/${encodeURIComponent(slug)}/slots/${id}`),
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  emailLink: (email, retour) => request('POST', '/auth/email-link', { email, retour }),
  setPassword: (password, currentPassword) => request('PUT', '/me/password', { password, currentPassword }),
  admin: {
    users: () => request('GET', '/admin/users'),
    user: (id) => request('GET', `/admin/users/${id}`),
    createUser: (data) => request('POST', '/admin/users', data),
    updateUser: (id, data) => request('PATCH', `/admin/users/${id}`, data),
    deleteUser: (id) => request('DELETE', `/admin/users/${id}`),
    mergeUser: (id, intoUserId) => request('POST', `/admin/users/${id}/merge`, { intoUserId }),
    signInLink: (id) => request('POST', `/admin/users/${id}/link`),
    addToOrganization: (id, organizationId) => request('POST', `/admin/users/${id}/organizations`, { organizationId }),
    removeFromOrganization: (id, orgId) => request('DELETE', `/admin/users/${id}/organizations/${orgId}`),
    addToOccasion: (id, occasionId) => request('POST', `/admin/users/${id}/occasions`, { occasionId }),
    removeFromOccasion: (id, occasionId) => request('DELETE', `/admin/users/${id}/occasions/${occasionId}`),
    organizations: () => request('GET', '/admin/organizations'),
    occasions: () => request('GET', '/admin/occasions'),
    deleteOccasion: (id) => request('DELETE', `/admin/occasions/${id}`),
  },
};
