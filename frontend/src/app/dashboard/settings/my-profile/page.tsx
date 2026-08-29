"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, RefreshCw, ImageOff, Upload, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

export default function MyProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // File Inputs
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  // Local object URLs for preview
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Cropper State
  const [isCropping, setIsCropping] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Cache buster for images
  const [timestamp, setTimestamp] = useState<number>(Date.now());

  useEffect(() => {
    if (user.id !== 0) {
      setFullName(user.full_name || "");
      setPhoneNumber(user.phone_number || "");
      setIsLoading(false);
    }
  }, [user]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    return {
      "Authorization": `Bearer ${token}`
    };
  };

  const handleSaveProfileText = async () => {
    if (!fullName.trim()) {
      toast.error("Full Name cannot be empty.");
      return;
    }
    
    setIsSavingProfile(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ FullName: fullName, PhoneNumber: phoneNumber })
      });
      if (res.ok) {
        toast.success("Profile information updated successfully.");
        await refreshUser();
        
        // Auto-upload photo if selected
        if (photoFile) {
          await uploadPhoto();
        }
      } else {
        toast.error("Failed to update profile information.");
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
        setPhotoFile(croppedImage);
        setPhotoPreview(URL.createObjectURL(croppedImage));
        setIsCropping(false);
      }
    } catch (e) {
      toast.error("Failed to crop image.");
    }
  };

  const uploadPhoto = async () => {
    if (!photoFile) return;

    const formData = new FormData();
    formData.append("file", photoFile);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/auth/me/photo`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || "Profile photo uploaded successfully!");
        setTimestamp(Date.now());
        setPhotoFile(null);
        setPhotoPreview(null);
        await refreshUser();
      } else {
        toast.error(data.detail || "Upload failed.");
      }
    } catch (error) {
      toast.error("Network error during upload.");
    }
  };

  const removePhoto = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/auth/me/photo`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      
      if (res.ok) {
        toast.success("Profile photo removed successfully.");
        setTimestamp(Date.now());
        setPhotoFile(null);
        setPhotoPreview(null);
        if (photoInputRef.current) photoInputRef.current.value = "";
        await refreshUser();
      } else {
        const data = await res.json();
        toast.error(data.detail || "Failed to remove photo.");
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
      <div className="grid grid-cols-1 gap-6 pb-20 max-w-4xl mx-auto">
        <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm h-full">
          <CardHeader className="pb-4 border-b bg-indigo-50/50 dark:bg-indigo-900/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <UserIcon className="w-5 h-5" /> My Profile
            </CardTitle>
            <CardDescription>Manage your personal details and profile photo.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Full Name</Label>
                <Input 
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Muhammad Ali"
                />
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Phone Number</Label>
                <Input 
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <Label className="text-sm font-semibold block">Profile Photo</Label>
              <div className="flex flex-col xl:flex-row gap-6 items-start">
                
                {/* Photo Preview */}
                <div className="w-32 h-32 shrink-0 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden relative group">
                  {(photoPreview || user.profile_photo_path) ? (
                    <img 
                      src={photoPreview || `http://127.0.0.1:8000${user.profile_photo_path}?t=${timestamp}`} 
                      alt="Profile Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                  )}
                </div>

                <div className="space-y-3 w-full">
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden" 
                    ref={photoInputRef}
                    onChange={handleFileChange}
                  />
                  
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => photoInputRef.current?.click()} className="text-sm">
                      <Upload className="w-4 h-4 mr-2" /> {user.profile_photo_path ? 'Replace Photo' : 'Select Photo'}
                    </Button>
                    
                    {photoFile && (
                      <Button variant="default" onClick={uploadPhoto} className="text-sm bg-indigo-600 hover:bg-indigo-700">
                        <Save className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    )}

                    {(user.profile_photo_path || photoFile) && (
                      <Button variant="destructive" onClick={() => photoFile ? (setPhotoFile(null), setPhotoPreview(null)) : removePhoto()} className="text-sm">
                        <ImageOff className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Supported formats: PNG, JPG, WEBP. Max size: 5MB.</p>
                </div>
              </div>
            </div>
            
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => {
                setFullName(user.full_name || "");
                setPhoneNumber(user.phone_number || "");
                setPhotoFile(null);
                setPhotoPreview(null);
              }}>
                Cancel Changes
              </Button>
              <Button onClick={handleSaveProfileText} disabled={isSavingProfile} className="bg-indigo-600 hover:bg-indigo-700 min-w-[120px]">
                {isSavingProfile ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Crop Modal for Profile Photo */}
      {isCropping && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Crop Profile Photo</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsCropping(false)} className="h-8">Cancel</Button>
            </div>
            <div className="relative w-full h-[400px] bg-slate-100 dark:bg-slate-950">
              {cropImageSrc && (
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
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
