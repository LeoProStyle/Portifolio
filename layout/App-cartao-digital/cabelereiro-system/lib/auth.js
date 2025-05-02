// lib/auth.js
export const isAdmin = (email) => {
  if (!email) return false;
  
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',')
    .map(e => e.trim())
    .filter(e => e);
    
  return adminEmails.includes(email);
};

export const getUserRole = (user) => {
  if (!user) return null;
  
  const email = user.primaryEmailAddress?.emailAddress;
  return isAdmin(email) ? 'admin' : 'client';
};

export const getRedirectPath = (user) => {
  const role = getUserRole(user);
  return role === 'admin' ? '/admin' : '/client';
}; 