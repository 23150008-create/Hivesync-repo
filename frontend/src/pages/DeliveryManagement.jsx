import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Package,
  Plus,
  Printer,
  Search,
  Send,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";

import "../styles/module.css";
import "../styles/delivery.css";
import bacnotanLogo from "../assets/Bacnotan Logo.png";

const API_BASE = "http://localhost/HiveSync/backend";

const PLACEHOLDER_IMAGE = "";

const createEmptyItem = () => ({
  local_id: `${Date.now()}-${Math.random()}`,
  is_new_product: 0,
  product_id: "",
  family_id: "",
  request_variant_id: "",
  variant_label: "",
  variant_value: "",
  variant_unit: "",
  variant_sort: 0,
  family_group_key: "",
  selected_for_delivery: false,
  product_name: "",
  description: "",
  sku: "",
  category_id: "",
  category: "",
  unit_type: "pcs",
  unit: "pcs",
  reorder_level: 5,
  quantity: 1,
  supplier_price: "",
  retail_price: "",
  expiry_date: "",
  product_image: null,
  product_image_preview: "",
  is_consignment: 0,
  consignment_terms: "",
  consignment_start_date: "",
  consignment_pullout_date: "",
  consignment_notes: "",
});


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


function DeliveryManagement({
  user,
  focusDeliveryId = null,
}) {
  const getLocalDateString = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const today =
    getLocalDateString();

  const role = String(user?.role || "Staff").trim();
  const isSupplier =
    role === "Supplier" || role === "Vendor";
  const isAdmin = role === "Admin";

  const canManageDeliveries =
    role === "Admin" || role === "Staff";
  const canCreateDelivery =
    canManageDeliveries || isSupplier;

  const supplierVendorId =
    user?.vendor_id ?? user?.supplier_id ?? "";

  const createInitialForm = () => ({
    delivery_order_no: "",
    vendor_id: isSupplier
      ? String(supplierVendorId || "")
      : "",
    delivery_date: today,
    driver: "",
    received_by: user?.full_name || "",
    noted_by: "",
    remarks: "",
    due_date: "",
    status: "Delivered",
    items: [createEmptyItem()],
  });

  const [deliveries, setDeliveries] = useState([]);
  const [restockRequests, setRestockRequests] = useState([]);
  const [restockRequestsLoading, setRestockRequestsLoading] = useState(false);
  const [activeRestockRequestId, setActiveRestockRequestId] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const DELIVERY_PAGE_SIZE = 15;
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [activeDeliveryTab, setActiveDeliveryTab] =
    useState("all");
  const [requestSort, setRequestSort] = useState("newest");

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showConsignmentModal, setShowConsignmentModal] =
    useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingDelivery, setRejectingDelivery] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingDelivery, setReceivingDelivery] = useState(null);
  const [receivingItems, setReceivingItems] = useState([]);
  const [receivingRemarks, setReceivingRemarks] = useState("");
  const [receivingLoading, setReceivingLoading] = useState(false);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishingDelivery, setPublishingDelivery] = useState(null);
  const [publishingItems, setPublishingItems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [reviewingDeliveryId, setReviewingDeliveryId] =
    useState(null);

  const [showApprovalPriceModal, setShowApprovalPriceModal] =
    useState(false);
  const [approvalPricingDelivery, setApprovalPricingDelivery] =
    useState(null);
  const [approvalPricingItems, setApprovalPricingItems] =
    useState([]);
  const [approvalPricingLoading, setApprovalPricingLoading] =
    useState(false);

  const [
    resubmittingDeliveryId,
    setResubmittingDeliveryId,
  ] = useState(null);

  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [consignmentIndex, setConsignmentIndex] = useState(null);
  const [formData, setFormData] = useState(createInitialForm());

  const [notice, setNotice] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const [confirmation, setConfirmation] = useState({
    title: "",
    message: "",
    confirmText: "",
    type: "primary",
    action: null,
  });

  const formatPeso = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (value) => {
    if (!value) {
      return "N/A";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const getWorkflowStatusLabel = (delivery) => {
    if (delivery?.workflow_status) {
      return delivery.workflow_status;
    }

    const status = String(
      delivery?.status || ""
    );

    if (
      status === "Pending" &&
      String(
        delivery?.submission_source || ""
      ).toLowerCase() === "supplier"
    ) {
      return "Pending Review";
    }

    if (status === "Approved") {
      return "Approved / Awaiting Delivery";
    }

    if (status === "Delivered") {
      return "Received / Delivered";
    }

    return status || "Unknown";
  };

  const getWorkflowStatusClass = (delivery) =>
    String(delivery?.status || "")
      .toLowerCase()
      .replace(/\s+/g, "-");

  const getProposalCount = (delivery) =>
    Number(
      delivery?.new_product_proposal_count ||
        0
    );

  const hasProductProposal = (delivery) =>
    Boolean(
      delivery?.has_new_product_proposal
    ) ||
    getProposalCount(delivery) > 0;

  const formatDateTime = (value) => {
    if (!value) {
      return "N/A";
    }

    const normalized = String(value).includes("T")
      ? String(value)
      : String(value).replace(" ", "T");

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const buildDeliveryReceiptHtml = (delivery) => {
    const items = Array.isArray(delivery?.items)
      ? delivery.items
      : [];

    const deliveryNumber =
      delivery?.delivery_order_no ||
      `DEL-${String(
        delivery?.delivery_id || 0
      ).padStart(4, "0")}`;

    const receiptNumber =
      `DR-${String(
        delivery?.delivery_id || 0
      ).padStart(5, "0")}`;

    const totalQuantity = items.reduce(
      (sum, item) =>
        sum + Number(item?.quantity || 0),
      0
    );

    const supplierPayable =
      Number(
        delivery?.supplier_payable_amount ??
          delivery?.payable_amount ??
          items.reduce(
            (sum, item) =>
              sum +
              Number(item?.quantity || 0) *
                Number(item?.supplier_price || 0),
            0
          )
      ) || 0;

    const displayItemName = (item) => {
      const baseName =
        item?.proposed_product_name ||
        item?.effective_product_name ||
        item?.product_display_name ||
        item?.product_name ||
        "Unnamed Product";

      const explicit = String(
        item?.variant_label || ""
      ).trim();

      const value = String(
        item?.variant_value || ""
      ).trim();

      const unit = String(
        item?.variant_unit || ""
      ).trim();

      const variant =
        explicit &&
        explicit.toLowerCase() !== "standard"
          ? explicit
          : value || unit
          ? `${value}${
              value && unit ? " " : ""
            }${unit}`.trim()
          : "";

      return variant &&
        !String(baseName).includes(variant)
        ? `${baseName} — ${variant}`
        : baseName;
    };

    const displayItemUnit = (item) =>
      item?.proposed_unit ||
      item?.effective_unit ||
      item?.unit ||
      item?.unit_type ||
      "pcs";

    const minimumRows = 12;
    const blankRowCount = Math.max(
      0,
      minimumRows - items.length
    );

    const rows = items
      .map((item) => {
        const quantity = Number(
          item?.quantity || 0
        );

        const supplierPrice = Number(
          item?.supplier_price || 0
        );

        const lineAmount =
          quantity * supplierPrice;

        return `
          <tr>
            <td class="center">
              ${escapeHtml(quantity)}
            </td>
            <td class="center">
              ${escapeHtml(
                displayItemUnit(item)
              )}
            </td>
            <td>
              ${escapeHtml(
                displayItemName(item)
              )}
            </td>
            <td class="money">
              ${escapeHtml(
                formatPeso(supplierPrice)
              )}
            </td>
            <td class="money">
              ${escapeHtml(
                formatPeso(lineAmount)
              )}
            </td>
          </tr>
        `;
      })
      .join("");

    const blankRows = Array.from(
      { length: blankRowCount },
      () => `
        <tr class="blank-row">
          <td>&nbsp;</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `
    ).join("");

    const supplierName =
      delivery?.vendor_name ||
      "Not provided";

    const deliveredBy =
      delivery?.driver ||
      delivery?.contact_person ||
      delivery?.submitted_by_name ||
      supplierName;

    const receivedBy =
      delivery?.received_by_name ||
      delivery?.legacy_received_by ||
      delivery?.received_by ||
      "";

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />

  <title>
    ${escapeHtml(
      deliveryNumber
    )} - Delivery Receipt
  </title>

  <style>
    @page {
      size: auto;
      margin: 10mm;
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

    .receipt {
      width: 100%;
      max-width: 7.15in;
      margin: 0 auto;
    }

    .receipt-header {
      display: grid;
      grid-template-columns: 58px 1fr 145px;
      gap: 12px;
      align-items: center;
      padding-bottom: 9px;
      border-bottom: 0.7px solid #555555;
    }

    .receipt-header img {
      width: 50px;
      height: 50px;
      object-fit: contain;
    }

    .receipt-brand h1 {
      margin: 0;
      font-size: 14px;
      line-height: 1.2;
      font-weight: 800;
      text-transform: uppercase;
    }

    .receipt-brand p {
      margin: 3px 0 0;
      font-size: 8px;
      line-height: 1.3;
    }

    .receipt-number {
      text-align: right;
    }

    .receipt-number span,
    .receipt-number strong {
      display: block;
    }

    .receipt-number span {
      margin-bottom: 3px;
      font-size: 7px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .receipt-number strong {
      font-size: 10px;
      letter-spacing: 0.2px;
    }

    .receipt-title {
      margin: 13px 0 11px;
      text-align: center;
    }

    .receipt-title h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .receipt-fields {
      margin-bottom: 8px;
      display: grid;
      grid-template-columns:
        minmax(0, 1fr) 185px;
      column-gap: 22px;
      row-gap: 6px;
    }

    .receipt-field {
      display: flex;
      align-items: flex-end;
      gap: 5px;
      min-width: 0;
      font-size: 8.5px;
    }

    .receipt-field > span {
      flex: 0 0 auto;
      font-weight: 700;
      text-transform: uppercase;
    }

    .receipt-field > strong {
      flex: 1;
      min-width: 0;
      min-height: 15px;
      padding: 0 4px 2px;
      border-bottom: 0.6px solid #666666;
      font-size: 9px;
      font-weight: 500;
      overflow-wrap: anywhere;
    }

    table {
      width: 100%;
      margin-top: 7px;
      border-collapse: collapse;
      table-layout: fixed;
    }

    col.qty {
      width: 10%;
    }

    col.unit {
      width: 11%;
    }

    col.description {
      width: 43%;
    }

    col.price {
      width: 18%;
    }

    col.amount {
      width: 18%;
    }

    th,
    td {
      height: 23px;
      padding: 4px 5px;
      border: 0.45px solid #8a8a8a;
      background: #ffffff;
      color: #111111;
      font-size: 8.5px;
      line-height: 1.25;
      vertical-align: middle;
    }

    th {
      font-size: 8px;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
    }

    .center {
      text-align: center;
    }

    .money {
      text-align: right;
      white-space: nowrap;
    }

    .blank-row td {
      height: 23px;
    }

    .total-row td {
      font-weight: 700;
    }

    .total-label {
      text-align: right;
      text-transform: uppercase;
    }

    .receipt-summary {
      margin-top: 7px;
      display: flex;
      justify-content: flex-end;
      gap: 20px;
      font-size: 8px;
    }

    .receipt-summary span {
      color: #444444;
    }

    .receipt-summary strong {
      margin-left: 4px;
      color: #111111;
    }

    .receipt-certification {
      margin-top: 11px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      font-size: 8px;
      line-height: 1.4;
    }

    .receipt-certification p {
      margin: 0;
    }

    .receipt-signatures {
      margin-top: 32px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 42px;
      page-break-inside: avoid;
    }

    .signature {
      text-align: center;
    }

    .signature-line {
      min-height: 18px;
      padding-bottom: 3px;
      border-bottom: 0.7px solid #444444;
      font-size: 8.5px;
    }

    .signature strong {
      display: block;
      margin-top: 4px;
      font-size: 8px;
    }

    .receipt-footnote {
      margin-top: 16px;
      padding-top: 6px;
      border-top: 0.45px solid #cbd5e1;
      color: #64748b;
      font-size: 7px;
      text-align: center;
    }
  </style>
</head>

<body>
  <main class="receipt">
    <header class="receipt-header">
      <img
        src="${escapeHtml(
          bacnotanLogo
        )}"
        alt="Bacnotan Logo"
      />

      <div class="receipt-brand">
        <h1>
          Bacnotan Farmers Agri-Tourism Center
        </h1>

        <p>
          HiveSync Integrated Business and Operations Management System
        </p>
      </div>

      <div class="receipt-number">
        <span>Delivery Receipt No.</span>

        <strong>
          ${escapeHtml(
            receiptNumber
          )}
        </strong>
      </div>
    </header>

    <section class="receipt-title">
      <h2>Delivery Receipt</h2>
    </section>

    <section class="receipt-fields">
      <div class="receipt-field">
        <span>Delivered To</span>

        <strong>
          BACNOTAN FARMERS AGRI-TOURISM CENTER
        </strong>
      </div>

      <div class="receipt-field">
        <span>Date</span>

        <strong>
          ${escapeHtml(
            formatDate(
              delivery?.delivery_date
            )
          )}
        </strong>
      </div>

      <div class="receipt-field">
        <span>Supplier</span>

        <strong>
          ${escapeHtml(
            supplierName
          )}
        </strong>
      </div>

      <div class="receipt-field">
        <span>Delivered By</span>

        <strong>
          ${escapeHtml(
            deliveredBy
          )}
        </strong>
      </div>

      <div class="receipt-field">
        <span>Delivery No.</span>

        <strong>
          ${escapeHtml(
            deliveryNumber
          )}
        </strong>
      </div>

      <div class="receipt-field">
        <span>Status</span>

        <strong>
          ${escapeHtml(
            delivery?.status ||
              "Delivered"
          )}
        </strong>
      </div>
    </section>

    <table>
      <colgroup>
        <col class="qty" />
        <col class="unit" />
        <col class="description" />
        <col class="price" />
        <col class="amount" />
      </colgroup>

      <thead>
        <tr>
          <th>Qty.</th>
          <th>Unit</th>
          <th>Description</th>
          <th>Price</th>
          <th>Amount</th>
        </tr>
      </thead>

      <tbody>
        ${
          rows ||
          `
            <tr>
              <td
                colspan="5"
                class="center"
              >
                No delivery item details available.
              </td>
            </tr>
          `
        }

        ${blankRows}

        <tr class="total-row">
          <td colspan="3"></td>

          <td class="total-label">
            Total
          </td>

          <td class="money">
            ${escapeHtml(
              formatPeso(
                supplierPayable
              )
            )}
          </td>
        </tr>
      </tbody>
    </table>

    <div class="receipt-summary">
      <span>
        Product Lines:
        <strong>
          ${escapeHtml(
            items.length
          )}
        </strong>
      </span>

      <span>
        Total Quantity:
        <strong>
          ${escapeHtml(
            totalQuantity
          )}
        </strong>
      </span>
    </div>

    <section class="receipt-certification">
      <p>
        Checked and certified that the above merchandise was received and recorded in HiveSync.
      </p>

      <p>
        Received in good order and condition, subject to the recorded delivery details.
      </p>
    </section>

    <section class="receipt-signatures">
      <div class="signature">
        <div class="signature-line">
          ${escapeHtml(
            receivedBy
          )}
        </div>

        <strong>
          Checked / Received By
        </strong>
      </div>

      <div class="signature">
        <div class="signature-line">
          ${escapeHtml(
            supplierName
          )}
        </div>

        <strong>
          Supplier / Delivered By
        </strong>
      </div>
    </section>

    <footer class="receipt-footnote">
      This delivery receipt was generated through HiveSync.
    </footer>
  </main>

  <script>
    window.addEventListener(
      "load",
      function () {
        window.setTimeout(
          function () {
            window.focus();
            window.print();
          },
          250
        );
      }
    );
  </script>
</body>
</html>`;
  };

  const getProductImage = (product) => {
    const image =
      product?.product_image_url ||
      product?.product_image ||
      product?.product_image_preview ||
      "";

    if (!image) {
      return "";
    }

    if (
      String(image).startsWith("blob:") ||
      String(image).startsWith("http://") ||
      String(image).startsWith("https://")
    ) {
      return image;
    }

    if (String(image).startsWith("uploads/")) {
      return `${API_BASE}/${image}`;
    }

    if (String(image).startsWith("products/")) {
      return `${API_BASE}/uploads/${image}`;
    }

    return `${API_BASE}/uploads/products/${image}`;
  };

  const showNotice = (type, title, message) => {
    setNotice({
      open: true,
      type,
      title,
      message,
    });
  };

  const closeNotice = () => {
    setNotice({
      open: false,
      type: "success",
      title: "",
      message: "",
    });
  };

  const parseJsonResponse = async (response) => {
    const responseText = await response.text();

    try {
      return JSON.parse(responseText);
    } catch {
      console.error("Invalid server response:", responseText);

      throw new Error(
        "The server returned an invalid response. Check the PHP endpoint for errors."
      );
    }
  };

  const getCsrfToken = async () => {
    const response = await fetch(
      `${API_BASE}/auth/csrf_token.php`,
      {
        credentials: "include",
        cache: "no-store",
      }
    );

    const data = await parseJsonResponse(response);

    if (
      !response.ok ||
      !data.success ||
      !data.csrf_token
    ) {
      throw new Error(
        data.message ||
          "Unable to verify the security token."
      );
    }

    return data.csrf_token;
  };

  const logAudit = async (action, details) => {
    try {
      await fetch(`${API_BASE}/audit_trail/log_action.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user?.user_id || 1,
          user_name: user?.full_name || "Unknown User",
          module: "Delivery Management",
          action,
          details,
        }),
      });
    } catch (error) {
      console.error("Audit Trail error:", error);
    }
  };

  const loadDeliveries = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      params.set("time", Date.now().toString());

      if (isSupplier) {
        if (!supplierVendorId) {
          console.warn(
            "Supplier account has no vendor_id/supplier_id assigned:",
            user
          );

          setDeliveries([]);
          return;
        }

        params.set(
          "vendor_id",
          String(supplierVendorId)
        );
      }

      const response = await fetch(
        `${API_BASE}/delivery_management/get_deliveries.php?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to retrieve delivery records."
        );
      }

      let loadedDeliveries = Array.isArray(data.deliveries)
        ? data.deliveries
        : [];

      if (isSupplier) {
        loadedDeliveries = loadedDeliveries.filter(
          (delivery) =>
            String(delivery.vendor_id) ===
            String(supplierVendorId)
        );
      }

      setDeliveries(loadedDeliveries);
    } catch (error) {
      console.error(
        "Delivery loading error:",
        error
      );

      setDeliveries([]);

      showNotice(
        "error",
        "Unable to Load Deliveries",
        error.message ||
          "Delivery records could not be retrieved."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadRestockRequests = async () => {
    if (!isSupplier || !supplierVendorId) {
      setRestockRequests([]);
      return;
    }

    setRestockRequestsLoading(true);

    try {
      const restockUrl =
        `${API_BASE}/delivery_management/get_restock_requests.php?vendor_id=${encodeURIComponent(
          supplierVendorId
        )}&time=${Date.now()}`;

      const response = await fetch(restockUrl, {
        credentials: "include",
      });
      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to load restock requests."
        );
      }

      const loadedRequests =
        Array.isArray(data.requests)
          ? data.requests
          : [];

      console.log(
        "Supplier restock requests loaded:",
        {
          vendorId: supplierVendorId,
          count: loadedRequests.length,
          requests: loadedRequests,
        }
      );

      setRestockRequests(loadedRequests);
    } catch (error) {
      console.error(
        "Restock request loading error:",
        error
      );

      setRestockRequests([]);

      showNotice(
        "error",
        "Unable to Load Restock Requests",
        error.message ||
          "Inventory restock requests could not be retrieved."
      );
    } finally {
      setRestockRequestsLoading(false);
    }
  };

  const loadReferenceData = async () => {
    setReferenceLoading(true);

    try {
      if (isSupplier) {
        const [
          productResponse,
          categoryResponse,
        ] = await Promise.all([
          fetch(
            `${API_BASE}/inventory_management/get_products.php?time=${Date.now()}`,
            {
              credentials: "include",
            }
          ),
          fetch(
            `${API_BASE}/inventory_management/get_categories.php?time=${Date.now()}`,
            {
              credentials: "include",
            }
          ),
        ]);

        const [
          productData,
          categoryData,
        ] = await Promise.all([
          parseJsonResponse(productResponse),
          parseJsonResponse(categoryResponse),
        ]);

        if (!productResponse.ok || !productData.success) {
          throw new Error(
            productData.message || "Unable to load products."
          );
        }

        if (!categoryResponse.ok || !categoryData.success) {
          throw new Error(
            categoryData.message || "Unable to load categories."
          );
        }

        const supplierProductRows =
          (productData.products || []).filter(
            (product) =>
              String(product.status || "")
                .trim()
                .toLowerCase() !== "archived" &&
              String(product.vendor_id) ===
                String(supplierVendorId)
          );

        const firstSupplierProduct =
          supplierProductRows[0] || null;

        setVendors([
          {
            vendor_id: supplierVendorId,
            vendor_name:
              firstSupplierProduct?.vendor_name ||
              user?.vendor_name ||
              user?.supplier_name ||
              user?.full_name ||
              "Supplier",
            contact_person:
              user?.full_name ||
              firstSupplierProduct?.contact_person ||
              "",
            phone:
              user?.phone ||
              user?.contact_number ||
              firstSupplierProduct?.phone ||
              "",
            address:
              user?.address ||
              firstSupplierProduct?.address ||
              "",
            status: "Active",
          },
        ]);

        setProducts(supplierProductRows);
        setCategories(categoryData.categories || []);
        setUsers([]);

        return;
      }

      const [
        vendorResponse,
        productResponse,
        categoryResponse,
        userResponse,
      ] = await Promise.all([
        fetch(
          `${API_BASE}/vendor_management/get_vendors.php?time=${Date.now()}`,
          {
            credentials: "include",
          }
        ),
        fetch(
          `${API_BASE}/inventory_management/get_products.php?time=${Date.now()}`,
          {
            credentials: "include",
          }
        ),
        fetch(
          `${API_BASE}/inventory_management/get_categories.php?time=${Date.now()}`,
          {
            credentials: "include",
          }
        ),
        fetch(
          `${API_BASE}/user_management/get_users.php?time=${Date.now()}`,
          {
            credentials: "include",
          }
        ),
      ]);

      const [
        vendorData,
        productData,
        categoryData,
        userData,
      ] = await Promise.all([
        parseJsonResponse(vendorResponse),
        parseJsonResponse(productResponse),
        parseJsonResponse(categoryResponse),
        parseJsonResponse(userResponse),
      ]);

      if (!vendorResponse.ok || !vendorData.success) {
        throw new Error(
          vendorData.message || "Unable to load suppliers."
        );
      }

      if (!productResponse.ok || !productData.success) {
        throw new Error(
          productData.message || "Unable to load products."
        );
      }

      if (!categoryResponse.ok || !categoryData.success) {
        throw new Error(
          categoryData.message || "Unable to load categories."
        );
      }

      if (!userResponse.ok || !userData.success) {
        throw new Error(
          userData.message || "Unable to load employees."
        );
      }

      setVendors(
        (vendorData.vendors || []).filter(
          (vendor) => vendor.status !== "Archived"
        )
      );

      setProducts(
        (productData.products || []).filter(
          (product) => product.status !== "Archived"
        )
      );

      setCategories(categoryData.categories || []);

      setUsers(
        (userData.users || []).filter(
          (systemUser) => systemUser.status === "Active"
        )
      );
    } catch (error) {
      console.error("Reference loading error:", error);

      showNotice(
        "error",
        "Unable to Load Delivery Form",
        error.message ||
          "Supplier, product, category, or employee records could not be loaded."
      );
    } finally {
      setReferenceLoading(false);
    }
  };

  const loadDeliveryDetails = async (deliveryId) => {
    setDetailsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/delivery_management/get_delivery_details.php?delivery_id=${deliveryId}&time=${Date.now()}`,
        {
          credentials: "include",
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to retrieve delivery details."
        );
      }

      return data.delivery;
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
    loadReferenceData();
  }, [
    user?.user_id,
    user?.vendor_id,
    user?.supplier_id,
    role,
  ]);

  useEffect(() => {
    if (!isSupplier) {
      setRestockRequests([]);
      return;
    }

    if (!supplierVendorId) {
      setRestockRequests([]);
      return;
    }

    loadRestockRequests();
  }, [
    isSupplier,
    supplierVendorId,
    user?.user_id,
  ]);

  useEffect(() => {
    if (!focusDeliveryId || loading || deliveries.length === 0) {
      return;
    }

    const target = deliveries.find(
      (delivery) =>
        String(delivery.delivery_id) ===
        String(focusDeliveryId)
    );

    if (!target) {
      return;
    }

    if (
      String(target.submission_source || "")
        .toLowerCase() === "supplier"
    ) {
      setActiveDeliveryTab("requests");
    }

    openDeliveryDetails(target);
  }, [focusDeliveryId, loading, deliveries]);

  const visibleVendors = useMemo(() => {
    if (!isSupplier) {
      return vendors;
    }

    return vendors.filter(
      (vendor) =>
        String(vendor.vendor_id) ===
        String(supplierVendorId)
    );
  }, [vendors, isSupplier, supplierVendorId]);

  const selectedSupplier = useMemo(
    () =>
      vendors.find(
        (vendor) =>
          String(vendor.vendor_id) ===
          String(formData.vendor_id)
      ) || null,
    [vendors, formData.vendor_id]
  );

  const pendingRestockRequests = useMemo(() => {
    return restockRequests.filter((request) => {
      return (
        String(request?.status || "")
          .trim()
          .toLowerCase() === "pending supplier"
      );
    });
  }, [restockRequests]);

  const supplierProducts = useMemo(() => {
    if (!formData.vendor_id) {
      return [];
    }

    return products.filter((product) => {
      const belongsToSupplier =
        String(product.vendor_id) ===
        String(formData.vendor_id);

      const isActive =
        String(product.status || "")
          .trim()
          .toLowerCase() !== "archived";

      return belongsToSupplier && isActive;
    });
  }, [products, formData.vendor_id]);

  const computedSummary = useMemo(() => {
    const activeItems = isSupplier
      ? formData.items.filter(
          (item) =>
            item.product_id &&
            item.selected_for_delivery !== false
        )
      : formData.items;

    const familyKeys = new Set();

    const summary = activeItems.reduce(
      (result, item) => {
        const quantity = Math.max(
          0,
          Number(item.quantity || 0)
        );

        const supplierPrice = Math.max(
          0,
          Number(item.supplier_price || 0)
        );

        const retailPrice = Math.max(
          0,
          Number(item.retail_price || 0)
        );

        if (
          item.product_id ||
          item.product_name.trim() ||
          quantity > 0
        ) {
          result.selectedVariants += 1;
          familyKeys.add(
            item.family_group_key ||
              item.family_id ||
              item.product_id ||
              item.local_id
          );
        }

        result.totalUnits += quantity;
        result.supplierPayable +=
          quantity * supplierPrice;
        result.retailValue +=
          quantity * retailPrice;

        return result;
      },
      {
        productLines: 0,
        selectedVariants: 0,
        totalUnits: 0,
        supplierPayable: 0,
        retailValue: 0,
      }
    );

    summary.productLines = isSupplier
      ? familyKeys.size
      : summary.selectedVariants;

    return summary;
  }, [formData.items, isSupplier]);

  const deliveryStatistics = useMemo(() => {
    const statisticsDeliveries = isSupplier
      ? deliveries.filter(
          (delivery) =>
            String(delivery.vendor_id) ===
            String(supplierVendorId)
        )
      : deliveries;

    const supplierRequests =
      statisticsDeliveries.filter(
        (delivery) =>
          String(delivery.submission_source || "")
            .trim()
            .toLowerCase() === "supplier"
      );

    return {
      pending: statisticsDeliveries.filter(
        (delivery) =>
          delivery.status === "Pending"
      ).length,

      inTransit: statisticsDeliveries.filter(
        (delivery) =>
          delivery.status === "In Transit"
      ).length,

      delivered: statisticsDeliveries.filter(
        (delivery) =>
          delivery.status === "Delivered"
      ).length,

      rejected: statisticsDeliveries.filter(
        (delivery) =>
          delivery.status === "Rejected"
      ).length,

      cancelled: statisticsDeliveries.filter(
        (delivery) =>
          delivery.status === "Cancelled"
      ).length,

      pendingSupplierRequests:
        supplierRequests.filter(
          (delivery) =>
            delivery.status === "Pending"
        ).length,

      supplierApproved:
        supplierRequests.filter(
          (delivery) =>
            delivery.status === "Approved" ||
            delivery.status === "Delivered"
        ).length,

      supplierRejected:
        supplierRequests.filter(
          (delivery) =>
            delivery.status === "Rejected"
        ).length,

      supplierTotalRequests:
        supplierRequests.length,
    };
  }, [
    deliveries,
    isSupplier,
    supplierVendorId,
  ]);

  const filteredDeliveries = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return deliveries.filter((delivery) => {
      const supplierRequest =
        String(delivery.submission_source || "")
          .trim()
          .toLowerCase() === "supplier";

      if (
        activeDeliveryTab === "requests" &&
        !supplierRequest
      ) {
        return false;
      }

      if (
        isSupplier &&
        String(delivery.vendor_id) !==
          String(supplierVendorId)
      ) {
        return false;
      }

      const matchesStatus =
        statusFilter === "All" ||
        delivery.status === statusFilter;

      const searchableFields = [
        delivery.delivery_order_no,
        delivery.vendor_name,
        delivery.contact_person,
        delivery.driver,
        delivery.received_by,
        delivery.noted_by,
        delivery.submitted_by_name,
        delivery.reviewed_by_name,
        delivery.submission_source,
        delivery.status,
        delivery.workflow_status,
        delivery.delivery_date,
        delivery.proposed_product_names,
      ];

      const matchesSearch =
        !keyword ||
        searchableFields.some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(keyword)
        );

      return matchesStatus && matchesSearch;
    });
  }, [
    deliveries,
    searchTerm,
    statusFilter,
    activeDeliveryTab,
    isSupplier,
    supplierVendorId,
  ]);

  const paginatedDeliveries = useMemo(() => {
    const start =
      (deliveryPage - 1) *
      DELIVERY_PAGE_SIZE;

    return filteredDeliveries.slice(
      start,
      start + DELIVERY_PAGE_SIZE
    );
  }, [
    filteredDeliveries,
    deliveryPage,
  ]);

  useEffect(() => {
    setDeliveryPage(1);
  }, [
    searchTerm,
    statusFilter,
    activeDeliveryTab,
  ]);

  const sortedFilteredDeliveries = useMemo(() => {
    const records = [...filteredDeliveries];

    const getTimestamp = (delivery) => {
      const raw =
        delivery?.submitted_at ||
        delivery?.created_at ||
        delivery?.delivery_date ||
        "";

      const normalized = String(raw).includes("T")
        ? String(raw)
        : String(raw).replace(" ", "T");

      const parsed = new Date(normalized).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return records.sort((a, b) => {
      const diff = getTimestamp(b) - getTimestamp(a);
      return requestSort === "oldest" ? -diff : diff;
    });
  }, [filteredDeliveries, requestSort]);

  const openPublishDeliveryProducts = async (
    delivery
  ) => {
    if (
      !canManageDeliveries ||
      saving ||
      publishing
    ) {
      return;
    }

    if (
      String(delivery?.status || "") !==
      "Delivered"
    ) {
      showNotice(
        "error",
        "Delivery Must Be Received",
        "Products can only be priced and published after physical receiving."
      );
      return;
    }

    setPublishing(true);

    try {
      const completeDelivery =
        await loadDeliveryDetails(
          delivery.delivery_id
        );

      const prepared = (
        completeDelivery.items || []
      )
        .filter(
          (item) =>
            Number(item.product_id || 0) > 0
        )
        .map((item) => {
          const currentPrice = Number(
            item.selling_price ||
              item.retail_price ||
              0
          );

          return {
            delivery_item_id:
              item.delivery_item_id,
            product_id:
              item.product_id,
            product_name:
              (() => {
                const baseName =
                  item.effective_product_name ||
                  item.product_name ||
                  "Product";

                const explicit = String(
                  item.variant_label || ""
                ).trim();

                const value = String(
                  item.variant_value || ""
                ).trim();

                const unit = String(
                  item.variant_unit || ""
                ).trim();

                const variant =
                  explicit &&
                  explicit.toLowerCase() !== "standard"
                    ? explicit
                    : value || unit
                    ? `${value}${
                        value && unit ? " " : ""
                      }${unit}`.trim()
                    : "";

                return variant
                  ? `${baseName} — ${variant}`
                  : baseName;
              })(),
            sku:
              item.effective_sku ||
              item.sku ||
              "",
            current_selling_price:
              currentPrice,
            final_selling_price:
              currentPrice > 0
                ? String(currentPrice)
                : "",
          };
        });

      const unpublished =
        prepared.filter(
          (item) =>
            Number(
              item.current_selling_price ||
                0
            ) <= 0
        );

      if (prepared.length === 0) {
        throw new Error(
          "No received inventory products were found in this delivery."
        );
      }

      if (unpublished.length === 0) {
        showNotice(
          "success",
          "Products Already Published",
          "All products in this delivery already have final BFATC selling prices."
        );
        return;
      }

      setPublishingDelivery(
        completeDelivery
      );
      setPublishingItems(
        unpublished
      );
      setShowPublishModal(true);
    } catch (error) {
      showNotice(
        "error",
        "Unable to Prepare Publishing",
        error.message ||
          "Delivered products could not be loaded."
      );
    } finally {
      setPublishing(false);
    }
  };

  const closePublishModal = () => {
    if (publishing) {
      return;
    }

    setShowPublishModal(false);
    setPublishingDelivery(null);
    setPublishingItems([]);
  };

  const updatePublishingPrice = (
    index,
    value
  ) => {
    setPublishingItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              final_selling_price:
                value,
            }
          : item
      )
    );
  };

  const submitPublishDeliveryProducts =
    async () => {
      if (
        !publishingDelivery ||
        publishing
      ) {
        return;
      }

      for (
        let index = 0;
        index < publishingItems.length;
        index += 1
      ) {
        const item =
          publishingItems[index];

        if (
          Number(
            item.final_selling_price ||
              0
          ) <= 0
        ) {
          showNotice(
            "error",
            "Final Selling Price Required",
            `Enter BFATC's final selling price for ${
              item.product_name ||
              `Product ${index + 1}`
            }.`
          );
          return;
        }
      }

      setPublishing(true);

      try {
        const csrfToken = await getCsrfToken();

        const response = await fetch(
          `${API_BASE}/delivery_management/publish_delivery_products.php`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({
              delivery_id:
                publishingDelivery.delivery_id,
              published_by_user_id:
                user?.user_id || null,
              published_by_name:
                user?.full_name ||
                user?.name ||
                "System User",
              items:
                publishingItems.map(
                  (item) => ({
                    delivery_item_id:
                      item.delivery_item_id,
                    product_id:
                      item.product_id,
                    final_selling_price:
                      Number(
                        item.final_selling_price ||
                          0
                      ),
                  })
                ),
            }),
          }
        );

        const data =
          await parseJsonResponse(
            response
          );

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Unable to publish the delivered products."
          );
        }

        setShowPublishModal(false);
        setPublishingDelivery(null);
        setPublishingItems([]);

        await loadDeliveries();

        loadReferenceData().catch((referenceError) => {
          console.warn(
            "Delivery reference refresh error:",
            referenceError
          );
        });

        if (
          selectedDelivery?.delivery_id
        ) {
          const refreshed =
            await loadDeliveryDetails(
              selectedDelivery.delivery_id
            );

          setSelectedDelivery(
            refreshed
          );
        }

        showNotice(
          "success",
          "Products Published",
          data.message ||
            "Final prices were saved. Eligible products are now available to the Landing Page and POS."
        );
      } catch (error) {
        showNotice(
          "error",
          "Unable to Publish Products",
          error.message ||
            "Final selling prices could not be saved."
        );
      } finally {
        setPublishing(false);
      }
    };

  const resetForm = () => {
    setResubmittingDeliveryId(null);
    setActiveRestockRequestId(null);
    setFormData(createInitialForm());
  };

  const openDeliveryModal = () => {
    if (!canCreateDelivery) {
      showNotice(
        "error",
        "Permission Denied",
        "You do not have permission to create a delivery."
      );
      return;
    }

    resetForm();
    setShowDeliveryModal(true);
  };

  const openDeliveryFromRestock = (request) => {
    if (!isSupplier) return;

    const preferredDate =
      request.preferred_delivery_date &&
      request.preferred_delivery_date >= today
        ? request.preferred_delivery_date
        : today;

    const matchedProduct =
      products.find(
        (product) =>
          String(product.product_id) ===
          String(request.product_id)
      ) ||
      products.find(
        (product) =>
          request.sku &&
          String(product.sku || "") ===
            String(request.sku)
      ) ||
      null;

    const resolvedProductId =
      matchedProduct?.product_id ??
      request.product_id ??
      "";

    const resolvedFamilyId =
      matchedProduct?.family_id ??
      request.family_id ??
      resolvedProductId;

    const resolvedVariantLabel =
      matchedProduct
        ? getProductVariantLabel(
            matchedProduct
          )
        : request.variant_label ||
          getProductVariantLabel(request);

    const resolvedVariantValue =
      matchedProduct?.variant_value ??
      request.variant_value ??
      "";

    const resolvedVariantUnit =
      matchedProduct?.variant_unit ??
      request.variant_unit ??
      "";

    const resolvedVariantSort =
      Number(
        matchedProduct?.variant_sort ??
          request.variant_sort ??
          0
      );

    const resolvedSku =
      matchedProduct?.sku ||
      request.sku ||
      "";

    const resolvedProductName =
      matchedProduct?.product_name ||
      request.product_name ||
      "";

    const resolvedCategoryId =
      matchedProduct?.category_id ??
      request.category_id ??
      "";

    const resolvedCategory =
      matchedProduct?.category_name ||
      matchedProduct?.category ||
      request.category ||
      "";

    const resolvedUnit =
      matchedProduct?.unit_type ||
      matchedProduct?.unit ||
      request.unit_type ||
      "pcs";

    const resolvedSupplierPrice =
      matchedProduct?.supplier_price ??
      request.supplier_price ??
      "";

    const resolvedSellingPrice =
      matchedProduct?.selling_price ??
      matchedProduct?.unit_price ??
      request.selling_price ??
      "";

    setResubmittingDeliveryId(null);
    setActiveRestockRequestId(
      Number(request.restock_request_id)
    );

    setFormData({
      ...createInitialForm(),
      vendor_id: String(
        request.vendor_id ||
          supplierVendorId
      ),
      delivery_date: preferredDate,
      remarks: request.remarks
        ? `Restock ${request.request_no}: ${request.remarks}`
        : `Restock request ${request.request_no}`,
      status: "Pending",
      items: [
        {
          ...createEmptyItem(),
          is_new_product: 0,

          selected_for_delivery: true,

          product_id: String(
            resolvedProductId
          ),

          family_id: String(
            resolvedFamilyId || ""
          ),

          family_group_key:
            resolvedFamilyId
              ? `family-${resolvedFamilyId}`
              : "",

          request_variant_id: String(
            request.request_variant_id ||
              matchedProduct?.request_variant_id ||
              ""
          ),

          variant_label:
            resolvedVariantLabel,

          variant_value:
            resolvedVariantValue,

          variant_unit:
            resolvedVariantUnit,

          variant_sort:
            resolvedVariantSort,

          product_name:
            resolvedProductName,

          description:
            matchedProduct?.description ||
            matchedProduct?.product_description ||
            "",

          sku: resolvedSku,

          category_id: String(
            resolvedCategoryId || ""
          ),

          category:
            resolvedCategory,

          unit_type:
            resolvedUnit,

          unit:
            resolvedUnit,

          reorder_level: Number(
            matchedProduct?.reorder_level ??
              request.reorder_level ??
              0
          ),

          quantity: Number(
            request.requested_quantity ||
              1
          ),

          supplier_price: String(
            resolvedSupplierPrice
          ),

          retail_price: String(
            resolvedSellingPrice
          ),

          expiry_date: "",

          product_image_preview:
            getProductImage(
              matchedProduct ||
                request
            ),
        },
      ],
    });

    setShowDeliveryModal(true);
  };

  const closeDeliveryModal = () => {
    if (saving) {
      return;
    }

    formData.items.forEach((item) => {
      if (
        item.product_image_preview &&
        String(item.product_image_preview).startsWith("blob:")
      ) {
        URL.revokeObjectURL(item.product_image_preview);
      }
    });

    setShowDeliveryModal(false);
    resetForm();
  };

  const handleHeaderChange = (event) => {
    const { name, value } = event.target;

    if (name === "delivery_date" && value < today) {
      showNotice(
        "error",
        "Invalid Delivery Date",
        "Past delivery dates are not allowed."
      );

      return;
    }

    if (
      name === "due_date" &&
      value &&
      value < formData.delivery_date
    ) {
      showNotice(
        "error",
        "Invalid Due Date",
        "Payment due date cannot be earlier than the delivery date."
      );

      return;
    }

    if (name === "delivery_date") {
      setFormData((current) => ({
        ...current,
        delivery_date: value,
        items: current.items.map((item) => {
          if (Number(item.is_consignment) !== 1) {
            return item;
          }

          return {
            ...item,
            consignment_start_date: value,
            consignment_pullout_date:
              item.consignment_pullout_date &&
              item.consignment_pullout_date > value
                ? item.consignment_pullout_date
                : "",
          };
        }),
      }));

      return;
    }

    if (
      name === "vendor_id" &&
      isSupplier &&
      String(value) !== String(supplierVendorId)
    ) {
      return;
    }

    if (name === "vendor_id") {
      const matchingProducts = products.filter(
        (product) =>
          String(product.vendor_id) === String(value) &&
          String(product.status || "")
            .trim()
            .toLowerCase() !== "archived"
      );

      let nextItem = createEmptyItem();

      if (matchingProducts.length === 1) {
        const product = matchingProducts[0];

        nextItem = {
          ...nextItem,
          is_new_product: 0,
          product_id: product.product_id,
          family_id:
            product.family_id ||
            product.product_id ||
            "",
          request_variant_id:
            product.request_variant_id || "",
          variant_label:
            getProductVariantLabel(product),
          variant_value:
            product.variant_value ?? "",
          variant_unit:
            product.variant_unit || "",
          variant_sort: Number(
            product.variant_sort || 0
          ),
          product_name: product.product_name || "",
          description:
            product.description ||
            product.product_description ||
            "",
          sku: product.sku || "",
          category_id: product.category_id || "",
          category:
            product.category_name ||
            product.category ||
            "",
          unit_type:
            product.unit_type ||
            product.unit ||
            "pcs",
          unit:
            product.unit ||
            product.unit_type ||
            "pcs",
          reorder_level: Number(
            product.reorder_level || 5
          ),
          supplier_price:
            product.supplier_price || "",
          retail_price:
            product.selling_price ||
            product.unit_price ||
            "",
          expiry_date: "",
          product_image: null,
          product_image_preview:
            getProductImage(product),
          is_consignment: Number(
            product.is_consignment || 0
          ),
          consignment_terms:
            product.consignment_terms || "",
          consignment_start_date:
            Number(product.is_consignment || 0) === 1
              ? formData.delivery_date
              : "",
          consignment_pullout_date:
            product.consignment_pullout_date || "",
          consignment_notes:
            product.consignment_notes || "",
        };
      }

      setFormData((current) => ({
        ...current,
        vendor_id: value,
        items: [nextItem],
      }));

      return;
    }

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const addProductLine = () => {
    setFormData((current) => {
      const item = createEmptyItem();

      return {
        ...current,
        items: [
          ...current.items,
          {
            ...item,
            family_group_key: item.local_id,
          },
        ],
      };
    });
  };

  const removeProductLine = (index) => {
    if (formData.items.length === 1) {
      showNotice(
        "error",
        "Product Required",
        "A delivery must contain at least one product line."
      );

      return;
    }

    const removedItem = formData.items[index];
    const removedGroupKey =
      removedItem?.family_group_key || removedItem?.local_id;

    if (
      removedItem?.product_image_preview &&
      String(removedItem.product_image_preview).startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        removedItem.product_image_preview
      );
    }

    setFormData((current) => ({
      ...current,
      items: isSupplier
        ? current.items.filter(
            (candidate) =>
              (candidate.family_group_key ||
                candidate.local_id) !==
              removedGroupKey
          )
        : current.items.filter(
            (_, currentIndex) =>
              currentIndex !== index
          ),
    }));
  };

  const updateItem = (index, name, value) => {
    setFormData((current) => {
      const updatedItems = [...current.items];

      updatedItems[index] = {
        ...updatedItems[index],
        [name]: value,
      };

      return {
        ...current,
        items: updatedItems,
      };
    });
  };

  const toggleNewProduct = (index) => {
    setFormData((current) => {
      const updatedItems = [...current.items];
      const currentItem = updatedItems[index];

      const isCurrentlyNew =
        Number(currentItem.is_new_product) === 1;

      if (
        currentItem.product_image_preview &&
        String(currentItem.product_image_preview).startsWith(
          "blob:"
        )
      ) {
        URL.revokeObjectURL(
          currentItem.product_image_preview
        );
      }

      updatedItems[index] = {
        ...createEmptyItem(),
        local_id: currentItem.local_id,
        is_new_product: isCurrentlyNew ? 0 : 1,
      };

      return {
        ...current,
        items: updatedItems,
      };
    });
  };

  const getProductFamilyKey = (product) => {
    if (product?.family_id) {
      return `family-${product.family_id}`;
    }

    return `legacy-${String(product?.product_name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
  };

  const getProductVariantLabel = (product) => {
    const explicit = String(product?.variant_label || "").trim();

    if (explicit && explicit.toLowerCase() !== "standard") {
      return explicit;
    }

    const value = String(product?.variant_value || "").trim();
    const unit = String(product?.variant_unit || "").trim();

    if (value || unit) {
      return `${value}${value && unit ? " " : ""}${unit}`.trim();
    }

    return explicit || "Standard";
  };

  const getProductDisplayName = (product) => {
    const baseName =
      product?.proposed_product_name ||
      product?.effective_product_name ||
      product?.product_display_name ||
      product?.product_name ||
      "Unnamed Product";

    const variantLabel = getProductVariantLabel(product);

    return variantLabel &&
      variantLabel.toLowerCase() !== "standard"
      ? `${baseName} — ${variantLabel}`
      : baseName;
  };

  const selectProductFamily = (index, familyKey) => {
    const familyVariants = products
      .filter(
        (product) =>
          getProductFamilyKey(product) === familyKey &&
          String(product.vendor_id) === String(formData.vendor_id) &&
          String(product.status || "")
            .trim()
            .toLowerCase() !== "archived"
      )
      .sort((a, b) =>
        getProductVariantLabel(a).localeCompare(
          getProductVariantLabel(b),
          undefined,
          { numeric: true }
        )
      );

    setFormData((current) => {
      const currentItem = current.items[index] || createEmptyItem();
      const currentGroupKey =
        currentItem.family_group_key || currentItem.local_id;

      const before = current.items.filter((_, itemIndex) => {
        if (itemIndex === index) return false;

        const candidate = current.items[itemIndex];
        return (
          (candidate.family_group_key || candidate.local_id) !==
          currentGroupKey
        );
      });

      if (!familyKey || familyVariants.length === 0) {
        const emptyItem = {
          ...createEmptyItem(),
          local_id: currentItem.local_id,
          family_group_key: currentItem.local_id,
        };

        const insertAt = Math.min(index, before.length);
        const nextItems = [...before];
        nextItems.splice(insertAt, 0, emptyItem);

        return {
          ...current,
          items: nextItems,
        };
      }

      const groupKey = `${familyKey}-${currentItem.local_id}`;

      const expanded = familyVariants.map(
        (product, variantIndex) => ({
          ...createEmptyItem(),
          local_id:
            variantIndex === 0
              ? currentItem.local_id
              : `${Date.now()}-${Math.random()}-${variantIndex}`,
          family_group_key: groupKey,
          selected_for_delivery: true,
          is_new_product: 0,
          product_id: product.product_id,
          family_id:
            product.family_id ||
            product.product_id ||
            "",
          request_variant_id:
            product.request_variant_id || "",
          variant_label: getProductVariantLabel(product),
          variant_value:
            product.variant_value ?? "",
          variant_unit: product.variant_unit || "",
          variant_sort: Number(
            product.variant_sort || 0
          ),
          product_name: product.product_name || "",
          description:
            product.description ||
            product.product_description ||
            "",
          sku: product.sku || "",
          category_id: product.category_id || "",
          category:
            product.category_name ||
            product.category ||
            "",
          unit_type:
            product.unit_type ||
            product.unit ||
            "pcs",
          unit:
            product.unit ||
            product.unit_type ||
            "pcs",
          reorder_level: Number(
            product.reorder_level || 5
          ),
          quantity: 1,
          supplier_price:
            product.supplier_price || "",
          retail_price:
            product.selling_price ||
            product.unit_price ||
            "",
          expiry_date: "",
          product_image: null,
          product_image_preview:
            getProductImage(product),
          is_consignment: Number(
            product.is_consignment || 0
          ),
          consignment_terms:
            product.consignment_terms || "",
          consignment_start_date:
            Number(product.is_consignment || 0) === 1
              ? current.delivery_date
              : "",
          consignment_pullout_date:
            product.consignment_pullout_date || "",
          consignment_notes:
            product.consignment_notes || "",
        })
      );

      const insertAt = Math.min(index, before.length);
      const nextItems = [...before];
      nextItems.splice(insertAt, 0, ...expanded);

      return {
        ...current,
        items: nextItems,
      };
    });
  };

  const selectExistingProduct = (index, productId) => {
    const product = products.find(
      (currentProduct) =>
        String(currentProduct.product_id) ===
        String(productId)
    );

    if (!product) {
      updateItem(index, "product_id", "");
      return;
    }

    setFormData((current) => {
      const updatedItems = [...current.items];

      updatedItems[index] = {
        ...updatedItems[index],
        is_new_product: 0,
        product_id: product.product_id,
        family_id:
          product.family_id ||
          product.product_id ||
          "",
        request_variant_id:
          product.request_variant_id || "",
        variant_label: getProductVariantLabel(product),
        variant_value:
          product.variant_value ?? "",
        variant_unit: product.variant_unit || "",
        variant_sort: Number(
          product.variant_sort || 0
        ),
        product_name: product.product_name || "",
        description:
          product.description ||
          product.product_description ||
          "",
        sku: product.sku || "",
        category_id: product.category_id || "",
        category:
          product.category_name ||
          product.category ||
          "",
        unit_type:
          product.unit_type || product.unit || "pcs",
        unit:
          product.unit || product.unit_type || "pcs",
        reorder_level: Number(
          product.reorder_level || 5
        ),
        supplier_price: product.supplier_price || "",
        retail_price:
          product.selling_price ||
          product.unit_price ||
          "",
        expiry_date: "",
        product_image: null,
        product_image_preview: getProductImage(product),
        is_consignment: Number(
          product.is_consignment || 0
        ),
        consignment_terms:
          product.consignment_terms || "",
        consignment_start_date:
          Number(product.is_consignment || 0) === 1
            ? formData.delivery_date
            : "",
        consignment_pullout_date:
          product.consignment_pullout_date || "",
        consignment_notes:
          product.consignment_notes || "",
      };

      return {
        ...current,
        items: updatedItems,
      };
    });
  };

  const handleItemInput = (index, event) => {
    const { name, value, files } = event.target;

    if (name === "product_image") {
      const file = files?.[0] || null;

      const oldPreview =
        formData.items[index].product_image_preview;

      if (
        oldPreview &&
        String(oldPreview).startsWith("blob:")
      ) {
        URL.revokeObjectURL(oldPreview);
      }

      setFormData((current) => {
        const updatedItems = [...current.items];

        updatedItems[index] = {
          ...updatedItems[index],
          product_image: file,
          product_image_preview: file
            ? URL.createObjectURL(file)
            : "",
        };

        return {
          ...current,
          items: updatedItems,
        };
      });

      return;
    }

    if (name === "category_id") {
      const category = categories.find(
        (currentCategory) =>
          String(currentCategory.category_id) ===
          String(value)
      );

      setFormData((current) => {
        const updatedItems = [...current.items];

        updatedItems[index] = {
          ...updatedItems[index],
          category_id: value,
          category: category?.category_name || "",
        };

        return {
          ...current,
          items: updatedItems,
        };
      });

      return;
    }

    if (name === "family_id") {
      selectProductFamily(index, value);
      return;
    }

    if (name === "product_id") {
      selectExistingProduct(index, value);
      return;
    }

    updateItem(index, name, value);
  };

  const openConsignment = (index) => {
    setFormData((current) => {
      const updatedItems = [...current.items];
      const currentItem = updatedItems[index];

      updatedItems[index] = {
        ...currentItem,
        consignment_start_date:
          current.delivery_date || today,
        consignment_pullout_date:
          currentItem.consignment_pullout_date &&
          currentItem.consignment_pullout_date >
            (current.delivery_date || today)
            ? currentItem.consignment_pullout_date
            : "",
      };

      return {
        ...current,
        items: updatedItems,
      };
    });

    setConsignmentIndex(index);
    setShowConsignmentModal(true);
  };

  const closeConsignment = () => {
    setShowConsignmentModal(false);
    setConsignmentIndex(null);
  };

  const saveConsignment = () => {
    if (consignmentIndex === null) {
      return;
    }

    const item = formData.items[consignmentIndex];
    const consignmentStartDate =
      formData.delivery_date || today;

    if (!item.consignment_pullout_date) {
      showNotice(
        "error",
        "Pull-out Date Required",
        "Select the expected pull-out date."
      );

      return;
    }

    if (
      item.consignment_pullout_date <=
      consignmentStartDate
    ) {
      showNotice(
        "error",
        "Invalid Pull-out Date",
        "Pull-out date must be later than the delivery date."
      );

      return;
    }

    setFormData((current) => {
      const updatedItems = [...current.items];

      updatedItems[consignmentIndex] = {
        ...updatedItems[consignmentIndex],
        is_consignment: 1,
        consignment_start_date:
          current.delivery_date || today,
      };

      return {
        ...current,
        items: updatedItems,
      };
    });

    closeConsignment();
  };

  const disableConsignment = (index) => {
    setFormData((current) => {
      const updatedItems = [...current.items];

      updatedItems[index] = {
        ...updatedItems[index],
        is_consignment: 0,
        consignment_terms: "",
        consignment_start_date: "",
        consignment_pullout_date: "",
        consignment_notes: "",
      };

      return {
        ...current,
        items: updatedItems,
      };
    });
  };

  const validateForm = () => {
    if (!formData.vendor_id) {
      showNotice(
        "error",
        "Supplier Required",
        "Select the supplier for this delivery."
      );

      return false;
    }

    if (!formData.delivery_date) {
      showNotice(
        "error",
        "Delivery Date Required",
        "Select the delivery date."
      );

      return false;
    }

    if (formData.delivery_date < today) {
      showNotice(
        "error",
        "Invalid Delivery Date",
        "Past delivery dates are not allowed."
      );

      return false;
    }

    if (
      !isSupplier &&
      !formData.received_by.trim()
    ) {
      showNotice(
        "error",
        "Receiver Required",
        "Select the employee who received the delivery."
      );

      return false;
    }

    if (
      formData.due_date &&
      formData.due_date < formData.delivery_date
    ) {
      showNotice(
        "error",
        "Invalid Due Date",
        "Payment due date cannot be earlier than the delivery date."
      );

      return false;
    }

    if (
      !Array.isArray(formData.items) ||
      formData.items.length === 0
    ) {
      showNotice(
        "error",
        "Products Required",
        "Add at least one product to this delivery."
      );

      return false;
    }

    if (isSupplier) {
      const groups = new Map();

      formData.items.forEach((item, index) => {
        const key =
          item.family_group_key || item.local_id;

        if (!groups.has(key)) {
          groups.set(key, []);
        }

        groups.get(key).push({ item, index });
      });

      for (const group of groups.values()) {
        const hasSelectedVariant = group.some(
          ({ item }) =>
            item.product_id &&
            item.selected_for_delivery !== false
        );

        if (!hasSelectedVariant) {
          showNotice(
            "error",
            "Select a Variant",
            "Select at least one approved size / variant for every product family in the delivery."
          );

          return false;
        }
      }
    }

    for (
      let index = 0;
      index < formData.items.length;
      index += 1
    ) {
      const item = formData.items[index];

      if (
        isSupplier &&
        item.selected_for_delivery === false
      ) {
        continue;
      }
      const lineNumber = index + 1;

      if (Number(item.is_new_product) === 1) {
        if (!item.product_name.trim()) {
          showNotice(
            "error",
            `Product ${lineNumber} Incomplete`,
            "Enter the new product name."
          );

          return false;
        }

        if (
          String(item.description || "").length > 1500
        ) {
          showNotice(
            "error",
            `Product ${lineNumber} Description Too Long`,
            "Product description must not exceed 1,500 characters."
          );

          return false;
        }

        if (!item.sku.trim()) {
          showNotice(
            "error",
            `Product ${lineNumber} Incomplete`,
            "Enter a unique SKU for the new product."
          );

          return false;
        }

        if (!item.category_id) {
          showNotice(
            "error",
            `Product ${lineNumber} Incomplete`,
            "Select a category for the new product."
          );

          return false;
        }

        if (!item.unit_type.trim()) {
          showNotice(
            "error",
            `Product ${lineNumber} Incomplete`,
            "Select the unit for the new product."
          );

          return false;
        }
      } else if (!item.product_id) {
        showNotice(
          "error",
          `Product ${lineNumber} Required`,
          "Select an existing product or switch to New Product."
        );

        return false;
      }

      if (Number(item.quantity || 0) <= 0) {
        showNotice(
          "error",
          `Invalid Quantity on Product ${lineNumber}`,
          "Delivered quantity must be greater than zero."
        );

        return false;
      }

      if (Number(item.supplier_price || 0) < 0) {
        showNotice(
          "error",
          `Invalid Supplier Price on Product ${lineNumber}`,
          "Supplier price cannot be negative."
        );

        return false;
      }

      const retailPrice =
        Number(item.retail_price || 0);

      if (
        retailPrice < 0 ||
        (!isSupplier && retailPrice <= 0)
      ) {
        showNotice(
          "error",
          `Invalid Retail Price on Product ${lineNumber}`,
          isSupplier
            ? "Retail price cannot be negative."
            : "Retail price must be greater than zero."
        );

        return false;
      }

      if (
        isSupplier &&
        Number(item.is_new_product) === 1
      ) {
        showNotice(
          "error",
          `Approved Product Required on Product ${lineNumber}`,
          "New products must be submitted and approved first in Product Proposals before they can be included in a delivery."
        );

        return false;
      }

      if (
        item.expiry_date &&
        item.expiry_date < today
      ) {
        showNotice(
          "error",
          `Invalid Expiry Date on Product ${lineNumber}`,
          "Expiry date cannot be in the past."
        );

        return false;
      }

      if (Number(item.is_consignment) === 1) {
        const consignmentStartDate =
          formData.delivery_date || today;

        if (!item.consignment_pullout_date) {
          showNotice(
            "error",
            `Consignment Pull-out Date Missing on Product ${lineNumber}`,
            "Select the expected pull-out date. Terms and conditions are optional."
          );

          return false;
        }

        if (
          item.consignment_pullout_date <=
          consignmentStartDate
        ) {
          showNotice(
            "error",
            `Invalid Pull-out Date on Product ${lineNumber}`,
            "Pull-out date must be later than the delivery date."
          );

          return false;
        }
      }
    }

    return true;
  };

  const requestSave = (status) => {
    if (!canCreateDelivery) {
      showNotice(
        "error",
        "Permission Denied",
        "You do not have permission to create a delivery."
      );

      return;
    }

    if (!validateForm()) {
      return;
    }

    const finalStatus = isSupplier ? "Pending" : status;

    setConfirmation({
      title:
        isSupplier &&
        resubmittingDeliveryId
          ? "Resubmit Delivery Request"
          : isSupplier
        ? "Submit Delivery Request"
        : finalStatus === "Delivered"
        ? "Confirm Delivered Transaction"
        : "Save Pending Delivery",

      message:
        isSupplier &&
        resubmittingDeliveryId
          ? "Submit the corrected delivery request for another Admin review? The previous rejection reason will be cleared."
          : isSupplier
        ? "Submit this delivery request to Admin for review? Only approved supplier products may be delivered. No inventory batch, stock, POS availability, or supplier payable will be created until BFATC approves and physically receives the delivery."
        : finalStatus === "Delivered"
        ? "Confirm this delivery? Inventory, batches, supplier payable, supplier history, POS availability, reports, and audit records will update automatically."
        : "Save this delivery as Pending? Inventory and supplier payable will not update until the transaction is confirmed as Delivered.",

      confirmText:
        isSupplier &&
        resubmittingDeliveryId
          ? "Resubmit Request"
          : isSupplier
        ? "Submit Request"
        : finalStatus === "Delivered"
        ? "Confirm Delivery"
        : "Save as Pending",

      type:
        finalStatus === "Delivered"
          ? "primary"
          : "secondary",

      action: () => submitDelivery(finalStatus),
    });

    setShowConfirmModal(true);
  };

  const submitDelivery = async (status) => {
    setShowConfirmModal(false);
    setSaving(true);

    const submittedRestockRequestId =
      activeRestockRequestId;

    try {
      const csrfToken = await getCsrfToken();
      const requestForm = new FormData();

      const itemsToSubmit = isSupplier
        ? formData.items.filter(
            (item) =>
              item.product_id &&
              item.selected_for_delivery !== false
          )
        : formData.items;

      const cleanItems = itemsToSubmit.map(
        (item, index) => {
          const imageKey = `product_image_${index}`;

          if (item.product_image) {
            requestForm.append(
              imageKey,
              item.product_image
            );
          }

          return {
            ...item,

            product_id:
              Number(item.product_id || 0) || null,

            family_id:
              Number(
                item.family_id ||
                  item.product_id ||
                  0
              ) || null,

            request_variant_id:
              Number(
                item.request_variant_id || 0
              ) || null,

            variant_label:
              String(
                item.variant_label || "Standard"
              ).trim() || "Standard",

            variant_value:
              item.variant_value === "" ||
              item.variant_value === null ||
              item.variant_value === undefined
                ? null
                : Number(item.variant_value),

            variant_unit:
              String(
                item.variant_unit || ""
              ).trim(),

            variant_sort:
              Number(item.variant_sort || 0),

            family_group_key:
              item.family_group_key || "",

            product_image: null,
            product_image_preview: "",
            image_key: imageKey,
            is_new_product: Number(
              item.is_new_product
            ),
            is_consignment: Number(
              item.is_consignment
            ),
            consignment_terms:
              String(
                item.consignment_terms || ""
              ).trim(),
            consignment_start_date:
              Number(item.is_consignment) === 1
                ? formData.delivery_date
                : "",
            consignment_pullout_date:
              Number(item.is_consignment) === 1
                ? item.consignment_pullout_date
                : "",
            consignment_notes:
              String(
                item.consignment_notes || ""
              ).trim(),
            quantity: Number(item.quantity),
            reorder_level: Number(
              item.reorder_level || 0
            ),
            supplier_price: Number(
              item.supplier_price || 0
            ),
            retail_price: Number(
              item.retail_price || 0
            ),
          };
        }
      );

      requestForm.append(
        "payload",
        JSON.stringify({
          ...formData,
          restock_request_id: activeRestockRequestId,
          status: isSupplier ? "Pending" : status,
          submission_source: isSupplier
            ? "Supplier"
            : "Admin",
          submitted_by_user_id:
            user?.user_id || null,
          submitted_by_name:
            user?.full_name ||
            user?.name ||
            "",
          business_name:
            "Bacnotan Farmers Agri-Tourism Center",
          owner_name:
            selectedSupplier?.contact_person || "",
          contact_number:
            selectedSupplier?.phone || "",
          items: cleanItems,
        })
      );

      if (
        isSupplier &&
        resubmittingDeliveryId
      ) {
        const payload = JSON.parse(
          requestForm.get("payload")
        );

        requestForm.set(
          "payload",
          JSON.stringify({
            ...payload,
            delivery_id:
              resubmittingDeliveryId,
          })
        );
      }

      const endpoint =
        isSupplier &&
        resubmittingDeliveryId
          ? `${API_BASE}/delivery_management/resubmit_delivery.php`
          : `${API_BASE}/delivery_management/add_delivery.php`;

      const response = await fetch(
        endpoint,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          body: requestForm,
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to save the delivery."
        );
      }

      const wasResubmission =
        Boolean(resubmittingDeliveryId);

      Promise.resolve()
        .then(() =>
          logAudit(
            wasResubmission
              ? "Resubmit Delivery Request"
              : status === "Delivered"
              ? "Confirm Delivery"
              : "Create Pending Delivery",
            `${
              data.delivery_order_no || "Delivery"
            } for ${
              selectedSupplier?.vendor_name || "supplier"
            } with ${computedSummary.totalUnits} unit(s)`
          )
        )
        .catch((auditError) => {
          console.error(
            "Delivery audit error:",
            auditError
          );
        });

      if (submittedRestockRequestId) {
        setRestockRequests((current) =>
          current.filter(
            (request) =>
              String(
                request.restock_request_id
              ) !==
              String(
                submittedRestockRequestId
              )
          )
        );
      }

      closeDeliveryModal();

      await loadDeliveries();

      showNotice(
        "success",
        wasResubmission
          ? "Delivery Request Resubmitted"
          : isSupplier
          ? "Delivery Request Submitted"
          : status === "Delivered"
          ? "Delivery Confirmed"
          : "Pending Delivery Saved",

        data.message ||
          (status === "Delivered"
            ? "Inventory and supplier payable were updated automatically."
            : "The pending delivery was saved.")
      );

      Promise.allSettled([
        loadReferenceData(),
        loadRestockRequests(),
      ]).then((results) => {
        results.forEach((result) => {
          if (result.status === "rejected") {
            console.warn(
              "Delivery background refresh error:",
              result.reason
            );
          }
        });
      });
    } catch (error) {
      console.error("Delivery save error:", error);

      showNotice(
        "error",
        "Unable to Save Delivery",
        error.message ||
          "The delivery transaction could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const openDeliveryDetails = async (delivery) => {
    setSelectedDelivery(delivery);
    setShowDetailsModal(true);

    try {
      const completeDelivery =
        await loadDeliveryDetails(
          delivery.delivery_id
        );

      setSelectedDelivery(completeDelivery);
    } catch (error) {
      console.error("Delivery details error:", error);

      setShowDetailsModal(false);
      setSelectedDelivery(null);

      showNotice(
        "error",
        "Unable to Load Delivery",
        error.message ||
          "The delivery details could not be retrieved."
      );
    }
  };

  const createDeliveryReceiptPngBlob = async (
    delivery
  ) => {
    const items = Array.isArray(
      delivery?.items
    )
      ? delivery.items
      : [];

    const scale = 2;
    const width = 1120;
    const baseHeight = 760;
    const extraRows = Math.max(
      0,
      items.length - 6
    );
    const height =
      baseHeight + extraRows * 34;

    const canvas =
      document.createElement("canvas");

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Your browser could not create the Delivery Receipt image."
      );
    }

    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    const drawText = (
      value,
      x,
      y,
      {
        font = "14px Arial",
        color = "#111111",
        align = "left",
      } = {}
    ) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline =
        "alphabetic";

      ctx.fillText(
        String(value ?? ""),
        x,
        y
      );
    };

    const drawLine = (
      x1,
      y1,
      x2,
      y2,
      lineWidth = 1,
      color = "#555555"
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const loadImage = (src) =>
      new Promise(
        (resolve, reject) => {
          const image =
            new Image();

          image.onload = () =>
            resolve(image);

          image.onerror =
            reject;

          image.src = src;
        }
      );

    try {
      const logo =
        await loadImage(
          bacnotanLogo
        );

      ctx.drawImage(
        logo,
        65,
        42,
        52,
        52
      );
    } catch (error) {
      console.warn(
        "Delivery receipt logo could not be rendered:",
        error
      );
    }

    const deliveryNumber =
      delivery?.delivery_order_no ||
      `DEL-${String(
        delivery?.delivery_id || 0
      ).padStart(4, "0")}`;

    const receiptNumber =
      `DR-${String(
        delivery?.delivery_id || 0
      ).padStart(5, "0")}`;

    const supplierName =
      delivery?.vendor_name ||
      "Not provided";

    const deliveredBy =
      delivery?.driver ||
      delivery?.contact_person ||
      delivery?.submitted_by_name ||
      supplierName;

    const receivedBy =
      delivery?.received_by_name ||
      delivery?.legacy_received_by ||
      delivery?.received_by ||
      user?.full_name ||
      user?.name ||
      "System Admin";

    const displayItemName = (
      item
    ) => {
      const baseName =
        item?.proposed_product_name ||
        item?.effective_product_name ||
        item?.product_display_name ||
        item?.product_name ||
        "Unnamed Product";

      const explicit = String(
        item?.variant_label || ""
      ).trim();

      const value = String(
        item?.variant_value || ""
      ).trim();

      const unit = String(
        item?.variant_unit || ""
      ).trim();

      const variant =
        explicit &&
        explicit.toLowerCase() !==
          "standard"
          ? explicit
          : value || unit
          ? `${value}${
              value && unit
                ? " "
                : ""
            }${unit}`.trim()
          : "";

      return variant &&
        !String(baseName).includes(
          variant
        )
        ? `${baseName} — ${variant}`
        : baseName;
    };

    const displayItemUnit = (
      item
    ) =>
      item?.proposed_unit ||
      item?.effective_unit ||
      item?.unit ||
      item?.unit_type ||
      "pcs";

    const supplierPayable =
      Number(
        delivery?.supplier_payable_amount ??
          delivery?.payable_amount ??
          items.reduce(
            (sum, item) =>
              sum +
              Number(
                item?.quantity || 0
              ) *
                Number(
                  item?.supplier_price ||
                    0
                ),
            0
          )
      ) || 0;

    drawText(
      "BACNOTAN FARMERS AGRI-TOURISM CENTER",
      140,
      66,
      {
        font: "bold 18px Arial",
      }
    );

    drawText(
      "HiveSync Integrated Business and Operations Management System",
      140,
      86,
      {
        font: "10px Arial",
      }
    );

    drawText(
      "DELIVERY RECEIPT NO.",
      975,
      58,
      {
        font: "bold 8px Arial",
        align: "center",
      }
    );

    drawText(
      receiptNumber,
      975,
      78,
      {
        font: "bold 11px Arial",
        align: "center",
      }
    );

    drawLine(
      65,
      112,
      1055,
      112
    );

    drawText(
      "DELIVERY RECEIPT",
      width / 2,
      145,
      {
        font: "18px Arial",
        align: "center",
      }
    );

    const field = (
      label,
      value,
      x,
      y,
      lineEnd
    ) => {
      drawText(
        label.toUpperCase(),
        x,
        y,
        {
          font: "bold 9px Arial",
        }
      );

      drawText(
        value,
        x + 100,
        y,
        {
          font: "11px Arial",
        }
      );

      drawLine(
        x + 95,
        y + 4,
        lineEnd,
        y + 4,
        0.7,
        "#666666"
      );
    };

    field(
      "Delivered To",
      "BACNOTAN FARMERS AGRI-TOURISM CENTER",
      65,
      182,
      595
    );

    field(
      "Date",
      formatDate(
        delivery?.delivery_date
      ),
      650,
      182,
      1055
    );

    field(
      "Supplier",
      supplierName,
      65,
      212,
      595
    );

    field(
      "Delivered By",
      deliveredBy,
      650,
      212,
      1055
    );

    field(
      "Delivery No.",
      deliveryNumber,
      65,
      242,
      595
    );

    field(
      "Status",
      delivery?.status ||
        "Delivered",
      650,
      242,
      1055
    );

    const tableX = 65;
    const tableY = 275;
    const rowH = 32;
    const columns = [
      90,
      100,
      420,
      175,
      205,
    ];
    const headers = [
      "QTY",
      "UNIT",
      "DESCRIPTION",
      "SUPPLIER PRICE",
      "AMOUNT",
    ];

    const minimumRows = Math.max(
      8,
      items.length
    );

    const tableHeight =
      rowH *
      (minimumRows + 2);

    ctx.strokeStyle =
      "#777777";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(
      tableX,
      tableY,
      990,
      tableHeight
    );

    let columnX = tableX;

    columns.forEach(
      (columnWidth, index) => {
        if (index > 0) {
          drawLine(
            columnX,
            tableY,
            columnX,
            tableY +
              tableHeight -
              rowH,
            0.6,
            "#777777"
          );
        }

        drawText(
          headers[index],
          columnX +
            columnWidth / 2,
          tableY + 21,
          {
            font: "bold 9px Arial",
            align: "center",
          }
        );

        columnX +=
          columnWidth;
      }
    );

    for (
      let row = 1;
      row <= minimumRows + 1;
      row += 1
    ) {
      drawLine(
        tableX,
        tableY + rowH * row,
        tableX + 990,
        tableY + rowH * row,
        0.6,
        "#777777"
      );
    }

    items.forEach(
      (item, index) => {
        const quantity =
          Number(
            item?.quantity || 0
          );

        const supplierPrice =
          Number(
            item?.supplier_price ||
              0
          );

        const amount =
          quantity *
          supplierPrice;

        const rowY =
          tableY +
          rowH *
            (index + 1) +
          21;

        let x = tableX;

        const values = [
          quantity,
          displayItemUnit(item),
          displayItemName(item),
          formatPeso(
            supplierPrice
          ),
          formatPeso(amount),
        ];

        columns.forEach(
          (
            columnWidth,
            columnIndex
          ) => {
            const isDescription =
              columnIndex === 2;

            const isMoney =
              columnIndex >= 3;

            drawText(
              values[columnIndex],
              isDescription
                ? x + 8
                : isMoney
                ? x +
                  columnWidth -
                  8
                : x +
                  columnWidth /
                    2,
              rowY,
              {
                font:
                  "9.5px Arial",
                align:
                  isDescription
                    ? "left"
                    : isMoney
                    ? "right"
                    : "center",
              }
            );

            x +=
              columnWidth;
          }
        );
      }
    );

    const totalRowY =
      tableY +
      rowH *
        (minimumRows + 1);

    drawText(
      "TOTAL",
      820,
      totalRowY + 21,
      {
        font: "bold 9px Arial",
      }
    );

    drawText(
      formatPeso(
        supplierPayable
      ),
      1038,
      totalRowY + 21,
      {
        font: "bold 10px Arial",
        align: "right",
      }
    );

    const summaryY =
      tableY +
      tableHeight +
      28;

    drawText(
      `Total Products: ${items.length}`,
      780,
      summaryY,
      {
        font: "9px Arial",
      }
    );

    drawText(
      `Supplier Payable: ${formatPeso(
        supplierPayable
      )}`,
      1055,
      summaryY,
      {
        font: "bold 9px Arial",
        align: "right",
      }
    );

    const certificationY =
      summaryY + 42;

    drawText(
      "Checked and certified that the above delivery was physically received and recorded in HiveSync.",
      65,
      certificationY,
      {
        font: "9px Arial",
      }
    );

    drawText(
      "Delivered and acknowledged subject to the terms and records of BFATC.",
      615,
      certificationY,
      {
        font: "9px Arial",
      }
    );

    const signatureY =
      certificationY + 72;

    drawLine(
      145,
      signatureY,
      485,
      signatureY,
      0.8,
      "#444444"
    );

    drawLine(
      635,
      signatureY,
      975,
      signatureY,
      0.8,
      "#444444"
    );

    drawText(
      receivedBy,
      315,
      signatureY - 10,
      {
        font: "10px Arial",
        align: "center",
      }
    );

    drawText(
      deliveredBy,
      805,
      signatureY - 10,
      {
        font: "10px Arial",
        align: "center",
      }
    );

    drawText(
      "Received By",
      315,
      signatureY + 20,
      {
        font: "bold 9px Arial",
        align: "center",
      }
    );

    drawText(
      "Delivered By / Supplier",
      805,
      signatureY + 20,
      {
        font: "bold 9px Arial",
        align: "center",
      }
    );

    drawLine(
      65,
      signatureY + 55,
      1055,
      signatureY + 55,
      0.6,
      "#cbd5e1"
    );

    drawText(
      "This delivery receipt was generated through HiveSync.",
      width / 2,
      signatureY + 75,
      {
        font: "8px Arial",
        color: "#64748b",
        align: "center",
      }
    );

    return await new Promise(
      (resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
              return;
            }

            reject(
              new Error(
                "The Delivery Receipt PNG could not be generated."
              )
            );
          },
          "image/png",
          1
        );
      }
    );
  };

  const emailDeliveryReceiptPng = async (
    delivery
  ) => {
    if (
      !delivery?.delivery_id
    ) {
      throw new Error(
        "The delivery ID is missing."
      );
    }

    const referenceCode =
      delivery?.delivery_order_no ||
      `DEL-${delivery.delivery_id}`;

    const receiptBlob =
      await createDeliveryReceiptPngBlob(
        delivery
      );

    const formData =
      new FormData();

    formData.append(
      "delivery_id",
      String(
        delivery.delivery_id
      )
    );

    formData.append(
      "reference_code",
      referenceCode
    );

    formData.append(
      "prepared_by",
      user?.full_name ||
        user?.name ||
        "System Admin"
    );

    formData.append(
      "subject",
      `BFATC Delivery Receipt - ${referenceCode}`
    );

    formData.append(
      "message",
      `BFATC has successfully received and recorded your delivery ${referenceCode}. The official HiveSync Delivery Receipt is attached as a PNG image.`
    );

    formData.append(
      "receipt_png",
      receiptBlob,
      `Delivery_Receipt_${String(
        referenceCode
      ).replace(
        /[^A-Za-z0-9._-]+/g,
        "_"
      )}.png`
    );

    const csrfToken = await getCsrfToken();

    const response =
      await fetch(
        `${API_BASE}/delivery_management/send_delivery_receipt_email.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          body: formData,
        }
      );

    const data =
      await parseJsonResponse(
        response
      );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.email_error ||
          data.message ||
          "The Delivery Receipt PNG could not be emailed."
      );
    }

    return data;
  };

  const printDeliveryReceipt = async (delivery) => {
    if (
      String(delivery?.status || "") !== "Delivered"
    ) {
      showNotice(
        "error",
        "Receipt Not Available",
        "The official Delivery Receipt is generated only after BFATC physically receives the delivery."
      );
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=980,height=900"
    );

    if (!printWindow) {
      showNotice(
        "error",
        "Pop-up Blocked",
        "Allow pop-ups for localhost, then click Print Receipt again."
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Preparing Delivery Receipt</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              font-family: Arial, sans-serif;
              background: #f8fafc;
              color: #334155;
            }

            .loading {
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="loading">
            <strong>Preparing delivery receipt...</strong>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    try {
      const completeDelivery =
        await loadDeliveryDetails(
          delivery.delivery_id
        );

      printWindow.document.open();
      printWindow.document.write(
        buildDeliveryReceiptHtml(
          completeDelivery
        )
      );
      printWindow.document.close();

      await logAudit(
        "Print Delivery Receipt",
        `Printed official delivery receipt for ${
          completeDelivery.delivery_order_no ||
          completeDelivery.delivery_id
        }`
      );
    } catch (error) {
      console.error(
        "Receipt loading error:",
        error
      );

      printWindow.close();

      showNotice(
        "error",
        "Unable to Print Receipt",
        error.message ||
          "The official delivery receipt could not be loaded."
      );
    }
  };

  const requestStatusUpdate = (
    delivery,
    newStatus
  ) => {

    const statusConfigurations = {
      "In Transit": {
        title: "Mark Delivery as In Transit",

        message: `Mark ${
          delivery.delivery_order_no ||
          "this delivery"
        } as In Transit? Inventory and supplier payable will not update yet.`,

        confirmText: "Mark In Transit",
        type: "primary",
      },

      Delivered: {
        title: "Confirm Delivery",

        message: `Confirm ${
          delivery.delivery_order_no ||
          "this delivery"
        } as Delivered? Inventory, batch records, supplier payable, POS availability, reports, and supplier history will update automatically.`,

        confirmText: "Confirm Delivered",
        type: "primary",
      },

      Cancelled: {
        title: "Cancel Delivery",

        message: `Cancel ${
          delivery.delivery_order_no ||
          "this delivery"
        }? A cancelled delivery will not update Inventory or supplier payable.`,

        confirmText: "Cancel Delivery",
        type: "danger",
      },
    };

    const configuration =
      statusConfigurations[newStatus];

    if (!configuration) {
      return;
    }

    setConfirmation({
      ...configuration,
      action: () =>
        updateDeliveryStatus(delivery, newStatus),
    });

    setShowConfirmModal(true);
  };

  const updateDeliveryStatus = async (
    delivery,
    newStatus
  ) => {
    setShowConfirmModal(false);
    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_BASE}/delivery_management/update_delivery_status.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },

          body: JSON.stringify({
            delivery_id: delivery.delivery_id,
            status: newStatus,
            processed_by: user?.user_id || 1,
            due_date: delivery.due_date || null,
          }),
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to update the delivery status."
        );
      }

      await logAudit(
        `Update Delivery to ${newStatus}`,

        `${
          delivery.delivery_order_no || "Delivery"
        } changed from ${
          delivery.status
        } to ${newStatus}`
      );

      await loadDeliveries();

      if (newStatus === "Delivered") {
        loadReferenceData().catch((referenceError) => {
          console.warn(
            "Delivery reference refresh error:",
            referenceError
          );
        });
      }

      showNotice(
        "success",
        newStatus === "Delivered"
          ? "Delivery Confirmed"
          : "Delivery Status Updated",
        data.message
      );
    } catch (error) {
      console.error("Delivery status error:", error);

      showNotice(
        "error",
        "Unable to Update Delivery",
        error.message ||
          "The delivery status could not be updated."
      );
    } finally {
      setSaving(false);
    }
  };

  const openResubmitDelivery = async (
    delivery
  ) => {
    if (
      !isSupplier ||
      delivery.status !== "Rejected"
    ) {
      return;
    }

    try {
      const completeDelivery =
        await loadDeliveryDetails(
          delivery.delivery_id
        );

      const correctedItems = (
        completeDelivery.items || []
      ).map((item) => ({
        ...createEmptyItem(),
        is_new_product: 0,
        selected_for_delivery: true,
        family_group_key:
          item.family_id
            ? `family-${item.family_id}`
            : `legacy-${String(
                item.product_name || ""
              )
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "-")}`,
        family_id:
          item.family_id
            ? `family-${item.family_id}`
            : "",
        variant_label:
          item.variant_label || "Standard",
        variant_value:
          item.variant_value || "",
        variant_unit:
          item.variant_unit || "",
        product_id: item.product_id || "",
        product_name:
          item.product_name || "",
        sku: item.sku || "",
        category_id:
          item.category_id || "",
        category:
          item.category || "",
        unit_type:
          item.unit || "pcs",
        unit:
          item.unit || "pcs",
        quantity:
          Number(item.quantity || 1),
        supplier_price:
          item.supplier_price || "",
        retail_price:
          item.retail_price ||
          item.selling_price ||
          "",
        expiry_date:
          item.expiry_date
            ? String(
                item.expiry_date
              ).slice(0, 10)
            : "",
        is_consignment:
          Number(
            item.is_consignment || 0
          ),
        consignment_terms:
          item.consignment_terms || "",
        consignment_start_date:
          Number(item.is_consignment || 0) === 1
            ? (
                completeDelivery.delivery_date
                  ? String(
                      completeDelivery.delivery_date
                    ).slice(0, 10)
                  : today
              )
            : "",
        consignment_pullout_date:
          item.consignment_pullout_date
            ? String(
                item.consignment_pullout_date
              ).slice(0, 10)
            : "",
        consignment_notes:
          item.consignment_notes || "",
        product_image_preview:
          getProductImage(item),
      }));

      setResubmittingDeliveryId(
        completeDelivery.delivery_id
      );

      setFormData({
        delivery_order_no:
          completeDelivery.delivery_order_no ||
          "",
        vendor_id: String(
          completeDelivery.vendor_id ||
            supplierVendorId ||
            ""
        ),
        delivery_date:
          completeDelivery.delivery_date
            ? String(
                completeDelivery.delivery_date
              ).slice(0, 10)
            : today,
        driver:
          completeDelivery.driver || "",
        received_by:
          user?.full_name || "",
        noted_by:
          completeDelivery.noted_by || "",
        remarks:
          completeDelivery.remarks || "",
        due_date:
          completeDelivery.due_date
            ? String(
                completeDelivery.due_date
              ).slice(0, 10)
            : "",
        status: "Pending",
        items:
          correctedItems.length > 0
            ? correctedItems
            : [createEmptyItem()],
      });

      setShowDetailsModal(false);
      setSelectedDelivery(null);
      setShowDeliveryModal(true);
    } catch (error) {
      showNotice(
        "error",
        "Unable to Prepare Resubmission",
        error.message ||
          "The rejected request could not be loaded."
      );
    }
  };

  const closeApprovalPriceModal = () => {
    if (saving || approvalPricingLoading) {
      return;
    }

    setShowApprovalPriceModal(false);
    setApprovalPricingDelivery(null);
    setApprovalPricingItems([]);
  };

  const updateApprovalFinalPrice = (
    index,
    value
  ) => {
    setApprovalPricingItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              final_selling_price: value,
            }
          : item
      )
    );
  };

  const submitSupplierApproval = async (
    delivery,
    finalPriceItems = []
  ) => {
    if (!canManageDeliveries || saving) return;

    setReviewingDeliveryId(delivery.delivery_id);
    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_BASE}/delivery_management/approve_delivery.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            delivery_id: delivery.delivery_id,
            reviewed_by_user_id:
              user?.user_id || null,
            reviewed_by_name:
              user?.full_name ||
              user?.name ||
              "System Admin",
            items: finalPriceItems.map(
              (item) => ({
                delivery_item_id:
                  item.delivery_item_id,
                final_selling_price:
                  Number(
                    item.final_selling_price ||
                      0
                  ),
              })
            ),
          }),
        }
      );

      const data =
        await parseJsonResponse(response);

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Unable to approve the delivery."
        );
      }

      setShowApprovalPriceModal(false);
      setApprovalPricingDelivery(null);
      setApprovalPricingItems([]);

      if (
        data.post_processing_required
      ) {
        triggerDeliveryPostProcessing(
          data.delivery_id ||
            delivery.delivery_id,
          data.post_processing_action ||
            "approved"
        );
      }

      await loadDeliveries();

      loadReferenceData().catch((referenceError) => {
        console.warn(
          "Delivery reference refresh error:",
          referenceError
        );
      });

      setShowDetailsModal(false);
      setSelectedDelivery(null);

      showNotice(
        "success",
        "Delivery Approved",
        data.message
      );
    } catch (error) {
      showNotice(
        "error",
        "Unable to Approve Delivery",
        error.message ||
          "The supplier delivery could not be approved."
      );
    } finally {
      setSaving(false);
      setReviewingDeliveryId(null);
    }
  };

  const confirmSupplierApprovalPricing =
    async () => {
      if (
        !approvalPricingDelivery ||
        saving ||
        approvalPricingLoading
      ) {
        return;
      }

      for (
        let index = 0;
        index < approvalPricingItems.length;
        index += 1
      ) {
        const item =
          approvalPricingItems[index];

        if (
          Number(
            item.final_selling_price || 0
          ) <= 0
        ) {
          showNotice(
            "error",
            "Final Selling Price Required",
            `Enter the final BFATC selling price for ${
              item.product_name ||
              `Product ${index + 1}`
            }.`
          );

          return;
        }
      }

      await submitSupplierApproval(
        approvalPricingDelivery,
        approvalPricingItems
      );
    };

  const triggerDeliveryPostProcessing = async (
    deliveryId,
    action
  ) => {
    if (!deliveryId || !action) {
      return;
    }

    try {
      const csrfToken = await getCsrfToken();

      fetch(
        `${API_BASE}/delivery_management/post_delivery_communication.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
            "X-CSRF-Token": csrfToken,
          },
        body: JSON.stringify({
          delivery_id: deliveryId,
          action,
        }),
      }
    )
      .then((response) =>
        parseJsonResponse(response)
      )
      .then((data) => {
        if (!data?.success) {
          console.warn(
            "Delivery post-processing warning:",
            data?.message || data
          );
        }
      })
      .catch((error) => {
        console.warn(
          "Delivery post-processing error:",
          error
        );
      });
    } catch (error) {
      console.warn(
        "Delivery post-processing security error:",
        error
      );
    }
  };

  const approveSupplierDelivery = async (
    delivery
  ) => {
    if (
      !canManageDeliveries ||
      saving ||
      approvalPricingLoading
    ) {
      return;
    }

    await submitSupplierApproval(
      delivery,
      []
    );
  };

  const openReceiveDelivery = async (delivery) => {
    if (
      !canManageDeliveries ||
      saving ||
      receivingLoading
    ) {
      return;
    }

    const deliveryId =
      delivery?.delivery_id;

    if (!deliveryId) {
      showNotice(
        "error",
        "Unable to Receive Delivery",
        "The delivery ID is missing."
      );
      return;
    }

    setReceivingLoading(true);

    try {
      const completeDelivery =
        await loadDeliveryDetails(
          deliveryId
        );

      const sourceItems =
        completeDelivery?.items || [];

      if (sourceItems.length === 0) {
        throw new Error(
          "No approved delivery items were found."
        );
      }

      const preparedItems =
        sourceItems.map((item, index) => {
          const approvedQuantity =
            Number(
              item.quantity ||
              item.approved_quantity ||
              0
            );

          if (
            !item.delivery_item_id ||
            approvedQuantity <= 0
          ) {
            throw new Error(
              `Product ${index + 1} has invalid approved receiving information.`
            );
          }

          return {
            delivery_item_id:
              item.delivery_item_id,

            product_id:
              item.product_id || null,

            product_name:
              item.effective_product_name ||
              item.product_display_name ||
              item.product_name ||
              item.proposed_product_name ||
              `Product ${index + 1}`,

            sku:
              item.effective_sku ||
              item.sku ||
              item.proposed_sku ||
              "",

            is_new_product:
              Number(
                item.is_new_product || 0
              ),

            approved_quantity:
              approvedQuantity,

            received_quantity:
              String(approvedQuantity),

            supplier_price:
              String(
                Number(
                  item.supplier_price || 0
                )
              ),

            expiry_date:
              item.expiry_date
                ? String(
                    item.expiry_date
                  ).slice(0, 10)
                : "",
          };
        });

      setReceivingDelivery(
        completeDelivery
      );

      setReceivingItems(
        preparedItems
      );

      setReceivingRemarks("");
      setShowReceiveModal(true);
    } catch (error) {
      showNotice(
        "error",
        "Unable to Receive Delivery",
        error.message ||
          "The approved delivery could not be loaded."
      );
    } finally {
      setReceivingLoading(false);
    }
  };

  const closeReceiveDelivery = (force = false) => {
    if (
      !force &&
      (
        saving ||
        receivingLoading
      )
    ) {
      return;
    }

    setShowReceiveModal(false);
    setReceivingDelivery(null);
    setReceivingItems([]);
    setReceivingRemarks("");
  };

  const updateReceivingItem = (
    index,
    field,
    value
  ) => {
    setReceivingItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (
          field === "received_quantity"
        ) {
          if (value === "") {
            return {
              ...item,
              received_quantity: "",
            };
          }

          const numericValue =
            Number(value);

          if (
            Number.isNaN(numericValue)
          ) {
            return item;
          }

          const approvedQuantity =
            Number(
              item.approved_quantity || 0
            );

          return {
            ...item,
            received_quantity:
              numericValue >
              approvedQuantity
                ? String(
                    approvedQuantity
                  )
                : value,
          };
        }

        if (
          field === "supplier_price"
        ) {
          if (value === "") {
            return {
              ...item,
              supplier_price: "",
            };
          }

          const numericValue =
            Number(value);

          if (
            Number.isNaN(numericValue) ||
            numericValue < 0
          ) {
            return item;
          }
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  };

  const submitReceiveDelivery = async () => {
    if (
      !receivingDelivery ||
      saving ||
      receivingLoading
    ) {
      return;
    }

    for (
      let index = 0;
      index < receivingItems.length;
      index += 1
    ) {
      const item =
        receivingItems[index];

      const approvedQuantity =
        Number(
          item.approved_quantity || 0
        );

      const receivedQuantity =
        Number(
          item.received_quantity || 0
        );

      if (receivedQuantity <= 0) {
        showNotice(
          "error",
          "Invalid Received Quantity",
          `Product ${index + 1} must have a received quantity greater than zero.`
        );
        return;
      }

      if (
        receivedQuantity >
        approvedQuantity
      ) {
        showNotice(
          "error",
          "Quantity Exceeds Approval",
          `Product ${index + 1} cannot exceed the approved quantity of ${approvedQuantity}.`
        );
        return;
      }

      if (
        Number(item.supplier_price || 0) < 0
      ) {
        showNotice(
          "error",
          "Invalid Supplier Price",
          `Product ${index + 1} has an invalid supplier price.`
        );
        return;
      }

      if (
        item.expiry_date &&
        item.expiry_date < today
      ) {
        showNotice(
          "error",
          "Invalid Expiry Date",
          `Product ${index + 1} has an expiry date in the past.`
        );
        return;
      }
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_BASE}/delivery_management/receive_delivery.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            delivery_id:
              receivingDelivery.delivery_id,
            received_by_user_id:
              user?.user_id || null,
            received_by_name:
              user?.full_name ||
              user?.name ||
              "System Admin",
            receiving_remarks:
              receivingRemarks.trim(),
            items: receivingItems.map(
              (item) => ({
                delivery_item_id:
                  item.delivery_item_id,
                received_quantity:
                  Number(
                    item.received_quantity ||
                      0
                  ),
                supplier_price:
                  Number(
                    item.supplier_price || 0
                  ),
                expiry_date:
                  item.expiry_date || null,
              })
            ),
          }),
        }
      );

      const data =
        await parseJsonResponse(
          response
        );

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Unable to receive the delivery."
        );
      }

      if (
        data.post_processing_required
      ) {
        triggerDeliveryPostProcessing(
          data.delivery_id ||
            receivingDelivery.delivery_id,
          data.post_processing_action ||
            "received"
        );
      }

      const receivedDeliveryId =
        data.delivery_id ||
        receivingDelivery.delivery_id;

      closeReceiveDelivery(true);

      setShowDetailsModal(false);
      setSelectedDelivery(null);

      await loadDeliveries();

      showNotice(
        "success",
        "Delivery Received",
        `${
          data.message ||
          "Inventory, batches, and supplier payable were updated. Products without a final BFATC selling price remain unpublished until Set Price & Publish is completed."
        } The Delivery Receipt PNG email is being processed separately.`
      );

      loadReferenceData().catch((referenceError) => {
        console.warn(
          "Delivery reference refresh error:",
          referenceError
        );
      });

      Promise.resolve()
        .then(() =>
          loadDeliveryDetails(
            receivedDeliveryId
          )
        )
        .then((receivedDelivery) =>
          emailDeliveryReceiptPng(
            receivedDelivery
          )
        )
        .then((receiptEmailResult) => {
          if (!receiptEmailResult?.email_sent) {
            console.warn(
              "Delivery Receipt PNG email was not sent:",
              receiptEmailResult
            );
          }
        })
        .catch((emailError) => {
          console.error(
            "Delivery Receipt PNG email error:",
            emailError
          );
        });
    } catch (error) {
      showNotice(
        "error",
        "Unable to Receive Delivery",
        error.message ||
          "The physical delivery could not be received."
      );
    } finally {
      setSaving(false);
    }
  };

  const openRejectDelivery = (delivery) => {
    if (!canManageDeliveries || saving) return;
    setRejectingDelivery(delivery);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const closeRejectDelivery = () => {
    if (saving) return;
    setShowRejectModal(false);
    setRejectingDelivery(null);
    setRejectionReason("");
  };

  const rejectSupplierDelivery = async () => {
    if (!rejectingDelivery || saving) return;

    if (!rejectionReason.trim()) {
      showNotice(
        "error",
        "Rejection Reason Required",
        "Enter the reason for rejecting this delivery."
      );
      return;
    }

    setReviewingDeliveryId(rejectingDelivery.delivery_id);
    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_BASE}/delivery_management/reject_delivery.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            delivery_id: rejectingDelivery.delivery_id,
            reviewed_by_user_id: user?.user_id || null,
            reviewed_by_name:
              user?.full_name ||
              user?.name ||
              "System Admin",
            rejection_reason: rejectionReason.trim(),
          }),
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to reject the delivery."
        );
      }

      setShowRejectModal(false);
      setRejectingDelivery(null);
      setRejectionReason("");
      setShowDetailsModal(false);
      setSelectedDelivery(null);
      await loadDeliveries();

      showNotice(
        "success",
        "Delivery Rejected",
        data.message
      );
    } catch (error) {
      showNotice(
        "error",
        "Unable to Reject Delivery",
        error.message ||
          "The supplier delivery could not be rejected."
      );
    } finally {
      setSaving(false);
      setReviewingDeliveryId(null);
    }
  };

  const requestArchive = (delivery) => {

    setConfirmation({
      title: "Archive Delivery",

      message: `Archive ${
        delivery.delivery_order_no ||
        "this delivery"
      }? Inventory, batches, supplier payable, receipts, and transaction history will remain preserved.`,

      confirmText: "Archive Delivery",
      type: "danger",
      action: () => archiveDelivery(delivery),
    });

    setShowConfirmModal(true);
  };

  const archiveDelivery = async (delivery) => {
    setShowConfirmModal(false);
    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_BASE}/delivery_management/archive_delivery.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },

          body: JSON.stringify({
            delivery_id: delivery.delivery_id,
          }),
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to archive the delivery."
        );
      }

      await logAudit(
        "Archive Delivery",
        `Archived delivery ${
          delivery.delivery_order_no ||
          delivery.delivery_id
        }`
      );

      await loadDeliveries();

      showNotice(
        "success",
        "Delivery Archived",
        data.message ||
          "The delivery was archived successfully."
      );
    } catch (error) {
      console.error("Archive delivery error:", error);

      showNotice(
        "error",
        "Unable to Archive Delivery",
        error.message ||
          "The delivery could not be archived."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page delivery-page">
      <div className="page-header delivery-page-header">
        <div>
          <h1>Delivery Management</h1>

          <span>
            Receive supplier products once and automatically
            update Inventory, Payables, POS, Reports, and
            supplier history.
          </span>
        </div>

        {canManageDeliveries && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={openDeliveryModal}
          >
            <Plus size={18} />
            New Delivery
          </button>
        )}
      </div>

      {!isSupplier && (
        <section className="module-stats delivery-stat-grid">
          <DeliveryStatCard
            icon={<ClipboardList size={20} />}
            label="Pending"
            value={deliveryStatistics.pending}
            className="pending"
          />

          <DeliveryStatCard
            icon={<Truck size={20} />}
            label="In Transit"
            value={deliveryStatistics.inTransit}
            className="transit"
          />

          <DeliveryStatCard
            icon={<CheckCircle2 size={20} />}
            label="Delivered"
            value={deliveryStatistics.delivered}
            className="delivered"
          />

          <DeliveryStatCard
            icon={<X size={20} />}
            label="Cancelled"
            value={deliveryStatistics.cancelled}
            className="cancelled"
          />
        </section>
      )}

      {!isSupplier && (
        <div className="delivery-enterprise-tabs">
          {[
            ["all", "All Deliveries"],
            ["requests", "Supplier Requests"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={
                activeDeliveryTab === id
                  ? "delivery-enterprise-tab active"
                  : "delivery-enterprise-tab"
              }
              onClick={() => {
                setActiveDeliveryTab(id);
                setStatusFilter("All");
              }}
            >
              <span>{label}</span>

              {id === "requests" &&
                deliveryStatistics.pendingSupplierRequests > 0 && (
                  <strong className="delivery-tab-count">
                    {deliveryStatistics.pendingSupplierRequests}
                  </strong>
                )}
            </button>
          ))}
        </div>
      )}

      {isSupplier && (
        <section style={{
          marginBottom: 16, padding: 18, border: "1px solid #e5e7eb",
          borderRadius: 16, background: "#ffffff",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", gap: 16, marginBottom: 14,
          }}>
            <div>
              <span style={{
                display: "block", marginBottom: 4, color: "#b98300",
                fontSize: 10, fontWeight: 900, letterSpacing: "0.07em",
                textTransform: "uppercase",
              }}>Inventory Requests</span>
              <h3 style={{ margin: 0, color: "#111827" }}>Restock Requests</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                Create a delivery without re-entering product information.
              </p>
            </div>
            <button type="button" className="btn btn-secondary"
              onClick={loadRestockRequests} disabled={restockRequestsLoading}>
              {restockRequestsLoading ? <LoaderCircle size={16} /> : <Search size={16} />}
              Refresh
            </button>
          </div>

          {pendingRestockRequests.length === 0 ? (
            <div style={{
              padding: "18px 14px", border: "1px dashed #d1d5db",
              borderRadius: 10, color: "#6b7280", fontSize: 12, textAlign: "center",
            }}>No pending restock requests from Inventory.</div>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {pendingRestockRequests
                .map((request) => (
                  <div key={request.restock_request_id} style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px,1.4fr) minmax(120px,.7fr) minmax(120px,.7fr) auto",
                    alignItems: "center", gap: 14, padding: "12px 14px",
                    border: "1px solid #e5e7eb", borderRadius: 10,
                  }}>
                    <div>
                      <strong style={{ display: "block", color: "#111827", fontSize: 12 }}>
                        {request.product_name}
                      </strong>
                      <span style={{ color: "#6b7280", fontSize: 10 }}>
                        {request.request_no} · {request.sku || "No SKU"}
                      </span>
                    </div>
                    <div>
                      <span style={{ display:"block",color:"#6b7280",fontSize:9,fontWeight:800,textTransform:"uppercase" }}>
                        Requested
                      </span>
                      <strong style={{fontSize:12}}>
                        {Number(request.requested_quantity||0).toLocaleString("en-PH")} {request.unit_type||"pcs"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ display:"block",color:"#6b7280",fontSize:9,fontWeight:800,textTransform:"uppercase" }}>
                        Current Stock
                      </span>
                      <strong style={{fontSize:12}}>
                        {Number(request.current_stock||0).toLocaleString("en-PH")} {request.unit_type||"pcs"}
                      </strong>
                    </div>
                    <button type="button" className="btn btn-primary"
                      onClick={() => openDeliveryFromRestock(request)}>
                      <Truck size={16} /> Create Delivery
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {isSupplier && (
        <section
          style={{
            display: "grid",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              padding: 20,
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <div>
              <span
                style={{
                  display: "block",
                  marginBottom: 5,
                  color: "#b98300",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Supplier Workspace
              </span>

              <h2
                style={{
                  margin: 0,
                  color: "#1b2430",
                  fontSize: 22,
                }}
              >
                My Delivery Requests
              </h2>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                Submit once, then track Admin review without
                re-entering the same delivery information.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openDeliveryModal}
            >
              <Plus size={17} />
              Submit Delivery
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            {[
              {
                label: "Pending Review",
                value:
                  deliveryStatistics
                    .pendingSupplierRequests,
                note: "Waiting for Admin",
                icon: <Clock3 size={20} />,
              },
              {
                label: "Approved",
                value:
                  deliveryStatistics
                    .supplierApproved,
                note: "Inventory received",
                icon: <CheckCircle2 size={20} />,
              },
              {
                label: "Rejected",
                value:
                  deliveryStatistics
                    .supplierRejected,
                note: "Needs attention",
                icon: <X size={20} />,
              },
              {
                label: "Total Requests",
                value:
                  deliveryStatistics
                    .supplierTotalRequests,
                note: "Submission history",
                icon: <ClipboardList size={20} />,
              },
            ].map((card) => (
              <article
                key={card.label}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    borderRadius: 10,
                    background: "#fff8dd",
                    color: "#b98300",
                  }}
                >
                  {card.icon}
                </div>

                <strong
                  style={{
                    display: "block",
                    color: "#1b2430",
                    fontSize: 24,
                  }}
                >
                  {card.value}
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    color: "#1b2430",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {card.label}
                </span>

                <small
                  style={{
                    display: "block",
                    marginTop: 3,
                    color: "#64748b",
                  }}
                >
                  {card.note}
                </small>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeDeliveryTab === "requests" &&
      !isSupplier ? (
        <section className="delivery-request-workspace">
          <div className="delivery-request-workspace-head">
            <div>
              <span className="delivery-request-eyebrow">
                Supplier Requests
              </span>

              <h2>Supplier Delivery Requests</h2>

              <p>
                Review submitted deliveries before inventory
                stock-in and supplier payable creation.
              </p>
            </div>

            <div className="delivery-request-pending-summary">
              <strong>
                {deliveryStatistics.pendingSupplierRequests}
              </strong>
              <span>Pending Review</span>
            </div>
          </div>

          <div className="delivery-request-toolbar">
            <div className="delivery-search delivery-request-search">
              <Search size={18} />

              <input
                type="text"
                placeholder="Search request number, supplier, or submitter..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="delivery-request-toolbar-actions">
              <div className="delivery-status-filter">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="All">All Request Statuses</option>
                  <option value="Pending">Pending Review</option>
                  <option value="Approved">Approved</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                <ChevronDown size={16} />
              </div>

              <div className="delivery-status-filter delivery-sort-filter">
                <select
                  value={requestSort}
                  onChange={(event) =>
                    setRequestSort(event.target.value)
                  }
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>

                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          <div className="delivery-request-table-wrap">
            <table className="delivery-request-table">
              <thead>
                <tr>
                  <th>Request No.</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Units</th>
                  <th>Supplier Payable</th>
                  <th>Delivery Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8">
                      <div className="delivery-request-state">
                        <LoaderCircle
                          size={25}
                          className="delivery-spinner"
                        />
                        <span>Loading supplier requests...</span>
                      </div>
                    </td>
                  </tr>
                ) : sortedFilteredDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="delivery-request-state empty">
                        <ClipboardList size={34} />
                        <strong>No supplier requests found</strong>
                        <span>
                          New supplier delivery requests will appear here automatically.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedFilteredDeliveries.map((delivery) => {
                    const isPendingRequest =
                      delivery.status === "Pending";

                    const productLines = Number(
                      delivery.product_line_count ||
                        delivery.items?.length ||
                        0
                    );

                    const totalUnits = Number(
                      delivery.items_count || 0
                    );

                    return (
                      <tr
                        key={delivery.delivery_id}
                        className={
                          isPendingRequest
                            ? "pending-request-row"
                            : ""
                        }
                      >
                        <td>
                          <div className="delivery-request-reference">
                            <span className="delivery-request-dot" />
                            <div>
                              <strong>
                                {delivery.delivery_order_no ||
                                  `DEL-${String(
                                    delivery.delivery_id
                                  ).padStart(4, "0")}`}
                              </strong>
                              <small>
                                {formatDateTime(
                                  delivery.submitted_at ||
                                    delivery.created_at ||
                                    delivery.delivery_date
                                )}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="delivery-request-supplier">
                            <span className="delivery-request-supplier-icon">
                              <Building2 size={17} />
                            </span>

                            <div>
                              <strong>
                                {delivery.vendor_name || "No supplier"}
                              </strong>
                              <small>
                                Submitted by{" "}
                                {delivery.submitted_by_name ||
                                  delivery.received_by ||
                                  "Supplier User"}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td className="delivery-request-number-cell">
                          {productLines}
                        </td>

                        <td className="delivery-request-number-cell">
                          {totalUnits}
                        </td>

                        <td className="delivery-request-money-cell">
                          <strong>
                            {formatPeso(
                              delivery.supplier_payable_amount ||
                                delivery.payable_amount ||
                                0
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong className="delivery-request-date">
                            {formatDate(delivery.delivery_date)}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={`delivery-request-status ${getWorkflowStatusClass(
                              delivery
                            )}`}
                          >
                            {getWorkflowStatusLabel(delivery)}
                          </span>
                        </td>

                        <td>
                          <div className="delivery-request-actions">
                            <button
                              type="button"
                              className="delivery-request-btn view"
                              onClick={() =>
                                openDeliveryDetails(delivery)
                              }
                            >
                              <Eye size={15} />
                              <span>View Details</span>
                            </button>

                            {isPendingRequest && canManageDeliveries ? (
                              <>
                                <button
                                  type="button"
                                  className="delivery-request-btn reject"
                                  disabled={
                                    reviewingDeliveryId ===
                                    delivery.delivery_id
                                  }
                                  onClick={() =>
                                    openRejectDelivery(delivery)
                                  }
                                >
                                  <X size={15} />
                                  <span>Reject</span>
                                </button>

                                <button
                                  type="button"
                                  className="delivery-request-btn approve"
                                  disabled={
                                    reviewingDeliveryId ===
                                    delivery.delivery_id
                                  }
                                  onClick={() =>
                                    approveSupplierDelivery(delivery)
                                  }
                                >
                                  {reviewingDeliveryId ===
                                  delivery.delivery_id ? (
                                    <LoaderCircle
                                      size={15}
                                      className="delivery-spinner"
                                    />
                                  ) : (
                                    <CheckCircle2 size={15} />
                                  )}
                                  <span>Approve</span>
                                </button>
                              </>
                            ) : (
                              <small className="delivery-request-reviewed-by">
                                {delivery.reviewed_by_name
                                  ? `Reviewed by ${delivery.reviewed_by_name}`
                                  : "No pending action"}
                              </small>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading &&
            sortedFilteredDeliveries.length > 0 && (
              <div className="delivery-request-footer">
                <span>
                  Showing 1 to {sortedFilteredDeliveries.length} of{" "}
                  {sortedFilteredDeliveries.length} requests
                </span>
              </div>
            )}
        </section>
      ) : (
      <div className="table-card delivery-record-card">
        <div className="delivery-toolbar">
          <div className="delivery-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search delivery number, supplier, receiver, or status..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="delivery-status-filter">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">
                Approved / Awaiting Delivery
              </option>
              <option value="In Transit">
                In Transit
              </option>
              <option value="Delivered">
                Received / Delivered
              </option>
              <option value="Rejected">
                Rejected
              </option>
              <option value="Cancelled">
                Cancelled
              </option>
            </select>

            <ChevronDown size={16} />
          </div>
        </div>

        <div className="delivery-table-wrapper">
          <table className="delivery-record-table">
            <thead>
              <tr>
                <th>Delivery No.</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Product Lines</th>
                <th>Total Units</th>
                <th>Supplier Payable</th>
                <th>Retail Value</th>
                <th>Status</th>
                <th>
                  {activeDeliveryTab === "requests"
                    ? "Submitted By"
                    : "Received By"}
                </th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10">
                    <div className="delivery-loading-state">
                      <LoaderCircle
                        className="delivery-spinner"
                        size={28}
                      />

                      <span>
                        Loading delivery transactions...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="10">
                    <div className="delivery-empty-state">
                      <Truck size={38} />

                      <h3>
                        No delivery transactions found
                      </h3>

                      <p>
                        Create a delivery to connect
                        Supplier, Inventory, Payables, POS,
                        and Reports.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDeliveries.map((delivery) => (
                  <tr key={delivery.delivery_id}>
                    <td>
                      <strong className="delivery-number">
                        {delivery.delivery_order_no ||
                          `DEL-${String(
                            delivery.delivery_id
                          ).padStart(4, "0")}`}
                      </strong>

                      {hasProductProposal(
                        delivery
                      ) && (
                        <div
                          style={{
                            marginTop: 6,
                            display: "grid",
                            gap: 3,
                          }}
                        >
                          <span
                            style={{
                              width:
                                "fit-content",
                              padding:
                                "4px 7px",
                              borderRadius:
                                999,
                              background:
                                "#fff3c4",
                              color:
                                "#8a6300",
                              fontSize: 8,
                              fontWeight:
                                900,
                              textTransform:
                                "uppercase",
                              letterSpacing:
                                "0.04em",
                              border:
                                "1px solid #f4b400",
                            }}
                          >
                            {getProposalCount(
                              delivery
                            ) > 1
                              ? `${getProposalCount(
                                  delivery
                                )} New Product Proposals`
                              : "New Product Proposal"}
                          </span>

                          {delivery.proposed_product_names && (
                            <small
                              title={
                                delivery.proposed_product_names
                              }
                              style={{
                                maxWidth:
                                  170,
                                overflow:
                                  "hidden",
                                textOverflow:
                                  "ellipsis",
                                whiteSpace:
                                  "nowrap",
                                color:
                                  "#64748b",
                                fontSize: 9,
                              }}
                            >
                              {
                                delivery.proposed_product_names
                              }
                            </small>
                          )}
                        </div>
                      )}
                    </td>

                    <td>
                      {formatDate(
                        delivery.delivery_date
                      )}
                    </td>

                    <td>
                      <div className="delivery-supplier-cell">
                        <div>
                          <Building2 size={17} />
                        </div>

                        <span>
                          <strong>
                            {delivery.vendor_name ||
                              "No supplier"}
                          </strong>

                          <small>
                            {delivery.contact_person ||
                              "Supplier transaction"}
                          </small>
                        </span>
                      </div>
                    </td>

                    <td>
                      {Number(
                        delivery.product_line_count ||
                          delivery.items?.length ||
                          0
                      )}
                    </td>

                    <td>
                      {Number(
                        delivery.items_count || 0
                      )}
                    </td>

                    <td>
                      <strong>
                        {formatPeso(
                          delivery.supplier_payable_amount ||
                            delivery.payable_amount ||
                            0
                        )}
                      </strong>
                    </td>

                    <td>
                      {formatPeso(delivery.amount)}
                    </td>

                    <td>
                      <span
                        className={`delivery-status ${getWorkflowStatusClass(
                          delivery
                        )}`}
                      >
                        {getWorkflowStatusLabel(
                          delivery
                        )}
                      </span>

                      {delivery.status ===
                        "Approved" && (
                        <small
                          style={{
                            display: "block",
                            marginTop: 5,
                            color: "#64748b",
                            fontSize: 9,
                            lineHeight: 1.35,
                          }}
                        >
                          Waiting for physical delivery
                        </small>
                      )}
                    </td>

                    <td>
                      {activeDeliveryTab === "requests"
                        ? delivery.submitted_by_name ||
                          delivery.received_by ||
                          "Supplier User"
                        : delivery.received_by ||
                          "Not provided"}
                    </td>

                    <td>
                      <div className="delivery-row-actions">
                        <button
                          type="button"
                          className="delivery-main-action view"
                          title="View delivery acknowledgement receipt"
                          aria-label="View delivery acknowledgement receipt"
                          onClick={() =>
                            openDeliveryDetails(delivery)
                          }
                        >
                          <Eye size={17} />
                        </button>

                        {canManageDeliveries &&
                          delivery.status === "Pending" &&
                          String(
                            delivery.submission_source || ""
                          ).toLowerCase() === "supplier" && (
                            <>
                              <button
                                type="button"
                                className="delivery-main-action success"
                                title="Approve supplier delivery"
                                onClick={() =>
                                  approveSupplierDelivery(delivery)
                                }
                                disabled={
                                  reviewingDeliveryId ===
                                  delivery.delivery_id
                                }
                              >
                                {reviewingDeliveryId ===
                                delivery.delivery_id ? (
                                  <LoaderCircle
                                    size={17}
                                    className="delivery-spinner"
                                  />
                                ) : (
                                  <CheckCircle2 size={17} />
                                )}
                              </button>

                              <button
                                type="button"
                                className="delivery-main-action danger"
                                title="Reject supplier delivery"
                                onClick={() =>
                                  openRejectDelivery(delivery)
                                }
                                disabled={
                                  reviewingDeliveryId ===
                                  delivery.delivery_id
                                }
                              >
                                <X size={17} />
                              </button>
                            </>
                          )}

                        {canManageDeliveries &&
                          delivery.status === "Pending" &&
                          String(
                            delivery.submission_source || "Admin"
                          ).toLowerCase() !== "supplier" && (
                            <>
                              <button
                                type="button"
                                className="delivery-main-action transit"
                                title="Mark delivery as In Transit"
                                onClick={() =>
                                  requestStatusUpdate(
                                    delivery,
                                    "In Transit"
                                  )
                                }
                              >
                                <Send size={17} />
                              </button>

                              <button
                                type="button"
                                className="delivery-main-action success"
                                title="Confirm delivery as Delivered"
                                onClick={() =>
                                  requestStatusUpdate(
                                    delivery,
                                    "Delivered"
                                  )
                                }
                              >
                                <CheckCircle2 size={17} />
                              </button>

                              <button
                                type="button"
                                className="delivery-main-action danger"
                                title="Cancel delivery"
                                onClick={() =>
                                  requestStatusUpdate(
                                    delivery,
                                    "Cancelled"
                                  )
                                }
                              >
                                <Ban size={17} />
                              </button>
                            </>
                          )}

                        {canManageDeliveries &&
                          (delivery.status === "Approved" ||
                            (delivery.status === "In Transit" &&
                              String(
                                delivery.submission_source || ""
                              ).toLowerCase() === "supplier")) && (
                            <button
                              type="button"
                              className="delivery-main-action success"
                              title="Receive physical delivery"
                              aria-label="Receive physical delivery"
                              onClick={() =>
                                openReceiveDelivery(delivery)
                              }
                              disabled={
                                receivingLoading ||
                                saving
                              }
                            >
                              {receivingLoading ? (
                                <LoaderCircle
                                  size={17}
                                  className="delivery-spinner"
                                />
                              ) : (
                                <Truck size={17} />
                              )}
                            </button>
                          )}

                        {canManageDeliveries &&
                          delivery.status === "In Transit" &&
                          String(
                            delivery.submission_source || "Admin"
                          ).toLowerCase() !== "supplier" && (
                            <>
                              <button
                                type="button"
                                className="delivery-main-action success"
                                title="Confirm delivery as Delivered"
                                aria-label="Confirm delivery as Delivered"
                                onClick={() =>
                                  requestStatusUpdate(
                                    delivery,
                                    "Delivered"
                                  )
                                }
                              >
                                <CheckCircle2 size={17} />
                              </button>

                              <button
                                type="button"
                                className="delivery-main-action danger"
                                title="Cancel delivery"
                                aria-label="Cancel delivery"
                                onClick={() =>
                                  requestStatusUpdate(
                                    delivery,
                                    "Cancelled"
                                  )
                                }
                              >
                                <Ban size={17} />
                              </button>
                            </>
                          )}

                        {canManageDeliveries &&
                          (delivery.status === "Delivered" ||
                            delivery.status === "Rejected" ||
                            delivery.status === "Cancelled") && (
                            <button
                              type="button"
                              className="delivery-main-action archive"
                              title="Archive delivery"
                              aria-label="Archive delivery"
                              onClick={() =>
                                requestArchive(delivery)
                              }
                            >
                              <Archive size={17} />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading &&
          filteredDeliveries.length > 0 && (
            <PaginationBar
              totalItems={filteredDeliveries.length}
              currentPage={deliveryPage}
              pageSize={DELIVERY_PAGE_SIZE}
              onPageChange={setDeliveryPage}
              itemLabel={
                activeDeliveryTab === "requests"
                  ? "requests"
                  : "deliveries"
              }
            />
          )}
      </div>

      )}

      {showDeliveryModal && (
        <DeliveryFormModal
          data={formData}
          vendors={visibleVendors}
          products={supplierProducts}
          isSupplier={isSupplier}
          resubmittingDeliveryId={
            resubmittingDeliveryId
          }
          categories={categories}
          users={users}
          selectedSupplier={selectedSupplier}
          summary={computedSummary}
          today={today}
          loading={referenceLoading}
          saving={saving}
          onHeaderChange={handleHeaderChange}
          onItemInput={handleItemInput}
          onAddProduct={addProductLine}
          onRemoveProduct={removeProductLine}
          onToggleNewProduct={
            isSupplier ? () => {} : toggleNewProduct
          }
          onOpenConsignment={openConsignment}
          onDisableConsignment={disableConsignment}
          onSavePending={() =>
            requestSave("Pending")
          }
          onConfirmDelivery={() =>
            requestSave(
              isSupplier ? "Pending" : "Delivered"
            )
          }
          onClose={closeDeliveryModal}
          getProductImage={getProductImage}
          formatPeso={formatPeso}
        />
      )}

      {showConsignmentModal &&
        consignmentIndex !== null && (
          <ConsignmentModal
            item={formData.items[consignmentIndex]}
            today={today}
            deliveryDate={formData.delivery_date}
            onChange={(name, value) =>
              updateItem(
                consignmentIndex,
                name,
                value
              )
            }
            onSave={saveConsignment}
            onClose={closeConsignment}
          />
        )}

      {showDetailsModal && selectedDelivery && (
        <DeliveryDetailsModal
          delivery={selectedDelivery}
          loading={detailsLoading}
          formatPeso={formatPeso}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          getProductImage={getProductImage}
          onPrint={() =>
            printDeliveryReceipt(selectedDelivery)
          }
          showReceipt={!isSupplier}
          canResubmit={
            isSupplier &&
            selectedDelivery.status ===
              "Rejected"
          }
          onResubmit={() =>
            openResubmitDelivery(
              selectedDelivery
            )
          }
          canReview={
            canManageDeliveries &&
            selectedDelivery.status === "Pending" &&
            String(
              selectedDelivery.submission_source || ""
            ).toLowerCase() === "supplier"
          }
          reviewing={
            reviewingDeliveryId ===
            selectedDelivery.delivery_id
          }
          onApprove={() =>
            approveSupplierDelivery(selectedDelivery)
          }
          onReject={() =>
            openRejectDelivery(selectedDelivery)
          }
          canReceive={
            canManageDeliveries &&
            (selectedDelivery.status === "Approved" ||
              (selectedDelivery.status === "In Transit" &&
                String(
                  selectedDelivery.submission_source || ""
                ).toLowerCase() === "supplier"))
          }
          receiving={
            receivingLoading ||
            saving
          }
          onReceive={() =>
            openReceiveDelivery(
              selectedDelivery
            )
          }
          canPublish={
            canManageDeliveries &&
            selectedDelivery.status ===
              "Delivered"
          }
          onPublish={() =>
            openPublishDeliveryProducts(
              selectedDelivery
            )
          }
          onClose={() => {
            if (detailsLoading) {
              return;
            }

            setShowDetailsModal(false);
            setSelectedDelivery(null);
          }}
        />
      )}


      

      {showReceiveModal &&
        receivingDelivery && (
          <ReceiveDeliveryModal
            delivery={receivingDelivery}
            items={receivingItems}
            remarks={receivingRemarks}
            saving={
              saving ||
              receivingLoading
            }
            today={today}
            formatPeso={formatPeso}
            formatDate={formatDate}
            onItemChange={
              updateReceivingItem
            }
            onRemarksChange={
              setReceivingRemarks
            }
            onSubmit={
              submitReceiveDelivery
            }
            onClose={
              closeReceiveDelivery
            }
          />
        )}

      {showPublishModal &&
        publishingDelivery && (
          <PublishDeliveryProductsModal
            delivery={
              publishingDelivery
            }
            items={publishingItems}
            saving={publishing}
            onPriceChange={
              updatePublishingPrice
            }
            onSubmit={
              submitPublishDeliveryProducts
            }
            onClose={closePublishModal}
          />
        )}

      {showRejectModal && rejectingDelivery && (
        <div className="modal-overlay">
          <div
            className="modal-box"
            style={{
              width: "min(520px, calc(100vw - 32px))",
            }}
          >
            <div className="delivery-modal-header">
              <div>
                <h2>Reject Delivery Request</h2>
                <p>{rejectingDelivery.delivery_order_no}</p>
              </div>
              <button
                type="button"
                className="delivery-modal-close"
                onClick={closeRejectDelivery}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 22 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 800,
                }}
              >
                Rejection reason
              </label>
              <textarea
                rows="5"
                value={rejectionReason}
                onChange={(event) =>
                  setRejectionReason(event.target.value)
                }
                maxLength={1000}
                placeholder="Explain why this delivery cannot be approved..."
                style={{
                  width: "100%",
                  resize: "vertical",
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: 12,
                  font: "inherit",
                }}
              />
            </div>

            <div className="delivery-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeRejectDelivery}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={rejectSupplierDelivery}
                disabled={saving || !rejectionReason.trim()}
              >
                {saving ? (
                  <LoaderCircle
                    size={17}
                    className="delivery-spinner"
                  />
                ) : (
                  <X size={17} />
                )}
                Reject Delivery
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <ConfirmationModal
          data={confirmation}
          saving={saving}
          onConfirm={() =>
            confirmation.action?.()
          }
          onClose={() => {
            if (!saving) {
              setShowConfirmModal(false);
            }
          }}
        />
      )}

      {notice.open && (
        <NoticeModal
          data={notice}
          onClose={closeNotice}
        />
      )}
    </div>
  );
}

function DeliveryStatCard({
  icon,
  label,
  value,
  className,
}) {
  return (
    <div
      className={`module-card delivery-stat-card ${className}`}
    >
      <div className="delivery-stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <h2>{value}</h2>
      </div>
    </div>
  );
}


function groupSupplierDeliveryItems(items = []) {
  const groups = [];
  const byKey = new Map();

  items.forEach((item, index) => {
    const key =
      item.family_group_key ||
      item.local_id ||
      `supplier-line-${index}`;

    if (!byKey.has(key)) {
      const group = {
        key,
        firstIndex: index,
        items: [],
      };

      byKey.set(key, group);
      groups.push(group);
    }

    byKey.get(key).items.push({
      item,
      index,
    });
  });

  return groups;
}

function DeliveryFormModal({
  data,
  vendors,
  products,
  isSupplier,
  resubmittingDeliveryId,
  categories,
  users,
  selectedSupplier,
  summary,
  today,
  loading,
  saving,
  onHeaderChange,
  onItemInput,
  onAddProduct,
  onRemoveProduct,
  onToggleNewProduct,
  onOpenConsignment,
  onDisableConsignment,
  onSavePending,
  onConfirmDelivery,
  onClose,
  getProductImage,
  formatPeso,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-box delivery-enterprise-modal">
        <div className="delivery-modal-header">
          <div>
            <div className="delivery-modal-title">
              <div>
                <Truck size={22} />
              </div>

              <h2>
                {isSupplier
                  ? resubmittingDeliveryId
                    ? "Correct Delivery Request"
                    : "Submit Delivery"
                  : "New Delivery"}
              </h2>
            </div>

            <p>
              {isSupplier
                ? "Send your delivery information to BFATC for Admin review. Inventory updates only after approval."
                : "Record the supplier transaction once. Connected modules update automatically when the delivery is confirmed."}
            </p>
          </div>

          <button
            type="button"
            className="delivery-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <div className="delivery-modal-body">
          {loading ? (
            <div className="delivery-reference-loading">
              <LoaderCircle
                className="delivery-spinner"
                size={30}
              />

              Loading suppliers, products, categories,
              and employees...
            </div>
          ) : (
            <>
              <section className="delivery-enterprise-section">
                <div className="delivery-section-heading">
                  <div>
                    <span>01</span>

                    <div>
                      <h3>Delivery Header</h3>

                      <p>
                        Select an existing supplier.
                        Contact information is reused
                        automatically.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="delivery-header-grid">
                  <DeliveryField label="Delivery Reference">
                    <input
                      type="text"
                      name="delivery_order_no"
                      value={
                        data.delivery_order_no
                      }
                      onChange={onHeaderChange}
                      placeholder="Auto-generated when empty"
                    />
                  </DeliveryField>

                  <DeliveryField
                    label="Delivery Date"
                    required
                  >
                    <input
                      type="date"
                      name="delivery_date"
                      min={today}
                      value={data.delivery_date}
                      onChange={onHeaderChange}
                    />
                  </DeliveryField>

                  <DeliveryField
                    label="Supplier"
                    required
                  >
                    <select
                      name="vendor_id"
                      value={data.vendor_id}
                      onChange={onHeaderChange}
                      disabled={isSupplier}
                    >
                      <option value="">
                        Select supplier
                      </option>

                      {vendors.map((vendor) => (
                        <option
                          key={vendor.vendor_id}
                          value={vendor.vendor_id}
                        >
                          {vendor.vendor_name}
                        </option>
                      ))}
                    </select>

                    {data.vendor_id && (
                      <small
                        style={{
                          display: "block",
                          marginTop: 7,
                          color:
                            products.length > 0
                              ? "#15803d"
                              : "#b45309",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {products.length > 0
                          ? `${products.length} approved product${
                              products.length === 1 ? "" : "s"
                            } available for this supplier.`
                          : "No approved products are available for this supplier yet."}
                      </small>
                    )}
                  </DeliveryField>

                  <DeliveryField label="Driver / Courier">
                    <input
                      type="text"
                      name="driver"
                      value={data.driver}
                      onChange={onHeaderChange}
                      placeholder="Enter driver or courier"
                    />
                  </DeliveryField>
                </div>

                {selectedSupplier && (
                  <div className="delivery-supplier-profile">
                    <div className="delivery-supplier-profile-icon">
                      <Building2 size={24} />
                    </div>

                    <div className="delivery-supplier-profile-main">
                      <span>Selected Supplier</span>

                      <h4>
                        {
                          selectedSupplier.vendor_name
                        }
                      </h4>

                      <p>
                        Information reused from Supplier
                        Management.
                      </p>
                    </div>

                    <div className="delivery-supplier-contact">
                      <div>
                        <UserRound size={16} />

                        <span>
                          <small>
                            Contact Person
                          </small>

                          <strong>
                            {selectedSupplier.contact_person ||
                              "Not provided"}
                          </strong>
                        </span>
                      </div>

                      <div>
                        <Truck size={16} />

                        <span>
                          <small>Phone</small>

                          <strong>
                            {selectedSupplier.phone ||
                              "Not provided"}
                          </strong>
                        </span>
                      </div>

                      <div>
                        <MapPin size={16} />

                        <span>
                          <small>Address</small>

                          <strong>
                            {selectedSupplier.address ||
                              "Not provided"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {!isSupplier ? (
              <section className="delivery-enterprise-section">
                <div className="delivery-section-heading">
                  <div>
                    <span>02</span>

                    <div>
                      <h3>Receiving Personnel</h3>

                      <p>
                        Select existing employees instead
                        of repeatedly typing staff names.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="delivery-header-grid">
                  <DeliveryField
                    label="Received By"
                    required
                  >
                    <select
                      name="received_by"
                      value={data.received_by}
                      onChange={onHeaderChange}
                    >
                      <option value="">
                        Select employee
                      </option>

                      {users.map((systemUser) => (
                        <option
                          key={systemUser.user_id}
                          value={
                            systemUser.full_name
                          }
                        >
                          {systemUser.full_name}
                          {systemUser.position
                            ? ` — ${systemUser.position}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </DeliveryField>

                  <DeliveryField label="Noted By">
                    <select
                      name="noted_by"
                      value={data.noted_by}
                      onChange={onHeaderChange}
                    >
                      <option value="">
                        Select employee
                      </option>

                      {users.map((systemUser) => (
                        <option
                          key={systemUser.user_id}
                          value={
                            systemUser.full_name
                          }
                        >
                          {systemUser.full_name}
                          {systemUser.position
                            ? ` — ${systemUser.position}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </DeliveryField>

                  <DeliveryField label="Payment Due Date">
                    <input
                      type="date"
                      name="due_date"
                      min={
                        data.delivery_date || today
                      }
                      value={data.due_date}
                      onChange={onHeaderChange}
                    />
                  </DeliveryField>

                  <DeliveryField
                    label="Remarks"
                    wide
                  >
                    <textarea
                      name="remarks"
                      value={data.remarks}
                      onChange={onHeaderChange}
                      placeholder="Optional delivery remarks"
                    />
                  </DeliveryField>
                </div>
              </section>

              ) : (
                <section className="delivery-enterprise-section">
                  <div className="delivery-section-heading">
                    <div>
                      <span>02</span>

                      <div>
                        <h3>Delivery Notes</h3>

                        <p>
                          Add optional information for Admin
                          to review when the products arrive.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="delivery-header-grid">
                    <DeliveryField
                      label="Remarks"
                      wide
                    >
                      <textarea
                        name="remarks"
                        value={data.remarks}
                        onChange={onHeaderChange}
                        placeholder="Optional delivery remarks for Admin"
                      />
                    </DeliveryField>
                  </div>
                </section>
              )}

              <section className="delivery-enterprise-section">
                <div className="delivery-section-heading product-heading">
                  <div>
                    <span>03</span>

                    <div>
                      <h3>
                        {isSupplier
                          ? "Products to Deliver"
                          : "Delivered Products"}
                      </h3>

                      <p>
                        {isSupplier
                          ? "Select only products already approved for your supplier account. New products must first be proposed from My Products."
                          : "Select an existing product or create a genuinely new product once."}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary delivery-add-product-btn"
                    onClick={onAddProduct}
                  >
                    <Plus size={17} />
                    Add Product Line
                  </button>
                </div>

                <div className="delivery-product-list">
                  {isSupplier
                    ? groupSupplierDeliveryItems(data.items).map(
                        (group, groupIndex) => (
                          <SupplierProductFamilyLine
                            key={group.key}
                            groupIndex={groupIndex}
                            group={group}
                            products={products}
                            today={today}
                            onInput={onItemInput}
                            onRemove={onRemoveProduct}
                            onOpenConsignment={
                              onOpenConsignment
                            }
                            onDisableConsignment={
                              onDisableConsignment
                            }
                            getProductImage={
                              getProductImage
                            }
                            formatPeso={formatPeso}
                          />
                        )
                      )
                    : data.items.map(
                        (item, index) => (
                          <DeliveryProductLine
                            key={item.local_id}
                            index={index}
                            item={item}
                            products={products}
                            isSupplier={isSupplier}
                            categories={categories}
                            today={today}
                            onInput={onItemInput}
                            onRemove={onRemoveProduct}
                            onToggleNew={
                              onToggleNewProduct
                            }
                            onOpenConsignment={
                              onOpenConsignment
                            }
                            onDisableConsignment={
                              onDisableConsignment
                            }
                            getProductImage={
                              getProductImage
                            }
                            formatPeso={formatPeso}
                          />
                        )
                      )}
                </div>
              </section>

              <section className="delivery-financial-summary">
                <div>
                  <span>Product Lines</span>
                  <strong>
                    {summary.productLines}
                  </strong>
                </div>

                <div>
                  <span>Total Units</span>
                  <strong>
                    {summary.totalUnits}
                  </strong>
                </div>

                {!isSupplier && (
                  <>
                    <div className="payable">
                      <span>Supplier Payable</span>

                      <strong>
                        {formatPeso(
                          summary.supplierPayable
                        )}
                      </strong>
                    </div>

                    <div className="retail">
                      <span>Retail Value</span>

                      <strong>
                        {formatPeso(
                          summary.retailValue
                        )}
                      </strong>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>

        <div className="delivery-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          {!isSupplier && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSavePending}
              disabled={saving || loading}
            >
              <FileText size={17} />
              Save as Pending
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirmDelivery}
            disabled={saving || loading}
          >
            {saving ? (
              <LoaderCircle
                className="delivery-spinner"
                size={17}
              />
            ) : (
              <CheckCircle2 size={17} />
            )}

            {saving
              ? "Processing..."
              : isSupplier &&
                resubmittingDeliveryId
              ? "Resubmit Delivery Request"
              : isSupplier
              ? "Submit Delivery Request"
              : "Confirm Delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}


function SupplierProductFamilyLine({
  groupIndex,
  group,
  products,
  today,
  onInput,
  onRemove,
  onOpenConsignment,
  onDisableConsignment,
  getProductImage,
  formatPeso,
}) {
  const normalizeFamilyKey = (product) => {
    if (product?.family_id) {
      return `family-${product.family_id}`;
    }

    return `legacy-${String(
      product?.product_name || ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
  };

  const variantLabelFor = (product) => {
    const explicit = String(
      product?.variant_label || ""
    ).trim();

    if (
      explicit &&
      explicit.toLowerCase() !== "standard"
    ) {
      return explicit;
    }

    const value = String(
      product?.variant_value || ""
    ).trim();

    const unit = String(
      product?.variant_unit || ""
    ).trim();

    if (value || unit) {
      return `${value}${
        value && unit ? " " : ""
      }${unit}`.trim();
    }

    return explicit || "Standard";
  };

  const firstEntry = group.items[0];
  const firstItem = firstEntry?.item || {};
  const firstIndex = firstEntry?.index ?? 0;

  const productFamilies = Array.from(
    products.reduce((map, product) => {
      const key = normalizeFamilyKey(product);

      if (!map.has(key)) {
        map.set(key, {
          key,
          product_name:
            product.product_name ||
            "Unnamed Product",
          variants: [],
        });
      }

      map.get(key).variants.push(product);
      return map;
    }, new Map()).values()
  ).sort((a, b) =>
    a.product_name.localeCompare(b.product_name)
  );

  const selectedFamilyKey =
    firstItem.family_id
      ? `family-${firstItem.family_id}`
      : firstItem.product_id
      ? normalizeFamilyKey(
          products.find(
            (product) =>
              String(product.product_id) ===
              String(firstItem.product_id)
          ) || {}
        )
      : "";

  const selectedFamily =
    productFamilies.find(
      (family) =>
        family.key === selectedFamilyKey
    ) || null;

  const selectedCount = group.items.filter(
    ({ item }) =>
      item.product_id &&
      item.selected_for_delivery !== false
  ).length;

  const familyImage =
    firstItem.product_image_preview ||
    getProductImage(firstItem);

  return (
    <article className="delivery-product-line delivery-family-line">
      <div className="delivery-product-line-header">
        <div>
          <span>
            Product Line {groupIndex + 1}
          </span>

          <span className="delivery-approved-products-only">
            {selectedCount} Variant
            {selectedCount === 1 ? "" : "s"} Selected
          </span>
        </div>

        <button
          type="button"
          className="delivery-remove-line"
          onClick={() => onRemove(firstIndex)}
        >
          <Trash2 size={16} />
          Remove Product
        </button>
      </div>

      <div className="delivery-family-main">
        <div className="delivery-family-image">
          {familyImage ? (
            <img
              src={familyImage}
              alt={
                firstItem.product_name ||
                "Product"
              }
              onError={(event) => {
                event.currentTarget.style.display =
                  "none";
              }}
            />
          ) : (
            <div className="delivery-family-image-placeholder">
              <Package size={32} />
              <small>No Product Image</small>
            </div>
          )}
        </div>

        <div className="delivery-family-content">
          <DeliveryField
            label="Product"
            required
            wide
          >
            <select
              name="family_id"
              value={selectedFamilyKey}
              onChange={(event) =>
                onInput(firstIndex, event)
              }
            >
              <option value="">
                Select approved product
              </option>

              {productFamilies.map(
                (family) => (
                  <option
                    key={family.key}
                    value={family.key}
                  >
                    {family.product_name}
                  </option>
                )
              )}
            </select>
          </DeliveryField>

          {selectedFamily ? (
            <div className="delivery-family-variants">
              <div className="delivery-family-variants-heading">
                <div>
                  <strong>
                    Approved Sizes / Variants
                  </strong>
                  <small>
                    Check every size included in
                    this delivery. Each selected
                    variant keeps its own quantity,
                    expiry, batch and consignment
                    information.
                  </small>
                </div>

                <span>
                  {selectedCount}/
                  {group.items.length} selected
                </span>
              </div>

              {group.items.map(
                ({ item, index }) => {
                  const checked =
                    item.selected_for_delivery !==
                    false;

                  return (
                    <div
                      key={item.local_id}
                      className={`delivery-variant-row${
                        checked
                          ? " selected"
                          : ""
                      }`}
                    >
                      <label className="delivery-variant-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            onInput(index, {
                              target: {
                                name:
                                  "selected_for_delivery",
                                value:
                                  event.target
                                    .checked,
                              },
                            })
                          }
                        />

                        <span>
                          <strong>
                            {item.variant_label ||
                              "Standard"}
                          </strong>
                          <small>
                            {item.sku || "No SKU"}
                          </small>
                        </span>
                      </label>

                      <div className="delivery-variant-price">
                        <span>
                          Supplier Price
                        </span>
                        <strong>
                          {formatPeso(
                            item.supplier_price ||
                              0
                          )}
                        </strong>
                      </div>

                      {checked && (
                        <>
                          <DeliveryField
                            label="Quantity"
                            required
                          >
                            <input
                              type="number"
                              name="quantity"
                              min="1"
                              value={item.quantity}
                              onChange={(event) =>
                                onInput(
                                  index,
                                  event
                                )
                              }
                            />
                          </DeliveryField>

                          <DeliveryField
                            label="Expiry Date"
                          >
                            <input
                              type="date"
                              name="expiry_date"
                              min={today}
                              value={
                                item.expiry_date ||
                                ""
                              }
                              onChange={(event) =>
                                onInput(
                                  index,
                                  event
                                )
                              }
                            />
                          </DeliveryField>

                          <div className="delivery-variant-consignment">
                            {Number(
                              item.is_consignment ||
                                0
                            ) === 1 ? (
                              <>
                                <button
                                  type="button"
                                  className="delivery-consignment-btn active"
                                  onClick={() =>
                                    onOpenConsignment(
                                      index
                                    )
                                  }
                                >
                                  <Package
                                    size={15}
                                  />
                                  Consignment
                                </button>

                                <button
                                  type="button"
                                  className="delivery-variant-clear-consignment"
                                  onClick={() =>
                                    onDisableConsignment(
                                      index
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="delivery-consignment-btn"
                                onClick={() =>
                                  onOpenConsignment(
                                    index
                                  )
                                }
                              >
                                <Package
                                  size={15}
                                />
                                Mark as
                                Consignment
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <div className="delivery-family-empty">
              <Package size={24} />
              <span>
                Select a product to load all of
                its approved variants.
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function DeliveryProductLine({
  index,
  item,
  products,
  isSupplier,
  categories,
  today,
  onInput,
  onRemove,
  onToggleNew,
  onOpenConsignment,
  onDisableConsignment,
  getProductImage,
  formatPeso,
}) {
  const normalizeFamilyKey = (product) => {
    if (product?.family_id) {
      return `family-${product.family_id}`;
    }

    return `legacy-${String(product?.product_name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
  };

  const variantLabelFor = (product) => {
    const explicit = String(product?.variant_label || "").trim();

    if (explicit && explicit.toLowerCase() !== "standard") {
      return explicit;
    }

    const value = String(product?.variant_value || "").trim();
    const unit = String(product?.variant_unit || "").trim();

    if (value || unit) {
      return `${value}${value && unit ? " " : ""}${unit}`.trim();
    }

    return explicit || "Standard";
  };

  const productFamilies = Array.from(
    products.reduce((map, product) => {
      const key = normalizeFamilyKey(product);

      if (!map.has(key)) {
        map.set(key, {
          key,
          family_id: product.family_id || "",
          product_name: product.product_name || "Unnamed Product",
          category:
            product.category_name ||
            product.category ||
            "Uncategorized",
          variants: [],
        });
      }

      map.get(key).variants.push(product);
      return map;
    }, new Map()).values()
  ).sort((a, b) =>
    a.product_name.localeCompare(b.product_name)
  );

  const selectedFamilyKey =
    item.family_id
      ? `family-${item.family_id}`
      : item.product_id
      ? normalizeFamilyKey(
          products.find(
            (product) =>
              String(product.product_id) === String(item.product_id)
          ) || {}
        )
      : "";

  const selectedFamily = productFamilies.find(
    (family) => family.key === selectedFamilyKey
  );

  const availableVariants = selectedFamily?.variants || [];

  const linePayable =
    Number(item.quantity || 0) *
    Number(item.supplier_price || 0);

  const lineRetail =
    Number(item.quantity || 0) *
    Number(item.retail_price || 0);

  return (
    <article className="delivery-product-line">
      <div className="delivery-product-line-header">
        <div>
          <span>Product Line {index + 1}</span>

          {!isSupplier && (
            <button
              type="button"
              className={
                Number(item.is_new_product) === 1
                  ? "delivery-mode-btn active"
                  : "delivery-mode-btn"
              }
              onClick={() => onToggleNew(index)}
            >
              <Plus size={15} />

              {Number(item.is_new_product) === 1
                ? "New Product"
                : "Switch to New Product"}
            </button>
          )}

          {isSupplier && (
            <span
              className="delivery-approved-products-only"
              title="New products must be submitted through Product Proposals first."
            >
              Approved Products Only
            </span>
          )}
        </div>

        <button
          type="button"
          className="delivery-remove-line"
          onClick={() => onRemove(index)}
        >
          <Trash2 size={16} />
          Remove
        </button>
      </div>

      <div className="delivery-product-line-body">
        <div className="delivery-product-image-panel">
          {item.product_image_preview ||
          getProductImage(item) ? (
            <img
              src={
                item.product_image_preview ||
                getProductImage(item)
              }
              alt={item.product_name || "Product"}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.style.display =
                  "none";

                const fallback =
                  event.currentTarget.nextElementSibling;

                if (fallback) {
                  fallback.style.display = "flex";
                }
              }}
            />
          ) : null}

          <div
            style={{
              width: "100%",
              height: 145,
              display:
                item.product_image_preview ||
                getProductImage(item)
                  ? "none"
                  : "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 7,
              borderRadius: 10,
              background: "#f8fafc",
              color: "#b98300",
            }}
          >
            <Package size={30} />
            <small
              style={{
                color: "#64748b",
                fontWeight: 800,
              }}
            >
              No Product Image
            </small>
          </div>

          {Number(item.is_new_product) === 1 && (
            <label className="delivery-product-upload">
              <ImagePlus size={17} />

              {item.product_image
                ? "Change Image"
                : "Upload Product Image"}

              <input
                type="file"
                name="product_image"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(event) =>
                  onInput(index, event)
                }
              />
            </label>
          )}
        </div>

        <div className="delivery-product-information">
          <h4>Product Information</h4>

          {Number(item.is_new_product) === 0 ? (
            <div className="delivery-variant-selector">
              <DeliveryField
                label="Product"
                required
                wide
              >
                <select
                  name="family_id"
                  value={selectedFamilyKey}
                  onChange={(event) =>
                    onInput(index, event)
                  }
                >
                  <option value="">
                    {productFamilies.length > 0
                      ? "Select approved product"
                      : "No approved products for selected supplier"}
                  </option>

                  {productFamilies.map((family) => (
                    <option
                      key={family.key}
                      value={family.key}
                    >
                      {family.product_name}
                    </option>
                  ))}
                </select>
              </DeliveryField>

              {selectedFamily && (
                <DeliveryField
                  label={
                    availableVariants.length > 1
                      ? "Available Size / Variant"
                      : "Approved Variant"
                  }
                  required
                  wide
                >
                  <select
                    name="product_id"
                    value={item.product_id}
                    onChange={(event) =>
                      onInput(index, event)
                    }
                  >
                    <option value="">
                      {availableVariants.length > 1
                        ? "Select size / variant"
                        : "Select approved SKU"}
                    </option>

                    {availableVariants
                      .slice()
                      .sort((a, b) =>
                        variantLabelFor(a).localeCompare(
                          variantLabelFor(b),
                          undefined,
                          { numeric: true }
                        )
                      )
                      .map((product) => (
                        <option
                          key={product.product_id}
                          value={product.product_id}
                        >
                          {variantLabelFor(product)}
                          {" — "}
                          {product.sku || `SKU #${product.product_id}`}
                        </option>
                      ))}
                  </select>

                  {item.product_id && (
                    <div className="delivery-selected-variant">
                      <span>
                        <strong>{item.variant_label || "Standard"}</strong>
                        <small>Selected size / variant</small>
                      </span>

                      <span>
                        <strong>{item.sku || "N/A"}</strong>
                        <small>Inventory SKU</small>
                      </span>

                      <span>
                        <strong>
                          {formatPeso(item.supplier_price || 0)}
                        </strong>
                        <small>Supplier price</small>
                      </span>
                    </div>
                  )}
                </DeliveryField>
              )}
            </div>
          ) : (
            <>
              <DeliveryField
                label="Product Name"
                required
                wide
              >
                <input
                  type="text"
                  name="product_name"
                  value={item.product_name}
                  onChange={(event) =>
                    onInput(index, event)
                  }
                  placeholder="Enter new product name"
                />
              </DeliveryField>

              <DeliveryField
                label="Product Description"
                wide
              >
                <textarea
                  name="description"
                  value={item.description || ""}
                  onChange={(event) =>
                    onInput(index, event)
                  }
                  placeholder="Describe the product, size, variant, packaging, ingredients/features, or other details Admin should review."
                  rows={4}
                />
              </DeliveryField>
            </>
          )}

          <div className="delivery-product-field-grid">
            <DeliveryField label="SKU" required>
              <input
                type="text"
                name="sku"
                value={item.sku}
                onChange={(event) =>
                  onInput(index, event)
                }
                placeholder="Product SKU"
                readOnly={
                  Number(item.is_new_product) === 0
                }
              />
            </DeliveryField>

            <DeliveryField
              label="Category"
              required
            >
              {Number(item.is_new_product) === 1 ? (
                <select
                  name="category_id"
                  value={item.category_id}
                  onChange={(event) =>
                    onInput(index, event)
                  }
                >
                  <option value="">
                    Select category
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.category_id}
                      value={category.category_id}
                    >
                      {category.category_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={item.category}
                  readOnly
                />
              )}
            </DeliveryField>

            <DeliveryField label="Unit" required>
              <select
                name="unit_type"
                value={item.unit_type}
                onChange={(event) =>
                  onInput(index, event)
                }
                disabled={
                  Number(item.is_new_product) === 0
                }
              >
                <option value="pcs">
                  Piece / pcs
                </option>
                <option value="pack">Pack</option>
                <option value="box">Box</option>
                <option value="bottle">
                  Bottle
                </option>
                <option value="can">Can</option>
                <option value="bag">Bag</option>
                <option value="kg">
                  Kilogram / kg
                </option>
                <option value="g">
                  Gram / g
                </option>
                <option value="liter">
                  Liter
                </option>
                <option value="ml">
                  Milliliter / ml
                </option>
                <option value="tray">Tray</option>
                <option value="set">Set</option>
              </select>
            </DeliveryField>

            <DeliveryField label="Reorder Level">
              <input
                type="number"
                name="reorder_level"
                min="0"
                value={item.reorder_level}
                onChange={(event) =>
                  onInput(index, event)
                }
                readOnly={
                  Number(item.is_new_product) === 0
                }
              />
            </DeliveryField>
          </div>
        </div>

        <div className="delivery-receiving-information">
          <h4>
            {isSupplier
              ? "Delivery Information"
              : "Receiving Details"}
          </h4>

          {isSupplier ? (
            <>
              <div className="delivery-product-field-grid">
                <DeliveryField
                  label="Quantity to Deliver"
                  required
                >
                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    value={item.quantity}
                    onChange={(event) =>
                      onInput(index, event)
                    }
                  />
                </DeliveryField>

                <DeliveryField label="Expiry Date">
                  <input
                    type="date"
                    name="expiry_date"
                    min={today}
                    value={item.expiry_date}
                    onChange={(event) =>
                      onInput(index, event)
                    }
                  />
                </DeliveryField>

                {Number(item.is_new_product) === 1 && (
                  <>
                    <DeliveryField
                      label="Proposed Supplier Price"
                      required
                    >
                      <input
                        type="number"
                        name="supplier_price"
                        min="0"
                        step="0.01"
                        value={item.supplier_price}
                        onChange={(event) =>
                          onInput(index, event)
                        }
                        placeholder="0.00"
                      />
                    </DeliveryField>

                    <DeliveryField
                      label="Suggested Selling Price (Optional)"
                    >
                      <input
                        type="number"
                        name="retail_price"
                        min="0"
                        step="0.01"
                        value={item.retail_price}
                        onChange={(event) =>
                          onInput(index, event)
                        }
                        placeholder="Optional"
                      />

                      <small
                        style={{
                          display: "block",
                          marginTop: 6,
                          color: "#64748b",
                          fontSize: 10,
                          lineHeight: 1.45,
                        }}
                      >
                        For BFATC reference only. Admin/Staff will
                        set the final selling price before approval.
                      </small>
                    </DeliveryField>
                  </>
                )}
              </div>

              {Number(item.is_new_product) === 1 ? (
                <>
                  <div className="delivery-line-values">
                    <div>
                      <span>Proposed Supplier Payable</span>
                      <strong>
                        {formatPeso(linePayable)}
                      </strong>
                      <small>
                        For Admin review only — no payable is created yet
                      </small>
                    </div>

                    <div>
                      <span>Suggested Selling Value</span>
                      <strong>
                        {formatPeso(lineRetail)}
                      </strong>
                      <small>
                        Optional Supplier suggestion — Admin/Staff sets the final price before approval
                      </small>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 10,
                      background: "#fff8dd",
                      color: "#7c5d00",
                      fontSize: 11,
                      lineHeight: 1.55,
                    }}
                  >
                    <strong>New Product Proposal:</strong>{" "}
                    this product will be sent to Admin/Staff for review.
                    It will not be added to Inventory, batches, POS, or
                    supplier payables until the request is approved and
                    the physical delivery is received.
                  </div>
                </>
              ) : (
                <div className="delivery-line-values">
                  <div>
                    <span>Approved Supplier Price</span>
                    <strong>
                      {formatPeso(
                        item.supplier_price || 0
                      )}
                    </strong>
                    <small>
                      Price from the approved product record
                    </small>
                  </div>

                  <div>
                    <span>Approved Retail Price</span>
                    <strong>
                      {formatPeso(
                        item.retail_price || 0
                      )}
                    </strong>
                    <small>
                      Managed by BFATC
                    </small>
                  </div>
                </div>
              )}

              <div className="delivery-consignment-control">
                {Number(item.is_consignment) === 1 ? (
                  <>
                    <button
                      type="button"
                      className="delivery-consignment-btn active"
                      onClick={() =>
                        onOpenConsignment(index)
                      }
                    >
                      <CheckCircle2 size={16} />
                      Consignment Configured
                    </button>

                    <button
                      type="button"
                      className="delivery-consignment-remove"
                      onClick={() =>
                        onDisableConsignment(index)
                      }
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="delivery-consignment-btn"
                    onClick={() =>
                      onOpenConsignment(index)
                    }
                  >
                    <Package size={16} />
                    Mark as Consignment
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="delivery-product-field-grid">
                <DeliveryField
                  label="Quantity"
                  required
                >
                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    value={item.quantity}
                    onChange={(event) =>
                      onInput(index, event)
                    }
                  />
                </DeliveryField>

                <DeliveryField
                  label="Supplier Price"
                  required
                >
                  <input
                    type="number"
                    name="supplier_price"
                    min="0"
                    step="0.01"
                    value={item.supplier_price}
                    onChange={(event) =>
                      onInput(index, event)
                    }
                  />
                </DeliveryField>

                <DeliveryField
                  label="Retail Price"
                  required
                >
                  <input
                    type="number"
                    name="retail_price"
                    min="0.01"
                    step="0.01"
                    value={item.retail_price}
                    onChange={(event) =>
                      onInput(index, event)
                    }
                  />
                </DeliveryField>

                <DeliveryField label="Expiry Date">
                  <input
                    type="date"
                    name="expiry_date"
                    min={today}
                    value={item.expiry_date}
                    onChange={(event) =>
                      onInput(index, event)
                    }
                  />
                </DeliveryField>
              </div>

              <div className="delivery-line-values">
                <div>
                  <span>Supplier Payable</span>
                  <strong>
                    {formatPeso(linePayable)}
                  </strong>
                </div>

                <div>
                  <span>Retail Value</span>
                  <strong>
                    {formatPeso(lineRetail)}
                  </strong>
                </div>
              </div>

              <div className="delivery-consignment-control">
                {Number(item.is_consignment) === 1 ? (
                  <>
                    <button
                      type="button"
                      className="delivery-consignment-btn active"
                      onClick={() =>
                        onOpenConsignment(index)
                      }
                    >
                      <CheckCircle2 size={16} />
                      Consignment Configured
                    </button>

                    <button
                      type="button"
                      className="delivery-consignment-remove"
                      onClick={() =>
                        onDisableConsignment(index)
                      }
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="delivery-consignment-btn"
                    onClick={() =>
                      onOpenConsignment(index)
                    }
                  >
                    <Package size={16} />
                    Mark as Consignment
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function DeliveryField({
  label,
  required,
  wide,
  children,
}) {
  return (
    <div
      className={
        wide
          ? "delivery-field wide"
          : "delivery-field"
      }
    >
      <label>
        {label}
        {required && <strong> *</strong>}
      </label>

      {children}
    </div>
  );
}

function ConsignmentModal({
  item,
  today,
  deliveryDate,
  onChange,
  onSave,
  onClose,
}) {
  const startDate =
    deliveryDate || today;

  return (
    <div className="modal-overlay delivery-secondary-overlay">
      <div className="modal-box delivery-consignment-modal">
        <div className="delivery-modal-header">
          <div>
            <div className="delivery-modal-title">
              <div>
                <Package size={22} />
              </div>

              <h2>Consignment Details</h2>
            </div>

            <p>
              The consignment period starts automatically on the
              scheduled delivery date. Set the expected pull-out date;
              terms and notes are optional.
            </p>
          </div>

          <button
            type="button"
            className="delivery-modal-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="delivery-consignment-body">
          <div className="delivery-header-grid">
            <DeliveryField
              label="Consignment Start Date"
            >
              <input
                type="date"
                value={startDate}
                readOnly
                aria-readonly="true"
              />
            </DeliveryField>

            <DeliveryField
              label="Pull-out Date"
              required
            >
              <input
                type="date"
                min={startDate}
                value={
                  item.consignment_pullout_date
                }
                onChange={(event) =>
                  onChange(
                    "consignment_pullout_date",
                    event.target.value
                  )
                }
              />
            </DeliveryField>
          </div>

          <DeliveryField
            label="Terms and Conditions (Optional)"
            wide
          >
            <textarea
              value={item.consignment_terms}
              onChange={(event) =>
                onChange(
                  "consignment_terms",
                  event.target.value
                )
              }
              placeholder="Optional consignment terms and conditions"
            />
          </DeliveryField>

          <DeliveryField
            label="Notes (Optional)"
            wide
          >
            <textarea
              value={item.consignment_notes}
              onChange={(event) =>
                onChange(
                  "consignment_notes",
                  event.target.value
                )
              }
              placeholder="Optional consignment notes"
            />
          </DeliveryField>
        </div>

        <div className="delivery-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
          >
            Save Consignment
          </button>
        </div>
      </div>
    </div>
  );
}

function ApprovalPricingModal({
  delivery,
  items,
  saving,
  loading,
  formatPeso,
  onPriceChange,
  onSubmit,
  onClose,
}) {
  return (
    <div className="modal-overlay">
      <div
        className="modal-box"
        style={{
          width:
            "min(760px, calc(100vw - 32px))",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div className="delivery-modal-header">
          <div>
            <div className="delivery-modal-title">
              <div>
                <CircleDollarSign size={22} />
              </div>

              <h2>
                Set Final Selling Price
              </h2>
            </div>

            <p>
              Set BFATC's selling price for approved products that do not yet have a retail price. This applies to the delivery review, not Product Proposal approval.
            </p>
          </div>

          <button
            type="button"
            className="delivery-modal-close"
            onClick={onClose}
            disabled={saving || loading}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            padding: "0 22px 22px",
          }}
        >
          <div
            style={{
              marginBottom: 16,
              padding: 13,
              borderRadius: 10,
              background: "#fff8dd",
              color: "#6b5200",
              fontSize: 11,
              lineHeight: 1.55,
            }}
          >
            <strong>
              BFATC controls the final retail price.
            </strong>{" "}
            Approval still does not add stock to
            Inventory. Stock and payable are created
            only after physical receiving.
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {items.map((item, index) => (
              <div
                key={
                  item.delivery_item_id ||
                  index
                }
                style={{
                  padding: 15,
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: "block",
                        color: "#1b2430",
                        fontSize: 14,
                      }}
                    >
                      {item.product_name}
                    </strong>

                    <small
                      style={{
                        color: "#64748b",
                      }}
                    >
                      {item.sku ||
                        "No SKU"}
                    </small>
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                    }}
                  >
                    <small
                      style={{
                        display: "block",
                        color: "#64748b",
                      }}
                    >
                      Current BFATC Price
                    </small>

                    <strong>
                      Not yet set
                    </strong>
                  </div>
                </div>

                <DeliveryField
                  label="Final BFATC Selling Price"
                  required
                >
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      item.final_selling_price
                    }
                    onChange={(event) =>
                      onPriceChange(
                        index,
                        event.target.value
                      )
                    }
                    placeholder="Enter final selling price"
                  />
                </DeliveryField>
              </div>
            ))}
          </div>
        </div>

        <div className="delivery-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving || loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={saving || loading}
          >
            {saving || loading ? (
              <LoaderCircle
                size={17}
                className="delivery-spinner"
              />
            ) : (
              <CheckCircle2 size={17} />
            )}

            Set Price & Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiveDeliveryModal({
  delivery,
  items,
  remarks,
  saving,
  today,
  formatPeso,
  formatDate,
  onItemChange,
  onRemarksChange,
  onSubmit,
  onClose,
}) {
  const totalApproved = items.reduce(
    (sum, item) =>
      sum +
      Number(
        item.approved_quantity || 0
      ),
    0
  );

  const totalReceived = items.reduce(
    (sum, item) =>
      sum +
      Number(
        item.received_quantity || 0
      ),
    0
  );

  const payable = items.reduce(
    (sum, item) =>
      sum +
      Number(
        item.received_quantity || 0
      ) *
        Number(
          item.supplier_price || 0
        ),
    0
  );

  return (
    <div className="modal-overlay delivery-secondary-overlay">
      <div className="modal-box delivery-receive-modal">
        <div className="delivery-modal-header delivery-receive-header">
          <div>
            <div className="delivery-modal-title">
              <div>
                <Truck size={22} />
              </div>

              <h2>Receive Physical Delivery</h2>
            </div>

            <p>
              Confirm the actual products BFATC physically received
              before adding stock and creating the supplier payable.
            </p>
          </div>

          <button
            type="button"
            className="delivery-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <div className="delivery-receive-body">
          <section className="delivery-receive-meta">
            <div>
              <span>Delivery</span>
              <strong>
                {delivery.delivery_order_no}
              </strong>
            </div>

            <div>
              <span>Supplier</span>
              <strong>
                {delivery.vendor_name}
              </strong>
            </div>

            <div>
              <span>Scheduled Date</span>
              <strong>
                {formatDate(
                  delivery.delivery_date
                )}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>
                Approved / Awaiting Delivery
              </strong>
            </div>
          </section>

          <section className="delivery-receive-section">
            <div className="delivery-receive-section-heading">
              <div>
                <span>01</span>

                <div>
                  <h3>Products Received</h3>
                  <p>
                    Enter the actual quantity physically received for
                    each approved product.
                  </p>
                </div>
              </div>
            </div>

            <div className="delivery-receive-product-list">
              {items.map((item, index) => (
                <article
                  key={
                    item.delivery_item_id ||
                    index
                  }
                  className="delivery-receive-product-card"
                >
                  <div className="delivery-receive-product-main">
                    <div>
                      <span>Product</span>
                      <h4>{item.product_name}</h4>
                      <small>
                        {item.is_new_product
                          ? "New Product Proposal"
                          : item.sku ||
                            "Existing Product"}
                      </small>
                    </div>

                    <div className="delivery-receive-payable">
                      <span>Line Payable</span>
                      <strong>
                        {formatPeso(
                          Number(
                            item.received_quantity ||
                              0
                          ) *
                            Number(
                              item.supplier_price ||
                                0
                            )
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="delivery-receive-fields">
                    <div className="delivery-receive-readonly">
                      <span>Approved Qty</span>
                      <strong>
                        {Number(
                          item.approved_quantity ||
                            0
                        )}
                      </strong>
                    </div>

                    <label>
                      <span>Received Qty</span>
                      <input
                        type="number"
                        min="1"
                        max={Number(
                          item.approved_quantity ||
                            0
                        )}
                        value={
                          item.received_quantity
                        }
                        onChange={(event) =>
                          onItemChange(
                            index,
                            "received_quantity",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <span>Supplier Price</span>
                      <div className="delivery-receive-money-input">
                        <b>₱</b>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            item.supplier_price
                          }
                          onChange={(event) =>
                            onItemChange(
                              index,
                              "supplier_price",
                              event.target.value
                            )
                          }
                        />
                      </div>
                    </label>

                    <label>
                      <span>Expiry Date</span>
                      <input
                        type="date"
                        min={today}
                        value={
                          item.expiry_date
                        }
                        onChange={(event) =>
                          onItemChange(
                            index,
                            "expiry_date",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="delivery-receive-summary">
            <div>
              <span>Approved Units</span>
              <strong>{totalApproved}</strong>
            </div>

            <div>
              <span>Actual Received</span>
              <strong>{totalReceived}</strong>
            </div>

            <div className="payable">
              <span>Supplier Payable</span>
              <strong>
                {formatPeso(payable)}
              </strong>
            </div>
          </section>

          <section className="delivery-receive-remarks">
            <label>
              <span>Receiving Remarks</span>
              <textarea
                value={remarks}
                onChange={(event) =>
                  onRemarksChange(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Optional: damaged packaging, quantity discrepancy, receiving notes, etc."
              />
            </label>
          </section>

          <div className="delivery-receive-note">
            <strong>Physical receiving only.</strong>
            <span>
              Inventory, batches, and supplier payable update after
              confirmation. Selling price and publishing remain
              separate through Set Price & Publish.
            </span>
          </div>
        </div>

        <div className="delivery-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle
                size={17}
                className="delivery-spinner"
              />
            ) : (
              <CheckCircle2 size={17} />
            )}

            Confirm & Receive Delivery
          </button>
        </div>
      </div>
    </div>
  );
}

function DeliveryDetailsModal({
  delivery,
  loading,
  formatPeso,
  formatDate,
  formatDateTime,
  getProductImage,
  onPrint,
  showReceipt = true,
  canResubmit = false,
  onResubmit,
  canReview = false,
  reviewing = false,
  onApprove,
  onReject,
  canReceive = false,
  receiving = false,
  onReceive,
  canPublish = false,
  onPublish,
  onClose,
}) {
  const showOfficialReceipt =
    showReceipt &&
    String(delivery?.status || "") === "Delivered";

  const items = delivery.items || [];

  const consignmentItems = items.filter(
    (item) => Number(item.is_consignment || 0) === 1
  );

  const hasConsignment = consignmentItems.length > 0;

  const proposalItems = items.filter(
    (item) =>
      Number(item.is_new_product || 0) === 1 ||
      (!item.product_id &&
        Boolean(
          item.proposed_product_name ||
            item.proposed_sku
        ))
  );

  const itemDisplayName = (item) => {
    const baseName =
      item.proposed_product_name ||
      item.effective_product_name ||
      item.product_display_name ||
      item.product_name ||
      "Unnamed Product";

    const explicit = String(
      item.variant_label || ""
    ).trim();

    const value = String(
      item.variant_value || ""
    ).trim();

    const unit = String(
      item.variant_unit || ""
    ).trim();

    const variant =
      explicit &&
      explicit.toLowerCase() !== "standard"
        ? explicit
        : value || unit
        ? `${value}${value && unit ? " " : ""}${unit}`.trim()
        : "";

    return variant &&
      !String(baseName).includes(variant)
      ? `${baseName} — ${variant}`
      : baseName;
  };

  const itemDisplaySku = (item) =>
    item.proposed_sku ||
    item.effective_sku ||
    item.sku ||
    "N/A";

  const itemDisplayUnit = (item) =>
    item.proposed_unit ||
    item.effective_unit ||
    item.unit ||
    item.unit_type ||
    "pcs";

  const itemDisplayCategory = (item) =>
    item.proposed_category ||
    item.category_name ||
    item.category ||
    "Uncategorized";

  const itemDisplayImage = (item) => {
    const image =
      item.proposed_product_image ||
      item.effective_product_image ||
      item.product_image ||
      "";

    return image
      ? getProductImage({
          product_image: image,
        })
      : "";
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box delivery-details-modal">
        <div className="delivery-modal-header no-print">
          <div>
            <div className="delivery-modal-title">
              <div>
                <FileText size={22} />
              </div>

              <h2>
                {showOfficialReceipt
                  ? "Official Delivery Receipt"
                  : "Delivery Request Details"}
              </h2>
            </div>

            <p>
              {delivery.status === "Delivered"
                ? "Official receipt generated from the approved delivery transaction."
                : "Review and tracking details for this supplier delivery request."}
            </p>
          </div>

          <button
            type="button"
            className="delivery-modal-close"
            onClick={onClose}
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="delivery-details-loading">
            <LoaderCircle
              className="delivery-spinner"
              size={30}
            />

            <span>
              Loading complete delivery details...
            </span>
          </div>
        ) : (
          <>
            <div
              className={`delivery-receipt ${
                showOfficialReceipt
                  ? "delivery-classic-receipt"
                  : ""
              }`}
              id="delivery-receipt"
            >
              {showOfficialReceipt ? (
                <>
              <header className="delivery-classic-header">
                <img
                  src={bacnotanLogo}
                  alt="Bacnotan Logo"
                  className="delivery-classic-logo"
                />

                <div className="delivery-classic-brand">
                  <h2>
                    BACNOTAN FARMERS AGRI-TOURISM CENTER
                  </h2>

                  <p>
                    HiveSync Integrated Business and Operations Management System
                  </p>
                </div>

                <div className="delivery-classic-reference">
                  <span>
                    Delivery Receipt No.
                  </span>

                  <strong>
                    DR-
                    {String(
                      delivery.delivery_id ||
                        0
                    ).padStart(5, "0")}
                  </strong>
                </div>
              </header>

              <div className="delivery-classic-title">
                <h3>Delivery Receipt</h3>
              </div>

              <div className="delivery-classic-fields">
                <div>
                  <span>Delivered To</span>

                  <strong>
                    BACNOTAN FARMERS AGRI-TOURISM CENTER
                  </strong>
                </div>

                <div>
                  <span>Date</span>

                  <strong>
                    {formatDate(
                      delivery.delivery_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Supplier</span>

                  <strong>
                    {delivery.vendor_name ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Delivered By</span>

                  <strong>
                    {delivery.driver ||
                      delivery.contact_person ||
                      delivery.submitted_by_name ||
                      delivery.vendor_name ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Delivery No.</span>

                  <strong>
                    {delivery.delivery_order_no ||
                      `DEL-${String(
                        delivery.delivery_id ||
                          0
                      ).padStart(4, "0")}`}
                  </strong>
                </div>

                <div>
                  <span>Status</span>

                  <strong>
                    {delivery.status ||
                      "Delivered"}
                  </strong>
                </div>
              </div>

              <table className="delivery-classic-table">
                <thead>
                  <tr>
                    <th>Qty.</th>
                    <th>Unit</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="delivery-classic-empty"
                      >
                        No delivery item details available.
                      </td>
                    </tr>
                  ) : (
                    items.map(
                      (item, index) => {
                        const quantity =
                          Number(
                            item.quantity ||
                              0
                          );

                        const supplierPrice =
                          Number(
                            item.supplier_price ||
                              0
                          );

                        return (
                          <tr
                            key={
                              item.delivery_item_id ||
                              item.item_id ||
                              index
                            }
                          >
                            <td>
                              {quantity}
                            </td>

                            <td>
                              {itemDisplayUnit(
                                item
                              )}
                            </td>

                            <td>
                              {itemDisplayName(
                                item
                              )}
                            </td>

                            <td>
                              {formatPeso(
                                supplierPrice
                              )}
                            </td>

                            <td>
                              {formatPeso(
                                quantity *
                                  supplierPrice
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}

                  {Array.from({
                    length: Math.max(
                      0,
                      12 - items.length
                    ),
                  }).map(
                    (_, index) => (
                      <tr
                        key={`delivery-receipt-blank-${index}`}
                        className="delivery-classic-blank-row"
                      >
                        <td>&nbsp;</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    )
                  )}

                  <tr className="delivery-classic-total-row">
                    <td colSpan="3"></td>

                    <td>
                      TOTAL
                    </td>

                    <td>
                      {formatPeso(
                        delivery.supplier_payable_amount ||
                          delivery.payable_amount ||
                          items.reduce(
                            (
                              sum,
                              item
                            ) =>
                              sum +
                              Number(
                                item.quantity ||
                                  0
                              ) *
                                Number(
                                  item.supplier_price ||
                                    0
                                ),
                            0
                          )
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="delivery-classic-summary">
                <span>
                  Product Lines:
                  <strong>
                    {items.length}
                  </strong>
                </span>

                <span>
                  Total Quantity:
                  <strong>
                    {items.reduce(
                      (
                        sum,
                        item
                      ) =>
                        sum +
                        Number(
                          item.quantity ||
                            0
                        ),
                      0
                    )}
                  </strong>
                </span>
              </div>

              <div className="delivery-classic-certification">
                <p>
                  Checked and certified that the above merchandise was received and recorded in HiveSync.
                </p>

                <p>
                  Received in good order and condition, subject to the recorded delivery details.
                </p>
              </div>

              <div className="delivery-classic-signatures">
                <div>
                  <span>
                    {delivery.received_by_name ||
                      delivery.legacy_received_by ||
                      delivery.received_by ||
                      ""}
                  </span>

                  <strong>
                    Checked / Received By
                  </strong>
                </div>

                <div>
                  <span>
                    {delivery.vendor_name ||
                      ""}
                  </span>

                  <strong>
                    Supplier / Delivered By
                  </strong>
                </div>
              </div>

              <div className="delivery-classic-footnote">
                This delivery receipt was generated through HiveSync.
              </div>
                </>
              ) : (
                <>
              <div className="delivery-receipt-header">
                <div className="delivery-receipt-brand">
                  <img
                    src={bacnotanLogo}
                    alt="Bacnotan Logo"
                    width="68"
                    height="68"
                    style={{
                      width: "68px",
                      height: "68px",
                      minWidth: "68px",
                      maxWidth: "68px",
                      maxHeight: "68px",
                      objectFit: "contain",
                      flex: "0 0 68px",
                    }}
                  />

                  <div>
                    <h2>
                      Bacnotan Farmers Agri-Tourism
                      Center
                    </h2>

                    <p>Bacnotan, La Union</p>

                    <span>
                      {showOfficialReceipt
                        ? "OFFICIAL DELIVERY RECEIPT"
                        : "DELIVERY REQUEST"}
                    </span>
                  </div>
                </div>

                <div>
                  <strong>
                    {showOfficialReceipt
                      ? `DR-${String(
                          delivery.delivery_id
                        ).padStart(5, "0")}`
                      : delivery.delivery_order_no ||
                        `DEL-${String(
                          delivery.delivery_id
                        ).padStart(4, "0")}`}
                  </strong>

                  {showOfficialReceipt && (
                    <span>
                      Delivery:{" "}
                      {delivery.delivery_order_no ||
                        `DEL-${String(
                          delivery.delivery_id
                        ).padStart(4, "0")}`}
                    </span>
                  )}

                  <span>
                    {formatDate(
                      delivery.delivery_date
                    )}
                  </span>
                </div>
              </div>

              {String(
                delivery.submission_source || ""
              ).toLowerCase() === "supplier" && (
                <div
                  className="no-print"
                  style={{
                    margin: "0 0 18px",
                    padding: 18,
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    background: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          display: "block",
                          marginBottom: 4,
                          color: "#b98300",
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                        }}
                      >
                        Approval Workflow
                      </span>

                      <strong
                        style={{
                          color: "#1b2430",
                          fontSize: 15,
                        }}
                      >
                        Supplier Delivery Timeline
                      </strong>
                    </div>

                    <span
                      className={`delivery-status ${String(
                        delivery.status || ""
                      )
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {delivery.status === "Approved"
                        ? "Approved / Awaiting Delivery"
                        : delivery.status === "Delivered"
                        ? "Received / Delivered"
                        : delivery.status}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 0,
                    }}
                  >
                    <WorkflowTimelineStep
                      done={Boolean(
                        delivery.submitted_at ||
                          delivery.created_at
                      )}
                      active={
                        delivery.status === "Pending"
                      }
                      title="Submitted by Supplier"
                      detail={
                        delivery.submitted_by_name ||
                        "Supplier User"
                      }
                      date={
                        delivery.submitted_at ||
                        delivery.created_at
                      }
                      formatDate={formatDateTime}
                    />

                    <WorkflowTimelineStep
                      done={
                        delivery.status === "Approved" ||
                        delivery.status === "In Transit" ||
                        delivery.status === "Delivered" ||
                        delivery.status === "Rejected"
                      }
                      active={
                        delivery.status === "Pending"
                      }
                      title={
                        delivery.status === "Pending"
                          ? "Waiting for Admin Review"
                          : "Admin Review Completed"
                      }
                      detail={
                        delivery.status === "Pending"
                          ? "No inventory or supplier payable changes yet."
                          : delivery.reviewed_by_name ||
                            "System Admin"
                      }
                      date={delivery.reviewed_at}
                      formatDate={formatDateTime}
                    />

                    <WorkflowTimelineStep
                      done={
                        delivery.status === "Approved" ||
                        delivery.status === "In Transit" ||
                        delivery.status === "Delivered"
                      }
                      error={
                        delivery.status === "Rejected"
                      }
                      active={
                        delivery.status === "Approved" ||
                        delivery.status === "In Transit"
                      }
                      title={
                        delivery.status === "Rejected"
                          ? "Delivery Rejected"
                          : delivery.status === "Delivered"
                          ? "Physical Delivery Received"
                          : delivery.status === "Approved" ||
                            delivery.status === "In Transit"
                          ? "Approved — Awaiting Delivery"
                          : "Approval Result"
                      }
                      detail={
                        delivery.status === "Rejected"
                          ? delivery.rejection_reason ||
                            "No rejection reason was provided."
                          : delivery.status === "Delivered"
                          ? "BFATC received the goods. Inventory, batches, and supplier payable were updated."
                          : delivery.status === "Approved" ||
                            delivery.status === "In Transit"
                          ? "Request approved. No inventory or payable changes until BFATC physically receives the goods."
                          : "Waiting for Admin decision."
                      }
                      date={
                        delivery.received_at ||
                        delivery.processed_at ||
                        delivery.reviewed_at
                      }
                      formatDate={formatDateTime}
                      last
                    />
                  </div>
                </div>
              )}

              <div className="delivery-receipt-information">
                <div>
                  <span>Supplier</span>

                  <strong>
                    {delivery.vendor_name || "N/A"}
                  </strong>
                </div>

                <div>
                  <span>Contact Person</span>

                  <strong>
                    {delivery.contact_person ||
                      "N/A"}
                  </strong>
                </div>

                <div>
                  <span>Supplier Phone</span>

                  <strong>
                    {delivery.supplier_phone ||
                      delivery.contact_number ||
                      "N/A"}
                  </strong>
                </div>

                <div>
                  <span>Driver / Courier</span>

                  <strong>
                    {delivery.driver || "N/A"}
                  </strong>
                </div>

                <div>
                  <span>Status</span>

                  <strong>
                    {delivery.status || "N/A"}
                  </strong>
                </div>

                {String(
                  delivery.submission_source || ""
                ).toLowerCase() === "supplier" ? (
                  <div>
                    <span>Submitted By</span>

                    <strong>
                      {delivery.submitted_by_name ||
                        "Supplier User"}
                    </strong>
                  </div>
                ) : (
                  <div>
                    <span>Received By</span>

                    <strong>
                      {delivery.received_by_name ||
                        delivery.legacy_received_by ||
                        delivery.received_by ||
                        "N/A"}
                    </strong>
                  </div>
                )}

                <div>
                  <span>Noted By</span>

                  <strong>
                    {delivery.noted_by || "N/A"}
                  </strong>
                </div>

                {String(
                  delivery.submission_source || ""
                ).toLowerCase() === "supplier" && (
                  <>
                    <div>
                      <span>Approved By</span>

                      <strong>
                        {delivery.approved_by_name ||
                          delivery.reviewed_by_name ||
                          "Pending Review"}
                      </strong>
                    </div>

                    <div>
                      <span>Approved At</span>

                      <strong>
                        {delivery.approved_at ||
                        delivery.reviewed_at
                          ? formatDateTime(
                              delivery.approved_at ||
                                delivery.reviewed_at
                            )
                          : "Not approved yet"}
                      </strong>
                    </div>

                    <div>
                      <span>Received By</span>

                      <strong>
                        {delivery.received_by_name ||
                          delivery.legacy_received_by ||
                          delivery.received_by ||
                          (delivery.status === "Delivered"
                            ? "Not recorded"
                            : "Awaiting delivery")}
                      </strong>
                    </div>

                    <div>
                      <span>Received At</span>

                      <strong>
                        {delivery.received_at
                          ? formatDateTime(
                              delivery.received_at
                            )
                          : delivery.status === "Delivered" &&
                            delivery.processed_at
                          ? formatDateTime(
                              delivery.processed_at
                            )
                          : "Not received yet"}
                      </strong>
                    </div>
                  </>
                )}

                <div>
                  <span>Payment Status</span>

                  <strong>
                    {delivery.payment_status ||
                      "Not generated"}
                  </strong>
                </div>

                <div>
                  <span>Payment Due Date</span>

                  <strong>
                    {delivery.due_date
                      ? formatDate(
                          delivery.due_date
                        )
                      : "Not specified"}
                  </strong>
                </div>
              </div>

              {hasConsignment && (
                <section
                  className="no-print"
                  style={{
                    margin: "18px 0",
                    padding: 16,
                    border: "1px solid #f4b400",
                    borderRadius: 12,
                    background: "#fffdf5",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#f4b400",
                          color: "#1b2430",
                        }}
                      >
                        <Package size={18} />
                      </div>
                      <div>
                        <span
                          style={{
                            display: "block",
                            marginBottom: 2,
                            color: "#9a6d00",
                            fontSize: 9,
                            fontWeight: 900,
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                          }}
                        >
                          Special Delivery Type
                        </span>
                        <strong style={{ display: "block", color: "#1b2430", fontSize: 14 }}>
                          Consignment Delivery
                        </strong>
                        <small style={{ display: "block", marginTop: 3, color: "#64748b", fontSize: 10 }}>
                          This request contains {consignmentItems.length}{" "}
                          {consignmentItems.length === 1 ? "consignment product" : "consignment products"}.
                        </small>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "6px 11px",
                        borderRadius: 999,
                        background: "#f4b400",
                        color: "#1b2430",
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: "uppercase",
                      }}
                    >
                      Consignment
                    </span>
                  </div>
                </section>
              )}

              {proposalItems.length > 0 && (
                <section
                  className="no-print"
                  style={{
                    margin: "20px 0",
                    padding: 18,
                    border: "1px solid #f4b400",
                    borderRadius: 14,
                    background: "#fffdf5",
                  }}
                >
                  <div
                    style={{
                      marginBottom: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          display: "block",
                          marginBottom: 4,
                          color: "#9a6d00",
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        Admin Product Review
                      </span>

                      <h3
                        style={{
                          margin: 0,
                          color: "#1b2430",
                          fontSize: 16,
                        }}
                      >
                        New Product Proposal
                      </h3>

                      <p
                        style={{
                          margin: "5px 0 0",
                          color: "#64748b",
                          fontSize: 11,
                          lineHeight: 1.5,
                        }}
                      >
                        Review the Supplier's proposed product
                        information before approving this
                        delivery request. Approval does not add
                        stock yet; inventory is updated only
                        after physical receiving.
                      </p>
                    </div>

                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "#f4b400",
                        color: "#1b2430",
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      {proposalItems.length} NEW{" "}
                      {proposalItems.length === 1
                        ? "PRODUCT"
                        : "PRODUCTS"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 16,
                    }}
                  >
                    {proposalItems.map((item, index) => {
                      const imageUrl =
                        itemDisplayImage(item);

                      return (
                        <article
                          key={
                            item.delivery_item_id ||
                            `proposal-${index}`
                          }
                          style={{
                            padding: 16,
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                            background: "#ffffff",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "140px minmax(0, 1fr)",
                              gap: 18,
                              alignItems: "start",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  width: 140,
                                  height: 140,
                                  borderRadius: 10,
                                  border:
                                    "1px solid #e5e7eb",
                                  background: "#f8fafc",
                                  overflow: "hidden",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent:
                                    "center",
                                }}
                              >
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={itemDisplayName(
                                      item
                                    )}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                ) : (
                                  <Package
                                    size={42}
                                    color="#94a3b8"
                                  />
                                )}
                              </div>

                              <span
                                style={{
                                  display: "block",
                                  marginTop: 8,
                                  color: "#9a6d00",
                                  fontSize: 9,
                                  fontWeight: 900,
                                  textAlign: "center",
                                  textTransform:
                                    "uppercase",
                                }}
                              >
                                New Product Proposal
                              </span>
                            </div>

                            <div>
                              <h4
                                style={{
                                  margin: "0 0 4px",
                                  color: "#111827",
                                  fontSize: 17,
                                }}
                              >
                                {itemDisplayName(item)}
                              </h4>

                              <p
                                style={{
                                  margin: "0 0 14px",
                                  color: "#64748b",
                                  fontSize: 11,
                                  lineHeight: 1.55,
                                }}
                              >
                                {item.proposed_description ||
                                  item.description ||
                                  "No product description was provided."}
                              </p>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(135px, 1fr))",
                                  gap: 10,
                                }}
                              >
                                {[
                                  [
                                    "SKU",
                                    itemDisplaySku(item),
                                  ],
                                  [
                                    "Category",
                                    itemDisplayCategory(
                                      item
                                    ),
                                  ],
                                  [
                                    "Unit",
                                    itemDisplayUnit(item),
                                  ],
                                  [
                                    "Reorder Level",
                                    item.proposed_reorder_level ??
                                      item.reorder_level ??
                                      5,
                                  ],
                                  [
                                    "Proposed Quantity",
                                    item.quantity || 0,
                                  ],
                                  [
                                    "Supplier Price",
                                    formatPeso(
                                      item.supplier_price
                                    ),
                                  ],
                                  [
                                    "Suggested Retail",
                                    formatPeso(
                                      item.retail_price ||
                                        item.selling_price
                                    ),
                                  ],
                                  [
                                    "Expiry Date",
                                    item.expiry_date
                                      ? formatDate(
                                          item.expiry_date
                                        )
                                      : "No expiry",
                                  ],
                                ].map(
                                  ([label, value]) => (
                                    <div
                                      key={label}
                                      style={{
                                        padding: 10,
                                        borderRadius: 8,
                                        background:
                                          "#f8fafc",
                                        border:
                                          "1px solid #eef2f7",
                                      }}
                                    >
                                      <span
                                        style={{
                                          display:
                                            "block",
                                          marginBottom: 4,
                                          color:
                                            "#64748b",
                                          fontSize: 9,
                                          fontWeight:
                                            800,
                                          textTransform:
                                            "uppercase",
                                        }}
                                      >
                                        {label}
                                      </span>

                                      <strong
                                        style={{
                                          color:
                                            "#1b2430",
                                          fontSize: 11,
                                        }}
                                      >
                                        {value}
                                      </strong>
                                    </div>
                                  )
                                )}
                              </div>

                              {Number(
                                item.is_consignment || 0
                              ) === 1 && (
                                <div
                                  style={{
                                    marginTop: 12,
                                    padding: 12,
                                    borderRadius: 9,
                                    background:
                                      "#fff8dd",
                                    color: "#6b5200",
                                    fontSize: 10,
                                    lineHeight: 1.55,
                                  }}
                                >
                                  <strong>
                                    Consignment:
                                  </strong>{" "}
                                  {item.consignment_terms ||
                                    "Terms not specified."}
                                  <br />
                                  Start:{" "}
                                  {item.consignment_start_date
                                    ? formatDate(
                                        item.consignment_start_date
                                      )
                                    : "N/A"}
                                  {" • "}
                                  Pull-out:{" "}
                                  {item.consignment_pullout_date
                                    ? formatDate(
                                        item.consignment_pullout_date
                                      )
                                    : "N/A"}
                                  {item.consignment_notes
                                    ? ` • ${item.consignment_notes}`
                                    : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              <table className="delivery-receipt-table">
                <thead>
                  <tr>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Supplier Price</th>
                    <th>Retail Price</th>
                    <th>Payable</th>
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        No delivery item details
                        available.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={
                          item.delivery_item_id
                        }
                      >
                        <td>{item.quantity}</td>

                        <td>
                          {itemDisplayUnit(item)}
                        </td>

                        <td>
                          <strong>{itemDisplayName(item)}</strong>

                          {Number(item.is_new_product || 0) === 1 && (
                            <small
                              className="no-print"
                              style={{
                                display: "block",
                                marginTop: 4,
                                color: "#9a6d00",
                                fontSize: 8,
                                fontWeight: 900,
                              }}
                            >
                              NEW PRODUCT PROPOSAL
                            </small>
                          )}

                          {Number(item.is_consignment || 0) === 1 && (
                            <span
                              className="no-print"
                              style={{
                                width: "fit-content",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                marginTop: 5,
                                padding: "4px 7px",
                                borderRadius: 999,
                                background: "#fff3bf",
                                border: "1px solid #f4b400",
                                color: "#7a5900",
                                fontSize: 8,
                                fontWeight: 900,
                                textTransform: "uppercase",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <Package size={10} />
                              Consignment
                            </span>
                          )}
                        </td>

                        <td>
                          {itemDisplaySku(item)}
                        </td>

                        <td>
                          {formatPeso(
                            item.supplier_price
                          )}
                        </td>

                        <td>
                          {formatPeso(
                            item.retail_price ||
                              item.selling_price
                          )}
                        </td>

                        <td>
                          {formatPeso(
                            Number(
                              item.quantity || 0
                            ) *
                              Number(
                                item.supplier_price ||
                                  0
                              )
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {hasConsignment && (
                <section className="no-print" style={{ marginTop: 16 }}>
                  <div
                    style={{
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Package size={16} color="#9a6d00" />
                    <strong style={{ color: "#1b2430", fontSize: 13 }}>
                      Consignment Details
                    </strong>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {consignmentItems.map((item, index) => (
                      <article
                        key={item.delivery_item_id || `consignment-${index}`}
                        style={{
                          padding: 14,
                          border: "1px solid #f4b400",
                          borderRadius: 10,
                          background: "#fffdf5",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                            marginBottom: 12,
                          }}
                        >
                          <div>
                            <strong style={{ display: "block", color: "#111827", fontSize: 13 }}>
                              {itemDisplayName(item)}
                            </strong>
                            <span style={{ display: "block", marginTop: 2, color: "#64748b", fontSize: 9 }}>
                              SKU: {itemDisplaySku(item)}
                            </span>
                          </div>
                          <span
                            style={{
                              padding: "5px 9px",
                              borderRadius: 999,
                              background: "#f4b400",
                              color: "#1b2430",
                              fontSize: 8,
                              fontWeight: 900,
                              textTransform: "uppercase",
                            }}
                          >
                            Consignment
                          </span>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: 8,
                          }}
                        >
                          {[
                            [
                              "Start Date",
                              item.consignment_start_date
                                ? formatDate(item.consignment_start_date)
                                : "N/A",
                            ],
                            [
                              "Pull-out Date",
                              item.consignment_pullout_date
                                ? formatDate(item.consignment_pullout_date)
                                : "N/A",
                            ],
                            ["Quantity", `${item.quantity || 0} ${itemDisplayUnit(item)}`],
                            ["Supplier Price", formatPeso(item.supplier_price || 0)],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              style={{
                                padding: 9,
                                borderRadius: 8,
                                border: "1px solid #f1e3a5",
                                background: "#ffffff",
                              }}
                            >
                              <span
                                style={{
                                  display: "block",
                                  marginBottom: 3,
                                  color: "#64748b",
                                  fontSize: 8,
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                }}
                              >
                                {label}
                              </span>
                              <strong style={{ color: "#1b2430", fontSize: 10 }}>{value}</strong>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1e3a5" }}>
                          <span
                            style={{
                              display: "block",
                              marginBottom: 3,
                              color: "#64748b",
                              fontSize: 8,
                              fontWeight: 800,
                              textTransform: "uppercase",
                            }}
                          >
                            Terms
                          </span>
                          <p style={{ margin: 0, color: "#334155", fontSize: 10, lineHeight: 1.5 }}>
                            {item.consignment_terms || "No special terms specified."}
                          </p>

                          {item.consignment_notes && (
                            <>
                              <span
                                style={{
                                  display: "block",
                                  marginTop: 9,
                                  marginBottom: 3,
                                  color: "#64748b",
                                  fontSize: 8,
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                }}
                              >
                                Notes
                              </span>
                              <p style={{ margin: 0, color: "#334155", fontSize: 10, lineHeight: 1.5 }}>
                                {item.consignment_notes}
                              </p>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <div className="delivery-receipt-totals">
                <div>
                  <span>Total Units</span>

                  <strong>
                    {Number(
                      delivery.items_count || 0
                    )}
                  </strong>
                </div>

                <div>
                  <span>Supplier Payable</span>

                  <strong>
                    {formatPeso(
                      delivery.supplier_payable_amount ||
                        delivery.payable_amount ||
                        0
                    )}
                  </strong>
                </div>

                <div>
                  <span>Retail Value</span>

                  <strong>
                    {formatPeso(delivery.amount)}
                  </strong>
                </div>
              </div>

              <div className="delivery-receipt-remarks">
                <span>Remarks</span>

                <p>
                  {delivery.remarks ||
                    "No remarks."}
                </p>
              </div>

              <div className="delivery-receipt-signatures">
                <div>
                  <span>
                    {delivery.received_by || ""}
                  </span>

                  <strong>Received By</strong>
                </div>

                <div>
                  <span>
                    {delivery.noted_by || ""}
                  </span>

                  <strong>Noted By</strong>
                </div>

                <div>
                  <span>
                    {delivery.vendor_name || ""}
                  </span>

                  <strong>
                    Supplier Representative
                  </strong>
                </div>
              </div>
                </>
              )}
            </div>

            <div className="delivery-modal-footer no-print">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Close
              </button>

              {canResubmit && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onResubmit}
                >
                  <RefreshCw size={17} />
                  Correct & Resubmit
                </button>
              )}

              {canReview && (
                <>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={onReject}
                    disabled={reviewing}
                  >
                    <X size={17} />
                    Reject
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onApprove}
                    disabled={reviewing}
                  >
                    {reviewing ? (
                      <LoaderCircle
                        size={17}
                        className="delivery-spinner"
                      />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    Approve Delivery
                  </button>
                </>
              )}

              {canReceive && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onReceive}
                  disabled={receiving}
                >
                  {receiving ? (
                    <LoaderCircle
                      size={17}
                      className="delivery-spinner"
                    />
                  ) : (
                    <Truck size={17} />
                  )}
                  Receive Delivery
                </button>
              )}

              {canPublish && (
                <button
                  type="button"
                  className="btn delivery-publish-btn"
                  onClick={onPublish}
                >
                  <Send size={17} />
                  Set Price & Publish
                </button>
              )}

              {showOfficialReceipt && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onPrint}
                >
                  <Printer size={17} />
                  Print Delivery Receipt
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PublishDeliveryProductsModal({
  delivery,
  items,
  saving,
  onPriceChange,
  onSubmit,
  onClose,
}) {
  return (
    <div className="modal-overlay delivery-secondary-overlay">
      <div className="modal-box delivery-publish-modal">
        <div className="delivery-modal-header">
          <div>
            <div className="delivery-modal-title">
              <div>
                <Send size={21} />
              </div>

              <h2>Set Price & Publish</h2>
            </div>

            <p>
              Set BFATC's final selling price after physical receiving.
              Saving here makes eligible products available to the
              Landing Page and POS.
            </p>
          </div>

          <button
            type="button"
            className="delivery-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <div className="delivery-publish-body">
          <div className="delivery-publish-reference">
            <span>Received Delivery</span>
            <strong>
              {delivery.delivery_order_no ||
                `DEL-${String(
                  delivery.delivery_id || 0
                ).padStart(4, "0")}`}
            </strong>
          </div>

          <div className="delivery-publish-products">
            {items.map((item, index) => (
              <div
                key={
                  item.delivery_item_id ||
                  item.product_id ||
                  index
                }
                className="delivery-publish-product"
              >
                <div>
                  <strong>{item.product_name}</strong>
                  <span>{item.sku || "No SKU"}</span>
                </div>

                <label>
                  <span>
                    Final BFATC Selling Price
                    <strong> *</strong>
                  </span>

                  <div className="delivery-publish-price-input">
                    <span>₱</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        item.final_selling_price
                      }
                      onChange={(event) =>
                        onPriceChange(
                          index,
                          event.target.value
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>
                </label>
              </div>
            ))}
          </div>

          <div className="delivery-publish-note">
            <Package size={17} />
            <span>
              A product with a selling price of ₱0.00 remains hidden.
              It must also have available stock and a valid expiry date
              to appear on the Landing Page.
            </span>
          </div>
        </div>

        <div className="delivery-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn delivery-publish-btn"
            onClick={onSubmit}
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle
                size={17}
                className="delivery-spinner"
              />
            ) : (
              <Send size={17} />
            )}
            {saving
              ? "Publishing..."
              : "Publish to Landing Page"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkflowTimelineStep({
  done = false,
  active = false,
  error = false,
  title,
  detail,
  date,
  formatDate,
  last = false,
}) {
  const indicatorBackground = error
    ? "#dc2626"
    : done
    ? "#16a34a"
    : active
    ? "#f4b400"
    : "#cbd5e1";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr",
        gap: 12,
        minHeight: last ? "auto" : 72,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            position: "relative",
            zIndex: 2,
            width: 18,
            height: 18,
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: indicatorBackground,
            color: "#ffffff",
          }}
        >
          {error ? (
            <X size={11} />
          ) : done ? (
            <CheckCircle2 size={11} />
          ) : (
            <Clock3 size={10} />
          )}
        </span>

        {!last && (
          <span
            style={{
              position: "absolute",
              top: 18,
              bottom: -2,
              width: 2,
              background: done
                ? "#bbf7d0"
                : "#e2e8f0",
            }}
          />
        )}
      </div>

      <div
        style={{
          paddingBottom: last ? 0 : 18,
        }}
      >
        <strong
          style={{
            display: "block",
            color: error
              ? "#991b1b"
              : "#1b2430",
            fontSize: 12,
          }}
        >
          {title}
        </strong>

        <p
          style={{
            margin: "4px 0 0",
            color: error
              ? "#7f1d1d"
              : "#64748b",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {detail}
        </p>

        {date && (
          <small
            style={{
              display: "block",
              marginTop: 4,
              color: "#94a3b8",
              fontSize: 10,
            }}
          >
            {formatDate(date)}
          </small>
        )}
      </div>
    </div>
  );
}

function ConfirmationModal({
  data,
  saving,
  onConfirm,
  onClose,
}) {
  return (
    <div className="modal-overlay delivery-secondary-overlay">
      <div className="modal-box delivery-confirm-modal">
        <div
          className={`delivery-confirm-icon ${
            data.type === "danger"
              ? "danger"
              : ""
          }`}
        >
          {data.type === "danger" ? (
            <Archive size={28} />
          ) : (
            <CheckCircle2 size={28} />
          )}
        </div>

        <h2>{data.title}</h2>
        <p>{data.message}</p>

        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className={
              data.type === "danger"
                ? "btn btn-dark"
                : "btn btn-primary"
            }
            onClick={onConfirm}
            disabled={saving}
          >
            {saving && (
              <LoaderCircle
                className="delivery-spinner"
                size={17}
              />
            )}

            {saving
              ? "Processing..."
              : data.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoticeModal({ data, onClose }) {
  return (
    <div className="modal-overlay delivery-secondary-overlay">
      <div className="modal-box delivery-notice-modal">
        <div
          className={`delivery-notice-icon ${
            data.type === "error"
              ? "error"
              : ""
          }`}
        >
          {data.type === "error" ? (
            <X size={28} />
          ) : (
            <CheckCircle2 size={28} />
          )}
        </div>

        <h2>{data.title}</h2>
        <p>{data.message}</p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onClose}
        >
          Okay
        </button>
      </div>
    </div>
  );
}

export default DeliveryManagement;