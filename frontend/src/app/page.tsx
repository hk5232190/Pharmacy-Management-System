"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { User, Lock, Eye, EyeOff, Key, Shield, Zap, CheckCircle2, Info, Plus } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      // OAuth2PasswordRequestForm expects form data

      const response = await fetch("http://localhost:8000/api/v1/auth/login" + (rememberMe ? "?remember_me=true" : ""), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Store token
      if (rememberMe) {
        localStorage.setItem("access_token", data.access_token);
      } else {
        sessionStorage.setItem("access_token", data.access_token);
      }

      // Redirect to dashboard (mock for now since dashboard isn't built yet)
      alert("Login successful! Redirecting to Dashboard...");
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full font-sans bg-slate-50 overflow-hidden">
      
      {/* Left Column - Hero Banner */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between relative bg-white overflow-hidden border-r border-slate-100">
        
        {/* Dedicated Left Side Image (Contains Logo, Heading, and Badges baked in) */}
        <div className="relative w-full flex-grow bg-white">
          <Image 
            src="/images/login page left side.png"
            alt="Pharmacy Management System"
            fill
            quality={100}
            priority
            className="object-fill"
          />
        </div>

        {/* Absolute Bottom Footer Bar */}
        <div className="relative z-10 w-full bg-[#0f172a] py-5 px-12 xl:px-16 flex justify-between items-center text-[13px] text-slate-300 font-medium shrink-0">
          <p>© 2025 PMS Software. All rights reserved.</p>
          <p>Version 1.0.0</p>
        </div>
      </div>

      {/* Right Column - Auth & License Container */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-12 xl:p-24 relative bg-slate-50/50">
        
        <div className="w-full max-w-[440px] space-y-6">
          
          {/* Main Auth Card */}
          <Card className="p-10 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0 rounded-[20px] bg-white">
            <div className="text-center mb-10">
              <h3 className="text-[28px] font-bold text-slate-900 mb-2">Welcome Back</h3>
              <p className="text-slate-500 font-medium">Sign in to continue.</p>
            </div>

            <form className="space-y-6" onSubmit={handleLogin}>
              {error && (
                <div className="bg-red-50 text-red-600 text-[13px] font-medium p-3 rounded-lg border border-red-100 flex items-center">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" strokeWidth={2} />
                  </div>
                  <Input 
                    type="text" 
                    placeholder="Enter your username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-11 h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/20 rounded-lg shadow-sm" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" strokeWidth={2} />
                  </div>
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Enter your password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-11 pr-11 h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/20 rounded-lg shadow-sm" 
                  />
                  <div 
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    disabled={isLoading}
                    className="border-slate-300 rounded-[4px] data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
                  />
                  <label htmlFor="remember" className="text-sm font-medium leading-none cursor-pointer text-slate-700">
                    Remember Me
                  </label>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-[52px] text-[15px] font-semibold mt-2 shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all rounded-lg bg-primary hover:bg-primary/90 text-white"
              >
                {isLoading ? "Authenticating..." : "Login"}
              </Button>

              <div className="relative my-7">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-4 text-slate-400 font-medium text-[13px]">or</span>
                </div>
              </div>

              <Button 
                type="button" 
                variant="outline" 
                onClick={() => window.location.href = '/activate'}
                className="w-full h-[52px] text-[15px] text-primary border-primary/20 hover:bg-primary/5 font-semibold flex items-center gap-2 rounded-lg bg-white shadow-sm transition-all"
              >
                <Key size={18} strokeWidth={2.5} /> Activate License
              </Button>
            </form>
          </Card>

        </div>
        
        {/* Bottom Right System Status */}
        <div className="absolute bottom-8 right-10 flex items-center gap-2 text-sm text-green-600 font-bold bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm">
          <Shield size={18} strokeWidth={2.5} /> System Secure
        </div>
      </div>

    </div>
  );
}
