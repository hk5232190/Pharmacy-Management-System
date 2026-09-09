"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, RefreshCw, Image as ImageIcon, ImageOff, Upload, Building2 } from "lucide-react";
import { useProfile } from "@/contexts/ProfileContext";
import { SaveButton } from "@/components/ui/save-button";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

interface PharmacyProfile {
  PharmacyName: string;
  LogoPath?: string | null;
}

const DEFAULT_PROFILE = { PharmacyName: "My Pharmacy", LogoPath: null };

export default function GeneralSettingsPage() {
  const { refreshProfile } = useProfile();
  const [profile, setProfile] = useState<PharmacyProfile>(DEFAULT_PROFILE);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // File input ref
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Local object URLs for preview before upload, if user selects a new file
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
      const profileRes = await fetch("http://127.0.0.1:8000/api/v1/settings/profile", { headers: getAuthHeaders() });
      if (profileRes.ok) {
        const pData = await profileRes.json();
        setProfile({ PharmacyName: pData.PharmacyName, LogoPath: pData.LogoPath });
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
          await uploadFile();
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


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCropImageSrc(previewUrl);
    setIsCropping(true);
    setZoom(1);
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

  const uploadFile = async () => {
    if (!logoFile) return;

    const formData = new FormData();
    formData.append("file", logoFile);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/settings/profile/logo`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || "Upload successful!");
        setTimestamp(Date.now());
        setProfile(prev => ({ ...prev, LogoPath: data.logo_path }));
        setLogoFile(null);
        setLogoPreview(null);
        await refreshProfile();
      } else {
        toast.error(data.detail || "Upload failed.");
      }
    } catch (error) {
      toast.error("Network error during upload.");
    }
  };

  const removeFile = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/settings/profile/logo`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      
      if (res.ok) {
        toast.success("Image removed successfully.");
        setTimestamp(Date.now());
        setProfile(prev => ({ ...prev, LogoPath: null }));
        setLogoFile(null);
        setLogoPreview(null);
        if (logoInputRef.current) logoInputRef.current.value = "";
        await refreshProfile();
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
      <div className="max-w-2xl pb-20 pr-2 lg:pr-4">
        
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
                  className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm"
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
                    onChange={(e) => handleFileChange(e)}
                  />
                  
                  <div className="flex flex-wrap gap-2.5">
                    <Button variant="outline" onClick={() => logoInputRef.current?.click()} className="text-sm rounded-xl border-border hover:bg-secondary transition-all">
                      <Upload className="w-4 h-4 mr-2 text-indigo-500" /> {profile.LogoPath ? 'Replace Logo' : 'Select Logo'}
                    </Button>
                    
                    {logoFile && (
                      <Button variant="default" onClick={() => uploadFile()} className="text-sm rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all">
                        <Save className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    )}

                    {(profile.LogoPath || logoFile) && (
                      <Button variant="destructive" onClick={() => logoFile ? (setLogoFile(null), setLogoPreview(null)) : removeFile()} className="text-sm rounded-xl shadow-sm transition-all hover:shadow-red-500/20">
                        <ImageOff className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-500 font-medium bg-slate-50/50 dark:bg-secondary/20 p-3 rounded-xl border border-border inline-block">
                    Supported formats: PNG, JPG, WEBP. Max size: 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6 flex justify-end gap-3 mt-4">
              <SaveButton isSaving={isSavingProfile} onClick={handleSaveProfileText} />
            </div>

          </CardContent>
        </Card>
      </div>

      </div>

    {/* Crop Modal for Logo */}
    {isCropping && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col border border-border">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Crop Logo</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsCropping(false)} className="h-8">Cancel</Button>
          </div>
          <div className="relative w-full h-[400px] bg-slate-100 dark:bg-secondary/20">
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
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-secondary/20">
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
