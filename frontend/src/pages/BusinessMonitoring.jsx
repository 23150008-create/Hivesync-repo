import { useEffect, useState } from "react";
import {
  Activity,
  Search,
  Bell,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  History,
  PackageX,
  Truck,
  CalendarClock,
  LayoutDashboard,
} from "lucide-react";
import "../styles/notifications.css";

function BusinessMonitoring() {
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("alerts");

  useEffect(() => {
    loadMonitoringData();
  }, []);

  const loadMonitoringData = async () => {
    await Promise.all([loadNotifications(), loadAuditLogs()]);
  };

  const loadNotifications = async () => {
    try {
      const res = await fetch(
        "http://localhost/HiveSync/backend/business_monitoring/get_notifications.php"
      );

      const data = await res.json();

      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.log("Notifications error:", error);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch(
        "http://localhost/HiveSync/backend/audit_trail/get_logs.php"
      );

      const data = await res.json();

      if (data.success) {
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.log("Audit logs error:", error);
    }
  };

  const filteredNotifications = notifications.filter((item) =>
    `${item.type} ${item.title} ${item.message} ${item.priority}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredAuditLogs = auditLogs.filter((item) =>
    `${item.user_name} ${item.module} ${item.action} ${item.details} ${item.created_at}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const lowStock = notifications.filter((item) =>
    String(item.title || "").toLowerCase().includes("low stock")
  ).length;

  const outOfStock = notifications.filter((item) =>
    String(item.title || "").toLowerCase().includes("out of stock")
  ).length;

  const expiring = notifications.filter((item) =>
    String(item.title || "").toLowerCase().includes("expir")
  ).length;

  const pendingDeliveries = notifications.filter((item) =>
    String(item.title || "").toLowerCase().includes("delivery")
  ).length;

  const critical = notifications.filter((item) => item.priority === "High").length;

  const getIcon = (priority) => {
    if (priority === "High") return <AlertTriangle size={18} />;
    if (priority === "Medium") return <Clock size={18} />;
    if (priority === "Low") return <Info size={18} />;
    return <Bell size={18} />;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    return new Date(dateValue).toLocaleString();
  };

  return (
    <div className="page">
      {/* Unified Page Header */}
      <div className="page-header-modern">
        <div className="page-header-left">
          <div className="page-header-icon">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1>Business Monitoring</h1>
            <p>Real-time business alerts, notifications, and system audit trail</p>
          </div>
        </div>
        <button className="primary-btn" onClick={loadMonitoringData}>
          <Activity size={18} />
          Refresh
        </button>
      </div>

      <section className="module-stats">
        <div className="module-card">
          <span>Critical Alerts</span>
          <h2>{critical}</h2>
        </div>

        <div className="module-card">
          <span>Low Stock</span>
          <h2>{lowStock}</h2>
        </div>

        <div className="module-card">
          <span>Out of Stock</span>
          <h2>{outOfStock}</h2>
        </div>

        <div className="module-card">
          <span>Audit Records</span>
          <h2>{auditLogs.length}</h2>
        </div>
      </section>

      <section className="monitor-summary-grid">
        <div className="monitor-card">
          <PackageX size={22} />
          <div>
            <span>Inventory Issues</span>
            <h3>{lowStock + outOfStock}</h3>
          </div>
        </div>

        <div className="monitor-card">
          <CalendarClock size={22} />
          <div>
            <span>Expiring Products</span>
            <h3>{expiring}</h3>
          </div>
        </div>

        <div className="monitor-card">
          <Truck size={22} />
          <div>
            <span>Delivery Alerts</span>
            <h3>{pendingDeliveries}</h3>
          </div>
        </div>

        <div className="monitor-card">
          <History size={22} />
          <div>
            <span>System Activities</span>
            <h3>{auditLogs.length}</h3>
          </div>
        </div>
      </section>

      <div className="monitoring-tabs">
        <button
          className={activeTab === "alerts" ? "active" : ""}
          onClick={() => setActiveTab("alerts")}
        >
          <Bell size={16} />
          System Alerts
        </button>

        <button
          className={activeTab === "audit" ? "active" : ""}
          onClick={() => setActiveTab("audit")}
        >
          <History size={16} />
          Audit Trail
        </button>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder={
                activeTab === "alerts"
                  ? "Search alerts..."
                  : "Search audit logs..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {activeTab === "alerts" ? (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Alert</th>
                <th>Message</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-row">
                    No system alerts yet.
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((item, index) => (
                  <tr key={index}>
                    <td>{item.type}</td>
                    <td>
                      <div className="notification-title">
                        {getIcon(item.priority)}
                        <strong>{item.title}</strong>
                      </div>
                    </td>
                    <td>{item.message}</td>
                    <td>
                      <span
                        className={`priority-badge ${String(
                          item.priority || ""
                        ).toLowerCase()}`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge completed">
                        <CheckCircle size={14} />
                        Active
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>User</th>
                <th>Module</th>
                <th>Action</th>
                <th>Details</th>
                <th>Date & Time</th>
              </tr>
            </thead>

            <tbody>
              {filteredAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-row">
                    No audit trail records yet.
                  </td>
                </tr>
              ) : (
                filteredAuditLogs.map((log) => (
                  <tr key={log.audit_id}>
                    <td>AUD-{String(log.audit_id).padStart(4, "0")}</td>
                    <td>{log.user_name || "Unknown User"}</td>
                    <td>{log.module}</td>
                    <td>
                      <span className="priority-badge low">{log.action}</span>
                    </td>
                    <td>{log.details}</td>
                    <td>{formatDate(log.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default BusinessMonitoring;