import bcrypt from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant, User } from "@/lib/models";

export const authOptions: AuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" }
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;

        if (!email || !password) return null;

        await connectToDatabase();
        const user = await User.findOne({ email }).select("+password");
        if (!user?.password || user.isActive === false) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid || !user.tenantId) return null;

        const tenant = await Tenant.findOne({ _id: user.tenantId, isActive: true });
        if (!tenant) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId.toString()
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
      }
      return session;
    }
  }
};

export function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session?.user?.tenantId) {
    throw new Error("تسجيل الدخول مطلوب.");
  }
  return session;
}
