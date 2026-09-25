"use client";
import { getApiBaseUrl } from "@/lib/api-client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Calendar, User, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";
import { GlobalSearch } from "@/components/layout/global-search";
import { toast } from "sonner";
import { triggerExitBackup, checkExitBackupStatus } from "@/lib/exit-backup";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function Header() {
  const router = useRouter();
  const { profile } = useProfile();
  const { user, logout } = useAuth();
  const { formatDate } = useSystemPreferences();
  const [currentDate, setCurrentDate] = useState("");
  const [currentDayName, setCurrentDayName] = useState("");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setGreeting(getGreeting());
      setCurrentDate(formatDate(now));
      setCurrentDayName(now.toLocaleDateString("en-US", { weekday: "long" }));
    };

    updateTime(); // Initial call
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [formatDate]);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

    // Cashiers log out immediately; admins get the safety backup first
    if (user.role !== "cashier") {
      const isBackupEnabled = await checkExitBackupStatus(token ?? "");
      
      if (isBackupEnabled) {
        setIsLoggingOut(true);
        const result = await triggerExitBackup(token ?? "");

        if (!result.success && result.error) {
          toast.error(`Backup failed before logout: ${result.error}`, {
            duration: 5000,
            description: "Your session will close, but the last backup may be incomplete. Check Backup History.",
          });
          // Give user 2 s to read the toast before navigating away
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    logout();
    router.push("/");
  };

  return (
    <>
      <header className="h-16 flex items-center justify-between px-6 bg-card border-b border-border shadow-sm shrink-0 z-40">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex flex-col shrink-0">
            <span className="font-bold text-[15px] text-foreground leading-tight">
              {greeting || "Welcome"}, {user.full_name || user.username || "Admin"}!
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              {profile.PharmacyName || "Pharmacy"}
            </span>
          </div>

          <div className="w-[1px] h-8 bg-border hidden sm:block shrink-0" />

          {/* Redesigned Global Search */}
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {currentDate && (
            <div className="hidden lg:flex items-center gap-3 text-sm text-muted-foreground bg-secondary/50 px-4 py-1.5 rounded-lg border border-border">
              <Calendar className="w-5 h-5 text-primary/70" />
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-foreground text-[13px]">{currentDate}</span>
                <span className="text-[11px] font-medium">{currentDayName}</span>
              </div>
            </div>
          )}
          <ThemeToggle />
          <NotificationDropdown />
          <div className="w-[1px] h-6 bg-border mx-0.5" />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 hover:bg-secondary p-1.5 pr-3 rounded-full transition-colors outline-none focus:ring-2 focus:ring-primary/20">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 overflow-hidden">
                {user.profile_photo_path ? (
                  <img
                    src={`${getApiBaseUrl().replace("/api/v1", "")}${user.profile_photo_path}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold tracking-wider">
                    {getInitials(user.full_name || user.username || "")}
                  </span>
                )}
              </div>
              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {user.full_name || user.username || "Admin"}
                </span>
                <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-2">
              {user.role !== "cashier" && (
                <>
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/settings/my-profile")}
                    className="text-sm cursor-pointer py-2"
                  >
                    <User className="mr-2 w-4 h-4 text-slate-500" /> My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/settings/security")}
                    className="text-sm cursor-pointer py-2"
                  >
                    <LockIcon className="mr-2 w-4 h-4 text-slate-500" /> Change Password
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/settings/about")}
                    className="text-sm cursor-pointer py-2"
                  >
                    <InfoIcon className="mr-2 w-4 h-4 text-slate-500" /> About Software
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-sm cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive py-2"
              >
                {isLoggingOut ? (
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                ) : (
                  <LogOutIcon className="mr-2 w-4 h-4" />
                )}
                {isLoggingOut ? "Backing up..." : "Logout"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Non-dismissible backup loading overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl max-w-sm w-full mx-4">
            <div className="bg-blue-500/10 p-4 rounded-full">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-foreground text-base font-bold">Creating Secure Backup</p>
              <p className="text-muted-foreground text-sm mt-1">Please wait, do not close the application.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChevronDownIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LockIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function InfoIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function LogOutIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}
