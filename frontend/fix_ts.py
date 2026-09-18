import re
file_path = 'src/app/dashboard/settings/printer/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('const headers = token ? { "Authorization": `Bearer ${token}` } : {};', 'const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};')
content = content.replace('const headers = token ? { Authorization: `Bearer ${token}` } : {};', 'const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
