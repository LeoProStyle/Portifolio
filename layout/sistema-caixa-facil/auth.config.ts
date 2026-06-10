import { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { connectToMongo } from "@/lib/mongodb";
import { UserModel } from "@/models/User";

export const authConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email e senha são obrigatórios");
        }

        try {
          await connectToMongo();

          const user = await UserModel.findOne({ email: credentials.email });
          if (!user) {
            throw new Error("Usuário não encontrado");
          }

          if (!user.active) {
            throw new Error("Usuário inativo");
          }

          // @ts-ignore - método adicionado via schema
          const isPasswordValid = await user.comparePassword(credentials.password);
          if (!isPasswordValid) {
            throw new Error("Senha incorreta");
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("[Auth] Error:", error);
          throw error;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
