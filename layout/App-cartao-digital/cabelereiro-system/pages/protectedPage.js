import { useUser } from '@clerk/clerk-react';
import { useRouter } from 'next/router';

const ProtectedPage = () => {
  const { user, isLoading } = useUser(); // Pegando dados do usuário
  const router = useRouter();

  if (isLoading) {
    return <p>Carregando...</p>; // Mostra um loading enquanto verifica a autenticação
  }

  if (!user) {
    // Redireciona para a página de login caso o usuário não esteja autenticado
    router.push('/login');
    return null; // Retorna null enquanto a navegação ocorre
  }

  return (
    <div>
      <h1>Página Protegida</h1>
      <p>Bem-vindo, {user.firstName}!</p>
      {/* Conteúdo protegido aqui */}
    </div>
  );
};

export default ProtectedPage;