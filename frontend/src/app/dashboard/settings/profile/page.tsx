"use client";
import { getApiBaseUrl } from "@/lib/api-client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useProfile } from "@/contexts/ProfileContext";
import { SaveButton } from "@/components/ui/save-button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Info, Building, UploadCloud, Image as ImageIcon, Trash2 } from "lucide-react";

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
  ReceiptFooter1: string;
  ReceiptFooter2: string;
}

const DEFAULT_PROFILE: PharmacyProfile = {
  PharmacyName: "", PharmacySlogan: "", OwnerName: "", RegistrationNumber: "", DrugLicenseNumber: "", NtnStrn: "",
  PhoneNumber: "", EmailAddress: "", Address: "", City: "", State: "",
  Country: "", PostalCode: "", Website: "", LogoPath: null, ReceiptLogoPath: null,
  ReceiptFooter1: "Thank you for your visit!",
  ReceiptFooter2: "Software provided by Eagle Nest Creations"
};

export default function PharmacyProfilePage() {
  const { refreshProfile } = useProfile();
  const [profile, setProfile] = useState<PharmacyProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logoFileToUpload, setLogoFileToUpload] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [showLogoOnReceipt, setShowLogoOnReceipt] = useState<boolean>(true);
  const [logoRemoved, setLogoRemoved] = useState<boolean>(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    return token ? { "Authorization": `Bearer ${token}` } : {};
  };

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/settings/profile`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          ...DEFAULT_PROFILE,
          ...data
        });
        if (data.ReceiptLogoPath) {
          const path = data.ReceiptLogoPath.startsWith('/') ? data.ReceiptLogoPath : `/${data.ReceiptLogoPath}`;
          setLogoPreviewUrl(`${getApiBaseUrl().replace("/api/v1","")}${path}`);
        } else if (data.LogoPath) {
          const path = data.LogoPath.startsWith('/') ? data.LogoPath : `/${data.LogoPath}`;
          setLogoPreviewUrl(`${getApiBaseUrl().replace("/api/v1","")}${path}`);
        } else {
          setLogoPreviewUrl(null);
        }
      }
      
      const printerRes = await fetch(`${getApiBaseUrl()}/settings/printer`, {
        headers: getAuthHeaders()
      });
      if (printerRes.ok) {
        const printerData = await printerRes.json();
        setShowLogoOnReceipt(printerData.ShowLogo);
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
      const res = await fetch(`${getApiBaseUrl()}/settings/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(profile)
      });
      if (!res.ok) throw new Error("Failed to update profile.");
      
      // 2. Upload Logo if exists
      if (logoFileToUpload) {
        const formData = new FormData();
        formData.append("file", logoFileToUpload);
        const uploadRes = await fetch(`${getApiBaseUrl()}/settings/profile/receipt-logo`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData
        });
        if (!uploadRes.ok) throw new Error("Failed to upload logo.");
        setLogoFileToUpload(null);
        setLogoRemoved(false);
      } else if (logoRemoved) {
        // Delete logo
        await fetch(`${getApiBaseUrl()}/settings/profile/receipt-logo`, {
          method: "DELETE",
          headers: getAuthHeaders()
        });
        setLogoRemoved(false);
      }

      // 3. Save Printer Settings (ShowLogo)
      const printerRes = await fetch(`${getApiBaseUrl()}/settings/printer`, {
        headers: getAuthHeaders()
      });
      if (printerRes.ok) {
        const currentPrinterSettings = await printerRes.json();
        await fetch(`${getApiBaseUrl()}/settings/printer`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ ...currentPrinterSettings, ShowLogo: showLogoOnReceipt })
        });
      }
      
      toast.success("Pharmacy Profile updated successfully!");
      
      await refreshProfile();
      await fetchProfile(); // Ensure UI state is strictly in sync
    } catch (error) {
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
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



  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 pr-2 lg:pr-4">
      {/* Left Column: Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-800 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl">
          <CardHeader className="pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-transparent dark:to-transparent">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-indigo-700 dark:text-indigo-400">
                <Building className="w-5 h-5 drop-shadow-sm" /> Pharmacy Information
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Update your core pharmacy details. These will be elegantly displayed on your invoices and system reports.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-7 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="md:col-span-2 flex flex-col space-y-3 p-4 bg-slate-50 dark:bg-secondary/20 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Pharmacy Logo</Label>
                    <p className="text-xs text-slate-500 mt-1">Upload a logo to display on the receipt.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="show-logo" checked={showLogoOnReceipt} onCheckedChange={setShowLogoOnReceipt} />
                    <Label htmlFor="show-logo" className="text-xs cursor-pointer">Show on Receipt</Label>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 mt-2">
                  <div className="w-16 h-16 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                    {logoPreviewUrl ? (
                      <img src={logoPreviewUrl} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      id="logo-upload" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoFileToUpload(file);
                          setLogoPreviewUrl(URL.createObjectURL(file));
                          setShowLogoOnReceipt(true);
                        }
                      }} 
                    />
                    <div className="flex space-x-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('logo-upload')?.click()} className="h-8 text-xs bg-white">
                        <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Upload Logo
                      </Button>
                      {logoPreviewUrl && (
                        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                          setLogoFileToUpload(null);
                          setLogoPreviewUrl(null);
                          setShowLogoOnReceipt(false);
                          setLogoRemoved(true);
                          setProfile(prev => ({ ...prev, ReceiptLogoPath: null, LogoPath: null }));
                        }}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="PharmacyName" className="text-sm font-semibold">Pharmacy Name <span className="text-red-500">*</span></Label>
                <Input id="PharmacyName" name="PharmacyName" value={profile.PharmacyName || ""} onChange={handleChange} placeholder="e.g. ABC Pharmacy" className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="PhoneNumber" className="text-sm font-semibold">Contact / Mobile Number <span className="text-red-500">*</span></Label>
                <Input id="PhoneNumber" name="PhoneNumber" value={profile.PhoneNumber || ""} onChange={handleChange} placeholder="+92 300 1234567" className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>

              <div className="md:col-span-2 space-y-3">
                <Label htmlFor="Address" className="text-sm font-semibold">Pharmacy Address <span className="text-red-500">*</span></Label>
                <Input id="Address" name="Address" value={profile.Address || ""} onChange={handleChange} placeholder="123 Main Street" className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>

              <div className="space-y-3">
                <Label htmlFor="City" className="text-sm font-semibold">City <span className="text-red-500">*</span></Label>
                <Input id="City" name="City" value={profile.City || ""} onChange={handleChange} placeholder="Lahore" className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="State" className="text-sm font-semibold">State / Province <span className="text-red-500">*</span></Label>
                <Input id="State" name="State" value={profile.State || ""} onChange={handleChange} placeholder="Punjab" className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>

              <div className="space-y-3">
                <Label htmlFor="Country" className="text-sm font-semibold">Country <span className="text-red-500">*</span></Label>
                <Input id="Country" name="Country" value={profile.Country || ""} onChange={handleChange} placeholder="Pakistan" className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>

              <div className="space-y-3">
                <Label htmlFor="Website" className="text-sm font-semibold">Website (optional)</Label>
                <Input id="Website" name="Website" value={profile.Website || ""} onChange={handleChange} placeholder="www.abcpharmacy.com" className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="ReceiptFooter1" className="text-sm font-semibold">Receipt Footer Message</Label>
                <Input id="ReceiptFooter1" name="ReceiptFooter1" value={profile.ReceiptFooter1 || ""} onChange={handleChange} placeholder="e.g. Thank you for your visit!" className="rounded-xl bg-slate-50/70 dark:bg-secondary/30 border-border focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-sm" />
              </div>
            </div>
            
            <div className="mt-10 pt-6 border-t border-slate-200/60 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between">
              <p className="text-xs text-slate-500 mb-4 md:mb-0 flex items-center font-medium">
                <Info className="w-4 h-4 mr-1.5 text-indigo-500" />
                Fields marked with <span className="text-red-500 mx-1">*</span> are required.
              </p>
              <div className="flex space-x-3 w-full md:w-auto">
                <Button variant="outline" onClick={fetchProfile} className="w-full md:w-auto px-6 h-12 rounded-xl border-border hover:bg-secondary font-semibold shadow-sm transition-all">
                  <RefreshCw className="w-4 h-4 mr-2" /> Reset
                </Button>
                <SaveButton isSaving={isSaving} onClick={handleSave} className="w-full md:w-auto" />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Right Column: Previews */}
      <div className="space-y-6 sticky top-0 self-start">

        {/* Receipt Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
              <Info className="w-5 h-5 mr-2 text-indigo-600" />
              Information Preview (Receipt)
            </h3>
          </div>
          
          <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden ring-1 ring-slate-200/50 dark:ring-slate-800/80 rounded-sm">
            {/* Top receipt tear edge effect */}
            <div className="absolute top-0 left-0 right-0 h-3 flex justify-between space-x-1 px-1 bg-slate-200/20 dark:bg-black/20 shadow-inner">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="w-3 h-3 bg-[#f8fafc] dark:bg-zinc-950 rounded-full -mt-1.5 shadow-sm"></div>
              ))}
            </div>
            
            <CardContent className="p-8 pt-10 font-mono text-xs relative">
              {/* Subtle paper texture/noise background (optional via CSS, simulated here with opacity) */}
              <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
              
              <div className="relative z-10 flex flex-col text-left font-mono">
                <div className="text-center mb-2">
                  {showLogoOnReceipt && logoPreviewUrl && (
                    <div className="flex justify-center mb-2">
                      <img src={logoPreviewUrl} alt="Logo" className="w-12 h-12 object-contain grayscale" />
                    </div>
                  )}
                  <p className="text-sm font-semibold uppercase text-slate-900 dark:text-slate-100 mb-1">
                    {profile.PharmacyName || "PHARMACY NAME"}
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    Contact: {profile.PhoneNumber || "mobile number"}
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    Address: {profile.Address || "Pharmacy address"}
                  </p>
                </div>
                
                <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600 my-2"></div>
                
                <p className="text-slate-700 dark:text-slate-300">Receipt #: INV-000123</p>
                <p className="text-slate-700 dark:text-slate-300">Date: 07-Sep-2026</p>
                <p className="text-slate-700 dark:text-slate-300">Time: 01:04 PM</p>
                
                <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600 my-2"></div>
                
                <div className="flex text-slate-700 dark:text-slate-300">
                  <span className="flex-[2]">Item</span>
                  <span className="flex-1 text-center">Qty</span>
                  <span className="flex-1 text-right">Price</span>
                  <span className="flex-1 text-right">Total</span>
                </div>
                
                <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600 my-2"></div>
                
                <div className="flex text-slate-700 dark:text-slate-300 my-1">
                  <span className="flex-[2] truncate pr-1">Panadol</span>
                  <span className="flex-1 text-center">2</span>
                  <span className="flex-1 text-right">50.00</span>
                  <span className="flex-1 text-right">100.00</span>
                </div>
                <div className="flex text-slate-700 dark:text-slate-300 my-1">
                  <span className="flex-[2] truncate pr-1">Brufen</span>
                  <span className="flex-1 text-center">1</span>
                  <span className="flex-1 text-right">120.00</span>
                  <span className="flex-1 text-right">120.00</span>
                </div>
                <div className="flex text-slate-700 dark:text-slate-300 my-1">
                  <span className="flex-[2] truncate pr-1">Syrup</span>
                  <span className="flex-1 text-center">1</span>
                  <span className="flex-1 text-right">180.00</span>
                  <span className="flex-1 text-right">180.00</span>
                </div>
                
                <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600 my-2"></div>
                
                <div className="flex text-slate-700 dark:text-slate-300 my-1">
                  <span className="w-24">Subtotal:</span>
                  <span className="flex-1 text-right">400.00</span>
                </div>
                <div className="flex text-slate-700 dark:text-slate-300 my-1">
                  <span className="w-24">Discount:</span>
                  <span className="flex-1 text-right">0.00</span>
                </div>
                <div className="flex text-slate-700 dark:text-slate-300 my-1">
                  <span className="w-24">Tax:</span>
                  <span className="flex-1 text-right">0.00</span>
                </div>
                
                <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600 my-2"></div>
                
                <div className="flex text-slate-700 dark:text-slate-300 font-bold my-1">
                  <span className="w-24">TOTAL:</span>
                  <span className="flex-1 text-right">400.00</span>
                </div>
                
                <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600 my-2"></div>
                
                <div className="text-center text-[10px] text-gray-500 mt-6 pt-4 border-t border-dashed border-slate-300 dark:border-slate-600">
                  <p className="mb-1">{profile.ReceiptFooter1 || "Thank you for your visit!"}</p>
                  <p>{profile.ReceiptFooter2 || "Software provided by Eagle Nest Creations"}</p>
                </div>
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



    </div>
  );
}

