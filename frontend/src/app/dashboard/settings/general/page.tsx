"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, RefreshCw, Image as ImageIcon, ImageOff, Upload, Building2, MonitorSmartphone } from "lucide-react";
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
        <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm h-full">
          <CardHeader className="pb-4 border-b bg-indigo-50/50 dark:bg-indigo-900/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <Building2 className="w-5 h-5" /> Pharmacy Branding
            </CardTitle>
            <CardDescription>Main brand identity across the system header and sidebar.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Pharmacy Name</Label>
              <div className="flex gap-3">
                <Input 
                  value={profile.PharmacyName}
                  onChange={e => setProfile({...profile, PharmacyName: e.target.value})}
                  placeholder="e.g. Wellness Pharmacy"
                />
                <Button onClick={handleSaveProfileText} disabled={isSavingProfile} className="shrink-0">
                  {isSavingProfile ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <Label className="text-sm font-semibold block">Pharmacy Logo</Label>
              <div className="flex flex-col xl:flex-row gap-6 items-start">
                
                {/* Logo Preview */}
                <div className="w-32 h-32 shrink-0 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden relative group">
                  {(logoPreview || profile.LogoPath) ? (
                    <img 
                      src={logoPreview || `http://127.0.0.1:8000${profile.LogoPath}?t=${timestamp}`} 
                      alt="Logo Preview" 
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-700" />
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
                  
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => logoInputRef.current?.click()} className="text-sm">
                      <Upload className="w-4 h-4 mr-2" /> {profile.LogoPath ? 'Replace Logo' : 'Select Logo'}
                    </Button>
                    
                    {logoFile && (
                      <Button variant="default" onClick={() => uploadFile('logo')} className="text-sm bg-indigo-600 hover:bg-indigo-700">
                        <Save className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    )}

                    {(profile.LogoPath || logoFile) && (
                      <Button variant="destructive" onClick={() => logoFile ? (setLogoFile(null), setLogoPreview(null)) : removeFile('logo')} className="text-sm">
                        <ImageOff className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Supported formats: PNG, JPG, WEBP. Max size: 5MB. Will automatically replace any existing logo.</p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Right Column: Login Page Content */}
      <div className="space-y-6">
        <Card className="border-emerald-100 dark:border-emerald-900 shadow-sm h-full">
          <CardHeader className="pb-4 border-b bg-emerald-50/50 dark:bg-emerald-900/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <MonitorSmartphone className="w-5 h-5" /> Login Page Branding
            </CardTitle>
            <CardDescription>Custom texts and backgrounds for the unauthenticated login portal.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Login Branding Name</Label>
                <Input 
                  value={general.LoginBrandingName}
                  onChange={e => setGeneral({...general, LoginBrandingName: e.target.value})}
                  placeholder="e.g. PMS Software"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Login Subheading</Label>
                <Input 
                  value={general.LoginSubheading}
                  onChange={e => setGeneral({...general, LoginSubheading: e.target.value})}
                  placeholder="e.g. Pharmacy Management System"
                />
              </div>
              <Button onClick={handleSaveGeneralText} disabled={isSavingGeneral} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                {isSavingGeneral ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Texts
              </Button>
              <div className="flex justify-end">
                <Button variant="link" size="sm" onClick={() => setGeneral(DEFAULT_GENERAL)} className="text-xs text-slate-500 h-auto p-0">
                  Reset texts to default
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <Label className="text-sm font-semibold block">Login Background Image</Label>
              <div className="flex flex-col gap-4">
                
                {/* Background Preview */}
                <div className="w-full h-48 shrink-0 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden relative group">
                  {(bgPreview || general.LoginBackgroundPath) ? (
                    <img 
                      src={bgPreview || `http://127.0.0.1:8000${general.LoginBackgroundPath}?t=${timestamp}`} 
                      alt="Background Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-700" />
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
                  
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => bgInputRef.current?.click()} className="text-sm flex-1">
                      <Upload className="w-4 h-4 mr-2" /> {general.LoginBackgroundPath ? 'Replace Banner' : 'Select Banner'}
                    </Button>
                    
                    {bgFile && (
                      <Button variant="default" onClick={() => uploadFile('bg')} className="text-sm flex-1 bg-emerald-600 hover:bg-emerald-700">
                        <Save className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    )}

                    {(general.LoginBackgroundPath || bgFile) && (
                      <Button variant="destructive" onClick={() => bgFile ? (setBgFile(null), setBgPreview(null)) : removeFile('bg')} className="text-sm flex-1">
                        <ImageOff className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 text-center">Recommended size: 1080x1080 or larger. Max size: 5MB.</p>
                </div>
              </div>
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
  </>
  );
}
