"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, RefreshCw, Image as ImageIcon, ImageOff, Upload, Building2, MonitorSmartphone, Eye } from "lucide-react";
import { useProfile } from "@/contexts/ProfileContext";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

interface PharmacyProfile {
  PharmacyName: string;
  LogoPath?: string | null;
}

interface GeneralSettings {
  LoginBrandingName: string;
  LoginSubheading: string;
  LoginBackgroundPath?: string | null;
}

const DEFAULT_PROFILE = { PharmacyName: "My Pharmacy", LogoPath: null };
const DEFAULT_GENERAL = { LoginBrandingName: "PMS Software", LoginSubheading: "Pharmacy Management System", LoginBackgroundPath: null };

export default function GeneralSettingsPage() {
  const { refreshProfile } = useProfile();
  const [profile, setProfile] = useState<PharmacyProfile>(DEFAULT_PROFILE);
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [showLoginPreview, setShowLoginPreview] = useState(false);

  // File Inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  
  // Local object URLs for preview before upload, if user selects a new file
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);

  // Cropper State
  const [isCropping, setIsCropping] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Cache buster for images
  const [timestamp, setTimestamp] = useState<number>(Date.now());

  useEffect(() => {
    fetchSettings();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    return {
      "Authorization": `Bearer ${token}`
    };
  };

  const fetchSettings = async () => {
    try {
      const [profileRes, generalRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/v1/settings/profile", { headers: getAuthHeaders() }),
        fetch("http://127.0.0.1:8000/api/v1/settings/general") // Public endpoint
      ]);

      if (profileRes.ok) {
        const pData = await profileRes.json();
        setProfile({ PharmacyName: pData.PharmacyName, LogoPath: pData.LogoPath });
      }
      if (generalRes.ok) {
        const gData = await generalRes.json();
        setGeneral({ LoginBrandingName: gData.LoginBrandingName, LoginSubheading: gData.LoginSubheading, LoginBackgroundPath: gData.LoginBackgroundPath });
      }
    } catch (error) {
      toast.error("Failed to load settings from server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfileText = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ PharmacyName: profile.PharmacyName })
      });
      if (res.ok) {
        toast.success("Pharmacy name updated successfully.");
        await refreshProfile();
        
        // Auto-upload logo if selected
        if (logoFile) {
          await uploadFile('logo');
        }
      } else {
        toast.error("Failed to update pharmacy name.");
      }
    } catch (error) {
      toast.error("Network error.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveGeneralText = async () => {
    setIsSavingGeneral(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ LoginBrandingName: general.LoginBrandingName, LoginSubheading: general.LoginSubheading })
      });
      if (res.ok) {
        toast.success("Login page branding updated successfully.");
        
        // Auto-upload bg if selected
        if (bgFile) {
          await uploadFile('bg');
        }
      } else {
        toast.error("Failed to update login branding.");
      }
    } catch (error) {
      toast.error("Network error.");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'bg') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const previewUrl = URL.createObjectURL(file);
    if (type === 'logo') {
      setCropImageSrc(previewUrl);
      setIsCropping(true);
      setZoom(1);
    } else {
      setBgFile(file);
      setBgPreview(previewUrl);
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const showCroppedImage = async () => {
    try {
      if (!cropImageSrc || !croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      if (croppedImage) {
        setLogoFile(croppedImage);
        setLogoPreview(URL.createObjectURL(croppedImage));
        setIsCropping(false);
      }
    } catch (e) {
      toast.error("Failed to crop image.");
    }
  };

  const uploadFile = async (type: 'logo' | 'bg') => {
    const file = type === 'logo' ? logoFile : bgFile;
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = type === 'logo' ? "/api/v1/settings/profile/logo" : "/api/v1/settings/general/background";
    
    try {
      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || "Upload successful!");
        setTimestamp(Date.now());
        if (type === 'logo') {
          setProfile(prev => ({ ...prev, LogoPath: data.logo_path }));
          setLogoFile(null);
          setLogoPreview(null);
          await refreshProfile();
        } else {
          setGeneral(prev => ({ ...prev, LoginBackgroundPath: data.background_path }));
          setBgFile(null);
          setBgPreview(null);
        }
      } else {
        toast.error(data.detail || "Upload failed.");
      }
    } catch (error) {
      toast.error("Network error during upload.");
    }
  };

  const removeFile = async (type: 'logo' | 'bg') => {
    const endpoint = type === 'logo' ? "/api/v1/settings/profile/logo" : "/api/v1/settings/general/background";
    
    try {
      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      
      if (res.ok) {
        toast.success("Image removed successfully.");
        setTimestamp(Date.now());
        if (type === 'logo') {
          setProfile(prev => ({ ...prev, LogoPath: null }));
          setLogoFile(null);
          setLogoPreview(null);
          if (logoInputRef.current) logoInputRef.current.value = "";
          await refreshProfile();
        } else {
          setGeneral(prev => ({ ...prev, LoginBackgroundPath: null }));
          setBgFile(null);
          setBgPreview(null);
          if (bgInputRef.current) bgInputRef.current.value = "";
        }
      } else {
        const data = await res.json();
        toast.error(data.detail || "Failed to remove image.");
      }
    } catch (error) {
      toast.error("Network error.");
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        
        {/* Left Column: Pharmacy Branding */}
      <div className="space-y-6">
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 h-full transition-all duration-500 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-indigo-700 dark:text-indigo-400">
              <Building2 className="w-5 h-5 drop-shadow-sm" /> Pharmacy Branding
            </CardTitle>
            <CardDescription className="text-slate-500">Main brand identity across the system header and sidebar.</CardDescription>
          </CardHeader>
          <CardContent className="p-7 space-y-8">
            
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Pharmacy Name</Label>
              <div className="flex gap-3">
                <Input 
                  value={profile.PharmacyName}
                  onChange={e => setProfile({...profile, PharmacyName: e.target.value})}
                  placeholder="e.g. Wellness Pharmacy"
                  className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <Label className="text-sm font-semibold block">Pharmacy Logo</Label>
              <div className="flex flex-col xl:flex-row gap-6 items-start">
                
                {/* Logo Preview */}
                <div className="w-36 h-36 shrink-0 border-2 border-dashed border-indigo-200 dark:border-slate-700 rounded-[2rem] flex items-center justify-center bg-gradient-to-br from-indigo-50/50 to-white dark:from-transparent dark:to-transparent overflow-hidden relative group transition-colors hover:border-indigo-400 dark:hover:border-slate-500 shadow-sm">
                  {(logoPreview || profile.LogoPath) ? (
                    <img 
                      src={logoPreview || `http://127.0.0.1:8000${profile.LogoPath}?t=${timestamp}`} 
                      alt="Logo Preview" 
                      className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-indigo-300 dark:text-indigo-700/50 group-hover:scale-110 transition-transform duration-500" />
                  )}
                </div>

                <div className="space-y-3 w-full">
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden" 
                    ref={logoInputRef}
                    onChange={(e) => handleFileChange(e, 'logo')}
                  />
                  
                  <div className="flex flex-wrap gap-2.5">
                    <Button variant="outline" onClick={() => logoInputRef.current?.click()} className="text-sm rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                      <Upload className="w-4 h-4 mr-2 text-indigo-500" /> {profile.LogoPath ? 'Replace Logo' : 'Select Logo'}
                    </Button>
                    
                    {logoFile && (
                      <Button variant="default" onClick={() => uploadFile('logo')} className="text-sm rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all">
                        <Save className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    )}

                    {(profile.LogoPath || logoFile) && (
                      <Button variant="destructive" onClick={() => logoFile ? (setLogoFile(null), setLogoPreview(null)) : removeFile('logo')} className="text-sm rounded-xl shadow-sm transition-all hover:shadow-red-500/20">
                        <ImageOff className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-500 font-medium bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 inline-block">
                    Supported formats: PNG, JPG, WEBP. Max size: 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6 flex justify-end gap-3 mt-4">
              <Button onClick={handleSaveProfileText} disabled={isSavingProfile} className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px] rounded-full shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all duration-300">
                {isSavingProfile ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Right Column: Login Page Content */}
      <div className="space-y-6">
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 h-full transition-all duration-500 hover:shadow-[0_8px_30px_rgb(16,185,129,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-transparent dark:to-transparent flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
                <MonitorSmartphone className="w-5 h-5 drop-shadow-sm" /> Login Page Branding
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Custom texts and backgrounds for the login portal.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowLoginPreview(true)} className="text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-full shadow-sm transition-all hover:shadow-emerald-500/10">
              <Eye className="w-4 h-4 mr-2" /> Preview Login Screen
            </Button>
          </CardHeader>
          <CardContent className="p-7 space-y-8">
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Login Branding Name</Label>
                <Input 
                  value={general.LoginBrandingName}
                  onChange={e => setGeneral({...general, LoginBrandingName: e.target.value})}
                  placeholder="e.g. PMS Software"
                  className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500 transition-all shadow-sm"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Login Subheading</Label>
                <Input 
                  value={general.LoginSubheading}
                  onChange={e => setGeneral({...general, LoginSubheading: e.target.value})}
                  placeholder="e.g. Pharmacy Management System"
                  className="rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <Label className="text-sm font-semibold block">Login Background Image</Label>
              <div className="flex flex-col gap-4">
                
                {/* Background Preview */}
                <div className="w-full h-56 shrink-0 border-2 border-dashed border-emerald-200 dark:border-slate-700 rounded-3xl flex items-center justify-center bg-gradient-to-br from-emerald-50/50 to-slate-50 dark:from-transparent dark:to-transparent overflow-hidden relative group transition-colors hover:border-emerald-400 dark:hover:border-slate-500 shadow-inner">
                  {(bgPreview || general.LoginBackgroundPath) ? (
                    <img 
                      src={bgPreview || `http://127.0.0.1:8000${general.LoginBackgroundPath}?t=${timestamp}`} 
                      alt="Background Preview" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-emerald-300 dark:text-emerald-700/50 group-hover:scale-110 transition-transform duration-500" />
                  )}
                </div>

                <div className="space-y-3 w-full">
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden" 
                    ref={bgInputRef}
                    onChange={(e) => handleFileChange(e, 'bg')}
                  />
                  
                  <div className="flex flex-wrap gap-2.5">
                    <Button variant="outline" onClick={() => bgInputRef.current?.click()} className="text-sm flex-1 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                      <Upload className="w-4 h-4 mr-2 text-emerald-500" /> {general.LoginBackgroundPath ? 'Replace Banner' : 'Select Banner'}
                    </Button>
                    
                    {bgFile && (
                      <Button variant="default" onClick={() => uploadFile('bg')} className="text-sm flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all">
                        <Save className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    )}

                    {(general.LoginBackgroundPath || bgFile) && (
                      <Button variant="destructive" onClick={() => bgFile ? (setBgFile(null), setBgPreview(null)) : removeFile('bg')} className="text-sm flex-1 rounded-xl shadow-sm transition-all hover:shadow-red-500/20">
                        <ImageOff className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-500 font-medium bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mt-2 block text-center">
                    Recommended size: 1080x1080 or larger. Max size: 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6 flex justify-between items-center gap-3 mt-4">
              <Button variant="link" size="sm" onClick={() => setGeneral(DEFAULT_GENERAL)} className="text-[13px] text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 h-auto p-0 font-medium transition-colors">
                Reset texts to default
              </Button>
              <Button onClick={handleSaveGeneralText} disabled={isSavingGeneral} className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px] rounded-full shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all duration-300">
                {isSavingGeneral ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>

    </div>

    {/* Crop Modal for Logo */}
    {isCropping && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Crop Logo</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsCropping(false)} className="h-8">Cancel</Button>
          </div>
          <div className="relative w-full h-[400px] bg-slate-100 dark:bg-slate-950">
            {cropImageSrc && (
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                classes={{ containerClassName: 'h-[400px]' }}
              />
            )}
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-4 w-1/2">
               <Label className="text-xs text-slate-500 font-semibold uppercase">Zoom</Label>
               <input 
                 type="range" 
                 min={1} 
                 max={3} 
                 step={0.1} 
                 value={zoom} 
                 onChange={(e) => setZoom(Number(e.target.value))} 
                 className="w-full accent-indigo-600" 
               />
            </div>
            <Button onClick={showCroppedImage} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              Apply Crop
            </Button>
          </div>
        </div>
      </div>
    )}
    {/* Login Screen Preview Modal */}
    {showLoginPreview && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 xl:p-12">
        <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative">
          
          <div className="absolute top-4 right-4 z-10">
            <Button variant="outline" onClick={() => setShowLoginPreview(false)} className="bg-white/80 hover:bg-white text-slate-800 border-0 shadow-sm backdrop-blur-md">Close Preview</Button>
          </div>

          <div className="flex-1 flex w-full h-full">
            {/* Left side: Background & Branding */}
            <div className="hidden lg:flex w-1/2 relative flex-col justify-center p-12 overflow-hidden bg-slate-900">
              {/* Background Image */}
              <img
                src={bgPreview || (general.LoginBackgroundPath ? `http://127.0.0.1:8000${general.LoginBackgroundPath}?t=${timestamp}` : "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80")}
                alt="Login Background"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-slate-900/20" />
              
              {/* Content */}
              <div className="relative z-10 space-y-6 max-w-md">
                {(logoPreview || profile.LogoPath) && (
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 shadow-xl">
                    <img 
                      src={logoPreview || `http://127.0.0.1:8000${profile.LogoPath}?t=${timestamp}`} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2 leading-tight">
                    {general.LoginBrandingName || profile.PharmacyName || "Pharmacy System"}
                  </h1>
                  <p className="text-lg text-slate-300 font-medium leading-relaxed">
                    {general.LoginSubheading || "Manage your pharmacy operations efficiently."}
                  </p>
                </div>
              </div>
            </div>

            {/* Right side: Login Form Mock */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
              <div className="w-full max-w-sm space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
                  <p className="text-sm text-slate-500 mt-2">Please sign in to your account</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input placeholder="admin@pharmacy.com" disabled />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Password</Label>
                      <span className="text-xs text-indigo-600">Forgot password?</span>
                    </div>
                    <Input type="password" placeholder="••••••••" disabled />
                  </div>
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" disabled>
                    Sign In
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    )}
  </>
  );
}
