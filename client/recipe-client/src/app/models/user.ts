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