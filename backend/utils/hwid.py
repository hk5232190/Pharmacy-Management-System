import subprocess
import hashlib
import uuid
import platform
import logging

logger = logging.getLogger(__name__)

def _get_wmic_output(command: str) -> str:
    """Executes a wmic command and returns the cleaned output string."""
    try:
        # We use shell=True and handle the typical wmic output which includes headers
        output = subprocess.check_output(command, shell=True, text=True, stderr=subprocess.DEVNULL)
        # Split by newline and get the second line (which contains the data, first is header)
        lines = [line.strip() for line in output.split('\n') if line.strip()]
        if len(lines) > 1:
            return lines[1]
        return ""
    except Exception as e:
        logger.error(f"Failed to execute wmic command '{command}': {e}")
        return ""

def get_cpu_id() -> str:
    if platform.system() == "Windows":
        return _get_wmic_output("wmic cpu get ProcessorId")
    return "UNKNOWN_CPU"

def get_motherboard_uuid() -> str:
    if platform.system() == "Windows":
        return _get_wmic_output("wmic csproduct get UUID")
    return "UNKNOWN_MB"

def get_mac_address() -> str:
    # uuid.getnode() returns the MAC address as an integer.
    # We format it to a standard MAC string: 00:11:22:33:44:55
    mac_num = uuid.getnode()
    mac_hex = ''.join(['{:02x}'.format((mac_num >> elements) & 0xff) for elements in range(0, 8*6, 8)][::-1])
    return mac_hex

def generate_hwid() -> str:
    """
    Generates a hardware ID based on SRS Chapter 2 exact formula:
    SHA256(CPU_ID + Motherboard_UUID + MAC_Address)
    """
    cpu_id = get_cpu_id()
    mb_uuid = get_motherboard_uuid()
    mac_addr = get_mac_address()
    
    # Combine the identifiers
    raw_fingerprint = f"{cpu_id}{mb_uuid}{mac_addr}"
    
    # Compute SHA256 hash
    hash_obj = hashlib.sha256(raw_fingerprint.encode('utf-8'))
    full_hash = hash_obj.hexdigest().upper()
    
    # Format the hash into a readable chunked format e.g., PMS-XXXX-XXXX-XXXX-XXXX
    # We will take the first 16 characters for a reasonably secure but readable ID
    short_hash = full_hash[:16]
    formatted_hwid = f"PMS-{short_hash[:4]}-{short_hash[4:8]}-{short_hash[8:12]}-{short_hash[12:16]}"
    
    return formatted_hwid
