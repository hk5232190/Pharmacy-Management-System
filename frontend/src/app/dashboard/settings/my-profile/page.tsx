"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, RefreshCw, ImageOff, Upload, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SaveButton } from "@/components/ui/save-button";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function MyProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user.full_name || "");
  const [username, setUsername] = useState(user.username || "");
  const [email, setEmail] = useState(user.email || "");
  const [phoneNumber, setPhoneNumber] = useState(user.phone_number || "");
  
  // Validation errors
  const [errors, setErrors] = useState<{ email?: string, phone?: string }>({});
  
  const [isLoading, setIsLoading] = useState(user.id === 0);
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
      setUsername(user.username || "");
      setEmail(user.email || "");
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (val.length > 11) val = val.slice(0, 11); // Max 11 digits
    
    // Apply mask: 03XX-XXXXXXX
    if (val.length > 4) {
      val = val.slice(0, 4) + '-' + val.slice(4);
    }
    setPhoneNumber(val);
    
    // Clear error if valid
    if (val === "" || /^03\d{2}-\d{7}$/.test(val)) {
      setErrors(prev => ({ ...prev, phone: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: { email?: string, phone?: string } = {};
    let isValid = true;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format (e.g. user@example.com).";
      isValid = false;
    }
    
    if (phoneNumber && !/^03\d{2}-\d{7}$/.test(phoneNumber)) {
      newErrors.phone = "Invalid phone format (must be 03XX-XXXXXXX).";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSaveProfileText = async () => {
    if (!fullName.trim()) {
      toast.error("Full Name cannot be empty.");
      return;
    }
    
    if (!validateForm()) {
      toast.error("Please fix the validation errors.");
      return;
    }
    
    setIsSavingProfile(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ FullName: fullName, Email: email || null, PhoneNumber: phoneNumber || null })
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
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 h-full transition-all duration-500 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-indigo-700 dark:text-indigo-400">
              <UserIcon className="w-5 h-5 drop-shadow-sm" /> My Profile
            </CardTitle>
            <CardDescription className="text-slate-500">Manage your personal details and profile photo.</CardDescription>
          </CardHeader>
          <CardContent className="p-7 space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Row 1 */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Full Name</Label>
                <Input 
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Imran Khan"
                  className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm"
                />
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Username</Label>
                <Input 
                  value={username}
                  disabled
                  className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border cursor-not-allowed text-slate-500 shadow-sm"
                  placeholder="admin"
                />
                <p className="text-[11px] text-slate-500">Username cannot be changed.</p>
              </div>

              {/* Row 2 */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex justify-between">
                  Email Address
                  {errors.email && <span className="text-red-500 text-[11px] font-normal">{errors.email}</span>}
                </Label>
                <Input 
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  className={`rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm ${errors.email ? "border-red-500 focus-visible:ring-red-500/30" : ""}`}
                  placeholder="e.g. user@example.com"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold flex justify-between">
                  Phone Number
                  {errors.phone && <span className="text-red-500 text-[11px] font-normal">{errors.phone}</span>}
                </Label>
                <Input 
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className={`rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm ${errors.phone ? "border-red-500 focus-visible:ring-red-500/30" : ""}`}
                  placeholder="03XX-XXXXXXX"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4 mt-4">
              <Label className="text-sm font-semibold block">Profile Photo</Label>
              <div className="flex flex-col xl:flex-row gap-6 items-start">
                
                {/* Photo Preview */}
                <div className="w-36 h-36 shrink-0 border-2 border-dashed border-indigo-200 dark:border-slate-700 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-50/50 to-white dark:from-transparent dark:to-transparent overflow-hidden relative group transition-colors hover:border-indigo-400 dark:hover:border-slate-500 shadow-sm">
                  {(photoPreview || user.profile_photo_path) ? (
                    <img 
                      src={photoPreview || `http://127.0.0.1:8000${user.profile_photo_path}?t=${timestamp}`} 
                      alt="Profile Preview" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                      {getInitials(user.full_name || user.username || "")}
                    </span>
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
                  
                  <div className="flex flex-wrap gap-2.5">
                    <Button variant="outline" onClick={() => photoInputRef.current?.click()} className="text-sm rounded-xl border-border hover:bg-secondary transition-all">
                      <Upload className="w-4 h-4 mr-2 text-indigo-500" /> {user.profile_photo_path ? 'Replace Photo' : 'Select Photo'}
                    </Button>
                    
                    {photoFile && (
                      <Button variant="default" onClick={uploadPhoto} className="text-sm rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all">
                        <Save className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    )}

                    {(user.profile_photo_path || photoFile) && (
                      <Button variant="destructive" onClick={() => photoFile ? (setPhotoFile(null), setPhotoPreview(null)) : removePhoto()} className="text-sm rounded-xl shadow-sm transition-all hover:shadow-red-500/20">
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
              <Button variant="ghost" onClick={() => {
                setFullName(user.full_name || "");
                setUsername(user.username || "");
                setEmail(user.email || "");
                setPhoneNumber(user.phone_number || "");
                setErrors({});
                setPhotoFile(null);
                setPhotoPreview(null);
              }} className="rounded-xl h-12 px-6 transition-colors">
                Cancel Changes
              </Button>
              <SaveButton isSaving={isSavingProfile} onClick={handleSaveProfileText} />
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Crop Modal for Profile Photo */}
      {isCropping && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col border border-border">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Crop Profile Photo</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsCropping(false)} className="h-8">Cancel</Button>
            </div>
            <div className="relative w-full h-[400px] bg-slate-100 dark:bg-secondary/20">
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
