
import { withClerk } from '@clerk/nextjs';

// Essa função envolve suas páginas para garantir que o usuário esteja autenticado
export const withProtectedPage = (Page) => {
  return withClerk(Page, {
    afterAuth: '/login', // Redirecionar para a página de login caso o usuário não esteja autenticado
  });
};