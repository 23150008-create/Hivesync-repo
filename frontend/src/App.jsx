import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ChangePassword from "./pages/ChangePassword";
import LandingPage from "./pages/LandingPage";
import API_BASE from "./config/api";

import {
  getFirstAllowedInternalPage,
  hasModuleAccess,
  normalizePermissions,
} from "./utils/permissions";

const AUDIT_URL =
  `${API_BASE}/audit_trail/log_action.php`;

const STAFF_TOGGLE_SHORTCUT_KEY =
  "l";

const OPEN_LANDING_EVENT =
  "hivesync:open-landing";

const OPEN_DASHBOARD_EVENT =
  "hivesync:open-dashboard";

function App() {
  const [user, setUser] =
    useState(null);

  const [
    activePage,
    setActivePage,
  ] = useState("dashboard");

  const [
    mustChangePassword,
    setMustChangePassword,
  ] = useState(false);

  const [
    restoringSession,
    setRestoringSession,
  ] = useState(true);

  const [
    workspace,
    setWorkspace,
  ] = useState("system");

  const permissions = useMemo(
    () =>
      normalizePermissions(user),
    [user]
  );

  const canUseLanding =
    Boolean(user) &&
    permissions.includes(
      "landing"
    );

  const firstInternalPage =
    user
      ? getFirstAllowedInternalPage(
          user
        )
      : null;

  const canUseSystem =
    Boolean(firstInternalPage);

  const normalizeUser = (
    userData
  ) => {
    const normalized = {
      ...userData,
      role: String(
        userData?.role || ""
      ).trim(),
    };

    return {
      ...normalized,
      module_permissions:
        normalizePermissions(
          normalized
        ),
    };
  };

  const applyUserDestination = (
    userData
  ) => {
    const cleanUser =
      normalizeUser(userData);

    const role = String(
      cleanUser?.role || ""
    ).trim();

    const landingAllowed =
      hasModuleAccess(
        cleanUser,
        "landing"
      );

    const internalPage =
      getFirstAllowedInternalPage(
        cleanUser
      );

    setActivePage(
      internalPage ||
        "dashboard"
    );

    if (role === "Admin") {
      setWorkspace("system");
      return;
    }

    if (
      role === "Staff" &&
      landingAllowed
    ) {
      setWorkspace("landing");
      return;
    }

    if (
      landingAllowed &&
      !internalPage
    ) {
      setWorkspace("landing");
      return;
    }

    setWorkspace("system");
  };

  useEffect(() => {
    const savedUser =
      localStorage.getItem(
        "hivesync_user"
      );

    if (!savedUser) {
      setRestoringSession(false);
      return;
    }

    try {
      const parsedUser =
        JSON.parse(savedUser);

      if (
        !parsedUser ||
        typeof parsedUser !==
          "object"
      ) {
        throw new Error(
          "Invalid saved user information."
        );
      }

      const normalizedUser =
        normalizeUser(
          parsedUser
        );

      localStorage.setItem(
        "hivesync_user",
        JSON.stringify(
          normalizedUser
        )
      );

      localStorage.setItem(
        "user",
        JSON.stringify(
          normalizedUser
        )
      );

      setUser(
        normalizedUser
      );

      const requiresChange =
        Number(
          normalizedUser.must_change_password
        ) === 1;

      setMustChangePassword(
        requiresChange
      );

      if (!requiresChange) {
        applyUserDestination(
          normalizedUser
        );
      }
    } catch (error) {
      console.error(
        "Unable to restore saved user:",
        error
      );

      localStorage.removeItem(
        "hivesync_user"
      );

      localStorage.removeItem(
        "user"
      );
    } finally {
      setRestoringSession(
        false
      );
    }
  }, []);

  useEffect(() => {
    const handleWorkspaceShortcut =
      (event) => {
        const pressedShortcut =
          event.ctrlKey &&
          event.shiftKey &&
          !event.altKey &&
          event.key.toLowerCase() ===
            STAFF_TOGGLE_SHORTCUT_KEY;

        if (
          !pressedShortcut ||
          !user ||
          mustChangePassword ||
          !canUseLanding ||
          !canUseSystem
        ) {
          return;
        }

        event.preventDefault();

        setWorkspace((current) => {
          if (current === "landing") {
            if (firstInternalPage) {
              setActivePage(firstInternalPage);
              return "system";
            }

            return "landing";
          }

          return canUseLanding
            ? "landing"
            : "system";
        });
      };

    window.addEventListener(
      "keydown",
      handleWorkspaceShortcut
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleWorkspaceShortcut
      );
    };
  }, [
    user,
    mustChangePassword,
    canUseLanding,
    canUseSystem,
    firstInternalPage,
  ]);

  useEffect(() => {
    if (
      !user ||
      mustChangePassword
    ) {
      return;
    }

    if (
      workspace ===
        "landing" &&
      !canUseLanding
    ) {
      setWorkspace("system");
    }

    if (
      workspace ===
        "system" &&
      !canUseSystem &&
      canUseLanding
    ) {
      setWorkspace("landing");
    }
  }, [
    user,
    mustChangePassword,
    workspace,
    canUseLanding,
    canUseSystem,
  ]);

  useEffect(() => {
    const handleOpenLanding =
      () => {
        if (
          !user ||
          mustChangePassword ||
          !canUseLanding
        ) {
          return;
        }

        setWorkspace(
          "landing"
        );
      };

    window.addEventListener(
      OPEN_LANDING_EVENT,
      handleOpenLanding
    );

    return () => {
      window.removeEventListener(
        OPEN_LANDING_EVENT,
        handleOpenLanding
      );
    };
  }, [
    user,
    mustChangePassword,
    canUseLanding,
  ]);

  useEffect(() => {
    const handleOpenDashboard =
      () => {
        if (
          !user ||
          mustChangePassword ||
          !canUseSystem
        ) {
          return;
        }

        const dashboardAllowed =
          hasModuleAccess(
            user,
            "dashboard"
          );

        setActivePage(
          dashboardAllowed
            ? "dashboard"
            : firstInternalPage ||
                "dashboard"
        );

        setWorkspace(
          "system"
        );
      };

    window.addEventListener(
      OPEN_DASHBOARD_EVENT,
      handleOpenDashboard
    );

    return () => {
      window.removeEventListener(
        OPEN_DASHBOARD_EVENT,
        handleOpenDashboard
      );
    };
  }, [
    user,
    mustChangePassword,
    canUseSystem,
    firstInternalPage,
  ]);

  const logAction = async (
    userData,
    action,
    details
  ) => {
    try {
      await fetch(
        AUDIT_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id:
              userData?.user_id ||
              null,

            user_name:
              userData?.full_name ||
              userData?.name ||
              "Unknown User",

            module:
              "Authentication",

            action,

            details,
          }),
        }
      );
    } catch (error) {
      console.error(
        "Audit log error:",
        error
      );
    }
  };

  const handleLogin = (
    loggedInUser
  ) => {
    if (!loggedInUser) {
      return;
    }

    const normalizedUser =
      normalizeUser(
        loggedInUser
      );

    localStorage.setItem(
      "hivesync_user",
      JSON.stringify(
        normalizedUser
      )
    );

    localStorage.setItem(
      "user",
      JSON.stringify(
        normalizedUser
      )
    );

    setUser(
      normalizedUser
    );

    const requiresChange =
      Number(
        normalizedUser.must_change_password
      ) === 1;

    setMustChangePassword(
      requiresChange
    );

    if (requiresChange) {
      setWorkspace("system");
      setActivePage(
        "dashboard"
      );
      return;
    }

    applyUserDestination(
      normalizedUser
    );
  };

  const handlePasswordChanged =
    async (updatedUser) => {
      const cleanUser =
        normalizeUser({
          ...updatedUser,
          must_change_password: 0,
        });

      void logAction(
        cleanUser,
        "Password Changed",
        `${
          cleanUser.full_name ||
          cleanUser.name ||
          "User"
        } changed the default password and was required to sign in again.`
      );

      localStorage.removeItem(
        "hivesync_user"
      );

      localStorage.removeItem(
        "user"
      );

      localStorage.removeItem(
        "hivesync_landing_cart"
      );

      setUser(null);

      setMustChangePassword(
        false
      );

      setActivePage(
        "dashboard"
      );

      setWorkspace(
        "system"
      );

      };

  const handleLogout =
    async () => {
      const currentUser =
        user;

      void logAction(
        currentUser,
        "Logout",
        `${
          currentUser?.full_name ||
          currentUser?.name ||
          "User"
        } logged out.`
      );

      localStorage.removeItem(
        "hivesync_user"
      );

      localStorage.removeItem(
        "user"
      );

      localStorage.removeItem(
        "hivesync_landing_cart"
      );

      setUser(null);

      setMustChangePassword(
        false
      );

      setActivePage(
        "dashboard"
      );

      setWorkspace(
        "system"
      );
    };

  const handleLandingNotificationNavigate =
    (destination) => {
      const requestedPage = String(
        destination?.page || ""
      ).trim();

      if (!requestedPage || !user) {
        return;
      }

      if (
        !hasModuleAccess(
          user,
          requestedPage
        )
      ) {
        console.warn(
          `Notification destination "${requestedPage}" is not allowed for this account.`
        );
        return;
      }

      setActivePage(
        requestedPage
      );

      setWorkspace(
        "system"
      );
    };

  if (restoringSession) {
    return null;
  }

  if (!user) {
    return (
      <Login
        onLogin={
          handleLogin
        }
      />
    );
  }

  if (mustChangePassword) {
    return (
      <ChangePassword
        user={user}
        onPasswordChanged={
          handlePasswordChanged
        }
        onLogout={
          handleLogout
        }
      />
    );
  }

  if (
    workspace ===
      "landing" &&
    canUseLanding
  ) {
    return (
      <LandingPage
        user={user}
        onLogout={
          handleLogout
        }
        onNotificationNavigate={
          handleLandingNotificationNavigate
        }
      />
    );
  }

  if (canUseSystem) {
    return (
      <Dashboard
        user={user}
        activePage={
          activePage
        }
        setActivePage={
          setActivePage
        }
        onLogout={
          handleLogout
        }
      />
    );
  }

  if (canUseLanding) {
    return (
      <LandingPage
        user={user}
        onLogout={
          handleLogout
        }
        onNotificationNavigate={
          handleLandingNotificationNavigate
        }
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "#f5f7fa",
      }}
    >
      <div
        style={{
          width:
            "min(520px, 100%)",
          padding: "28px",
          border:
            "1px solid #e5e7eb",
          borderRadius:
            "16px",
          background:
            "#ffffff",
          textAlign:
            "center",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          No Module Access
        </h2>

        <p
          style={{
            color:
              "#6b7280",
            lineHeight: 1.6,
          }}
        >
          This account does not
          have an assigned module.
          Ask the administrator to
          update the account in User
          Management.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={
            handleLogout
          }
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default App;