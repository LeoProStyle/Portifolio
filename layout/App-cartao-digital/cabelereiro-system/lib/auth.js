// lib/auth.js
export const isAdmin = (email) => {
  if (!email) {
    console.log('DEBUG - isAdmin: Email não fornecido');
    return false;
  }
  
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',')
    .map(e => e.trim())
    .filter(e => e); // Remove empty strings
  
  console.log('DEBUG - isAdmin:', {
    emailVerificado: email,
    listaAdmins: adminEmails,
    resultado: adminEmails.includes(email)
  });
    
  return adminEmails.includes(email);
};

export const getUserRole = (user) => {
  if (!user) {
    console.log('DEBUG - getUserRole: Usuário não fornecido');
    return null;
  }
  
  const email = user.primaryEmailAddress?.emailAddress;
  const role = isAdmin(email) ? 'admin' : 'client';
  
  console.log('DEBUG - getUserRole:', {
    usuario: user.id,
    email: email,
    funcao: role
  });
  
  return role;
};

export const getRedirectPath = (user) => {
  const role = getUserRole(user);
  const path = role === 'admin' ? '/admin' : '/client';
  
  console.log('DEBUG - getRedirectPath:', {
    usuario: user?.id,
    funcao: role,
    caminho: path
  });
  
  return path;
}; 