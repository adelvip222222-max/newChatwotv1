import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main 
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{
        background: 'linear-gradient(135deg, #4eddf1 0%, #a64bf4 100%)'
      }}
    >
      <div 
        className="absolute top-0 left-0 w-[60%] h-[60%] bg-white/10" 
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
      ></div>
      <div 
        className="absolute bottom-0 right-0 w-[50%] h-[80%] bg-[#b768f7]/40 mix-blend-overlay"
        style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
      ></div>
      
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
