import { useState } from "react";

import {
  Boxes,
  Building2,
  CheckCircle,
  FileText,
  HandCoins,
  LayoutDashboard,
  Loader2,
  LogOut,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

import hiveLogo from "../assets/Hive-logo.png";
import "../styles/sidebar.css";

import {
  normalizePermissions,
} from "../utils/permissions";

const OPEN_LANDING_EVENT =
  "hivesync:open-landing";

const menuItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "vendors",
    label: "Supplier",
    supplierLabel: "My Business",
    icon: Building2,
  },
  {
    id: "deliveries",
    label: "Deliveries",
    supplierLabel: "My Deliveries",
    icon: Truck,
  },
  {
    id: "inventory",
    label: "Inventory",
    supplierLabel: "My Products",
    icon: Boxes,
  },
  {
    id: "pos",
    label: "Point of Sale",
    icon: ShoppingCart,
  },
  {
    id: "receivables",
    label: "Receivables",
    icon: HandCoins,
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileText,
  },
  {
    id: "users",
    label: "User Management",
    icon: Users,
  },
  {
    id: "settings",
    label: "Utilities",
    icon: Settings,
  },
];

function Sidebar({
  activePage,
  setActivePage,
  onLogout,
  user,
}) {
  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const [
    logoutSuccess,
    setLogoutSuccess,
  ] = useState(false);

  const role = String(
    user?.role || "Staff"
  ).trim();

  const isSupplier =
    role === "Supplier" ||
    role === "Vendor";

  const isStaff =
    role === "Staff";

  /*
  =========================================================
  CURRENT USER PERMISSIONS
  =========================================================

  normalizePermissions() already handles:

  - Admin full access
  - Role Default access
  - Customized access
  - Supplier permissions
  - Audit restrictions
  =========================================================
  */

  const permissions =
    normalizePermissions(user);

  /*
  =========================================================
  SALES LANDING PAGE SIDEBAR ACCESS
  =========================================================

  Admin:
  - Does NOT see Sales Landing Page in sidebar
  - Can still access Landing Page using Ctrl + Shift + L

  Staff:
  - Sees Sales Landing Page ONLY when "landing"
    is included in actual permissions

  Supplier / Audit:
  - No Sales Landing Page button in sidebar
  =========================================================
  */

  const canShowLandingButton =
    isStaff &&
    permissions.includes(
      "landing"
    );

  /*
  =========================================================
  INTERNAL SIDEBAR MODULES
  =========================================================

  Only internal modules assigned to the current user
  will appear here.

  Landing Page is intentionally not part of menuItems.
  =========================================================
  */

  const allowedMenu =
    menuItems.filter(
      (item) =>
        permissions.includes(
          item.id
        )
    );

  /*
  =========================================================
  OPEN SALES LANDING PAGE
  =========================================================
  */

  const handleOpenLanding = () => {
    if (
      loggingOut ||
      !canShowLandingButton
    ) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(
        OPEN_LANDING_EVENT
      )
    );
  };

  /*
  =========================================================
  INTERNAL PAGE NAVIGATION
  =========================================================
  */

  const handleMenuClick = (
    pageId
  ) => {
    if (
      loggingOut ||
      !permissions.includes(
        pageId
      )
    ) {
      return;
    }

    setActivePage(pageId);
  };

  /*
  =========================================================
  LOGOUT
  =========================================================
  */

  const handleLogout =
    async () => {
      if (loggingOut) {
        return;
      }

      setLoggingOut(true);
      setLogoutSuccess(false);

      try {
        await fetch(
          "http://localhost/HiveSync/backend/auth/logout.php",
          {
            method: "POST",
          }
        );
      } catch (error) {
        console.error(
          "Logout request error:",
          error
        );
      } finally {
        setLogoutSuccess(true);

        window.setTimeout(
          () => {
            localStorage.removeItem(
              "hivesync_user"
            );

            localStorage.removeItem(
              "user"
            );

            if (
              typeof onLogout ===
              "function"
            ) {
              onLogout();
            }
          },
          800
        );
      }
    };

  return (
    <aside className="sidebar">
      {/* ===================================================
          BRAND
          =================================================== */}

      <div className="sidebar-brand">
        <div className="sidebar-logo-wrap">
          <img
            src={hiveLogo}
            alt="HiveSync"
            className="sidebar-logo"
          />
        </div>

        <div className="sidebar-brand-text">
          <h3>
            HiveSync
          </h3>

          <p>
            BFATC · La Union
          </p>
        </div>
      </div>

      {/* ===================================================
          NAVIGATION
          =================================================== */}

      <div className="sidebar-section-label">
        Navigation
      </div>

      <nav className="sidebar-menu">
        {/* ===============================================
            SALES LANDING PAGE
            ===============================================

            Only visible to Staff accounts that actually
            have the "landing" permission.

            Admin deliberately does not see this button.
            =============================================== */}

        {canShowLandingButton && (
          <button
            type="button"
            className="sidebar-item sidebar-sales-landing"
            onClick={
              handleOpenLanding
            }
            disabled={
              loggingOut
            }
            title="Open Sales Landing Page"
          >
            <span className="sidebar-item-icon">
              <ShoppingBag
                size={18}
              />
            </span>

            <span>
              Sales Landing Page
            </span>
          </button>
        )}

        {/* ===============================================
            INTERNAL MODULES
            =============================================== */}

        {allowedMenu.map(
          (item) => {
            const Icon =
              item.icon;

            const menuLabel =
              isSupplier &&
              item.supplierLabel
                ? item.supplierLabel
                : item.label;

            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-item ${
                  activePage ===
                  item.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  handleMenuClick(
                    item.id
                  )
                }
                disabled={
                  loggingOut
                }
              >
                <span className="sidebar-item-icon">
                  <Icon
                    size={18}
                  />
                </span>

                <span>
                  {menuLabel}
                </span>
              </button>
            );
          }
        )}
      </nav>

      {/* ===================================================
          FOOTER / LOGOUT
          =================================================== */}

      <div className="sidebar-footer">
        <button
          type="button"
          className={`sidebar-logout ${
            loggingOut
              ? "loading"
              : ""
          }`}
          onClick={
            handleLogout
          }
          disabled={
            loggingOut
          }
        >
          {loggingOut ? (
            logoutSuccess ? (
              <>
                <CheckCircle
                  size={18}
                />

                <span>
                  Logged Out
                </span>
              </>
            ) : (
              <>
                <Loader2
                  size={18}
                  className="spin"
                />

                <span>
                  Signing Out...
                </span>
              </>
            )
          ) : (
            <>
              <LogOut
                size={18}
              />

              <span>
                Logout
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;