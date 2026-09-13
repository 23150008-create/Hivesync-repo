import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  WalletCards,
  History,
  X,
  Printer,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
} from "lucide-react";
import bacnotanLogo from "../assets/Bacnotan Logo.png";
import API_BASE from "../config/api";
import "../styles/receivables.css";

const RECEIVABLES_API =
  `${API_BASE}/receivables`;

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.receivables)) return payload.receivables;
  if (Array.isArray(payload?.payments)) return payload.payments;
  return [];
};


const OFFICE_OPTIONS = [
  "Municipal Administrator's Office",
  "Municipal Treasurer's Office",
  "Municipal Accounting Office",
  "Municipal Budget Office",
  "Municipal Assessor's Office",
  "Municipal Engineering Office",
  "Municipal Agriculture Office",
  "Municipal Health Office",
  "Municipal Social Welfare and Development Office",
  "Human Resource Management Office",
  "Business Permits and Licensing Office",
  "Sangguniang Bayan Office",
  "Tourism Office",
  "LTO / External Office",
  "Other",
];

function StatusBadge({ status }) {
  const normalized = String(status || "Unpaid")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <span className={`receivable-status ${normalized}`}>
      {status || "Unpaid"}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="receivable-summary-card">
      <div className="receivable-summary-icon">
        <Icon size={20} />
      </div>

      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
    </article>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="receivable-modal-backdrop" onMouseDown={onClose}>
      <section
        className={`receivable-modal ${wide ? "wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="receivable-modal-header">
          <h2>{title}</h2>

          <button
            type="button"
            className="receivable-icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="receivable-modal-body">{children}</div>
      </section>
    </div>
  );
}


function PaginationBar({
  totalItems,
  currentPage,
  pageSize = 15,
  onPageChange,
  itemLabel = "records",
}) {
  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / pageSize)
  );

  const safePage = Math.min(
    totalPages,
    Math.max(1, currentPage)
  );

  const start =
    totalItems === 0
      ? 0
      : (safePage - 1) * pageSize + 1;

  const end = Math.min(
    safePage * pageSize,
    totalItems
  );

  const pageNumbers = [];

  const addPage = (page) => {
    if (
      page >= 1 &&
      page <= totalPages &&
      !pageNumbers.includes(page)
    ) {
      pageNumbers.push(page);
    }
  };

  addPage(1);

  for (
    let page = safePage - 1;
    page <= safePage + 1;
    page += 1
  ) {
    addPage(page);
  }

  addPage(totalPages);
  pageNumbers.sort((a, b) => a - b);

  const buttonStyle = {
    minWidth: 34,
    height: 34,
    padding: "0 10px",
    border: "1px solid #d8dee8",
    borderRadius: 8,
    background: "#ffffff",
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  };

  const disabledStyle = {
    ...buttonStyle,
    opacity: 0.45,
    cursor: "not-allowed",
  };

  return (
    <div
      style={{
        minHeight: 62,
        padding: "12px 14px",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 14,
        borderTop: "1px solid #e5e7eb",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 11,
        }}
      >
        Showing{" "}
        <strong style={{ color: "#111827" }}>
          {start}
        </strong>
        {" – "}
        <strong style={{ color: "#111827" }}>
          {end}
        </strong>
        {" of "}
        <strong style={{ color: "#111827" }}>
          {totalItems}
        </strong>{" "}
        {itemLabel}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() =>
            onPageChange(
              Math.max(1, safePage - 1)
            )
          }
          style={
            safePage <= 1
              ? disabledStyle
              : buttonStyle
          }
        >
          ‹ Previous
        </button>

        {pageNumbers.map((page, index) => {
          const previous =
            pageNumbers[index - 1];

          const showGap =
            index > 0 &&
            page - previous > 1;

          return (
            <span
              key={`page-${page}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {showGap && (
                <span
                  style={{
                    color: "#94a3b8",
                    fontWeight: 900,
                  }}
                >
                  …
                </span>
              )}

              <button
                type="button"
                onClick={() =>
                  onPageChange(page)
                }
                style={{
                  ...buttonStyle,
                  minWidth: 34,
                  padding: "0 8px",
                  borderColor:
                    page === safePage
                      ? "#f4b400"
                      : "#d8dee8",
                  background:
                    page === safePage
                      ? "#f4b400"
                      : "#ffffff",
                  color: "#111827",
                }}
              >
                {page}
              </button>
            </span>
          );
        })}

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() =>
            onPageChange(
              Math.min(
                totalPages,
                safePage + 1
              )
            )
          }
          style={
            safePage >= totalPages
              ? disabledStyle
              : buttonStyle
          }
        >
          Next ›
        </button>
      </div>

      <div
        style={{
          justifySelf: "end",
          color: "#64748b",
          fontSize: 11,
        }}
      >
        Page{" "}
        <strong style={{ color: "#111827" }}>
          {safePage}
        </strong>
        {" of "}
        <strong style={{ color: "#111827" }}>
          {totalPages}
        </strong>
      </div>
    </div>
  );
}


export default function ReceivablesManagement({ user }) {
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const RECEIVABLE_PAGE_SIZE = 15;
  const [receivablePage, setReceivablePage] = useState(1);

  const [selectedReceivable, setSelectedReceivable] =
    useState(null);
  const [details, setDetails] = useState(null);
  const [payments, setPayments] = useState([]);

  const [showDetails, setShowDetails] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPaymentReceipt, setShowPaymentReceipt] =
    useState(false);
  const [paymentReceipt, setPaymentReceipt] =
    useState(null);
  const [showAddReceivable, setShowAddReceivable] =
    useState(false);
  const [addReceivableForm, setAddReceivableForm] =
    useState({
      employee_name: "",
      office_name: "",
      custom_office_name: "",
      amount: "",
      remarks: "",
    });

  const [paymentForm, setPaymentForm] = useState({
    amount_paid: "",
    payment_method: "Cash",
    remarks: "",
  });

  const [paymentRequest, setPaymentRequest] = useState({
    receivableId: null,
    token: null,
  });

  const createRequestToken = () => {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}-${Math.random().toString(16).slice(2)}`;
  };

  const showNotice = (type, title, message) => {
    setNotice({ type, title, message });

    window.setTimeout(() => {
      setNotice(null);
    }, 4500);
  };

  const fetchReceivables = async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `${RECEIVABLES_API}/get_receivables.php`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.message || "Unable to load receivables."
        );
      }

      setReceivables(normalizeList(data));
    } catch (error) {
      showNotice(
        "error",
        "Unable to Load",
        error.message || "Unable to load receivables."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceivables();
  }, []);

  const filteredReceivables = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return receivables.filter((item) => {
      const matchesStatus =
        statusFilter === "All" ||
        item.status === statusFilter;

      const searchable = [
        item.receivable_id,
        item.pos_id,
        item.transaction_code,
        item.employee_name,
        item.office_name,
        item.customer_name,
        item.status,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (!keyword || searchable.includes(keyword))
      );
    });
  }, [receivables, search, statusFilter]);

  const paginatedReceivables = useMemo(() => {
    const start =
      (receivablePage - 1) *
      RECEIVABLE_PAGE_SIZE;

    return filteredReceivables.slice(
      start,
      start + RECEIVABLE_PAGE_SIZE
    );
  }, [
    filteredReceivables,
    receivablePage,
  ]);

  useEffect(() => {
    setReceivablePage(1);
  }, [
    search,
    statusFilter,
  ]);


  const summary = useMemo(() => {
    return receivables.reduce(
      (result, item) => {
        const original = Number(item.original_amount || 0);
        const paid = Number(item.amount_paid || 0);
        const balance = Number(item.balance_amount || 0);

        result.totalOriginal += original;
        result.totalPaid += paid;
        result.totalBalance += balance;

        if (item.status === "Paid") result.paidCount += 1;
        if (item.status !== "Paid" && item.status !== "Cancelled") {
          result.openCount += 1;
        }

        return result;
      },
      {
        totalOriginal: 0,
        totalPaid: 0,
        totalBalance: 0,
        paidCount: 0,
        openCount: 0,
      }
    );
  }, [receivables]);

  const submitOtherOfficeReceivable = async (event) => {
    event.preventDefault();

    const employeeName =
      addReceivableForm.employee_name.trim();
    const selectedOffice =
      addReceivableForm.office_name.trim();

    const officeName =
      selectedOffice === "Other"
        ? addReceivableForm.custom_office_name.trim()
        : selectedOffice;

    const amount =
      Number(addReceivableForm.amount || 0);

    if (!employeeName) {
      showNotice(
        "error",
        "Employee Required",
        "Enter the employee name."
      );
      return;
    }

    if (!officeName) {
      showNotice(
        "error",
        "Office Required",
        selectedOffice === "Other"
          ? "Specify the office or department."
          : "Select the office or department."
      );
      return;
    }

    if (amount <= 0) {
      showNotice(
        "error",
        "Invalid Amount",
        "Enter a receivable amount greater than zero."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${RECEIVABLES_API}/create_receivable.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            employee_name: employeeName,
            office_name: officeName,
            amount,
            remarks:
              addReceivableForm.remarks.trim(),
            created_by:
              user?.user_id || null,
            created_by_name:
              user?.full_name ||
              user?.name ||
              "HiveSync User",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.message ||
            "Unable to create the receivable."
        );
      }

      setShowAddReceivable(false);
      setAddReceivableForm({
        employee_name: "",
        office_name: "",
        custom_office_name: "",
        amount: "",
        remarks: "",
      });

      await fetchReceivables();

      showNotice(
        "success",
        "Receivable Added",
        `${data?.source_reference || "Receivable"} was created successfully.`
      );
    } catch (error) {
      showNotice(
        "error",
        "Unable to Add Receivable",
        error.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  const loadDetails = async (receivable) => {
    setSelectedReceivable(receivable);
    setDetails(null);
    setShowDetails(true);

    try {
      const response = await fetch(
        `${RECEIVABLES_API}/get_receivable_details.php?receivable_id=${encodeURIComponent(
          receivable.receivable_id
        )}`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.message || "Unable to load receivable details."
        );
      }

      setDetails(
        data?.receivable ||
        data?.data?.receivable ||
        data?.data ||
        data
      );
    } catch (error) {
      showNotice(
        "error",
        "Unable to Load",
        error.message
      );
    }
  };

  const loadPaymentHistory = async (receivable) => {
    setSelectedReceivable(receivable);
    setPayments([]);
    setShowHistory(true);

    try {
      const response = await fetch(
        `${RECEIVABLES_API}/get_payment_history.php?receivable_id=${encodeURIComponent(
          receivable.receivable_id
        )}`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.message || "Unable to load payment history."
        );
      }

      setPayments(normalizeList(data));
    } catch (error) {
      showNotice(
        "error",
        "Unable to Load",
        error.message
      );
    }
  };

  const openPaymentModal = (receivable) => {
    setSelectedReceivable(receivable);
    setPaymentForm({
      amount_paid: "",
      payment_method: "Cash",
      remarks: "",
    });

    setPaymentRequest((current) => {
      const receivableId = Number(receivable?.receivable_id || 0);

      if (
        current.receivableId === receivableId &&
        current.token
      ) {
        return current;
      }

      return {
        receivableId,
        token: createRequestToken(),
      };
    });

    setShowPayment(true);
  };

  const submitPayment = async (event) => {
    event.preventDefault();

    const amount = Number(paymentForm.amount_paid || 0);
    const balance = Number(
      selectedReceivable?.balance_amount || 0
    );

    if (amount <= 0) {
      showNotice(
        "error",
        "Invalid Payment",
        "Enter a payment amount greater than zero."
      );
      return;
    }

    if (amount > balance) {
      showNotice(
        "error",
        "Payment Too High",
        "The payment cannot be greater than the remaining balance."
      );
      return;
    }

    setSubmitting(true);

    const receivableId = Number(
      selectedReceivable?.receivable_id || 0
    );

    const requestToken =
      paymentRequest.receivableId === receivableId &&
      paymentRequest.token
        ? paymentRequest.token
        : createRequestToken();

    if (
      paymentRequest.receivableId !== receivableId ||
      paymentRequest.token !== requestToken
    ) {
      setPaymentRequest({
        receivableId,
        token: requestToken,
      });
    }

    try {
      const response = await fetch(
        `${RECEIVABLES_API}/record_payment.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            receivable_id:
              selectedReceivable.receivable_id,
            request_token: requestToken,
            amount_paid: amount,
            payment_method:
              paymentForm.payment_method,
            remarks: paymentForm.remarks.trim(),
            received_by: user?.user_id || null,
            received_by_name:
              user?.full_name ||
              user?.name ||
              user?.username ||
              "HiveSync User",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.message || "Unable to record payment."
        );
      }

      setShowPayment(false);
      setPaymentRequest({
        receivableId: null,
        token: null,
      });

      setPaymentReceipt(
        data?.receipt || {
          document_title:
            "RECEIVABLE PAYMENT RECEIPT",
          payment_reference:
            data?.payment_reference,
          receivable_id:
            data?.receivable_id,
          transaction_code:
            selectedReceivable?.transaction_code,
          employee_name:
            selectedReceivable?.employee_name ||
            selectedReceivable?.customer_name,
          office_name:
            selectedReceivable?.office_name,
          original_amount:
            selectedReceivable?.original_amount,
          payment_amount: amount,
          total_paid:
            data?.total_paid,
          remaining_balance:
            data?.remaining_balance,
          status:
            data?.status,
          payment_method:
            paymentForm.payment_method,
          remarks:
            paymentForm.remarks.trim(),
          received_by_name:
            user?.full_name ||
            user?.name ||
            "HiveSync User",
          payment_date:
            data?.payment_date ||
            new Date().toISOString(),
        }
      );

      setShowPaymentReceipt(true);

      await fetchReceivables();

      showNotice(
        "success",
        "Payment Recorded",
        data?.message ||
          "The payment was recorded successfully."
      );
    } catch (error) {
      showNotice(
        "error",
        "Payment Failed",
        error.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  const printStatement = () => {
    if (!details) {
      showNotice(
        "error",
        "Statement Not Ready",
        "The receivable details are not available."
      );
      return;
    }

    const statementWindow = window.open(
      "",
      "_blank",
      "width=900,height=1000"
    );

    if (!statementWindow) {
      showNotice(
        "error",
        "Pop-up Blocked",
        "Allow pop-ups for HiveSync, then print the statement again."
      );
      return;
    }

    const receivableNo =
      `RCV-${String(
        details.receivable_id || 0
      ).padStart(6, "0")}`;

    const transactionCode =
      details.transaction_code ||
      `POS #${details.pos_id || "N/A"}`;

    const employeeName =
      details.employee_name ||
      details.customer_name ||
      "Unknown Employee";

    const officeName =
      details.office_name ||
      "Not Specified";

    const originalAmount =
      money(details.original_amount);

    const amountPaid =
      money(details.amount_paid);

    const remainingBalance =
      money(details.balance_amount);

    const statementDate =
      new Date().toLocaleString("en-PH");

    const notes =
      details.notes ||
      "No additional notes.";

    statementWindow.document.open();
    statementWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${receivableNo} - Receivable Statement</title>

          <style>
            @page {
              size: auto;
              margin: 12mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #111111;
              font-family: Arial, Helvetica, sans-serif;
            }

            body {
              padding: 18px;
            }

            .statement {
              width: 100%;
              max-width: none;
              margin: 0;
            }

            .statement-header {
              display: grid;
              grid-template-columns: 58px 1fr 160px;
              gap: 12px;
              align-items: center;
              padding-bottom: 10px;
              border-bottom: 0.7px solid #555555;
            }

            .statement-header img {
              width: 50px;
              height: 50px;
              object-fit: contain;
            }

            .statement-brand h1 {
              margin: 0;
              font-size: 16px;
              line-height: 1.2;
              font-weight: 800;
              text-transform: uppercase;
            }

            .statement-brand p {
              margin: 3px 0 0;
              color: #4b5563;
              font-size: 9px;
              line-height: 1.35;
            }

            .statement-number {
              text-align: right;
            }

            .statement-number span,
            .statement-number strong {
              display: block;
            }

            .statement-number span {
              margin-bottom: 3px;
              color: #6b7280;
              font-size: 7px;
              font-weight: 700;
              text-transform: uppercase;
            }

            .statement-number strong {
              font-size: 11px;
              font-weight: 700;
            }

            .statement-title {
              margin: 14px 0 12px;
              text-align: center;
            }

            .statement-title h2 {
              margin: 0;
              font-size: 17px;
              font-weight: 600;
              letter-spacing: 0.8px;
              text-transform: uppercase;
            }

            .statement-fields {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px 22px;
              margin-bottom: 10px;
            }

            .statement-field {
              display: flex;
              align-items: flex-end;
              gap: 5px;
              min-width: 0;
              font-size: 9.5px;
            }

            .statement-field span {
              flex: 0 0 auto;
              font-weight: 700;
              text-transform: uppercase;
            }

            .statement-field strong {
              flex: 1;
              min-width: 0;
              min-height: 15px;
              padding: 0 4px 2px;
              border-bottom: 0.6px solid #666666;
              font-size: 10px;
              font-weight: 500;
              overflow-wrap: anywhere;
            }

            .statement-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              border-top: 0.45pt solid #cbd5e1;
              border-left: 0.45pt solid #cbd5e1;
              table-layout: fixed;
            }

            .statement-table th,
            .statement-table td {
              padding: 6px 7px;
              border: 0;
              border-right: 0.45pt solid #cbd5e1;
              border-bottom: 0.45pt solid #cbd5e1;
              background: #ffffff;
              color: #111111;
              font-size: 9.5px;
              line-height: 1.3;
            }

            .statement-table th {
              background: #f8fafc;
              font-size: 8.5px;
              font-weight: 700;
              text-align: left;
              text-transform: uppercase;
            }

            .statement-table td:last-child {
              text-align: right;
              white-space: nowrap;
            }

            .statement-table .balance-row td {
              font-weight: 700;
            }

            .statement-notes {
              margin-top: 10px;
              display: flex;
              align-items: flex-end;
              gap: 6px;
              font-size: 8.5px;
            }

            .statement-notes span {
              flex: 0 0 auto;
              font-weight: 700;
              text-transform: uppercase;
            }

            .statement-notes strong {
              flex: 1;
              min-height: 15px;
              padding: 0 4px 2px;
              border-bottom: 0.6px solid #666666;
              font-size: 9px;
              font-weight: 500;
            }

            .statement-signatures {
              margin-top: 34px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 42px;
            }

            .statement-signature {
              text-align: center;
            }

            .statement-signature span {
              display: block;
              min-height: 18px;
              padding-bottom: 3px;
              border-bottom: 0.7px solid #444444;
              font-size: 8.5px;
            }

            .statement-signature strong {
              display: block;
              margin-top: 4px;
              font-size: 8px;
            }

            .statement-footer {
              margin-top: 16px;
              padding-top: 6px;
              border-top: 0.45pt solid #cbd5e1;
              color: #6b7280;
              font-size: 7px;
              text-align: center;
            }

            @media print {
              html,
              body {
                width: 100%;
                margin: 0;
                padding: 0;
              }

              .statement {
                width: 100%;
                max-width: none;
                margin: 0;
              }

              .statement-header,
              .statement-fields,
              .statement-table,
              .statement-notes,
              .statement-signatures,
              .statement-footer {
                width: 100%;
              }
            }
          </style>
        </head>

        <body>
          <main class="statement">
            <header class="statement-header">
              <img
                src="${bacnotanLogo}"
                alt="Bacnotan Logo"
              />

              <div class="statement-brand">
                <h1>
                  BACNOTAN FARMERS AGRI-TOURISM CENTER
                </h1>

                <p>
                  HiveSync Integrated Business and Operations Management System
                </p>
              </div>

              <div class="statement-number">
                <span>Receivable No.</span>
                <strong>${receivableNo}</strong>
              </div>
            </header>

            <section class="statement-title">
              <h2>Receivable Account Statement</h2>
            </section>

            <section class="statement-fields">
              <div class="statement-field">
                <span>Employee</span>
                <strong>${employeeName}</strong>
              </div>

              <div class="statement-field">
                <span>Status</span>
                <strong>${details.status || "Unpaid"}</strong>
              </div>

              <div class="statement-field">
                <span>Transaction</span>
                <strong>${transactionCode}</strong>
              </div>

              <div class="statement-field">
                <span>Generated At</span>
                <strong>${statementDate}</strong>
              </div>

              <div class="statement-field">
                <span>Office / Department</span>
                <strong>${officeName}</strong>
              </div>

              <div class="statement-field">
                <span>Created</span>
                <strong>${
                  details.created_at
                    ? formatDateTime(details.created_at)
                    : "N/A"
                }</strong>
              </div>
            </section>

            <table class="statement-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>Original Receivable</td>
                  <td>${originalAmount}</td>
                </tr>

                <tr>
                  <td>Amount Paid</td>
                  <td>${amountPaid}</td>
                </tr>

                <tr class="balance-row">
                  <td>Remaining Balance</td>
                  <td>${remainingBalance}</td>
                </tr>
              </tbody>
            </table>

            <div class="statement-notes">
              <span>Notes</span>
              <strong>${notes}</strong>
            </div>

            <section class="statement-signatures">
              <div class="statement-signature">
                <span>${
                  user?.full_name ||
                  user?.name ||
                  user?.username ||
                  "HiveSync User"
                }</span>
                <strong>Prepared By</strong>
              </div>

              <div class="statement-signature">
                <span></span>
                <strong>Employee / Acknowledged By</strong>
              </div>
            </section>

            <footer class="statement-footer">
              This receivable account statement was generated through HiveSync.
            </footer>
          </main>

          <script>
            window.onload = function () {
              window.setTimeout(
                function () {
                  window.focus();
                  window.print();
                },
                200
              );
            };
          <\/script>
        </body>
      </html>
    `);

    statementWindow.document.close();
  };

  const printPaymentReceipt = () => {
    const element =
      document.getElementById(
        "receivable-payment-receipt"
      );

    if (!element) {
      showNotice(
        "error",
        "Receipt Not Ready",
        "The receivable payment receipt is not available."
      );
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=900,height=1000"
    );

    if (!printWindow) {
      showNotice(
        "error",
        "Pop-up Blocked",
        "Allow pop-ups for HiveSync, then print the receipt again."
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receivable Payment Receipt</title>

          <style>
            @page {
              size: auto;
              margin: 12mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #111111;
              font-family: Arial, Helvetica, sans-serif;
            }

            body {
              padding: 18px;
            }

            .receivable-payment-receipt-paper {
              width: 100%;
              max-width: none;
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #111111;
            }

            .receivable-receipt-header {
              display: grid;
              grid-template-columns: 58px 1fr 155px;
              gap: 12px;
              align-items: center;
              padding-bottom: 10px;
              border-bottom: 0.7px solid #555555;
            }

            .receivable-receipt-logo {
              width: 50px;
              height: 50px;
              object-fit: contain;
            }

            .receivable-receipt-brand h3 {
              margin: 0;
              font-size: 14px;
              line-height: 1.2;
              font-weight: 800;
              text-transform: uppercase;
            }

            .receivable-receipt-brand p {
              margin: 3px 0 0;
              font-size: 8px;
              line-height: 1.3;
              color: #4b5563;
            }

            .receivable-receipt-number {
              text-align: right;
            }

            .receivable-receipt-number span,
            .receivable-receipt-number strong {
              display: block;
            }

            .receivable-receipt-number span {
              margin-bottom: 3px;
              color: #6b7280;
              font-size: 7px;
              font-weight: 700;
              text-transform: uppercase;
            }

            .receivable-receipt-number strong {
              font-size: 10px;
              font-weight: 700;
              overflow-wrap: anywhere;
            }

            .receivable-receipt-title {
              margin: 13px 0 11px;
              text-align: center;
            }

            .receivable-receipt-title h2 {
              margin: 0;
              font-size: 15px;
              line-height: 1.2;
              font-weight: 500;
              letter-spacing: 0.8px;
              text-transform: uppercase;
            }

            .receivable-receipt-fields {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px 22px;
              margin-bottom: 10px;
            }

            .receivable-receipt-field {
              display: flex;
              align-items: flex-end;
              gap: 5px;
              min-width: 0;
              font-size: 8.5px;
            }

            .receivable-receipt-field span {
              flex: 0 0 auto;
              font-weight: 700;
              text-transform: uppercase;
            }

            .receivable-receipt-field strong {
              flex: 1;
              min-width: 0;
              min-height: 15px;
              padding: 0 4px 2px;
              border-bottom: 0.6px solid #666666;
              font-size: 9px;
              font-weight: 500;
              overflow-wrap: anywhere;
            }

            .receivable-receipt-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              border-top: 0.45pt solid #cbd5e1;
              border-left: 0.45pt solid #cbd5e1;
              table-layout: fixed;
            }

            .receivable-receipt-table th,
            .receivable-receipt-table td {
              padding: 5px 6px;
              border: 0;
              border-right: 0.45pt solid #cbd5e1;
              border-bottom: 0.45pt solid #cbd5e1;
              background: #ffffff;
              color: #111111;
              font-size: 8.5px;
              line-height: 1.25;
              vertical-align: middle;
            }

            .receivable-receipt-table th {
              background: #f8fafc;
              font-size: 7.5px;
              font-weight: 700;
              text-align: left;
              text-transform: uppercase;
            }

            .receivable-receipt-table td:last-child {
              text-align: right;
              white-space: nowrap;
            }

            .receivable-receipt-total-row td {
              font-weight: 700;
            }

            .receivable-receipt-total-row td:first-child {
              text-align: right;
              text-transform: uppercase;
            }

            .receivable-receipt-notes {
              margin-top: 10px;
              display: flex;
              align-items: flex-end;
              gap: 6px;
              font-size: 8.5px;
            }

            .receivable-receipt-notes span {
              flex: 0 0 auto;
              font-weight: 700;
              text-transform: uppercase;
            }

            .receivable-receipt-notes strong {
              flex: 1;
              min-height: 15px;
              padding: 0 4px 2px;
              border-bottom: 0.6px solid #666666;
              font-size: 9px;
              font-weight: 500;
            }

            .receivable-receipt-certification {
              margin-top: 12px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 36px;
              color: #4b5563;
              font-size: 8px;
              line-height: 1.4;
            }

            .receivable-receipt-certification p {
              margin: 0;
            }

            .receivable-receipt-signatures {
              margin-top: 32px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 42px;
              page-break-inside: avoid;
            }

            .receivable-receipt-signature {
              text-align: center;
            }

            .receivable-receipt-signature span {
              display: block;
              min-height: 18px;
              padding-bottom: 3px;
              border-bottom: 0.7px solid #444444;
              font-size: 8.5px;
            }

            .receivable-receipt-signature strong {
              display: block;
              margin-top: 4px;
              font-size: 8px;
              font-weight: 700;
            }

            .receivable-receipt-footnote {
              margin-top: 16px;
              padding-top: 6px;
              border-top: 0.45pt solid #cbd5e1;
              color: #6b7280;
              font-size: 7px;
              text-align: center;
            }

            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>

        <body>
          ${element.outerHTML}

          <script>
            window.onload = function () {
              window.focus();

              window.setTimeout(
                function () {
                  window.print();
                },
                200
              );
            };
          <\/script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="receivables-page">
      {notice ? (
        <div className={`receivable-notice ${notice.type}`}>
          {notice.type === "success" ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertCircle size={20} />
          )}

          <div>
            <strong>{notice.title}</strong>
            <span>{notice.message}</span>
          </div>
        </div>
      ) : null}

      <section className="receivables-heading">
        <div>
          <p className="receivables-eyebrow">
            Financial Monitoring
          </p>
          <h1>Employee Receivables</h1>
          <span>
            Track employee and office receivable balances,
            collections, and payment history from POS transactions.
          </span>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={fetchReceivables}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "spin" : ""}
          />
          Refresh
        </button>
      </section>

      <section className="receivable-summary-grid">
        <SummaryCard
          icon={CircleDollarSign}
          label="Total Receivables"
          value={money(summary.totalOriginal)}
          helper={`${receivables.length} record(s)`}
        />

        <SummaryCard
          icon={WalletCards}
          label="Outstanding Balance"
          value={money(summary.totalBalance)}
          helper={`${summary.openCount} open account(s)`}
        />

        <SummaryCard
          icon={CheckCircle2}
          label="Collected Amount"
          value={money(summary.totalPaid)}
          helper={`${summary.paidCount} fully paid`}
        />

        <SummaryCard
          icon={Clock3}
          label="Open Accounts"
          value={summary.openCount}
          helper="No due date or term"
        />
      </section>

      <section className="receivable-content-card">
        <div className="receivable-toolbar">
          <div className="receivable-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search employee, office, transaction, status, or ID"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="All">All Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">
              Partially Paid
            </option>
            <option value="Paid">Paid</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="receivable-table-wrap">
          <table className="receivable-table receivable-main-table">
            <colgroup>
              <col className="receivable-col-id" />
              <col className="receivable-col-customer" />
              <col className="receivable-col-customer" />
              <col className="receivable-col-amount" />
              <col className="receivable-col-paid" />
              <col className="receivable-col-balance" />
              <col className="receivable-col-status" />
              <col className="receivable-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Receivable</th>
                <th>Employee</th>
                <th>Office / Department</th>
                <th>Original Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-cell">
                    Loading receivables...
                  </td>
                </tr>
              ) : filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-cell">
                    No receivable records found.
                  </td>
                </tr>
              ) : (
                paginatedReceivables.map((item) => (
                  <tr key={item.receivable_id}>
                    <td>
                      <strong>
                        #{item.receivable_id}
                      </strong>
                      <small>
                        {item.transaction_code ||
                          `POS #${item.pos_id}`}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {item.employee_name ||
                          item.customer_name ||
                          "Unknown Employee"}
                      </strong>
                      <small>
                        Created {formatDate(item.created_at)}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {item.office_name ||
                          "Not Specified"}
                      </strong>
                    </td>

                    <td>{money(item.original_amount)}</td>
                    <td>{money(item.amount_paid)}</td>
                    <td className="balance-cell">
                      {money(item.balance_amount)}
                    </td>

                    <td>
                      <StatusBadge status={item.status} />
                    </td>

                    <td className="receivable-actions-cell">
                      <div className="receivable-actions">
                        <button
                          type="button"
                          title="View details"
                          onClick={() => loadDetails(item)}
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          title="Payment history"
                          onClick={() =>
                            loadPaymentHistory(item)
                          }
                        >
                          <History size={16} />
                        </button>

                        {item.status !== "Paid" &&
                        item.status !== "Cancelled" &&
                        Number(item.balance_amount) > 0 ? (
                          <button
                            type="button"
                            className="payment"
                            title="Record payment"
                            onClick={() =>
                              openPaymentModal(item)
                            }
                          >
                            <WalletCards size={16} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading &&
          filteredReceivables.length > 0 && (
            <PaginationBar
              totalItems={filteredReceivables.length}
              currentPage={receivablePage}
              pageSize={RECEIVABLE_PAGE_SIZE}
              onPageChange={setReceivablePage}
              itemLabel="receivables"
            />
          )}
      </section>

      {showDetails ? (
        <Modal
          title="Receivable Details"
          wide
          onClose={() => setShowDetails(false)}
        >
          {!details ? (
            <div className="receivable-loading-panel">
              Loading details...
            </div>
          ) : (
            <div className="receivable-detail-layout receivable-detail-document">
              <div className="receivable-detail-document-header">
                <img
                  src={bacnotanLogo}
                  alt="Bacnotan Logo"
                />

                <div>
                  <h3>
                    BACNOTAN FARMERS AGRI-TOURISM CENTER
                  </h3>

                  <p>
                    Receivable Account Details
                  </p>
                </div>

                <div className="receivable-detail-reference">
                  <span>Receivable No.</span>

                  <strong>
                    RCV-
                    {String(
                      details.receivable_id || 0
                    ).padStart(6, "0")}
                  </strong>
                </div>
              </div>

              <div className="receivable-detail-title">
                <h3>Receivable Details</h3>

                <p>
                  Account information and current payment position
                </p>
              </div>

              <table className="receivable-detail-form-table">
                <tbody>
                  <tr>
                    <th>Employee</th>
                    <td>
                      {details.employee_name ||
                        details.customer_name ||
                        "Unknown Employee"}
                    </td>

                    <th>Status</th>
                    <td>
                      <StatusBadge status={details.status} />
                    </td>
                  </tr>

                  <tr>
                    <th>Transaction</th>
                    <td>
                      {details.transaction_code ||
                        `POS #${details.pos_id}`}
                    </td>

                    <th>Office / Department</th>
                    <td>
                      {details.office_name ||
                        "Not Specified"}
                    </td>
                  </tr>

                  <tr>
                    <th>Original Amount</th>
                    <td>
                      {money(details.original_amount)}
                    </td>

                    <th>Amount Paid</th>
                    <td>
                      {money(details.amount_paid)}
                    </td>
                  </tr>

                  <tr>
                    <th>Remaining Balance</th>
                    <td className="receivable-detail-balance-value">
                      {money(details.balance_amount)}
                    </td>

                    <th>Created</th>
                    <td>
                      {details.created_at
                        ? formatDateTime(details.created_at)
                        : "N/A"}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="receivable-detail-notes-line">
                <span>Notes</span>

                <strong>
                  {details.notes ||
                    "No additional notes."}
                </strong>
              </div>

              <div className="receivable-detail-summary-line">
                <span>
                  Current account position
                </span>

                <strong>
                  {details.status === "Paid"
                    ? "Fully Settled"
                    : `${money(
                        details.balance_amount
                      )} remaining`}
                </strong>
              </div>

              <div className="receivable-modal-footer receivable-detail-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={printStatement}
                >
                  <Printer size={17} />
                  Print Statement
                </button>

                {details.status !== "Paid" &&
                details.status !== "Cancelled" &&
                Number(details.balance_amount) > 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setShowDetails(false);
                      openPaymentModal(details);
                    }}
                  >
                    <WalletCards size={17} />
                    Record Payment
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </Modal>
      ) : null}

      {showPayment ? (
        <Modal
          title="Record Receivable Payment"
          onClose={() => setShowPayment(false)}
        >
          <form
            className="receivable-payment-form"
            onSubmit={submitPayment}
          >
            <div className="receivable-payment-account">
              <span>Employee</span>
              <strong>
                {selectedReceivable?.employee_name ||
                  selectedReceivable?.customer_name ||
                  "Unknown Employee"}
              </strong>

              <small>
                {selectedReceivable?.office_name ||
                  "Office not specified"}
              </small>

              <div>
                <span>Current Balance</span>
                <strong>
                  {money(
                    selectedReceivable?.balance_amount
                  )}
                </strong>
              </div>
            </div>

            <label>
              <span>Payment Amount</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={
                  selectedReceivable?.balance_amount || ""
                }
                required
                value={paymentForm.amount_paid}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    amount_paid: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Payment Method</span>
              <select
                value={paymentForm.payment_method}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    payment_method: event.target.value,
                  }))
                }
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">
                  Bank Transfer
                </option>
                <option value="GCash">GCash</option>
                <option value="Maya">Maya</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
              <span>Remarks</span>
              <textarea
                placeholder="Optional payment note"
                value={paymentForm.remarks}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    remarks: event.target.value,
                  }))
                }
              />
            </label>

            <div className="receivable-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPayment(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                <WalletCards size={17} />
                {submitting
                  ? "Recording..."
                  : "Record Payment"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {showHistory ? (
        <Modal
          title="Payment History"
          wide
          onClose={() => setShowHistory(false)}
        >
          <div className="receivable-history-heading">
            <div>
              <span>Employee</span>
              <strong>
                {selectedReceivable?.employee_name ||
                  selectedReceivable?.customer_name ||
                  "Unknown Employee"}
              </strong>
              <small>
                {selectedReceivable?.office_name ||
                  "Office not specified"}
              </small>
            </div>

            <div>
              <span>Current Balance</span>
              <strong>
                {money(
                  selectedReceivable?.balance_amount
                )}
              </strong>
            </div>
          </div>

          <div className="receivable-table-wrap">
            <table className="receivable-table compact">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Received By</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-cell">
                      No payment records found.
                    </td>
                  </tr>
                ) : (
                  payments.map((payment, index) => {
                    const paymentKey =
                      payment.payment_id ??
                      payment.payment_reference ??
                      `${payment.receivable_id || "receivable"}-${payment.payment_date || "date"}-${index}`;

                    return (
                      <tr key={`payment-${paymentKey}`}>
                        <td>
                          <strong>
                            {payment.payment_reference || "—"}
                          </strong>
                        </td>
                        <td>
                          {formatDateTime(
                            payment.payment_date
                          )}
                        </td>
                        <td>{payment.payment_method || "—"}</td>
                        <td>
                          {money(payment.amount_paid)}
                        </td>
                        <td>
                          {payment.received_by_name || "—"}
                        </td>
                        <td>{payment.remarks || "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      ) : null}


      {showAddReceivable ? (
        <Modal
          title="Add Other Office Receivable"
          onClose={() => {
            if (!submitting) {
              setShowAddReceivable(false);
            }
          }}
        >
          <form
            className="receivable-payment-form"
            onSubmit={submitOtherOfficeReceivable}
          >
            <div className="receivable-payment-summary">
              <span>Source</span>
              <strong>Other Office</strong>
              <small>
                This receivable is not tied to a POS sale.
              </small>
            </div>

            <label>
              Employee Name
              <input
                type="text"
                required
                value={
                  addReceivableForm.employee_name
                }
                onChange={(event) =>
                  setAddReceivableForm(
                    (current) => ({
                      ...current,
                      employee_name:
                        event.target.value,
                    })
                  )
                }
                placeholder="Enter employee name"
              />
            </label>

            <label>
              Office / Department
              <select
                required
                value={
                  addReceivableForm.office_name
                }
                onChange={(event) => {
                  const value = event.target.value;

                  setAddReceivableForm(
                    (current) => ({
                      ...current,
                      office_name: value,
                      custom_office_name:
                        value === "Other"
                          ? current.custom_office_name
                          : "",
                    })
                  );
                }}
              >
                <option value="">
                  Select office / department
                </option>

                {OFFICE_OPTIONS.map((office) => (
                  <option
                    key={office}
                    value={office}
                  >
                    {office}
                  </option>
                ))}
              </select>
            </label>

            {addReceivableForm.office_name ===
              "Other" && (
              <label>
                Specify Office / Department
                <input
                  type="text"
                  required
                  value={
                    addReceivableForm.custom_office_name
                  }
                  onChange={(event) =>
                    setAddReceivableForm(
                      (current) => ({
                        ...current,
                        custom_office_name:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Enter office or department"
                />
              </label>
            )}

            <label>
              Receivable Amount
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={
                  addReceivableForm.amount
                }
                onChange={(event) =>
                  setAddReceivableForm(
                    (current) => ({
                      ...current,
                      amount:
                        event.target.value,
                    })
                  )
                }
                placeholder="0.00"
              />
            </label>

            <label>
              Remarks / Reason
              <textarea
                value={
                  addReceivableForm.remarks
                }
                onChange={(event) =>
                  setAddReceivableForm(
                    (current) => ({
                      ...current,
                      remarks:
                        event.target.value,
                    })
                  )
                }
                placeholder="Optional remarks or reason"
              />
            </label>

            <div className="receivable-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={() =>
                  setShowAddReceivable(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting
                  ? "Saving..."
                  : "Create Receivable"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {showPaymentReceipt && paymentReceipt ? (
        <Modal
          title="Receivable Payment Receipt"
          wide
          onClose={() => {
            setShowPaymentReceipt(false);
            setPaymentReceipt(null);
          }}
        >
          <div className="receivable-payment-receipt-shell receivable-payment-receipt-document-shell">
            <div
              id="receivable-payment-receipt"
              className="receivable-payment-receipt-paper"
            >
              <header className="receivable-receipt-header">
                <img
                  src={bacnotanLogo}
                  alt="Bacnotan Logo"
                  className="receivable-receipt-logo"
                />

                <div className="receivable-receipt-brand">
                  <h3>
                    BACNOTAN FARMERS AGRI-TOURISM CENTER
                  </h3>

                  <p>
                    HiveSync Integrated Business and Operations Management System
                  </p>
                </div>

                <div className="receivable-receipt-number">
                  <span>Payment Receipt No.</span>

                  <strong>
                    {paymentReceipt.payment_reference ||
                      `RP-${String(
                        paymentReceipt.receivable_id || 0
                      ).padStart(6, "0")}`}
                  </strong>
                </div>
              </header>

              <section className="receivable-receipt-title">
                <h2>
                  {paymentReceipt.document_title ||
                    "RECEIVABLE PAYMENT RECEIPT"}
                </h2>
              </section>

              <section className="receivable-receipt-fields">
                <div className="receivable-receipt-field">
                  <span>Employee</span>

                  <strong>
                    {paymentReceipt.employee_name ||
                      "Unknown Employee"}
                  </strong>
                </div>

                <div className="receivable-receipt-field">
                  <span>Date</span>

                  <strong>
                    {formatDateTime(
                      paymentReceipt.payment_date
                    )}
                  </strong>
                </div>

                <div className="receivable-receipt-field">
                  <span>Transaction</span>

                  <strong>
                    {paymentReceipt.transaction_code ||
                      "N/A"}
                  </strong>
                </div>

                <div className="receivable-receipt-field">
                  <span>Status</span>

                  <strong>
                    {paymentReceipt.status ||
                      "Partially Paid"}
                  </strong>
                </div>

                <div className="receivable-receipt-field receivable-receipt-field-wide">
                  <span>Office / Department</span>

                  <strong>
                    {paymentReceipt.office_name ||
                      "Not Specified"}
                  </strong>
                </div>

                <div className="receivable-receipt-field">
                  <span>Payment Method</span>

                  <strong>
                    {paymentReceipt.payment_method ||
                      "Cash"}
                  </strong>
                </div>
              </section>

              <table className="receivable-receipt-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td>Original Receivable</td>
                    <td>
                      {money(
                        paymentReceipt.original_amount
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>Payment Received</td>
                    <td>
                      {money(
                        paymentReceipt.payment_amount
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>Total Paid</td>
                    <td>
                      {money(
                        paymentReceipt.total_paid
                      )}
                    </td>
                  </tr>

                  <tr className="receivable-receipt-total-row">
                    <td>Remaining Balance</td>
                    <td>
                      {money(
                        paymentReceipt.remaining_balance
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {paymentReceipt.remarks ? (
                <div className="receivable-receipt-notes">
                  <span>Remarks</span>

                  <strong>
                    {paymentReceipt.remarks}
                  </strong>
                </div>
              ) : null}

              <section className="receivable-receipt-certification">
                <p>
                  This payment was received and recorded in HiveSync against the receivable account shown above.
                </p>

                <p>
                  The remaining balance reflects the account position immediately after this payment.
                </p>
              </section>

              <section className="receivable-receipt-signatures">
                <div className="receivable-receipt-signature">
                  <span>
                    {paymentReceipt.received_by_name ||
                      user?.full_name ||
                      user?.name ||
                      user?.username ||
                      "HiveSync User"}
                  </span>

                  <strong>Payment Received By</strong>
                </div>

                <div className="receivable-receipt-signature">
                  <span></span>
                  <strong>Employee / Acknowledged By</strong>
                </div>
              </section>

              <footer className="receivable-receipt-footnote">
                This receivable payment receipt was generated through HiveSync.
              </footer>
            </div>
          </div>

          <div className="receivable-modal-footer receivable-payment-receipt-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowPaymentReceipt(false);
                setPaymentReceipt(null);
              }}
            >
              Close
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={printPaymentReceipt}
            >
              <Printer size={17} />
              Print Receipt
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}