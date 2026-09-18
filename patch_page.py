import re

with open('e:/Projects/PMS-Software/frontend/src/app/dashboard/masters/medicines/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add ImportPreviewModal import
content = content.replace(
    'import { SmartCombobox } from "@/components/ui/smart-combobox";',
    'import { SmartCombobox } from "@/components/ui/smart-combobox";\nimport { ImportPreviewModal } from "@/components/medicines/import-preview-modal";'
)

# 2. Add state variables for preview
state_search = 'const [isImporting, setIsImporting] = useState(false);'
state_replacement = '''const [isImporting, setIsImporting] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);'''
content = content.replace(state_search, state_replacement)

# 3. Add handleConfirmImport and handleDownloadTemplate
handlers = '''
  const handleConfirmImport = async (validData: any[]) => {
    setIsImporting(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/medicines/import-bulk`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(validData),
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Import successful");
        setIsPreviewModalOpen(false);
        fetchMedicines();
      } else {
        toast.error(data.detail || data.message || "Failed to import");
      }
    } catch (err) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    const toastId = toast.loading("Generating smart template...");
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/medicines/import-template`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Template download failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "medicines_import_template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss(toastId);
      toast.success("Template downloaded successfully");
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to download template");
    }
  };
'''

content = content.replace(
    'const handleImportClick = () => {',
    handlers + '\n  const handleImportClick = () => {'
)

# 4. Modify handleFileChange to call import-preview
old_file_change = '''const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/medicines/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await res.json();
      if (res.ok && data.data) {
        toast.success(`Imported: ${data.data.imported_count}, Skipped: ${data.data.skipped_count}`);
        if (data.data.errors?.length > 0) {
          console.warn("Import errors:", data.data.errors);
          toast.error(`There were ${data.data.errors.length} errors. Check console.`);
        }
        fetchMedicines();
      } else {
        toast.error(data.detail || data.message || "Failed to import");
      }
    } catch (err) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };'''

new_file_change = '''const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/medicines/import-preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setPreviewData(data.data);
        setIsPreviewModalOpen(true);
      } else {
        toast.error(data.detail || data.message || "Failed to parse file");
      }
    } catch (err) {
      toast.error("Network error during file processing");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };'''
content = content.replace(old_file_change, new_file_change)

# 5. Add "Download Template" button and 6. Add ImportPreviewModal tag
# Let's find the Import button to add the Template button next to it.
import_button_regex = re.compile(r'(<Button\s+variant="outline"\s+onClick=\{handleImportClick\}\s+disabled=\{isImporting\}>\s*<Upload[^>]*>\s*\{isImporting\s*\?\s*"Importing\.\.\."\s*:\s*"Import"\}\s*</Button>)')

template_button = '''<Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>\n          '''

content = import_button_regex.sub(template_button + r'\1', content)

modal_jsx = '''
      <ImportPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        initialData={previewData}
        categories={categories}
        companies={companies}
        onConfirm={handleConfirmImport}
        isSaving={isImporting}
        setCategories={setCategories}
        setCompanies={setCompanies}
      />
'''
content = content.replace('</Dialog>', '</Dialog>\n' + modal_jsx)

with open('e:/Projects/PMS-Software/frontend/src/app/dashboard/masters/medicines/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
