export const MODULE_OPTIONS = [
  {
    id: "landing",
    label: "Landing Page",
    description:
      "Product catalog, cart, checkout, and customer receipt.",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description:
      "Business performance, operational summaries, and alerts.",
  },
  {
    id: "users",
    label: "User Management",
    description:
      "Create, update, archive, and manage user accounts.",
  },
  {
    id: "vendors",
    label: "Supplier",
    description:
      "Supplier records, product proposals, finance, and supplier-linked information.",
  },
  {
    id: "deliveries",
    label: "Deliveries",
    description:
      "Delivery review, approval, receiving, and delivery records.",
  },
  {
    id: "inventory",
    label: "Inventory",
    description:
      "Products, stock levels, expiry records, batches, and movements.",
  },
  {
    id: "pos",
    label: "Point of Sale",
    description:
      "Sales, receipts, returns, voiding, and transaction history.",
  },
  {
    id: "receivables",
    label: "Receivables",
    description:
      "Customer receivables, partial payments, balances, and payment history.",
  },
  {
    id: "reports",
    label: "Reports",
    description:
      "Sales, inventory, supplier, receivables, and operational reports.",
  },
  {
    id: "settings",
    label: "Utilities",
    description:
      "Audit trail and system utility records.",
  },
];

export const ALL_MODULE_IDS =
  MODULE_OPTIONS.map(
    (module) => module.id
  );

/*
=========================================================
HIVESYNC ACCESS POLICY
=========================================================

Admin
- Full access to every module.
- Access cannot be reduced by Custom Access.

Staff
- Uses Staff defaults when access_mode = "Default".
- Uses exact selected modules when access_mode = "Custom".
- Utilities is not included in Staff default access.
- User Management is not included in Staff default access.

Supplier / Vendor
- Uses supplier operational defaults.
- Can also use custom permissions if assigned by Admin.

Audit
- Uses Audit defaults.
- Utilities is blocked for Audit even if accidentally
  saved in old module_permissions.

IMPORTANT
Utilities module id = "settings"
=========================================================
*/

/*
=========================================================
DEFAULT STAFF ACCESS
=========================================================
*/

export const STAFF_MODULE_IDS = [
  "landing",
  "dashboard",
  "vendors",
  "deliveries",
  "inventory",
  "pos",
  "receivables",
  "reports",
];

/*
=========================================================
DEFAULT AUDIT ACCESS
=========================================================
*/

export const AUDIT_MODULE_IDS = [
  "dashboard",
  "vendors",
  "deliveries",
  "inventory",
  "receivables",
  "reports",
];

/*
=========================================================
ROLE DEFAULT PERMISSIONS
=========================================================
*/

export const ROLE_DEFAULT_PERMISSIONS = {
  Admin: [
    ...ALL_MODULE_IDS,
  ],

  Staff: [
    ...STAFF_MODULE_IDS,
  ],

  Supplier: [
    "vendors",
    "deliveries",
    "inventory",
  ],

  Vendor: [
    "vendors",
    "deliveries",
    "inventory",
  ],

  Audit: [
    ...AUDIT_MODULE_IDS,
  ],
};

/*
=========================================================
NORMALIZE ROLE
=========================================================
*/

export function normalizeRole(role) {
  const normalizedRole = String(
    role || "Staff"
  ).trim();

  if (normalizedRole === "Vendor") {
    return "Supplier";
  }

  return normalizedRole;
}

/*
=========================================================
NORMALIZE ACCESS MODE
=========================================================
*/

export function normalizeAccessMode(
  accessMode,
  role
) {
  const normalizedRole =
    normalizeRole(role);

  /*
   * Admin is always full-access/default.
   */
  if (normalizedRole === "Admin") {
    return "Default";
  }

  const value = String(
    accessMode || "Default"
  ).trim();

  return value === "Custom"
    ? "Custom"
    : "Default";
}

/*
=========================================================
CLEAN SAVED PERMISSIONS
=========================================================
*/

export function cleanPermissions(
  rawPermissions
) {
  let permissions =
    rawPermissions;

  /*
   * JSON string from MySQL.
   */
  if (
    typeof permissions ===
    "string"
  ) {
    try {
      const parsed =
        JSON.parse(
          permissions
        );

      permissions =
        Array.isArray(parsed)
          ? parsed
          : [];
    } catch {
      /*
       * Support old comma-separated values.
       */
      permissions =
        permissions
          .split(",")
          .map((item) =>
            String(item).trim()
          )
          .filter(Boolean);
    }
  }

  if (
    !Array.isArray(
      permissions
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      permissions
        .map((permission) =>
          String(
            permission
          ).trim()
        )
        .filter(
          (permission) =>
            ALL_MODULE_IDS.includes(
              permission
            )
        )
    ),
  ];
}

/*
=========================================================
GET ROLE DEFAULT PERMISSIONS
=========================================================
*/

export function getRoleDefaultPermissions(
  role
) {
  const normalizedRole =
    normalizeRole(role);

  return [
    ...(
      ROLE_DEFAULT_PERMISSIONS[
        normalizedRole
      ] || []
    ),
  ];
}

/*
=========================================================
NORMALIZE USER PERMISSIONS
=========================================================

This is the most important function.

Default mode:
Role default permissions are used.

Custom mode:
ONLY the permissions saved for that specific user
are used.

This prevents a custom Staff user from silently
getting Dashboard or other Staff default pages.
=========================================================
*/

export function normalizePermissions(
  userData
) {
  const role =
    normalizeRole(
      userData?.role
    );

  /*
   * Admin always gets everything.
   */
  if (role === "Admin") {
    return [
      ...ALL_MODULE_IDS,
    ];
  }

  const accessMode =
    normalizeAccessMode(
      userData?.access_mode,
      role
    );

  /*
   * Default Access
   */
  if (
    accessMode ===
    "Default"
  ) {
    return getRoleDefaultPermissions(
      role
    );
  }

  /*
   * Customized Access
   */
  let cleanedPermissions =
    cleanPermissions(
      userData?.module_permissions
    );

  /*
   * Audit hard-security rule.
   *
   * Audit must never access Utilities.
   */
  if (role === "Audit") {
    cleanedPermissions =
      cleanedPermissions.filter(
        (moduleId) =>
          moduleId !==
          "settings"
      );
  }

  return cleanedPermissions;
}

/*
=========================================================
CHECK MODULE ACCESS
=========================================================
*/

export function hasModuleAccess(
  userData,
  moduleId
) {
  if (!moduleId) {
    return false;
  }

  return normalizePermissions(
    userData
  ).includes(
    moduleId
  );
}

/*
=========================================================
CHECK IF LANDING PAGE IS AVAILABLE
=========================================================
*/

export function canAccessLanding(
  userData
) {
  return hasModuleAccess(
    userData,
    "landing"
  );
}

/*
=========================================================
FIRST ALLOWED INTERNAL PAGE
=========================================================

Landing Page is NOT included here because Landing Page
is treated as a separate workspace.

Example:

Staff Custom:
["landing"]

Result:
null

So Ctrl + Shift + L will NOT open Dashboard.

Example:

Staff Custom:
["landing", "pos"]

Result:
"pos"

So Ctrl + Shift + L opens Point of Sale.
=========================================================
*/

export function getFirstAllowedInternalPage(
  userData
) {
  const permissions =
    normalizePermissions(
      userData
    );

  /*
   * Sidebar / workspace priority.
   */
  const internalOrder = [
    "dashboard",
    "users",
    "vendors",
    "deliveries",
    "inventory",
    "pos",
    "receivables",
    "reports",
    "settings",
  ];

  return (
    internalOrder.find(
      (page) =>
        permissions.includes(
          page
        )
    ) || null
  );
}

/*
=========================================================
CHECK IF USER HAS ANY INTERNAL SYSTEM PAGE
=========================================================
*/

export function canAccessInternalSystem(
  userData
) {
  return Boolean(
    getFirstAllowedInternalPage(
      userData
    )
  );
}

/*
=========================================================
GET MODULE LABEL
=========================================================
*/

export function getModuleLabel(
  moduleId
) {
  const module =
    MODULE_OPTIONS.find(
      (item) =>
        item.id ===
        moduleId
    );

  return (
    module?.label ||
    moduleId
  );
}

/*
=========================================================
GET MODULE DESCRIPTION
=========================================================
*/

export function getModuleDescription(
  moduleId
) {
  const module =
    MODULE_OPTIONS.find(
      (item) =>
        item.id ===
        moduleId
    );

  return (
    module?.description ||
    ""
  );
}

/*
=========================================================
CHECK IF USER USES CUSTOM ACCESS
=========================================================
*/

export function usesCustomAccess(
  userData
) {
  const role =
    normalizeRole(
      userData?.role
    );

  if (role === "Admin") {
    return false;
  }

  return (
    normalizeAccessMode(
      userData?.access_mode,
      role
    ) ===
    "Custom"
  );
}

/*
=========================================================
ACCESS CONFIGURATION LABEL
=========================================================
*/

export function getAccessModeLabel(
  userData
) {
  const role =
    normalizeRole(
      userData?.role
    );

  if (role === "Admin") {
    return (
      "Complete Administrator Access"
    );
  }

  return usesCustomAccess(
    userData
  )
    ? "Customized Access"
    : `${role} Default Access`;
}