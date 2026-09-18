import re
import os
from pathlib import Path

files = [
    'inventory/page.tsx',
    'masters/categories/page.tsx',
    'masters/companies/page.tsx',
    'masters/customers/page.tsx',
    'masters/medicines/page.tsx',
    'masters/suppliers/page.tsx',
    'purchases/page.tsx',
    'reports/page.tsx',
    'sales/page.tsx',
    'settings/backup-restore/page.tsx',
    'settings/users/page.tsx'
]

base_dir = Path(__file__).resolve().parent / 'src' / 'app' / 'dashboard'
for file in files:
    path = str(base_dir / file)
    if not os.path.exists(path):
        continue
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        def fix_alignments(m):
            tag_content = m.group(1)
            new_tag = tag_content
            return new_tag + m.group(2)
            
        content = re.sub(r'(<(?:TableHead|TableCell|th|td)[^>]*)(>)', fix_alignments, content)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Processed {file}')
    except Exception as e:
        print(f'Error processing {file}: {e}')
