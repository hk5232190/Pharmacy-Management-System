"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useProfile } from "@/contexts/ProfileContext";
import { UploadCloud, Save, RefreshCw, Info, Image as ImageIcon, CheckCircle2 } from "lucide-react";

interface PharmacyProfile {
  ProfileId?: number;
  PharmacyName: string;
  OwnerName: string;
  RegistrationNumber: string;
  DrugLicenseNumber: string;
  PhoneNumber: string;
  EmailAddress: string;
  Address: string;
  City: string;
  State: string;
  Country: string;
  PostalCode: string;
  Website: string;
  LogoPath: string | null;
}

const DEFAULT_PROFILE: PharmacyProfile = {
  PharmacyName: "", OwnerName: "", RegistrationNumber: "", DrugLicenseNumber: "",
  PhoneNumber: "", EmailAddress: "", Address: "", City: "", State: "",
  Country: "", PostalCode: "", Website: "", LogoPath: null
};

export default function PharmacyProfilePage() {
  const { refreshProfile } = useProfile();
  const [profile, setProfile] = useState<PharmacyProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile({
          ...DEFAULT_PROFILE,
          ...data
        });
        if (data.LogoPath) {
          setLogoPreviewUrl(`http://127.0.0.1:8000${data.LogoPath}?t=${new Date().getTime()}`);
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        toast.success("Pharmacy Profile updated successfully!");
        await refreshProfile();
      } else {
        toast.error("Failed to update profile.");
      }
    } catch (error) {
      toast.error("Network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Create a local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(objectUrl);
    
    // Upload to server
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/profile/logo", {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Logo uploaded successfully!");
        setProfile({ ...profile, LogoPath: data.logo_path });
        setLogoPreviewUrl(`http://127.0.0.1:8000${data.logo_path}?t=${new Date().getTime()}`);
        await refreshProfile();
      } else {
        toast.error("Failed to upload logo.");
      }
    } catch (error) {
      toast.error("Network error during upload.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between pb-4 border-b">
            <div>
              <CardTitle className="text-xl font-bold">Pharmacy Information</CardTitle>
              <CardDescription className="mt-1">Update your pharmacy details. These will be used in invoices and reports.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="hidden md:flex">
              <UploadCloud className="w-4 h-4 mr-2" /> Upload Logo
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="PharmacyName">Pharmacy Name <span className="text-red-500">*</span></Label>
                <Input id="PharmacyName" name="PharmacyName" value={profile.PharmacyName || ""} onChange={handleChange} placeholder="e.g. ABC Pharmacy" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="OwnerName">Owner Name</Label>
                <Input id="OwnerName" name="OwnerName" value={profile.OwnerName || ""} onChange={handleChange} placeholder="e.g. Mr. Ahmad Khan" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="RegistrationNumber">Registration Number</Label>
                <Input id="RegistrationNumber" name="RegistrationNumber" value={profile.RegistrationNumber || ""} onChange={handleChange} placeholder="REG-2021-5566" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="DrugLicenseNumber">Drug License Number</Label>
                <Input id="DrugLicenseNumber" name="DrugLicenseNumber" value={profile.DrugLicenseNumber || ""} onChange={handleChange} placeholder="DLD-987654" />
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
            
            <div className="mt-8 pt-6 border-t flex flex-col md:flex-row items-center justify-between">
              <p className="text-xs text-slate-500 mb-4 md:mb-0">Fields marked with <span className="text-red-500">*</span> are required.</p>
              <div className="flex space-x-3 w-full md:w-auto">
                <Button variant="outline" onClick={fetchProfile} className="w-full md:w-auto">
                  <RefreshCw className="w-4 h-4 mr-2" /> Reset
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white">
                  {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 
                  Save Changes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Tips */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border rounded-xl p-4 flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-400">Keep your pharmacy information updated for accurate invoices and reports.</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border rounded-xl p-4 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-400">Upload a high quality logo for best print results. (300 x 100 px PNG/JPG)</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border rounded-xl p-4 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-400">Changes will be applied instantly across the entire system after clicking Save.</p>
          </div>
        </div>
      </div>

      {/* Right Column: Previews */}
      <div className="space-y-6">


        {/* Receipt Preview */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Information Preview (Receipt)</h3>
          <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-md relative overflow-hidden">
            {/* Top receipt tear edge effect */}
            <div className="absolute top-0 left-0 right-0 h-2 flex justify-between space-x-1 px-1">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="w-3 h-3 bg-slate-50 dark:bg-slate-900 rounded-full -mt-1.5 shadow-inner"></div>
              ))}
            </div>
            
            <CardContent className="p-6 pt-8 font-mono text-xs">
              <div className="flex flex-col items-center text-center pb-4 border-b border-dashed border-slate-300 dark:border-slate-700">
                {logoPreviewUrl && <img src={logoPreviewUrl} alt="Logo" className="h-10 mb-3 object-contain" />}
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {profile.PharmacyName || "YOUR PHARMACY NAME"}
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 uppercase">Your Health, Our Priority</p>
                
                <div className="mt-3 space-y-0.5 text-slate-600 dark:text-slate-400">
                  <p>{profile.Address || "123 Pharmacy Street, City"}</p>
                  {(profile.City || profile.State || profile.PostalCode || profile.Country) && (
                    <p>{[profile.City, profile.State, profile.Country, profile.PostalCode].filter(Boolean).join(", ")}</p>
                  )}
                  {profile.PhoneNumber && <p>Phone: {profile.PhoneNumber}</p>}
                  {profile.EmailAddress && <p>Email: {profile.EmailAddress}</p>}
                </div>
              </div>
              
              <div className="py-4 border-b border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                <p className="text-center font-bold text-blue-600 dark:text-blue-400 mb-2">TAX INVOICE</p>
                <div className="flex justify-between">
                  <span>Invoice #: INV-2505-0156</span>
                  <span>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="mt-1">Customer: Walk-in Customer</div>
              </div>
              
              <div className="py-4 text-slate-700 dark:text-slate-300">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dashed border-slate-300 dark:border-slate-700">
                      <th className="text-left font-semibold pb-2">Item</th>
                      <th className="text-right font-semibold pb-2">Qty</th>
                      <th className="text-right font-semibold pb-2">Price</th>
                      <th className="text-right font-semibold pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2">Paracetamol 500mg</td>
                      <td className="text-right py-2">2</td>
                      <td className="text-right py-2">25.00</td>
                      <td className="text-right py-2">50.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>50.00</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Discount</span>
                  <span>- 5.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (12%)</span>
                  <span>5.40</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Grand Total</span>
                  <span className="text-blue-600 dark:text-blue-400">Rs. 50.40</span>
                </div>
              </div>
              
              <div className="mt-6 text-center text-[10px] text-green-600 dark:text-green-500 font-medium italic">
                Thank you for choosing us!
              </div>
            </CardContent>
            
            {/* Bottom receipt tear edge effect */}
            <div className="absolute bottom-0 left-0 right-0 h-2 flex justify-between space-x-1 px-1">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="w-3 h-3 bg-slate-50 dark:bg-slate-900 rounded-full -mb-1.5 shadow-inner"></div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
