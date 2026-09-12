import jwt
from cryptography.hazmat.primitives import serialization

try:
    with open(r'E:\Projects\PMS-Software\backend\utils\keys\public.pem', 'rb') as f:
        public_key = serialization.load_pem_public_key(f.read())
    
    with open(r'C:\Users\Muhammad Saqib\Desktop\saqib_pharmacy.lic', 'rb') as f:
        token = f.read().decode('utf-8').strip()
    
    payload = jwt.decode(token, public_key, algorithms=['RS256'])
    print('VALID:', payload)
except Exception as e:
    print('INVALID:', str(type(e)), str(e))
