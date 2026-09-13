import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  ShoppingCart,
  FileText,
  Settings,
  Plus,
  Download,
  RefreshCw,
  Archive,
  Clock,
  ChevronDown,
  CalendarDays,
  Home,
  MonitorCog,
  LogOut,
} from "lucide-react";

import NotificationBell from "./NotificationBell";

import {
  getFirstAllowedInternalPage,
  hasModuleAccess,
} from "../utils/permissions";

import bacnotanLogo from "../assets/Bacnotan Logo.png";
import hiveLogo from "../assets/Hive-logo.png";

import "../styles/page-header.css";

const pageIcons = {
  dashboard: LayoutDashboard,
  users: Users,
  inventory: Package,
  deliveries: Truck,
  vendors: Users,
  pos: ShoppingCart,
  reports: FileText,
  settings: Settings,
};

const pageDescriptions = {
  dashboard:
    "Business overview of sales, inventory, deliveries, suppliers, and daily operations.",

  users:
    "Manage system users, roles, and access permissions.",

  inventory:
    "Track products, stock levels, prices, batches, expiration dates, and inventory movements.",

  deliveries:
    "Manage supplier delivery orders, receipts, and inventory stock-in.",

  vendors:
    "Manage suppliers, products, deliveries, payments, remittances, and consignment records.",

  pos:
    "Review completed transactions, receipts, and sales records.",

  reports:
    "Generate business, operations, inventory, supplier, POS, and audit reports.",

  settings:
    "Manage profile, password, system information, backups, and audit records.",
};

const OPEN_LANDING_EVENT =
  "hivesync:open-landing";

const OPEN_DASHBOARD_EVENT =
  "hivesync:open-dashboard";

function PageHeader({
  page = "dashboard",
  title = "",
  description = "",
  actions = [],
  children = null,
  className = "",

  user = null,

  showSystemHeader = false,

  setActivePage = null,

  onNotificationNavigate = null,

  /*
   * Used by LandingPage.
   */
  onLogout = null,
}) {
  const [
    dateTime,
    setDateTime,
  ] = useState(
    () => new Date()
  );

  const [
    profileMenuOpen,
    setProfileMenuOpen,
  ] = useState(false);

  const profileMenuRef =
    useRef(null);

  /*
  =========================================================
  LIVE DATE / TIME
  =========================================================
  */

  useEffect(() => {
    const timer =
      window.setInterval(
        () =>
          setDateTime(
            new Date()
          ),
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  /*
  =========================================================
  CLOSE PROFILE MENU WHEN CLICKING OUTSIDE
  =========================================================
  */

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const handleOutsideClick =
      (event) => {
        if (
          profileMenuRef.current &&
          !profileMenuRef.current.contains(
            event.target
          )
        ) {
          setProfileMenuOpen(
            false
          );
        }
      };

    const handleEscape =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          setProfileMenuOpen(
            false
          );
        }
      };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [profileMenuOpen]);

  /*
  =========================================================
  PAGE INFORMATION
  =========================================================
  */

  const IconComponent =
    pageIcons[page] ||
    LayoutDashboard;

  const displayDescription =
    description ||
    pageDescriptions[page] ||
    "";

  const displayTitle =
    title ||
    page
      .split("-")
      .filter(Boolean)
      .map(
        (word) =>
          word
            .charAt(0)
            .toUpperCase() +
          word.slice(1)
      )
      .join(" ");

  /*
  =========================================================
  USER INFORMATION
  =========================================================
  */

  const fullName =
    user?.full_name ||
    user?.name ||
    "System Admin";

  const role =
    user?.role ||
    "Admin";

  /*
  =========================================================
  PROFILE WORKSPACE NAVIGATION ACCESS
  =========================================================

  Show Go to Dashboard / Go to Landing Page only when the
  logged-in account is actually allowed to use the Landing
  Page AND has at least one internal system module.

  Users without Landing Page access (for example Audit-only
  accounts) will see only Log Out.
  */

  const canOpenLanding =
    Boolean(user) &&
    hasModuleAccess(
      user,
      "landing"
    );

  const firstAllowedInternalPage =
    user
      ? getFirstAllowedInternalPage(
          user
        )
      : null;

  const canOpenSystem =
    Boolean(
      firstAllowedInternalPage
    );

  const showWorkspaceNavigation =
    canOpenLanding &&
    canOpenSystem;

  const initials =
    useMemo(() => {
      return String(
        fullName
      )
        .split(" ")
        .filter(Boolean)
        .map(
          (name) =>
            name.charAt(0)
        )
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }, [fullName]);

  /*
  =========================================================
  DATE / TIME
  =========================================================
  */

  const currentDate =
    dateTime.toLocaleDateString(
      "en-PH",
      {
        weekday: "long",
        month: "long",
        day: "2-digit",
        year: "numeric",
        timeZone:
          "Asia/Manila",
      }
    );

  const currentTime =
    dateTime.toLocaleTimeString(
      "en-PH",
      {
        hour: "2-digit",
        minute: "2-digit",
        timeZone:
          "Asia/Manila",
      }
    );

  /*
  =========================================================
  NOTIFICATION NAVIGATION
  =========================================================
  */

  const handleNotificationNavigation =
    (destination) => {
      if (
        !destination?.page
      ) {
        return;
      }

      if (
        typeof onNotificationNavigate ===
        "function"
      ) {
        onNotificationNavigate(
          destination
        );

        return;
      }

      if (
        typeof setActivePage ===
        "function"
      ) {
        setActivePage(
          destination.page
        );
      }
    };

  /*
  =========================================================
  PROFILE MENU
  =========================================================
  */

  const toggleProfileMenu =
    () => {
      setProfileMenuOpen(
        (current) =>
          !current
      );
    };

  const handleOpenDashboard =
    () => {
      setProfileMenuOpen(
        false
      );

      window.dispatchEvent(
        new CustomEvent(
          OPEN_DASHBOARD_EVENT
        )
      );
    };

  const handleOpenLanding =
    () => {
      setProfileMenuOpen(
        false
      );

      window.dispatchEvent(
        new CustomEvent(
          OPEN_LANDING_EVENT
        )
      );
    };

  /*
  =========================================================
  LOGOUT
  =========================================================
  */

  const handleLogout =
    async () => {
      setProfileMenuOpen(
        false
      );

      /*
       * LandingPage / App already owns the
       * actual HiveSync logout process.
       */
      if (
        typeof onLogout ===
        "function"
      ) {
        await onLogout();
        return;
      }

      /*
       * Fallback protection in case PageHeader
       * is used without onLogout.
       */
      try {
        await fetch(
          "http://localhost/HiveSync/backend/auth/logout.php",
          {
            method: "POST",
          }
        );
      } catch (error) {
        console.error(
          "Logout request failed:",
          error
        );
      }

      localStorage.removeItem(
        "hivesync_user"
      );

      localStorage.removeItem(
        "user"
      );

      window.location.reload();
    };

  /*
  =========================================================
  PAGE ACTION BUTTONS
  =========================================================
  */

  const renderAction =
    (action, index) => {
      const Icon =
        action.icon ||
        (
          action.id === "add"
            ? Plus
            : action.id ===
                "export"
              ? Download
              : action.id ===
                  "refresh"
                ? RefreshCw
                : action.id ===
                    "archive"
                  ? Archive
                  : null
        );

      const variantClass =
        action.variant ===
        "danger"
          ? "danger-btn"
          : action.variant ===
              "secondary"
            ? "secondary-btn"
            : "primary-btn";

      return (
        <button
          key={
            action.id ||
            `${action.label}-${index}`
          }
          type="button"
          className={`${variantClass} page-header-action`}
          onClick={
            typeof action.onClick ===
            "function"
              ? action.onClick
              : undefined
          }
          disabled={Boolean(
            action.disabled
          )}
          title={
            action.tooltip ||
            action.label
          }
        >
          {Icon && (
            <Icon
              size={18}
            />
          )}

          <span>
            {action.label}
          </span>
        </button>
      );
    };

  /*
  =========================================================
  ENTERPRISE SYSTEM HEADER
  =========================================================
  */

  if (showSystemHeader) {
    return (
      <header
        className={`enterprise-system-header ${className}`}
      >
        {/* ===============================================
            BRAND
            =============================================== */}

        <div className="enterprise-header-brand">
          <div className="enterprise-logo-wrap">
            <img
              src={bacnotanLogo}
              alt="Bacnotan municipal logo"
            />

            <img
              src={hiveLogo}
              alt="HiveSync logo"
            />
          </div>

          <div className="enterprise-title-wrap">
            <div className="enterprise-title-row">
              <h1>
                HiveSync
              </h1>

              <span>
                Integrated Business and Operations Management System
              </span>
            </div>

            <p>
              Bacnotan Farmers Agri-Tourism Center (BFATC), La Union
            </p>
          </div>
        </div>

        {/* ===============================================
            DATE / TIME
            =============================================== */}

        <div
          className="enterprise-date-time"
          aria-label="Current date and time"
        >
          <div className="enterprise-date-chip">
            <CalendarDays
              size={18}
              aria-hidden="true"
            />

            <strong>
              {currentDate}
            </strong>
          </div>

          <div className="enterprise-date-chip">
            <Clock
              size={18}
              aria-hidden="true"
            />

            <strong>
              {currentTime}
            </strong>
          </div>
        </div>

        {/* ===============================================
            USER AREA
            =============================================== */}

        <div className="enterprise-user-area">
          <NotificationBell
            user={user}
            onNavigate={
              handleNotificationNavigation
            }
          />

          <div
            className="enterprise-user-menu"
            ref={
              profileMenuRef
            }
          >
            <button
              type="button"
              className={`enterprise-user-card ${
                profileMenuOpen
                  ? "open"
                  : ""
              }`}
              onClick={
                toggleProfileMenu
              }
              aria-expanded={
                profileMenuOpen
              }
              aria-haspopup="menu"
            >
              <div className="enterprise-avatar">
                {initials}
              </div>

              <div className="enterprise-user-info">
                <strong>
                  {fullName}
                </strong>

                <span>
                  {role}
                </span>
              </div>

              <ChevronDown
                size={18}
                aria-hidden="true"
                className={`enterprise-user-chevron ${
                  profileMenuOpen
                    ? "open"
                    : ""
                }`}
              />
            </button>

            {/* ===========================================
                PROFILE DROPDOWN
                =========================================== */}

            {profileMenuOpen && (
              <div
                className="enterprise-profile-dropdown"
                role="menu"
              >
                <div className="enterprise-profile-summary">
                  <div className="enterprise-profile-avatar">
                    {initials}
                  </div>

                  <div>
                    <strong>
                      {fullName}
                    </strong>

                    <span>
                      {role}
                    </span>

                    {user?.position && (
                      <small>
                        {user.position}
                      </small>
                    )}
                  </div>
                </div>

                <div className="enterprise-profile-divider" />

                {showWorkspaceNavigation && (
                  <>
                    <button
                      type="button"
                      className="enterprise-profile-action"
                      onClick={
                        handleOpenDashboard
                      }
                      role="menuitem"
                    >
                      <MonitorCog
                        size={17}
                      />

                      <span>
                        Go to Dashboard
                      </span>
                    </button>

                    <button
                      type="button"
                      className="enterprise-profile-action"
                      onClick={
                        handleOpenLanding
                      }
                      role="menuitem"
                    >
                      <Home
                        size={17}
                      />

                      <span>
                        Go to Landing Page
                      </span>
                    </button>

                    <div className="enterprise-profile-divider" />
                  </>
                )}

                <button
                  type="button"
                  className="enterprise-profile-action logout"
                  onClick={
                    handleLogout
                  }
                  role="menuitem"
                >
                  <LogOut
                    size={17}
                  />

                  <span>
                    Log Out
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  }

  /*
  =========================================================
  NORMAL MODULE PAGE HEADER
  =========================================================
  */

  return (
    <section
      className={`page-header-modern ${className}`}
    >
      <div className="page-header-left">
        <div className="page-header-icon">
          <IconComponent
            size={24}
            aria-hidden="true"
          />
        </div>

        <div>
          <h1>
            {displayTitle}
          </h1>

          {displayDescription && (
            <p>
              {displayDescription}
            </p>
          )}
        </div>
      </div>

      {children ? (
        <div className="page-header-children">
          {children}
        </div>
      ) : actions.length > 0 ? (
        <div className="page-header-actions">
          {actions.map(
            renderAction
          )}
        </div>
      ) : null}
    </section>
  );
}

/*
=========================================================
PAGE HEADER ACTION HELPERS
=========================================================
*/

PageHeader.Actions = {
  add: (
    label = "Add",
    onClick,
    variant = "primary"
  ) => ({
    id: "add",
    label,
    icon: Plus,
    onClick,
    variant,
  }),

  export: (
    label = "Export",
    onClick,
    variant = "secondary"
  ) => ({
    id: "export",
    label,
    icon: Download,
    onClick,
    variant,
  }),

  refresh: (
    label = "Refresh",
    onClick,
    variant = "secondary"
  ) => ({
    id: "refresh",
    label,
    icon: RefreshCw,
    onClick,
    variant,
  }),

  archive: (
    label = "Archive",
    onClick,
    variant = "secondary"
  ) => ({
    id: "archive",
    label,
    icon: Archive,
    onClick,
    variant,
  }),

  custom: (
    id,
    label,
    icon,
    onClick,
    variant = "secondary"
  ) => ({
    id,
    label,
    icon,
    onClick,
    variant,
  }),
};

export default PageHeader;