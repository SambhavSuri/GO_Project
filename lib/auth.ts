// Authentication utilities
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('authToken', token);
}

export function logout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('authToken');
  // Redirect to login page
  window.location.href = '/login';
}