import re

with open('e:/Projects/PMS-Software/frontend/src/app/dashboard/masters/medicines/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add SmartCombobox import
content = content.replace(
    'import { Button } from "@/components/ui/button";',
    'import { Button } from "@/components/ui/button";\nimport { SmartCombobox } from "@/components/ui/smart-combobox";'
)

# Add showAdvanced state
content = content.replace(
    'const [isSaving, setIsSaving] = useState(false);',
    'const [isSaving, setIsSaving] = useState(false);\n  const [showAdvanced, setShowAdvanced] = useState(false);\n  const brandNameInputRef = useRef<HTMLInputElement>(null);\n\n  const handleCreateCategory = async (name: string) => {\n    try {\n      const res = await apiClient.post("/categories", { CategoryName: name, IsActive: true });\n      if (res.success && res.data) {\n        setCategories([...categories, res.data]);\n        setCurrentMedicine(prev => ({ ...prev, CategoryId: res.data.CategoryId }));\n        toast.success(`Category "${name}" added`);\n      } else {\n        toast.error(res.error || "Failed to create category");\n      }\n    } catch (error) {\n      toast.error("Error creating category");\n    }\n  };\n\n  const handleCreateCompany = async (name: string) => {\n    try {\n      const res = await apiClient.post("/companies", { CompanyName: name, IsActive: true });\n      if (res.success && res.data) {\n        setCompanies([...companies, res.data]);\n        setCurrentMedicine(prev => ({ ...prev, CompanyId: res.data.CompanyId }));\n        toast.success(`Company "${name}" added`);\n      } else {\n        toast.error(res.error || "Failed to create company");\n      }\n    } catch (error) {\n      toast.error("Error creating company");\n    }\n  };\n'
)

# Replace handleSave success logic
old_save_logic = '''      if (data.success) {
        toast.success(data.message);
        setIsDialogOpen(false);
        fetchMedicines();
      } else {'''

new_save_logic = '''      if (data.success) {
        toast.success(data.message);
        if (!isEditing) {
          setCurrentMedicine({
            BrandName: "", GenericName: "", CategoryId: 0, CompanyId: 0, RackNumber: "",
            ReorderLevel: 10, 
            RequiresPrescription: false, 
            Unit: "Box", 
            DosageForm: "", Strength: "", Barcode: "",
            DefaultCostPrice: 0, DefaultSellingPrice: 0, IsActive: true
          });
          setTimeout(() => brandNameInputRef.current?.focus(), 100);
        } else {
          setIsDialogOpen(false);
        }
        fetchMedicines();
      } else {'''

content = content.replace(old_save_logic, new_save_logic)

# Replace the Dialog Form contents
dialog_form_start_regex = re.compile(r'<div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">.*?</DialogFooter>', re.DOTALL)

new_dialog_form = '''<div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            
            <div className="space-y-2 md:col-span-2 text-primary font-semibold border-b pb-1">
              Essential Information
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Brand Name *</label>
              <Input 
                id="brand-name-input"
                ref={brandNameInputRef}
                value={currentMedicine.BrandName || ""}
                onChange={e => setCurrentMedicine({...currentMedicine, BrandName: e.target.value})}
                placeholder="e.g. Panadol"
                className="h-10"
                onKeyDown={e => {
                  if(e.key === 'Enter') { e.preventDefault(); document.getElementById('formula-input')?.focus(); }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Formula *</label>
              <Input 
                id="formula-input"
                value={currentMedicine.GenericName || ""}
                onChange={e => setCurrentMedicine({...currentMedicine, GenericName: e.target.value})}
                placeholder="e.g. Paracetamol"
                className="h-10"
                onKeyDown={e => {
                  if(e.key === 'Enter') { e.preventDefault(); document.getElementById('category-input')?.focus(); }
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category *</label>
              <SmartCombobox
                id="category-input"
                options={categories.map(c => ({ value: c.CategoryId, label: c.CategoryName }))}
                value={currentMedicine.CategoryId}
                onChange={val => setCurrentMedicine({...currentMedicine, CategoryId: Number(val)})}
                onCreateNew={handleCreateCategory}
                placeholder="Type to search or add..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Company *</label>
              <SmartCombobox
                options={companies.map(c => ({ value: c.CompanyId, label: c.CompanyName }))}
                value={currentMedicine.CompanyId}
                onChange={val => setCurrentMedicine({...currentMedicine, CompanyId: Number(val)})}
                onCreateNew={handleCreateCompany}
                placeholder="Type to search or add..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Unit</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={currentMedicine.Unit || "Box"}
                onChange={e => setCurrentMedicine({...currentMedicine, Unit: e.target.value})}
                onKeyDown={e => {
                  if(e.key === 'Enter') { e.preventDefault(); handleSave(); }
                }}
              >
                <option value="Box">Box</option>
                <option value="Strip">Strip</option>
                <option value="Bottle">Bottle</option>
                <option value="Tube">Tube</option>
                <option value="Injection">Injection</option>
                <option value="Pieces">Pieces</option>
              </select>
            </div>
            
            <div className="md:col-span-2 pt-2">
              <Button type="button" variant="ghost" className="w-full text-muted-foreground text-xs" onClick={() => setShowAdvanced(!showAdvanced)}>
                {showAdvanced ? "Hide Advanced Details" : "Show Advanced Details (Prices, Dosage, etc)"}
              </Button>
            </div>

            {showAdvanced && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Dosage Form</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={currentMedicine.DosageForm || ""}
                    onChange={e => setCurrentMedicine({...currentMedicine, DosageForm: e.target.value})}
                  >
                    <option value="">Select Type</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Cream">Cream</option>
                    <option value="Drops">Drops</option>
                    <option value="Ointment">Ointment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Strength</label>
                  <Input 
                    value={currentMedicine.Strength || ""}
                    onChange={e => setCurrentMedicine({...currentMedicine, Strength: e.target.value})}
                    placeholder="e.g. 500mg, 10ml"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Barcode</label>
                  <div className="flex gap-2">
                    <Input 
                      value={currentMedicine.Barcode || ""}
                      onChange={e => setCurrentMedicine({...currentMedicine, Barcode: e.target.value})}
                      placeholder="Scan or type barcode"
                      className="h-10 font-mono"
                    />
                    <Button type="button" variant="outline" onClick={generateBarcode} className="h-10 px-3 whitespace-nowrap text-xs">
                      Generate
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Default Cost Price</label>
                  <Input 
                    type="number" min="0" step="0.01"
                    value={currentMedicine.DefaultCostPrice}
                    onChange={e => {
                      const cost = Number(e.target.value);
                      const margin = inventorySettings.DefaultProfitMargin || 0;
                      const newSelling = Number((cost * (1 + margin / 100)).toFixed(2));
                      setCurrentMedicine({ ...currentMedicine, DefaultCostPrice: cost, DefaultSellingPrice: newSelling });
                    }}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Default Selling Price</label>
                  <Input 
                    type="number" min="0" step="0.01"
                    value={currentMedicine.DefaultSellingPrice}
                    onChange={e => setCurrentMedicine({...currentMedicine, DefaultSellingPrice: Number(e.target.value)})}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Reorder Level (Min Stock)</label>
                  <Input 
                    type="number" min="0"
                    value={currentMedicine.ReorderLevel}
                    onChange={e => setCurrentMedicine({...currentMedicine, ReorderLevel: Number(e.target.value)})}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Rack Number</label>
                  <Input 
                    value={currentMedicine.RackNumber || ""}
                    onChange={e => setCurrentMedicine({...currentMedicine, RackNumber: e.target.value})}
                    placeholder="e.g. A-12"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2 md:col-span-2 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="prescription" 
                      checked={currentMedicine.RequiresPrescription} 
                      onCheckedChange={(c) => setCurrentMedicine({...currentMedicine, RequiresPrescription: c as boolean})}
                    />
                    <label htmlFor="prescription" className="text-sm font-medium leading-none">
                      Requires Prescription?
                    </label>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2 mt-2">
                  <label className="text-sm font-semibold text-foreground">Status</label>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <span className={cn("w-2.5 h-2.5 rounded-full", currentMedicine.IsActive ? "bg-emerald-500" : "bg-rose-500")} />
                      <span className={cn("text-sm font-semibold", currentMedicine.IsActive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                        {currentMedicine.IsActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={currentMedicine.IsActive}
                      onClick={() => setCurrentMedicine({...currentMedicine, IsActive: !currentMedicine.IsActive})}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30",
                        currentMedicine.IsActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
                        currentMedicine.IsActive ? "translate-x-5" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                </div>
              </>
            )}
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Close</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : (currentMedicine.MedicineId ? "Save Changes" : "Save & Add Another")}
            </Button>
          </DialogFooter>'''

content = dialog_form_start_regex.sub(new_dialog_form, content)

with open('e:/Projects/PMS-Software/frontend/src/app/dashboard/masters/medicines/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
