import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import API_BASE from "../config/api";

import UserManagement from "./UserManagement";
import InventoryManagement from "./InventoryManagement";
import VendorManagement from "./VendorManagement";
import DeliveryManagement from "./DeliveryManagement";
import POSManagement from "./POSManagement";
import ReceivablesManagement from "./ReceivablesManagement";
import ReportsManagement from "./ReportsManagement";
import Settings from "./Settings";

import {
  CalendarDays,
  Handshake,
  PhilippinePeso,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "../styles/dashboard.css";
import {
  getFirstAllowedInternalPage,
  hasModuleAccess,
} from "../utils/permissions";

const API_URL =
  `${API_BASE}/business_monitoring/dashboard_summary.php`;

const EMPTY_SUMMARY = {
  todays_sales: 0,
  gross_sales: 0,
  discount_total: 0,
  net_sales: 0,
  cash_on_hand: 0,
  total_receivable: 0,
  supplier_remittance: 0,
  supplier_cost: 0,
  operating_expenses: 0,
  net_profit: 0,
  monthly_revenue: 0,
  active_inventory: 0,
  inventory_value: 0,
  low_stock_items: 0,
  pending_deliveries: 0,
  vendor_partners: 0,
  pending_approvals: 0,
};

function Dashboard({
  user,
  activePage,
  setActivePage,
  onLogout,
}) {
  const role = user?.role || "Staff";
  const isSupplier =
    role === "Supplier" || role === "Vendor";

  const [loading, setLoading] = useState(false);
  const dashboardRequestRef = useRef(null);

  const [notificationTarget, setNotificationTarget] = useState(null);

  const [filters, setFilters] = useState({
    start_date: formatDateInput(
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
    ),
    end_date: formatDateInput(new Date()),
  });

  const [summary, setSummary] = useState(
    EMPTY_SUMMARY
  );

  const [recentSales, setRecentSales] =
    useState([]);

  const [
    bestSellingProducts,
    setBestSellingProducts,
  ] = useState([]);

  const [
    recentDeliveries,
    setRecentDeliveries,
  ] = useState([]);

  const [
    lowStockProducts,
    setLowStockProducts,
  ] = useState([]);

  const [
    nearExpiryItems,
    setNearExpiryItems,
  ] = useState([]);

  const [
    supplierRemittanceList,
    setSupplierRemittanceList,
  ] = useState([]);

  const [revenueChart, setRevenueChart] =
    useState([]);

  const canAccessPage = (page) =>
    hasModuleAccess(user, page);

  const firstAllowedPage =
    getFirstAllowedInternalPage(user);

  const peso = (value) =>
    `₱${Number(value || 0).toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }
    )}`;

  const loadDashboardData = useCallback(
    async ({ silent = false } = {}) => {
      if (isSupplier) {
        return;
      }

      if (dashboardRequestRef.current) {
        dashboardRequestRef.current.abort();
      }

      const controller = new AbortController();
      dashboardRequestRef.current = controller;

      if (!silent) {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          start_date: filters.start_date,
          end_date: filters.end_date,
        });

        const response = await fetch(
          `${API_URL}?${params.toString()}`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data?.success) {
          console.error(
            "Dashboard summary request failed:",
            data?.message ||
              "Unable to load dashboard information."
          );

          return;
        }

        setSummary({
          todays_sales: Number(
            data.summary?.todays_sales || 0
          ),
          gross_sales: Number(
            data.summary?.gross_sales || 0
          ),
          discount_total: Number(
            data.summary?.discount_total || 0
          ),
          net_sales: Number(
            data.summary?.net_sales || 0
          ),
          cash_on_hand: Number(
            data.summary?.cash_on_hand || 0
          ),
          total_receivable: Number(
            data.summary?.total_receivable || 0
          ),
          supplier_remittance: Number(
            data.summary?.supplier_remittance || 0
          ),
          supplier_cost: Number(
            data.summary?.supplier_cost || 0
          ),
          operating_expenses: Number(
            data.summary?.operating_expenses || 0
          ),
          net_profit: Number(
            data.summary?.net_profit || 0
          ),
          monthly_revenue: Number(
            data.summary?.monthly_revenue || 0
          ),
          active_inventory: Number(
            data.summary?.active_inventory || 0
          ),
          inventory_value: Number(
            data.summary?.inventory_value || 0
          ),
          low_stock_items: Number(
            data.summary?.low_stock_items || 0
          ),
          pending_deliveries: Number(
            data.summary?.pending_deliveries || 0
          ),
          vendor_partners: Number(
            data.summary?.vendor_partners || 0
          ),
          pending_approvals: Number(
            data.summary?.pending_approvals || 0
          ),
        });

        setRecentSales(data.recent_sales || []);

        setBestSellingProducts(
          data.best_selling_products || []
        );

        setRecentDeliveries(
          data.recent_deliveries || []
        );

        setLowStockProducts(
          data.low_stock_products || []
        );

        setNearExpiryItems(
          data.near_expiry_items || []
        );

        setSupplierRemittanceList(
          data.supplier_remittance_list || []
        );

        setRevenueChart(data.revenue_chart || []);
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error(
            "Dashboard summary error:",
            error
          );
        }
      } finally {
        if (
          dashboardRequestRef.current === controller
        ) {
          dashboardRequestRef.current = null;

          if (!silent) {
            setLoading(false);
          }
        }
      }
    },
    [
      isSupplier,
      filters.start_date,
      filters.end_date,
    ]
  );

  useEffect(() => {
    if (isSupplier && activePage === "dashboard") {
      return;
    }

    if (activePage !== "dashboard") {
      return;
    }

    loadDashboardData();

    const refreshSilently = () => {
      loadDashboardData({
        silent: true,
      });
    };

    const handleVisibilityChange = () => {
      if (
        !document.hidden &&
        activePage === "dashboard"
      ) {
        refreshSilently();
      }
    };

    const timer = window.setInterval(() => {
      if (!document.hidden) {
        refreshSilently();
      }
    }, 15000);

    window.addEventListener(
      "focus",
      refreshSilently
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(timer);

      window.removeEventListener(
        "focus",
        refreshSilently
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      if (dashboardRequestRef.current) {
        dashboardRequestRef.current.abort();
        dashboardRequestRef.current = null;
      }
    };
  }, [
    activePage,
    isSupplier,
    loadDashboardData,
  ]);

  useEffect(() => {
    if (canAccessPage(activePage)) {
      return;
    }

    if (firstAllowedPage) {
      setActivePage(firstAllowedPage);
    }
  }, [
    activePage,
    user,
    firstAllowedPage,
  ]);

  useEffect(() => {
    if (!notificationTarget) {
      return;
    }

    const targetPage =
      notificationTarget?.page || null;

    if (
      targetPage &&
      activePage !== targetPage
    ) {
      setNotificationTarget(null);

      sessionStorage.removeItem(
        "hivesync_notification_target"
      );
    }
  }, [activePage, notificationTarget]);

  const setPresetFilter = (type) => {
    const today = new Date();

    let start = new Date(today);
    let end = new Date(today);

    if (type === "week") {
      const day = today.getDay();

      const difference =
        today.getDate() -
        day +
        (day === 0 ? -6 : 1);

      start = new Date(today);
      start.setDate(difference);
    }

    if (type === "month") {
      start = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );
    }

    setFilters({
      start_date: formatDateInput(start),
      end_date: formatDateInput(end),
    });
  };

  const recentTransactions = useMemo(() => {
    const sales = recentSales.map((item, index) => ({
      id:
        item.pos_id ||
        item.transaction_code ||
        `sale-${index}`,
      rawDate: item.transaction_date,
      type: "Sale",
      reference:
        item.transaction_code ||
        `Sale #${item.pos_id || index + 1}`,
      description:
        item.customer_name || "Walk-in Client",
      amount: Number(item.total_amount || 0),
      status: "Completed",
    }));

    const deliveries = recentDeliveries.map(
      (item, index) => ({
        id:
          item.delivery_id ||
          item.delivery_order_no ||
          `delivery-${index}`,
        rawDate: item.delivery_date,
        type: "Delivery",
        reference:
          item.delivery_order_no ||
          `Delivery #${item.delivery_id || index + 1}`,
        description:
          item.vendor_name || "Supplier",
        amount: Number(
          item.total_amount ||
            item.payable_amount ||
            item.total_payable ||
            0
        ),
        status: item.status || "Pending",
      })
    );

    return [...sales, ...deliveries]
      .sort(
        (a, b) =>
          safeDateValue(b.rawDate) -
          safeDateValue(a.rawDate)
      )
      .slice(0, 6);
  }, [recentSales, recentDeliveries]);

  const renderPage = () => {
    if (!canAccessPage(activePage)) {
      return null;
    }

    if (activePage === "users") {
      return <UserManagement user={user} />;
    }

    if (activePage === "inventory") {
      return (
        <InventoryManagement user={user} />
      );
    }

    if (activePage === "vendors") {
      const isProductProposalTarget =
        notificationTarget?.focusType ===
          "supplier_product_request" ||
        notificationTarget?.type ===
          "Supplier Product Request" ||
        notificationTarget?.type ===
          "Supplier Product" ||
        notificationTarget?.type ===
          "Product Request";

      const isProductActionTarget =
        notificationTarget?.focusType ===
          "supplier_product_action_request" ||
        notificationTarget?.type ===
          "Pullout" ||
        notificationTarget?.type ===
          "Pull-out" ||
        notificationTarget?.type ===
          "Disposal";

      return (
        <VendorManagement
          user={user}
          focusProductRequestId={
            isProductProposalTarget
              ? notificationTarget?.requestId ||
                notificationTarget?.referenceId ||
                null
              : null
          }
          focusProductActionRequestId={
            isProductActionTarget
              ? notificationTarget?.requestId ||
                notificationTarget?.referenceId ||
                null
              : null
          }
          focusVendorId={
            isProductProposalTarget ||
            isProductActionTarget
              ? notificationTarget?.vendorId ||
                null
              : null
          }
        />
      );
    }

    if (activePage === "deliveries") {
      const isDeliveryTarget =
        notificationTarget?.page ===
          "deliveries" ||
        notificationTarget?.type ===
          "Delivery";

      return (
        <DeliveryManagement
          user={user}
          focusDeliveryId={
            isDeliveryTarget
              ? notificationTarget?.referenceId ||
                notificationTarget?.requestId ||
                null
              : null
          }
        />
      );
    }

    if (activePage === "pos") {
      return <POSManagement user={user} />;
    }

    if (activePage === "receivables") {
      return (
        <ReceivablesManagement user={user} />
      );
    }

    if (activePage === "reports") {
      return (
        <ReportsManagement user={user} />
      );
    }

    if (activePage === "settings") {
      return <Settings user={user} />;
    }

    return (
      <>
        <section className="dashboard-topbar">
          <div>
            <h1>My Dashboard</h1>
          </div>

          <div className="dashboard-filter-controls">
            <div className="dashboard-preset-buttons">
              <button
                type="button"
                className="dashboard-filter-button"
                onClick={() =>
                  setPresetFilter("today")
                }
              >
                Today
              </button>

              <button
                type="button"
                className="dashboard-filter-button"
                onClick={() =>
                  setPresetFilter("week")
                }
              >
                This Week
              </button>

              <button
                type="button"
                className="dashboard-filter-button"
                onClick={() =>
                  setPresetFilter("month")
                }
              >
                This Month
              </button>
            </div>

            <div className="dashboard-date-controls">
              <CalendarDays size={15} />

              <input
                type="date"
                value={filters.start_date}
                max={filters.end_date}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    start_date:
                      event.target.value,
                  }))
                }
              />

              <span>—</span>

              <input
                type="date"
                value={filters.end_date}
                min={filters.start_date}
                max={formatDateInput(new Date())}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    end_date:
                      event.target.value,
                  }))
                }
              />
            </div>

            <button
              type="button"
              className="dashboard-refresh-button"
              onClick={loadDashboardData}
              disabled={loading}
            >
              <RefreshCw
                size={15}
                className={
                  loading ? "refresh-spin" : ""
                }
              />
              {loading ? "Loading" : "Refresh"}
            </button>
          </div>
        </section>

        <section className="dashboard-kpi-grid">
          <MetricCard
            icon={<Handshake size={18} />}
            label="Remittance per Supplier"
            value={peso(summary.supplier_remittance)}
            hoverItems={supplierRemittanceList}
            peso={peso}
          />

          <MetricCard
            icon={<TrendingUp size={18} />}
            label="Total Net Sales"
            value={peso(summary.net_sales)}
          />

          <MetricCard
            icon={<WalletCards size={18} />}
            label="Cash on Hand"
            value={peso(summary.cash_on_hand)}
          />

          <MetricCard
            icon={<ReceiptText size={18} />}
            label="Total Receivable"
            value={peso(summary.total_receivable)}
          />

          <MetricCard
            icon={<TrendingUp size={18} />}
            label="Gross Sales"
            value={peso(summary.gross_sales)}
          />

          <MetricCard
            icon={<PhilippinePeso size={18} />}
            label="Total Sales"
            value={peso(
              summary.monthly_revenue ||
                summary.gross_sales
            )}
          />
        </section>

        <section className="dashboard-analytics-grid">
          <article className="dashboard-card dashboard-sales-card">
            <div className="dashboard-card-heading">
              <div>
                <h2>Sales Overview</h2>
              </div>

            </div>

            <SalesOverviewChart
              data={revenueChart}
              peso={peso}
            />
          </article>

          <article className="dashboard-card dashboard-breakdown-card">
            <div className="dashboard-card-heading">
              <div>
                <h2>Sales Breakdown</h2>
              </div>
            </div>

            <SalesBreakdown
              summary={summary}
              peso={peso}
            />
          </article>
        </section>

        <section className="dashboard-bottom-grid">
          <article className="dashboard-card dashboard-suppliers-card">
            <div className="dashboard-card-heading">
              <div>
                <h2>Top Suppliers (Remittance)</h2>
              </div>
            </div>

            <TopSuppliers
              items={supplierRemittanceList}
              peso={peso}
            />
          </article>

          <article className="dashboard-card dashboard-products-card">
            <div className="dashboard-card-heading">
              <div>
                <h2>Best Selling Products</h2>
              </div>
            </div>

            <BestSellingProducts
              items={bestSellingProducts}
              peso={peso}
            />
          </article>

          <article className="dashboard-card dashboard-transactions-card">
            <div className="dashboard-card-heading">
              <div>
                <h2>Recent Transactions</h2>
              </div>
            </div>

            <RecentTransactions
              items={recentTransactions}
              peso={peso}
            />
          </article>
        </section>

        <div className="dashboard-footer-note">
          <span>
            Live dashboard data · Auto-refresh every 15 seconds
          </span>
        </div>
      </>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={onLogout}
        user={user}
      />

      <main className="main-content">
        <PageHeader
          showSystemHeader
          user={user}
          setActivePage={setActivePage}
          onNotificationNavigate={(destination) => {
            if (!destination?.page) {
              return;
            }

            const nextTarget = {
              page: destination.page,
              type: destination.type || null,
              focusType:
                destination.focusType || null,
              requestId:
                destination.requestId ||
                destination.referenceId ||
                null,
              referenceId:
                destination.referenceId ||
                destination.requestId ||
                null,
              vendorId:
                destination.vendorId || null,
              notificationId:
                destination.notificationId ||
                null,
            };

            setNotificationTarget(nextTarget);

            sessionStorage.setItem(
              "hivesync_notification_target",
              JSON.stringify(nextTarget)
            );

            setActivePage(destination.page);
          }}
        />

        <div className="dashboard-content-shell">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hoverItems = null,
  peso,
}) {
  const hasHoverItems = Array.isArray(hoverItems);

  return (
    <article
      className={`dashboard-metric-card${
        hasHoverItems ? " has-remittance-hover" : ""
      }`}
      tabIndex={0}
      aria-label={`${label}: ${value}`}
    >
      <div className="dashboard-metric-top">
        <div className="dashboard-metric-icon">
          {icon}
        </div>

        <span>{label}</span>
      </div>

      <strong>{value}</strong>

      {hasHoverItems && (
        <div className="dashboard-remittance-hover">
          <div className="dashboard-remittance-hover-title">
            Remittance per Supplier
          </div>

          <div className="dashboard-remittance-hover-list">
            {hoverItems.length > 0 ? (
              hoverItems.map((item, index) => (
                <div
                  className="dashboard-remittance-hover-row"
                  key={
                    item.vendor_id ||
                    item.vendor_name ||
                    index
                  }
                >
                  <span>
                    {item.vendor_name ||
                      "Unknown Supplier"}
                  </span>
                  <strong>
                    {peso
                      ? peso(item.remittance_amount)
                      : item.remittance_amount}
                  </strong>
                </div>
              ))
            ) : (
              <div className="dashboard-remittance-hover-empty">
                No suppliers available.
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function SalesOverviewChart({
  data = [],
  peso,
}) {
  const chartData = data.map((item) => ({
    month:
      item.month_name ||
      item.month ||
      "Month",
    gross_sales: Number(
      item.gross_sales || 0
    ),
    net_sales: Number(
      item.net_sales ||
        item.pos_sales ||
        0
    ),
  }));

  if (chartData.length === 0) {
    return (
      <div className="dashboard-empty-state">
        No sales data available for the selected period.
      </div>
    );
  }

  return (
    <div className="dashboard-chart-area">
      <div className="dashboard-chart-legend">
        <span>
          <i className="legend-dot legend-gold" />
          Gross Sales
        </span>

        <span>
          <i className="legend-dot legend-dark" />
          Net Sales
        </span>
      </div>

      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <BarChart
          data={chartData}
          margin={{
            top: 18,
            right: 10,
            left: 0,
            bottom: 0,
          }}
          barGap={4}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#edf0f3"
          />

          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{
              fontSize: 10,
              fill: "#6b7280",
            }}
          />

          <YAxis
            tickLine={false}
            axisLine={false}
            width={58}
            tick={{
              fontSize: 10,
              fill: "#6b7280",
            }}
            tickFormatter={(value) =>
              Number(value) >= 1000
                ? `₱${Math.round(
                    Number(value) / 1000
                  )}K`
                : `₱${Number(value)}`
            }
          />

          <Tooltip
            cursor={{
              fill: "rgba(244,180,0,0.06)",
            }}
            contentStyle={{
              border:
                "1px solid #e5e7eb",
              borderRadius: "10px",
              boxShadow:
                "0 10px 24px rgba(15,23,42,0.08)",
            }}
            formatter={(value, name) => [
              peso(value),
              name === "gross_sales"
                ? "Gross Sales"
                : "Net Sales",
            ]}
          />

          <Bar
            dataKey="gross_sales"
            fill="#f4b400"
            radius={[5, 5, 0, 0]}
            maxBarSize={20}
          />

          <Bar
            dataKey="net_sales"
            fill="#1b2430"
            radius={[5, 5, 0, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SalesBreakdown({
  summary,
  peso,
}) {
  const data = [
    {
      name: "Net Sales",
      value: Math.max(
        Number(summary.net_sales || 0),
        0
      ),
      color: "#f4b400",
    },
    {
      name: "Supplier Cost",
      value: Math.max(
        Number(summary.supplier_cost || 0),
        0
      ),
      color: "#1b2430",
    },
    {
      name: "Operating Expenses",
      value: Math.max(
        Number(summary.operating_expenses || 0),
        0
      ),
      color: "#e5e7eb",
    },
  ];

  const total = data.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const chartData =
    total > 0
      ? data
      : [
          {
            name: "No Data",
            value: 1,
            color: "#eef1f4",
          },
        ];

  return (
    <div className="dashboard-breakdown-layout">
      <div className="dashboard-donut-wrap">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="88%"
              paddingAngle={0}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="dashboard-donut-center">
          <strong>
            {peso(summary.gross_sales)}
          </strong>
          <span>Total Sales</span>
        </div>
      </div>

      <div className="dashboard-breakdown-list">
        {data.map((item) => {
          const percentage =
            total > 0
              ? (item.value / total) * 100
              : 0;

          return (
            <div
              className="dashboard-breakdown-row"
              key={item.name}
            >
              <div>
                <i
                  className="breakdown-dot"
                  style={{
                    background: item.color,
                  }}
                />
                <span>{item.name}</span>
              </div>

              <strong>{peso(item.value)}</strong>

              <small>
                {percentage.toFixed(1)}%
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopSuppliers({
  items = [],
  peso,
}) {
  const topItems = [...items]
    .sort(
      (a, b) =>
        Number(
          b.remittance_amount || 0
        ) -
        Number(
          a.remittance_amount || 0
        )
    )
    .slice(0, 5);

  const highest = Math.max(
    ...topItems.map((item) =>
      Number(item.remittance_amount || 0)
    ),
    0
  );

  if (topItems.length === 0) {
    return (
      <div className="dashboard-empty-state">
        No supplier remittance records for the selected period.
      </div>
    );
  }

  return (
    <div className="dashboard-supplier-list">
      {topItems.map((item, index) => {
        const amount = Number(
          item.remittance_amount || 0
        );

        const width =
          highest > 0
            ? Math.max(
                (amount / highest) * 100,
                6
              )
            : 0;

        return (
          <div
            className="dashboard-supplier-row"
            key={
              item.vendor_id ||
              item.vendor_name ||
              index
            }
          >
            <div className="dashboard-supplier-name">
              <strong>
                {item.vendor_name ||
                  "Unknown Supplier"}
              </strong>
              <span>{peso(amount)}</span>
            </div>

            <div className="dashboard-progress-track">
              <div
                className="dashboard-progress-fill"
                style={{
                  width: `${width}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BestSellingProducts({
  items = [],
  peso,
}) {
  const topItems = [...items]
    .sort(
      (a, b) =>
        Number(b.total_sold || 0) -
        Number(a.total_sold || 0)
    )
    .slice(0, 5);

  if (topItems.length === 0) {
    return (
      <div className="dashboard-empty-state">
        No product sales records for the selected period.
      </div>
    );
  }

  return (
    <div className="dashboard-product-list">
      {topItems.map((item, index) => (
        <div
          className="dashboard-product-row"
          key={
            item.product_id ||
            item.product_name ||
            index
          }
        >
          <span className="dashboard-product-rank">
            {index + 1}
          </span>

          <div className="dashboard-product-info">
            <strong>
              {item.product_name ||
                "Unknown Product"}
            </strong>
            <span>
              {Number(
                item.total_sold || 0
              ).toLocaleString("en-PH")}{" "}
              sold
            </span>
          </div>

          <strong className="dashboard-product-sales">
            {peso(item.total_sales)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function RecentTransactions({
  items = [],
  peso,
}) {
  if (items.length === 0) {
    return (
      <div className="dashboard-empty-state">
        No recent sales or deliveries available.
      </div>
    );
  }

  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-transactions-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Reference</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={`${item.type}-${item.id}`}>
              <td>
                {formatCompactDate(
                  item.rawDate
                )}
              </td>

              <td>{item.type}</td>

              <td>{item.reference}</td>

              <td>{item.description}</td>

              <td>
                {item.amount > 0
                  ? peso(item.amount)
                  : "—"}
              </td>

              <td>
                <span
                  className={`dashboard-status-badge ${getStatusClass(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getStatusClass(status) {
  const normalized = String(
    status || ""
  ).toLowerCase();

  if (
    normalized.includes("complete") ||
    normalized.includes("deliver") ||
    normalized.includes("paid") ||
    normalized.includes("receive")
  ) {
    return "is-success";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("await") ||
    normalized.includes("transit")
  ) {
    return "is-pending";
  }

  if (
    normalized.includes("reject") ||
    normalized.includes("cancel")
  ) {
    return "is-danger";
  }

  return "is-neutral";
}

function safeDateValue(value) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(
    String(value).replace(" ", "T")
  );

  return Number.isNaN(parsed.getTime())
    ? 0
    : parsed.getTime();
}

function formatCompactDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const parsedDate = new Date(
    String(dateValue).replace(" ", "T")
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return String(dateValue);
  }

  return parsedDate.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateInput(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default Dashboard;