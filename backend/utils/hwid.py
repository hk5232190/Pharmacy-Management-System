import subprocess
import hashlib
import uuid
import platform
import logging

logger = logging.getLogger(__name__)

def _get_wmic_output(command: str) -> str:
    """Executes a wmic command and returns the cleaned output string."""
    try:
        output = subprocess.check_output(command, shell=True, text=True, stderr=subprocess.DEVNULL)
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

# ─── Primary MAC address (for license binding) ────────────────────────────────

_cached_mac: str | None = None

def get_primary_mac() -> str:
    """
    Returns the physical MAC address of the primary network adapter
    formatted as XX:XX:XX:XX:XX:XX (uppercase, colon-separated).

    Strategy:
      1. Try psutil.net_if_addrs() for a real physical adapter (excludes loopback).
      2. Fall back to uuid.getnode() formatted as a MAC string.
      3. If uuid.getnode() returns all-zeros, return sentinel "00:00:00:00:00:00"
         and log a warning so the operator knows the machine has no adapter.
    """
    global _cached_mac
    if _cached_mac is not None:
        return _cached_mac

    # ── Strategy 1: psutil (if installed) ────────────────────────────────────
    try:
        import psutil
        import psutil._common as ps_common
        LOOPBACK_PREFIXES = ("00:00:00:00:00:00", "ff:ff:ff:ff:ff:ff")
        for iface, addrs in psutil.net_if_addrs().items():
            # Skip obvious loopback / virtual adapters by name
            name_lower = iface.lower()
            if any(x in name_lower for x in ("loopback", "lo", "vmware", "virtualbox", "vethernet", "vbox")):
                continue
            for addr in addrs:
                # AF_LINK (Linux/macOS) or AF_PACKET or family==17/-1 (Windows)
                if addr.family in (psutil.AF_LINK,) or (hasattr(ps_common, 'AF_LINK') and addr.family == ps_common.AF_LINK):
                    mac = addr.address.upper().replace("-", ":")
                    if mac and mac not in [p.upper() for p in LOOPBACK_PREFIXES]:
                        _cached_mac = mac
                        return _cached_mac
    except Exception:
        pass  # psutil not installed or failed — fall through to uuid.getnode()

    # ── Strategy 2: uuid.getnode() ───────────────────────────────────────────
    try:
        node = uuid.getnode()
        if node != 0:
            # Format integer → "XX:XX:XX:XX:XX:XX"
            mac = ":".join(
                f"{(node >> (8 * i)) & 0xFF:02X}"
                for i in reversed(range(6))
            )
            _cached_mac = mac
            return _cached_mac
    except Exception as e:
        logger.error(f"uuid.getnode() failed: {e}")

    # ── Strategy 3: sentinel fallback ────────────────────────────────────────
    logger.warning(
        "Could not determine a physical MAC address. "
        "Using sentinel '00:00:00:00:00:00'. "
        "License binding will require the same sentinel value."
    )
    _cached_mac = "00:00:00:00:00:00"
    return _cached_mac

# ─── Hardware ID (SHA-256 composite — kept for legacy compatibility) ──────────

_cached_hwid = None

def generate_hwid() -> str:
    """
    Generates a hardware ID based on SRS Chapter 2 exact formula:
    SHA256(CPU_ID + Motherboard_UUID + MAC_Address)
    Kept for backward compatibility — new licenses use get_primary_mac() directly.
    """
    global _cached_hwid
    if _cached_hwid is not None:
        return _cached_hwid

    cpu_id = get_cpu_id()
    mb_uuid = get_motherboard_uuid()
    mac_addr = get_mac_address()

    raw_fingerprint = f"{cpu_id}{mb_uuid}{mac_addr}"
    hash_obj = hashlib.sha256(raw_fingerprint.encode('utf-8'))
    full_hash = hash_obj.hexdigest().upper()

    short_hash = full_hash[:16]
    formatted_hwid = f"PMS-{short_hash[:4]}-{short_hash[4:8]}-{short_hash[8:12]}-{short_hash[12:16]}"

    _cached_hwid = formatted_hwid
    return formatted_hwid
