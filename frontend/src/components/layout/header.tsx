"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Bell, Calendar, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function Header() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("Good Morning");

  useEffect(() => {
    const updateDateAndGreeting = () => {
      const now = new Date();
      
      // Format the date using the local system date — gives day/month/year exactly as on the PC
      const formatted = now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      setCurrentDate(formatted);

      // Dynamic greeting based on hour
      const hour = now.getHours();
      if (hour >= 5 && hour < 12) setGreeting("Good Morning");
      else if (hour >= 12 && hour < 17) setGreeting("Good Afternoon");
      else if (hour >= 17 && hour < 21) setGreeting("Good Evening");
      else setGreeting("Good Night");
    };

    updateDateAndGreeting();
    // Refresh every minute so the date flips correctly at midnight
    const interval = setInterval(updateDateAndGreeting, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    router.push("/");
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-card border-b border-border shadow-sm shrink-0 z-10">
      
      <div className="flex items-center">
        <div className="flex flex-col">
          <span className="font-bold text-[15px] text-foreground">{greeting}, Admin!</span>
          <span className="text-[12px] text-muted-foreground font-medium">ABC Pharmacy</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        
        {currentDate && (
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground font-medium bg-secondary/50 px-4 py-2 rounded-lg border border-border">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{currentDate}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <ThemeToggle />
          
          <button className="relative p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <Bell className="w-[1.2rem] h-[1.2rem]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-card ring-2 ring-card ring-offset-background"></span>
          </button>

          <div className="w-[1px] h-6 bg-border mx-2"></div>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-secondary p-1.5 pr-3 rounded-full transition-colors outline-none focus:ring-2 focus:ring-primary/20">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <User size={16} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Admin User</span>
                <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-2">
              <DropdownMenuItem className="text-sm cursor-pointer py-2">
                <User className="mr-2 w-4 h-4 text-slate-500" /> My Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm cursor-pointer py-2">
                <LockIcon className="mr-2 w-4 h-4 text-slate-500" /> Change Password
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm cursor-pointer py-2">
                <InfoIcon className="mr-2 w-4 h-4 text-slate-500" /> About Software
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-sm cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive py-2">
                <LogOutIcon className="mr-2 w-4 h-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

// Helper Icons for the dropdown
function ChevronDownIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  )
}
function LockIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function InfoIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  )
}
function LogOutIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
    </svg>
  )
}


// Helper Icons for the dropdown
function ChevronDownIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  )
}
function LockIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function InfoIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  )
}
function LogOutIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
    </svg>
  )
}
