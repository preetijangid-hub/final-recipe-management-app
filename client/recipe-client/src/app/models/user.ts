export interface User {
  _id: string;
  // The auth API (/api/auth/register, /api/auth/login) stores the Mongo
  // id under "id", so the saved user object uses that field name.
  id?: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Creator profile as returned by /api/profiles/me. The photo is a URL
 * string; an empty string means the user has no photo yet.
 */
export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  profession: string;
  profilePhoto: string;
}

export interface ProfileResponse {
  profile: UserProfile;
}

export interface ProfileUpdateResponse {
  message: string;
  profile: UserProfile;
}

/**
 * Safe public creator fields served by GET /api/profiles/:userId.
 * Nothing private (email, role, password) is ever returned there.
 */
export interface PublicCreatorProfile {
  _id: string;
  name: string;
  profession: string;
  profilePhoto: string;
}

export interface PublicProfileResponse {
  profile: PublicCreatorProfile;
}