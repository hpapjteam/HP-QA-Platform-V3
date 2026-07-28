import React, { useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const dbConfigured = isSupabaseConfigured();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resetUrl = `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}`;
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetUrl })
      });
      if (!response.ok) throw new Error("Failed to send reset email");
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || "Error sending reset email");
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbConfigured) {
      setError("Database is not connected. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    setError(null);
    
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message || "Invalid login credentials");
      setLoading(false);
      return;
    }
    
    setLoading(false);
    onLogin();
  };

  return (
    <div className="flex h-screen w-screen font-sans bg-white">
      {/* Left Column - Form */}
      <div className="w-full lg:w-[450px] xl:w-[500px] flex flex-col justify-between p-8 lg:p-12 shrink-0 bg-white z-10 relative">
        
        {/* Logo */}
        <div>
          <img 
            src="https://zetaglobal.com/wp-content/uploads/2023/02/zeta_logoPrimary.svg" 
            alt="Zeta Global" 
            className="h-10 mt-8"
          />
        </div>

        {/* Login Form */}
        <div className="w-full max-w-sm mx-auto flex flex-col justify-center flex-1">
          <h1 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            {isForgotPassword ? "Reset Password" : "Welcome"}
          </h1>

          {!dbConfigured && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-slate-900 block mb-1">Database Disconnected</strong>
                You must add your Supabase Database environment variables to log in.
              </div>
            </div>
          )}
          
          {isForgotPassword ? (
            resetSent ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm">
                  Password reset link has been sent to your email.
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setIsForgotPassword(false); setResetSent(false); }}>
                  Return to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                {error && (
                  <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive font-medium text-center border border-destructive/20">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-blue-50 border-slate-200 text-slate-900 focus-visible:ring-[#2b61d6] shadow-none h-11"
                  />
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Button type="submit" className="bg-[#2b61d6] hover:bg-blue-700 text-white w-full h-10 shadow-sm" disabled={loading || !email}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setIsForgotPassword(false)}>
                    Back to Login
                  </Button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive font-medium text-center border border-destructive/20">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-blue-50 border-slate-200 text-slate-900 focus-visible:ring-[#2b61d6] shadow-none h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-blue-50 border-slate-200 text-slate-900 focus-visible:ring-[#2b61d6] shadow-none pr-10 h-11"
                  />
                  <button 
                    type="button" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-[#2b61d6] hover:underline font-medium">
                  Forgot password?
                </button>
                <Button type="submit" className="bg-[#2b61d6] hover:bg-blue-700 text-white px-8 h-10 shadow-sm" disabled={loading || !dbConfigured}>
                  {loading ? "Logging in..." : "Log in"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer text */}
        <div className="text-xs text-slate-500 text-center">
          © 2001 - 2026 ZETA. All rights reserved | <a href="#" className="text-[#2b61d6] hover:underline">Privacy</a>
        </div>
      </div>

      {/* Right Column - Graphic */}
      <div className="hidden lg:block flex-1 relative bg-slate-900 overflow-hidden">
         <div className="absolute inset-0 " style={{
           backgroundImage: `url('https://zetaglobal.com/wp-content/uploads/2025/07/life-at-zeta-hero.png')`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
         }}></div>
         
         <div className="absolute inset-0 flex flex-col justify-end p-16 pb-24">
            <div className="text-white text-left max-w-lg z-10 drop-shadow-md">
               <h2 className="text-4xl font-bold mb-4">Empower your QA Workflow</h2>
               <p className="text-lg text-blue-100">Automate validations, streamline approvals, and launch campaigns with absolute confidence.</p>
            </div>
         </div>
      </div>
    </div>
  );
}

