import NextAuth, { DefaultSession, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
  interface User {
    accessToken?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        try {
          const res = await fetch(`${backendUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password
            })
          });
          
          if (res.ok) {
            const data = await res.json();
            const userRes = await fetch(`${backendUrl}/api/me`, {
              headers: { 'Authorization': `Bearer ${data.access_token}` }
            });
            
            if (userRes.ok) {
              const user = await userRes.json();
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.avatar_url,
                accessToken: data.access_token
              };
            }
          }
        } catch (e) {
          console.error("Auth error:", e);
        }
        return null;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        try {
          const res = await fetch(`${backendUrl}/api/auth/google-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              avatar_url: user.image
            })
          });
          if (res.ok) {
            const data = await res.json();
            user.accessToken = data.access_token;
            // Fetch backend user ID if needed, or assume token handles it. 
            // We just need the accessToken for our backend.
            const userRes = await fetch(`${backendUrl}/api/me`, {
              headers: { 'Authorization': `Bearer ${data.access_token}` }
            });
            if (userRes.ok) {
                const u = await userRes.json();
                user.id = u.id;
            }
            return true;
          }
        } catch (e) {
          console.error("Google sync error:", e);
          return false;
        }
        return false;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // User is only passed on initial sign-in
      if (user) {
        token.id = user.id;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.accessToken = token.accessToken as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET || "super_secret_zoom_key_for_demo_purposes"
});
