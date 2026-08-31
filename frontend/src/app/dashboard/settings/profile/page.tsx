"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useProfile } from "@/contexts/ProfileContext";
import { UploadCloud, Save, RefreshCw, Info, Image as ImageIcon, CheckCircle2, ShieldCheck, MapPin, Building } from "lucide-react";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

interface PharmacyProfile {
  ProfileId?: number;
  PharmacyName: string;
  PharmacySlogan: string;
  OwnerName: string;
  RegistrationNumber: string;
  DrugLicenseNumber: string;
  NtnStrn: string;
  PhoneNumber: string;
  EmailAddress: string;
  Address: string;
  City: string;
  State: string;
  Country: string;
  PostalCode: string;
  Website: string;
  LogoPath: string | null;
  ReceiptLogoPath: string | null;
}

const DEFAULT_PROFILE: PharmacyProfile = {
  PharmacyName: "", PharmacySlogan: "", OwnerName: "", RegistrationNumber: "", DrugLicenseNumber: "", NtnStrn: "",
  PhoneNumber: "", EmailAddress: "", Address: "", City: "", State: "",
  Country: "", PostalCode: "", Website: "", LogoPath: null, ReceiptLogoPath: null
};

export default function PharmacyProfilePage() {
  const { refreshProfile } = useProfile();
  const [profile, setProfile] = useState<PharmacyProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  // Cropper & Deferred Upload State
  const [isCropping, setIsCropping] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  
  const [logoFileToUpload, setLogoFileToUpload] = useState<File | Blob | null>(null);
  const [shouldRemoveLogo, setShouldRemoveLogo] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    return token ? { "Authorization": `Bearer ${token}` } : {};
  };

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/profile", {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          ...DEFAULT_PROFILE,
          ...data
        });
        if (data.ReceiptLogoPath) {
          setLogoPreviewUrl(`http://127.0.0.1:8000${data.ReceiptLogoPath}?t=${new Date().getTime()}`);
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.PharmacyName) {
      toast.error("Pharmacy Name is required");
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. Save text profile
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(profile)
      });
      if (!res.ok) throw new Error("Failed to update profile.");
      
      // 2. Handle Logo operations
      if (shouldRemoveLogo) {
        await fetch("http://127.0.0.1:8000/api/v1/settings/profile/receipt-logo", {
          method: "DELETE",
          headers: getAuthHeaders()
        });
      } else if (logoFileToUpload) {
        const formData = new FormData();
        formData.append("file", logoFileToUpload, "receipt_logo.png");
        await fetch("http://127.0.0.1:8000/api/v1/settings/profile/receipt-logo", {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData
        });
      }
      
      toast.success("Pharmacy Profile updated successfully!");
      setLogoFileToUpload(null);
      setShouldRemoveLogo(false);
      
      await refreshProfile();
      await fetchProfile(); // Ensure UI state is strictly in sync
    } catch (error) {
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setCropImageSrc(reader.result as string);
      setIsCropping(true);
    });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const showCroppedImage = async () => {
    try {
      if (!cropImageSrc || !croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      if (croppedImage) {
        setLogoFileToUpload(croppedImage);
        setLogoPreviewUrl(URL.createObjectURL(croppedImage));
        setShouldRemoveLogo(false);
        setIsCropping(false);
      }
    } catch (e) {
      toast.error("Failed to crop image.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === "PhoneNumber") {
      newValue = value.replace(/\D/g, "");
      if (newValue.length > 4) {
        newValue = newValue.substring(0, 4) + "-" + newValue.substring(4, 11);
      }
    } else if (name === "State" || name === "PostalCode") {
      newValue = value.toUpperCase();
    } else if (name === "City" || name === "Address") {
      newValue = value.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
      );
    }

    setProfile({ ...profile, [name]: newValue });
  };

  const handleRemoveLogo = () => {
    setLogoPreviewUrl(null);
    setLogoFileToUpload(null);
    setProfile({ ...profile, ReceiptLogoPath: null });
    setShouldRemoveLogo(true);
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 pr-2 lg:pr-4">
      {/* Left Column: Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none rounded-2xl overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-indigo-700 dark:text-indigo-400">
                <Building className="w-5 h-5 drop-shadow-sm" /> Pharmacy Information
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Update your core pharmacy details. These will be elegantly displayed on your invoices and system reports.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Logo Section */}
              <div className="md:col-span-2 flex flex-col sm:flex-row gap-6 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 items-center transition-all group">
                 <div className="shrink-0 w-20 h-20 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-zinc-900 overflow-hidden shadow-sm relative cursor-pointer group-hover:border-indigo-400 dark:group-hover:border-indigo-500 transition-colors" onClick={() => fileInputRef.current?.click()}>
                   {logoPreviewUrl ? (
                     <img src={logoPreviewUrl} alt="Logo" className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />
                   ) : (
                     <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform" />
                   )}
                   <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <UploadCloud className="w-6 h-6 text-white" />
                   </div>
                 </div>
                 <div className="space-y-1.5 w-full text-center sm:text-left">
                   <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">Pharmacy Logo</h4>
                   <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Recommended ratio 1:1 (Square), max 5MB.</p>
                   <div className="flex gap-3 justify-center sm:justify-start">
                     <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-9 px-4 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                       <UploadCloud className="w-3.5 h-3.5 mr-2" /> {logoPreviewUrl ? 'Change Logo' : 'Upload Logo'}
                     </Button>
                     {(logoPreviewUrl || profile.ReceiptLogoPath) && (
                       <Button variant="outline" size="sm" onClick={handleRemoveLogo} className="text-xs h-9 px-4 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/30 transition-colors">
                         Remove
                       </Button>
                     )}
                   </div>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                 </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="PharmacyName">Pharmacy Name <span className="text-red-500">*</span></Label>
                <Input id="PharmacyName" name="PharmacyName" value={profile.PharmacyName || ""} onChange={handleChange} placeholder="e.g. ABC Pharmacy" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="PharmacySlogan">Pharmacy Slogan / Tagline</Label>
                <Input id="PharmacySlogan" name="PharmacySlogan" value={profile.PharmacySlogan || ""} onChange={handleChange} placeholder="e.g. Your Health, Our Priority" />
              </div>

              {/* Compliance & Licensing Group */}
              <div className="md:col-span-2 pt-6 pb-2">
                <div className="flex items-center space-x-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-500" />
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Tax & Licensing Compliance</h4>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="OwnerName">Owner Name</Label>
                <Input id="OwnerName" name="OwnerName" value={profile.OwnerName || ""} onChange={handleChange} placeholder="e.g. Mr. Ahmad Khan" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="NtnStrn">NTN / Tax STRN Number</Label>
                <Input id="NtnStrn" name="NtnStrn" value={profile.NtnStrn || ""} onChange={handleChange} placeholder="e.g. 1234567-8" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="DrugLicenseNumber">Drug License Number</Label>
                <Input id="DrugLicenseNumber" name="DrugLicenseNumber" value={profile.DrugLicenseNumber || ""} onChange={handleChange} placeholder="DLD-987654" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="RegistrationNumber">Registration Number</Label>
                <Input id="RegistrationNumber" name="RegistrationNumber" value={profile.RegistrationNumber || ""} onChange={handleChange} placeholder="REG-2021-5566" />
              </div>

              {/* Contact Information Group */}
              <div className="md:col-span-2 pt-6 pb-2">
                <div className="flex items-center space-x-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                  <MapPin className="w-5 h-5 text-indigo-500" />
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Contact & Address</h4>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="PhoneNumber">Phone Number <span className="text-red-500">*</span></Label>
                <Input id="PhoneNumber" name="PhoneNumber" value={profile.PhoneNumber || ""} onChange={handleChange} placeholder="+92 300 1234567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="EmailAddress">Email Address <span className="text-red-500">*</span></Label>
                <Input id="EmailAddress" name="EmailAddress" value={profile.EmailAddress || ""} onChange={handleChange} placeholder="abcpharmacy@gmail.com" />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="Address">Address <span className="text-red-500">*</span></Label>
                <Input id="Address" name="Address" value={profile.Address || ""} onChange={handleChange} placeholder="123 Main Street, Near City Hospital, Saddar" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="City">City <span className="text-red-500">*</span></Label>
                <Input id="City" name="City" value={profile.City || ""} onChange={handleChange} placeholder="Lahore" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="State">State / Province <span className="text-red-500">*</span></Label>
                <Input id="State" name="State" value={profile.State || ""} onChange={handleChange} placeholder="Punjab" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="Country">Country <span className="text-red-500">*</span></Label>
                <Input id="Country" name="Country" value={profile.Country || ""} onChange={handleChange} placeholder="Pakistan" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="PostalCode">Postal Code</Label>
                <Input id="PostalCode" name="PostalCode" value={profile.PostalCode || ""} onChange={handleChange} placeholder="54000" />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="Website">Website (optional)</Label>
                <Input id="Website" name="Website" value={profile.Website || ""} onChange={handleChange} placeholder="www.abcpharmacy.com" />
              </div>
            </div>
            
            <div className="mt-10 pt-6 border-t border-slate-200/60 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between">
              <p className="text-xs text-slate-500 mb-4 md:mb-0 flex items-center">
                <Info className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                Fields marked with <span className="text-red-500 mx-1">*</span> are required.
              </p>
              <div className="flex space-x-3 w-full md:w-auto">
                <Button variant="outline" onClick={fetchProfile} className="w-full md:w-auto px-6 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <RefreshCw className="w-4 h-4 mr-2" /> Reset
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all border-0">
                  {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 
                  Save Changes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Right Column: Previews */}
      <div className="space-y-6">


        {/* Receipt Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center">
              <Info className="w-4 h-4 mr-2 text-indigo-500" />
              Information Preview (Receipt)
            </h3>
          </div>
          
          <Card className="border-0 shadow-2xl relative overflow-hidden ring-1 ring-slate-200/50 dark:ring-slate-800/80 rounded-sm">
            {/* Top receipt tear edge effect */}
            <div className="absolute top-0 left-0 right-0 h-3 flex justify-between space-x-1 px-1 bg-slate-200/20 dark:bg-black/20 shadow-inner">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="w-3 h-3 bg-[#f8fafc] dark:bg-zinc-950 rounded-full -mt-1.5 shadow-sm"></div>
              ))}
            </div>
            
            <CardContent className="p-8 pt-10 font-mono text-xs relative">
              {/* Subtle paper texture/noise background (optional via CSS, simulated here with opacity) */}
              <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
              
              <div className="relative z-10 flex flex-col items-center text-center pb-5 border-b border-dashed border-slate-300 dark:border-slate-700/60">
                {logoPreviewUrl && <img src={logoPreviewUrl} alt="Logo" className="w-14 h-14 mb-3 object-cover rounded-lg filter drop-shadow-sm border border-slate-200/50 dark:border-slate-700/50" />}
                <h4 className="text-sm font-extrabold uppercase tracking-widest text-slate-900 dark:text-slate-100">
                  {profile.PharmacyName || "YOUR PHARMACY NAME"}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase font-medium tracking-widest">{profile.PharmacySlogan || "Your Health, Our Priority"}</p>
                
                <div className="mt-4 space-y-1 text-slate-600 dark:text-slate-400 font-medium">
                  <p>{profile.Address || "123 Pharmacy Street"}</p>
                  {(profile.City || profile.State || profile.PostalCode || profile.Country) && (
                    <p>{[profile.City, profile.State, profile.PostalCode, profile.Country].filter(Boolean).join(", ")}</p>
                  )}
                  
                  <div className="pt-2 mt-2 border-t border-dashed border-slate-200 dark:border-slate-700/60 inline-block px-4">
                    {profile.PhoneNumber && <p>Phone: {profile.PhoneNumber}</p>}
                    {profile.EmailAddress && <p>Email: {profile.EmailAddress}</p>}
                    {profile.DrugLicenseNumber && <p>DL No: {profile.DrugLicenseNumber}</p>}
                    {profile.NtnStrn && <p>NTN/STRN: {profile.NtnStrn}</p>}
                  </div>
                </div>
              </div>
              
              <div className="relative z-10 py-5 border-b border-dashed border-slate-300 dark:border-slate-700/60 text-slate-600 dark:text-slate-400">
                <p className="text-center font-bold text-slate-800 dark:text-slate-200 mb-3 tracking-widest">TAX INVOICE</p>
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p>Invoice #: <span className="text-slate-900 dark:text-slate-200">INV-2505-0156</span></p>
                    <p>Customer: <span className="text-slate-900 dark:text-slate-200">Walk-in</span></p>
                  </div>
                  <div className="text-right">
                    <p>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
              </div>
              
              <div className="relative z-10 py-4 text-slate-700 dark:text-slate-300">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dashed border-slate-300 dark:border-slate-700/60 text-slate-500">
                      <th className="text-left font-semibold pb-2">Item</th>
                      <th className="text-right font-semibold pb-2">Qty</th>
                      <th className="text-right font-semibold pb-2">Price</th>
                      <th className="text-right font-semibold pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-3 font-medium">Paracetamol 500mg</td>
                      <td className="text-right py-3">2</td>
                      <td className="text-right py-3">25.00</td>
                      <td className="text-right py-3">50.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="relative z-10 pt-3 border-t border-dashed border-slate-300 dark:border-slate-700/60 space-y-1.5 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>50.00</span>
                </div>
                <div className="flex justify-between text-red-500/90 dark:text-red-400">
                  <span>Discount</span>
                  <span>- 5.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (12%)</span>
                  <span>5.40</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white mt-3 pt-3 border-t border-slate-300 dark:border-slate-700/60">
                  <span>Grand Total</span>
                  <span className="text-indigo-600 dark:text-indigo-400">Rs. 50.40</span>
                </div>
              </div>
              
              <div className="relative z-10 mt-8 text-center text-[10px] text-slate-500 dark:text-slate-400 font-medium italic">
                Thank you for choosing us!
              </div>
            </CardContent>
            
            {/* Bottom receipt tear edge effect */}
            <div className="absolute bottom-0 left-0 right-0 h-3 flex justify-between space-x-1 px-1 bg-slate-200/20 dark:bg-black/20 shadow-inner">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="w-3 h-3 bg-[#f8fafc] dark:bg-zinc-950 rounded-full -mb-1.5 shadow-sm"></div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Crop Modal for Logo */}
      {isCropping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Crop Logo</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsCropping(false)} className="h-8">Cancel</Button>
            </div>
            <div className="relative h-64 sm:h-80 w-full bg-slate-100 dark:bg-slate-950">
              {cropImageSrc && (
                  <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              )}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2 bg-slate-50 dark:bg-slate-900/50">
              <Button variant="outline" onClick={() => setIsCropping(false)}>Cancel</Button>
              <Button onClick={showCroppedImage} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                Apply Crop
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

