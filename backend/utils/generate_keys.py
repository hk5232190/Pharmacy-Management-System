import os
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from core.logger import logger

KEYS_DIR = os.path.join(os.path.dirname(__file__), "keys")

def ensure_keys_dir():
    if not os.path.exists(KEYS_DIR):
        os.makedirs(KEYS_DIR)
        logger.info(f"Created keys directory at {KEYS_DIR}")

def generate_rsa_keypair():
    """Generates a secure RSA key pair for License Engine."""
    ensure_keys_dir()
    
    private_key_path = os.path.join(KEYS_DIR, "private.pem")
    public_key_path = os.path.join(KEYS_DIR, "public.pem")
    
    if os.path.exists(private_key_path) and os.path.exists(public_key_path):
        logger.info("RSA Keypair already exists. Skipping generation.")
        return

    logger.info("Generating new 2048-bit RSA key pair for Licensing...")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    
    # Save Private Key (WARNING: Keep this secure, do not ship with offline app)
    with open(private_key_path, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))
        
    # Save Public Key (Safe to ship with the app)
    public_key = private_key.public_key()
    with open(public_key_path, "wb") as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
        
    logger.info("RSA Keypair successfully generated and saved to /keys")

if __name__ == "__main__":
    generate_rsa_keypair()
