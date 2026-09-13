import { useEffect, useState } from "react";
import {
  Save,
  User,
  BadgeCheck,
  CalendarDays,
  Info,
  FileText,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import API_BASE from "../config/api";

function Settings({ user }) {
  const API_URL = `${API_BASE}/settings_management/`;
  const AUDIT_URL =
    `${API_BASE}/audit_trail/log_action.php`;
  const GET_LOGS_URL =
    `${API_BASE}/audit_trail/get_logs.php`;

  const canAccessSettings =
    user?.role === "Admin" ||
    user?.role === "Audit";

  const canEditSettings =
    user?.role === "Admin";

  const [profile, setProfile] = useState({
    user_id: "",
    full_name: "",
    email: "",
    role: "",
    status: "",
    last_login: "",
    created_at: "",
  });

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);

  const auditLimit = 20;

  const [auditPagination, setAuditPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });

  const getSavedUser = () => {
    try {
      const hivesyncUser = localStorage.getItem("hivesync_user");
      const oldUser = localStorage.getItem("user");

      if (hivesyncUser) return JSON.parse(hivesyncUser);
      if (oldUser) return JSON.parse(oldUser);

      return null;
    } catch (error) {
      console.log("Local storage user parse error:", error);
      return null;
    }
  };

  useEffect(() => {
    const savedUser = getSavedUser();
    const currentUser = user || savedUser;

    if (currentUser) {
      setProfile({
        user_id: currentUser.user_id || "",
        full_name: currentUser.full_name || "System Admin",
        email: currentUser.email || "admin@hivesync.com",
        role: currentUser.role || "Admin",
        status: currentUser.status || "Active",
        last_login: currentUser.last_login || "Not logged in yet",
        created_at: currentUser.created_at || "N/A",
      });
    }
  }, [user]);

  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);

      const params = new URLSearchParams({
        page: auditPage,
        limit: auditLimit,
        search: auditSearch,
        date: auditDate,
        start_date: customStartDate,
        end_date: customEndDate,
      });

      const res = await fetch(`${GET_LOGS_URL}?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setAuditLogs(data.logs || []);
        setAuditPagination(
          data.pagination || {
            page: auditPage,
            limit: auditLimit,
            total: 0,
            total_pages: 1,
          }
        );
      } else {
        setAuditLogs([]);
      }
    } catch (error) {
      console.log("Audit trail fetch error:", error);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      setAuditPage(1);
    }, 300);

    return () => clearTimeout(delay);
  }, [auditSearch, auditDate, customStartDate, customEndDate]);

  useEffect(() => {
    loadAuditLogs();
  }, [auditPage, auditSearch, auditDate, customStartDate, customEndDate]);

  const logAction = async (action, details) => {
    try {
      await fetch(AUDIT_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: profile.user_id || user?.user_id || null,
          user_name: profile.full_name || user?.full_name || "System Admin",
          module: "Utilities",
          action,
          details,
        }),
      });
    } catch (error) {
      console.log("Audit log error:", error);
    }
  };

  const updateProfile = async () => {
    if (!canEditSettings) {
      alert("You do not have permission to update settings.");
      return;
    }

    if (!profile.full_name.trim() || !profile.email.trim()) {
      alert("Please complete your full name and email.");
      return;
    }

    try {
      const res = await fetch(API_URL + "update_profile.php", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });

      const data = await res.json();

      if (data.success) {
        const savedUser = getSavedUser();

        const updatedUser = {
          ...(savedUser || {}),
          ...(user || {}),
          ...profile,
        };

        localStorage.setItem("hivesync_user", JSON.stringify(updatedUser));
        localStorage.setItem("user", JSON.stringify(updatedUser));

        await logAction(
          "Updated Profile",
          `Updated profile information for ${profile.full_name}`
        );

        await loadAuditLogs();

        alert(data.message || "Profile updated successfully.");
      } else {
        alert(data.message || "Profile update failed.");
      }
    } catch (error) {
      console.log(error);
      alert("Cannot connect to update_profile.php");
    }
  };

  const clearAuditFilters = () => {
    setAuditSearch("");
    setAuditDate("");
    setCustomStartDate("");
    setCustomEndDate("");
    setAuditPage(1);
  };

  const startLog =
    auditPagination.total === 0
      ? 0
      : (auditPagination.page - 1) * auditPagination.limit + 1;

  const endLog = Math.min(
    auditPagination.page * auditPagination.limit,
    auditPagination.total
  );

  if (!canAccessSettings) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <p>HiveSync › Utilities</p>
            <h1>Access Denied</h1>
            <span>You do not have permission to access utilities.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Utilities</h1>
          <span>Manage profile, system information, and audit trail</span>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-overview-card">
          <div className="settings-overview-left">
            <div className="settings-avatar small">
              {profile.full_name
                ? profile.full_name.charAt(0).toUpperCase()
                : "U"}
            </div>

            <div className="settings-overview-identity">
              <div className="settings-overview-name-row">
                <h2>{profile.full_name || "System User"}</h2>
                <span className="settings-active-badge">
                  {profile.status || "Active"}
                </span>
              </div>
              <p>{profile.email}</p>
            </div>
          </div>

          <div className="settings-overview-facts">
            <div className="settings-overview-fact">
              <div className="settings-fact-icon">
                <User size={17} />
              </div>
              <div>
                <span>Role</span>
                <strong>{profile.role || "User"}</strong>
              </div>
            </div>

            <div className="settings-overview-fact">
              <div className="settings-fact-icon">
                <CalendarDays size={17} />
              </div>
              <div>
                <span>Last Login</span>
                <strong>{profile.last_login || "Not logged in yet"}</strong>
              </div>
            </div>

            <div className="settings-overview-fact">
              <div className="settings-fact-icon">
                <Info size={17} />
              </div>
              <div>
                <span>System Version</span>
                <strong>HiveSync v1.0</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-card-grid">
          {canEditSettings && (
            <div className="settings-card profile-card">
              <div className="settings-card-header">
                <div className="settings-icon-box">
                  <User size={20} />
                </div>

                <div>
                  <h2>Profile Information</h2>
                  <p>Update your account details</p>
                </div>
              </div>

              <div className="settings-profile-fields">
                <div className="settings-field">
                  <label>Full Name</label>
                  <input
                    value={profile.full_name}
                    onChange={(e) =>
                      setProfile({ ...profile, full_name: e.target.value })
                    }
                  />
                </div>

                <div className="settings-field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="settings-account-section">
                <div className="settings-subsection-title">
                  <span></span>
                  Account Information
                </div>

                <div className="settings-account-grid">
                  <div className="settings-info-tile">
                    <div className="settings-fact-icon">
                      <User size={17} />
                    </div>
                    <div>
                      <span>Role</span>
                      <strong>{profile.role || "User"}</strong>
                    </div>
                  </div>

                  <div className="settings-info-tile">
                    <div className="settings-fact-icon">
                      <CalendarDays size={17} />
                    </div>
                    <div>
                      <span>Last Login</span>
                      <strong>{profile.last_login || "Not logged in yet"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <button className="primary-btn full-btn settings-save-btn" onClick={updateProfile}>
                <Save size={18} />
                Save Changes
              </button>
            </div>
          )}

          <div className="settings-card system-card">
            <div className="settings-card-header">
              <div className="settings-icon-box">
                <BadgeCheck size={20} />
              </div>

              <div>
                <h2>System Details</h2>
                <p>Current deployment information</p>
              </div>
            </div>

            <div className="system-row">
              <span>System Name</span>
              <strong>HiveSync</strong>
            </div>

            <div className="system-row">
              <span>Organization</span>
              <strong>Bacnotan Farmers Agri-Tourism Center</strong>
            </div>

            <div className="system-row">
              <span>Location</span>
              <strong>Bacnotan, La Union</strong>
            </div>

            <div className="system-row">
              <span>Version</span>
              <strong>v1.0</strong>
            </div>

            <div className="system-row">
              <span>Password Policy</span>
              <strong>First-login password change required</strong>
            </div>
          </div>
        </div>

        <div className="settings-card audit-card-clean">
          <div className="settings-card-header audit-card-header">
            <div className="settings-icon-box dark">
              <FileText size={20} />
            </div>

            <div>
              <h2>Audit Trail</h2>
              <p>Search by user, module, action, details, or date and time</p>
            </div>
          </div>

          <div className="audit-simple-toolbar">
            <div className="audit-simple-search">
              <Search size={18} />
              <input
                placeholder="Search by user, module, action, details, or date and time..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>

            <div className="audit-filter-row">
              <select
                className="audit-filter-select"
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
              >
                <option value="">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>

              {auditDate === "custom" && (
                <>
                  <input
                    type="date"
                    className="audit-date-input"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />

                  <input
                    type="date"
                    className="audit-date-input"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </>
              )}

              <button className="secondary-btn" onClick={loadAuditLogs}>
                <RefreshCw size={16} />
                Refresh
              </button>

              <button className="secondary-btn" onClick={clearAuditFilters}>
                Clear
              </button>
            </div>
          </div>

          <div className="audit-summary-row">
            <span>
              Showing <b>{startLog}</b>–<b>{endLog}</b> of{" "}
              <b>{auditPagination.total}</b> logs
            </span>
          </div>

          <div className="audit-table-wrap-clean audit-table-fixed-height">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>User</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {auditLoading ? (
                  <tr>
                    <td colSpan="5" className="empty-row">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-row">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, index) => (
                    <tr key={log.audit_id || index}>
                      <td>{log.created_at}</td>
                      <td>{log.user_name}</td>
                      <td>{log.module}</td>
                      <td>
                        <span className="badge info">{log.action}</span>
                      </td>
                      <td>{log.details || "No details"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="audit-pagination">
            <button
              className="secondary-btn"
              disabled={auditPage <= 1}
              onClick={() => setAuditPage((prev) => prev - 1)}
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <span>
              Page <b>{auditPagination.page}</b> of{" "}
              <b>{auditPagination.total_pages}</b>
            </span>

            <button
              className="secondary-btn"
              disabled={auditPage >= auditPagination.total_pages}
              onClick={() => setAuditPage((prev) => prev + 1)}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;