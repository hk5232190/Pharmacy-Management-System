import re

file_path = 'src/app/dashboard/settings/printer/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update interface PrinterSettings
if 'PharmacyName: string;' not in content:
    content = re.sub(
        r'  SettingsId\?: number;\n',
        r'  SettingsId?: number;\n  PharmacyName: string;\n  PharmacyAddress: string | null;\n  PharmacyPhone: string | null;\n  DrugLicenseNumber: string | null;\n  NtnStrn: string | null;\n  Website: string | null;\n  ReceiptLogoPath: string | null;\n',
        content
    )

# 2. Update DEFAULT_SETTINGS
if 'PharmacyName: "My Pharmacy",' not in content:
    content = re.sub(
        r'  PrinterType: "ESC/POS Thermal",\n',
        r'  PharmacyName: "My Pharmacy",\n  PharmacyAddress: null,\n  PharmacyPhone: null,\n  DrugLicenseNumber: null,\n  NtnStrn: null,\n  Website: null,\n  ReceiptLogoPath: null,\n  PrinterType: "ESC/POS Thermal",\n',
        content
    )

# 3. Add logo state
if 'const [logoFileToUpload' not in content:
    content = re.sub(
        r'  const \[isSaving, setIsSaving\] = useState\(false\);',
        r'  const [logoFileToUpload, setLogoFileToUpload] = useState<File | null>(null);\n  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);\n  const [logoRemoved, setLogoRemoved] = useState<boolean>(false);\n  const fileInputRef = useRef<HTMLInputElement>(null);\n\n  const [isSaving, setIsSaving] = useState(false);',
        content
    )

# 4. Import useRef and other icons
content = content.replace('import { useState, useEffect, useCallback } from "react";', 'import { useState, useEffect, useCallback, useRef } from "react";')
content = content.replace('Save, RefreshCw, Printer, Usb, Receipt, AlertTriangle,\n  CheckCircle2, Server, Settings2, Eye, Copy, Zap\n} from "lucide-react";', 'Save, RefreshCw, Printer, Usb, Receipt, AlertTriangle,\n  CheckCircle2, Server, Settings2, Eye, Copy, Zap, UploadCloud, Image as ImageIcon, Trash2, Building\n} from "lucide-react";')

# 5. Update fetchSettings
fetch_settings_old = '''  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const [printerRes, profileRes, billingRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/settings/printer`),
        fetch(`${getApiBaseUrl()}/settings/pharmacy-profile`),
        fetch(`${getApiBaseUrl()}/settings/billing`),
      ]);

      if (printerRes.ok) {
        const data = await printerRes.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      }
      if (profileRes.ok) {
        const p = await profileRes.json();
        if (p.PharmacyName) setPharmacyName(p.PharmacyName);
        if (p.Address) setPharmacyAddress(p.Address);
        if (p.PhoneNumber) setPharmacyPhone(p.PhoneNumber);
        if (p.DrugLicenseNumber || p.NtnStrn) {
          setLicenseInfo(`Lic: ${p.DrugLicenseNumber || "N/A"} / NTN: ${p.NtnStrn || "N/A"}`);
        }
      }
      if (billingRes.ok) {
        const b = await billingRes.json();
        if (b.CurrencySymbol) setCurrency(b.CurrencySymbol);
      }
    } catch {
      toast.error("Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  };'''

fetch_settings_new = '''  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const headers = token ? { "Authorization": `Bearer ${token}` } : {};
      const [printerRes, billingRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/settings/printer`, { headers }),
        fetch(`${getApiBaseUrl()}/settings/billing`, { headers }),
      ]);

      if (printerRes.ok) {
        const data = await printerRes.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
        
        if (data.PharmacyName) setPharmacyName(data.PharmacyName);
        if (data.PharmacyAddress) setPharmacyAddress(data.PharmacyAddress);
        if (data.PharmacyPhone) setPharmacyPhone(data.PharmacyPhone);
        if (data.DrugLicenseNumber || data.NtnStrn) {
          setLicenseInfo(`Lic: ${data.DrugLicenseNumber || "N/A"} / NTN: ${data.NtnStrn || "N/A"}`);
        }
        
        if (data.ReceiptLogoPath) {
          const path = data.ReceiptLogoPath.startsWith('/') ? data.ReceiptLogoPath : `/${data.ReceiptLogoPath}`;
          setLogoPreviewUrl(`${getApiBaseUrl().replace("/api/v1","")}${path}`);
        } else {
          setLogoPreviewUrl(null);
        }
      }
      if (billingRes.ok) {
        const b = await billingRes.json();
        if (b.CurrencySymbol) setCurrency(b.CurrencySymbol);
      }
    } catch {
      toast.error("Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  };'''
content = content.replace(fetch_settings_old, fetch_settings_new)

# 6. Update handleSave to upload logo
handle_save_old = '''  const handleSave = async () => {
    if (settings.Copies < 1 || settings.Copies > 10) {
      toast.error("Copies must be between 1 and 10.");
      return;
    }
    if (settings.FontScale < 60 || settings.FontScale > 150) {
      toast.error("Font Scale must be between 60% and 150%.");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const res = await fetch(`${getApiBaseUrl()}/settings/printer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Printer & Receipt settings saved!");
      } else {
        toast.error("Failed to save settings.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setIsSaving(false);
    }
  };'''

handle_save_new = '''  const handleSave = async () => {
    if (settings.Copies < 1 || settings.Copies > 10) {
      toast.error("Copies must be between 1 and 10.");
      return;
    }
    if (settings.FontScale < 60 || settings.FontScale > 150) {
      toast.error("Font Scale must be between 60% and 150%.");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await fetch(`${getApiBaseUrl()}/settings/printer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        toast.error("Failed to save settings.");
        return;
      }
      
      if (logoFileToUpload) {
        const formData = new FormData();
        formData.append("file", logoFileToUpload);
        const uploadRes = await fetch(`${getApiBaseUrl()}/settings/printer/receipt-logo`, {
          method: "POST",
          headers,
          body: formData
        });
        if (!uploadRes.ok) {
          toast.error("Failed to upload logo.");
          return;
        }
        setLogoFileToUpload(null);
        setLogoRemoved(false);
      } else if (logoRemoved) {
        const deleteRes = await fetch(`${getApiBaseUrl()}/settings/printer/receipt-logo`, {
          method: "DELETE",
          headers
        });
        if (!deleteRes.ok) {
          toast.error("Failed to remove logo.");
          return;
        }
        setLogoRemoved(false);
      }

      toast.success("Printer & Receipt settings saved!");
      fetchSettings(); // Refresh to get updated logo path
      
      // Update global profile context so that topbar updates immediately
      window.dispatchEvent(new Event("profile-updated"));
    } catch {
      toast.error("Network error.");
    } finally {
      setIsSaving(false);
    }
  };'''
content = content.replace(handle_save_old, handle_save_new)

# 7. Add Pharmacy Information block inside Layout Controls tab
pharmacy_info_jsx = '''
                {/* Pharmacy Branding */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Pharmacy Branding</h3>
                  
                  <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <div className="space-y-3 shrink-0">
                      <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Receipt Logo</Label>
                      <div 
                        className="w-32 h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer overflow-hidden relative group"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {logoPreviewUrl ? (
                          <>
                            <img src={logoPreviewUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <UploadCloud className="w-6 h-6 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center text-slate-400">
                            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                            <span className="text-[10px] font-medium text-center px-4">Click to upload<br/>(PNG/JPG)</span>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/png, image/jpeg, image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setLogoFileToUpload(file);
                              setLogoPreviewUrl(URL.createObjectURL(file));
                              setLogoRemoved(false);
                            }
                          }}
                        />
                      </div>
                      
                      {logoPreviewUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => {
                            setLogoPreviewUrl(null);
                            setLogoFileToUpload(null);
                            setLogoRemoved(true);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Remove Logo
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      <div className="space-y-2">
                        <Label>Pharmacy Name</Label>
                        <Input
                          value={settings.PharmacyName || ""}
                          onChange={e => { setSetting("PharmacyName", e.target.value); setPharmacyName(e.target.value); }}
                          placeholder="e.g. City Pharmacy"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          value={settings.PharmacyPhone || ""}
                          onChange={e => { setSetting("PharmacyPhone", e.target.value); setPharmacyPhone(e.target.value); }}
                          placeholder="e.g. +92 300 1234567"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Address</Label>
                        <Input
                          value={settings.PharmacyAddress || ""}
                          onChange={e => { setSetting("PharmacyAddress", e.target.value); setPharmacyAddress(e.target.value); }}
                          placeholder="e.g. 123 Health Street, City"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Drug License Number</Label>
                        <Input
                          value={settings.DrugLicenseNumber || ""}
                          onChange={e => { setSetting("DrugLicenseNumber", e.target.value); setLicenseInfo(`Lic: ${e.target.value || "N/A"} / NTN: ${settings.NtnStrn || "N/A"}`); }}
                          placeholder="e.g. DL-123456"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>NTN / STRN</Label>
                        <Input
                          value={settings.NtnStrn || ""}
                          onChange={e => { setSetting("NtnStrn", e.target.value); setLicenseInfo(`Lic: ${settings.DrugLicenseNumber || "N/A"} / NTN: ${e.target.value || "N/A"}`); }}
                          placeholder="e.g. 1234567-8"
                          className="bg-white dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
'''

if 'Pharmacy Branding' not in content:
    content = content.replace('{/* Receipt Title */}', pharmacy_info_jsx + '\n                {/* Receipt Title */}')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated page.tsx')
