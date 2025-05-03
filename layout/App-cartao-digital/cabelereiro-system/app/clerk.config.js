export const clerkConfig = {
  // Configurações gerais
  appearance: {
    elements: {
      formButtonPrimary: 'bg-blue-500 hover:bg-blue-600',
      card: 'shadow-none',
    },
  },
  
  // Configurações de roteamento
  routing: "hash",
  path: "/",
  
  // URLs de redirecionamento
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
  afterSignInUrl: "/",
  afterSignUpUrl: "/",
  
  // Configurações de ambiente
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}; 