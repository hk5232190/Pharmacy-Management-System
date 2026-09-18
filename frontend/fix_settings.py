import re

file_path = 'src/app/dashboard/settings/printer/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'import { PrinterSettings } from "@/types/printer";' not in content:
    content = content.replace('import { getApiBaseUrl } from "@/lib/api-client";', 'import { getApiBaseUrl } from "@/lib/api-client";\nimport { PrinterSettings } from "@/types/printer";\nimport { ReceiptPreview } from "@/components/receipt-preview";')

# 2. Remove interface PrinterSettings
content = re.sub(r'interface PrinterSettings \{.*?\n\}\n', '', content, flags=re.DOTALL)

# 3. Remove function ReceiptPreview
content = re.sub(r'function ReceiptPreview\(\{(.*?)\}\) \{\n  const paperWidthClass(.*?)\n\}\n', '', content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated page.tsx")
