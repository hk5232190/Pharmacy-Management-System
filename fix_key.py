import os
from cryptography.hazmat.primitives import serialization

env_path = r'e:\Projects\PMS-License-Manager\.env.local'
with open(env_path, 'r', encoding='utf-8') as f:
    env_content = f.read()

private_key_str = None
for line in env_content.split('\n'):
    if line.startswith('PRIVATE_KEY='):
        private_key_str = line.split('=', 1)[1].strip('"').replace('\\n', '\n')
        break

if not private_key_str:
    print("PRIVATE_KEY not found in .env.local")
    exit(1)

private_key = serialization.load_pem_private_key(private_key_str.encode('utf-8'), password=None)
public_key = private_key.public_key()
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

target_path = r'e:\Projects\PMS-Software\backend\utils\keys\public.pem'
os.makedirs(os.path.dirname(target_path), exist_ok=True)
with open(target_path, 'wb') as f:
    f.write(public_pem)
print("Successfully wrote public.pem to " + target_path)
