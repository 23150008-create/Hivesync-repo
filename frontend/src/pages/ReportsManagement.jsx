import { useEffect, useMemo, useState } from "react";
import {
  ArchiveRestore,
  Boxes,
  CreditCard,
  HandCoins,
  ReceiptText,
  Package,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";

import bacnotanLogo from "../assets/Bacnotan Logo.png";
import API_BASE from "../config/api";
import "../styles/report.css";

const REPORT_API =
  `${API_BASE}/report_generation/get_reports.php`;

const ADD_EXPENSE_API =
  `${API_BASE}/expense_management/add_expense.php`;


const COMPREHENSIVE_COLUMN_PRIORITY = {
  sales: [
    "transaction_code",
    "sale_number",
    "transaction_date",
    "created_at",
    "customer_name",
    "cashier_name",
    "prepared_by",
    "total_items",
    "product_lines",
    "subtotal_amount",
    "discount",
    "refunded_amount",
    "net_amount",
    "total_amount",
    "transaction_status",
    "status",
  ],
  inventory: [
    "product_name",
    "sku",
    "category_name",
    "category",
    "vendor_name",
    "supplier_name",
    "quantity",
    "unit_type",
    "unit",
    "reorder_level",
    "supplier_price",
    "selling_price",
    "nearest_expiry_date",
    "expiry_date",
    "stock_status",
    "status",
  ],
  delivery: [
    "delivery_order_no",
    "delivery_id",
    "vendor_name",
    "supplier_name",
    "delivery_date",
    "items_count",
    "product_lines",
    "total_quantity",
    "total_amount",
    "amount",
    "delivery_type",
    "status",
    "delivery_status",
    "received_by",
    "created_by_name",
  ],
  supplier: [
    "vendor_name",
    "supplier_name",
    "contact_person",
    "phone",
    "contact_number",
    "product_count",
    "delivered_value",
    "outstanding_balance",
    "ready_for_payment",
    "status",
  ],
  consignment: [
    "product_name",
    "vendor_name",
    "supplier_name",
    "consignment_start_date",
    "start_date",
    "consignment_pullout_date",
    "pullout_date",
    "delivered_quantity",
    "sold_quantity",
    "remaining_quantity",
    "amount_payable",
    "status",
    "consignment_status",
  ],
  receivables: [
    "reference_no",
    "transaction_code",
    "customer_name",
    "original_amount",
    "amount_paid",
    "remaining_balance",
    "due_date",
    "payment_status",
    "status",
    "recorded_by_name",
  ],
  remittance: [
    "payment_reference",
    "reference_no",
    "vendor_name",
    "supplier_name",
    "payment_date",
    "created_at",
    "amount_paid",
    "payment_method",
    "covered_deliveries",
    "remaining_balance",
    "processed_by_name",
    "recorded_by_name",
  ],
  expense: [
    "expense_no",
    "expense_date",
    "expense_category",
    "material_name",
    "quantity",
    "unit",
    "unit_cost",
    "total_cost",
    "recorded_by_name",
    "remarks",
    "status",
  ],
};

const BEST_SELLER_COLUMN_PRIORITY = [
  "product_name",
  "sku",
  "category_name",
  "category",
  "total_sold",
  "quantity_sold",
  "total_sales",
  "sales_amount",
];

function ReportsManagement({ user }) {
  const [activeReportsTab, setActiveReportsTab] = useState("reports");
  const [reportType, setReportType] = useState("sales");
  const [period, setPeriod] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [suppliers, setSuppliers] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  const [summary, setSummary] = useState({});
  const [records, setRecords] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [allReports, setAllReports] = useState({});
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [expenseForm, setExpenseForm] = useState({
    expense_category: "Packaging",
    material_name: "",
    quantity: "1",
    unit: "piece",
    unit_cost: "",
    expense_date: new Date().toISOString().slice(0, 10),
    remarks: "",
    reference_code: "",
    reference_description: "",
  });

  const peso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const integer = (value) =>
    Number(value || 0).toLocaleString("en-PH");

  const formatDateTime = (value) => {
    if (!value) return "Not recorded";

    const parsed = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }

    return parsed.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const reportConfig = useMemo(
    () => ({
      all: {
        title: "Comprehensive Business Report",
        label: "All Reports / Comprehensive",
        icon: <Boxes size={17} />,
      },
      sales: {
        title: "Sales / POS Report",
        label: "Sales / POS",
        icon: <ShoppingCart size={17} />,
      },
      inventory: {
        title: "Inventory Report",
        label: "Inventory",
        icon: <Package size={17} />,
      },
      delivery: {
        title: "Delivery Report",
        label: "Delivery",
        icon: <Truck size={17} />,
      },
      supplier: {
        title: "Supplier Report",
        label: "Supplier",
        icon: <Users size={17} />,
      },
      consignment: {
        title: "Consignment Report",
        label: "Consignment",
        icon: <ArchiveRestore size={17} />,
      },
      receivables: {
        title: "Receivables Report",
        label: "Receivables",
        icon: <CreditCard size={17} />,
      },
      remittance: {
        title: "Remittance / Payment Report",
        label: "Remittance / Payments",
        icon: <HandCoins size={17} />,
      },
      expense: {
        title: "Expense Report",
        label: "Expenses",
        icon: <ReceiptText size={17} />,
      },
    }),
    []
  );

  const periodLabels = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Annual",
    custom: "Custom Date Range",
  };

  const currentConfig =
    reportConfig[reportType] || reportConfig.sales;

  const supplierFilterReportTypes = [
    "all",
    "delivery",
    "supplier",
    "consignment",
    "remittance",
  ];

  const showSupplierFilter =
    supplierFilterReportTypes.includes(reportType);

  const selectedSupplier = suppliers.find(
    (supplier) =>
      String(supplier.vendor_id) ===
      String(selectedVendorId)
  );

  const selectedSupplierName =
    selectedVendorId && selectedSupplier
      ? selectedSupplier.vendor_name
      : "All Suppliers";

  useEffect(() => {
    let cancelled = false;

    const loadSuppliers = async () => {
      try {
        setSuppliersLoading(true);

        const response = await fetch(
          `${REPORT_API}?action=list_suppliers&t=${Date.now()}`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Failed to load suppliers."
          );
        }

        if (!cancelled) {
          setSuppliers(
            Array.isArray(data.suppliers)
              ? data.suppliers
              : []
          );
        }
      } catch (error) {
        console.error(
          "Supplier filter load error:",
          error
        );

        if (!cancelled) {
          setSuppliers([]);
        }
      } finally {
        if (!cancelled) {
          setSuppliersLoading(false);
        }
      }
    };

    loadSuppliers();

    return () => {
      cancelled = true;
    };
  }, []);

  const getPeriodLabel = () => {
    if (period === "custom") {
      return startDate && endDate
        ? `${startDate} to ${endDate}`
        : "Custom Date Range";
    }

    return periodLabels[period] || "Daily";
  };

  const resetReportData = () => {
    setSummary({});
    setRecords([]);
    setBestSellers([]);
    setGeneratedAt("");
    setAllReports({});
    setReportReady(false);
  };

  const loadReport = async ({
    selectedPeriod = period,
    shouldPrint = false,
  } = {}) => {
    if (
      selectedPeriod === "custom" &&
      (!startDate || !endDate)
    ) {
      window.alert(
        "Please select both the start date and end date."
      );
      return;
    }

    if (
      selectedPeriod === "custom" &&
      startDate > endDate
    ) {
      window.alert(
        "Start date cannot be later than end date."
      );
      return;
    }

    try {
      setLoading(true);

      if (reportType === "all") {
        const types = [
          "sales",
          "inventory",
          "delivery",
          "supplier",
          "consignment",
          "receivables",
          "remittance",
          "expense",
        ];

        const results = await Promise.all(
          types.map(async (type) => {
            const allParams = new URLSearchParams({
              report_type: type,
              period: selectedPeriod,
              t: Date.now().toString(),
            });

            if (selectedPeriod === "custom") {
              allParams.set("start_date", startDate);
              allParams.set("end_date", endDate);
            }

            if (
              ["inventory", "delivery", "supplier", "consignment", "remittance"].includes(type) &&
              selectedVendorId
            ) {
              allParams.set("vendor_id", selectedVendorId);
            }

            const res = await fetch(`${REPORT_API}?${allParams.toString()}`, {
              cache: "no-store",
              credentials: "include",
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
              throw new Error(json.message || `Failed to load ${type} report.`);
            }
            return [type, json];
          })
        );

        setAllReports(Object.fromEntries(results));
        setGeneratedAt(new Date().toLocaleString("en-PH"));
        setPeriod(selectedPeriod);
        setReportReady(true);

        if (shouldPrint) {
          window.setTimeout(() => window.print(), 350);
        }
        return;
      }

      const params = new URLSearchParams({
        report_type: reportType,
        period: selectedPeriod,
        t: Date.now().toString(),
      });

      if (selectedPeriod === "custom") {
        params.set("start_date", startDate);
        params.set("end_date", endDate);
      }

      if (
        showSupplierFilter &&
        selectedVendorId
      ) {
        params.set(
          "vendor_id",
          selectedVendorId
        );
      }

      const response = await fetch(
        `${REPORT_API}?${params.toString()}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load report."
        );
      }

      setSummary(data.summary || {});

      setRecords(
        Array.isArray(data.records)
          ? data.records
          : []
      );

      setBestSellers(
        Array.isArray(data.best_sellers)
          ? data.best_sellers
          : []
      );

      setGeneratedAt(
        data.generated_at ||
          new Date().toLocaleString("en-PH")
      );

      setPeriod(selectedPeriod);
      setReportReady(true);

      if (shouldPrint) {
        window.setTimeout(() => {
          window.print();
        }, 350);
      }
    } catch (error) {
      console.error("Reports error:", error);

      window.alert(
        error.message ||
          "Unable to connect to the report backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const expenseTotal =
    Number(expenseForm.quantity || 0) *
    Number(expenseForm.unit_cost || 0);

  const updateExpenseField = (field, value) => {
    setExpenseForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      expense_category: "Packaging",
      material_name: "",
      quantity: "1",
      unit: "piece",
      unit_cost: "",
      expense_date: new Date().toISOString().slice(0, 10),
      remarks: "",
      reference_code: "",
      reference_description: "",
    });
  };

  const handleRecordExpense = async (event) => {
    event.preventDefault();

    if (!expenseForm.material_name.trim()) {
      window.alert("Please enter the expense or material name.");
      return;
    }

    if (Number(expenseForm.quantity) <= 0) {
      window.alert("Quantity must be greater than zero.");
      return;
    }

    if (
      expenseForm.unit_cost === "" ||
      Number(expenseForm.unit_cost) < 0
    ) {
      window.alert("Please enter a valid unit cost.");
      return;
    }

    if (!expenseForm.expense_date) {
      window.alert("Please select the expense date.");
      return;
    }

    try {
      setExpenseSaving(true);

      const response = await fetch(ADD_EXPENSE_API, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...expenseForm,
          recorded_by:
            user?.user_id ??
            user?.id ??
            null,
          recorded_by_name:
            user?.full_name ||
            user?.name ||
            user?.user_name ||
            "Unknown User",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to record the expense."
        );
      }

      window.alert(
        `${data.message}\nExpense No.: ${
          data.expense?.expense_no || "Generated"
        }`
      );

      setExpenseModalOpen(false);
      resetExpenseForm();

      if (activeReportsTab === "expenses") {
        await loadExpenseManagementRecords();
      } else if (reportType === "expense") {
        await loadReport({
          selectedPeriod: period,
          shouldPrint: false,
        });
      } else {
        setReportReady(false);
      }
    } catch (error) {
      console.error("Record expense error:", error);
      window.alert(
        error.message ||
          "Unable to connect to the expense backend."
      );
    } finally {
      setExpenseSaving(false);
    }
  };

  const loadExpenseManagementRecords = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        report_type: "expense",
        period: "custom",
        start_date: "2000-01-01",
        end_date: "2099-12-31",
        t: Date.now().toString(),
      });

      const response = await fetch(
        `${REPORT_API}?${params.toString()}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to load expense records."
        );
      }

      setSummary(data.summary || {});
      setRecords(
        Array.isArray(data.records)
          ? data.records
          : []
      );
    } catch (error) {
      console.error(
        "Expense records load error:",
        error
      );

      window.alert(
        error.message ||
          "Unable to load expense records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeReportsTab !== "expenses") {
      return;
    }

    loadExpenseManagementRecords();
  }, [activeReportsTab]);

  const expenseCategories = useMemo(() => {
    const defaults = [
      "Packaging",
      "Printing",
      "Office Supplies",
      "Cleaning Supplies",
      "Utilities",
      "Transportation",
      "Maintenance",
      "Marketing",
      "Miscellaneous",
      "Other",
    ];

    const fromRecords = records
      .map((item) => item.expense_category)
      .filter(Boolean);

    return Array.from(
      new Set([...defaults, ...fromRecords])
    );
  }, [records]);

  const filteredExpenseRecords = useMemo(() => {
    const query = expenseSearch.trim().toLowerCase();

    return records.filter((item) => {
      const matchesCategory =
        expenseCategoryFilter === "all" ||
        item.expense_category === expenseCategoryFilter;

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.expense_no,
        item.expense_category,
        item.material_name,
        item.reference_code,
        item.reference_description,
        item.recorded_by_name,
        item.remarks,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        );
    });
  }, [
    records,
    expenseSearch,
    expenseCategoryFilter,
  ]);

  const expenseCategoryAmount = (category) =>
    records
      .filter(
        (item) => item.expense_category === category
      )
      .reduce(
        (total, item) =>
          total + Number(item.total_cost || 0),
        0
      );

  const SummaryBox = ({
    label,
    value,
    tone = "",
  }) => (
    <div
      className={`simple-report-summary-box ${tone}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );

  const renderSummary = () => {
    if (reportType === "sales") {
      return (
        <div className="simple-report-summary four">
          <SummaryBox
            label="Transactions"
            value={integer(
              summary.total_transactions
            )}
          />

          <SummaryBox
            label="Recorded Sales"
            value={peso(
              summary.recorded_sales ??
                summary.total_sales
            )}
          />

          <SummaryBox
            label="Refunded"
            value={peso(
              summary.total_refunded
            )}
            tone="warning"
          />

          <SummaryBox
            label="Net Sales"
            value={peso(summary.net_sales)}
            tone="success"
          />
        </div>
      );
    }

    if (reportType === "inventory") {
      return (
        <div className="simple-report-summary four">
          <SummaryBox
            label="Total Products"
            value={integer(
              summary.total_products
            )}
          />

          <SummaryBox
            label="Inventory Value"
            value={peso(
              summary.inventory_value
            )}
          />

          <SummaryBox
            label="Low Stock"
            value={integer(summary.low_stock)}
            tone="warning"
          />

          <SummaryBox
            label="Out of Stock"
            value={integer(
              summary.out_of_stock
            )}
            tone="danger"
          />
        </div>
      );
    }

    if (reportType === "delivery") {
      return (
        <div className="simple-report-summary four">
          <SummaryBox
            label="Total Deliveries"
            value={integer(
              summary.total_deliveries
            )}
          />

          <SummaryBox
            label="Delivered Value"
            value={peso(
              summary.total_amount ??
                summary.total_delivery_value
            )}
          />

          <SummaryBox
            label="Pending"
            value={integer(summary.pending)}
            tone="warning"
          />

          <SummaryBox
            label="Delivered"
            value={integer(summary.delivered)}
            tone="success"
          />
        </div>
      );
    }

    if (reportType === "supplier") {
      return (
        <div className="simple-report-summary four">
          <SummaryBox
            label="Total Suppliers"
            value={integer(
              summary.total_suppliers
            )}
          />

          <SummaryBox
            label="Active Suppliers"
            value={integer(summary.active)}
            tone="success"
          />

          <SummaryBox
            label="Outstanding Balance"
            value={peso(
              summary.outstanding_balance
            )}
            tone="warning"
          />

          <SummaryBox
            label="Ready for Payment"
            value={peso(
              summary.ready_for_payment
            )}
          />
        </div>
      );
    }

    if (reportType === "consignment") {
      return (
        <div className="simple-report-summary four">
          <SummaryBox
            label="Consignment Records"
            value={integer(
              summary.total_consignments
            )}
          />

          <SummaryBox
            label="Delivered Quantity"
            value={integer(
              summary.delivered_quantity
            )}
          />

          <SummaryBox
            label="Sold Quantity"
            value={integer(
              summary.sold_quantity
            )}
            tone="success"
          />

          <SummaryBox
            label="Amount Payable"
            value={peso(
              summary.amount_payable
            )}
          />
        </div>
      );
    }

    if (reportType === "receivables") {
      return (
        <div className="simple-report-summary four">
          <SummaryBox
            label="Receivable Records"
            value={integer(
              summary.total_receivables
            )}
          />

          <SummaryBox
            label="Original Amount"
            value={peso(
              summary.original_amount
            )}
          />

          <SummaryBox
            label="Amount Paid"
            value={peso(
              summary.amount_paid
            )}
            tone="success"
          />

          <SummaryBox
            label="Outstanding Balance"
            value={peso(
              summary.outstanding_balance
            )}
            tone="warning"
          />
        </div>
      );
    }

    if (reportType === "remittance") {
      return (
        <div className="simple-report-summary four">
          <SummaryBox
            label="Payment Records"
            value={integer(
              summary.total_payments
            )}
          />

          <SummaryBox
            label="Total Paid"
            value={peso(summary.total_paid)}
            tone="success"
          />

          <SummaryBox
            label="Covered Deliveries"
            value={integer(
              summary.covered_deliveries
            )}
          />

          <SummaryBox
            label="Remaining Balance"
            value={peso(
              summary.remaining_balance
            )}
            tone="warning"
          />
        </div>
      );
    }

    if (reportType === "expense") {
      return (
        <div className="simple-report-summary four">
          <SummaryBox
            label="Expense Records"
            value={integer(summary.total_expenses)}
          />
          <SummaryBox
            label="Total Expenses"
            value={peso(summary.total_amount)}
            tone="warning"
          />
          <SummaryBox
            label="Total Quantity"
            value={integer(summary.total_quantity)}
          />
          <SummaryBox
            label="Categories Used"
            value={integer(summary.categories_used)}
          />
        </div>
      );
    }

    return (
      <div className="simple-report-summary four">
        <SummaryBox
          label="Total Logs"
          value={integer(summary.total_logs)}
        />

        <SummaryBox
          label="Users Involved"
          value={integer(
            summary.users_involved
          )}
        />

        <SummaryBox
          label="Modules Involved"
          value={integer(
            summary.modules_involved
          )}
        />

        <SummaryBox
          label="Actions Recorded"
          value={integer(
            summary.actions_recorded ??
              summary.total_logs
          )}
        />
      </div>
    );
  };

  const EmptyRow = ({ colSpan, text }) => (
    <tr>
      <td
        colSpan={colSpan}
        className="simple-report-empty"
      >
        {text}
      </td>
    </tr>
  );

  const renderTable = () => {
    if (reportType === "sales") {
      return (
        <>
          <h3>Sales Transactions</h3>

          <div className="simple-report-table-wrap">
            <table className="simple-report-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Date & Time</th>
                  <th>Customer</th>
                  <th>Cashier</th>
                  <th>Items</th>
                  <th>Subtotal</th>
                  <th>Discount</th>
                  <th>Refunded</th>
                  <th>Net Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <EmptyRow
                    colSpan={10}
                    text="No sales records found."
                  />
                ) : (
                  records.map((item, index) => (
                    <tr
                      key={
                        item.pos_id ||
                        item.transaction_code ||
                        index
                      }
                    >
                      <td>
                        {item.transaction_code ||
                          item.sale_number ||
                          "N/A"}
                      </td>

                      <td>
                        {formatDateTime(
                          item.transaction_date ||
                            item.created_at
                        )}
                      </td>

                      <td>
                        {item.customer_name ||
                          "WALK IN CLIENT"}
                      </td>

                      <td>
                        {item.cashier_name ||
                          item.prepared_by ||
                          "Unknown"}
                      </td>

                      <td>
                        {integer(
                          item.total_items ??
                            item.product_lines
                        )}
                      </td>

                      <td>
                        {peso(
                          item.subtotal_amount
                        )}
                      </td>

                      <td>
                        {peso(item.discount)}
                      </td>

                      <td>
                        {peso(
                          item.refunded_amount
                        )}
                      </td>

                      <td>
                        {peso(
                          item.net_amount ??
                            item.total_amount
                        )}
                      </td>

                      <td>
                        {item.transaction_status ||
                          item.status ||
                          "Completed"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3>Best-Selling Products</h3>

          <div className="simple-report-table-wrap">
            <table className="simple-report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Quantity Sold</th>
                  <th>Sales Amount</th>
                </tr>
              </thead>

              <tbody>
                {bestSellers.length === 0 ? (
                  <EmptyRow
                    colSpan={5}
                    text="No best-selling products found."
                  />
                ) : (
                  bestSellers.map((item, index) => (
                    <tr
                      key={
                        item.product_id || index
                      }
                    >
                      <td>{item.product_name}</td>

                      <td>{item.sku || "N/A"}</td>

                      <td>
                        {item.category_name ||
                          "Uncategorized"}
                      </td>

                      <td>
                        {integer(item.total_sold)}
                      </td>

                      <td>
                        {peso(item.total_sales)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (reportType === "inventory") {
      return (
        <>
          <h3>Inventory Stock Records</h3>

          <div className="simple-report-table-wrap">
            <table className="simple-report-table compact">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Supplier</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Supplier Price</th>
                  <th>Selling Price</th>
                  <th>Nearest Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <EmptyRow
                    colSpan={10}
                    text="No inventory records found."
                  />
                ) : (
                  records.map((item, index) => (
                    <tr
                      key={
                        item.product_id || index
                      }
                    >
                      <td>{item.product_name}</td>

                      <td>{item.sku || "N/A"}</td>

                      <td>
                        {item.category_name ||
                          item.category ||
                          "Uncategorized"}
                      </td>

                      <td>
                        {item.vendor_name ||
                          item.supplier_name ||
                          "No supplier"}
                      </td>

                      <td>
                        {integer(item.quantity)}{" "}
                        {item.unit_type ||
                          item.unit ||
                          "pcs"}
                      </td>

                      <td>
                        {integer(
                          item.reorder_level
                        )}
                      </td>

                      <td>
                        {peso(
                          item.supplier_price
                        )}
                      </td>

                      <td>
                        {peso(
                          item.selling_price
                        )}
                      </td>

                      <td>
                        {item.nearest_expiry_date ||
                          item.expiry_date ||
                          "No expiry"}
                      </td>

                      <td>
                        {item.stock_status ||
                          item.status ||
                          "N/A"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (reportType === "delivery") {
      return (
        <>
          <h3>Delivery Records</h3>

          <div className="simple-report-table-wrap">
            <table className="simple-report-table">
              <thead>
                <tr>
                  <th>Delivery Order</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Product Lines</th>
                  <th>Total Quantity</th>
                  <th>Total Cost</th>
                  <th>Delivery Type</th>
                  <th>Status</th>
                  <th>Received By</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <EmptyRow
                    colSpan={9}
                    text="No delivery records found."
                  />
                ) : (
                  records.map((item, index) => (
                    <tr
                      key={
                        item.delivery_id || index
                      }
                    >
                      <td>
                        {item.delivery_order_no ||
                          item.delivery_id}
                      </td>

                      <td>
                        {item.vendor_name ||
                          item.supplier_name ||
                          "Unknown Supplier"}
                      </td>

                      <td>
                        {item.delivery_date ||
                          "Not recorded"}
                      </td>

                      <td>
                        {integer(
                          item.items_count ??
                            item.product_lines
                        )}
                      </td>

                      <td>
                        {integer(
                          item.total_quantity
                        )}
                      </td>

                      <td>
                        {peso(
                          item.total_amount ??
                            item.amount
                        )}
                      </td>

                      <td>
                        {item.delivery_type ||
                          "Regular"}
                      </td>

                      <td>
                        {item.status ||
                          item.delivery_status ||
                          "N/A"}
                      </td>

                      <td>
                        {item.received_by ||
                          item.created_by_name ||
                          "Not recorded"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (reportType === "supplier") {
      return (
        <>
          <h3>Supplier Records</h3>

          <div className="simple-report-table-wrap">
            <table className="simple-report-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact Person</th>
                  <th>Contact Number</th>
                  <th>Products</th>
                  <th>Delivered Value</th>
                  <th>Outstanding Balance</th>
                  <th>Ready for Payment</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <EmptyRow
                    colSpan={8}
                    text="No supplier records found."
                  />
                ) : (
                  records.map((item, index) => (
                    <tr
                      key={
                        item.vendor_id || index
                      }
                    >
                      <td>
                        {item.vendor_name ||
                          item.supplier_name}
                      </td>

                      <td>
                        {item.contact_person ||
                          "Not specified"}
                      </td>

                      <td>
                        {item.phone ||
                          item.contact_number ||
                          "Not specified"}
                      </td>

                      <td>
                        {integer(
                          item.product_count
                        )}
                      </td>

                      <td>
                        {peso(
                          item.delivered_value
                        )}
                      </td>

                      <td>
                        {peso(
                          item.outstanding_balance
                        )}
                      </td>

                      <td>
                        {peso(
                          item.ready_for_payment
                        )}
                      </td>

                      <td>
                        {item.status || "Active"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (reportType === "consignment") {
      return (
        <>
          <h3>Consignment Records</h3>

          <div className="simple-report-table-wrap">
            <table className="simple-report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Supplier</th>
                  <th>Start Date</th>
                  <th>Pull-Out Date</th>
                  <th>Delivered Qty</th>
                  <th>Sold Qty</th>
                  <th>Remaining Qty</th>
                  <th>Amount Payable</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <EmptyRow
                    colSpan={9}
                    text="No consignment records found."
                  />
                ) : (
                  records.map((item, index) => (
                    <tr
                      key={
                        item.consignment_id ||
                        item.product_id ||
                        index
                      }
                    >
                      <td>{item.product_name}</td>

                      <td>
                        {item.vendor_name ||
                          item.supplier_name}
                      </td>

                      <td>
                        {item.consignment_start_date ||
                          item.start_date ||
                          "Not specified"}
                      </td>

                      <td>
                        {item.consignment_pullout_date ||
                          item.pullout_date ||
                          "Not specified"}
                      </td>

                      <td>
                        {integer(
                          item.delivered_quantity
                        )}
                      </td>

                      <td>
                        {integer(
                          item.sold_quantity
                        )}
                      </td>

                      <td>
                        {integer(
                          item.remaining_quantity
                        )}
                      </td>

                      <td>
                        {peso(
                          item.amount_payable
                        )}
                      </td>

                      <td>
                        {item.status ||
                          item.consignment_status ||
                          "Active"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (reportType === "receivables") {
      return (
        <>
          <h3>Receivable Records</h3>

          <div className="simple-report-table-wrap">
            <table className="simple-report-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Original Amount</th>
                  <th>Amount Paid</th>
                  <th>Remaining Balance</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Recorded By</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <EmptyRow
                    colSpan={8}
                    text="No receivable records found."
                  />
                ) : (
                  records.map((item, index) => (
                    <tr
                      key={
                        item.receivable_id ||
                        item.reference_no ||
                        index
                      }
                    >
                      <td>
                        {item.reference_no ||
                          item.transaction_code ||
                          "N/A"}
                      </td>

                      <td>
                        {item.customer_name ||
                          "Not specified"}
                      </td>

                      <td>
                        {peso(
                          item.original_amount
                        )}
                      </td>

                      <td>
                        {peso(item.amount_paid)}
                      </td>

                      <td>
                        {peso(
                          item.remaining_balance
                        )}
                      </td>

                      <td>
                        {item.due_date ||
                          "Not specified"}
                      </td>

                      <td>
                        {item.payment_status ||
                          item.status ||
                          "Pending"}
                      </td>

                      <td>
                        {item.recorded_by_name ||
                          "Unknown User"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (reportType === "remittance") {
      return (
        <>
          <h3>
            Supplier Remittance and Payment Records
          </h3>

          <div className="simple-report-table-wrap">
            <table className="simple-report-table">
              <thead>
                <tr>
                  <th>Payment Reference</th>
                  <th>Supplier</th>
                  <th>Payment Date</th>
                  <th>Amount Paid</th>
                  <th>Payment Method</th>
                  <th>Covered Deliveries</th>
                  <th>Remaining Balance</th>
                  <th>Processed By</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <EmptyRow
                    colSpan={8}
                    text="No remittance or payment records found."
                  />
                ) : (
                  records.map((item, index) => (
                    <tr
                      key={
                        item.payment_id ||
                        item.payment_reference ||
                        index
                      }
                    >
                      <td>
                        {item.payment_reference ||
                          item.reference_no ||
                          "N/A"}
                      </td>

                      <td>
                        {item.vendor_name ||
                          item.supplier_name}
                      </td>

                      <td>
                        {item.payment_date ||
                          item.created_at ||
                          "Not recorded"}
                      </td>

                      <td>
                        {peso(
                          item.amount_paid
                        )}
                      </td>

                      <td>
                        {item.payment_method ||
                          "Not specified"}
                      </td>

                      <td>
                        {integer(
                          item.covered_deliveries
                        )}
                      </td>

                      <td>
                        {peso(
                          item.remaining_balance
                        )}
                      </td>

                      <td>
                        {item.processed_by_name ||
                          item.recorded_by_name ||
                          "Unknown User"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (reportType === "expense") {
      return (
        <>
          <h3>Expense Records</h3>

          <div className="simple-report-table-wrap">
            <table className="simple-report-table">
              <thead>
                <tr>
                  <th>Expense No.</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Expense / Material</th>
                  <th>Quantity</th>
                  <th>Unit Cost</th>
                  <th>Total Cost</th>
                  <th>Recorded By</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <EmptyRow
                    colSpan={9}
                    text="No expense records found."
                  />
                ) : (
                  records.map((item, index) => (
                    <tr
                      key={
                        item.expense_id ||
                        item.expense_no ||
                        index
                      }
                    >
                      <td>{item.expense_no || "N/A"}</td>
                      <td>{item.expense_date || "Not recorded"}</td>
                      <td>{item.expense_category || "Other"}</td>
                      <td>{item.material_name || "Not specified"}</td>
                      <td>
                        {Number(item.quantity || 0).toLocaleString("en-PH", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {item.unit || ""}
                      </td>
                      <td>{peso(item.unit_cost)}</td>
                      <td>{peso(item.total_cost)}</td>
                      <td>{item.recorded_by_name || "Unknown User"}</td>
                      <td>{item.remarks || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    return (
      <>
        <h3>Audit Trail Records</h3>

        <div className="simple-report-table-wrap">
          <table className="simple-report-table audit-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Module</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {records.length === 0 ? (
                <EmptyRow
                  colSpan={6}
                  text="No audit records found."
                />
              ) : (
                records.map((item, index) => (
                  <tr
                    key={
                      item.audit_id ||
                      item.log_id ||
                      index
                    }
                  >
                    <td>
                      {formatDateTime(
                        item.created_at
                      )}
                    </td>

                    <td>
                      {item.user_name ||
                        "Unknown User"}
                    </td>

                    <td>
                      {item.role || "N/A"}
                    </td>

                    <td>
                      {item.module || "N/A"}
                    </td>

                    <td>
                      {item.action || "N/A"}
                    </td>

                    <td>{item.details || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const humanizeKey = (key) =>
    String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const formatComprehensiveValue = (key, value) => {
    const normalized = String(key || "").toLowerCase();
    if (value === null || value === undefined || value === "") return "—";
    if (normalized.includes("amount") || normalized.includes("sales") || normalized.includes("payable") || normalized.includes("paid") || normalized.includes("balance") || normalized.includes("value") || normalized.includes("price") || normalized.includes("remittance")) {
      return peso(value);
    }
    return String(value);
  };

  const getComprehensiveColumns = (type, rows) => {
    if (!rows.length) return [];

    const availableColumns = Object.keys(rows[0]);
    const priority = COMPREHENSIVE_COLUMN_PRIORITY[type] || [];

    const selectedColumns = priority.filter((column) =>
      availableColumns.includes(column)
    );

    if (selectedColumns.length > 0) {
      const deduped = [];
      const groups = [
        ["transaction_code", "sale_number"],
        ["transaction_date", "created_at"],
        ["cashier_name", "prepared_by"],
        ["total_items", "product_lines"],
        ["net_amount", "total_amount"],
        ["transaction_status", "status"],
        ["category_name", "category"],
        ["vendor_name", "supplier_name"],
        ["unit_type", "unit"],
        ["nearest_expiry_date", "expiry_date"],
        ["stock_status", "status"],
        ["delivery_order_no", "delivery_id"],
        ["items_count", "product_lines"],
        ["total_amount", "amount"],
        ["status", "delivery_status"],
        ["received_by", "created_by_name"],
        ["phone", "contact_number"],
        ["consignment_start_date", "start_date"],
        ["consignment_pullout_date", "pullout_date"],
        ["status", "consignment_status"],
        ["reference_no", "transaction_code"],
        ["payment_status", "status"],
        ["payment_reference", "reference_no"],
        ["payment_date", "created_at"],
        ["processed_by_name", "recorded_by_name"],
      ];

      const groupedColumns = new Map();
      groups.forEach((group) => {
        group.forEach((column) => groupedColumns.set(column, group));
      });

      selectedColumns.forEach((column) => {
        const group = groupedColumns.get(column);

        if (!group) {
          deduped.push(column);
          return;
        }

        const alreadyIncluded = group.some((item) =>
          deduped.includes(item)
        );

        if (!alreadyIncluded) {
          deduped.push(column);
        }
      });

      return deduped.slice(0, 10);
    }

    return availableColumns.slice(0, 10);
  };

  const getBestSellerColumns = (rows) => {
    if (!rows.length) return [];

    const availableColumns = Object.keys(rows[0]);
    const selectedColumns = BEST_SELLER_COLUMN_PRIORITY.filter(
      (column) => availableColumns.includes(column)
    );

    return selectedColumns.length
      ? selectedColumns.slice(0, 5)
      : availableColumns.slice(0, 5);
  };

  const renderComprehensiveReport = () => {
    const types = [
      "sales",
      "inventory",
      "delivery",
      "supplier",
      "consignment",
      "receivables",
      "remittance",
      "expense",
    ];

    return (
      <div className="comprehensive-report">
        {types.map((type, index) => {
          const data = allReports[type] || {};
          const summaryEntries = Object.entries(data.summary || {});
          const rows = Array.isArray(data.records) ? data.records : [];
          const best = Array.isArray(data.best_sellers) ? data.best_sellers : [];
          const columns = getComprehensiveColumns(type, rows);
          const bestColumns = getBestSellerColumns(best);

          return (
            <>
<section
                className={`comprehensive-section report-type-page ${
                  index > 0 ? "starts-new-report-page" : "first-report-page"
                }`}
                key={type}
              >
              <div className="comprehensive-section-heading">
                <span>Section {index + 1}</span>
                <h2>{reportConfig[type]?.title}</h2>
              </div>

              <h3>Records</h3>

              <div className="simple-report-table-wrap">
                <table
                  className="simple-report-table comprehensive-table"
                  data-columns={columns.length}
                >
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column}>{humanizeKey(column)}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.length ? (
                      rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {columns.map((column) => (
                            <td key={column}>
                              {formatComprehensiveValue(column, row[column])}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          className="simple-report-empty"
                          colSpan={Math.max(columns.length, 1)}
                        >
                          No records found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {best.length > 0 && (
                <>
                  <h3>Best-Selling Products</h3>

                  <div className="simple-report-table-wrap">
                    <table
                      className="simple-report-table comprehensive-table"
                      data-columns={bestColumns.length}
                    >
                      <thead>
                        <tr>
                          {bestColumns.map((column) => (
                            <th key={column}>{humanizeKey(column)}</th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {best.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {bestColumns.map((column) => (
                              <td key={column}>
                                {formatComprehensiveValue(column, row[column])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {summaryEntries.length > 0 && (
                <div className="report-overall-total">
                  {summaryEntries.map(([key, value]) => (
                    <div className="report-total-item" key={key}>
                      <span>{humanizeKey(key)}</span>
                      <strong>{formatComprehensiveValue(key, value)}</strong>
                    </div>
                  ))}
                </div>
              )}
              </section>
            </>
          );
        })}
      </div>
    );
  };

  const handlePrint = () => {
    const source = document.getElementById("printable-report");

    if (!source) {
      window.alert("Generate the report first.");
      return;
    }

    const iframe = document.createElement("iframe");

    iframe.setAttribute("title", "HiveSync Report Print");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "1200px",
      height: "800px",
      border: "0",
      background: "#ffffff",
      zIndex: "-1",
    });

    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const printDocument = iframe.contentDocument || printWindow?.document;

    if (!printWindow || !printDocument) {
      iframe.remove();
      window.alert("Unable to open the print preview.");
      return;
    }
    const sharedStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((node) => node.outerHTML)
      .join("\n");

    const printOnlyStyles = `
      <style>
        @page {
          size: auto;
          margin: 9mm;
        }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
          background: #ffffff !important;
          color: #111827 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        #printable-report {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;

          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;

          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;

          margin: 0 !important;
          padding: 0 !important;

          border: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
          background: #ffffff !important;
        }

        #printable-report * {
          visibility: visible !important;
          opacity: 1 !important;
        }

        #printable-report .report-type-page {
          display: block !important;
          position: static !important;

          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;

          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;

          margin: 0 !important;
          padding: 0 !important;

          border: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;

          break-inside: auto !important;
          page-break-inside: auto !important;
        }
        #printable-report .report-type-page.starts-new-report-page {
          break-before: page !important;
          page-break-before: always !important;
        }

        #printable-report .simple-report-table-wrap,
        #printable-report .simple-report-table,
        #printable-report .comprehensive-table,
        #printable-report tbody {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;

          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        #printable-report thead {
          display: table-header-group !important;
        }

        #printable-report tbody {
          display: table-row-group !important;
        }

        #printable-report tr {
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }

        #printable-report .report-overall-total,
        #printable-report .individual-report-totals {
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }

        #printable-report .comprehensive-section-heading {
          border-top: 0 !important;
        }
        #printable-report .simple-report-table,
        #printable-report .comprehensive-table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
          border: 0 !important;
          border-top: 0.4pt solid #cbd5e1 !important;
          border-left: 0.4pt solid #cbd5e1 !important;
        }

        #printable-report .simple-report-table th,
        #printable-report .simple-report-table td,
        #printable-report .comprehensive-table th,
        #printable-report .comprehensive-table td {
          border: 0 !important;
          border-right: 0.4pt solid #cbd5e1 !important;
          border-bottom: 0.4pt solid #cbd5e1 !important;
        }

        #printable-report .simple-report-table th,
        #printable-report .comprehensive-table th {
          background: #f8fafc !important;
          color: #111827 !important;
          font-weight: 800 !important;
        }

        #printable-report .report-overall-total,
        #printable-report .individual-report-totals .simple-report-summary,
        #printable-report .individual-report-totals .simple-report-summary.four {
          border-top: 0.4pt solid #cbd5e1 !important;
          border-left: 0.4pt solid #cbd5e1 !important;
        }

        #printable-report .report-total-item,
        #printable-report .individual-report-totals .simple-report-summary-box,
        #printable-report .individual-report-totals .simple-report-summary-box.warning,
        #printable-report .individual-report-totals .simple-report-summary-box.success,
        #printable-report .individual-report-totals .simple-report-summary-box.danger {
          border: 0 !important;
          border-right: 0.4pt solid #cbd5e1 !important;
          border-bottom: 0.4pt solid #cbd5e1 !important;
          background: #ffffff !important;
        }

        #printable-report .simple-report-footer {
          border-top: 0.4pt solid #cbd5e1 !important;
        }

        .no-print {
          display: none !important;
        }
      </style>
    `;

    printDocument.open();
    printDocument.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <base href="${document.baseURI}" />
          <title>HiveSync Business Report</title>
          ${sharedStyles}
          ${printOnlyStyles}
        </head>
        <body>
          ${source.outerHTML}
        </body>
      </html>
    `);
    printDocument.close();

    const waitForPrintAssets = async () => {
      const imagePromises = Array.from(printDocument.images).map(
        (image) =>
          new Promise((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }

            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          })
      );

      const stylePromises = Array.from(
        printDocument.querySelectorAll('link[rel="stylesheet"]')
      ).map(
        (link) =>
          new Promise((resolve) => {
            if (link.sheet) {
              resolve();
              return;
            }

            link.addEventListener("load", resolve, { once: true });
            link.addEventListener("error", resolve, { once: true });
          })
      );

      await Promise.all([...imagePromises, ...stylePromises]);

      if (printDocument.fonts?.ready) {
        try {
          await printDocument.fonts.ready;
        } catch {
        }
      }
      await new Promise((resolve) =>
        printWindow.requestAnimationFrame(() =>
          printWindow.requestAnimationFrame(resolve)
        )
      );
    };

    waitForPrintAssets().then(() => {
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        const cleanup = () => {
          window.removeEventListener("focus", cleanup);
          window.setTimeout(() => {
            if (iframe.isConnected) {
              iframe.remove();
            }
          }, 500);
        };

        window.addEventListener("focus", cleanup, { once: true });
      }, 300);
    });
  };

  return (
    <div className="reports-management-page">
      <section className="reports-page-heading no-print">
        <div>

          <h1>Reports Management</h1>

          <p>
            Generate printable operational and financial
            reports using live HiveSync records.
          </p>
        </div>
      </section>

      <section className="reports-inner-tabs no-print">
        <button
          type="button"
          className={activeReportsTab === "reports" ? "active" : ""}
          onClick={() => {
            setActiveReportsTab("reports");
          }}
        >
          Reports
        </button>

        <button
          type="button"
          className={activeReportsTab === "expenses" ? "active" : ""}
          onClick={() => {
            setActiveReportsTab("expenses");
            setSelectedVendorId("");
            setExpenseSearch("");
            setExpenseCategoryFilter("all");
          }}
        >
          Expenses
        </button>
      </section>

      {activeReportsTab === "reports" && (
<section className="simple-report-controls no-print">
          <div className="report-control-field report-type-field">
            <label>Report Type</label>

            <select
              value={reportType}
              onChange={(event) => {
                const nextReportType =
                  event.target.value;

                setReportType(nextReportType);

                if (
                  !supplierFilterReportTypes.includes(
                    nextReportType
                  )
                ) {
                  setSelectedVendorId("");
                }

                resetReportData();
              }}
            >
              {Object.entries(reportConfig).map(
                ([value, config]) => (
                  <option
                    value={value}
                    key={value}
                  >
                    {config.label}
                  </option>
                )
              )}
            </select>
          </div>

          {showSupplierFilter && (
            <div className="report-control-field report-supplier-field">
              <label>Supplier</label>

              <select
                value={selectedVendorId}
                disabled={suppliersLoading}
                onChange={(event) => {
                  setSelectedVendorId(
                    event.target.value
                  );
                  resetReportData();
                }}
              >
                <option value="">
                  {suppliersLoading
                    ? "Loading suppliers..."
                    : "All Suppliers"}
                </option>

                {suppliers.map((supplier) => (
                  <option
                    key={supplier.vendor_id}
                    value={supplier.vendor_id}
                  >
                    {supplier.vendor_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="report-control-field">
            <label>Date Filter</label>

            <select
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
                setReportReady(false);
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Annual</option>
              <option value="custom">
                Custom Date Range
              </option>
            </select>
          </div>

          {period === "custom" && (
            <>
              <div className="report-control-field">
                <label>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setReportReady(false);
                  }}
                />
              </div>

              <div className="report-control-field">
                <label>End Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setReportReady(false);
                  }}
                />
              </div>
            </>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() =>
              loadReport({
                selectedPeriod: period,
                shouldPrint: false,
              })
            }
          >
            <RefreshCw
              size={17}
              className={
                loading ? "report-spin" : ""
              }
            />
            {loading
              ? "Loading..."
              : "Generate Report"}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !reportReady}
            onClick={handlePrint}
          >
            <Printer size={17} />
            Print / Save PDF
          </button>
        </section>
      )}

      {activeReportsTab === "expenses" && (
        <section className="expense-management-panel no-print">
          <div className="expense-management-top">
            <div>
              <h2>Expense Records</h2>
              <p>
                Record and monitor BFATC operating expenses while keeping
                printable expense reports inside Reports Management.
              </p>
            </div>

            <button
              type="button"
              className="expense-record-button"
              onClick={() => setExpenseModalOpen(true)}
            >
              <ReceiptText size={17} />
              Record Expense
            </button>
          </div>

          <div className="expense-management-summary">
            <div className="expense-management-card">
              <span>Total Expenses</span>
              <strong>{peso(summary.total_amount)}</strong>
              <small>{integer(summary.total_expenses)} record(s)</small>
            </div>

            <div className="expense-management-card">
              <span>Packaging</span>
              <strong>{peso(expenseCategoryAmount("Packaging"))}</strong>
              <small>Packaging materials</small>
            </div>

            <div className="expense-management-card">
              <span>Utilities</span>
              <strong>{peso(expenseCategoryAmount("Utilities"))}</strong>
              <small>Electricity, water, and utilities</small>
            </div>

            <div className="expense-management-card">
              <span>Transportation</span>
              <strong>{peso(expenseCategoryAmount("Transportation"))}</strong>
              <small>Fuel and transport costs</small>
            </div>
          </div>

          <div className="expense-management-toolbar">
            <div className="expense-management-search">
              <Search size={17} />
              <input
                type="text"
                value={expenseSearch}
                placeholder="Search expense no., material, reference, or recorded by..."
                onChange={(event) =>
                  setExpenseSearch(event.target.value)
                }
              />
            </div>

            <select
              className="expense-category-filter"
              value={expenseCategoryFilter}
              onChange={(event) =>
                setExpenseCategoryFilter(event.target.value)
              }
            >
              <option value="all">All Categories</option>
              {expenseCategories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="expense-management-table-wrap">
            <table className="expense-management-table">
              <thead>
                <tr>
                  <th>Expense No.</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Expense / Material</th>
                  <th>Quantity</th>
                  <th>Unit Cost</th>
                  <th>Total Cost</th>
                  <th>Recorded By</th>
                  <th>Reference</th>
                </tr>
              </thead>

              <tbody>
                {loading && records.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="expense-management-empty">
                      Loading expense records...
                    </td>
                  </tr>
                ) : filteredExpenseRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="expense-management-empty">
                      No expense records found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredExpenseRecords.map((item, index) => (
                    <tr
                      key={
                        item.expense_id ||
                        item.expense_no ||
                        index
                      }
                    >
                      <td className="expense-no-cell">
                        {item.expense_no || "N/A"}
                      </td>
                      <td>{item.expense_date || "Not recorded"}</td>
                      <td>
                        <span className="expense-category-pill">
                          {item.expense_category || "Other"}
                        </span>
                      </td>
                      <td>{item.material_name || "Not specified"}</td>
                      <td>
                        {Number(item.quantity || 0).toLocaleString("en-PH", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {item.unit || ""}
                      </td>
                      <td>{peso(item.unit_cost)}</td>
                      <td className="expense-total-cell">
                        {peso(item.total_cost)}
                      </td>
                      <td>{item.recorded_by_name || "Unknown User"}</td>
                      <td>{item.reference_code || "N/A"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="expense-management-footer">
            <span>
              Showing {filteredExpenseRecords.length} of {records.length} expense record(s)
            </span>
            <span>
              All active expense records
            </span>
          </div>
        </section>
      )}

      <div
        id="printable-report"
        className={`simple-report-page ${
          activeReportsTab === "expenses"
            ? "expense-print-preview-hidden"
            : ""
        }`}
      >
        <header className="simple-report-header">
          <div className="simple-report-brand">
            <img
              src={bacnotanLogo}
              alt="Bacnotan Logo"
              className="report-logo-img"
            />

            <div>
              <h1>HiveSync Business Report</h1>

              <p>
                Bacnotan Farmers Agri-Tourism Center
                (BFATC), La Union
              </p>
            </div>
          </div>

          <div className="simple-report-meta">
            <div>
              <span>Report</span>
              <strong>{currentConfig.title}</strong>
            </div>

            <div>
              <span>Period</span>
              <strong>{getPeriodLabel()}</strong>
            </div>

            {showSupplierFilter && (
              <div>
                <span>Supplier</span>
                <strong>
                  {selectedSupplierName}
                </strong>
              </div>
            )}

            <div>
              <span>Generated By</span>

              <strong>
                {user?.full_name || "System Admin"}
              </strong>
            </div>

            <div>
              <span>Generated At</span>

              <strong>
                {generatedAt ||
                  "Generate the report to load current data"}
              </strong>
            </div>
          </div>
        </header>

        <div className="simple-report-title">
          <div>
            <span>
              {periodLabels[period] ||
                "Daily"}
            </span>

            <h2>{currentConfig.title}</h2>

            {showSupplierFilter &&
              selectedVendorId && (
                <small className="report-selected-supplier">
                  Supplier: {selectedSupplierName}
                </small>
              )}
          </div>
        </div>

        {!reportReady ? (
          <div className="simple-report-placeholder">
            <Boxes size={38} />

            <strong>
              Select a report type and generate the
              report
            </strong>

            <span>
              The printable report and live records will
              appear here.
            </span>
          </div>
        ) : (
          reportType === "all" ? (
            renderComprehensiveReport()
          ) : (
            <>
              <section className="simple-report-section">
                {renderTable()}
              </section>

              <div className="individual-report-totals">
                {renderSummary()}
              </div>
            </>
          )
        )}

        <footer className="simple-report-footer">
          <span>
            Generated by HiveSync Integrated Business and
            Operations Management System
          </span>

          <strong>
            Bacnotan Farmers Agri-Tourism Center
          </strong>
        </footer>
      </div>
      {expenseModalOpen && (
        <div
          className="expense-modal-backdrop no-print"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !expenseSaving) {
              setExpenseModalOpen(false);
            }
          }}
        >
          <div className="expense-modal-card">
            <div className="expense-modal-header">
              <div>
                <h2>Record Expense</h2>
                <p>
                  Record packaging and other operating expenses used by BFATC.
                </p>
              </div>

              <button
                type="button"
                className="expense-modal-close"
                disabled={expenseSaving}
                onClick={() => setExpenseModalOpen(false)}
                aria-label="Close expense form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRecordExpense}>
              <div className="expense-form-grid">
                <div className="expense-form-field">
                  <label>Expense Date</label>
                  <input
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(event) =>
                      updateExpenseField("expense_date", event.target.value)
                    }
                    required
                  />
                </div>

                <div className="expense-form-field">
                  <label>Category</label>
                  <select
                    value={expenseForm.expense_category}
                    onChange={(event) =>
                      updateExpenseField(
                        "expense_category",
                        event.target.value
                      )
                    }
                    required
                  >
                    <option>Packaging</option>
                    <option>Printing</option>
                    <option>Office Supplies</option>
                    <option>Cleaning Supplies</option>
                    <option>Utilities</option>
                    <option>Transportation</option>
                    <option>Maintenance</option>
                    <option>Marketing</option>
                    <option>Miscellaneous</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="expense-form-field expense-form-wide">
                  <label>Expense / Material Name</label>
                  <input
                    type="text"
                    value={expenseForm.material_name}
                    placeholder="Example: Plastic bags"
                    onChange={(event) =>
                      updateExpenseField("material_name", event.target.value)
                    }
                    required
                  />
                </div>

                <div className="expense-form-field">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={expenseForm.quantity}
                    onChange={(event) =>
                      updateExpenseField("quantity", event.target.value)
                    }
                    required
                  />
                </div>

                <div className="expense-form-field">
                  <label>Unit</label>
                  <input
                    type="text"
                    value={expenseForm.unit}
                    placeholder="piece, pack, roll..."
                    onChange={(event) =>
                      updateExpenseField("unit", event.target.value)
                    }
                    required
                  />
                </div>

                <div className="expense-form-field">
                  <label>Unit Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.unit_cost}
                    placeholder="0.00"
                    onChange={(event) =>
                      updateExpenseField("unit_cost", event.target.value)
                    }
                    required
                  />
                </div>

                <div className="expense-form-field">
                  <label>Total Cost</label>
                  <div className="expense-total-preview">
                    {peso(expenseTotal)}
                  </div>
                </div>

                <div className="expense-form-field">
                  <label>Receipt / Reference No. (Optional)</label>
                  <input
                    type="text"
                    value={expenseForm.reference_code}
                    onChange={(event) =>
                      updateExpenseField("reference_code", event.target.value)
                    }
                  />
                </div>

                <div className="expense-form-field">
                  <label>Reference Description (Optional)</label>
                  <input
                    type="text"
                    value={expenseForm.reference_description}
                    onChange={(event) =>
                      updateExpenseField(
                        "reference_description",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="expense-form-field expense-form-wide">
                  <label>Remarks (Optional)</label>
                  <textarea
                    rows="3"
                    value={expenseForm.remarks}
                    placeholder="Additional expense details..."
                    onChange={(event) =>
                      updateExpenseField("remarks", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="expense-modal-actions">
                <button
                  type="button"
                  className="expense-cancel-button"
                  disabled={expenseSaving}
                  onClick={() => setExpenseModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="expense-save-button"
                  disabled={expenseSaving}
                >
                  {expenseSaving ? "Recording..." : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ReportsManagement;