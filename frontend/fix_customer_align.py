import os
from pathlib import Path

base_dir = Path(__file__).resolve().parent / 'src' / 'app' / 'dashboard'
filepath = str(base_dir / 'masters' / 'customers' / 'page.tsx')

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<TableCell className="py-3 font-bold text-[#111827] dark:text-white text-[15px] text-center">', '<TableCell className="py-3 font-bold text-[#111827] dark:text-white text-[15px] text-left">')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed customer name alignment in masters/customers/page.tsx")
