"""API composition root.

Route modules own HTTP translation.  This module owns only URL structure and
keeps application construction independent from every feature module.
"""

from fastapi import APIRouter, Depends

from api.v1 import (
    about,
    auth,
    backup,
    backup_settings,
    category,
    company,
    customer,
    dashboard,
    inventory,
    license,
    medicine,
    notification,
    purchase,
    purchase_return,
    reports,
    sales,
    security,
    settings,
    supplier,
    system,
    users,
)
from api.deps import require_permission


def create_api_router(prefix: str) -> APIRouter:
    router = APIRouter(prefix=prefix)

    registrations = (
        # ── No permission guard (public / always-needed) ──────────────────────
        (auth.router,              "/auth",             ["Authentication"],   None),
        # License must be unguarded — /license/status is called at startup before login.
        # The admin-only upload endpoint inside license.py uses its own guard.
        (license.router,           "/license",          ["License"],           None),
        (system.router,            "/system",           ["System Diagnostics"],None),
        (notification.router,      "/notifications",    ["Notifications"],     None),

        # ── Admin-only (users.py enforces its own admin guard) ────────────────
        (users.router,             "/users",            ["Users"],             None),

        # ── Sales: always accessible to any authenticated user ────────────────
        (sales.router,             "/sales",            ["Sales"],             None),

        # ── Settings core: no router-level guard.
        #    GET /settings/profile is used by the sidebar for ALL users.
        #    Write endpoints inside settings.py keep get_current_admin_user.
        #    The Settings menu itself is gated at the frontend.
        (settings.router,          "/settings",         ["Settings"],          None),

        # ── Settings sub-features: gated by 'settings' permission ─────────────
        # Cashiers with Settings permission can use Backup/Restore & About.
        (backup.router,            "/backup",           ["Backup & Restore"],  "settings"),
        (backup.exit_backup_router,"/backup",           ["Backup & Restore"],  "settings"),
        (backup_settings.router,   "/backup-settings",  ["Backup Settings"],   "settings"),
        (about.router,             "/about",            ["About"],             "settings"),

        # ── Module-gated routes ───────────────────────────────────────────────
        (dashboard.router,         "/dashboard",        ["Dashboard"],         "dashboard"),
        (purchase.router,          "/purchases",        ["Purchases"],         "purchases"),
        (purchase_return.router,   "/purchase-returns", ["Purchase Returns"],  "purchases"),
        (inventory.router,         "/inventory",        ["Inventory"],         "inventory"),
        (medicine.router,          "/medicines",        ["Medicines"],         "medicines"),
        (category.router,          "/categories",       ["Categories"],        "medicines"),
        (company.router,           "/companies",        ["Companies"],         "medicines"),
        (supplier.router,          "/suppliers",        ["Suppliers"],         "suppliers"),
        (customer.router,          "/customers",        ["Customers"],         "customers"),
        (reports.router,           "/reports",          ["Reports"],           "reports"),
    )

    for entry in registrations:
        if len(entry) == 3:
            feature_router, route_prefix, tags = entry
            router.include_router(feature_router, prefix=route_prefix, tags=tags)
        else:
            feature_router, route_prefix, tags, module = entry
            if module:
                router.include_router(
                    feature_router,
                    prefix=route_prefix,
                    tags=tags,
                    dependencies=[Depends(require_permission(module))],
                )
            else:
                router.include_router(feature_router, prefix=route_prefix, tags=tags)

    # Security declares its own prefixes and tags for backward compatibility.
    router.include_router(security.router)
    return router
