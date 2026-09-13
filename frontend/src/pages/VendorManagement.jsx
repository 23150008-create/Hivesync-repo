import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  History,
  ImagePlus,
  LoaderCircle,
  Mail,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Phone,
  PhilippinePeso,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Printer,
  Send,
  CreditCard,
  Square,
  CheckSquare,
  Truck,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import "../styles/module.css";
import "../styles/vendor.css";
import bacnotanLogo from "../assets/Bacnotan Logo.png";
import API_BASE from "../config/api";

const getPhilippineDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const INITIAL_FORM = {
  vendor_name: "",
  contact_person: "",
  phone: "",
  address: "",
};

const INITIAL_REMITTANCE_FORM = {
  amount_to_pay: "",
  payment_method: "",
  reference_number: "",
  release_date: "",
  remarks: "",
};

const INITIAL_PAYMENT_FORM = {
  amount_paid: "",
  payment_date: getPhilippineDate(),
  payment_method: "",
  reference_number: "",
  received_by: "",
  remarks: "",
};

const INITIAL_PRODUCT_ACTION_FORM = {
  product_id: "",
  batch_id: "",
  action_type: "Pull-out",
  requested_quantity: "",
  reason: "",
  preferred_action_date: getPhilippineDate(),
  disposal_method: "",
  supplier_remarks: "",
};

const INITIAL_PRODUCT_ACTION_REVIEW = {
  review_action: "approve",
  approved_quantity: "",
  rejection_reason: "",
};

const INITIAL_SUPPLIER_PRODUCT_VARIANT = {
  variant_label: "Standard",
  supplier_price: "",
  reorder_level: "5",
  requested_sku: "",
};

const INITIAL_SUPPLIER_PRODUCT_FORM = {
  product_name: "",
  category_id: "",
  expiry_required: "1",
  product_description: "",
  supplier_remarks: "",
  product_image: null,
  variants: [
    { ...INITIAL_SUPPLIER_PRODUCT_VARIANT },
  ],
};

const EMPTY_SUMMARY = {
  product_count: 0,
  delivery_count: 0,
  pending_deliveries: 0,
  in_transit_deliveries: 0,
  delivered_deliveries: 0,
  total_delivered_quantity: 0,
  total_delivery_value: 0,
  total_payable: 0,
  total_paid: 0,
  outstanding_balance: 0,
  ready_for_payment: 0,
  overdue_payments: 0,
  consignment_count: 0,
  last_delivery_date: null,
};


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


const displayStatus = (status) =>
  String(status || "") === "Rejected"
    ? "Declined"
    : status;

function VendorManagement({
  user,
  focusProductRequestId = null,
  focusProductActionRequestId = null,
  focusVendorId = null,
}) {
  const role = user?.role || "Staff";

  const isSupplier =
    role === "Supplier" || role === "Vendor";

  const canManageSuppliers =
    role === "Admin" ||
    role === "Staff";

  const supplierVendorId =
    user?.vendor_id ||
    user?.supplier_id ||
    "";


  const registeredUserName =
    user?.full_name ||
    user?.name ||
    user?.user_name ||
    user?.username ||
    "System User";

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const remittanceSubmitLockRef = useRef(false);

  const supplierPaymentSubmitLockRef = useRef(false);
  const vendorListRequestRef = useRef(null);
  const supplierProfileRequestRef = useRef(null);
  const supplierProfileSequenceRef = useRef(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [recordView, setRecordView] = useState("active");
  const SUPPLIER_PAGE_SIZE = 15;
  const [supplierPage, setSupplierPage] = useState(1);

  const [
    handledFocusedProductRequestId,
    setHandledFocusedProductRequestId,
  ] = useState(null);

  const [
    handledFocusedProductActionRequestId,
    setHandledFocusedProductActionRequestId,
  ] = useState(null);

  const [showSupplierModal, setShowSupplierModal] =
    useState(false);

  const [showProfileModal, setShowProfileModal] =
    useState(false);

  const [showConfirmModal, setShowConfirmModal] =
    useState(false);

  const [formMode, setFormMode] = useState("add");
  const [supplierForm, setSupplierForm] =
    useState(INITIAL_FORM);

  const [selectedVendor, setSelectedVendor] =
    useState(null);

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [supplierProfile, setSupplierProfile] =
    useState(null);

  const [supplierSummary, setSupplierSummary] =
    useState(EMPTY_SUMMARY);

  const [supplierProducts, setSupplierProducts] =
    useState([]);

  const [supplierDeliveries, setSupplierDeliveries] =
    useState([]);

  const [supplierPayables, setSupplierPayables] =
    useState([]);

  const [supplierPayments, setSupplierPayments] =
    useState([]);

  const [supplierRemittances, setSupplierRemittances] =
    useState([]);

  const [supplierConsignments, setSupplierConsignments] =
    useState([]);

  const [activeProfileTab, setActiveProfileTab] =
    useState("overview");

  const [confirmation, setConfirmation] = useState({
    title: "",
    message: "",
    confirmText: "",
    action: "",
    vendor: null,
  });

  const [notice, setNotice] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const [showRemittanceModal, setShowRemittanceModal] =
    useState(false);

  const [showPaymentModal, setShowPaymentModal] =
    useState(false);

  const [showReceiptModal, setShowReceiptModal] =
    useState(false);

  const [selectedPayableIds, setSelectedPayableIds] =
    useState([]);

  const [selectedRemittance, setSelectedRemittance] =
    useState(null);

  const [selectedPayable, setSelectedPayable] =
    useState(null);

  const [receiptData, setReceiptData] =
    useState(null);

  const [remittanceForm, setRemittanceForm] =
    useState(INITIAL_REMITTANCE_FORM);

  const [paymentForm, setPaymentForm] =
    useState(INITIAL_PAYMENT_FORM);

  const [productActionRequests, setProductActionRequests] =
    useState([]);

  const [productActionSummary, setProductActionSummary] =
    useState({});

  const [productActionOptions, setProductActionOptions] =
    useState([]);

  const [showProductActionModal, setShowProductActionModal] =
    useState(false);

  const [showProductActionReviewModal, setShowProductActionReviewModal] =
    useState(false);

  const [showProductActionReceiptModal, setShowProductActionReceiptModal] =
    useState(false);

  const [showProductActionCompleteModal, setShowProductActionCompleteModal] =
    useState(false);

  const [productActionToComplete, setProductActionToComplete] =
    useState(null);

  const [selectedProductAction, setSelectedProductAction] =
    useState(null);

  const [productActionReceipt, setProductActionReceipt] =
    useState(null);

  const [productActionForm, setProductActionForm] =
    useState(INITIAL_PRODUCT_ACTION_FORM);

  const [productActionReview, setProductActionReview] =
    useState(INITIAL_PRODUCT_ACTION_REVIEW);

  const [supplierProductCategories, setSupplierProductCategories] =
    useState([]);

  const [supplierProductRequests, setSupplierProductRequests] =
    useState([]);

  const [supplierProductRequestSummary, setSupplierProductRequestSummary] =
    useState({
      total_requests: 0,
      pending_requests: 0,
      approved_requests: 0,
      rejected_requests: 0,
      cancelled_requests: 0,
    });

  const [showSupplierProductRequestModal, setShowSupplierProductRequestModal] =
    useState(false);

  const [supplierProductRequestMode, setSupplierProductRequestMode] =
    useState("new_product");

  const [supplierVariantFamily, setSupplierVariantFamily] =
    useState(null);

  const [supplierVariantProductId, setSupplierVariantProductId] =
    useState("");

  const [supplierProductForm, setSupplierProductForm] =
    useState(INITIAL_SUPPLIER_PRODUCT_FORM);

  const [supplierProductImagePreview, setSupplierProductImagePreview] =
    useState("");

  const [showSupplierProductReviewModal, setShowSupplierProductReviewModal] =
    useState(false);

  const [selectedSupplierProductRequest, setSelectedSupplierProductRequest] =
    useState(null);

  const [supplierProductReviewForm, setSupplierProductReviewForm] =
    useState({
      rejection_reason: "",
      approved_variant_ids: [],
    });

  const formatSupplierId = (vendorId) =>
    `SUP-${String(vendorId || 0).padStart(4, "0")}`;

  const formatProductId = (productId) =>
    `INV-${String(productId || 0).padStart(4, "0")}`;

  const formatPeso = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (value) => {
    if (!value) {
      return "No record";
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

  const formatDateTime = (value) => {
    if (!value) {
      return "N/A";
    }

    const date = new Date(
      String(value).replace(" ", "T")
    );

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resolveSupplierProductImage = (value) => {
    const image = String(value || "").trim();

    if (!image) {
      return "";
    }

    if (
      image.startsWith("http://") ||
      image.startsWith("https://") ||
      image.startsWith("blob:") ||
      image.startsWith("data:")
    ) {
      return image;
    }

    const normalized = image
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

    if (normalized.startsWith("HiveSync/backend/")) {
      return `${API_BASE}/${normalized.slice("HiveSync/backend/".length)}`;
    }

    if (normalized.startsWith("backend/")) {
      return `${API_BASE}/${normalized.slice("backend/".length)}`;
    }

    if (!normalized.includes("/")) {
      return `${API_BASE}/uploads/products/${encodeURIComponent(
        normalized
      )}`;
    }

    if (normalized.startsWith("uploads/products/")) {
      return `${API_BASE}/${normalized}`;
    }

    return `${API_BASE}/${normalized}`;
  };

  const parseJsonResponse = async (response) => {
    const responseText = await response.text();

    try {
      return JSON.parse(responseText);
    } catch {
      console.error(
        "Invalid server response:",
        responseText
      );

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

  const digitsOnly = (value) =>
    String(value || "")
      .replace(/\D/g, "")
      .slice(0, 11);

  const isValidPhone = (value) => {
    if (!value) {
      return true;
    }

    return /^09\d{9}$/.test(value);
  };

  const logAudit = async (action, details) => {
    try {
      await fetch(
        `${API_BASE}/audit_trail/log_action.php`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user?.user_id || 1,
            user_name:
              user?.full_name || "Unknown User",
            module: "Supplier Management",
            action,
            details,
          }),
        }
      );
    } catch (error) {
      console.error("Audit Trail error:", error);
    }
  };

  const resetProfileData = () => {
    setSupplierProfile(null);
    setSupplierSummary(EMPTY_SUMMARY);
    setSupplierProducts([]);
    setSupplierDeliveries([]);
    setSupplierPayables([]);
    setSupplierPayments([]);
    setSupplierRemittances([]);
    setSupplierConsignments([]);
    setProductActionRequests([]);
    setProductActionSummary({});
    setProductActionOptions([]);
    setSupplierProductRequests([]);
    setSupplierProductRequestSummary({
      total_requests: 0,
      pending_requests: 0,
      approved_requests: 0,
      rejected_requests: 0,
      cancelled_requests: 0,
    });
  };


  const loadSupplierProductCategories = async () => {
    const response = await fetch(
      `${API_BASE}/supplier_product_management/get_categories.php?time=${Date.now()}`,
      { credentials: "include",
          cache: "no-store" }
    );

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
          "Unable to retrieve product categories."
      );
    }

    const categories = Array.isArray(data.categories)
      ? data.categories
      : [];

    setSupplierProductCategories(categories);
    return categories;
  };

  const fetchSupplierProductRequests =
    async (vendorId) => {
      if (!vendorId) {
        return {
          requests: [],
          summary: {},
        };
      }

      const response = await fetch(
        `${API_BASE}/supplier_product_management/get_product_requests.php?vendor_id=${vendorId}&time=${Date.now()}`,
        { credentials: "include",
          cache: "no-store" }
      );

      const data =
        await parseJsonResponse(response);

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Unable to retrieve supplier product requests."
        );
      }

      return {
        requests: Array.isArray(
          data.requests
        )
          ? data.requests
          : [],
        summary: data.summary || {},
      };
    };

  const loadSupplierProductRequests = async (vendorId) => {
    if (!vendorId) {
      setSupplierProductRequests([]);
      return [];
    }

    try {
      const result =
        await fetchSupplierProductRequests(
          vendorId
        );

      setSupplierProductRequests(
        result.requests
      );

      setSupplierProductRequestSummary({
        total_requests: Number(
          result.summary?.total_requests ||
            0
        ),
        pending_requests: Number(
          result.summary?.pending_requests ||
            0
        ),
        approved_requests: Number(
          result.summary?.approved_requests ||
            0
        ),
        rejected_requests: Number(
          result.summary?.rejected_requests ||
            0
        ),
        cancelled_requests: Number(
          result.summary?.cancelled_requests ||
            0
        ),
      });

      return result.requests;
    } catch (error) {
      console.error(
        "Supplier product request retrieval error:",
        error
      );

      setSupplierProductRequests([]);

      return [];
    }
  };

  const openSupplierProductRequestModal = async () => {
    const vendorId =
      supplierProfile?.vendor_id ||
      supplierVendorId;

    if (!vendorId) {
      showNotice(
        "error",
        "Supplier Account Not Linked",
        "A supplier record is required before adding a product."
      );
      return;
    }

    try {
      setSaving(true);

      if (supplierProductCategories.length === 0) {
        await loadSupplierProductCategories();
      }

      setSupplierProductRequestMode("new_product");
      setSupplierVariantFamily(null);
      setSupplierProductForm(
        INITIAL_SUPPLIER_PRODUCT_FORM
      );
      setSupplierProductImagePreview("");
      setShowSupplierProductRequestModal(true);
    } catch (error) {
      showNotice(
        "error",
        "Unable to Open Product Form",
        error.message
      );
    } finally {
      setSaving(false);
    }
  };

  const openSupplierVariantRequestModal = async () => {
    const vendorId =
      supplierProfile?.vendor_id ||
      supplierVendorId;

    if (!vendorId) {
      showNotice(
        "error",
        "Supplier Account Not Linked",
        "A supplier record is required before adding a product variant."
      );
      return;
    }

    if (!Array.isArray(supplierProducts) || supplierProducts.length === 0) {
      showNotice(
        "error",
        "No Existing Products",
        "There are no approved supplier products available for a new size or variant."
      );
      return;
    }

    try {
      setSaving(true);

      if (supplierProductCategories.length === 0) {
        await loadSupplierProductCategories();
      }

      setSupplierProductRequestMode("add_variant");
      setSupplierVariantFamily(null);
      setSupplierVariantProductId("");
      setSupplierProductForm({
        ...INITIAL_SUPPLIER_PRODUCT_FORM,
        product_name: "",
        category_id: "",
        product_description: "",
        product_image: null,
        variants: [
          {
            ...INITIAL_SUPPLIER_PRODUCT_VARIANT,
            variant_label: "",
            supplier_price: "",
            reorder_level: "5",
            requested_sku: "",
          },
        ],
      });
      setSupplierProductImagePreview("");
      setShowSupplierProductRequestModal(true);
    } catch (error) {
      showNotice(
        "error",
        "Unable to Open Variant Form",
        error.message
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSupplierExistingProductChange = (event) => {
    const productId = String(
      event.target.value || ""
    );

    setSupplierVariantProductId(productId);

    const selectedProduct =
      supplierProducts.find(
        (product) =>
          String(product.product_id) ===
          productId
      ) || null;

    if (!selectedProduct) {
      setSupplierVariantFamily(null);
      setSupplierProductForm((current) => ({
        ...current,
        product_name: "",
        category_id: "",
        product_description: "",
      }));
      setSupplierProductImagePreview("");
      return;
    }

    setSupplierVariantFamily({
      product_id: Number(
        selectedProduct.product_id || 0
      ),
      family_id: Number(
        selectedProduct.family_id || 0
      ),
      product_name: String(
        selectedProduct.product_name || ""
      ),
      category_id: Number(
        selectedProduct.category_id || 0
      ),
      category_name:
        selectedProduct.category ||
        selectedProduct.category_name ||
        "",
      product_image:
        selectedProduct.product_image ||
        "",
    });

    setSupplierProductForm((current) => ({
      ...current,
      product_name: String(
        selectedProduct.product_name || ""
      ),
      category_id: String(
        selectedProduct.category_id || ""
      ),
      product_description: String(
        selectedProduct.product_description || ""
      ),
      variants: [
        {
          ...(current.variants?.[0] ||
            INITIAL_SUPPLIER_PRODUCT_VARIANT),
          reorder_level: String(
            selectedProduct.reorder_level ?? 5
          ),
        },
      ],
    }));

    setSupplierProductImagePreview(
      resolveSupplierProductImage(
        selectedProduct.product_image
      )
    );
  };

  const closeSupplierProductRequestModal = () => {
    if (saving) {
      return;
    }

    if (supplierProductImagePreview) {
      URL.revokeObjectURL(
        supplierProductImagePreview
      );
    }

    setShowSupplierProductRequestModal(false);
    setSupplierProductRequestMode("new_product");
    setSupplierVariantFamily(null);
    setSupplierVariantProductId("");
    setSupplierProductForm(
      INITIAL_SUPPLIER_PRODUCT_FORM
    );
    setSupplierProductImagePreview("");
  };

  const handleSupplierProductFormChange = (event) => {
    const { name, value, files } = event.target;

    if (name === "product_image") {
      const file = files?.[0] || null;

      if (supplierProductImagePreview) {
        URL.revokeObjectURL(
          supplierProductImagePreview
        );
      }

      setSupplierProductForm((current) => ({
        ...current,
        product_image: file,
      }));

      setSupplierProductImagePreview(
        file ? URL.createObjectURL(file) : ""
      );

      return;
    }

    setSupplierProductForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const addSupplierProductVariant = () => {
    setSupplierProductForm((current) => ({
      ...current,
      variants: [
        ...(Array.isArray(current.variants)
          ? current.variants
          : []),
        {
          ...INITIAL_SUPPLIER_PRODUCT_VARIANT,
          variant_label: "",
        },
      ],
    }));
  };

  const updateSupplierProductVariant = (
    index,
    field,
    value
  ) => {
    setSupplierProductForm((current) => ({
      ...current,
      variants: (current.variants || []).map(
        (variant, variantIndex) =>
          variantIndex === index
            ? {
                ...variant,
                [field]: value,
              }
            : variant
      ),
    }));
  };

  const removeSupplierProductVariant = (index) => {
    setSupplierProductForm((current) => {
      const variants = Array.isArray(
        current.variants
      )
        ? current.variants
        : [];

      if (variants.length <= 1) {
        showNotice(
          "error",
          "Variant Required",
          "A product proposal must contain at least one size or variant. Use Standard when the product has no size variation."
        );

        return current;
      }

      return {
        ...current,
        variants: variants.filter(
          (_, variantIndex) =>
            variantIndex !== index
        ),
      };
    });
  };

  const submitSupplierProductRequest = async (event) => {
    event.preventDefault();

    const vendorId =
      supplierProfile?.vendor_id ||
      supplierVendorId;

    if (!vendorId) {
      showNotice(
        "error",
        "Supplier Account Not Linked",
        "A supplier record is required before submitting a product."
      );
      return;
    }

    const productName =
      supplierProductForm.product_name.trim();

    const variants = (
      Array.isArray(
        supplierProductForm.variants
      )
        ? supplierProductForm.variants
        : []
    ).map((variant, index) => {
      const variantLabel = String(
        variant.variant_label || ""
      ).trim();

      const sizeMatch = variantLabel.match(
        /^\s*(\d+(?:\.\d+)?)\s*(ml|l|g|kg|oz|cm|mm|inch)\s*$/i
      );

      return {
        variant_label: variantLabel,
        variant_value: sizeMatch
          ? Number(sizeMatch[1])
          : null,
        variant_unit: sizeMatch
          ? sizeMatch[2].toLowerCase()
          : null,
        selling_unit: "pcs",
        supplier_price: Number(
          variant.supplier_price || 0
        ),
        reorder_level: Math.max(
          0,
          Number(
            variant.reorder_level || 0
          )
        ),
        requested_sku: String(
          variant.requested_sku || ""
        )
          .trim()
          .toUpperCase(),
        sort_order: index,
      };
    });

    if (!productName) {
      showNotice(
        "error",
        "Product Name Required",
        "Enter the name of the product."
      );
      return;
    }

    if (
      supplierProductRequestMode === "add_variant" &&
      !Number(supplierVariantProductId || 0)
    ) {
      showNotice(
        "error",
        "Existing Product Required",
        "Select the approved product that will receive the new size or variant."
      );
      return;
    }

    const selectedCategoryId = Number(
      supplierProductForm.category_id || 0
    );

    if (!selectedCategoryId) {
      showNotice(
        "error",
        "Category Required",
        "Select a product category."
      );
      return;
    }

    if (variants.length === 0) {
      showNotice(
        "error",
        "Variant Required",
        "Add at least one available size or variant."
      );
      return;
    }

    for (
      let index = 0;
      index < variants.length;
      index += 1
    ) {
      const variant = variants[index];

      if (!variant.variant_label) {
        showNotice(
          "error",
          "Variant Name Required",
          `Enter the size or variant for line ${
            index + 1
          }. Use Standard if the product has no size variation.`
        );
        return;
      }

      if (
        Number(
          variant.supplier_price || 0
        ) <= 0
      ) {
        showNotice(
          "error",
          "Invalid Supplier Price",
          `Supplier price for ${
            variant.variant_label
          } must be greater than zero.`
        );
        return;
      }
    }

    const normalizedLabels =
      variants.map((variant) =>
        variant.variant_label
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim()
      );

    if (
      new Set(normalizedLabels).size !==
      normalizedLabels.length
    ) {
      showNotice(
        "error",
        "Duplicate Variant",
        "Each size or variant must be unique within the product proposal."
      );
      return;
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const formData = new FormData();

      formData.append(
        "payload",
        JSON.stringify({
          vendor_id:
            Number(vendorId),
          transaction_source:
            isSupplier
              ? "Supplier Portal"
              : "Walk-in",
          request_type:
            supplierProductRequestMode,
          existing_product_id:
            supplierProductRequestMode === "add_variant"
              ? Number(
                  supplierVariantProductId || 0
                )
              : null,
          family_id:
            supplierProductRequestMode === "add_variant"
              ? Number(
                  supplierVariantFamily?.family_id || 0
                )
              : null,
          product_name:
            productName,
          category_id:
            selectedCategoryId,
          expiry_required:
            supplierProductForm.expiry_required,
          product_description:
            supplierProductForm.product_description.trim(),
          supplier_remarks:
            supplierProductForm.supplier_remarks.trim(),
          requested_by:
            user?.user_id || null,
          requested_by_name:
            user?.full_name ||
            supplierProfile?.contact_person ||
            "Supplier",
          variants,
        })
      );

      if (
        supplierProductForm.product_image
      ) {
        formData.append(
          "product_image",
          supplierProductForm.product_image
        );
      }

      const response = await fetch(
        `${API_BASE}/supplier_product_management/create_product_request.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          body: formData,
        }
      );

      const data =
        await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        console.error(
          "Product proposal submission failed:",
          data?.message ||
            "No backend message returned.",
          data
        );

        throw new Error(
          data.message ||
            "Unable to submit the product request."
        );
      }

      const submittedAsVariant =
        supplierProductRequestMode ===
        "add_variant";

      const isAdminAssistedEntry =
        role === "Admin" &&
        !isSupplier &&
        Boolean(data.request?.request_id);

      let approvalData = null;

      if (isAdminAssistedEntry) {
        const approvedVariantIds = Array.isArray(
          data.request?.variants
        )
          ? data.request.variants
              .map((variant) =>
                Number(
                  variant.request_variant_id || 0
                )
              )
              .filter(Boolean)
          : [];

        const approvalResponse = await fetch(
          `${API_BASE}/supplier_product_management/review_product_request.php`,
          {
            credentials: "include",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({
              request_id:
                Number(data.request.request_id),
              review_action: "approve",
              auto_approve: true,
              approved_variant_ids:
                approvedVariantIds,
              reviewed_by:
                user?.user_id || null,
              reviewed_by_name:
                user?.full_name ||
                user?.name ||
                "Admin",
            }),
          }
        );

        approvalData =
          await parseJsonResponse(
            approvalResponse
          );

        if (
          !approvalResponse.ok ||
          !approvalData.success
        ) {
          console.error(
            "Admin automatic product approval failed:",
            approvalData
          );

          throw new Error(
            `${
              data.request?.request_no ||
              "The new product"
            } was saved as a pending request, but automatic approval failed: ${
              approvalData.message ||
              "Unable to complete automatic approval."
            }`
          );
        }
      }

      closeSupplierProductRequestModal();

      await loadSupplierProfile(vendorId, false);

      setActiveProfileTab("products");

      if (isAdminAssistedEntry) {
        showNotice(
          "success",
          submittedAsVariant
            ? "Variant Added"
            : "New Product Added",
          submittedAsVariant
            ? `${
                approvalData?.request
                  ?.approved_variant_count ||
                variants.length
              } variant(s) for ${productName} were approved automatically because the entry was created by an Admin. The new inventory SKU(s) have zero stock until physically received through Delivery Management.`
            : `${productName} was approved automatically because it was added by an Admin. ${
                approvalData?.request
                  ?.approved_variant_count ||
                variants.length
              } zero-stock inventory SKU(s) were created and will remain Out of Stock until physically received through Delivery Management.`
        );

        return;
      }

      showNotice(
        "success",
        submittedAsVariant
          ? "Variant Request Submitted"
          : role === "Staff"
          ? "New Product Submitted for Approval"
          : "New Product Request Submitted",
        submittedAsVariant
          ? `${
              data.request?.request_no ||
              "The request"
            } was submitted to add ${
              variants
                .map(
                  (variant) =>
                    variant.variant_label
                )
                .join(", ")
            } to ${productName}. An Admin must approve the new variant before it becomes a zero-stock inventory SKU.`
          : `${
              data.request?.request_no ||
              "The request"
            } was submitted with ${
              data.request?.variant_count ||
              variants.length
            } available variant(s) for BFATC review. Stock remains zero until an approved variant is physically received through Delivery Management.`
      );
    } catch (error) {
      showNotice(
        "error",
        "Unable to Submit Product",
        error.message
      );
    } finally {
      setSaving(false);
    }
  };

  const openSupplierProductReview = (request) => {
    if (!canManageSuppliers || !request) {
      return;
    }

    const pendingVariantIds = (
      Array.isArray(request.variants)
        ? request.variants
        : []
    )
      .filter(
        (variant) =>
          (variant.status || "Pending") ===
          "Pending"
      )
      .map((variant) =>
        Number(
          variant.request_variant_id
        )
      )
      .filter(Boolean);

    setSelectedSupplierProductRequest(request);

    setSupplierProductReviewForm({
      rejection_reason: "",
      approved_variant_ids:
        pendingVariantIds,
    });

    setShowSupplierProductReviewModal(true);
  };

  const closeSupplierProductReview = () => {
    if (saving) {
      return;
    }

    setShowSupplierProductReviewModal(false);
    setSelectedSupplierProductRequest(null);
    setSupplierProductReviewForm({
      rejection_reason: "",
      approved_variant_ids: [],
    });
  };

  const updateSupplierProductReviewForm = (
    field,
    value
  ) => {
    setSupplierProductReviewForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  };

  const submitSupplierProductReview = async (
    reviewAction
  ) => {
    if (
      !canManageSuppliers ||
      !selectedSupplierProductRequest ||
      saving
    ) {
      return;
    }

    const action = String(
      reviewAction || ""
    ).toLowerCase();

    if (
      !["approve", "reject"].includes(action)
    ) {
      return;
    }

    const rejectionReason =
      supplierProductReviewForm.rejection_reason.trim();

    const approvedVariantIds =
      Array.isArray(
        supplierProductReviewForm.approved_variant_ids
      )
        ? supplierProductReviewForm.approved_variant_ids
            .map(Number)
            .filter(Boolean)
        : [];

    if (
      action === "reject" &&
      rejectionReason === ""
    ) {
      showNotice(
        "error",
        "Decline Reason Required",
        "Enter the reason for declining this supplier product proposal."
      );
      return;
    }

    if (
      action === "approve" &&
      approvedVariantIds.length === 0
    ) {
      showNotice(
        "error",
        "Select a Variant",
        "Select at least one size or variant that BFATC wants to approve."
      );
      return;
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_BASE}/supplier_product_management/review_product_request.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            request_id:
              selectedSupplierProductRequest.request_id,
            review_action: action,
            rejection_reason:
              action === "reject"
                ? rejectionReason
                : "",
            approved_variant_ids:
              action === "approve"
                ? approvedVariantIds
                : [],
            reviewed_by:
              user?.user_id || null,
            reviewed_by_name:
              user?.full_name ||
              user?.name ||
              "System User",
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
            `Unable to ${action} the product proposal.`
        );
      }

      const vendorId =
        Number(
          selectedSupplierProductRequest.vendor_id ||
            supplierProfile?.vendor_id ||
            0
        );

      closeSupplierProductReview();

      if (vendorId) {
        await Promise.all([
          loadSupplierProfile(vendorId, false),
          loadVendors(),
        ]);
      }

      setActiveProfileTab(
        "product_proposals"
      );

      showNotice(
        "success",
        action === "approve"
          ? "New Product Approved"
          : "New Product Declined",
        action === "approve"
          ? `${
              data.request?.product_name ||
              "The product"
            } was approved with ${
              Number(
                data.request?.approved_variant_count ||
                  approvedVariantIds.length
              )
            } selected variant(s). The supplier can now include the approved sizes in a delivery request.${
              data.email_sent
                ? " The supplier was notified by email."
                : ""
            }`
          : `${
              data.request?.product_name ||
              "The product"
            } was declined.${
              data.email_sent
                ? " The supplier was notified by email."
                : ""
            }`
      );
    } catch (error) {
      showNotice(
        "error",
        action === "approve"
          ? "Unable to Approve Product"
          : "Unable to Decline Product",
        error.message
      );
    } finally {
      setSaving(false);
    }
  };

  const openProductActionModal = async (actionType = "Pull-out") => {
    const vendorId = supplierProfile?.vendor_id || supplierVendorId;

    if (!vendorId) {
      showNotice(
        "error",
        "Supplier Account Not Linked",
        "A supplier record is required before submitting a product action request."
      );
      return;
    }

    try {
      setSaving(true);
      const options = await loadProductActionOptions(vendorId);

      if (options.length === 0) {
        showNotice(
          "error",
          "No Available Product Batch",
          "There is no available batch quantity that can be requested for pull-out or disposal."
        );
        return;
      }

      setProductActionForm({
        ...INITIAL_PRODUCT_ACTION_FORM,
        action_type: actionType,
      });
      setShowProductActionModal(true);
    } catch (error) {
      showNotice(
        "error",
        "Unable to Load Products",
        error.message
      );
    } finally {
      setSaving(false);
    }
  };

  const closeProductActionModal = () => {
    if (saving) return;
    setShowProductActionModal(false);
    setProductActionForm(INITIAL_PRODUCT_ACTION_FORM);
  };

  const submitProductActionRequest = async (event) => {
    event.preventDefault();

    const vendorId = supplierProfile?.vendor_id || supplierVendorId;

    const selectedProduct = productActionOptions.find(
      (product) =>
        Number(product.product_id) ===
        Number(productActionForm.product_id)
    );

    const selectedBatch = selectedProduct?.batches?.find(
      (batch) =>
        Number(batch.batch_id) ===
        Number(productActionForm.batch_id)
    );

    const availableRequestQuantity =
      Number(selectedBatch?.available_quantity || 0);

    const requestedQuantity =
      Number(productActionForm.requested_quantity);

    if (!selectedBatch) {
      showNotice(
        "error",
        "Inventory Batch Required",
        "Select an inventory batch before submitting the request."
      );
      return;
    }

    if (
      !Number.isFinite(requestedQuantity) ||
      requestedQuantity <= 0
    ) {
      showNotice(
        "error",
        "Invalid Requested Quantity",
        "Requested quantity must be greater than zero."
      );
      return;
    }

    if (requestedQuantity > availableRequestQuantity) {
      showNotice(
        "error",
        "Requested Quantity Exceeds Stock",
        `Requested quantity cannot exceed the available batch quantity of ${availableRequestQuantity}.`
      );
      return;
    }

    const maximumActionDate =
      selectedBatch?.max_action_date ||
      selectedBatch?.expiry_date ||
      "";

    if (
      maximumActionDate &&
      productActionForm.preferred_action_date > maximumActionDate
    ) {
      showNotice(
        "error",
        "Invalid Action Date",
        `The preferred action date cannot be later than ${maximumActionDate}.`
      );
      return;
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_BASE}/product_action_management/create_product_action_request.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            vendor_id: vendorId,
            transaction_source:
              isSupplier
                ? "Supplier Portal"
                : "Walk-in",
            product_id: Number(productActionForm.product_id),
            batch_id: Number(productActionForm.batch_id),
            action_type: productActionForm.action_type,
            requested_quantity: Number(productActionForm.requested_quantity),
            reason: productActionForm.reason.trim(),
            preferred_action_date: productActionForm.preferred_action_date,
            disposal_method: productActionForm.disposal_method.trim(),
            supplier_remarks: productActionForm.supplier_remarks.trim(),
            requested_by: user?.user_id || null,
            requested_by_name: user?.full_name || supplierProfile?.contact_person || "Supplier",
          }),
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to submit the product action request.");
      }

      const isAdminAssistedAction =
        role === "Admin" &&
        !isSupplier &&
        Boolean(data.request_id);

      let completionData = null;

      if (isAdminAssistedAction) {
        const reviewResponse = await fetch(
          `${API_BASE}/product_action_management/review_product_action_request.php`,
          {
            credentials: "include",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({
              request_id: Number(data.request_id),
              review_action: "approve",
              approved_quantity: requestedQuantity,
              rejection_reason: "",
              reviewed_by: user?.user_id || null,
              reviewed_by_name:
                user?.full_name ||
                user?.name ||
                registeredUserName ||
                "Admin",
              auto_process: true,
            }),
          }
        );

        completionData =
          await parseJsonResponse(reviewResponse);

        if (
          !reviewResponse.ok ||
          !completionData.success ||
          completionData.status !== "Completed"
        ) {
          throw new Error(
            `${data.request_no || "The product action"} was recorded, but automatic processing failed: ${
              completionData.message ||
              "Unable to complete the product action."
            }`
          );
        }
      }

      setShowProductActionModal(false);
      setProductActionForm(INITIAL_PRODUCT_ACTION_FORM);

      await Promise.all([
        loadProductActions(vendorId),
        loadSupplierProductRequests(vendorId),
      ]);

      setActiveProfileTab("product_actions");

      if (isAdminAssistedAction) {
        try {
          const receiptData =
            await loadProductActionReceiptData(
              data.request_id,
              completionData
            );

          setProductActionReceipt(receiptData);
          setShowProductActionReceiptModal(true);
        } catch (receiptError) {
          console.error(
            "Unable to load completed product action receipt:",
            receiptError
          );
        }

        showNotice(
          "success",
          productActionForm.action_type === "Disposal"
            ? "Disposal Completed"
            : "Pull-out Completed",
          `${data.request_no} was processed immediately by Admin. ${
            completionData?.processed_quantity ??
            requestedQuantity
          } unit(s) were deducted from the selected batch.`
        );
      } else {
        showNotice(
          "success",
          "Request Submitted",
          `${data.request_no} was submitted and is awaiting Admin review.`
        );
      }
    } catch (error) {
      showNotice("error", "Unable to Submit Request", error.message);
    } finally {
      setSaving(false);
    }
  };

  const openProductActionReview = (request) => {
    if (role !== "Admin") return;

    setSelectedProductAction(request);
    setProductActionReview({
      review_action: "",
      approved_quantity:
        String(request.requested_quantity || ""),
      rejection_reason: "",
    });
    setShowProductActionReviewModal(true);
  };

  const closeProductActionReview = () => {
    if (saving) return;
    setShowProductActionReviewModal(false);
    setSelectedProductAction(null);
    setProductActionReview(INITIAL_PRODUCT_ACTION_REVIEW);
  };

  const submitProductActionReview = async (
    reviewAction,
    rejectionReason = ""
  ) => {
    if (
      role !== "Admin" ||
      !selectedProductAction ||
      saving
    ) {
      return;
    }

    const normalizedAction =
      String(reviewAction || "")
        .trim()
        .toLowerCase();

    if (
      !["approve", "reject"].includes(
        normalizedAction
      )
    ) {
      return;
    }

    const normalizedRejectionReason =
      String(rejectionReason || "").trim();

    if (
      normalizedAction === "reject" &&
      !normalizedRejectionReason
    ) {
      showNotice(
        "error",
        "Decline Reason Required",
        "Enter the reason for declining this request."
      );
      return;
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_BASE}/product_action_management/review_product_action_request.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            request_id:
              selectedProductAction.request_id,

            review_action:
              normalizedAction,

            approved_quantity:
              normalizedAction === "approve"
                ? Number(
                    selectedProductAction.requested_quantity ||
                      0
                  )
                : 0,

            rejection_reason:
              normalizedAction === "reject"
                ? normalizedRejectionReason
                : "",

            reviewed_by:
              user?.user_id || null,

            reviewed_by_name:
              user?.full_name ||
              "System User",
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
            "Unable to review the request."
        );
      }

      const vendorId =
        supplierProfile?.vendor_id ||
        selectedProductAction.vendor_id;

      const completedRequestId =
        selectedProductAction.request_id;

      closeProductActionReview();

      await loadSupplierProfile(vendorId, false);

      setActiveProfileTab(
        "product_actions"
      );

      if (
        normalizedAction === "approve" &&
        data.status === "Completed"
      ) {
        try {
          const receiptData =
            await loadProductActionReceiptData(
              completedRequestId,
              data
            );

          setProductActionReceipt(
            receiptData
          );

          setShowProductActionReceiptModal(
            true
          );
        } catch (receiptError) {
          showNotice(
            "success",
            "Pull-out Completed",
            `${data.request_no} was completed successfully, but the receipt could not be opened automatically. You can open it from Product Actions history.`
          );
        }

        return;
      }

      const communicationParts = [];

      if (data.notification_sent) {
        communicationParts.push(
          "HiveSync notification sent"
        );
      }

      if (data.email_sent) {
        communicationParts.push(
          "registered email sent"
        );
      }

      const communicationText =
        communicationParts.length > 0
          ? ` ${communicationParts.join(
              " and "
            )}.`
          : data.communication_error
          ? ` The decline was saved, but supplier communication reported: ${data.communication_error}`
          : "";

      showNotice(
        "success",
        "Request Declined",
        `${data.request_no} is now declined.${communicationText}`
      );
    } catch (error) {
      showNotice(
        "error",
        "Unable to Review Request",
        error.message
      );
    } finally {
      setSaving(false);
    }
  };

  const completeProductAction = (request) => {
    if (!canManageSuppliers || !request) {
      return;
    }

    setProductActionToComplete(request);
    setShowProductActionCompleteModal(true);
  };

  const closeProductActionCompleteModal = () => {
    if (saving) {
      return;
    }

    setShowProductActionCompleteModal(false);
    setProductActionToComplete(null);
  };

  const loadProductActionReceiptData = async (
    requestId,
    completionResult = null
  ) => {
    const response = await fetch(
      `${API_BASE}/product_action_management/get_product_action_receipt.php?request_id=${requestId}&time=${Date.now()}`,
      {
        credentials: "include",
          cache: "no-store",
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
          "Unable to retrieve the product action receipt."
      );
    }

    if (completionResult) {
      data.completion_delivery = {
        supplier_recipients:
          Number(
            completionResult.supplier_recipients ||
              0
          ),
        notification_sent:
          Boolean(
            completionResult.notification_sent
          ),
        notifications_sent:
          Number(
            completionResult.notifications_sent ||
              0
          ),
        email_sent:
          Boolean(
            completionResult.email_sent
          ),
        emails_sent:
          Number(
            completionResult.emails_sent ||
              0
          ),
        communication_error:
          completionResult.communication_error ||
          "",
      };
    }

    return data;
  };

  const confirmCompleteProductAction = async () => {
    const request =
      productActionToComplete;

    if (
      !request ||
      !canManageSuppliers ||
      saving
    ) {
      return;
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_BASE}/product_action_management/complete_product_action_request.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            request_id:
              request.request_id,
            completed_by:
              user?.user_id || null,
            completed_by_name:
              user?.full_name ||
              "System User",
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
            "Unable to complete the request."
        );
      }

      setShowProductActionCompleteModal(
        false
      );
      setProductActionToComplete(null);

      await loadSupplierProfile(
        request.vendor_id,
        false
      );

      setActiveProfileTab(
        "product_actions"
      );

      const receiptData =
        await loadProductActionReceiptData(
          request.request_id,
          data
        );

      setProductActionReceipt(
        receiptData
      );

      setShowProductActionReceiptModal(
        true
      );
    } catch (error) {
      showNotice(
        "error",
        "Unable to Complete Request",
        error?.message ||
          "The request could not be completed. No additional stock deduction was performed."
      );
    } finally {
      setSaving(false);
    }
  };

  const openProductActionReceipt = async (request) => {
    if (!request?.request_id) {
      return;
    }

    setSaving(true);

    try {
      const data =
        await loadProductActionReceiptData(
          request.request_id
        );

      setProductActionReceipt(data);
      setShowProductActionReceiptModal(true);
    } catch (error) {
      showNotice(
        "error",
        "Unable to Load Receipt",
        error?.message ||
          "Unable to retrieve the product action receipt."
      );
    } finally {
      setSaving(false);
    }
  };

  const closeProductActionReceipt = () => {
    setShowProductActionReceiptModal(false);
    setProductActionReceipt(null);
  };

  const loadVendors = async () => {
    if (isSupplier) {
      return [];
    }

    if (vendorListRequestRef.current) {
      vendorListRequestRef.current.abort();
    }

    const controller = new AbortController();
    vendorListRequestRef.current = controller;

    setLoading(true);

    try {
      const archivedQuery =
        recordView === "archived"
          ? "?archived=1"
          : "";

      const response = await fetch(
        `${API_BASE}/vendor_management/get_vendors.php${archivedQuery}`,
        {
          credentials: "include",
          signal: controller.signal,
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to retrieve suppliers."
        );
      }

      const vendorRecords =
        Array.isArray(data.vendors)
          ? data.vendors
          : [];

      setVendors(vendorRecords);

      return vendorRecords;
    } catch (error) {
      if (error?.name === "AbortError") {
        return [];
      }

      console.error(
        "Supplier retrieval error:",
        error
      );

      setVendors([]);

      showNotice(
        "error",
        "Unable to Load Suppliers",
        error.message ||
          "The supplier records could not be loaded."
      );

      return [];
    } finally {
      if (
        vendorListRequestRef.current === controller
      ) {
        vendorListRequestRef.current = null;
        setLoading(false);
      }
    }
  };

  const loadProductActions = async (vendorId) => {
    if (!vendorId) {
      setProductActionRequests([]);
      setProductActionSummary({});
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/product_action_management/get_product_action_requests.php?vendor_id=${vendorId}&time=${Date.now()}`,
        { credentials: "include",
          cache: "no-store" }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to retrieve product action requests."
        );
      }

      setProductActionRequests(data.requests || []);
      setProductActionSummary(data.summary || {});
    } catch (error) {
      console.error("Product action retrieval error:", error);
      setProductActionRequests([]);
      setProductActionSummary({});
    }
  };

  const loadProductActionOptions = async (vendorId) => {
    const response = await fetch(
      `${API_BASE}/product_action_management/get_supplier_action_options.php?vendor_id=${vendorId}&time=${Date.now()}`,
      { credentials: "include",
          cache: "no-store" }
    );

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
          "Unable to retrieve supplier products and batches."
      );
    }

    setProductActionOptions(data.products || []);
    return data.products || [];
  };

  const loadSupplierProfile = async (
    vendorId,
    openModal = true
  ) => {
    if (!vendorId) {
      showNotice(
        "error",
        "Supplier Account Not Linked",
        "This account has no supplier ID. Assign the supplier record to the user account in User Management."
      );

      return;
    }

    const requestSequence =
      supplierProfileSequenceRef.current + 1;

    supplierProfileSequenceRef.current =
      requestSequence;

    if (supplierProfileRequestRef.current) {
      supplierProfileRequestRef.current.abort();
    }

    const controller = new AbortController();
    supplierProfileRequestRef.current = controller;

    setProfileLoading(true);

    if (openModal) {
      setShowProfileModal(true);
    }

    try {
      const profilePromise = fetch(
        `${API_BASE}/vendor_management/get_vendor_details.php?vendor_id=${vendorId}&time=${Date.now()}`,
        {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        }
      ).then(async (response) => {
        const data = await parseJsonResponse(response);

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Unable to retrieve the supplier business profile."
          );
        }

        return data;
      });

      const actionsPromise = fetch(
        `${API_BASE}/product_action_management/get_product_action_requests.php?vendor_id=${vendorId}&time=${Date.now()}`,
        {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        }
      )
        .then(async (response) => {
          const data = await parseJsonResponse(response);

          if (!response.ok || !data.success) {
            throw new Error(
              data.message ||
                "Unable to retrieve product action requests."
            );
          }

          return data;
        })
        .catch((error) => {
          if (error?.name === "AbortError") {
            throw error;
          }

          console.error(
            "Product action retrieval error:",
            error
          );

          return {
            requests: [],
            summary: {},
          };
        });

      const productRequestsPromise =
        fetchSupplierProductRequests(vendorId)
          .catch((error) => {
            if (error?.name === "AbortError") {
              throw error;
            }

            console.error(
              "Supplier product request retrieval error:",
              error
            );

            return {
              requests: [],
              summary: {},
            };
          });

      const [
        data,
        actionData,
        productRequestData,
      ] = await Promise.all([
        profilePromise,
        actionsPromise,
        productRequestsPromise,
      ]);

      if (
        requestSequence !==
        supplierProfileSequenceRef.current
      ) {
        return;
      }

      setSupplierProfile(data.supplier || null);

      setSupplierSummary({
        ...EMPTY_SUMMARY,
        ...(data.summary || {}),
      });

      setSupplierProducts(data.products || []);
      setSupplierDeliveries(data.deliveries || []);
      setSupplierPayables(data.payables || []);
      setSupplierPayments(data.payments || []);
      setSupplierRemittances(
        data.remittances || []
      );
      setSupplierConsignments(
        data.consignments || []
      );

      setProductActionRequests(
        Array.isArray(actionData.requests)
          ? actionData.requests
          : []
      );
      setProductActionSummary(
        actionData.summary || {}
      );

      setSupplierProductRequests(
        Array.isArray(productRequestData.requests)
          ? productRequestData.requests
          : []
      );

      setSupplierProductRequestSummary({
        total_requests: Number(
          productRequestData.summary?.total_requests ||
            0
        ),
        pending_requests: Number(
          productRequestData.summary?.pending_requests ||
            0
        ),
        approved_requests: Number(
          productRequestData.summary?.approved_requests ||
            0
        ),
        rejected_requests: Number(
          productRequestData.summary?.rejected_requests ||
            0
        ),
        cancelled_requests: Number(
          productRequestData.summary?.cancelled_requests ||
            0
        ),
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      if (
        requestSequence !==
        supplierProfileSequenceRef.current
      ) {
        return;
      }

      console.error(
        "Supplier profile error:",
        error
      );

      resetProfileData();

      if (openModal) {
        setShowProfileModal(false);
      }

      showNotice(
        "error",
        "Unable to Load Supplier Profile",
        error.message ||
          "Supplier products, deliveries, payments, and business history could not be loaded."
      );
    } finally {
      if (
        supplierProfileRequestRef.current ===
        controller
      ) {
        supplierProfileRequestRef.current = null;
        setProfileLoading(false);
      }
    }
  };

  const openFocusedSupplierProductRequest =
    async (
      requestId,
      preferredVendorId = null
    ) => {
      if (
        !canManageSuppliers ||
        !requestId
      ) {
        return false;
      }

      const numericRequestId =
        Number(requestId);

      if (!numericRequestId) {
        return false;
      }

      setProfileLoading(true);

      try {
        let candidateVendors =
          vendors;

        if (
          !Array.isArray(
            candidateVendors
          ) ||
          candidateVendors.length === 0
        ) {
          candidateVendors =
            await loadVendors();
        }

        if (preferredVendorId) {
          const preferred = Number(
            preferredVendorId
          );

          candidateVendors = [
            ...candidateVendors.filter(
              (vendor) =>
                Number(
                  vendor.vendor_id
                ) === preferred
            ),
            ...candidateVendors.filter(
              (vendor) =>
                Number(
                  vendor.vendor_id
                ) !== preferred
            ),
          ];
        }

        let matchedVendor = null;
        let matchedRequest = null;
        let matchedRequests = [];
        let matchedSummary = {};

        for (
          const vendor of candidateVendors
        ) {
          const vendorId = Number(
            vendor.vendor_id || 0
          );

          if (!vendorId) {
            continue;
          }

          const result =
            await fetchSupplierProductRequests(
              vendorId
            );

          const request =
            result.requests.find(
              (item) =>
                Number(
                  item.request_id
                ) === numericRequestId
            );

          if (request) {
            matchedVendor = vendor;
            matchedRequest = request;
            matchedRequests =
              result.requests;
            matchedSummary =
              result.summary || {};
            break;
          }
        }

        if (
          !matchedVendor ||
          !matchedRequest
        ) {
          showNotice(
            "error",
            "New Product Request Not Found",
            "The notification is linked to a product proposal that could not be found. The request may have been removed or belongs to an unavailable supplier."
          );
          return false;
        }

        setSelectedVendor(
          matchedVendor
        );

        setActiveProfileTab(
          "product_proposals"
        );

        setShowProfileModal(true);

        await loadSupplierProfile(
          matchedVendor.vendor_id,
          false
        );

        setSupplierProductRequests(
          matchedRequests
        );

        setSupplierProductRequestSummary({
          total_requests: Number(
            matchedSummary
              ?.total_requests || 0
          ),
          pending_requests: Number(
            matchedSummary
              ?.pending_requests || 0
          ),
          approved_requests: Number(
            matchedSummary
              ?.approved_requests || 0
          ),
          rejected_requests: Number(
            matchedSummary
              ?.rejected_requests || 0
          ),
          cancelled_requests: Number(
            matchedSummary
              ?.cancelled_requests || 0
          ),
        });

        setActiveProfileTab(
          "product_proposals"
        );

        openSupplierProductReview(
          matchedRequest
        );

        return true;
      } catch (error) {
        console.error(
          "Direct product proposal navigation error:",
          error
        );

        showNotice(
          "error",
          "Unable to Open New Product Request",
          error.message ||
            "The linked supplier product proposal could not be opened."
        );

        return false;
      } finally {
        setProfileLoading(false);
      }
    };

  const openFocusedSupplierProductActionRequest =
    async (
      requestId,
      preferredVendorId = null
    ) => {
      if (
        !canManageSuppliers ||
        !requestId
      ) {
        return false;
      }

      const numericRequestId =
        Number(requestId);

      if (!numericRequestId) {
        return false;
      }

      setProfileLoading(true);

      try {
        let candidateVendors =
          vendors;

        if (
          !Array.isArray(candidateVendors) ||
          candidateVendors.length === 0
        ) {
          candidateVendors =
            await loadVendors();
        }

        if (preferredVendorId) {
          const preferred =
            Number(preferredVendorId);

          candidateVendors = [
            ...candidateVendors.filter(
              (vendor) =>
                Number(vendor.vendor_id) ===
                preferred
            ),
            ...candidateVendors.filter(
              (vendor) =>
                Number(vendor.vendor_id) !==
                preferred
            ),
          ];
        }

        let matchedVendor = null;
        let matchedRequest = null;
        let matchedRequests = [];
        let matchedSummary = {};

        for (const vendor of candidateVendors) {
          const vendorId =
            Number(vendor.vendor_id || 0);

          if (!vendorId) {
            continue;
          }

          const response = await fetch(
            `${API_BASE}/product_action_management/get_product_action_requests.php?vendor_id=${encodeURIComponent(
              vendorId
            )}`,
            {
              credentials: "include",
          cache: "no-store",
            }
          );

          const data =
            await parseJsonResponse(response);

          if (
            !response.ok ||
            !data?.success
          ) {
            continue;
          }

          const requests =
            Array.isArray(data.requests)
              ? data.requests
              : [];

          const request =
            requests.find(
              (item) =>
                Number(item.request_id) ===
                numericRequestId
            );

          if (request) {
            matchedVendor = vendor;
            matchedRequest = request;
            matchedRequests = requests;
            matchedSummary =
              data.summary || {};
            break;
          }
        }

        if (
          !matchedVendor ||
          !matchedRequest
        ) {
          showNotice(
            "error",
            "Product Action Request Not Found",
            "The linked pull-out or disposal request could not be found. It may have been removed or belongs to an unavailable supplier."
          );

          return false;
        }

        setSelectedVendor(
          matchedVendor
        );

        setShowProfileModal(true);

        await loadSupplierProfile(
          matchedVendor.vendor_id,
          false
        );

        setProductActionRequests(
          matchedRequests
        );

        setProductActionSummary({
          ...(matchedSummary || {}),
        });

        setActiveProfileTab(
          "product_actions"
        );

        if (
          String(
            matchedRequest.status || ""
          ).toLowerCase() === "pending"
        ) {
          openProductActionReview(
            matchedRequest
          );
        }

        return true;
      } catch (error) {
        console.error(
          "Direct product action navigation error:",
          error
        );

        showNotice(
          "error",
          "Unable to Open Product Action Request",
          error.message ||
            "The linked pull-out or disposal request could not be opened."
        );

        return false;
      } finally {
        setProfileLoading(false);
      }
    };

  useEffect(() => {
    if (
      isSupplier ||
      !canManageSuppliers ||
      !focusProductActionRequestId
    ) {
      return;
    }

    if (
      String(
        handledFocusedProductActionRequestId ||
          ""
      ) ===
      String(
        focusProductActionRequestId
      )
    ) {
      return;
    }

    setHandledFocusedProductActionRequestId(
      focusProductActionRequestId
    );

    openFocusedSupplierProductActionRequest(
      focusProductActionRequestId,
      focusVendorId
    );
  }, [
    focusProductActionRequestId,
    focusVendorId,
    isSupplier,
    canManageSuppliers,
  ]);

  useEffect(() => {
    if (
      isSupplier ||
      !canManageSuppliers ||
      !focusProductRequestId
    ) {
      return;
    }

    if (
      String(
        handledFocusedProductRequestId ||
          ""
      ) ===
      String(
        focusProductRequestId
      )
    ) {
      return;
    }

    setHandledFocusedProductRequestId(
      focusProductRequestId
    );

    openFocusedSupplierProductRequest(
      focusProductRequestId,
      focusVendorId
    );
  }, [
    focusProductRequestId,
    focusVendorId,
    isSupplier,
    canManageSuppliers,
  ]);

  useEffect(() => {
    if (isSupplier) {
      setLoading(false);

      loadSupplierProfile(
        supplierVendorId,
        false
      );

      return;
    }

    loadVendors();
  }, [
    isSupplier,
    supplierVendorId,
    recordView,
  ]);

  const filteredVendors = useMemo(() => {
    const keyword = searchTerm
      .trim()
      .toLowerCase();

    if (!keyword) {
      return vendors;
    }

    return vendors.filter((vendor) => {
      const values = [
        formatSupplierId(vendor.vendor_id),
        vendor.vendor_name,
        vendor.contact_person,
        vendor.phone,
        vendor.address,
        vendor.status,
      ];

      return values.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [vendors, searchTerm]);

  const paginatedVendors = useMemo(() => {
    const start =
      (supplierPage - 1) *
      SUPPLIER_PAGE_SIZE;

    return filteredVendors.slice(
      start,
      start + SUPPLIER_PAGE_SIZE
    );
  }, [
    filteredVendors,
    supplierPage,
  ]);

  useEffect(() => {
    setSupplierPage(1);
  }, [
    searchTerm,
    recordView,
  ]);


  const supplierListSummary = useMemo(() => {
    return vendors.reduce(
      (summary, vendor) => {
        summary.totalSuppliers += 1;

        summary.linkedProducts += Number(
          vendor.product_count || 0
        );

        summary.deliveryRecords += Number(
          vendor.delivery_count || 0
        );

        if (
          Number(vendor.product_count || 0) > 0
        ) {
          summary.suppliersWithProducts += 1;
        }

        return summary;
      },
      {
        totalSuppliers: 0,
        linkedProducts: 0,
        deliveryRecords: 0,
        suppliersWithProducts: 0,
      }
    );
  }, [vendors]);

  const openAddModal = () => {
    setFormMode("add");
    setSelectedVendor(null);
    setSupplierForm(INITIAL_FORM);
    setShowSupplierModal(true);
  };

  const openEditModal = (vendor) => {
    if (!canManageSuppliers) {
      return;
    }

    setFormMode("edit");
    setSelectedVendor(vendor);

    setSupplierForm({
      vendor_name: vendor.vendor_name || "",
      contact_person:
        vendor.contact_person || "",
      phone: digitsOnly(vendor.phone || ""),
      address: vendor.address || "",
    });

    setShowSupplierModal(true);
  };

  const closeSupplierModal = () => {
    if (saving) {
      return;
    }

    setShowSupplierModal(false);
    setFormMode("add");
    setSelectedVendor(null);
    setSupplierForm(INITIAL_FORM);
  };

  const openProfileModal = async (vendor) => {
    setSelectedVendor(vendor);
    setActiveProfileTab("overview");

    await loadSupplierProfile(
      vendor.vendor_id,
      true
    );
  };

  const closeProfileModal = () => {
    if (profileLoading) {
      return;
    }

    setShowProfileModal(false);
    setSelectedVendor(null);
    setActiveProfileTab("overview");
    resetProfileData();
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setSupplierForm((current) => ({
      ...current,
      [name]:
        name === "phone"
          ? digitsOnly(value)
          : value,
    }));
  };

  const validateSupplierForm = () => {
    if (!supplierForm.vendor_name.trim()) {
      showNotice(
        "error",
        "Supplier Name Required",
        "Enter the supplier or business name."
      );

      return false;
    }

    if (
      supplierForm.vendor_name.trim().length < 2
    ) {
      showNotice(
        "error",
        "Invalid Supplier Name",
        "Supplier name must contain at least two characters."
      );

      return false;
    }

    if (!isValidPhone(supplierForm.phone)) {
      showNotice(
        "error",
        "Invalid Phone Number",
        "Phone number must contain 11 digits and start with 09."
      );

      return false;
    }

    return true;
  };

  const submitSupplier = async (event) => {
    event.preventDefault();

    if (!canManageSuppliers) {
      showNotice(
        "error",
        "Permission Denied",
        "Admin and Staff can manage supplier records."
      );

      return;
    }

    if (!validateSupplierForm()) {
      return;
    }

    setSaving(true);

    try {
      const isEditing =
        formMode === "edit";

      const endpoint = isEditing
        ? `${API_BASE}/vendor_management/update_vendor.php`
        : `${API_BASE}/vendor_management/add_vendor.php`;

      const payload = {
        vendor_name:
          supplierForm.vendor_name.trim(),

        contact_person:
          supplierForm.contact_person.trim(),

        phone: supplierForm.phone.trim(),

        address:
          supplierForm.address.trim(),
      };

      if (isEditing) {
        payload.vendor_id =
          selectedVendor.vendor_id;
      }

      const csrfToken = await getCsrfToken();

      const response = await fetch(endpoint, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            (isEditing
              ? "Unable to update the supplier."
              : "Unable to add the supplier.")
        );
      }

      await logAudit(
        isEditing
          ? "Update Supplier"
          : "Add Supplier",

        isEditing
          ? `Updated supplier: ${payload.vendor_name}`
          : `Added supplier: ${payload.vendor_name}`
      );

      closeSupplierModal();
      await loadVendors();

      showNotice(
        "success",
        isEditing
          ? "Supplier Updated"
          : "Supplier Added",

        data.message ||
          (isEditing
            ? "The supplier record was updated successfully."
            : "The supplier is now available in Delivery Management.")
      );
    } catch (error) {
      console.error(
        "Supplier save error:",
        error
      );

      showNotice(
        "error",
        formMode === "edit"
          ? "Unable to Update Supplier"
          : "Unable to Add Supplier",

        error.message ||
          "The supplier record could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const requestSupplierStatus = (
    vendor,
    action
  ) => {
    const isArchive = action === "archive";

    setConfirmation({
      title: isArchive
        ? "Archive Supplier"
        : "Restore Supplier",

      message: isArchive
        ? `Archive ${vendor.vendor_name}? The supplier will no longer appear in new deliveries, but all products, delivery records, payables, payments, receipts, and audit history will remain preserved.`
        : `Restore ${vendor.vendor_name}? The supplier will become available again in Delivery Management.`,

      confirmText: isArchive
        ? "Archive Supplier"
        : "Restore Supplier",

      action,
      vendor,
    });

    setShowConfirmModal(true);
  };

  const closeConfirmation = () => {
    if (saving) {
      return;
    }

    setShowConfirmModal(false);

    setConfirmation({
      title: "",
      message: "",
      confirmText: "",
      action: "",
      vendor: null,
    });
  };

  const submitSupplierStatus = async () => {
    const vendor = confirmation.vendor;
    const action = confirmation.action;

    if (!vendor || !action) {
      return;
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE}/vendor_management/archive_vendor.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            vendor_id: vendor.vendor_id,
            action,
          }),
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to update the supplier status."
        );
      }

      await logAudit(
        action === "archive"
          ? "Archive Supplier"
          : "Restore Supplier",

        `${
          action === "archive"
            ? "Archived"
            : "Restored"
        } supplier: ${vendor.vendor_name}`
      );

      closeConfirmation();
      await loadVendors();

      showNotice(
        "success",
        action === "archive"
          ? "Supplier Archived"
          : "Supplier Restored",
        data.message
      );
    } catch (error) {
      console.error(
        "Supplier status error:",
        error
      );

      showNotice(
        "error",
        action === "archive"
          ? "Unable to Archive Supplier"
          : "Unable to Restore Supplier",

        error.message ||
          "The supplier status could not be updated."
      );
    } finally {
      setSaving(false);
    }
  };

  const eligiblePayables = useMemo(
    () =>
      supplierPayables.filter(
        (payable) =>
          Number(payable.balance_amount || 0) > 0 &&
          ![
            "For Remittance",
            "Paid",
          ].includes(payable.payment_status)
      ),
    [supplierPayables]
  );

  const openRemittanceModal = () => {
    if (!canManageSuppliers || !supplierProfile) {
      return;
    }

    if (eligiblePayables.length === 0) {
      showNotice(
        "error",
        "No Eligible Payables",
        "This supplier has no unpaid payable available for a new remittance order."
      );
      return;
    }

    setSelectedPayableIds(
      eligiblePayables.map((item) =>
        Number(item.payable_id)
      )
    );

    setRemittanceForm({
      ...INITIAL_REMITTANCE_FORM,
      release_date: getPhilippineDate(),
    });

    setShowRemittanceModal(true);
  };

  const closeRemittanceModal = (force = false) => {
    if (saving && !force) return;

    setShowRemittanceModal(false);
    setSelectedPayableIds([]);
    setRemittanceForm(INITIAL_REMITTANCE_FORM);
  };

  const togglePayableSelection = (payableId) => {
    const numericId = Number(payableId);

    setSelectedPayableIds((current) =>
      current.includes(numericId)
        ? current.filter((id) => id !== numericId)
        : [...current, numericId]
    );
  };

  const submitRemittanceOrder = async (event) => {
    event.preventDefault();

    if (remittanceSubmitLockRef.current) {
      return;
    }

    if (selectedPayableIds.length === 0) {
      showNotice(
        "error",
        "Select Payables",
        "Select at least one supplier payable."
      );
      return;
    }

    const selectedTotal = supplierPayables
      .filter((item) =>
        selectedPayableIds.includes(
          Number(item.payable_id)
        )
      )
      .reduce(
        (sum, item) =>
          sum + Number(item.balance_amount || 0),
        0
      );

    const amountToPay = Number(
      remittanceForm.amount_to_pay || 0
    );

    if (amountToPay <= 0) {
      showNotice(
        "error",
        "Enter Payment Amount",
        "Enter the amount BFATC will pay to the supplier now."
      );
      return;
    }

    if (amountToPay > selectedTotal) {
      showNotice(
        "error",
        "Payment Exceeds Balance",
        "The amount to pay cannot exceed the selected payable balance."
      );
      return;
    }

    if (!remittanceForm.payment_method) {
      showNotice(
        "error",
        "Payment Method Required",
        "Select the payment method before recording the supplier payment."
      );
      return;
    }

    remittanceSubmitLockRef.current = true;
    setSaving(true);

    const supplierPaymentRequestToken =
      crypto.randomUUID();

    try {
      const csrfToken = await getCsrfToken();

      const remittanceResponse = await fetch(
        `${API_BASE}/vendor_management/create_remittance_order.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            vendor_id: supplierProfile.vendor_id,
            payable_ids: selectedPayableIds,
            payment_method: remittanceForm.payment_method,
            reference_number: remittanceForm.reference_number.trim(),
            prepared_by: user?.full_name || "System User",
            approved_by_user_id: user?.user_id || null,
            approved_by: user?.full_name || "System User",
            release_date: remittanceForm.release_date,
            remarks: remittanceForm.remarks.trim(),
            silent: true,
          }),
        }
      );

      const remittanceData =
        await parseJsonResponse(remittanceResponse);

      if (!remittanceResponse.ok || !remittanceData.success) {
        throw new Error(
          remittanceData.message ||
            "Unable to create the remittance order."
        );
      }

      const paymentResponse = await fetch(
        `${API_BASE}/vendor_management/record_supplier_payment.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            remittance_order_id: remittanceData.remittance_order_id,
            request_token: supplierPaymentRequestToken,
            amount_paid: amountToPay,
            payment_date:
              remittanceForm.release_date ||
              getPhilippineDate(),
            payment_method: remittanceForm.payment_method,
            reference_number: remittanceForm.reference_number.trim(),
            received_by:
              supplierProfile?.contact_person ||
              supplierProfile?.vendor_name ||
              "",
            processed_by: user?.full_name || "System User",
            remarks: remittanceForm.remarks.trim(),
          }),
        }
      );

      const paymentData =
        await parseJsonResponse(paymentResponse);

      if (!paymentResponse.ok || !paymentData.success) {
        throw new Error(
          paymentData.message ||
            "The remittance was created, but the supplier payment could not be recorded."
        );
      }

      await logAudit(
        "Record Supplier Payment",
        `Recorded ${paymentData.payment_no} for ${supplierProfile.vendor_name}. Paid ${formatPeso(paymentData.amount_paid)} from ${formatPeso(remittanceData.total_amount)}. Remaining balance: ${formatPeso(paymentData.remaining_balance)}.`
      );

      const remainingBalance = Number(
        paymentData.remaining_balance || 0
      );

      const paymentStatus =
        remainingBalance <= 0
          ? "Paid"
          : "Partially Paid";

      let remittanceReceipt = null;
      let pngEmailResult = null;
      let pngEmailError = "";

      try {
        remittanceReceipt =
          await loadRemittanceReceiptData(
            remittanceData.remittance_order_id
          );

        pngEmailResult =
          await emailRemittanceReceiptPng({
            receipt: remittanceReceipt,
            paymentNo:
              paymentData.payment_no,
            amountPaid: Number(
              paymentData.amount_paid ||
                amountToPay
            ),
            remainingBalance,
            paymentStatus,
            preparedBy:
              user?.full_name ||
              user?.name ||
              "System User",
          });
      } catch (receiptEmailError) {
        console.error(
          "Supplier remittance receipt PNG email error:",
          receiptEmailError
        );

        pngEmailError =
          receiptEmailError?.message ||
          "Unknown receipt email error.";
      }

      closeRemittanceModal(true);

      await loadSupplierProfile(
        supplierProfile.vendor_id,
        false
      );

      setActiveProfileTab("payments");

      const receiptEmailMessage =
        pngEmailResult?.email_sent
          ? ` The actual Supplier Remittance Receipt PNG was sent to the supplier's registered email${
              pngEmailResult.email_recipient
                ? ` (${pngEmailResult.email_recipient})`
                : ""
            }.`
          : ` The payment was saved, but the remittance receipt PNG email could not be sent${
              pngEmailError
                ? `: ${pngEmailError}`
                : "."
            }`;

      showNotice(
        "success",
        "Supplier Payment Recorded",
        `${paymentData.payment_no} was recorded successfully. Paid now: ${formatPeso(paymentData.amount_paid)}. Remaining balance: ${formatPeso(paymentData.remaining_balance)}.${receiptEmailMessage}`
      );

      if (remittanceReceipt) {
        setReceiptData(remittanceReceipt);
        setShowReceiptModal(true);
      } else {
        await openRemittanceReceipt({
          remittance_order_id:
            remittanceData.remittance_order_id,
        });
      }
    } catch (error) {
      showNotice(
        "error",
        "Unable to Record Supplier Payment",
        error.message
      );
    } finally {
      remittanceSubmitLockRef.current = false;
      setSaving(false);
    }
  };

  const openPayablePaymentModal = (payable) => {
    if (!canManageSuppliers) return;

    const remainingBalance = Number(
      payable.balance_amount || 0
    );

    if (remainingBalance <= 0) {
      showNotice(
        "error",
        "Payable Already Settled",
        "This supplier payable has no remaining balance."
      );
      return;
    }

    setSelectedPayable({
      ...payable,
      remaining_balance: remainingBalance,
    });

    setPaymentForm({
      ...INITIAL_PAYMENT_FORM,
      amount_paid: remainingBalance.toFixed(2),
      payment_method: "Cash",
      reference_number: "",
      received_by:
        supplierProfile?.contact_person ||
        supplierProfile?.vendor_name ||
        "",
      remarks: "",
    });

    setShowPaymentModal(true);
  };

  const closeAnyPaymentModal = (force = false) => {
    if (saving && !force) return;

    setShowPaymentModal(false);
    setSelectedPayable(null);
    setSelectedRemittance(null);
    setPaymentForm(INITIAL_PAYMENT_FORM);
  };

  const createPayableReceiptPngBlob = async ({
    payable,
    amountPaid,
    remainingBalance,
    paymentStatus,
    preparedBy,
  }) => {
    const scale = 2;
    const width = 1120;
    const height = 760;

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Your browser could not create the receipt image."
      );
    }

    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const drawText = (
      value,
      x,
      y,
      {
        font = "14px Arial",
        color = "#111827",
        align = "left",
      } = {}
    ) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(value ?? ""), x, y);
    };

    const drawLine = (
      x1,
      y1,
      x2,
      y2,
      lineWidth = 1
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = lineWidth;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });

    try {
      const logo = await loadImage(
        bacnotanLogo
      );

      ctx.drawImage(
        logo,
        70,
        45,
        52,
        52
      );
    } catch (error) {
      console.warn(
        "Receipt logo could not be rendered:",
        error
      );
    }

    drawText(
      "BACNOTAN FARMERS AGRI-TOURISM CENTER",
      145,
      68,
      {
        font: "bold 18px Arial",
      }
    );

    drawText(
      "HiveSync Integrated Business and Operations Management System",
      145,
      88,
      {
        font: "10px Arial",
      }
    );

    const reference =
      payable.delivery_order_no ||
      `Payable ${payable.payable_id}`;

    drawText(
      "REFERENCE NO.",
      965,
      58,
      {
        font: "bold 8px Arial",
        align: "center",
      }
    );

    drawText(
      reference,
      965,
      78,
      {
        font: "bold 11px Arial",
        align: "center",
      }
    );

    drawLine(65, 115, 1055, 115);

    drawText(
      "SUPPLIER PAYABLE RECEIPT",
      width / 2,
      148,
      {
        font: "18px Arial",
        align: "center",
      }
    );

    const supplierName =
      supplierProfile?.vendor_name ||
      selectedVendor?.vendor_name ||
      "Not provided";

    const supplierId =
      supplierProfile?.vendor_id ||
      selectedVendor?.vendor_id ||
      payable.vendor_id ||
      "";

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
        x + 95,
        y,
        {
          font: "11px Arial",
        }
      );

      drawLine(
        x + 90,
        y + 4,
        lineEnd,
        y + 4
      );
    };

    field(
      "Supplier",
      supplierName,
      65,
      185,
      505
    );

    field(
      "Supplier ID",
      supplierId
        ? `SUP-${String(
            supplierId
          ).padStart(4, "0")}`
        : "N/A",
      590,
      185,
      1055
    );

    field(
      "Delivery Date",
      formatDate(
        payable.delivery_date
      ),
      65,
      215,
      505
    );

    field(
      "Payable Amount",
      formatPeso(
        payable.payable_amount || 0
      ),
      590,
      215,
      1055
    );

    field(
      "Paid Amount",
      formatPeso(amountPaid),
      65,
      245,
      505
    );

    field(
      "Due Date",
      payable.due_date
        ? formatDate(payable.due_date)
        : "Not specified",
      590,
      245,
      1055
    );

    const tableX = 65;
    const tableY = 275;
    const tableW = 990;
    const rowH = 34;
    const columns = [
      200,
      200,
      200,
      200,
      190,
    ];
    const headers = [
      "DELIVERY",
      "PAYABLE",
      "PAID",
      "BALANCE",
      "STATUS",
    ];

    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      tableX,
      tableY,
      tableW,
      rowH * 7
    );

    let columnX = tableX;

    columns.forEach(
      (columnWidth, index) => {
        if (index > 0) {
          drawLine(
            columnX,
            tableY,
            columnX,
            tableY + rowH * 6
          );
        }

        drawText(
          headers[index],
          columnX +
            columnWidth / 2,
          tableY + 22,
          {
            font: "bold 9px Arial",
            align: "center",
          }
        );

        columnX += columnWidth;
      }
    );

    for (let row = 1; row <= 6; row += 1) {
      drawLine(
        tableX,
        tableY + rowH * row,
        tableX + tableW,
        tableY + rowH * row
      );
    }

    const paidToDate =
      Math.max(
        0,
        Number(
          payable.payable_amount || 0
        ) -
          Number(
            remainingBalance || 0
          )
      );

    const rowValues = [
      reference,
      formatPeso(
        payable.payable_amount || 0
      ),
      formatPeso(paidToDate),
      formatPeso(remainingBalance),
      paymentStatus,
    ];

    columnX = tableX;

    columns.forEach(
      (columnWidth, index) => {
        drawText(
          rowValues[index],
          columnX +
            columnWidth / 2,
          tableY + rowH + 22,
          {
            font: "10px Arial",
            align: "center",
          }
        );

        columnX += columnWidth;
      }
    );

    drawText(
      "BALANCE",
      850,
      tableY + rowH * 6 + 23,
      {
        font: "bold 9px Arial",
      }
    );

    drawText(
      formatPeso(remainingBalance),
      1035,
      tableY + rowH * 6 + 23,
      {
        font: "bold 10px Arial",
        align: "right",
      }
    );

    const certificationY =
      tableY + rowH * 7 + 35;

    drawText(
      "Checked and certified that the above transaction has been recorded in HiveSync.",
      65,
      certificationY,
      {
        font: "9px Arial",
      }
    );

    drawText(
      "Received and acknowledged subject to the terms and records of BFATC.",
      590,
      certificationY,
      {
        font: "9px Arial",
      }
    );

    const signatureY =
      certificationY + 75;

    drawLine(
      150,
      signatureY,
      480,
      signatureY
    );

    drawLine(
      620,
      signatureY,
      970,
      signatureY
    );

    drawText(
      preparedBy || "",
      315,
      signatureY - 10,
      {
        font: "10px Arial",
        align: "center",
      }
    );

    drawText(
      "Prepared / Processed By",
      315,
      signatureY + 20,
      {
        font: "bold 9px Arial",
        align: "center",
      }
    );

    drawText(
      "Acknowledged By",
      795,
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
      signatureY + 55
    );

    drawText(
      "This transaction receipt was generated through HiveSync.",
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
                "The receipt PNG could not be generated."
              )
            );
          },
          "image/png",
          1
        );
      }
    );
  };

  const emailPayableReceiptPng = async ({
    payable,
    amountPaid,
    remainingBalance,
    paymentStatus,
    preparedBy,
  }) => {
    const vendorId =
      supplierProfile?.vendor_id ||
      selectedVendor?.vendor_id ||
      payable.vendor_id;

    if (!vendorId) {
      throw new Error(
        "The supplier record has no vendor ID."
      );
    }

    const referenceCode =
      payable.delivery_order_no ||
      `Payable-${payable.payable_id}`;

    const receiptBlob =
      await createPayableReceiptPngBlob({
        payable,
        amountPaid,
        remainingBalance,
        paymentStatus,
        preparedBy,
      });

    const formData = new FormData();

    formData.append(
      "vendor_id",
      String(vendorId)
    );

    formData.append(
      "reference_code",
      referenceCode
    );

    formData.append(
      "payment_status",
      paymentStatus
    );

    formData.append(
      "amount_paid",
      String(amountPaid)
    );

    formData.append(
      "remaining_balance",
      String(remainingBalance)
    );

    formData.append(
      "subject",
      `BFATC Supplier Payable Receipt - ${referenceCode}`
    );

    formData.append(
      "message",
      `BFATC recorded a supplier payment for ${referenceCode}. The official HiveSync Supplier Payable Receipt is attached as a PNG image.`
    );

    formData.append(
      "receipt_png",
      receiptBlob,
      `Supplier_Payable_Receipt_${String(
        referenceCode
      ).replace(
        /[^A-Za-z0-9._-]+/g,
        "_"
      )}.png`
    );

    const response = await fetch(
      `${API_BASE}/vendor_management/send_payable_receipt_email.php`,
      {
        credentials: "include",
          method: "POST",
        body: formData,
      }
    );

    const data =
      await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(
        data.email_error ||
          data.message ||
          "The receipt PNG could not be emailed."
      );
    }

    return data;
  };


  const loadRemittanceReceiptData = async (
    remittanceOrderId
  ) => {
    const response = await fetch(
      `${API_BASE}/vendor_management/get_remittance_receipt.php?remittance_order_id=${remittanceOrderId}&time=${Date.now()}`,
      {
        credentials: "include",
          cache: "no-store",
      }
    );

    const data =
      await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
          "Unable to retrieve the remittance receipt."
      );
    }

    return data;
  };

  const createRemittanceReceiptPngBlob = async ({
    receipt,
    paymentNo = "",
    amountPaid = 0,
    remainingBalance = 0,
    paymentStatus = "",
    preparedBy = "",
  }) => {
    const order = receipt?.order || {};
    const items = Array.isArray(receipt?.items)
      ? receipt.items
      : [];

    const scale = 2;
    const width = 1120;
    const visibleRows = Math.max(6, items.length);
    const rowHeight = 34;
    const height = 555 + visibleRows * rowHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Your browser could not create the remittance receipt image."
      );
    }

    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const drawText = (
      value,
      x,
      y,
      {
        font = "14px Arial",
        color = "#111827",
        align = "left",
      } = {}
    ) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(value ?? ""), x, y);
    };

    const drawLine = (
      x1,
      y1,
      x2,
      y2,
      lineWidth = 1
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = lineWidth;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });

    try {
      const logo = await loadImage(bacnotanLogo);
      ctx.drawImage(logo, 70, 45, 52, 52);
    } catch (error) {
      console.warn(
        "Remittance receipt logo could not be rendered:",
        error
      );
    }

    drawText(
      "BACNOTAN FARMERS AGRI-TOURISM CENTER",
      145,
      68,
      { font: "bold 18px Arial" }
    );

    drawText(
      "HiveSync Integrated Business and Operations Management System",
      145,
      88,
      { font: "10px Arial" }
    );

    const reference =
      order.remittance_order_no ||
      paymentNo ||
      `REM-${order.remittance_order_id || ""}`;

    drawText(
      "REFERENCE NO.",
      965,
      58,
      {
        font: "bold 8px Arial",
        align: "center",
      }
    );

    drawText(
      reference,
      965,
      78,
      {
        font: "bold 11px Arial",
        align: "center",
      }
    );

    drawLine(65, 115, 1055, 115);

    drawText(
      "SUPPLIER REMITTANCE RECEIPT",
      width / 2,
      148,
      {
        font: "18px Arial",
        align: "center",
      }
    );

    const supplierName =
      order.vendor_name ||
      supplierProfile?.vendor_name ||
      selectedVendor?.vendor_name ||
      "Not provided";

    const supplierId =
      order.vendor_id ||
      supplierProfile?.vendor_id ||
      selectedVendor?.vendor_id ||
      "";

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
        { font: "bold 9px Arial" }
      );

      drawText(
        value,
        x + 105,
        y,
        { font: "11px Arial" }
      );

      drawLine(
        x + 100,
        y + 4,
        lineEnd,
        y + 4
      );
    };

    field("Supplier", supplierName, 65, 185, 505);

    field(
      "Supplier ID",
      supplierId
        ? `SUP-${String(supplierId).padStart(4, "0")}`
        : "N/A",
      590,
      185,
      1055
    );

    field(
      "Payment No.",
      paymentNo || "N/A",
      65,
      215,
      505
    );

    field(
      "Total Remittance",
      formatPeso(order.total_amount || 0),
      590,
      215,
      1055
    );

    field(
      "Paid Now",
      formatPeso(amountPaid),
      65,
      245,
      505
    );

    field(
      "Balance",
      formatPeso(remainingBalance),
      590,
      245,
      1055
    );

    const tableX = 65;
    const tableY = 275;
    const tableWidth = 990;

    const columns = [
      210,
      155,
      155,
      155,
      155,
      160,
    ];

    const headers = [
      "DELIVERY",
      "PAYABLE",
      "PAID",
      "BALANCE",
      "STATUS",
      "DATE",
    ];

    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1;

    ctx.strokeRect(
      tableX,
      tableY,
      tableWidth,
      rowHeight * (visibleRows + 1)
    );

    let columnX = tableX;

    columns.forEach(
      (columnWidth, index) => {
        if (index > 0) {
          drawLine(
            columnX,
            tableY,
            columnX,
            tableY + rowHeight * (visibleRows + 1)
          );
        }

        drawText(
          headers[index],
          columnX + columnWidth / 2,
          tableY + 22,
          {
            font: "bold 9px Arial",
            align: "center",
          }
        );

        columnX += columnWidth;
      }
    );

    for (
      let row = 1;
      row <= visibleRows;
      row += 1
    ) {
      drawLine(
        tableX,
        tableY + rowHeight * row,
        tableX + tableWidth,
        tableY + rowHeight * row
      );
    }

    items
      .slice(0, visibleRows)
      .forEach((item, rowIndex) => {
        const rowValues = [
          item.delivery_order_no ||
            `Delivery ${item.delivery_id || ""}`,
          formatPeso(item.payable_amount || 0),
          formatPeso(item.paid_amount || 0),
          formatPeso(item.balance_amount || 0),
          item.payment_status || "",
          item.delivery_date
            ? formatDate(item.delivery_date)
            : "",
        ];

        let rowColumnX = tableX;

        columns.forEach(
          (columnWidth, columnIndex) => {
            drawText(
              rowValues[columnIndex],
              rowColumnX + columnWidth / 2,
              tableY +
                rowHeight * (rowIndex + 1) +
                22,
              {
                font: "10px Arial",
                align: "center",
              }
            );

            rowColumnX += columnWidth;
          }
        );
      });

    const footerY =
      tableY +
      rowHeight * (visibleRows + 1) +
      38;

    drawText(
      "PAYMENT STATUS",
      65,
      footerY,
      { font: "bold 9px Arial" }
    );

    drawText(
      paymentStatus ||
        order.status ||
        "Recorded",
      180,
      footerY,
      { font: "10px Arial" }
    );

    drawText(
      "REMAINING BALANCE",
      790,
      footerY,
      { font: "bold 9px Arial" }
    );

    drawText(
      formatPeso(remainingBalance),
      1055,
      footerY,
      {
        font: "bold 10px Arial",
        align: "right",
      }
    );

    const certificationY = footerY + 45;

    drawText(
      "Checked and certified that the above supplier remittance transaction has been recorded in HiveSync.",
      65,
      certificationY,
      { font: "9px Arial" }
    );

    drawText(
      "Received and acknowledged subject to the terms and records of BFATC.",
      590,
      certificationY,
      { font: "9px Arial" }
    );

    const signatureY = certificationY + 75;

    drawLine(150, signatureY, 480, signatureY);
    drawLine(620, signatureY, 970, signatureY);

    drawText(
      preparedBy || "",
      315,
      signatureY - 10,
      {
        font: "10px Arial",
        align: "center",
      }
    );

    drawText(
      "Prepared / Processed By",
      315,
      signatureY + 20,
      {
        font: "bold 9px Arial",
        align: "center",
      }
    );

    drawText(
      "Acknowledged By",
      795,
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
      signatureY + 55
    );

    drawText(
      "This transaction receipt was generated through HiveSync.",
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
                "The remittance receipt PNG could not be generated."
              )
            );
          },
          "image/png",
          1
        );
      }
    );
  };

  const emailRemittanceReceiptPng = async ({
    receipt,
    paymentNo,
    amountPaid,
    remainingBalance,
    paymentStatus,
    preparedBy,
  }) => {
    const order = receipt?.order || {};

    const vendorId =
      order.vendor_id ||
      supplierProfile?.vendor_id ||
      selectedVendor?.vendor_id;

    if (!vendorId) {
      throw new Error(
        "The supplier record has no vendor ID."
      );
    }

    const referenceCode =
      order.remittance_order_no ||
      paymentNo ||
      `REM-${order.remittance_order_id || ""}`;

    const receiptBlob =
      await createRemittanceReceiptPngBlob({
        receipt,
        paymentNo,
        amountPaid,
        remainingBalance,
        paymentStatus,
        preparedBy,
      });

    const formData = new FormData();

    formData.append("vendor_id", String(vendorId));
    formData.append("reference_code", referenceCode);
    formData.append("payment_status", paymentStatus);
    formData.append("amount_paid", String(amountPaid));
    formData.append(
      "remaining_balance",
      String(remainingBalance)
    );

    formData.append(
      "subject",
      `BFATC Supplier Remittance Receipt - ${referenceCode}`
    );

    formData.append(
      "message",
      `BFATC recorded supplier payment ${paymentNo || ""} for remittance ${referenceCode}. The official HiveSync Supplier Remittance Receipt is attached as a PNG image.`
    );

    formData.append(
      "receipt_png",
      receiptBlob,
      `Supplier_Remittance_Receipt_${String(
        referenceCode
      ).replace(
        /[^A-Za-z0-9._-]+/g,
        "_"
      )}.png`
    );

    const response = await fetch(
      `${API_BASE}/vendor_management/send_payable_receipt_email.php`,
      {
        credentials: "include",
          method: "POST",
        body: formData,
      }
    );

    const data =
      await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(
        data.email_error ||
          data.message ||
          "The remittance receipt PNG could not be emailed."
      );
    }

    return data;
  };

  const submitDirectPayablePayment = async (event) => {
    event.preventDefault();

    if (!selectedPayable || saving) return;

    const amountPaid = Number(
      paymentForm.amount_paid || 0
    );

    if (amountPaid <= 0) {
      showNotice(
        "error",
        "Invalid Payment Amount",
        "Enter a payment amount greater than zero."
      );
      return;
    }

    if (
      amountPaid >
      Number(selectedPayable.remaining_balance || 0)
    ) {
      showNotice(
        "error",
        "Payment Exceeds Balance",
        "The payment cannot be greater than the remaining supplier payable balance."
      );
      return;
    }

    const payableSnapshot = {
      ...selectedPayable,
    };

    const vendorIdSnapshot =
      supplierProfile?.vendor_id ||
      selectedVendor?.vendor_id ||
      selectedPayable.vendor_id ||
      null;

    const vendorNameSnapshot =
      supplierProfile?.vendor_name ||
      selectedVendor?.vendor_name ||
      "supplier";

    const preparedBySnapshot =
      user?.full_name ||
      user?.name ||
      "System User";

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE}/vendor_management/record_payable_payment.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            payable_id:
              payableSnapshot.payable_id,
            amount_paid: amountPaid,
            payment_date:
              paymentForm.payment_date,
            payment_method:
              paymentForm.payment_method,
            reference_number:
              paymentForm.reference_number.trim(),
            received_by:
              paymentForm.received_by.trim(),
            processed_by_user_id:
              user?.user_id || null,
            processed_by:
              user?.full_name || "System User",
            remarks:
              paymentForm.remarks.trim(),
          }),
        }
      );

      const data = await parseJsonResponse(
        response
      );

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to record the supplier payment."
        );
      }

      const remainingBalance = Number(
        data.remaining_balance ?? Math.max(
          0,
          Number(
            payableSnapshot.remaining_balance ||
              payableSnapshot.balance_amount ||
              0
          ) - amountPaid
        )
      );

      const paymentStatus =
        remainingBalance <= 0
          ? "Paid"
          : "Partially Paid";

      closeAnyPaymentModal(true);
      setActiveProfileTab("payments");

      showNotice(
        "success",
        "Supplier Payment Recorded",
        `${data.payment_no} was recorded successfully. Remaining payable balance: ${formatPeso(
          remainingBalance
        )}. The receipt email and supplier profile refresh are being processed separately.`
      );

      Promise.resolve()
        .then(() =>
          logAudit(
            "Record Supplier Payment",
            `Recorded ${data.payment_no} for ${vendorNameSnapshot} from payable ${
              payableSnapshot.delivery_order_no ||
              payableSnapshot.payable_id
            }, amount ${formatPeso(
              data.amount_paid ?? amountPaid
            )}.`
          )
        )
        .catch((auditError) => {
          console.error(
            "Supplier payment frontend audit error:",
            auditError
          );
        });

      window.setTimeout(() => {
        emailPayableReceiptPng({
          payable: payableSnapshot,
          amountPaid: Number(
            data.amount_paid ?? amountPaid
          ),
          remainingBalance,
          paymentStatus,
          preparedBy: preparedBySnapshot,
        })
          .then((emailResult) => {
            if (!emailResult?.email_sent) {
              console.warn(
                "Supplier Payable Receipt PNG email was not sent:",
                emailResult
              );
            }
          })
          .catch((emailError) => {
            console.error(
              "Supplier receipt PNG email error:",
              emailError
            );
          });
      }, 250);

      if (vendorIdSnapshot) {
        Promise.resolve()
          .then(() =>
            loadSupplierProfile(
              vendorIdSnapshot,
              false
            )
          )
          .catch((profileRefreshError) => {
            console.error(
              "Supplier profile refresh after payment error:",
              profileRefreshError
            );
          });
      }
    } catch (error) {
      showNotice(
        "error",
        "Unable to Record Payment",
        error.message
      );
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = (remittance) => {
    if (!canManageSuppliers) return;

    const totalAmount = Number(
      remittance.total_amount || 0
    );

    const paidForOrder = supplierPayments
      .filter(
        (payment) =>
          Number(payment.remittance_order_id) ===
          Number(remittance.remittance_order_id)
      )
      .reduce(
        (sum, payment) =>
          sum + Number(payment.amount_paid || 0),
        0
      );

    const remainingBalance = Math.max(
      0,
      totalAmount - paidForOrder
    );

    if (remainingBalance <= 0) {
      showNotice(
        "error",
        "Remittance Already Paid",
        "This remittance order has no remaining balance."
      );
      return;
    }

    setSelectedRemittance({
      ...remittance,
      remaining_balance: remainingBalance,
    });

    setPaymentForm({
      ...INITIAL_PAYMENT_FORM,
      amount_paid: remainingBalance.toFixed(2),
      payment_method:
        remittance.payment_method || "",
      reference_number:
        remittance.reference_number || "",
    });

    setShowPaymentModal(true);
  };

  const closePaymentModal = (force = false) => {
    closeAnyPaymentModal(force);
  };

  const submitSupplierPayment = async (event) => {
    event.preventDefault();

    if (!selectedRemittance) {
      showNotice(
        "error",
        "No Remittance Selected",
        "Select a remittance order before recording payment."
      );
      return;
    }

    const amountPaid = Number(
      paymentForm.amount_paid || 0
    );

    const currentBalance = Number(
      selectedRemittance.remaining_balance ||
        selectedRemittance.total_amount ||
        0
    );

    if (amountPaid <= 0) {
      showNotice(
        "error",
        "Invalid Payment Amount",
        "Enter a payment amount greater than zero."
      );
      return;
    }

    if (
      currentBalance > 0 &&
      amountPaid > currentBalance
    ) {
      showNotice(
        "error",
        "Payment Exceeds Balance",
        "The payment cannot be greater than the remaining remittance balance."
      );
      return;
    }

    if (!paymentForm.payment_method) {
      showNotice(
        "error",
        "Payment Method Required",
        "Select a payment method before recording the supplier payment."
      );
      return;
    }

    if (supplierPaymentSubmitLockRef.current) {
      return;
    }

    supplierPaymentSubmitLockRef.current = true;
    setSaving(true);

    const supplierPaymentRequestToken =
      crypto.randomUUID();

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE}/vendor_management/record_supplier_payment.php`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            remittance_order_id:
              selectedRemittance.remittance_order_id,
            request_token:
              supplierPaymentRequestToken,
            amount_paid: amountPaid,
            payment_date:
              paymentForm.payment_date,
            payment_method:
              paymentForm.payment_method,
            reference_number:
              paymentForm.reference_number.trim(),
            received_by:
              paymentForm.received_by.trim(),
            processed_by:
              user?.full_name || "System User",
            remarks:
              paymentForm.remarks.trim(),
          }),
        }
      );

      const data =
        await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to record the supplier payment."
        );
      }

      const remainingBalance = Number(
        data.remaining_balance ??
          Math.max(
            0,
            currentBalance - amountPaid
          )
      );

      const paymentStatus =
        remainingBalance <= 0
          ? "Paid"
          : "Partially Paid";

      await logAudit(
        "Record Supplier Payment",
        `Recorded ${data.payment_no} for ${
          supplierProfile?.vendor_name ||
          selectedVendor?.vendor_name ||
          "supplier"
        } amounting to ${formatPeso(
          data.amount_paid ?? amountPaid
        )}.`
      );

      let remittanceReceipt = null;
      let pngEmailResult = null;
      let pngEmailError = "";

      try {
        remittanceReceipt =
          await loadRemittanceReceiptData(
            selectedRemittance.remittance_order_id
          );

        pngEmailResult =
          await emailRemittanceReceiptPng({
            receipt: remittanceReceipt,
            paymentNo: data.payment_no,
            amountPaid: Number(
              data.amount_paid ?? amountPaid
            ),
            remainingBalance,
            paymentStatus,
            preparedBy:
              user?.full_name ||
              user?.name ||
              "System User",
          });
      } catch (receiptEmailError) {
        console.error(
          "Supplier remittance receipt PNG email error:",
          receiptEmailError
        );

        pngEmailError =
          receiptEmailError?.message ||
          "Unknown receipt email error.";
      }

      closePaymentModal(true);

      if (supplierProfile?.vendor_id) {
        await loadSupplierProfile(
          supplierProfile.vendor_id,
          false
        );
      }

      setActiveProfileTab("payments");

      const receiptEmailMessage =
        pngEmailResult?.email_sent
          ? ` The actual Supplier Remittance Receipt PNG was sent to the supplier's registered email${
              pngEmailResult.email_recipient
                ? ` (${pngEmailResult.email_recipient})`
                : ""
            }.`
          : ` The payment was saved, but the remittance receipt PNG email could not be sent${
              pngEmailError
                ? `: ${pngEmailError}`
                : "."
            }`;

      showNotice(
        "success",
        "Supplier Payment Recorded",
        `${data.payment_no} was recorded successfully. Paid: ${formatPeso(
          data.amount_paid ?? amountPaid
        )}. Remaining balance: ${formatPeso(
          remainingBalance
        )}.${receiptEmailMessage}`
      );

      if (remittanceReceipt) {
        setReceiptData(remittanceReceipt);
        setShowReceiptModal(true);
      } else {
        await openRemittanceReceipt({
          remittance_order_id:
            selectedRemittance.remittance_order_id,
        });
      }
    } catch (error) {
      console.error(
        "Supplier payment error:",
        error
      );

      showNotice(
        "error",
        "Unable to Record Payment",
        error.message
      );
    } finally {
      supplierPaymentSubmitLockRef.current = false;
      setSaving(false);
    }
  };

  const openRemittanceReceipt = async (remittance) => {
    try {
      setSaving(true);

      const response = await fetch(
        `${API_BASE}/vendor_management/get_remittance_receipt.php?remittance_order_id=${remittance.remittance_order_id}&time=${Date.now()}`
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to retrieve the remittance receipt."
        );
      }

      setReceiptData(data);
      setShowReceiptModal(true);
    } catch (error) {
      showNotice(
        "error",
        "Unable to Load Receipt",
        error.message
      );
    } finally {
      setSaving(false);
    }
  };

  const closeReceiptModal = () => {
    setShowReceiptModal(false);
    setReceiptData(null);
  };

  if (isSupplier) {
    return (
      <>
        <SupplierAccountDashboard
        loading={profileLoading}
        supplier={supplierProfile}
        summary={supplierSummary}
        products={supplierProducts}
        deliveries={supplierDeliveries}
        payables={supplierPayables}
        payments={supplierPayments}
        remittances={supplierRemittances}
        consignments={supplierConsignments}
        productActions={productActionRequests}
        productActionSummary={productActionSummary}
        productRequests={supplierProductRequests}
        productRequestSummary={supplierProductRequestSummary}
        activeTab={activeProfileTab}
        setActiveTab={setActiveProfileTab}
        formatSupplierId={formatSupplierId}
        formatProductId={formatProductId}
        formatPeso={formatPeso}
        formatDate={formatDate}
        formatDateTime={formatDateTime}
        processorName={registeredUserName}
        onRefresh={() =>
          loadSupplierProfile(
            supplierVendorId,
            false
          )
        }
        onAddProduct={openSupplierProductRequestModal}
        onAddVariant={openSupplierVariantRequestModal}
        onRequestPullout={() => openProductActionModal("Pull-out")}
        onRequestDisposal={() => openProductActionModal("Disposal")}
        onViewProductActionReceipt={openProductActionReceipt}
        notice={{
          ...notice,
          open: false,
        }}
        closeNotice={closeNotice}
      />

        {showSupplierProductRequestModal && (
          <SupplierProductRequestModal
            form={supplierProductForm}
            categories={supplierProductCategories}
            imagePreview={supplierProductImagePreview}
            saving={saving}
            mode={supplierProductRequestMode}
            existingFamily={supplierVariantFamily}
            existingProducts={supplierProducts}
            selectedExistingProductId={supplierVariantProductId}
            onExistingProductChange={handleSupplierExistingProductChange}
            onChange={handleSupplierProductFormChange}
            onAddVariant={addSupplierProductVariant}
            onUpdateVariant={updateSupplierProductVariant}
            onRemoveVariant={removeSupplierProductVariant}
            onSubmit={submitSupplierProductRequest}
            onClose={closeSupplierProductRequestModal}
          />
        )}

        {showProductActionModal && (
          <ProductActionRequestModal
            products={productActionOptions}
            form={productActionForm}
            setForm={setProductActionForm}
            saving={saving}
            isAdminAction={role === "Admin" && !isSupplier}
            onSubmit={submitProductActionRequest}
            onClose={closeProductActionModal}
          />
        )}

        {showProductActionReceiptModal &&
          productActionReceipt && (
            <ProductActionReceiptModal
              data={productActionReceipt}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              processorName={registeredUserName}
              onClose={closeProductActionReceipt}
            />
          )}

        {}
        {notice.open && (
          <NoticeModal
            data={notice}
            onClose={closeNotice}
          />
        )}
      </>
    );
  }

  return (
    <div className="page vendor-page">
      <div className="page-header supplier-page-header">
        <div>
          <h1>Supplier Management</h1>

          <span>
            Register suppliers once and automatically
            connect their products, deliveries,
            payables, payments, remittances, and
            consignment records.
          </span>
        </div>

        {canManageSuppliers &&
          recordView === "active" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openAddModal}
            >
              <Plus size={18} />
              Add Supplier
            </button>
          )}
      </div>

      <section className="module-stats supplier-stats">
        <SupplierStatCard
          icon={<Users size={20} />}
          label={
            recordView === "archived"
              ? "Archived Suppliers"
              : "Active Suppliers"
          }
          value={
            supplierListSummary.totalSuppliers
          }
        />

        <SupplierStatCard
          icon={<Package size={20} />}
          label="Linked Products"
          value={
            supplierListSummary.linkedProducts
          }
        />

        <SupplierStatCard
          icon={<Truck size={20} />}
          label="Delivery Records"
          value={
            supplierListSummary.deliveryRecords
          }
        />

        <SupplierStatCard
          icon={<Building2 size={20} />}
          label="Suppliers With Products"
          value={
            supplierListSummary.suppliersWithProducts
          }
        />
      </section>

      <div className="table-card supplier-table-card">
        <div className="supplier-toolbar">
          <div className="supplier-search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search supplier, contact person, phone, or address..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
            />

            {searchTerm && (
              <button
                type="button"
                className="supplier-clear-search"
                onClick={() =>
                  setSearchTerm("")
                }
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="supplier-record-tabs">
            <button
              type="button"
              className={
                recordView === "active"
                  ? "supplier-tab active"
                  : "supplier-tab"
              }
              onClick={() => {
                setSearchTerm("");
                setRecordView("active");
              }}
            >
              Active Suppliers
            </button>

            <button
              type="button"
              className={
                recordView === "archived"
                  ? "supplier-tab active"
                  : "supplier-tab"
              }
              onClick={() => {
                setSearchTerm("");
                setRecordView("archived");
              }}
            >
              Archived
            </button>
          </div>
        </div>

        <div className="supplier-table-wrapper">
          <table className="supplier-table">
            <thead>
              <tr>
                <th>Supplier ID</th>
                <th>Supplier</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Products</th>
                <th>Deliveries</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9">
                    <LoadingState text="Loading supplier records..." />
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <EmptyState
                      title={
                        recordView === "archived"
                          ? "No archived suppliers"
                          : "No supplier records found"
                      }
                      message={
                        recordView === "archived"
                          ? "Archived suppliers will appear here."
                          : "Register a supplier once, then use that record in Delivery Management."
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedVendors.map((vendor) => (
                  <tr key={vendor.vendor_id}>
                    <td>
                      <strong className="supplier-code">
                        {formatSupplierId(
                          vendor.vendor_id
                        )}
                      </strong>
                    </td>

                    <td>
                      <div className="supplier-name-cell">
                        <div className="supplier-avatar">
                          <Building2 size={18} />
                        </div>

                        <div>
                          <strong>
                            {vendor.vendor_name}
                          </strong>

                          <span>
                            {recordView ===
                            "archived"
                              ? "Archived business partner"
                              : "Available for delivery transactions"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      {vendor.contact_person ||
                        "Not provided"}
                    </td>

                    <td>
                      {vendor.phone ||
                        "Not provided"}
                    </td>

                    <td>
                      <span className="supplier-address">
                        {vendor.address ||
                          "Not provided"}
                      </span>
                    </td>

                    <td>
                      <span className="supplier-count-value">
                        {Number(
                          vendor.product_count ||
                            0
                        )}
                      </span>
                    </td>

                    <td>
                      <span className="supplier-count-value">
                        {Number(
                          vendor.delivery_count ||
                            0
                        )}
                      </span>
                    </td>

                    <td>
                      {formatDateTime(
                        vendor.created_at
                      )}
                    </td>

                    <td>
                      <div className="supplier-row-actions action-group">
                        <button
                          type="button"
                          className="icon-btn"
                          title="View business profile"
                          onClick={() =>
                            openProfileModal(vendor)
                          }
                        >
                          <Eye size={17} />
                        </button>

                        {canManageSuppliers &&
                          recordView ===
                            "active" && (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                title="Edit supplier"
                                onClick={() =>
                                  openEditModal(
                                    vendor
                                  )
                                }
                              >
                                <Pencil
                                  size={17}
                                />
                              </button>

                              <button
                                type="button"
                                className="icon-btn"
                                title="Archive supplier"
                                onClick={() =>
                                  requestSupplierStatus(
                                    vendor,
                                    "archive"
                                  )
                                }
                              >
                                <Archive
                                  size={17}
                                />
                              </button>
                            </>
                          )}

                        {canManageSuppliers &&
                          recordView ===
                            "archived" && (
                            <button
                              type="button"
                              className="icon-btn"
                              title="Restore supplier"
                              onClick={() =>
                                requestSupplierStatus(
                                  vendor,
                                  "restore"
                                )
                              }
                            >
                              <ArchiveRestore
                                size={17}
                              />
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
          filteredVendors.length > 0 && (
            <PaginationBar
              totalItems={filteredVendors.length}
              currentPage={supplierPage}
              pageSize={SUPPLIER_PAGE_SIZE}
              onPageChange={setSupplierPage}
              itemLabel={
                recordView === "archived"
                  ? "archived suppliers"
                  : "suppliers"
              }
            />
          )}
      </div>

      {showSupplierModal && (
        <SupplierFormModal
          mode={formMode}
          data={supplierForm}
          saving={saving}
          onChange={handleFormChange}
          onSubmit={submitSupplier}
          onClose={closeSupplierModal}
        />
      )}

      {showProfileModal && (
        <SupplierBusinessProfileModal
          loading={profileLoading}
          supplier={supplierProfile}
          summary={supplierSummary}
          products={supplierProducts}
          deliveries={supplierDeliveries}
          payables={supplierPayables}
          payments={supplierPayments}
          remittances={supplierRemittances}
          consignments={supplierConsignments}
          productActions={productActionRequests}
          productActionSummary={productActionSummary}
          productRequests={supplierProductRequests}
          productRequestSummary={supplierProductRequestSummary}
          activeTab={activeProfileTab}
          setActiveTab={setActiveProfileTab}
          formatSupplierId={formatSupplierId}
          formatProductId={formatProductId}
          formatPeso={formatPeso}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          processorName={registeredUserName}
          canManagePayments={canManageSuppliers}
          canManageProductActions={role === "Admin"}
          onCreateRemittance={openRemittanceModal}
          onRecordPayment={openPaymentModal}
          onRecordPayablePayment={
            openPayablePaymentModal
          }
          onViewReceipt={openRemittanceReceipt}
          onViewProductAction={(request) =>
            openProductActionReview(request)
          }
          onApproveProductAction={(request) =>
            openProductActionReview(request)
          }
          onRejectProductAction={(request) =>
            openProductActionReview(request)
          }
          onCompleteProductAction={completeProductAction}
          onViewProductActionReceipt={openProductActionReceipt}
          onReviewProductRequest={openSupplierProductReview}
          onAddProduct={openSupplierProductRequestModal}
          onAddVariant={openSupplierVariantRequestModal}
          onRequestPullout={() => openProductActionModal("Pull-out")}
          onRequestDisposal={() => openProductActionModal("Disposal")}
          resolveProductImage={resolveSupplierProductImage}
          onClose={closeProfileModal}
        />
      )}

      {showSupplierProductRequestModal && (
        <SupplierProductRequestModal
          form={supplierProductForm}
          categories={supplierProductCategories}
          imagePreview={supplierProductImagePreview}
          saving={saving}
          mode={supplierProductRequestMode}
          existingFamily={supplierVariantFamily}
          existingProducts={supplierProducts}
          selectedExistingProductId={supplierVariantProductId}
          onExistingProductChange={handleSupplierExistingProductChange}
          onChange={handleSupplierProductFormChange}
          onAddVariant={addSupplierProductVariant}
          onUpdateVariant={updateSupplierProductVariant}
          onRemoveVariant={removeSupplierProductVariant}
          onSubmit={submitSupplierProductRequest}
          onClose={closeSupplierProductRequestModal}
        />
      )}

      {showSupplierProductReviewModal &&
        selectedSupplierProductRequest && (
          <SupplierProductReviewModal
            request={
              selectedSupplierProductRequest
            }
            form={
              supplierProductReviewForm
            }
            saving={saving}
            formatPeso={formatPeso}
            formatDateTime={formatDateTime}
            resolveProductImage={
              resolveSupplierProductImage
            }
            onChange={
              updateSupplierProductReviewForm
            }
            onApprove={() =>
              submitSupplierProductReview(
                "approve"
              )
            }
            onReject={() =>
              submitSupplierProductReview(
                "reject"
              )
            }
            onClose={
              closeSupplierProductReview
            }
          />
        )}

      {showRemittanceModal && (
        <RemittanceOrderModal
          supplier={supplierProfile}
          payables={eligiblePayables}
          selectedIds={selectedPayableIds}
          form={remittanceForm}
          setForm={setRemittanceForm}
          saving={saving}
          formatPeso={formatPeso}
          formatDate={formatDate}
          onToggle={togglePayableSelection}
          onSubmit={submitRemittanceOrder}
          onClose={closeRemittanceModal}
        />
      )}

      {showPaymentModal &&
        (selectedPayable || selectedRemittance) && (
          <SupplierPaymentModal
            supplier={supplierProfile}
            payable={selectedPayable}
            remittance={selectedRemittance}
            form={paymentForm}
            setForm={setPaymentForm}
            saving={saving}
            formatPeso={formatPeso}
            onSubmit={
              selectedPayable
                ? submitDirectPayablePayment
                : submitSupplierPayment
            }
            onClose={closeAnyPaymentModal}
          />
        )}

      {showReceiptModal && receiptData && (
        <RemittanceReceiptModal
          data={receiptData}
          supplier={supplierProfile}
          formatPeso={formatPeso}
          formatDate={formatDate}
          processorName={registeredUserName}
          onClose={closeReceiptModal}
        />
      )}

      {showProductActionModal && (
        <ProductActionRequestModal
          products={productActionOptions}
          form={productActionForm}
          setForm={setProductActionForm}
          saving={saving}
          isAdminAction={role === "Admin" && !isSupplier}
          onSubmit={submitProductActionRequest}
          onClose={closeProductActionModal}
        />
      )}

      {showProductActionReviewModal && selectedProductAction && (
        <ProductActionReviewModal
          request={selectedProductAction}
          form={productActionReview}
          setForm={setProductActionReview}
          saving={saving}
          formatDate={formatDate}
          resolveProductImage={resolveSupplierProductImage}
          onSubmit={submitProductActionReview}
          onClose={closeProductActionReview}
        />
      )}

      {showProductActionReceiptModal && productActionReceipt && (
        <ProductActionReceiptModal
          data={productActionReceipt}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          processorName={registeredUserName}
          onClose={closeProductActionReceipt}
        />
      )}

      {showConfirmModal && (
        <ConfirmationModal
          data={confirmation}
          saving={saving}
          onConfirm={submitSupplierStatus}
          onClose={closeConfirmation}
        />
      )}

    </div>
  );
}

function SupplierAccountDashboard({
  loading,
  supplier,
  summary,
  products,
  deliveries,
  payables,
  payments,
  remittances,
  consignments,
  productActions,
  productActionSummary,
  productRequests,
  productRequestSummary,
  activeTab,
  setActiveTab,
  formatSupplierId,
  formatProductId,
  formatPeso,
  formatDate,
  formatDateTime,
  processorName = "",
  onRefresh,
  onAddProduct,
  onAddVariant,
  onRequestPullout,
  onRequestDisposal,
  onViewProductActionReceipt,
  notice,
  closeNotice,
}) {
  const [showSupplierReportModal, setShowSupplierReportModal] =
    useState(false);

  if (loading) {
    return (
      <div className="page vendor-page">
        <LoadingState text="Loading your supplier business profile..." />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="page vendor-page">
        <EmptyState
          title="Supplier profile unavailable"
          message="This login account is not connected to a supplier record. Ask the Admin/Staff to assign a supplier in User Management."
        />

        {notice.open && (
          <NoticeModal
            data={notice}
            onClose={closeNotice}
          />
        )}
      </div>
    );
  }

  const activeGroup =
    getSupplierProfileGroup(activeTab);

  return (
    <div className="page vendor-page supplier-account-page supplier-my-business-enterprise">
      <div className="supplier-my-business-heading">
        <div>
          <h1>My Business</h1>
          <p>
            View your products, deliveries, payments, requests, and supplier activity in one place.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary supplier-my-business-refresh"
          onClick={onRefresh}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <section className="supplier-enterprise-hero supplier-my-business-hero">
        <div className="supplier-enterprise-identity">
          <div className="supplier-enterprise-avatar">
            <Building2 size={30} />
          </div>

          <div className="supplier-enterprise-identity-copy">
            <div className="supplier-enterprise-name-row">
              <h3>{supplier.vendor_name}</h3>

              <span className="supplier-enterprise-status">
                {supplier.status === "Archived"
                  ? "Archived Supplier"
                  : "Active Supplier"}
              </span>
            </div>

            <div className="supplier-enterprise-contact-line">
              <span>
                <UserRound size={15} />
                {supplier.contact_person ||
                  "Not provided"}
              </span>

              <span>
                <Phone size={15} />
                {supplier.phone || "Not provided"}
              </span>

              <span className="supplier-enterprise-address">
                <MapPin size={15} />
                {supplier.address || "Not provided"}
              </span>
            </div>

            <small>
              {formatSupplierId(supplier.vendor_id)}
            </small>
          </div>
        </div>

        <div className="supplier-enterprise-kpis">
          <SupplierHeroMetric
            icon={<Package size={20} />}
            label="Products"
            value={summary.product_count}
            detail="Active Products"
          />

          <SupplierHeroMetric
            icon={<Truck size={20} />}
            label="Deliveries"
            value={summary.delivery_count}
            detail="Total Deliveries"
          />

          <SupplierHeroMetric
            icon={<PhilippinePeso size={20} />}
            label="Outstanding"
            value={formatPeso(
              summary.outstanding_balance
            )}
            detail="Outstanding Balance"
          />

          <SupplierHeroMetric
            icon={<WalletCards size={20} />}
            label="Ready for Payment"
            value={formatPeso(
              summary.ready_for_payment
            )}
            detail="Ready for Payment"
          />
        </div>
      </section>

      <SupplierProfileTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        products={products}
        deliveries={deliveries}
        payables={payables}
        payments={payments}
        remittances={remittances}
        consignments={consignments}
        productActions={productActions}
        productRequests={productRequests}
      />

      <SupplierProfileSubTabs
        activeGroup={activeGroup}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        products={products}
        productRequests={productRequests}
        consignments={consignments}
        payables={payables}
        payments={payments}
        remittances={remittances}
        productActions={productActions}
      />

      {activeTab === "product_proposals" && (
        <SupplierProductRequestToolbar
          summary={productRequestSummary}
          onAddProduct={onAddProduct}
          onAddVariant={onAddVariant}
        />
      )}

      {activeTab === "product_actions" && (
        <ProductActionToolbar
          canRequest
          summary={productActionSummary}
          onRequestPullout={onRequestPullout}
          onRequestDisposal={onRequestDisposal}
        />
      )}

      <div className="supplier-account-content supplier-my-business-content">
        {activeTab === "product_proposals" ? (
          <SupplierProductRequestList
            requests={productRequests}
            formatPeso={formatPeso}
            formatDate={formatDate}
          />
        ) : (
          <SupplierProfileContent
            activeTab={activeTab}
            supplier={supplier}
            summary={summary}
            products={products}
            deliveries={deliveries}
            payables={payables}
            payments={payments}
            remittances={remittances}
            consignments={consignments}
            productActions={productActions}
            productRequests={productRequests}
            productRequestSummary={
              productRequestSummary
            }
            canManageProductActions={false}
            onViewProductActionReceipt={
              onViewProductActionReceipt
            }
            onAddVariant={onAddVariant}
            formatProductId={formatProductId}
            formatPeso={formatPeso}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
            processorName={processorName}
            onGenerateReport={() =>
              setShowSupplierReportModal(true)
            }
          />
        )}
      </div>

      {showSupplierReportModal &&
        typeof document !== "undefined" &&
        createPortal(
          <SupplierOverallReportModal
            supplier={supplier}
            summary={summary}
            products={products}
            deliveries={deliveries}
            payables={payables}
            payments={payments}
            remittances={remittances}
            consignments={consignments}
            productActions={productActions}
            productRequests={productRequests}
            formatPeso={formatPeso}
            formatDate={formatDate}
            onClose={() =>
              setShowSupplierReportModal(false)
            }
          />,
          document.body
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


function escapeSupplierPrintHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openSupplierPrintFrame({
  title,
  html,
}) {
  const printFrame = document.createElement("iframe");

  printFrame.setAttribute(
    "title",
    title || "HiveSync Print"
  );

  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  printFrame.style.visibility = "hidden";

  document.body.appendChild(printFrame);

  const frameDocument =
    printFrame.contentDocument ||
    printFrame.contentWindow?.document;

  if (!frameDocument) {
    printFrame.remove();
    return;
  }

  frameDocument.open();
  frameDocument.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>${escapeSupplierPrintHtml(
          title || "HiveSync Print"
        )}</title>
        <style>
          @page {
            size: 8.5in 13in;
            margin: 0.42in;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
          }

          body {
            width: 100%;
          }

          .hs-print-sheet {
            width: 100%;
            color: #111827;
            background: #ffffff;
          }

          .hs-print-brand {
            padding-bottom: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-bottom: 2px solid #111827;
            text-align: center;
          }

          .hs-print-brand img {
            width: 58px;
            height: 58px;
            margin-bottom: 7px;
            object-fit: contain;
          }

          .hs-print-brand h1 {
            margin: 0;
            font-size: 16px;
            line-height: 1.25;
          }

          .hs-print-brand p {
            margin: 4px 0 0;
            font-size: 10px;
          }

          .hs-print-title {
            margin: 14px 0 10px;
            text-align: center;
          }

          .hs-print-title h2 {
            margin: 0;
            font-size: 14px;
            text-transform: uppercase;
          }

          .hs-print-title p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 9px;
          }

          .hs-print-info {
            margin: 12px 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
          }

          .hs-print-info > div {
            padding: 8px 9px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
          }

          .hs-print-info span,
          .hs-print-info strong {
            display: block;
          }

          .hs-print-info span {
            margin-bottom: 3px;
            color: #64748b;
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .hs-print-info strong {
            font-size: 10px;
            overflow-wrap: anywhere;
          }

          .hs-print-section {
            margin-top: 16px;
            page-break-inside: avoid;
          }

          .hs-print-section h3 {
            margin: 0 0 7px;
            padding-bottom: 5px;
            border-bottom: 1px solid #111827;
            font-size: 10px;
            text-transform: uppercase;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
          }

          th,
          td {
            padding: 7px 8px;
            border: 1px solid #94a3b8;
            text-align: left;
            font-size: 8px;
            vertical-align: top;
          }

          th {
            background: #f1f5f9;
            font-weight: 700;
            text-transform: uppercase;
          }

          tr {
            page-break-inside: avoid;
          }

          .hs-print-signatures {
            margin-top: 42px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 42px;
            page-break-inside: avoid;
          }

          .hs-print-signatures > div {
            padding-top: 5px;
            border-top: 1px solid #111827;
            text-align: center;
          }

          .hs-print-signatures span,
          .hs-print-signatures strong {
            display: block;
          }

          .hs-print-signatures span {
            min-height: 15px;
            font-size: 9px;
          }

          .hs-print-signatures strong {
            margin-top: 3px;
            font-size: 8px;
          }

          .hs-print-note {
            margin-top: 18px;
            padding-top: 8px;
            border-top: 1px dashed #94a3b8;
            color: #64748b;
            font-size: 8px;
            text-align: center;
          }


          .supplier-report-clean-section {
            margin-top: 10px;
          }

          .supplier-report-clean-section h3 {
            margin: 0 0 4px;
            padding: 0;
            border: 0;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8px;
            line-height: 1.2;
            font-weight: 700;
            text-transform: none;
          }

          .supplier-report-clean-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border: 0;
            border-top: 0.4pt solid #cbd5e1;
            border-left: 0.4pt solid #cbd5e1;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
          }

          .supplier-report-clean-table th,
          .supplier-report-clean-table td {
            height: 19px;
            padding: 3px 4px;
            border: 0;
            border-right: 0.4pt solid #cbd5e1;
            border-bottom: 0.4pt solid #cbd5e1;
            background: #ffffff;
            color: #111827;
            line-height: 1.2;
            vertical-align: middle;
          }

          .supplier-report-clean-table th {
            background: #f8fafc;
            font-size: 5.8px;
            font-weight: 700;
            text-align: left;
            text-transform: uppercase;
          }

          .supplier-report-clean-table td {
            font-size: 6.5px;
            font-weight: 400;
          }

          .supplier-overview-clean-table {
            table-layout: fixed;
          }

          .supplier-overview-clean-table th {
            width: 23%;
          }

          .supplier-overview-clean-table td {
            width: 27%;
            text-align: right;
          }

          .supplier-report-clean-empty {
            padding: 7px !important;
            color: #6b7280 !important;
            text-align: center !important;
          }

          .hs-print-sheet > .hs-print-brand h1,
          .hs-print-sheet > .hs-print-title h2,
          .hs-print-sheet > .hs-print-title p,
          .hs-print-sheet > .hs-print-info,
          .hs-print-sheet > .hs-print-section {
            font-family: Arial, Helvetica, sans-serif;
          }

          .hs-print-sheet > .hs-print-brand h1 {
            font-size: 13px;
            font-weight: 700;
          }

          .hs-print-sheet > .hs-print-title h2 {
            font-size: 11px;
            font-weight: 700;
          }


          .hs-finance-receipt {
            width: 100%;
            max-width: 7.15in;
            margin: 0 auto;
            color: #111111;
            font-family: Arial, Helvetica, sans-serif;
          }

          .hs-finance-receipt-header {
            display: grid;
            grid-template-columns: 62px 1fr 150px;
            gap: 12px;
            align-items: center;
            padding-bottom: 9px;
            border-bottom: 1px solid #444444;
          }

          .hs-finance-receipt-header img {
            width: 52px;
            height: 52px;
            object-fit: contain;
          }

          .hs-finance-receipt-brand h1 {
            margin: 0;
            font-size: 14px;
            line-height: 1.2;
            font-weight: 800;
            text-transform: uppercase;
          }

          .hs-finance-receipt-brand p {
            margin: 3px 0 0;
            font-size: 8px;
            line-height: 1.3;
          }

          .hs-finance-receipt-number {
            text-align: right;
          }

          .hs-finance-receipt-number span {
            display: block;
            margin-bottom: 3px;
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .hs-finance-receipt-number strong {
            font-size: 10px;
            overflow-wrap: anywhere;
          }

          .hs-finance-receipt-title {
            margin: 13px 0 11px;
            text-align: center;
          }

          .hs-finance-receipt-title h2 {
            margin: 0;
            font-size: 14px;
            font-weight: 500;
            letter-spacing: 0.8px;
            text-transform: uppercase;
          }

          .hs-finance-receipt-fields {
            margin-bottom: 8px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: 24px;
            row-gap: 6px;
          }

          .hs-finance-field {
            min-width: 0;
            display: flex;
            align-items: flex-end;
            gap: 5px;
            font-size: 8.5px;
          }

          .hs-finance-field span {
            flex: 0 0 auto;
            font-weight: 700;
            text-transform: uppercase;
          }

          .hs-finance-field strong {
            min-width: 0;
            flex: 1;
            min-height: 15px;
            padding: 0 4px 2px;
            border-bottom: 0.7px solid #555555;
            font-size: 9px;
            font-weight: 500;
            overflow-wrap: anywhere;
          }

          .hs-finance-receipt-table {
            width: 100%;
            margin-top: 8px;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .hs-finance-receipt-table th,
          .hs-finance-receipt-table td {
            height: 24px;
            padding: 4px 5px;
            border: 0.6px solid #777777;
            background: #ffffff;
            color: #111111;
            font-size: 8.3px;
            line-height: 1.25;
            vertical-align: middle;
          }

          .hs-finance-receipt-table th {
            font-size: 7.8px;
            font-weight: 700;
            text-align: center;
            text-transform: uppercase;
          }

          .hs-finance-receipt-table td {
            text-align: center;
            overflow-wrap: anywhere;
          }

          .hs-finance-blank-row td {
            height: 23px;
          }

          .hs-finance-total-row td {
            font-weight: 700;
          }

          .hs-finance-total-label {
            text-align: right !important;
            text-transform: uppercase;
          }

          .hs-finance-total-value {
            text-align: right !important;
            white-space: nowrap;
          }

          .hs-finance-certification {
            margin-top: 11px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 36px;
            font-size: 8px;
            line-height: 1.4;
          }

          .hs-finance-certification p {
            margin: 0;
          }

          .hs-finance-signatures {
            margin-top: 32px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 42px;
            page-break-inside: avoid;
          }

          .hs-finance-signatures > div {
            text-align: center;
          }

          .hs-finance-signature-line {
            min-height: 18px;
            padding-bottom: 3px;
            border-bottom: 0.8px solid #333333;
            font-size: 8.5px;
          }

          .hs-finance-signatures strong {
            display: block;
            margin-top: 4px;
            font-size: 8px;
          }

          .hs-finance-footnote {
            margin-top: 16px;
            padding-top: 6px;
            border-top: 0.5px solid #cbd5e1;
            color: #64748b;
            font-size: 7px;
            text-align: center;
          }


          .hs-delivery-receipt {
            width: 100%;
            max-width: 7.15in;
            margin: 0 auto;
            color: #111111;
            font-family: Arial, Helvetica, sans-serif;
          }

          .hs-delivery-receipt-header {
            display: grid;
            grid-template-columns: 62px 1fr 150px;
            gap: 12px;
            align-items: center;
            padding-bottom: 9px;
            border-bottom: 1px solid #444444;
          }

          .hs-delivery-receipt-header img {
            width: 52px;
            height: 52px;
            object-fit: contain;
          }

          .hs-delivery-receipt-brand h1 {
            margin: 0;
            font-size: 14px;
            line-height: 1.2;
            font-weight: 800;
            text-transform: uppercase;
          }

          .hs-delivery-receipt-brand p {
            margin: 3px 0 0;
            font-size: 8px;
            line-height: 1.3;
          }

          .hs-delivery-receipt-number {
            text-align: right;
          }

          .hs-delivery-receipt-number span {
            display: block;
            margin-bottom: 3px;
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .hs-delivery-receipt-number strong {
            font-size: 11px;
            letter-spacing: 0.3px;
          }

          .hs-delivery-receipt-title {
            margin: 13px 0 11px;
            text-align: center;
          }

          .hs-delivery-receipt-title h2 {
            margin: 0;
            font-size: 15px;
            font-weight: 500;
            letter-spacing: 1px;
            text-transform: uppercase;
          }

          .hs-delivery-receipt-fields {
            margin-bottom: 8px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 180px;
            column-gap: 22px;
            row-gap: 6px;
          }

          .hs-delivery-receipt-field {
            display: flex;
            align-items: flex-end;
            gap: 5px;
            min-width: 0;
            font-size: 8.5px;
          }

          .hs-delivery-receipt-field > span {
            flex: 0 0 auto;
            font-weight: 700;
            text-transform: uppercase;
          }

          .hs-delivery-receipt-field > strong {
            min-width: 0;
            flex: 1;
            min-height: 15px;
            padding: 0 4px 2px;
            border-bottom: 0.7px solid #555555;
            font-size: 9px;
            font-weight: 500;
            overflow-wrap: anywhere;
          }

          .hs-delivery-receipt-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-top: 7px;
            page-break-inside: auto;
          }

          .hs-delivery-receipt-table col.qty {
            width: 10%;
          }

          .hs-delivery-receipt-table col.unit {
            width: 11%;
          }

          .hs-delivery-receipt-table col.description {
            width: 43%;
          }

          .hs-delivery-receipt-table col.price {
            width: 18%;
          }

          .hs-delivery-receipt-table col.amount {
            width: 18%;
          }

          .hs-delivery-receipt-table th,
          .hs-delivery-receipt-table td {
            height: 23px;
            padding: 4px 5px;
            border: 0.6px solid #777777;
            background: #ffffff;
            color: #111111;
            font-size: 8.5px;
            line-height: 1.25;
            vertical-align: middle;
          }

          .hs-delivery-receipt-table th {
            font-size: 8px;
            font-weight: 700;
            text-align: center;
            text-transform: uppercase;
          }

          .hs-delivery-receipt-table td:nth-child(1),
          .hs-delivery-receipt-table td:nth-child(2) {
            text-align: center;
          }

          .hs-delivery-receipt-table td:nth-child(4),
          .hs-delivery-receipt-table td:nth-child(5) {
            text-align: right;
            white-space: nowrap;
          }

          .hs-delivery-receipt-table tbody tr {
            page-break-inside: avoid;
          }

          .hs-delivery-receipt-total-row td {
            font-weight: 700;
          }

          .hs-delivery-receipt-total-label {
            text-align: right !important;
            letter-spacing: 0.3px;
          }

          .hs-delivery-receipt-summary {
            margin-top: 7px;
            display: flex;
            justify-content: flex-end;
            gap: 18px;
            font-size: 8px;
          }

          .hs-delivery-receipt-summary span {
            color: #444444;
          }

          .hs-delivery-receipt-summary strong {
            margin-left: 4px;
            color: #111111;
          }

          .hs-delivery-receipt-certification {
            margin-top: 11px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 36px;
            font-size: 8px;
            line-height: 1.4;
          }

          .hs-delivery-receipt-certification p {
            margin: 0;
          }

          .hs-delivery-receipt-signatures {
            margin-top: 32px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 42px;
            page-break-inside: avoid;
          }

          .hs-delivery-receipt-signature {
            text-align: center;
          }

          .hs-delivery-receipt-signature .line {
            min-height: 18px;
            padding-bottom: 3px;
            border-bottom: 0.8px solid #333333;
            font-size: 8.5px;
          }

          .hs-delivery-receipt-signature strong {
            display: block;
            margin-top: 4px;
            font-size: 8px;
            font-weight: 700;
          }

          .hs-delivery-receipt-footnote {
            margin-top: 16px;
            padding-top: 6px;
            border-top: 0.5px solid #cbd5e1;
            color: #64748b;
            font-size: 7px;
            text-align: center;
          }

          @media print {
            .hs-delivery-receipt {
              max-width: none;
            }
          }
        </style>
      </head>

      <body>
        ${html}
      </body>
    </html>
  `);
  frameDocument.close();

  const runPrint = () => {
    const frameWindow =
      printFrame.contentWindow;

    if (!frameWindow) {
      printFrame.remove();
      return;
    }

    frameWindow.focus();
    frameWindow.print();

    window.setTimeout(() => {
      printFrame.remove();
    }, 1000);
  };

  const logo =
    frameDocument.querySelector("img");

  if (logo && !logo.complete) {
    logo.addEventListener(
      "load",
      runPrint,
      { once: true }
    );
    logo.addEventListener(
      "error",
      runPrint,
      { once: true }
    );
  } else {
    window.setTimeout(runPrint, 250);
  }
}

function printSupplierTransactionReceipt({
  supplier,
  title,
  reference,
  fields = [],
  preparedBy = "",
}) {
  const normalizedTitle =
    title || "Supplier Transaction Receipt";
  const normalizedReference =
    reference || "N/A";

  const safeFields = fields.filter(
    (item) => item && item.label
  );

  const fieldMap = new Map(
    safeFields.map((item) => [
      String(item.label || "")
        .trim()
        .toLowerCase(),
      item.value ?? "N/A",
    ])
  );

  const getField = (...labels) => {
    for (const label of labels) {
      const value = fieldMap.get(
        String(label).toLowerCase()
      );

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return "N/A";
  };

  const lowerTitle =
    normalizedTitle.toLowerCase();

  const isPayable =
    lowerTitle.includes("payable");
  const isPayment =
    lowerTitle.includes("payment") &&
    !lowerTitle.includes("remittance");
  const isRemittance =
    lowerTitle.includes("remittance");
  const isConsignment =
    lowerTitle.includes("consignment");

  let tableHeaders = [];
  let tableCells = [];
  let totalLabel = "";
  let totalValue = "";

  if (isPayable) {
    tableHeaders = [
      "Delivery",
      "Payable",
      "Paid",
      "Balance",
      "Status",
    ];
    tableCells = [
      normalizedReference,
      getField("Payable Amount"),
      getField("Paid Amount"),
      getField("Balance"),
      getField("Payment Status"),
    ];
    totalLabel = "Balance";
    totalValue = getField("Balance");
  } else if (isPayment) {
    tableHeaders = [
      "Payment No.",
      "Amount Paid",
      "Method",
      "Reference",
      "Received By",
    ];
    tableCells = [
      normalizedReference,
      getField("Amount Paid"),
      getField("Payment Method"),
      getField("Reference"),
      getField("Received By"),
    ];
    totalLabel = "Total Paid";
    totalValue = getField("Amount Paid");
  } else if (isRemittance) {
    tableHeaders = [
      "Remittance No.",
      "Amount",
      "Release Date",
      "Reference",
      "Status",
    ];
    tableCells = [
      normalizedReference,
      getField("Amount"),
      getField("Release Date"),
      getField("Reference"),
      getField("Status"),
    ];
    totalLabel = "Total Remittance";
    totalValue = getField("Amount");
  } else if (isConsignment) {
    tableHeaders = [
      "Product",
      "Quantity",
      "Start Date",
      "Pull-out Date",
      "Status",
    ];
    tableCells = [
      getField("Product"),
      getField("Quantity"),
      getField("Start Date"),
      getField("Pull-out Date"),
      getField("Status"),
    ];
    totalLabel = "Quantity";
    totalValue = getField("Quantity");
  } else {
    tableHeaders = safeFields
      .slice(0, 5)
      .map((item) => item.label);
    tableCells = safeFields
      .slice(0, 5)
      .map((item) => item.value ?? "N/A");
  }

  const usedLabels = new Set(
    tableHeaders.map((item) =>
      String(item).toLowerCase()
    )
  );

  const extraFields = safeFields
    .filter(
      (item) =>
        !usedLabels.has(
          String(item.label).toLowerCase()
        )
    )
    .slice(0, 4);

  const extraFieldHtml = extraFields
    .map(
      (item) => `
        <div class="hs-finance-field">
          <span>${escapeSupplierPrintHtml(
            item.label
          )}</span>
          <strong>${escapeSupplierPrintHtml(
            item.value ?? "N/A"
          )}</strong>
        </div>
      `
    )
    .join("");

  const headerHtml = tableHeaders
    .map(
      (header) =>
        `<th>${escapeSupplierPrintHtml(
          header
        )}</th>`
    )
    .join("");

  const cellHtml = tableCells
    .map(
      (cell) =>
        `<td>${escapeSupplierPrintHtml(
          cell
        )}</td>`
    )
    .join("");

  const blankRows = Array.from(
    { length: isConsignment ? 6 : 5 },
    () => `
      <tr class="hs-finance-blank-row">
        ${tableHeaders
          .map(() => "<td>&nbsp;</td>")
          .join("")}
      </tr>
    `
  ).join("");

  openSupplierPrintFrame({
    title: normalizedTitle,
    html: `
      <main class="hs-finance-receipt">
        <header class="hs-finance-receipt-header">
          <img
            src="${escapeSupplierPrintHtml(
              bacnotanLogo
            )}"
            alt="Bacnotan Logo"
          />

          <div class="hs-finance-receipt-brand">
            <h1>
              BACNOTAN FARMERS AGRI-TOURISM CENTER
            </h1>
            <p>
              HiveSync Integrated Business and Operations Management System
            </p>
          </div>

          <div class="hs-finance-receipt-number">
            <span>Reference No.</span>
            <strong>${escapeSupplierPrintHtml(
              normalizedReference
            )}</strong>
          </div>
        </header>

        <section class="hs-finance-receipt-title">
          <h2>${escapeSupplierPrintHtml(
            normalizedTitle
          )}</h2>
        </section>

        <section class="hs-finance-receipt-fields">
          <div class="hs-finance-field">
            <span>Supplier</span>
            <strong>${escapeSupplierPrintHtml(
              supplier?.vendor_name ||
                "Not provided"
            )}</strong>
          </div>

          <div class="hs-finance-field">
            <span>Supplier ID</span>
            <strong>${escapeSupplierPrintHtml(
              supplier?.vendor_id
                ? `SUP-${String(
                    supplier.vendor_id
                  ).padStart(4, "0")}`
                : "N/A"
            )}</strong>
          </div>

          ${extraFieldHtml}
        </section>

        <table class="hs-finance-receipt-table">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            <tr>${cellHtml}</tr>
            ${blankRows}

            ${
              totalLabel
                ? `
                  <tr class="hs-finance-total-row">
                    <td
                      colspan="${Math.max(
                        1,
                        tableHeaders.length - 2
                      )}"
                    ></td>
                    <td class="hs-finance-total-label">
                      ${escapeSupplierPrintHtml(
                        totalLabel
                      )}
                    </td>
                    <td class="hs-finance-total-value">
                      ${escapeSupplierPrintHtml(
                        totalValue
                      )}
                    </td>
                  </tr>
                `
                : ""
            }
          </tbody>
        </table>

        <section class="hs-finance-certification">
          <p>
            Checked and certified that the above transaction has been recorded in HiveSync.
          </p>
          <p>
            Received and acknowledged subject to the terms and records of BFATC.
          </p>
        </section>

        <section class="hs-finance-signatures">
          <div>
            <div class="hs-finance-signature-line">
              ${escapeSupplierPrintHtml(
                preparedBy || ""
              )}
            </div>
            <strong>Prepared / Processed By</strong>
          </div>

          <div>
            <div class="hs-finance-signature-line"></div>
            <strong>Acknowledged By</strong>
          </div>
        </section>

        <footer class="hs-finance-footnote">
          This transaction receipt was generated through HiveSync.
        </footer>
      </main>
    `,
  });
}

async function printSupplierDeliveryReceipt({
  supplier,
  delivery,
  formatPeso,
  formatDate,
}) {
  if (!delivery?.delivery_id) {
    window.alert(
      "Unable to print the delivery receipt because the delivery ID is missing."
    );
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/delivery_management/get_delivery_details.php?delivery_id=${encodeURIComponent(
        delivery.delivery_id
      )}&time=${Date.now()}`,
      {
        credentials: "include",
        cache: "no-store",
      }
    );

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(
        "Invalid delivery receipt response:",
        responseText
      );

      throw new Error(
        "The delivery details endpoint returned an invalid response."
      );
    }

    if (!response.ok || !data.success || !data.delivery) {
      throw new Error(
        data?.message ||
          "Unable to retrieve the delivery details."
      );
    }

    const fullDelivery = data.delivery;
    const items = Array.isArray(fullDelivery.items)
      ? fullDelivery.items
      : [];

    const supplierName =
      fullDelivery.vendor_name ||
      supplier?.vendor_name ||
      "Not provided";

    const supplierAddress =
      fullDelivery.supplier_address ||
      supplier?.address ||
      "Not provided";

    const deliveredBy =
      fullDelivery.driver ||
      fullDelivery.owner_name ||
      fullDelivery.contact_person ||
      supplier?.contact_person ||
      supplierName;

    const receivedBy =
      fullDelivery.received_by_name ||
      fullDelivery.legacy_received_by ||
      delivery.received_by ||
      "";

    const receiptNumber =
      fullDelivery.delivery_order_no ||
      delivery.delivery_order_no ||
      `Delivery ${delivery.delivery_id}`;

    const supplierTotal = items.reduce(
      (total, item) =>
        total +
        Number(
          item.supplier_payable_line_total ??
            Number(item.quantity || 0) *
              Number(item.supplier_price || 0)
        ),
      0
    );

    const receiptTotal =
      Number(
        fullDelivery.supplier_payable_amount ??
          supplierTotal
      ) || supplierTotal;

    const totalQuantity = items.reduce(
      (total, item) =>
        total + Number(item.quantity || 0),
      0
    );

    const minimumRows = 12;
    const blankRows = Math.max(
      0,
      minimumRows - items.length
    );

    const itemRows = items
      .map((item) => {
        const quantity = Number(
          item.quantity || 0
        );

        const unit =
          item.effective_unit ||
          item.unit ||
          "pcs";

        const description =
          item.effective_product_name ||
          item.product_name ||
          "Product";

        const unitPrice = Number(
          item.supplier_price || 0
        );

        const lineAmount = Number(
          item.supplier_payable_line_total ??
            quantity * unitPrice
        );

        return `
          <tr>
            <td>${escapeSupplierPrintHtml(
              quantity
            )}</td>
            <td>${escapeSupplierPrintHtml(
              unit
            )}</td>
            <td>${escapeSupplierPrintHtml(
              description
            )}</td>
            <td>${escapeSupplierPrintHtml(
              formatPeso(unitPrice)
            )}</td>
            <td>${escapeSupplierPrintHtml(
              formatPeso(lineAmount)
            )}</td>
          </tr>
        `;
      })
      .join("");

    const emptyRows = Array.from(
      { length: blankRows },
      () => `
        <tr class="hs-delivery-receipt-empty-row">
          <td>&nbsp;</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `
    ).join("");

    openSupplierPrintFrame({
      title: "Delivery Receipt",
      html: `
        <main class="hs-delivery-receipt">
          <header class="hs-delivery-receipt-header">
            <img
              src="${escapeSupplierPrintHtml(
                bacnotanLogo
              )}"
              alt="Bacnotan Logo"
            />

            <div class="hs-delivery-receipt-brand">
              <h1>
                Bacnotan Farmers Agri-Tourism Center
              </h1>
              <p>
                HiveSync Integrated Business and Operations Management System
              </p>
            </div>

            <div class="hs-delivery-receipt-number">
              <span>Delivery Receipt No.</span>
              <strong>${escapeSupplierPrintHtml(
                receiptNumber
              )}</strong>
            </div>
          </header>

          <section class="hs-delivery-receipt-title">
            <h2>Delivery Receipt</h2>
          </section>

          <section class="hs-delivery-receipt-fields">
            <div class="hs-delivery-receipt-field">
              <span>Delivered To</span>
              <strong>
                BACNOTAN FARMERS AGRI-TOURISM CENTER
              </strong>
            </div>

            <div class="hs-delivery-receipt-field">
              <span>Date</span>
              <strong>${escapeSupplierPrintHtml(
                formatDate(
                  fullDelivery.delivery_date ||
                    delivery.delivery_date
                )
              )}</strong>
            </div>

            <div class="hs-delivery-receipt-field">
              <span>Supplier</span>
              <strong>${escapeSupplierPrintHtml(
                supplierName
              )}</strong>
            </div>

            <div class="hs-delivery-receipt-field">
              <span>Delivered By</span>
              <strong>${escapeSupplierPrintHtml(
                deliveredBy
              )}</strong>
            </div>

            <div class="hs-delivery-receipt-field">
              <span>Supplier Address</span>
              <strong>${escapeSupplierPrintHtml(
                supplierAddress
              )}</strong>
            </div>

            <div class="hs-delivery-receipt-field">
              <span>Status</span>
              <strong>${escapeSupplierPrintHtml(
                fullDelivery.status ||
                  delivery.status ||
                  "N/A"
              )}</strong>
            </div>
          </section>

          <table class="hs-delivery-receipt-table">
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
                itemRows ||
                `
                  <tr>
                    <td colspan="5" style="text-align:center;">
                      No delivery item details found.
                    </td>
                  </tr>
                `
              }
              ${emptyRows}

              <tr class="hs-delivery-receipt-total-row">
                <td colspan="3"></td>
                <td class="hs-delivery-receipt-total-label">
                  TOTAL
                </td>
                <td>${escapeSupplierPrintHtml(
                  formatPeso(receiptTotal)
                )}</td>
              </tr>
            </tbody>
          </table>

          <div class="hs-delivery-receipt-summary">
            <span>
              Product Lines:
              <strong>${escapeSupplierPrintHtml(
                items.length ||
                  fullDelivery.product_line_count ||
                  delivery.product_line_count ||
                  0
              )}</strong>
            </span>

            <span>
              Total Quantity:
              <strong>${escapeSupplierPrintHtml(
                totalQuantity ||
                  fullDelivery.items_count ||
                  delivery.delivered_quantity ||
                  delivery.items_count ||
                  0
              )}</strong>
            </span>
          </div>

          <section class="hs-delivery-receipt-certification">
            <p>
              Checked and certified that the above merchandise was received and recorded in HiveSync.
            </p>

            <p>
              Received in good order and condition, subject to the recorded delivery details.
            </p>
          </section>

          <section class="hs-delivery-receipt-signatures">
            <div class="hs-delivery-receipt-signature">
              <div class="line">${escapeSupplierPrintHtml(
                receivedBy
              )}</div>
              <strong>Checked / Received By</strong>
            </div>

            <div class="hs-delivery-receipt-signature">
              <div class="line"></div>
              <strong>Supplier / Delivered By</strong>
            </div>
          </section>

          <footer class="hs-delivery-receipt-footnote">
            This delivery receipt was generated through HiveSync.
          </footer>
        </main>
      `,
    });
  } catch (error) {
    console.error(
      "Delivery receipt print error:",
      error
    );

    window.alert(
      error.message ||
        "Unable to generate the delivery receipt."
    );
  }
}

function supplierRecordDate(record, type) {
  const dateMap = {
    deliveries:
      record.delivery_date ||
      record.received_at ||
      record.created_at,

    payables:
      record.delivery_date ||
      record.created_at,

    payments:
      record.payment_date ||
      record.created_at,

    remittances:
      record.release_date ||
      record.created_at,

    consignments:
      record.consignment_start_date ||
      record.start_date ||
      record.created_at,

    product_actions:
      record.completed_at ||
      record.updated_at ||
      record.created_at,

    product_proposals:
      record.reviewed_at ||
      record.updated_at ||
      record.created_at,
  };

  return dateMap[type] || null;
}

function supplierRecordInRange(
  record,
  type,
  dateFrom,
  dateTo
) {
  const rawDate =
    supplierRecordDate(record, type);

  if (!rawDate) {
    return true;
  }

  const value =
    String(rawDate).slice(0, 10);

  if (
    dateFrom &&
    value < dateFrom
  ) {
    return false;
  }

  if (
    dateTo &&
    value > dateTo
  ) {
    return false;
  }

  return true;
}

function SupplierOverallReportModal({
  supplier,
  summary,
  products,
  deliveries,
  payables,
  payments,
  remittances,
  consignments,
  productActions,
  productRequests,
  formatPeso,
  formatDate,
  onClose,
}) {
  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  const [sections, setSections] =
    useState({
      overview: true,
      products: true,
      deliveries: true,
      payables: true,
      payments: true,
      remittances: true,
      consignments: true,
      product_actions: true,
      product_proposals: true,
    });

  const toggleSection = (key) => {
    setSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const filtered = {
    deliveries:
      deliveries.filter((item) =>
        supplierRecordInRange(
          item,
          "deliveries",
          dateFrom,
          dateTo
        )
      ),

    payables:
      payables.filter((item) =>
        supplierRecordInRange(
          item,
          "payables",
          dateFrom,
          dateTo
        )
      ),

    payments:
      payments.filter((item) =>
        supplierRecordInRange(
          item,
          "payments",
          dateFrom,
          dateTo
        )
      ),

    remittances:
      remittances.filter((item) =>
        supplierRecordInRange(
          item,
          "remittances",
          dateFrom,
          dateTo
        )
      ),

    consignments:
      consignments.filter((item) =>
        supplierRecordInRange(
          item,
          "consignments",
          dateFrom,
          dateTo
        )
      ),

    productActions:
      productActions.filter((item) =>
        supplierRecordInRange(
          item,
          "product_actions",
          dateFrom,
          dateTo
        )
      ),

    productRequests:
      productRequests.filter((item) =>
        supplierRecordInRange(
          item,
          "product_proposals",
          dateFrom,
          dateTo
        )
      ),
  };

  const selectedCount =
    Object.values(sections).filter(Boolean)
      .length;

  const reportRange =
    dateFrom || dateTo
      ? `${dateFrom || "Beginning"} to ${
          dateTo || "Present"
        }`
      : "All available records";

  const buildRows = (
    rows,
    columns
  ) =>
    rows
      .map(
        (row) => `
          <tr>
            ${columns
              .map(
                (column) => `
                  <td>
                    ${escapeSupplierPrintHtml(
                      column.get(row)
                    )}
                  </td>
                `
              )
              .join("")}
          </tr>
        `
      )
      .join("");

  const buildTable = (
    title,
    rows,
    columns
  ) => `
    <section class="hs-print-section supplier-report-clean-section">
      <h3>${escapeSupplierPrintHtml(title)}</h3>

      <table class="supplier-report-clean-table">
        <thead>
          <tr>
            ${columns
              .map(
                (column) => `
                  <th>${escapeSupplierPrintHtml(
                    column.label
                  )}</th>
                `
              )
              .join("")}
          </tr>
        </thead>

        <tbody>
          ${
            rows.length
              ? buildRows(rows, columns)
              : `
                <tr>
                  <td
                    colspan="${columns.length}"
                    class="supplier-report-clean-empty"
                  >
                    No records for this section.
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </section>
  `;

  const printReport = () => {
    const parts = [];

    if (sections.overview) {
      parts.push(`
        <section class="hs-print-section supplier-report-clean-section">
          <h3>Supplier Overview</h3>

          <table class="supplier-report-clean-table supplier-overview-clean-table">
            <tbody>
              <tr>
                <th>Products</th>
                <td>${escapeSupplierPrintHtml(
                  summary.product_count || 0
                )}</td>
                <th>Deliveries</th>
                <td>${escapeSupplierPrintHtml(
                  summary.delivery_count || 0
                )}</td>
              </tr>
              <tr>
                <th>Total Payable</th>
                <td>${escapeSupplierPrintHtml(
                  formatPeso(
                    summary.total_payable || 0
                  )
                )}</td>
                <th>Total Paid</th>
                <td>${escapeSupplierPrintHtml(
                  formatPeso(
                    summary.total_paid || 0
                  )
                )}</td>
              </tr>
              <tr>
                <th>Outstanding</th>
                <td>${escapeSupplierPrintHtml(
                  formatPeso(
                    summary.outstanding_balance || 0
                  )
                )}</td>
                <th>Consignment Products</th>
                <td>${escapeSupplierPrintHtml(
                  summary.consignment_count || 0
                )}</td>
              </tr>
            </tbody>
          </table>
        </section>
      `);
    }

    if (sections.products) {
      parts.push(
        buildTable(
          "Active Products",
          products,
          [
            {
              label: "Product",
              get: (row) =>
                row.product_name ||
                "N/A",
            },
            {
              label: "SKU",
              get: (row) =>
                row.sku || "N/A",
            },
            {
              label: "Quantity",
              get: (row) =>
                `${Number(
                  row.quantity || 0
                )} ${
                  row.unit ||
                  row.unit_type ||
                  ""
                }`,
            },
            {
              label: "Selling Price",
              get: (row) =>
                formatPeso(
                  row.selling_price || 0
                ),
            },
            {
              label: "Status",
              get: (row) =>
                row.status || "N/A",
            },
          ]
        )
      );
    }

    if (sections.deliveries) {
      parts.push(
        buildTable(
          "Deliveries",
          filtered.deliveries,
          [
            {
              label: "Delivery No.",
              get: (row) =>
                row.delivery_order_no ||
                row.delivery_id,
            },
            {
              label: "Date",
              get: (row) =>
                formatDate(
                  row.delivery_date
                ),
            },
            {
              label: "Quantity",
              get: (row) =>
                Number(
                  row.delivered_quantity ||
                    row.items_count ||
                    0
                ),
            },
            {
              label: "Supplier Payable",
              get: (row) =>
                formatPeso(
                  row.supplier_payable_amount ||
                    0
                ),
            },
            {
              label: "Status",
              get: (row) =>
                row.status || "N/A",
            },
          ]
        )
      );
    }

    if (sections.payables) {
      parts.push(
        buildTable(
          "Payables",
          filtered.payables,
          [
            {
              label: "Delivery",
              get: (row) =>
                row.delivery_order_no ||
                row.delivery_id,
            },
            {
              label: "Payable",
              get: (row) =>
                formatPeso(
                  row.payable_amount || 0
                ),
            },
            {
              label: "Paid",
              get: (row) =>
                formatPeso(
                  row.paid_amount || 0
                ),
            },
            {
              label: "Balance",
              get: (row) =>
                formatPeso(
                  row.balance_amount || 0
                ),
            },
            {
              label: "Status",
              get: (row) =>
                row.payment_status ||
                "N/A",
            },
          ]
        )
      );
    }

    if (sections.payments) {
      parts.push(
        buildTable(
          "Payments",
          filtered.payments,
          [
            {
              label: "Payment No.",
              get: (row) =>
                row.payment_no || "N/A",
            },
            {
              label: "Date",
              get: (row) =>
                formatDate(
                  row.payment_date
                ),
            },
            {
              label: "Amount",
              get: (row) =>
                formatPeso(
                  row.amount_paid || 0
                ),
            },
            {
              label: "Method",
              get: (row) =>
                row.payment_method ||
                "N/A",
            },
            {
              label: "Reference",
              get: (row) =>
                row.reference_number ||
                "N/A",
            },
          ]
        )
      );
    }

    if (sections.remittances) {
      parts.push(
        buildTable(
          "Remittances",
          filtered.remittances,
          [
            {
              label: "Remittance No.",
              get: (row) =>
                row.remittance_order_no ||
                "N/A",
            },
            {
              label: "Amount",
              get: (row) =>
                formatPeso(
                  row.total_amount || 0
                ),
            },
            {
              label: "Release Date",
              get: (row) =>
                formatDate(
                  row.release_date
                ),
            },
            {
              label: "Status",
              get: (row) =>
                row.status || "N/A",
            },
          ]
        )
      );
    }

    if (sections.consignments) {
      parts.push(
        buildTable(
          "Consignment",
          filtered.consignments,
          [
            {
              label: "Product",
              get: (row) =>
                row.product_name ||
                "N/A",
            },
            {
              label: "Quantity",
              get: (row) =>
                `${Number(
                  row.quantity || 0
                )} ${
                  row.unit_type ||
                  row.unit ||
                  ""
                }`,
            },
            {
              label: "Start Date",
              get: (row) =>
                formatDate(
                  row.consignment_start_date ||
                    row.start_date
                ),
            },
            {
              label: "Pull-out Date",
              get: (row) =>
                formatDate(
                  row.consignment_pullout_date ||
                    row.pullout_date
                ),
            },
            {
              label: "Status",
              get: (row) =>
                row.consignment_status ||
                row.status ||
                "Active",
            },
          ]
        )
      );
    }

    if (sections.product_actions) {
      parts.push(
        buildTable(
          "Product Actions",
          filtered.productActions,
          [
            {
              label: "Request",
              get: (row) =>
                row.request_no || "N/A",
            },
            {
              label: "Product",
              get: (row) =>
                row.product_name || "N/A",
            },
            {
              label: "Action",
              get: (row) =>
                row.action_type || "N/A",
            },
            {
              label: "Quantity",
              get: (row) =>
                `${Number(
                  row.approved_quantity ||
                    row.requested_quantity ||
                    0
                )} ${
                  row.unit || ""
                }`,
            },
            {
              label: "Status",
              get: (row) =>
                row.status || "N/A",
            },
          ]
        )
      );
    }

    if (sections.product_proposals) {
      parts.push(
        buildTable(
          "Add New Product",
          filtered.productRequests,
          [
            {
              label: "Request",
              get: (row) =>
                row.request_no || "N/A",
            },
            {
              label: "Product",
              get: (row) =>
                row.product_name || "N/A",
            },
            {
              label: "Category",
              get: (row) =>
                row.category_name ||
                row.category ||
                "N/A",
            },
            {
              label: "Status",
              get: (row) =>
                row.status || "N/A",
            },
          ]
        )
      );
    }

    openSupplierPrintFrame({
      title: `${supplier?.vendor_name || "Supplier"} Overall Report`,
      html: `
        <main class="hs-print-sheet">
          <header class="hs-print-brand">
            <img
              src="${escapeSupplierPrintHtml(
                bacnotanLogo
              )}"
              alt="Bacnotan Logo"
            />
            <h1>
              BACNOTAN FARMERS AGRI-TOURISM CENTER
            </h1>
            <p>
              HiveSync Supplier Business Report
            </p>
          </header>

          <section class="hs-print-title">
            <h2>
              Supplier Overall Report
            </h2>
            <p>
              ${escapeSupplierPrintHtml(
                supplier?.vendor_name ||
                "Supplier"
              )} • ${escapeSupplierPrintHtml(
                reportRange
              )}
            </p>
          </section>

          <section class="hs-print-info">
            <div>
              <span>Supplier</span>
              <strong>${escapeSupplierPrintHtml(
                supplier?.vendor_name ||
                "N/A"
              )}</strong>
            </div>

            <div>
              <span>Contact Person</span>
              <strong>${escapeSupplierPrintHtml(
                supplier?.contact_person ||
                "N/A"
              )}</strong>
            </div>

            <div>
              <span>Phone</span>
              <strong>${escapeSupplierPrintHtml(
                supplier?.phone ||
                "N/A"
              )}</strong>
            </div>

            <div>
              <span>Address</span>
              <strong>${escapeSupplierPrintHtml(
                supplier?.address ||
                "N/A"
              )}</strong>
            </div>

            <div>
              <span>Report Period</span>
              <strong>${escapeSupplierPrintHtml(
                reportRange
              )}</strong>
            </div>

            <div>
              <span>Sections Included</span>
              <strong>${escapeSupplierPrintHtml(
                selectedCount
              )}</strong>
            </div>
          </section>

          ${parts.join("")}

          <section class="hs-print-signatures">
            <div>
              <span></span>
              <strong>Prepared By</strong>
            </div>

            <div>
              <span></span>
              <strong>Reviewed / Approved By</strong>
            </div>
          </section>

          <footer class="hs-print-note">
            This supplier report was generated through HiveSync.
          </footer>
        </main>
      `,
    });
  };

  const reportOptions = [
    ["overview", "Overview"],
    ["products", "Products"],
    ["deliveries", "Deliveries"],
    ["payables", "Payables"],
    ["payments", "Payments"],
    ["remittances", "Remittances"],
    ["consignments", "Consignment"],
    [
      "product_actions",
      "Pull-out / Disposal",
    ],
    [
      "product_proposals",
      "Add New Product",
    ],
  ];

  return (
    <div
      className="modal-overlay supplier-modal-overlay supplier-report-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="modal-box supplier-report-modal">
        <div className="supplier-modal-header">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon">
                <FileText size={21} />
              </div>

              <h2>
                Generate Supplier Report
              </h2>
            </div>

            <p>
              Choose the records and date range
              to include before printing.
            </p>
          </div>

          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="supplier-report-body">
          <section className="supplier-report-filter-card">
            <div className="supplier-report-filter-heading">
              <div>
                <strong>
                  Report Period
                </strong>
                <span>
                  Leave blank to include all available dates.
                </span>
              </div>

              <span>
                {selectedCount} section
                {selectedCount === 1
                  ? ""
                  : "s"}{" "}
                selected
              </span>
            </div>

            <div className="supplier-report-date-grid">
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) =>
                    setDateFrom(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) =>
                    setDateTo(
                      event.target.value
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="supplier-report-filter-card">
            <div className="supplier-report-filter-heading">
              <div>
                <strong>
                  Include Sections
                </strong>
                <span>
                  Admin can customize which supplier records appear in the report.
                </span>
              </div>

              <button
                type="button"
                className="supplier-report-select-all"
                onClick={() => {
                  const shouldEnable =
                    selectedCount !==
                    reportOptions.length;

                  setSections(
                    Object.fromEntries(
                      reportOptions.map(
                        ([key]) => [
                          key,
                          shouldEnable,
                        ]
                      )
                    )
                  );
                }}
              >
                {selectedCount ===
                reportOptions.length
                  ? "Clear All"
                  : "Select All"}
              </button>
            </div>

            <div className="supplier-report-option-grid">
              {reportOptions.map(
                ([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={
                      sections[key]
                        ? "supplier-report-option active"
                        : "supplier-report-option"
                    }
                    onClick={() =>
                      toggleSection(key)
                    }
                  >
                    {sections[key] ? (
                      <CheckSquare
                        size={17}
                      />
                    ) : (
                      <Square size={17} />
                    )}

                    <span>
                      {label}
                    </span>
                  </button>
                )
              )}
            </div>
          </section>

          <section className="supplier-report-preview">
            <div>
              <span>Deliveries</span>
              <strong>
                {
                  filtered.deliveries
                    .length
                }
              </strong>
            </div>

            <div>
              <span>Payments</span>
              <strong>
                {
                  filtered.payments
                    .length
                }
              </strong>
            </div>

            <div>
              <span>Consignment</span>
              <strong>
                {
                  filtered.consignments
                    .length
                }
              </strong>
            </div>

            <div>
              <span>Product Actions</span>
              <strong>
                {
                  filtered.productActions
                    .length
                }
              </strong>
            </div>
          </section>
        </div>

        <div className="supplier-modal-footer">
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
            onClick={printReport}
            disabled={
              selectedCount === 0
            }
          >
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
}


function SupplierBusinessProfileModal({
  loading,
  supplier,
  summary,
  products,
  deliveries,
  payables,
  payments,
  remittances,
  consignments,
  productActions,
  productActionSummary,
  productRequests,
  productRequestSummary,
  activeTab,
  setActiveTab,
  formatSupplierId,
  formatProductId,
  formatPeso,
  formatDate,
  formatDateTime,
  processorName = "",
  canManagePayments,
  canManageProductActions = false,
  onCreateRemittance,
  onRecordPayment,
  onRecordPayablePayment,
  onViewReceipt,
  onViewProductAction,
  onApproveProductAction,
  onRejectProductAction,
  onCompleteProductAction,
  onViewProductActionReceipt,
  onReviewProductRequest,
  onAddProduct = null,
  onAddVariant = null,
  onRequestPullout = null,
  onRequestDisposal = null,
  resolveProductImage,
  onClose,
}) {
  const [showSupplierReportModal, setShowSupplierReportModal] =
    useState(false);

  const activeGroup =
    getSupplierProfileGroup(activeTab);

  return (
    <div className="modal-overlay supplier-modal-overlay">
      <div className="modal-box supplier-business-modal supplier-enterprise-profile">
        <div className="supplier-modal-header supplier-enterprise-modal-header">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon supplier-enterprise-title-icon">
                <Building2 size={21} />
              </div>

              <h2>Supplier Business Profile</h2>
            </div>

            <p>
              One connected view of the supplier&apos;s business activity.
            </p>
          </div>

          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <LoadingState text="Loading supplier business records..." />
        ) : !supplier ? (
          <EmptyState
            title="Supplier profile unavailable"
            message="The supplier business profile could not be loaded."
          />
        ) : (
          <>
            <div className="supplier-business-body supplier-enterprise-body">
              <section className="supplier-enterprise-hero">
                <div className="supplier-enterprise-identity">
                  <div className="supplier-enterprise-avatar">
                    <Building2 size={30} />
                  </div>

                  <div className="supplier-enterprise-identity-copy">
                    <div className="supplier-enterprise-name-row">
                      <h3>{supplier.vendor_name}</h3>

                      <span className="supplier-enterprise-status">
                        {supplier.status === "Archived"
                          ? "Archived Supplier"
                          : "Active Supplier"}
                      </span>
                    </div>

                    <div className="supplier-enterprise-contact-line">
                      <span>
                        <UserRound size={15} />
                        {supplier.contact_person || "Not provided"}
                      </span>

                      <span>
                        <Phone size={15} />
                        {supplier.phone || "Not provided"}
                      </span>

                      <span className="supplier-enterprise-address">
                        <MapPin size={15} />
                        {supplier.address || "Not provided"}
                      </span>
                    </div>

                    <small>
                      {formatSupplierId(supplier.vendor_id)}
                    </small>
                  </div>
                </div>

                <div className="supplier-enterprise-kpis">
                  <SupplierHeroMetric
                    icon={<Package size={20} />}
                    label="Products"
                    value={summary.product_count}
                    detail="Active Products"
                  />

                  <SupplierHeroMetric
                    icon={<Truck size={20} />}
                    label="Deliveries"
                    value={summary.delivery_count}
                    detail="Total Deliveries"
                  />

                  <SupplierHeroMetric
                    icon={<PhilippinePeso size={20} />}
                    label="Outstanding"
                    value={formatPeso(summary.outstanding_balance)}
                    detail="Outstanding Balance"
                  />

                  <SupplierHeroMetric
                    icon={<WalletCards size={20} />}
                    label="Ready for Payment"
                    value={formatPeso(summary.ready_for_payment)}
                    detail="Ready for Payment"
                  />
                </div>
              </section>

              <SupplierProfileTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                products={products}
                deliveries={deliveries}
                payables={payables}
                payments={payments}
                remittances={remittances}
                consignments={consignments}
                productActions={productActions}
                productRequests={productRequests}
              />

              <SupplierProfileSubTabs
                activeGroup={activeGroup}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                products={products}
                productRequests={productRequests}
                consignments={consignments}
                payables={payables}
                payments={payments}
                remittances={remittances}
                productActions={productActions}
              />

              {activeTab === "product_proposals" &&
                canManagePayments &&
                typeof onAddProduct === "function" && (
                  <SupplierProductRequestToolbar
                    summary={productRequestSummary}
                    onAddProduct={onAddProduct}
                    onAddVariant={onAddVariant}
                  />
                )}

              {activeTab === "product_actions" && (
                <ProductActionToolbar
                  canRequest={
                    canManagePayments &&
                    typeof onRequestPullout === "function"
                  }
                  isAdminAction={canManageProductActions}
                  summary={productActionSummary}
                  onRequestPullout={onRequestPullout}
                  onRequestDisposal={onRequestDisposal}
                />
              )}

              {canManagePayments && (
                <SupplierPaymentActions
                  activeTab={activeTab}
                  payables={payables}
                  remittances={remittances}
                  onCreateRemittance={onCreateRemittance}
                  onRecordPayment={onRecordPayment}
                  onViewReceipt={onViewReceipt}
                  formatPeso={formatPeso}
                />
              )}

              <SupplierProfileContent
                activeTab={activeTab}
                supplier={supplier}
                summary={summary}
                products={products}
                deliveries={deliveries}
                payables={payables}
                payments={payments}
                remittances={remittances}
                consignments={consignments}
                productActions={productActions}
                productRequests={productRequests}
                productRequestSummary={productRequestSummary}
                canManagePayables={canManagePayments}
                onRecordPayablePayment={onRecordPayablePayment}
                canManageRemittances={canManagePayments}
                onRecordRemittancePayment={onRecordPayment}
                canManageProductActions={canManageProductActions}
                onViewProductAction={onViewProductAction}
                onApproveProductAction={onApproveProductAction}
                onRejectProductAction={onRejectProductAction}
                onCompleteProductAction={onCompleteProductAction}
                onViewProductActionReceipt={onViewProductActionReceipt}
                onReviewProductRequest={onReviewProductRequest}
                resolveProductImage={resolveProductImage}
                formatProductId={formatProductId}
                formatPeso={formatPeso}
                formatDate={formatDate}
                formatDateTime={formatDateTime}
                processorName={processorName}
                onGenerateReport={() =>
                  setShowSupplierReportModal(true)
                }
              />
            </div>

            <div className="supplier-modal-footer supplier-enterprise-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>

      {showSupplierReportModal &&
        typeof document !== "undefined" &&
        createPortal(
          <SupplierOverallReportModal
            supplier={supplier}
            summary={summary}
            products={products}
            deliveries={deliveries}
            payables={payables}
            payments={payments}
            remittances={remittances}
            consignments={consignments}
            productActions={productActions}
            productRequests={productRequests}
            formatPeso={formatPeso}
            formatDate={formatDate}
            onClose={() =>
              setShowSupplierReportModal(false)
            }
          />,
          document.body
        )}
    </div>
  );
}

function SupplierHeroMetric({
  icon,
  label,
  value,
  detail,
}) {
  return (
    <div className="supplier-enterprise-kpi">
      <div className="supplier-enterprise-kpi-icon">
        {icon}
      </div>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function getSupplierProfileGroup(activeTab) {
  if (
    ["products", "product_proposals", "consignments"].includes(
      activeTab
    )
  ) {
    return "products";
  }

  if (activeTab === "deliveries") {
    return "deliveries";
  }

  if (
    ["payables", "payments", "remittances"].includes(
      activeTab
    )
  ) {
    return "finance";
  }

  if (activeTab === "product_actions") {
    return "requests";
  }

  return "overview";
}

function SupplierProfileTabs({
  activeTab,
  setActiveTab,
  products,
  deliveries,
  payables,
  payments,
  remittances,
  consignments,
  productActions,
  productRequests = [],
}) {
  const activeGroup =
    getSupplierProfileGroup(activeTab);

  const groups = [
    {
      id: "overview",
      label: "Overview",
      icon: Building2,
      count: null,
      defaultTab: "overview",
    },
    {
      id: "products",
      label: "Products",
      icon: Package,
      count:
        products.length +
        productRequests.length +
        consignments.length,
      defaultTab: "products",
    },
    {
      id: "deliveries",
      label: "Deliveries",
      icon: Truck,
      count: deliveries.length,
      defaultTab: "deliveries",
    },
    {
      id: "finance",
      label: "Finance",
      icon: WalletCards,
      count:
        payables.length +
        payments.length +
        remittances.length,
      defaultTab: "payables",
    },
    {
      id: "requests",
      label: "Requests",
      icon: FileText,
      count: productActions.length,
      defaultTab: "product_actions",
    },
  ];

  return (
    <nav
      className="supplier-business-tabs supplier-enterprise-main-tabs"
      aria-label="Supplier profile sections"
    >
      {groups.map((group) => {
        const Icon = group.icon;
        const isActive =
          activeGroup === group.id;

        return (
          <button
            key={group.id}
            type="button"
            className={isActive ? "active" : ""}
            onClick={() =>
              setActiveTab(group.defaultTab)
            }
          >
            <Icon size={17} />
            {group.label}

            {group.count !== null &&
              group.count > 0 && (
                <span>{group.count}</span>
              )}
          </button>
        );
      })}
    </nav>
  );
}

function SupplierProfileSubTabs({
  activeGroup,
  activeTab,
  setActiveTab,
  products,
  productRequests,
  consignments,
  payables,
  payments,
  remittances,
  productActions,
}) {
  const configs = {
    products: [
      {
        id: "products",
        label: "Active Products",
        count: products.length,
      },
      {
        id: "product_proposals",
        label: "Add New Product",
        count: productRequests.length,
      },
      {
        id: "consignments",
        label: "Consignment",
        count: consignments.length,
      },
    ],
    finance: [
      {
        id: "payables",
        label: "Payables",
        count: payables.length,
      },
      {
        id: "payments",
        label: "Payments",
        count: payments.length,
      },
      {
        id: "remittances",
        label: "Remittances",
        count: remittances.length,
      },
    ],
    requests: [
      {
        id: "product_actions",
        label: "Product Actions",
        count: productActions.length,
      },
    ],
  };

  const tabs = configs[activeGroup] || [];

  if (tabs.length <= 1) {
    return null;
  }

  return (
    <div className="supplier-enterprise-subtabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={
            activeTab === tab.id ? "active" : ""
          }
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}

          {tab.count > 0 && (
            <span>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function SupplierProfileContent({
  activeTab,
  supplier,
  summary,
  products,
  deliveries,
  payables,
  payments,
  remittances,
  consignments,
  productActions,
  productRequests = [],
  productRequestSummary = {},
  canManagePayables = false,
  onRecordPayablePayment,
  canManageRemittances = false,
  onRecordRemittancePayment,
  canManageProductActions,
  onViewProductAction,
  onApproveProductAction,
  onRejectProductAction,
  onCompleteProductAction,
  onViewProductActionReceipt,
  onReviewProductRequest,
  onAddVariant: onAddVariantHandler = null,
  resolveProductImage,
  formatProductId,
  formatPeso,
  formatDate,
  formatDateTime,
  processorName = "",
  onGenerateReport,
}) {
  const PROFILE_PAGE_SIZE = 10;
  const [profilePage, setProfilePage] = useState(1);

  useEffect(() => {
    setProfilePage(1);
  }, [activeTab, supplier?.vendor_id]);

  const profileRecords = useMemo(() => {
    const recordsByTab = {
      products: Array.isArray(products) ? products : [],
      deliveries: Array.isArray(deliveries) ? deliveries : [],
      product_proposals: Array.isArray(productRequests) ? productRequests : [],
      payables: Array.isArray(payables) ? payables : [],
      payments: Array.isArray(payments) ? payments : [],
      remittances: Array.isArray(remittances) ? remittances : [],
      product_actions: Array.isArray(productActions) ? productActions : [],
      consignments: Array.isArray(consignments) ? consignments : [],
    };

    return recordsByTab[activeTab] || [];
  }, [
    activeTab,
    products,
    deliveries,
    productRequests,
    payables,
    payments,
    remittances,
    productActions,
    consignments,
  ]);

  const profileTotalPages = Math.max(
    1,
    Math.ceil(profileRecords.length / PROFILE_PAGE_SIZE)
  );

  const safeProfilePage = Math.min(
    profileTotalPages,
    Math.max(1, profilePage)
  );

  const paginatedProfileRecords = useMemo(() => {
    const start = (safeProfilePage - 1) * PROFILE_PAGE_SIZE;
    return profileRecords.slice(start, start + PROFILE_PAGE_SIZE);
  }, [profileRecords, safeProfilePage]);

  const profileItemLabels = {
    products: "products",
    deliveries: "deliveries",
    product_proposals: "proposals",
    payables: "payables",
    payments: "payments",
    remittances: "remittances",
    product_actions: "product actions",
    consignments: "consignments",
  };

  if (activeTab === "overview") {
    return (
      <SupplierOverviewContent
        supplier={supplier}
        summary={summary}
        deliveries={deliveries}
        payments={payments}
        remittances={remittances}
        productRequests={productRequests}
        productActions={productActions}
        products={products}
        payables={payables}
        consignments={consignments}
        formatPeso={formatPeso}
        formatDate={formatDate}
        formatDateTime={formatDateTime}
        onGenerateReport={onGenerateReport}
      />
    );
  }

  let tableContent = null;

  if (activeTab === "products") {
    tableContent = (
      <SupplierProductsTable
        products={paginatedProfileRecords}
        formatProductId={formatProductId}
        formatPeso={formatPeso}
        formatDate={formatDate}
      />
    );
  } else if (activeTab === "deliveries") {
    tableContent = (
      <SupplierDeliveriesTable
        supplier={supplier}
        deliveries={paginatedProfileRecords}
        formatPeso={formatPeso}
        formatDate={formatDate}
      />
    );
  } else if (activeTab === "product_proposals") {
    tableContent = (
      <AdminSupplierProductProposalTable
        requests={paginatedProfileRecords}
        summary={productRequestSummary}
        formatPeso={formatPeso}
        formatDate={formatDate}
        resolveProductImage={resolveProductImage}
        onReview={onReviewProductRequest}
      />
    );
  } else if (activeTab === "payables") {
    tableContent = (
      <SupplierPayablesTable
        supplier={supplier}
        payables={paginatedProfileRecords}
        canManage={canManagePayables}
        onRecordPayment={onRecordPayablePayment}
        formatPeso={formatPeso}
        formatDate={formatDate}
        processorName={processorName}
      />
    );
  } else if (activeTab === "payments") {
    tableContent = (
      <SupplierPaymentsTable
        supplier={supplier}
        payments={paginatedProfileRecords}
        formatPeso={formatPeso}
        formatDate={formatDate}
        processorName={processorName}
      />
    );
  } else if (activeTab === "remittances") {
    tableContent = (
      <SupplierRemittanceTable
        supplier={supplier}
        remittances={paginatedProfileRecords}
        payments={payments}
        canManage={canManageRemittances}
        onRecordPayment={onRecordRemittancePayment}
        formatPeso={formatPeso}
        formatDate={formatDate}
        processorName={processorName}
      />
    );
  } else if (activeTab === "product_actions") {
    tableContent = (
      <ProductActionTable
        supplier={supplier}
        requests={paginatedProfileRecords}
        canManage={canManageProductActions}
        formatDate={formatDate}
        onView={onViewProductAction}
        onApprove={onApproveProductAction}
        onReject={onRejectProductAction}
        onComplete={onCompleteProductAction}
        onViewReceipt={onViewProductActionReceipt}
      />
    );
  } else {
    tableContent = (
      <SupplierConsignmentTable
        supplier={supplier}
        consignments={paginatedProfileRecords}
        formatDate={formatDate}
        processorName={processorName}
      />
    );
  }

  return (
    <>
      {tableContent}
      <PaginationBar
        totalItems={profileRecords.length}
        currentPage={safeProfilePage}
        pageSize={PROFILE_PAGE_SIZE}
        onPageChange={setProfilePage}
        itemLabel={profileItemLabels[activeTab] || "records"}
      />
    </>
  );
}

function SupplierOverviewContent({
  supplier,
  summary,
  products = [],
  deliveries = [],
  payables = [],
  payments = [],
  remittances = [],
  consignments = [],
  productRequests = [],
  productActions = [],
  formatPeso,
  formatDate,
  formatDateTime,
  onGenerateReport,
}) {
  const activity = useMemo(() => {
    const items = [];

    productRequests.forEach((request) => {
      items.push({
        key: `proposal-${request.request_id}`,
        type: "Product proposal",
        title:
          request.product_name ||
          request.request_no ||
          "Product proposal",
        meta: request.request_no || "",
        status: request.status || "Pending",
        date:
          request.updated_at ||
          request.reviewed_at ||
          request.created_at,
        icon: Package,
      });
    });

    deliveries.forEach((delivery) => {
      items.push({
        key: `delivery-${delivery.delivery_id}`,
        type: "Delivery",
        title:
          delivery.delivery_order_no ||
          "Delivery record",
        meta:
          delivery.status === "Delivered"
            ? "Delivery completed"
            : delivery.status || "Delivery",
        status: delivery.status || "",
        date:
          delivery.received_at ||
          delivery.processed_at ||
          delivery.updated_at ||
          delivery.delivery_date ||
          delivery.created_at,
        icon: Truck,
      });
    });

    payments.forEach((payment) => {
      items.push({
        key: `payment-${payment.supplier_payment_id}`,
        type: "Payment",
        title:
          payment.payment_no ||
          "Payment recorded",
        meta: formatPeso(
          payment.amount_paid || 0
        ),
        status: "",
        date:
          payment.payment_date ||
          payment.created_at,
        icon: Banknote,
      });
    });

    remittances.forEach((remittance) => {
      items.push({
        key: `remittance-${remittance.remittance_order_id}`,
        type: "Remittance",
        title:
          remittance.remittance_no ||
          remittance.remittance_order_no ||
          "Remittance",
        meta: formatPeso(
          remittance.total_amount || 0
        ),
        status:
          remittance.status || "",
        date:
          remittance.release_date ||
          remittance.created_at,
        icon: ReceiptText,
      });
    });

    productActions.forEach((request) => {
      items.push({
        key: `action-${request.request_id}`,
        type:
          request.action_type ||
          "Product request",
        title:
          request.request_no ||
          "Product action request",
        meta:
          request.product_name || "",
        status: request.status || "",
        date:
          request.updated_at ||
          request.created_at,
        icon: FileText,
      });
    });

    return items
      .filter((item) => item.date)
      .sort((a, b) => {
        const aDate = new Date(
          String(a.date).replace(" ", "T")
        );
        const bDate = new Date(
          String(b.date).replace(" ", "T")
        );

        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 5);
  }, [
    deliveries,
    payments,
    remittances,
    productRequests,
    productActions,
    formatPeso,
  ]);

  return (
    <>
      <div className="supplier-overview-report-bar">
        <div>
          <strong>
            Supplier Overall Report
          </strong>

          <span>
            Print all supplier activity or customize the report by record type and date range.
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onGenerateReport}
        >
          <Printer size={16} />
          Generate Report
        </button>
      </div>

      <div className="supplier-enterprise-overview">
      <div className="supplier-enterprise-overview-main">
        <div className="supplier-overview-content supplier-enterprise-overview-cards">
          <div className="supplier-overview-panel">
            <div className="supplier-enterprise-panel-heading">
              <Package size={18} />
              <h3>Business Activity</h3>
            </div>

            <div className="supplier-overview-metrics">
              <MetricRow
                label="Total products linked"
                value={summary.product_count}
              />

              <MetricRow
                label="Total delivery records"
                value={summary.delivery_count}
              />

              <MetricRow
                label="Total delivered quantity"
                value={`${Number(
                  summary.total_delivered_quantity || 0
                ).toLocaleString("en-PH")} units`}
              />

              <MetricRow
                label="Last delivery"
                value={formatDate(
                  summary.last_delivery_date
                )}
              />
            </div>
          </div>

          <div className="supplier-overview-panel">
            <div className="supplier-enterprise-panel-heading">
              <WalletCards size={18} />
              <h3>Payment Position</h3>
            </div>

            <div className="supplier-overview-metrics">
              <MetricRow
                label="Total payable"
                value={formatPeso(summary.total_payable)}
              />

              <MetricRow
                label="Total paid"
                value={formatPeso(summary.total_paid)}
              />

              <MetricRow
                label="Outstanding balance"
                value={formatPeso(
                  summary.outstanding_balance
                )}
                important
              />

              <MetricRow
                label="Ready for payment"
                value={formatPeso(
                  summary.ready_for_payment
                )}
                success
              />
            </div>
          </div>

          <div className="supplier-overview-panel">
            <div className="supplier-enterprise-panel-heading">
              <Truck size={18} />
              <h3>Operational Status</h3>
            </div>

            <div className="supplier-overview-metrics">
              <MetricRow
                label="Pending deliveries"
                value={summary.pending_deliveries}
              />

              <MetricRow
                label="In transit deliveries"
                value={summary.in_transit_deliveries}
              />

              <MetricRow
                label="Completed deliveries"
                value={summary.delivered_deliveries}
              />

              <MetricRow
                label="Consignment products"
                value={summary.consignment_count}
              />
            </div>
          </div>
        </div>

        <section className="supplier-enterprise-info-card">
          <div className="supplier-enterprise-panel-heading">
            <Building2 size={18} />
            <h3>Supplier Information</h3>
          </div>

          <div className="supplier-enterprise-info-grid">
            <SupplierEnterpriseInfo
              icon={<UserRound size={16} />}
              label="Contact Person"
              value={
                supplier?.contact_person ||
                "Not provided"
              }
            />

            <SupplierEnterpriseInfo
              icon={<Building2 size={16} />}
              label="Business Name"
              value={
                supplier?.vendor_name ||
                "Not provided"
              }
            />

            <SupplierEnterpriseInfo
              icon={<Phone size={16} />}
              label="Phone Number"
              value={
                supplier?.phone ||
                "Not provided"
              }
            />

            <SupplierEnterpriseInfo
              icon={<MapPin size={16} />}
              label="Business Address"
              value={
                supplier?.address ||
                "Not provided"
              }
            />

            <SupplierEnterpriseInfo
              icon={<CalendarDays size={16} />}
              label="Date Registered"
              value={formatDateTime(
                supplier?.created_at
              )}
            />
          </div>
        </section>
      </div>

      <aside className="supplier-enterprise-activity">
        <div className="supplier-enterprise-activity-heading">
          <h3>Recent Activity</h3>
          <span>{activity.length}</span>
        </div>

        {activity.length === 0 ? (
          <div className="supplier-enterprise-activity-empty">
            <History size={22} />
            <strong>No recent activity</strong>
            <span>
              Supplier transactions and requests will appear here.
            </span>
          </div>
        ) : (
          <div className="supplier-enterprise-activity-list">
            {activity.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  className="supplier-enterprise-activity-item"
                  key={item.key}
                >
                  <div className="supplier-enterprise-activity-icon">
                    <Icon size={17} />
                  </div>

                  <div className="supplier-enterprise-activity-copy">
                    <strong>{item.type}</strong>
                    <span>{item.title}</span>

                    {item.meta && (
                      <small>{item.meta}</small>
                    )}

                    <small>
                      {formatDateTime(item.date)}
                    </small>
                  </div>

                  {item.status && (
                    <span className="supplier-enterprise-activity-status">
                      {item.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
    </>
  );
}

function SupplierEnterpriseInfo({
  icon,
  label,
  value,
}) {
  return (
    <div className="supplier-enterprise-info-item">
      <div className="supplier-enterprise-info-icon">
        {icon}
      </div>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function AdminSupplierProductProposalTable({
  requests = [],
  summary = {},
  formatPeso,
  formatDate,
  resolveProductImage,
  onReview,
}) {
  const pending = Number(
    summary.pending_requests || 0
  );

  return (
    <div
      className="supplier-products-request-layout"
      style={{ gap: 16 }}
    >
      <div className="supplier-product-request-toolbar">
        <div>
          <strong>
            Add New Product
          </strong>
          <span>
            Review new products added for this supplier before they become authorized BFATC catalog products.
          </span>
        </div>

        <div className="supplier-product-request-toolbar-actions">
          <div className="supplier-product-request-counters">
            <span>
              Pending
              <b>{pending}</b>
            </span>

            <span>
              Approved
              <b>
                {Number(
                  summary.approved_requests ||
                    0
                )}
              </b>
            </span>

            <span>
              Declined
              <b>
                {Number(
                  summary.rejected_requests ||
                    0
                )}
              </b>
            </span>
          </div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="supplier-product-request-empty">
          <FileText size={26} />

          <div>
            <strong>
              No product proposals
            </strong>

            <span>
              Product proposals submitted by this supplier will appear here for Admin/Staff review.
            </span>
          </div>
        </div>
      ) : (
        <div className="supplier-product-request-table-wrap">
          <table className="supplier-product-request-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Request</th>
                <th>Category / Unit</th>
                <th>Supplier Price</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => {
                const imageUrl =
                  resolveProductImage?.(
                    request.product_image
                  ) || "";

                return (
                  <tr key={request.request_id}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          minWidth: 190,
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 9,
                            overflow: "hidden",
                            border:
                              "1px solid #e5e7eb",
                            background:
                              "#f8fafc",
                            display: "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            flexShrink: 0,
                          }}
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={
                                request.product_name ||
                                "Proposed product"
                              }
                              style={{
                                width:
                                  "100%",
                                height:
                                  "100%",
                                objectFit:
                                  "cover",
                              }}
                            />
                          ) : (
                            <Package
                              size={20}
                            />
                          )}
                        </div>

                        <div>
                          <strong>
                            {request.product_name ||
                              "Unnamed Product"}
                          </strong>

                          <small>
                            {request.requested_sku ||
                              "SKU to be finalized"}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <strong>
                        {request.request_no}
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {request.category_name ||
                          "Uncategorized"}
                      </strong>

                      <small>
                        {request.unit_type ||
                          "pcs"}
                      </small>
                    </td>

                    <td>
                      {formatPeso(
                        request.supplier_price
                      )}
                    </td>

                    <td>
                      <span
                        className={`supplier-product-request-status ${String(
                          request.status ||
                            "Pending"
                        )
                          .toLowerCase()
                          .replace(
                            /[^a-z0-9]+/g,
                            "-"
                          )}`}
                      >
                        {request.status ||
                          "Pending"}
                      </span>
                    </td>

                    <td>
                      {formatDate(
                        String(
                          request.created_at ||
                            ""
                        ).slice(0, 10)
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          onReview?.(request)
                        }
                      >
                        <Eye size={16} />
                        {request.status ===
                        "Pending"
                          ? "Review"
                          : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SupplierProductReviewModal({
  request,
  form,
  saving,
  formatPeso,
  formatDateTime,
  resolveProductImage,
  onChange,
  onApprove,
  onReject,
  onClose,
}) {
  const isPending =
    request?.status === "Pending";

  const imageUrl =
    resolveProductImage?.(
      request?.product_image
    ) || "";

  const variants = Array.isArray(
    request?.variants
  )
    ? request.variants
    : [];

  const selectableVariants =
    variants.filter(
      (variant) =>
        (variant.status || "Pending") ===
        "Pending"
    );

  const selectedVariantIds =
    Array.isArray(
      form.approved_variant_ids
    )
      ? form.approved_variant_ids.map(Number)
      : [];

  const toggleVariant = (
    requestVariantId
  ) => {
    const numericId =
      Number(requestVariantId);

    if (!numericId || saving) {
      return;
    }

    const nextIds =
      selectedVariantIds.includes(
        numericId
      )
        ? selectedVariantIds.filter(
            (id) =>
              id !== numericId
          )
        : [
            ...selectedVariantIds,
            numericId,
          ];

    onChange(
      "approved_variant_ids",
      nextIds
    );
  };

  const selectAllPending = () => {
    onChange(
      "approved_variant_ids",
      selectableVariants
        .map((variant) =>
          Number(
            variant.request_variant_id
          )
        )
        .filter(Boolean)
    );
  };

  const clearSelection = () => {
    onChange(
      "approved_variant_ids",
      []
    );
  };

  return (
    <div className="modal-overlay supplier-modal-overlay">
      <div className="modal-box supplier-product-review-clean-modal supplier-variant-review-modal">
        <div className="supplier-modal-header">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon">
                <FileText size={21} />
              </div>

              <h2>
                Review New Product
              </h2>
            </div>

            <p>
              {request?.request_no} · Review the product family and choose the variants BFATC wants to authorize.
            </p>
          </div>

          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <div className="supplier-product-review-clean-body">
          <section className="supplier-product-review-product">
            <div>
              <div className="supplier-product-review-image">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={
                      request?.product_name ||
                      "Proposed product"
                    }
                  />
                ) : (
                  <Package
                    size={48}
                  />
                )}
              </div>

              <span
                className={`supplier-product-request-status ${String(
                  request?.status ||
                    "Pending"
                )
                  .toLowerCase()
                  .replace(
                    /[^a-z0-9]+/g,
                    "-"
                  )}`}
              >
                {request?.status ||
                  "Pending"}
              </span>
            </div>

            <div className="supplier-product-review-details">
              <h3>
                {request?.product_name ||
                  "Unnamed Product"}
              </h3>

              <div className="supplier-product-review-origin">
                <MapPin size={16} />
                <span>
                  {request?.product_description ||
                    "No product description was provided."}
                </span>
              </div>

              <div className="supplier-product-review-grid">
                <ProposalReviewItem
                  label="Category"
                  value={
                    request?.category_name ||
                    "Uncategorized"
                  }
                />

                <ProposalReviewItem
                  label="Available Variants"
                  value={
                    variants.length > 0
                      ? variants.length
                      : 1
                  }
                />

                <ProposalReviewItem
                  label="Expiry Tracking"
                  value={
                    Number(
                      request?.expiry_required ??
                        1
                    ) === 1
                      ? "Required"
                      : "Not Required"
                  }
                />

                <ProposalReviewItem
                  label="Submitted"
                  value={formatDateTime(
                    request?.created_at
                  )}
                />
              </div>

              <div className="supplier-product-review-remarks">
                <strong>
                  Supplier Remarks
                </strong>

                <p>
                  {request?.supplier_remarks ||
                    "No additional remarks were provided."}
                </p>
              </div>
            </div>
          </section>

          <section className="supplier-review-variant-section">
            <div className="supplier-review-variant-head">
              <div>
                <strong>
                  Available Sizes / Variants
                </strong>
                <span>
                  Select one or more variants BFATC wants to approve.
                </span>
              </div>

              {isPending && (
                <div className="supplier-review-variant-tools">
                  <button
                    type="button"
                    className="supplier-review-link-btn"
                    onClick={selectAllPending}
                    disabled={saving}
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    className="supplier-review-link-btn"
                    onClick={clearSelection}
                    disabled={saving}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="supplier-review-variant-table-wrap">
              <table className="supplier-review-variant-table">
                <thead>
                  <tr>
                    {isPending && (
                      <th>Approve</th>
                    )}
                    <th>Variant</th>
                    <th>Supplier Price</th>
                    <th>Reorder</th>
                    <th>Requested SKU</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {(variants.length > 0
                    ? variants
                    : [
                        {
                          request_variant_id:
                            null,
                          variant_label:
                            "Standard",
                          selling_unit:
                            request?.unit_type ||
                            "pcs",
                          supplier_price:
                            request?.supplier_price ||
                            0,
                          reorder_level:
                            request?.reorder_level ||
                            0,
                          requested_sku:
                            request?.requested_sku ||
                            "",
                          generated_sku:
                            request?.generated_sku ||
                            "",
                          status:
                            request?.status ||
                            "Pending",
                        },
                      ]
                  ).map((variant, index) => {
                      const variantId =
                        Number(
                          variant.request_variant_id
                        );

                      const canSelect =
                        isPending &&
                        variantId &&
                        (variant.status ||
                          "Pending") ===
                          "Pending";

                      const checked =
                        canSelect &&
                        selectedVariantIds.includes(
                          variantId
                        );

                      return (
                        <tr
                          key={
                            variant.request_variant_id ||
                            `legacy-${index}`
                          }
                        >
                          {isPending && (
                            <td>
                              {canSelect ? (
                                <button
                                  type="button"
                                  className={`supplier-review-checkbox ${
                                    checked
                                      ? "checked"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    toggleVariant(
                                      variantId
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                  aria-label={`${
                                    checked
                                      ? "Unselect"
                                      : "Select"
                                  } ${
                                    variant.variant_label ||
                                    "variant"
                                  }`}
                                >
                                  {checked ? (
                                    <CheckSquare
                                      size={18}
                                    />
                                  ) : (
                                    <Square
                                      size={18}
                                    />
                                  )}
                                </button>
                              ) : (
                                <span>
                                  —
                                </span>
                              )}
                            </td>
                          )}

                          <td>
                            <strong>
                              {variant.variant_label ||
                                "Standard"}
                            </strong>
                          </td>

                          <td>
                            {formatPeso(
                              variant.supplier_price
                            )}
                          </td>

                          <td>
                            {Number(
                              variant.reorder_level ||
                                0
                            )}
                          </td>

                          <td>
                            {variant.generated_sku ||
                              variant.requested_sku ||
                              "Auto-generate"}
                          </td>

                          <td>
                            <span
                              className={`supplier-product-request-status ${String(
                                variant.status ||
                                  "Pending"
                              )
                                .toLowerCase()
                                .replace(
                                  /[^a-z0-9]+/g,
                                  "-"
                                )}`}
                            >
                              {variant.status ||
                                "Pending"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {isPending && (
              <div className="supplier-review-selection-summary">
                <CheckCircle2 size={16} />
                <span>
                  <strong>
                    {selectedVariantIds.length}
                  </strong>{" "}
                  of{" "}
                  <strong>
                    {selectableVariants.length}
                  </strong>{" "}
                  pending variant(s) selected
                </span>
              </div>
            )}
          </section>

          {isPending && (
            <label className="supplier-product-field wide supplier-product-review-rejection">
              <span>
                Decline Reason
              </span>

              <div className="supplier-product-review-textarea-wrap">
                <textarea
                  rows={3}
                  maxLength={500}
                  value={
                    form.rejection_reason
                  }
                  onChange={(event) =>
                    onChange(
                      "rejection_reason",
                      event.target.value
                    )
                  }
                  placeholder="Required only when declining the entire proposal."
                />

                <small className="supplier-product-review-counter">
                  {String(
                    form.rejection_reason || ""
                  ).length} / 500
                </small>
              </div>
            </label>
          )}

          {!isPending && (
            <div className="supplier-product-review-result">
              <strong>
                Review Result:
              </strong>{" "}
              {displayStatus(request?.status)}
              {request?.reviewed_by_name
                ? ` · Reviewed by: ${request.reviewed_by_name}`
                : ""}
              {request?.rejection_reason
                ? ` · Reason: ${request.rejection_reason}`
                : ""}
            </div>
          )}
        </div>

        <div className="supplier-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>

          {isPending && (
            <>
              <button
                type="button"
                className="btn supplier-reject-dark-btn"
                onClick={onReject}
                disabled={saving}
              >
                <X size={17} />
                Decline Proposal
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={onApprove}
                disabled={
                  saving ||
                  selectedVariantIds.length ===
                    0
                }
              >
                {saving ? (
                  <LoaderCircle
                    size={17}
                    className="supplier-spinner"
                  />
                ) : (
                  <CheckCircle2
                    size={17}
                  />
                )}
                Approve Selected
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProposalReviewItem({
  label,
  value,
}) {
  return (
    <div className="supplier-product-review-item">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}


function SupplierProductRequestToolbar({
  summary = {},
  onAddProduct,
  onAddVariant,
}) {
  return (
    <div className="supplier-product-request-toolbar">
      <div>
        <strong>Add New Product</strong>
        <span>
          Add a new supplier product for BFATC Admin/Staff review. Once approved, the product becomes available for future delivery submissions.
        </span>
      </div>

      <div className="supplier-product-request-toolbar-actions">
        <div className="supplier-product-request-counters">
          <span>
            Pending
            <b>{Number(summary.pending_requests || 0)}</b>
          </span>

          <span>
            Approved
            <b>{Number(summary.approved_requests || 0)}</b>
          </span>

          <span>
            Declined
            <b>{Number(summary.rejected_requests || 0)}</b>
          </span>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onAddVariant}
        >
          <Plus size={17} />
          Add Variant / Size
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onAddProduct}
        >
          <Plus size={17} />
          Add New Product
        </button>
      </div>
    </div>
  );
}

function SupplierProductRequestList({
  requests = [],
  formatPeso,
  formatDate,
}) {
  if (requests.length === 0) {
    return (
      <div className="supplier-product-request-empty">
        <FileText size={26} />

        <div>
          <strong>No product requests yet</strong>
          <span>
            Use Add Product to submit a product family and its available sizes or variants for BFATC approval.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="supplier-product-request-list">
      <div className="supplier-product-request-list-header">
        <div>
          <strong>My Added Products</strong>
          <span>
            Track product families, offered variants, approvals, and generated SKUs.
          </span>
        </div>
      </div>

      <div className="supplier-product-request-table-wrap">
        <table className="supplier-product-request-table supplier-variant-request-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Product Family</th>
              <th>Available Variants</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>BFATC Review</th>
            </tr>
          </thead>

          <tbody>
            {requests.map((request) => {
              const variants = Array.isArray(
                request.variants
              )
                ? request.variants
                : [];

              return (
                <tr key={request.request_id}>
                  <td>
                    <strong>
                      {request.request_no}
                    </strong>
                    <small>
                      {variants.length > 1
                        ? `${variants.length} variants`
                        : "1 variant"}
                    </small>
                  </td>

                  <td>
                    <strong>
                      {request.product_name}
                    </strong>
                    <small>
                      {request.category_name ||
                        "Uncategorized"}
                    </small>
                    <small>
                      {request.product_description ||
                        "No description"}
                    </small>
                  </td>

                  <td>
                    <div className="supplier-request-variant-stack">
                      {variants.length > 0 ? (
                        variants.map(
                          (variant) => (
                            <div
                              className="supplier-request-variant-summary"
                              key={
                                variant.request_variant_id ||
                                `${request.request_id}-${variant.variant_label}`
                              }
                            >
                              <div>
                                <strong>
                                  {variant.variant_label ||
                                    "Standard"}
                                </strong>

                                <span>
                                  {formatPeso(
                                    variant.supplier_price
                                  )}
                                </span>
                              </div>

                              <div>
                                <span
                                  className={`supplier-product-request-status ${String(
                                    variant.status ||
                                      "Pending"
                                  )
                                    .toLowerCase()
                                    .replace(
                                      /[^a-z0-9]+/g,
                                      "-"
                                    )}`}
                                >
                                  {variant.status ||
                                    "Pending"}
                                </span>

                                <small>
                                  {variant.generated_sku ||
                                    variant.requested_sku ||
                                    "SKU after approval"}
                                </small>
                              </div>
                            </div>
                          )
                        )
                      ) : (
                        <span className="supplier-request-no-variant">
                          Legacy / Standard
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <span
                      className={`supplier-product-request-status ${String(
                        request.status ||
                          "Pending"
                      )
                        .toLowerCase()
                        .replace(
                          /[^a-z0-9]+/g,
                          "-"
                        )}`}
                    >
                      {request.status ||
                        "Pending"}
                    </span>
                  </td>

                  <td>
                    {formatDate(
                      String(
                        request.created_at ||
                          ""
                      ).slice(0, 10)
                    )}
                  </td>

                  <td>
                    {request.rejection_reason ||
                      (request.status ===
                      "Approved"
                        ? `${Number(
                            request.approved_variant_count ||
                              variants.filter(
                                (variant) =>
                                  variant.status ===
                                  "Approved"
                              ).length
                          )} variant(s) approved`
                        : "Awaiting BFATC review")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupplierProductRequestModal({
  form,
  categories,
  imagePreview,
  saving,
  mode = "new_product",
  existingFamily = null,
  existingProducts = [],
  selectedExistingProductId = "",
  onExistingProductChange,
  onChange,
  onAddVariant,
  onUpdateVariant,
  onRemoveVariant,
  onSubmit,
  onClose,
}) {

  const variants = Array.isArray(
    form.variants
  )
    ? form.variants
    : [];

  return (
    <div className="modal-overlay supplier-modal-overlay">
      <div className="modal-box supplier-product-request-modal">
        <div className="supplier-modal-header">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon">
                <Package size={21} />
              </div>

              <h2>
                {mode === "add_variant"
                  ? "Add Product Variant"
                  : "Add New Product"}
              </h2>
            </div>

            <p>
              {mode === "add_variant"
                ? `Add a new size or variant to ${
                    existingFamily?.product_name ||
                    form.product_name ||
                    "this product"
                  }. The existing product family remains unchanged.`
                : "Submit one product family and all sizes or variants your business can supply. BFATC chooses which variants to approve."}
            </p>
          </div>

          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="supplier-product-request-body">
            <div className="supplier-process-note">
              <AlertTriangle size={18} />

              <div>
                <strong>
                  {mode === "add_variant"
                    ? "Existing product family — new variant"
                    : "Product family and variant control"}
                </strong>
                <span>
                  {mode === "add_variant"
                    ? "Only the new size or variant is submitted for BFATC approval. After approval it becomes a separate zero-stock SKU under the same product family."
                    : "Product approval creates zero-stock catalog SKUs only. Each approved size becomes a separate inventory SKU and receives its own delivery batches, expiry dates, stock, and BFATC selling price later."}
                </span>
              </div>
            </div>

            <section className="supplier-form-section">
              <h3>
                {mode === "add_variant"
                  ? "Select Existing Product"
                  : "Product Family"}
              </h3>

              <div className="supplier-product-request-layout">
                <label className="supplier-product-image-uploader">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Product preview"
                    />
                  ) : (
                    <div>
                      <ImagePlus size={28} />
                      <strong>
                        Upload Product Image
                      </strong>
                      <span>
                        JPG, PNG, or WEBP · Maximum 5 MB
                      </span>
                    </div>
                  )}

                  <input
                    type="file"
                    name="product_image"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={onChange}
                    disabled={mode === "add_variant"}
                  />
                </label>

                <div className="supplier-product-request-grid">
                  <label className="supplier-product-field wide">
                    <span>
                      {mode === "add_variant"
                        ? "Existing Product"
                        : "Product Name"}{" "}
                      <b>*</b>
                    </span>

                    {mode === "add_variant" ? (
                      <select
                        value={selectedExistingProductId}
                        onChange={onExistingProductChange}
                      >
                        <option value="">
                          Select approved product
                        </option>

                        {existingProducts.map(
                          (product) => (
                            <option
                              key={product.product_id}
                              value={product.product_id}
                            >
                              {product.product_name}
                              {product.variant_label
                                ? ` — ${product.variant_label}`
                                : ""}
                              {product.sku
                                ? ` (${product.sku})`
                                : ""}
                            </option>
                          )
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="product_name"
                        value={form.product_name}
                        onChange={onChange}
                        placeholder="Example: Peanut Butter"
                        maxLength={150}
                      />
                    )}
                  </label>

                  <label className="supplier-product-field wide">
                    <span>
                      Category <b>*</b>
                    </span>

                    <select
                      name="category_id"
                      value={form.category_id}
                      onChange={onChange}
                      disabled={mode === "add_variant"}
                    >
                      <option value="">
                        Select category
                      </option>

                      {categories.map(
                        (category) => (
                          <option
                            key={
                              category.category_id
                            }
                            value={
                              category.category_id
                            }
                          >
                            {
                              category.category_name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="supplier-form-section supplier-variant-section">
              <div className="supplier-variant-section-head">
                <div>
                  <h3>
                    {mode === "add_variant"
                      ? "New Size / Variant"
                      : "Available Sizes / Variants"}
                  </h3>
                  <p>
                    Enter the complete size or variant as one label, such as <strong>250 ml</strong>, <strong>500 ml</strong>, <strong>Small</strong>, or <strong>Standard</strong>.
                  </p>
                </div>

                {mode !== "add_variant" && (
                  <button
                    type="button"
                    className="btn btn-secondary supplier-add-variant-btn"
                    onClick={onAddVariant}
                    disabled={saving}
                  >
                    <Plus size={16} />
                    Add Variant
                  </button>
                )}
              </div>

              <div className="supplier-variant-card-list">
                {variants.map((variant, index) => (
                  <div
                    className="supplier-variant-card"
                    key={index}
                  >
                    <div className="supplier-variant-card-head">
                      <div>
                        <strong>
                          Variant {index + 1}
                        </strong>
                        <span>
                          {variant.variant_label?.trim() ||
                            "Enter size / variant"}
                        </span>
                      </div>

                      {mode !== "add_variant" && (
                        <button
                          type="button"
                          className="supplier-remove-variant-btn"
                          onClick={() =>
                            onRemoveVariant(index)
                          }
                          disabled={
                            saving ||
                            variants.length <= 1
                          }
                          title="Remove variant"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    <div className="supplier-variant-form-grid">
                      <label className="supplier-product-field">
                        <span>
                          Size / Variant <b>*</b>
                        </span>

                        <input
                          type="text"
                          value={variant.variant_label}
                          onChange={(event) =>
                            onUpdateVariant(
                              index,
                              "variant_label",
                              event.target.value
                            )
                          }
                          placeholder="Example: 250 ml, 500 ml, Small, Standard"
                          maxLength={80}
                        />
                      </label>

                      <label className="supplier-product-field">
                        <span>
                          Supplier Price <b>*</b>
                        </span>

                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={variant.supplier_price}
                          onChange={(event) =>
                            onUpdateVariant(
                              index,
                              "supplier_price",
                              event.target.value
                            )
                          }
                          placeholder="0.00"
                        />
                      </label>

                      <label className="supplier-product-field">
                        <span>Reorder Level</span>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={variant.reorder_level}
                          onChange={(event) =>
                            onUpdateVariant(
                              index,
                              "reorder_level",
                              event.target.value
                            )
                          }
                          placeholder="5"
                        />
                      </label>

                      <label className="supplier-product-field">
                        <span>Requested SKU</span>

                        <input
                          type="text"
                          value={variant.requested_sku}
                          onChange={(event) =>
                            onUpdateVariant(
                              index,
                              "requested_sku",
                              event.target.value.toUpperCase()
                            )
                          }
                          placeholder="Optional — BFATC can auto-generate"
                          maxLength={100}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="supplier-variant-footnote">
                <Package size={16} />
                <span>
                  Example: Peanut Butter can have 250 ml at ₱45 and 500 ml at ₱70. Size information is taken directly from the variant label, and BFATC may approve one or multiple variants.
                </span>
              </div>
            </section>

            <section className="supplier-form-section">
              <h3>Expiration and Product Details</h3>

              <div className="supplier-product-request-grid">
                <label className="supplier-product-field wide">
                  <span>
                    Expiration Tracking
                  </span>

                  <select
                    name="expiry_required"
                    value={
                      form.expiry_required
                    }
                    onChange={onChange}
                  >
                    <option value="1">
                      Required — expiry date is entered for each delivery batch
                    </option>
                    <option value="0">
                      Not Required — non-expiring product
                    </option>
                  </select>
                </label>

                <label className="supplier-product-field wide">
                  <span>
                    Product Description
                  </span>

                  <textarea
                    name="product_description"
                    value={
                      form.product_description
                    }
                    onChange={onChange}
                    placeholder="Describe the product family, packaging, ingredients, or important information."
                    maxLength={2000}
                  />
                </label>

                <label className="supplier-product-field wide">
                  <span>
                    Supplier Remarks
                  </span>

                  <textarea
                    name="supplier_remarks"
                    value={
                      form.supplier_remarks
                    }
                    onChange={onChange}
                    placeholder="Add notes for BFATC reviewers."
                    maxLength={2000}
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="supplier-modal-footer">
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
                <>
                  <LoaderCircle
                    size={17}
                    className="supplier-spinner"
                  />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={17} />
                  {mode === "add_variant"
                    ? "Submit Variant"
                    : "Submit Product"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplierProductsTable({
  products,
  formatProductId,
  formatPeso,
  formatDate,
}) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="No linked products yet"
        message="Products appear automatically after this supplier is selected in Delivery Management."
      />
    );
  }

  return (
    <BusinessTable
      className="supplier-products-table"
      headings={[
        "Product ID",
        "Product",
        "Category",
        "Current Stock",
        "Supplier Price",
        "Retail Price",
        "Deliveries",
        "Last Delivery",
        "Expiry",
      ]}
    >
      {products.map((product) => (
        <tr key={product.product_id}>
          <td>
            <strong>
              {formatProductId(
                product.product_id
              )}
            </strong>
          </td>

          <td>
            <div className="supplier-product-name">
              <span>{product.sku}</span>
              <strong>
                {product.product_name}
              </strong>
              <small>
                Variant:{" "}
                {product.variant_label ||
                  "Standard"}
              </small>
            </div>
          </td>

          <td>
            {product.category ||
              "Uncategorized"}
          </td>

          <td>
            {Number(
              product.current_stock || 0
            )}{" "}
            {product.unit_type ||
              product.unit ||
              "pcs"}
          </td>

          <td>
            {formatPeso(
              product.supplier_price
            )}
          </td>

          <td>
            {formatPeso(
              product.selling_price
            )}
          </td>

          <td>
            {Number(
              product.delivery_frequency ||
                0
            )}
          </td>

          <td>
            {formatDate(
              product.last_delivery_date
            )}
          </td>

          <td>
            {product.expiry_date
              ? formatDate(
                  product.expiry_date
                )
              : "No expiry"}
          </td>

        </tr>
      ))}
    </BusinessTable>
  );
}

function SupplierDeliveriesTable({
  supplier,
  deliveries,
  formatPeso,
  formatDate,
}) {
  if (deliveries.length === 0) {
    return (
      <EmptyState
        title="No delivery records"
        message="Supplier deliveries will appear here automatically."
      />
    );
  }

  return (
    <BusinessTable
      className="supplier-deliveries-table"
      headings={[
        "Delivery No.",
        "Date",
        "Product Lines",
        "Quantity",
        "Supplier Payable",
        "Retail Value",
        "Status",
        "Received By",
        "Actions",
      ]}
    >
      {deliveries.map((delivery) => (
        <tr key={delivery.delivery_id}>
          <td>
            <strong>
              {delivery.delivery_order_no}
            </strong>
          </td>

          <td>
            {formatDate(
              delivery.delivery_date
            )}
          </td>

          <td>
            {Number(
              delivery.product_line_count ||
                0
            )}
          </td>

          <td>
            {Number(
              delivery.delivered_quantity ||
                delivery.items_count ||
                0
            )}
          </td>

          <td>
            {formatPeso(
              delivery.supplier_payable_amount
            )}
          </td>

          <td>
            {formatPeso(delivery.amount)}
          </td>

          <td>
            <StatusBadge
              value={delivery.status}
            />
          </td>

          <td>
            {delivery.received_by ||
              "Not provided"}
          </td>

          <td>
            <button
              type="button"
              className="supplier-action-btn"
              onClick={() =>
                printSupplierDeliveryReceipt({
                  supplier,
                  delivery,
                  formatPeso,
                  formatDate,
                })
              }
            >
              <Printer size={14} />
              Print Receipt
            </button>
          </td>
        </tr>
      ))}
    </BusinessTable>
  );
}

function SupplierPayablesTable({
  supplier,
  payables,
  canManage = false,
  onRecordPayment,
  formatPeso,
  formatDate,
  processorName = "",
}) {
  if (payables.length === 0) {
    return (
      <EmptyState
        title="No supplier payables"
        message="A payable is created automatically when a delivery is confirmed as Delivered."
      />
    );
  }

  return (
    <BusinessTable
      className="supplier-payables-table"
      headings={[
        "Delivery",
        "Delivery Date",
        "Payable",
        "Paid",
        "Balance",
        "Due Date",
        "Payment Status",
        "Receipt",
        ...(canManage ? ["Actions"] : []),
      ]}
    >
      {payables.map((payable) => (
        <tr key={payable.payable_id}>
          <td>
            <strong>
              {payable.delivery_order_no ||
                `Delivery ${payable.delivery_id}`}
            </strong>
          </td>

          <td>
            {formatDate(
              payable.delivery_date
            )}
          </td>

          <td>
            {formatPeso(
              payable.payable_amount
            )}
          </td>

          <td>
            {formatPeso(
              payable.paid_amount
            )}
          </td>

          <td>
            <strong>
              {formatPeso(
                payable.balance_amount
              )}
            </strong>
          </td>

          <td>
            {payable.due_date
              ? formatDate(
                  payable.due_date
                )
              : "Not specified"}
          </td>

          <td>
            <PaymentStatusBadge
              status={
                payable.payment_status
              }
              overdue={
                Number(
                  payable.is_overdue || 0
                ) === 1
              }
            />
          </td>

          <td>
            {}
            {Number(payable.paid_amount || 0) > 0 ? (
              <button
                type="button"
                className="supplier-action-btn"
                onClick={() =>
                  printSupplierTransactionReceipt({
                    supplier,
                    title:
                      "Supplier Payable Receipt",
                    reference:
                      payable.delivery_order_no ||
                      `Payable ${payable.payable_id}`,
                    preparedBy:
                      payable.prepared_by_name ||
                      payable.prepared_by ||
                      payable.processed_by_name ||
                      payable.processed_by ||
                      processorName,
                    fields: [
                      {
                        label: "Delivery Date",
                        value: formatDate(
                          payable.delivery_date
                        ),
                      },
                      {
                        label: "Payable Amount",
                        value: formatPeso(
                          payable.payable_amount ||
                            0
                        ),
                      },
                      {
                        label: "Paid Amount",
                        value: formatPeso(
                          payable.paid_amount ||
                            0
                        ),
                      },
                      {
                        label: "Balance",
                        value: formatPeso(
                          payable.balance_amount ||
                            0
                        ),
                      },
                      {
                        label: "Due Date",
                        value:
                          payable.due_date
                            ? formatDate(
                                payable.due_date
                              )
                            : "Not specified",
                      },
                      {
                        label: "Payment Status",
                        value:
                          payable.payment_status ||
                          "N/A",
                      },
                    ],
                  })
                }
              >
                <Printer size={14} />
                Print Receipt
              </button>
            ) : (
              <span
                style={{
                  color: "#6b7280",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                No Receipt Yet
              </span>
            )}
          </td>

          {canManage && (
            <td>
              {Number(
                payable.balance_amount || 0
              ) > 0 &&
              payable.payment_status !==
                "Cancelled" ? (
                <button
                  type="button"
                  className="supplier-action-btn payment"
                  onClick={() =>
                    onRecordPayment?.(
                      payable
                    )
                  }
                >
                  <CreditCard size={15} />
                  Record Payment
                </button>
              ) : (
                <span
                  style={{
                    color: "#16a34a",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  Settled
                </span>
              )}
            </td>
          )}
        </tr>
      ))}
    </BusinessTable>
  );
}

function SupplierPaymentsTable({
  supplier,
  payments,
  formatPeso,
  formatDate,
  processorName = "",
}) {
  if (payments.length === 0) {
    return (
      <EmptyState
        title="No released payments"
        message="Released supplier payments will appear here automatically."
      />
    );
  }

  return (
    <BusinessTable
      className="supplier-payments-table"
      headings={[
        "Payment No.",
        "Payment Date",
        "Amount Paid",
        "Method",
        "Reference",
        "Received By",
        "Processed By",
        "Receipt",
      ]}
    >
      {payments.map((payment) => (
        <tr
          key={payment.supplier_payment_id}
        >
          <td>
            <strong>
              {payment.payment_no}
            </strong>
          </td>

          <td>
            {formatDate(
              payment.payment_date
            )}
          </td>

          <td>
            <strong>
              {formatPeso(
                payment.amount_paid
              )}
            </strong>
          </td>

          <td>
            {payment.payment_method ||
              "Not provided"}
          </td>

          <td>
            {payment.reference_number ||
              "N/A"}
          </td>

          <td>
            {payment.received_by ||
              "Not provided"}
          </td>

          <td>
            {payment.processed_by ||
              "Not provided"}
          </td>

          <td>
            <button
              type="button"
              className="supplier-action-btn"
              onClick={() =>
                printSupplierTransactionReceipt({
                  supplier,
                  title:
                    "Supplier Payment Receipt",
                  reference:
                    payment.payment_no ||
                    `Payment ${payment.supplier_payment_id}`,
                  preparedBy:
                    payment.processed_by_name ||
                    payment.processed_by ||
                    payment.received_by_name ||
                    payment.received_by ||
                    processorName,
                  fields: [
                    {
                      label: "Payment Date",
                      value: formatDate(
                        payment.payment_date
                      ),
                    },
                    {
                      label: "Amount Paid",
                      value: formatPeso(
                        payment.amount_paid ||
                          0
                      ),
                    },
                    {
                      label: "Payment Method",
                      value:
                        payment.payment_method ||
                        "Not provided",
                    },
                    {
                      label: "Reference",
                      value:
                        payment.reference_number ||
                        "N/A",
                    },
                    {
                      label: "Received By",
                      value:
                        payment.received_by ||
                        "Not provided",
                    },
                  ],
                })
              }
            >
              <Printer size={14} />
              Print Receipt
            </button>
          </td>
        </tr>
      ))}
    </BusinessTable>
  );
}

function SupplierRemittanceTable({
  supplier,
  remittances,
  payments = [],
  canManage = false,
  onRecordPayment,
  formatPeso,
  formatDate,
  processorName = "",
}) {
  const getRemittancePaymentState = (remittance) => {
    const remittanceId = Number(
      remittance?.remittance_order_id || 0
    );

    const totalAmount = Math.max(
      0,
      Number(remittance?.total_amount || 0)
    );

    const paidAmount = (Array.isArray(payments)
      ? payments
      : []
    )
      .filter(
        (payment) =>
          Number(payment?.remittance_order_id || 0) ===
          remittanceId
      )
      .reduce(
        (sum, payment) =>
          sum + Math.max(
            0,
            Number(payment?.amount_paid || 0)
          ),
        0
      );

    const remainingBalance = Math.max(
      0,
      totalAmount - paidAmount
    );

    const fullyPaid =
      totalAmount > 0 &&
      remainingBalance <= 0.005;

    const partiallyPaid =
      paidAmount > 0 &&
      !fullyPaid;

    return {
      paidAmount,
      remainingBalance,
      fullyPaid,
      displayStatus: fullyPaid
        ? "Paid"
        : partiallyPaid
        ? "Partially Paid"
        : remittance?.status || "Released",
    };
  };

  if (remittances.length === 0) {
    return (
      <EmptyState
        title="No remittance orders"
        message="Created remittance orders and released payments will appear here."
      />
    );
  }

  return (
    <BusinessTable
      className="supplier-remittance-table"
      headings={[
        "Remittance No.",
        "Amount",
        "Status",
        "Release Date",
        "Prepared By",
        "Approved By",
        "Reference",
        "Actions",
      ]}
    >
      {remittances.map((remittance) => (
        <tr
          key={
            remittance.remittance_order_id
          }
        >
          <td>
            <strong>
              {
                remittance.remittance_order_no
              }
            </strong>
          </td>

          <td>
            {formatPeso(
              remittance.total_amount
            )}
          </td>

          <td>
            <PaymentStatusBadge
              status={
                getRemittancePaymentState(
                  remittance
                ).displayStatus
              }
            />
          </td>

          <td>
            {remittance.release_date
              ? formatDate(
                  remittance.release_date
                )
              : "Not released"}
          </td>

          <td>
            {remittance.prepared_by ||
              "Not provided"}
          </td>

          <td>
            {remittance.approved_by ||
              "Not provided"}
          </td>

          <td>
            {remittance.reference_number ||
              "N/A"}
          </td>

          <td>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {canManage &&
                getRemittancePaymentState(
                  remittance
                ).remainingBalance > 0.005 &&
                typeof onRecordPayment === "function" && (
                  <button
                    type="button"
                    className="supplier-action-btn payment"
                    onClick={() =>
                      onRecordPayment(remittance)
                    }
                  >
                    <CreditCard size={15} />
                    Record Payment
                  </button>
                )}

            <button
              type="button"
              className="supplier-action-btn"
              onClick={() =>
                printSupplierTransactionReceipt({
                  supplier,
                  title:
                    "Supplier Remittance Receipt",
                  reference:
                    remittance.remittance_order_no ||
                    "Remittance",
                  preparedBy:
                    remittance.prepared_by ||
                    "",
                  fields: [
                    {
                      label: "Amount",
                      value: formatPeso(
                        remittance.total_amount ||
                          0
                      ),
                    },
                    {
                      label: "Status",
                      value:
                        getRemittancePaymentState(
                          remittance
                        ).displayStatus,
                    },
                    {
                      label: "Release Date",
                      value:
                        remittance.release_date
                          ? formatDate(
                              remittance.release_date
                            )
                          : "Not released",
                    },
                    {
                      label: "Approved By",
                      value:
                        remittance.approved_by ||
                        "Not provided",
                    },
                    {
                      label: "Reference",
                      value:
                        remittance.reference_number ||
                        "N/A",
                    },
                  ],
                })
              }
            >
              <Printer size={14} />
              Print Receipt
            </button>
            </div>
          </td>
        </tr>
      ))}
    </BusinessTable>
  );
}

function SupplierConsignmentTable({
  supplier,
  consignments,
  formatDate,
  processorName = "",
}) {
  if (consignments.length === 0) {
    return (
      <EmptyState
        title="No consignment records"
        message="Products marked as consignment during delivery receiving will appear here."
      />
    );
  }

  return (
    <BusinessTable
      className="supplier-consignment-table"
      headings={[
        "Product",
        "Quantity",
        "Start Date",
        "Pull-out Date",
        "Terms",
        "Status",
        "Receipt",
      ]}
    >
      {consignments.map(
        (consignment, index) => (
          <tr
            key={
              consignment.consignment_id ||
              consignment.product_id ||
              index
            }
          >
            <td>
              <strong>
                {consignment.product_name ||
                  "Consignment record"}
              </strong>
            </td>

            <td>
              {Number(
                consignment.quantity || 0
              )}{" "}
              {consignment.unit_type ||
                consignment.unit ||
                ""}
            </td>

            <td>
              {formatDate(
                consignment.consignment_start_date ||
                  consignment.start_date
              )}
            </td>

            <td>
              {formatDate(
                consignment.consignment_pullout_date ||
                  consignment.pullout_date
              )}
            </td>

            <td>
              {consignment.consignment_terms ||
                consignment.terms ||
                "Not provided"}
            </td>

            <td>
              <StatusBadge
                value={
                  consignment.consignment_status ||
                  consignment.status ||
                  "Active"
                }
              />
            </td>

            <td>
              <button
                type="button"
                className="supplier-action-btn"
                onClick={() =>
                  printSupplierTransactionReceipt({
                    supplier,
                    title:
                      "Consignment Transaction Receipt",
                    reference:
                      consignment.product_name ||
                      `Consignment ${
                        consignment.consignment_id ||
                        ""
                      }`,
                    fields: [
                      {
                        label: "Product",
                        value:
                          consignment.product_name ||
                          "N/A",
                      },
                      {
                        label: "Quantity",
                        value: `${Number(
                          consignment.quantity ||
                            0
                        )} ${
                          consignment.unit_type ||
                          consignment.unit ||
                          ""
                        }`,
                      },
                      {
                        label: "Start Date",
                        value: formatDate(
                          consignment.consignment_start_date ||
                            consignment.start_date
                        ),
                      },
                      {
                        label: "Pull-out Date",
                        value: formatDate(
                          consignment.consignment_pullout_date ||
                            consignment.pullout_date
                        ),
                      },
                      {
                        label: "Terms",
                        value:
                          consignment.consignment_terms ||
                          consignment.terms ||
                          "Not provided",
                      },
                      {
                        label: "Status",
                        value:
                          consignment.consignment_status ||
                          consignment.status ||
                          "Active",
                      },
                    ],
                  })
                }
              >
                <Printer size={14} />
                Print Receipt
              </button>
            </td>
          </tr>
        )
      )}
    </BusinessTable>
  );
}


function ProductActionToolbar({
  canRequest = false,
  isAdminAction = false,
  summary = {},
  onRequestPullout,
  onRequestDisposal,
}) {
  return (
    <div className="product-action-toolbar">
      <div className="product-action-summary-strip">
        <span>
          Pending
          <strong>{Number(summary.pending || 0)}</strong>
        </span>
        <span>
          Approved
          <strong>{Number(summary.approved || 0)}</strong>
        </span>
        <span>
          Completed
          <strong>{Number(summary.completed || 0)}</strong>
        </span>
        <span>
          Declined
          <strong>{Number(summary.rejected || 0)}</strong>
        </span>
      </div>

      {canRequest && (
        <div className="product-action-toolbar-buttons">
          <button
            type="button"
            className="supplier-action-btn"
            onClick={onRequestPullout}
          >
            <Package size={16} />
            {isAdminAction ? "Pull-out Product" : "Request Pull-out"}
          </button>

          <button
            type="button"
            className="supplier-action-btn danger"
            onClick={onRequestDisposal}
          >
            <AlertTriangle size={16} />
            {isAdminAction ? "Dispose Product" : "Request Disposal"}
          </button>
        </div>
      )}
    </div>
  );
}

function ProductActionTable({
  supplier,
  requests,
  canManage,
  formatDate,
  onView,
  onApprove,
  onReject,
  onComplete,
  onViewReceipt,
}) {
  if (!requests || requests.length === 0) {
    return (
      <EmptyState
        title="No product action requests"
        message="Supplier pull-out and disposal requests will appear here."
      />
    );
  }

  return (
    <BusinessTable
      className="supplier-product-action-table"
      headings={[
        "Request",
        "Product / Batch",
        "Action",
        "Quantity",
        "Reason",
        "Preferred Date",
        "Status",
        "Actions",
      ]}
    >
      {requests.map((request) => (
        <tr key={request.request_id}>
          <td>
            <strong>{request.request_no}</strong>
            <small className="product-action-subtext">
              {formatDate(request.created_at?.slice?.(0, 10) || request.created_at)}
            </small>
          </td>
          <td>
            <strong>{request.product_name}</strong>
            <small className="product-action-subtext">
              {request.sku || "No SKU"} • Batch #{request.batch_id}
              {request.batch_expiry_date
                ? ` • Exp. ${formatDate(request.batch_expiry_date)}`
                : ""}
            </small>
          </td>
          <td>
            <span
              className={`product-action-type ${
                request.action_type === "Disposal"
                  ? "disposal"
                  : "pullout"
              }`}
            >
              {request.action_type}
            </span>
          </td>
          <td>
            <strong>
              {Number(
                request.approved_quantity ||
                  request.requested_quantity ||
                  0
              )} {request.unit || ""}
            </strong>
            {request.approved_quantity &&
              Number(request.approved_quantity) !==
                Number(request.requested_quantity) && (
                <small className="product-action-subtext">
                  Requested: {Number(request.requested_quantity)}
                </small>
              )}
          </td>
          <td>
            <span className="product-action-reason">
              {request.reason}
            </span>
          </td>
          <td>{formatDate(request.preferred_action_date)}</td>
          <td>
            <StatusBadge value={displayStatus(request.status)} />
          </td>
          <td>
            <div className="product-action-row-buttons">
              {canManage && request.status === "Pending" && (
                <>
                  <button
                    type="button"
                    className="supplier-action-btn"
                    onClick={() => onView(request)}
                    title="View full request details"
                  >
                    <Eye size={14} />
                    View
                  </button>

                  <button
                    type="button"
                    className="supplier-action-btn success"
                    onClick={() => onApprove(request)}
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="supplier-action-btn danger"
                    onClick={() => onReject(request)}
                  >
                    <X size={14} />
                    Decline
                  </button>
                </>
              )}

              {canManage && request.status === "Approved" && (
                <button
                  type="button"
                  className="supplier-action-btn"
                  onClick={() => onView(request)}
                  title="View legacy approved request details"
                >
                  <Eye size={14} />
                  View
                </button>
              )}

              {request.status === "Rejected" && (
                <button
                  type="button"
                  className="supplier-action-btn"
                  onClick={() => onView(request)}
                  title="View declined request details"
                >
                  <Eye size={14} />
                  View
                </button>
              )}

              {request.status === "Completed" && (
                <button
                  type="button"
                  className="supplier-action-btn"
                  onClick={() => onViewReceipt(request)}
                  title="View final receipt"
                >
                  <ReceiptText size={14} />
                  Receipt
                </button>
              )}

              <button
                type="button"
                className="supplier-action-btn"
                onClick={() =>
                  printSupplierTransactionReceipt({
                    supplier,
                    title: `${
                      request.action_type ||
                      "Product Action"
                    } Transaction Receipt`,
                    reference:
                      request.request_no ||
                      "Product Action",
                    preparedBy:
                      request.completed_by_name ||
                      request.reviewed_by_name ||
                      "",
                    fields: [
                      {
                        label: "Product",
                        value:
                          request.product_name ||
                          "N/A",
                      },
                      {
                        label: "SKU / Batch",
                        value: `${
                          request.sku ||
                          "No SKU"
                        } / #${
                          request.batch_id ||
                          "N/A"
                        }`,
                      },
                      {
                        label: "Action",
                        value:
                          request.action_type ||
                          "N/A",
                      },
                      {
                        label: "Quantity",
                        value: `${Number(
                          request.approved_quantity ||
                            request.requested_quantity ||
                            0
                        )} ${
                          request.unit ||
                          ""
                        }`,
                      },
                      {
                        label: "Preferred Date",
                        value: formatDate(
                          request.preferred_action_date
                        ),
                      },
                      {
                        label: "Status",
                        value:
                          request.status ||
                          "N/A",
                      },
                    ],
                  })
                }
                title="Print transaction receipt"
              >
                <Printer size={14} />
                Print
              </button>
            </div>
          </td>
        </tr>
      ))}
    </BusinessTable>
  );
}

function ProductActionRequestModal({
  products,
  form,
  setForm,
  saving,
  isAdminAction = false,
  onSubmit,
  onClose,
}) {
  const selectedProduct = products.find(
    (item) => Number(item.product_id) === Number(form.product_id)
  );

  const selectedBatch = selectedProduct?.batches?.find(
    (item) => Number(item.batch_id) === Number(form.batch_id)
  );

  const todayDate = getPhilippineDate();

  const selectedBatchExpiry =
    selectedBatch?.expiry_date || "";

  const preferredDateMax =
    selectedBatch?.max_action_date ||
    (selectedBatchExpiry && selectedBatchExpiry >= todayDate
      ? selectedBatchExpiry
      : undefined);

  return (
    <div className="modal-overlay supplier-modal-overlay">
      <div className="modal-box product-action-modal">
        <div className="supplier-modal-header">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon">
                {form.action_type === "Disposal" ? (
                  <AlertTriangle size={21} />
                ) : (
                  <Package size={21} />
                )}
              </div>
              <h2>
                {isAdminAction
                  ? "Supplier Product Action"
                  : "Supplier Product Action Request"}
              </h2>
            </div>
            <p>
              {isAdminAction
                ? "Record and process this assisted supplier transaction immediately. The selected exact batch stock will be deducted after confirmation."
                : "Submit this supplier transaction for Admin review. Stock is deducted only after Admin approval."}
            </p>
          </div>
          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="product-action-form-body">
            <div className="product-action-choice-grid">
              {[
                ["Pull-out", "Return available products to the supplier."],
                ["Disposal", "Remove damaged, expired, or unusable products."],
              ].map(([type, description]) => (
                <button
                  key={type}
                  type="button"
                  className={
                    form.action_type === type
                      ? "product-action-choice active"
                      : "product-action-choice"
                  }
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      action_type: type,
                      disposal_method:
                        type === "Disposal"
                          ? current.disposal_method
                          : "",
                    }))
                  }
                >
                  <strong>{type}</strong>
                  <span>{description}</span>
                </button>
              ))}
            </div>

            <div className="product-action-form-grid">
              <SupplierInput label="Product" required>
                <select
                  value={form.product_id}
                  required
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      product_id: event.target.value,
                      batch_id: "",
                      requested_quantity: "",
                    }))
                  }
                >
                  <option value="">Select supplier product</option>
                  {products.map((product) => (
                    <option
                      key={product.product_id}
                      value={product.product_id}
                    >
                      {product.product_name} ({product.sku})
                    </option>
                  ))}
                </select>
              </SupplierInput>

              <SupplierInput label="Inventory Batch" required>
                <select
                  value={form.batch_id}
                  required
                  disabled={!selectedProduct}
                  onChange={(event) => {
                    const nextBatchId = event.target.value;

                    const nextBatch =
                      selectedProduct?.batches?.find(
                        (batch) =>
                          Number(batch.batch_id) ===
                          Number(nextBatchId)
                      );

                    const expiryDate =
                      nextBatch?.expiry_date || "";

                    const backendRecommendedDate =
                      nextBatch?.recommended_action_date || "";

                    let suggestedDate = todayDate;

                    if (
                      backendRecommendedDate &&
                      backendRecommendedDate >= todayDate
                    ) {
                      suggestedDate = backendRecommendedDate;
                    } else if (expiryDate) {
                      const expiry = new Date(
                        `${expiryDate}T00:00:00`
                      );

                      if (!Number.isNaN(expiry.getTime())) {
                        const recommended = new Date(expiry);
                        recommended.setDate(
                          recommended.getDate() - 7
                        );

                        const recommendedDate =
                          getPhilippineDate(recommended);

                        if (recommendedDate >= todayDate) {
                          suggestedDate = recommendedDate;
                        } else if (expiryDate >= todayDate) {
                          suggestedDate = todayDate;
                        }
                      }
                    }

                    const maximumDate =
                      nextBatch?.max_action_date ||
                      expiryDate ||
                      "";

                    if (
                      maximumDate &&
                      suggestedDate > maximumDate
                    ) {
                      suggestedDate = maximumDate;
                    }

                    setForm((current) => ({
                      ...current,
                      batch_id: nextBatchId,
                      requested_quantity: "",
                      preferred_action_date: suggestedDate,
                    }));
                  }}
                >
                  <option value="">Select exact batch</option>
                  {(selectedProduct?.batches || []).map((batch) => (
                    <option key={batch.batch_id} value={batch.batch_id}>
                      Batch #{batch.batch_id} • Available {batch.available_quantity}
                      {batch.expiry_date
                        ? ` • Exp. ${batch.expiry_date}`
                        : " • No expiry"}
                    </option>
                  ))}
                </select>
              </SupplierInput>

              <SupplierInput label="Requested Quantity" required>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={
                    selectedBatch?.available_quantity ??
                    undefined
                  }
                  value={form.requested_quantity}
                  required
                  disabled={!selectedBatch}
                  onKeyDown={(event) => {
                    if (
                      ["e", "E", "+", "-"].includes(
                        event.key
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                  onChange={(event) => {
                    const rawValue =
                      event.target.value;

                    if (rawValue === "") {
                      setForm((current) => ({
                        ...current,
                        requested_quantity: "",
                      }));
                      return;
                    }

                    const maximumQuantity =
                      Number(
                        selectedBatch?.available_quantity ||
                          0
                      );

                    let nextQuantity =
                      Number(rawValue);

                    if (
                      !Number.isFinite(nextQuantity)
                    ) {
                      nextQuantity = 0;
                    }

                    nextQuantity = Math.max(
                      0,
                      nextQuantity
                    );

                    if (
                      maximumQuantity > 0 &&
                      nextQuantity > maximumQuantity
                    ) {
                      nextQuantity =
                        maximumQuantity;
                    }

                    setForm((current) => ({
                      ...current,
                      requested_quantity:
                        String(nextQuantity),
                    }));
                  }}
                  onBlur={() => {
                    if (
                      form.requested_quantity === ""
                    ) {
                      return;
                    }

                    const maximumQuantity =
                      Number(
                        selectedBatch?.available_quantity ||
                          0
                      );

                    let normalizedQuantity =
                      Number(
                        form.requested_quantity
                      );

                    if (
                      !Number.isFinite(
                        normalizedQuantity
                      ) ||
                      normalizedQuantity <= 0
                    ) {
                      normalizedQuantity =
                        Math.min(
                          0.01,
                          maximumQuantity
                        );
                    }

                    if (
                      maximumQuantity > 0 &&
                      normalizedQuantity >
                        maximumQuantity
                    ) {
                      normalizedQuantity =
                        maximumQuantity;
                    }

                    setForm((current) => ({
                      ...current,
                      requested_quantity:
                        String(
                          normalizedQuantity
                        ),
                    }));
                  }}
                  placeholder={
                    selectedBatch
                      ? `Maximum ${selectedBatch.available_quantity}`
                      : "Select a batch first"
                  }
                />
              </SupplierInput>

              <SupplierInput label="Preferred Action Date" required>
                <input
                  type="date"
                  min={todayDate}
                  max={preferredDateMax}
                  value={form.preferred_action_date}
                  required
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      preferred_action_date: event.target.value,
                    }))
                  }
                />

                {selectedBatch && (
                  <small className="supplier-field-hint">
                    {selectedBatch.recommended_action_date
                      ? `Recommended action date: ${selectedBatch.recommended_action_date}. `
                      : ""}
                    {selectedBatchExpiry
                      ? `Batch expiration: ${selectedBatchExpiry}. `
                      : "This batch has no expiration date. "}
                    {preferredDateMax
                      ? `The action date cannot be later than ${preferredDateMax}.`
                      : "No expiration-based maximum date applies."}
                  </small>
                )}
              </SupplierInput>

              {form.action_type === "Disposal" && (
                <div className="supplier-full-field">
                  <SupplierInput label="Disposal Method" required>
                    <select
                      value={form.disposal_method}
                      required
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          disposal_method: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select disposal method</option>
                      <option value="Segregated Waste Disposal">Segregated Waste Disposal</option>
                      <option value="Composting">Composting</option>
                      <option value="Municipal Waste Collection">Municipal Waste Collection</option>
                      <option value="Authorized Destruction">Authorized Destruction</option>
                      <option value="Other Approved Method">Other Approved Method</option>
                    </select>
                  </SupplierInput>
                </div>
              )}

              <div className="supplier-full-field">
                <SupplierInput label="Reason" required textarea>
                  <textarea
                    value={form.reason}
                    required
                    rows="3"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Explain why the product should be pulled out or disposed."
                  />
                </SupplierInput>
              </div>

              <div className="supplier-full-field">
                <SupplierInput label="Supplier Remarks" textarea>
                  <textarea
                    value={form.supplier_remarks}
                    rows="3"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        supplier_remarks: event.target.value,
                      }))
                    }
                    placeholder="Additional instructions or notes"
                  />
                </SupplierInput>
              </div>
            </div>
          </div>

          <div className="supplier-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <LoaderCircle size={16} className="supplier-spinner" />
              ) : (
                <Send size={16} />
              )}
              {saving
                ? isAdminAction
                  ? "Processing..."
                  : "Submitting..."
                : isAdminAction
                ? form.action_type === "Disposal"
                  ? "Confirm Disposal"
                  : "Confirm Pull-out"
                : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductActionReviewModal({
  request,
  form,
  setForm,
  saving,
  formatDate,
  resolveProductImage,
  onSubmit,
  onClose,
}) {
  const [
    showRejectReason,
    setShowRejectReason,
  ] = useState(false);

  const requestedQuantity =
    Number(
      request.requested_quantity || 0
    );

  const batchAvailable =
    Number(
      request.current_batch_quantity ||
        request.batch_quantity ||
        0
    );

  const unit =
    request.unit || "";

  const isPending =
    String(
      request.status || "Pending"
    ).toLowerCase() === "pending";

  const imageUrl =
    request.product_image_url ||
    (
      typeof resolveProductImage === "function"
        ? resolveProductImage(
            request.product_image ||
              request.image ||
              request.image_url ||
              ""
          )
        : ""
    );

  const displayDate = (value) => {
    if (
      typeof formatDate === "function"
    ) {
      return formatDate(value);
    }

    if (!value) {
      return "No record";
    }

    return String(value);
  };


  const submitApproval = () => {
    onSubmit("approve");
  };

  const submitRejection = () => {
    if (!showRejectReason) {
      setShowRejectReason(true);
      return;
    }

    onSubmit(
      "reject",
      form.rejection_reason
    );
  };

  return (
    <div className="modal-overlay supplier-modal-overlay">
      <div className="modal-box product-action-review-modal product-action-review-readonly-modal">
        <div className="supplier-modal-header">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon">
                <FileText size={21} />
              </div>

              <h2>
                Review Product Action Request
              </h2>
            </div>

            <p>
              {request.request_no} •{" "}
              {request.product_name}
            </p>
          </div>

          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <div className="product-action-review-readonly-body">
          <div className="product-action-review-product-showcase">
            <div className="product-action-review-product-image">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={request.product_name || "Product"}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    const fallback =
                      event.currentTarget.nextElementSibling;
                    if (fallback) {
                      fallback.style.display = "flex";
                    }
                  }}
                />
              ) : null}

              <div
                className="product-action-review-image-fallback"
                style={{
                  display: imageUrl ? "none" : "flex",
                }}
              >
                <Package size={34} />
                <span>No product image</span>
              </div>
            </div>

            <div className="product-action-review-product-summary">
              <small>Product</small>
              <strong>{request.product_name}</strong>
              <span>{request.sku || "No SKU"}</span>
            </div>
          </div>

          <div className="product-action-review-hero">
            <div>
              <small>Supplier</small>
              <strong>
                {request.vendor_name ||
                  request.supplier_name ||
                  "Supplier"}
              </strong>
            </div>

            <span
              className={`product-action-type ${
                request.action_type ===
                "Disposal"
                  ? "disposal"
                  : "pullout"
              }`}
            >
              {request.action_type}
            </span>
          </div>

          <div className="product-action-review-info-grid">
            <div>
              <small>Product</small>
              <strong>
                {request.product_name}
              </strong>
              <span>
                {request.sku ||
                  "No SKU"}
              </span>
            </div>

            <div>
              <small>Inventory Batch</small>
              <strong>
                Batch #{request.batch_id}
              </strong>
              <span>
                {request.batch_expiry_date
                  ? `Expiry: ${displayDate(
                      request.batch_expiry_date
                    )}`
                  : "No expiry date"}
              </span>
            </div>

            <div>
              <small>Requested Quantity</small>
              <strong>
                {requestedQuantity} {unit}
              </strong>
              <span>
                Supplier requested amount
              </span>
            </div>

            <div>
              <small>Batch Available</small>
              <strong>
                {batchAvailable} {unit}
              </strong>
              <span>
                Current batch quantity
              </span>
            </div>

            <div>
              <small>Preferred Action Date</small>
              <strong>
                {displayDate(
                  request.preferred_action_date
                )}
              </strong>
            </div>

            <div>
              <small>Request Status</small>
              <strong>
                {request.status ||
                  "Pending"}
              </strong>
            </div>
          </div>

          <div className="product-action-review-section">
            <small>Reason</small>
            <p>
              {request.reason ||
                "No reason was provided."}
            </p>
          </div>

          {request.action_type ===
            "Disposal" && (
            <div className="product-action-review-section">
              <small>
                Disposal Method
              </small>
              <p>
                {request.disposal_method ||
                  "No disposal method was provided."}
              </p>
            </div>
          )}

          <div className="product-action-review-section">
            <small>Supplier Remarks</small>
            <p>
              {request.supplier_remarks ||
                "No additional remarks were provided."}
            </p>
          </div>

          <div className="product-action-review-note">
            <CheckCircle2 size={17} />

            <span>
              {isPending ? (
                <>
                  Confirming this request approves the
                  full requested quantity of{" "}
                  <strong>
                    {requestedQuantity} {unit}
                  </strong>
                  . The Supplier will receive the review
                  result through HiveSync notifications
                  and the registered email address.
                  Stock will only be deducted when the
                  approved request is completed.
                </>
              ) : (
                <>
                  This request is currently{" "}
                  <strong>
                    {displayStatus(request.status)}
                  </strong>
                  . The information shown here is
                  read-only.
                </>
              )}
            </span>
          </div>

          {isPending &&
          showRejectReason && (
            <div className="product-action-review-reject-box">
              <label>
                <span>
                  Decline Reason
                  <strong> *</strong>
                </span>

                <textarea
                  rows="4"
                  required
                  autoFocus
                  value={
                    form.rejection_reason
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        rejection_reason:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Explain why this request is being declined."
                />
              </label>
            </div>
          )}
        </div>

        <div className="supplier-modal-footer product-action-review-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>

          {isPending && (
            <>
              <button
                type="button"
                className="btn product-action-reject-btn"
                onClick={submitRejection}
                disabled={saving}
              >
                {saving &&
                showRejectReason ? (
                  <LoaderCircle
                    size={16}
                    className="supplier-spinner"
                  />
                ) : (
                  <X size={16} />
                )}

                {showRejectReason
                  ? "Confirm Decline"
                  : "Decline Request"}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={submitApproval}
                disabled={saving}
              >
                {saving &&
                !showRejectReason ? (
                  <LoaderCircle
                    size={16}
                    className="supplier-spinner"
                  />
                ) : (
                  <CheckCircle2
                    size={16}
                  />
                )}

                Confirm Request
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductActionCompleteModal({
  request,
  saving,
  formatDate,
  resolveProductImage,
  onConfirm,
  onClose,
}) {
  const quantity =
    Number(
      request.approved_quantity ??
        request.requested_quantity ??
        0
    );

  const imageUrl =
    request.product_image_url ||
    (
      typeof resolveProductImage ===
      "function"
        ? resolveProductImage(
            request.product_image || ""
          )
        : ""
    );

  return (
    <div className="modal-overlay supplier-modal-overlay supplier-modal-top">
      <div className="modal-box product-action-complete-modal">
        <div className="supplier-modal-header">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon">
                <PackageCheck size={21} />
              </div>

              <h2>
                Complete{" "}
                {request.action_type}
              </h2>
            </div>

            <p>
              {request.request_no} •{" "}
              {request.product_name}
            </p>
          </div>

          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <div className="product-action-complete-body">
          <div className="product-action-complete-product">
            <div className="product-action-complete-image">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={
                    request.product_name ||
                    "Product"
                  }
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";

                    const fallback =
                      event.currentTarget
                        .nextElementSibling;

                    if (fallback) {
                      fallback.style.display =
                        "flex";
                    }
                  }}
                />
              ) : null}

              <div
                className="product-action-complete-image-fallback"
                style={{
                  display: imageUrl
                    ? "none"
                    : "flex",
                }}
              >
                <Package size={30} />
                <span>
                  No product image
                </span>
              </div>
            </div>

            <div>
              <small>Product</small>
              <strong>
                {request.product_name}
              </strong>
              <span>
                {request.sku ||
                  "No SKU"}
              </span>
            </div>
          </div>

          <div className="product-action-complete-grid">
            <div>
              <small>Action</small>
              <strong>
                {request.action_type}
              </strong>
            </div>

            <div>
              <small>Exact Batch</small>
              <strong>
                #{request.batch_id}
              </strong>
            </div>

            <div>
              <small>
                Quantity to Deduct
              </small>
              <strong>
                {quantity}{" "}
                {request.unit || ""}
              </strong>
            </div>

            <div>
              <small>
                Current Batch Stock
              </small>
              <strong>
                {Number(
                  request.current_batch_quantity ??
                    request.batch_quantity ??
                    0
                )}{" "}
                {request.unit || ""}
              </strong>
            </div>

            <div>
              <small>
                Preferred Action Date
              </small>
              <strong>
                {formatDate(
                  request.preferred_action_date
                )}
              </strong>
            </div>

            <div>
              <small>Status</small>
              <strong>
                {displayStatus(request.status)}
              </strong>
            </div>
          </div>

          <div className="product-action-complete-warning">
            <AlertTriangle size={18} />

            <div>
              <strong>
                Confirm actual stock removal
              </strong>

              <span>
                Completing this request will
                deduct {quantity}{" "}
                {request.unit || "unit(s)"} from
                batch #{request.batch_id} and
                recalculate the main inventory
                stock. This action should only
                be confirmed after the physical{" "}
                {request.action_type ===
                "Disposal"
                  ? "disposal"
                  : "pull-out"}{" "}
                has taken place.
              </span>
            </div>
          </div>

          <div className="product-action-complete-communication">
            <Bell size={17} />

            <span>
              After successful completion,
              HiveSync will automatically notify
              the linked Supplier account and
              send the completion details to the
              Supplier's registered email
              address.
            </span>
          </div>
        </div>

        <div className="supplier-modal-footer">
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
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle
                size={16}
                className="supplier-spinner"
              />
            ) : (
              <PackageCheck size={16} />
            )}

            {saving
              ? "Completing..."
              : `Confirm ${
                  request.action_type
                }`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductActionReceiptModal({
  data,
  formatDate,
  formatDateTime,
  processorName = "",
  onClose,
}) {
  const receipt = data.receipt || {};
  const organization = data.organization || {};
  const delivery = data.completion_delivery || null;

  const processedQuantity = Number(
    receipt.processed_quantity ??
      receipt.approved_quantity ??
      receipt.requested_quantity ??
      0
  );

  const status = receipt.status || "Completed";
  const isCompleted = status === "Completed";

  const documentTitle =
    organization.document_title ||
    (receipt.action_type === "Disposal"
      ? "PRODUCT DISPOSAL RECEIPT"
      : "SUPPLIER PULL-OUT RECEIPT");

  const printReceipt = () => {
    const receiptElement = document.getElementById(
      "product-action-receipt"
    );

    if (!receiptElement) {
      return;
    }

    const printFrame = document.createElement("iframe");

    printFrame.setAttribute(
      "title",
      "Product Action Receipt"
    );

    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.visibility = "hidden";

    document.body.appendChild(printFrame);

    const frameDocument =
      printFrame.contentDocument ||
      printFrame.contentWindow?.document;

    if (!frameDocument) {
      printFrame.remove();
      return;
    }

    frameDocument.open();
    frameDocument.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>${documentTitle}</title>
          <style>
            @page {
              size: 8.5in 13in;
              margin: 0.42in;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
            }

            body {
              width: 100%;
            }

            #product-action-receipt {
              width: 100%;
              min-height: auto;
              margin: 0;
              padding: 0;
              border: 0;
              background: #ffffff;
              page-break-inside: avoid;
              break-inside: avoid-page;
            }

            .classic-product-action-receipt {
              width: 100%;
              margin: 0;
              padding: 0;
              color: #111111;
              font-family: Arial, Helvetica, sans-serif;
            }

            .classic-action-header {
              display: grid;
              grid-template-columns: 58px 1fr 150px;
              gap: 12px;
              align-items: center;
              padding-bottom: 9px;
              border-bottom: 1px solid #444444;
            }

            .supplier-receipt-logo {
              width: 50px;
              height: 50px;
              object-fit: contain;
            }

            .classic-action-brand h2 {
              margin: 0;
              font-size: 14px;
              line-height: 1.2;
              font-weight: 800;
              text-transform: uppercase;
            }

            .classic-action-brand p {
              margin: 3px 0 0;
              font-size: 8px;
            }

            .classic-action-reference {
              text-align: right;
            }

            .classic-action-reference span {
              display: block;
              margin-bottom: 3px;
              font-size: 7px;
              font-weight: 700;
              text-transform: uppercase;
            }

            .classic-action-reference strong {
              font-size: 10px;
            }

            .classic-action-title {
              margin: 13px 0 10px;
              text-align: center;
            }

            .classic-action-title h3 {
              margin: 0;
              font-size: 14px;
              font-weight: 500;
              letter-spacing: 0.8px;
              text-transform: uppercase;
            }

            .classic-action-fields {
              margin-bottom: 8px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              column-gap: 24px;
              row-gap: 6px;
            }

            .classic-action-fields > div {
              display: flex;
              align-items: flex-end;
              gap: 5px;
              min-width: 0;
              font-size: 8.5px;
            }

            .classic-action-fields span {
              flex: 0 0 auto;
              font-weight: 700;
              text-transform: uppercase;
            }

            .classic-action-fields strong {
              min-width: 0;
              flex: 1;
              min-height: 15px;
              padding: 0 4px 2px;
              border-bottom: 0.7px solid #555555;
              font-size: 9px;
              font-weight: 500;
              overflow-wrap: anywhere;
            }

            .classic-action-table {
              width: 100%;
              margin-top: 8px;
              border-collapse: collapse;
              table-layout: fixed;
            }

            .classic-action-table th,
            .classic-action-table td {
              height: 23px;
              padding: 4px 5px;
              border: 0.6px solid #777777;
              background: #ffffff;
              color: #111111;
              font-size: 8.3px;
              line-height: 1.25;
              vertical-align: middle;
            }

            .classic-action-table th {
              font-size: 7.8px;
              font-weight: 700;
              text-align: center;
              text-transform: uppercase;
            }

            .classic-action-table td:nth-child(1),
            .classic-action-table td:nth-child(2) {
              text-align: center;
            }

            .classic-action-empty-row td {
              height: 22px;
            }

            .classic-action-notes {
              margin-top: 9px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px 20px;
            }

            .classic-action-notes > div {
              display: flex;
              align-items: flex-end;
              gap: 5px;
              font-size: 8.5px;
            }

            .classic-action-notes span {
              flex: 0 0 auto;
              font-weight: 700;
              text-transform: uppercase;
            }

            .classic-action-notes strong {
              min-width: 0;
              flex: 1;
              min-height: 15px;
              padding: 0 4px 2px;
              border-bottom: 0.7px solid #555555;
              font-size: 9px;
              font-weight: 500;
            }

            .classic-action-note-wide {
              grid-column: 1 / -1;
            }

            .classic-action-certification {
              margin-top: 11px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 36px;
              font-size: 8px;
              line-height: 1.4;
            }

            .classic-action-certification p {
              margin: 0;
            }

            .classic-action-signatures {
              margin-top: 32px;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 28px;
              page-break-inside: avoid;
            }

            .classic-action-signatures > div {
              text-align: center;
            }

            .classic-action-signatures span {
              display: block;
              min-height: 18px;
              padding-bottom: 3px;
              border-bottom: 0.8px solid #333333;
              font-size: 8.5px;
            }

            .classic-action-signatures strong {
              display: block;
              margin-top: 4px;
              font-size: 8px;
            }

            .supplier-receipt-note {
              margin-top: 16px;
              padding-top: 6px;
              border-top: 0.5px solid #cbd5e1;
              color: #64748b;
              font-size: 7px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          ${receiptElement.outerHTML}
        </body>
      </html>
    `);
    frameDocument.close();

    const runPrint = () => {
      const frameWindow = printFrame.contentWindow;

      if (!frameWindow) {
        printFrame.remove();
        return;
      }

      frameWindow.focus();
      frameWindow.print();

      window.setTimeout(() => {
        printFrame.remove();
      }, 1000);
    };

    const logo = frameDocument.querySelector(
      ".supplier-receipt-logo"
    );

    if (logo && !logo.complete) {
      logo.addEventListener("load", runPrint, {
        once: true,
      });
      logo.addEventListener("error", runPrint, {
        once: true,
      });
    } else {
      window.setTimeout(runPrint, 250);
    }
  };

  return (
    <div className="modal-overlay supplier-modal-overlay supplier-receipt-overlay">
      <div className="modal-box supplier-receipt-modal product-action-standard-modal">
        <div className="supplier-modal-header no-print">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon">
                <ReceiptText size={21} />
              </div>

              <h2>Product Action Receipt</h2>
            </div>

            <p>
              Final acknowledgement record for {receipt.request_no}
            </p>
          </div>

          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="supplier-receipt-scroll-area">
          <div
            className="supplier-remittance-receipt product-action-standard-receipt classic-product-action-receipt"
            id="product-action-receipt"
          >
            <header className="classic-action-header">
              <img
                className="supplier-receipt-logo"
                src={bacnotanLogo}
                alt="Bacnotan Logo"
              />

              <div className="classic-action-brand">
                <h2>
                  {organization.name ||
                    "BACNOTAN FARMERS AGRI-TOURISM CENTER"}
                </h2>
                <p>
                  HiveSync Integrated Business and Operations Management System
                </p>
              </div>

              <div className="classic-action-reference">
                <span>Receipt No.</span>
                <strong>
                  {receipt.receipt_no ||
                    receipt.request_no ||
                    "N/A"}
                </strong>
              </div>
            </header>

            <div className="classic-action-title">
              <h3>{documentTitle}</h3>
            </div>

            <div className="classic-action-fields">
              <div>
                <span>Supplier</span>
                <strong>
                  {receipt.vendor_name || "N/A"}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{status}</strong>
              </div>

              <div>
                <span>Request No.</span>
                <strong>
                  {receipt.request_no || "N/A"}
                </strong>
              </div>

              <div>
                <span>Action</span>
                <strong>
                  {receipt.action_type || "N/A"}
                </strong>
              </div>

              <div>
                <span>Completed Date</span>
                <strong>
                  {receipt.completed_at
                    ? typeof formatDateTime === "function"
                      ? formatDateTime(receipt.completed_at)
                      : receipt.completed_at
                    : "Not completed"}
                </strong>
              </div>

              <div>
                <span>Preferred Date</span>
                <strong>
                  {receipt.preferred_action_date
                    ? formatDate(
                        receipt.preferred_action_date
                      )
                    : "N/A"}
                </strong>
              </div>
            </div>

            <table className="classic-action-table">
              <thead>
                <tr>
                  <th>Qty.</th>
                  <th>Unit</th>
                  <th>Description</th>
                  <th>SKU / Batch</th>
                  <th>Remaining</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>{processedQuantity}</td>
                  <td>{receipt.unit || ""}</td>
                  <td>
                    {receipt.product_display_name ||
                      receipt.product_name ||
                      "N/A"}
                  </td>
                  <td>
                    {receipt.sku || "N/A"} / #
                    {receipt.batch_id || "N/A"}
                  </td>
                  <td>
                    {Number(
                      receipt.current_batch_quantity ??
                        0
                    )}{" "}
                    {receipt.unit || ""}
                  </td>
                </tr>

                {Array.from({ length: 7 }).map(
                  (_, index) => (
                    <tr
                      key={`blank-action-row-${index}`}
                      className="classic-action-empty-row"
                    >
                      <td>&nbsp;</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )
                )}
              </tbody>
            </table>

            <div className="classic-action-notes">
              <div>
                <span>Reason</span>
                <strong>
                  {receipt.reason ||
                    "No reason provided."}
                </strong>
              </div>

              {receipt.expiry_date && (
                <div>
                  <span>Batch Expiry</span>
                  <strong>
                    {formatDate(
                      receipt.expiry_date
                    )}
                  </strong>
                </div>
              )}

              {receipt.disposal_method && (
                <div>
                  <span>Disposal Method</span>
                  <strong>
                    {receipt.disposal_method}
                  </strong>
                </div>
              )}

              {receipt.supplier_remarks && (
                <div className="classic-action-note-wide">
                  <span>Supplier Remarks</span>
                  <strong>
                    {receipt.supplier_remarks}
                  </strong>
                </div>
              )}
            </div>

            <div className="classic-action-certification">
              <p>
                Checked and certified that the product action above has been recorded in HiveSync.
              </p>

              <p>
                The undersigned acknowledge the quantities and action reflected in this receipt.
              </p>
            </div>

            <div className="classic-action-signatures">
              <div>
                <span>
                  {receipt.requested_by_name ||
                    processorName ||
                    ""}
                </span>
                <strong>Requested By</strong>
              </div>

              <div>
                <span>
                  {receipt.reviewed_by_name ||
                    processorName ||
                    ""}
                </span>
                <strong>Reviewed By</strong>
              </div>

              <div>
                <span>
                  {receipt.completed_by_name ||
                    processorName ||
                    ""}
                </span>
                <strong>Completed By</strong>
              </div>
            </div>

            <div className="supplier-receipt-note">
              This receipt was generated through HiveSync.
            </div>
          </div>
        </div>

        {delivery && (
          <div className="product-action-delivery-status no-print">
            <div>
              <Bell size={16} />
              <span>Supplier notification</span>
              <strong>
                {delivery.notification_sent ? "Sent" : "Not sent"}
              </strong>
            </div>

            <div>
              <Mail size={16} />
              <span>Registered email</span>
              <strong>
                {delivery.email_sent ? "Sent" : "Not sent"}
              </strong>
            </div>

            {delivery.communication_error && (
              <p>
                Communication warning: {delivery.communication_error}
              </p>
            )}
          </div>
        )}

        <div className="supplier-modal-footer product-action-receipt-footer no-print">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={printReceipt}
            disabled={!isCompleted}
            title={
              isCompleted
                ? "Print receipt"
                : "Receipt can be printed after completion"
            }
          >
            <Printer size={16} />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierPaymentActions({
  activeTab,
  payables,
  remittances,
  onCreateRemittance,
  onRecordPayment,
  onViewReceipt,
  formatPeso,
}) {
  const eligibleCount = payables.filter(
    (item) =>
      Number(item.balance_amount || 0) > 0 &&
      ![
        "For Remittance",
        "Paid",
      ].includes(item.payment_status)
  ).length;

  const payableTotal = payables
    .filter(
      (item) =>
        Number(item.balance_amount || 0) > 0 &&
        ![
          "For Remittance",
          "Paid",
        ].includes(item.payment_status)
    )
    .reduce(
      (sum, item) =>
        sum + Number(item.balance_amount || 0),
      0
    );

  if (activeTab === "payables") {
    return (
      <div className="supplier-payment-action-bar">
        <div>
          <strong>Remittance Processing</strong>
          <span>
            {eligibleCount} payable(s) available •{" "}
            {formatPeso(payableTotal)}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onCreateRemittance}
          disabled={eligibleCount === 0}
        >
          <ReceiptText size={16} />
          Create Remittance
        </button>
      </div>
    );
  }

  return null;
}

function RemittanceOrderModal({
  supplier,
  payables,
  selectedIds,
  form,
  setForm,
  saving,
  formatPeso,
  formatDate,
  onToggle,
  onSubmit,
  onClose,
}) {
  const selectedTotal = payables
    .filter((item) =>
      selectedIds.includes(Number(item.payable_id))
    )
    .reduce(
      (sum, item) =>
        sum + Number(item.balance_amount || 0),
      0
    );

  return (
    <div className="modal-overlay supplier-modal-overlay">
      <div className="modal-box supplier-payment-modal">
        <form className="supplier-payment-modal-form" onSubmit={onSubmit}>
          <div className="supplier-modal-header">
            <div>
              <div className="supplier-modal-title-row">
                <div className="supplier-modal-icon">
                  <ReceiptText size={21} />
                </div>
                <h2>Record Supplier Payment</h2>
              </div>
              <p>
                Select the payable, enter how much will be paid now,
                and keep the remaining balance for the next payment.
              </p>
            </div>

            <button
              type="button"
              className="supplier-modal-close"
              onClick={onClose}
              disabled={saving}
            >
              <X size={20} />
            </button>
          </div>

          <div className="supplier-payment-modal-body">
            <div className="supplier-payable-selection">
              {payables.map((payable) => {
                const checked = selectedIds.includes(
                  Number(payable.payable_id)
                );

                return (
                  <button
                    type="button"
                    key={payable.payable_id}
                    className={
                      checked
                        ? "supplier-payable-option selected"
                        : "supplier-payable-option"
                    }
                    onClick={() =>
                      onToggle(payable.payable_id)
                    }
                  >
                    {checked ? (
                      <CheckSquare size={19} />
                    ) : (
                      <Square size={19} />
                    )}

                    <span>
                      <strong>
                        {payable.delivery_order_no ||
                          `Delivery ${payable.delivery_id}`}
                      </strong>
                      <small>
                        {formatDate(
                          payable.delivery_date
                        )}
                      </small>
                    </span>

                    <b>
                      {formatPeso(
                        payable.balance_amount
                      )}
                    </b>
                  </button>
                );
              })}
            </div>

            <div className="supplier-payment-total">
              <span>Outstanding Balance Selected</span>
              <strong>
                {formatPeso(selectedTotal)}
              </strong>
            </div>

            <div className="supplier-business-form-grid">
              <SupplierInput
                label="Amount to Pay Now"
                required
              >
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedTotal}
                  value={form.amount_to_pay}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount_to_pay: event.target.value,
                    }))
                  }
                  placeholder="Example: 2500.00"
                  required
                />
              </SupplierInput>

              <SupplierInput label="Balance After Payment">
                <input
                  type="text"
                  value={formatPeso(
                    Math.max(
                      0,
                      selectedTotal - Number(form.amount_to_pay || 0)
                    )
                  )}
                  readOnly
                />
              </SupplierInput>
              <SupplierInput label="Payment Method" required>
                <select
                  required
                  value={form.payment_method}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      payment_method:
                        event.target.value,
                    }))
                  }
                >
                  <option value="">
                    Select payment method
                  </option>
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Bank Transfer">
                    Bank Transfer
                  </option>
                  <option value="Cheque">
                    Cheque
                  </option>
                </select>
              </SupplierInput>

              <SupplierInput label="Payment Date" required>
                <input
                  type="date"
                  max={getPhilippineDate()}
                  value={form.release_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      release_date:
                        event.target.value,
                    }))
                  }
                />
              </SupplierInput>

              <SupplierInput
                label="Reference Number"
                wide
              >
                <input
                  type="text"
                  value={form.reference_number}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reference_number:
                        event.target.value,
                    }))
                  }
                  placeholder="Optional payment or cheque reference"
                />
              </SupplierInput>

              <SupplierInput
                label="Remarks"
                wide
                textarea
              >
                <textarea
                  value={form.remarks}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      remarks: event.target.value,
                    }))
                  }
                  rows="3"
                  placeholder="Optional remittance remarks"
                />
              </SupplierInput>
            </div>
          </div>

          <div className="supplier-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                saving ||
                selectedIds.length === 0 ||
                Number(form.amount_to_pay || 0) <= 0 ||
                Number(form.amount_to_pay || 0) > selectedTotal ||
                !form.payment_method
              }
            >
              {saving ? (
                <LoaderCircle
                  size={16}
                  className="supplier-spinner"
                />
              ) : (
                <Send size={16} />
              )}
              {saving
                ? "Recording..."
                : "Record Payment & Receipt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplierPaymentModal({
  supplier,
  payable = null,
  remittance = null,
  form,
  setForm,
  saving,
  formatPeso,
  onSubmit,
  onClose,
}) {
  const subject = payable || remittance || {};

  const remainingBalance = Number(
    subject.remaining_balance || 0
  );

  const referenceLabel = payable
    ? payable.delivery_order_no ||
      `Payable ${payable.payable_id}`
    : remittance?.remittance_order_no ||
      "Remittance";

  return (
    <div className="modal-overlay supplier-modal-overlay">
      <div className="modal-box supplier-payment-modal compact">
        <form onSubmit={onSubmit}>
          <div className="supplier-modal-header">
            <div>
              <div className="supplier-modal-title-row">
                <div className="supplier-modal-icon">
                  <Banknote size={21} />
                </div>
                <h2>Record Supplier Payment</h2>
              </div>
              <p>
                {supplier?.vendor_name} •{" "}
                {referenceLabel}
              </p>
            </div>

            <button
              type="button"
              className="supplier-modal-close"
              onClick={onClose}
              disabled={saving}
            >
              <X size={20} />
            </button>
          </div>

          <div className="supplier-payment-modal-body">
            <div className="supplier-payment-total">
              <span>Remaining Balance</span>
              <strong>
                {formatPeso(
                  remainingBalance
                )}
              </strong>
            </div>

            <div className="supplier-business-form-grid">
              <SupplierInput
                label="Amount Paid"
                required
              >
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={remainingBalance}
                  value={form.amount_paid}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount_paid:
                        event.target.value,
                    }))
                  }
                  required
                />
              </SupplierInput>

              <SupplierInput
                label="Payment Date"
                required
              >
                <input
                  type="date"
                  max={getPhilippineDate()}
                  value={form.payment_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      payment_date:
                        event.target.value,
                    }))
                  }
                  required
                />
              </SupplierInput>

              <SupplierInput
                label="Payment Method"
                required
              >
                <select
                  value={form.payment_method}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      payment_method:
                        event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">
                    Select method
                  </option>
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Bank Transfer">
                    Bank Transfer
                  </option>
                  <option value="Cheque">
                    Cheque
                  </option>
                </select>
              </SupplierInput>

              <SupplierInput label="Reference Number">
                <input
                  type="text"
                  value={form.reference_number}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reference_number:
                        event.target.value,
                    }))
                  }
                  placeholder="Transaction reference"
                />
              </SupplierInput>

              <SupplierInput
                label="Received By"
                wide
              >
                <input
                  type="text"
                  value={form.received_by}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      received_by:
                        event.target.value,
                    }))
                  }
                  placeholder="Supplier representative"
                />
              </SupplierInput>

              <SupplierInput
                label="Remarks"
                wide
                textarea
              >
                <textarea
                  value={form.remarks}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      remarks: event.target.value,
                    }))
                  }
                  rows="3"
                />
              </SupplierInput>
            </div>
          </div>

          <div className="supplier-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <LoaderCircle
                  size={16}
                  className="supplier-spinner"
                />
              ) : (
                <Banknote size={16} />
              )}
              {saving
                ? "Recording..."
                : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RemittanceReceiptModal({
  data,
  supplier = null,
  formatPeso,
  formatDate,
  processorName = "",
  onClose,
}) {
  const order = data.order || {};
  const items = Array.isArray(data.items)
    ? data.items
    : [];
  const payments = Array.isArray(data.payments)
    ? data.payments
    : [];

  const totalPaid = payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount_paid || 0),
    0
  );

  const remainingBalance = Math.max(
    0,
    Number(order.total_amount || 0) - totalPaid
  );

  const supplierName =
    order.vendor_name ||
    supplier?.vendor_name ||
    "Not provided";

  const supplierAddress =
    order.vendor_address ||
    order.supplier_address ||
    order.address ||
    supplier?.address ||
    "Not provided";

  const preparedBy =
    order.prepared_by_name ||
    order.prepared_by ||
    processorName ||
    "";

  const approvedBy =
    order.approved_by_name ||
    order.approved_by ||
    processorName ||
    "";

  const releasedBy =
    order.released_by_name ||
    order.released_by ||
    preparedBy ||
    processorName ||
    "";

  const minimumRows = 9;
  const blankRows = Math.max(
    0,
    minimumRows - items.length
  );

  const printReceipt = () => {
    const receiptElement =
      document.getElementById(
        "hs-remittance-document"
      );

    if (!receiptElement) {
      return;
    }

    const printFrame =
      document.createElement("iframe");

    printFrame.setAttribute(
      "title",
      "Supplier Remittance Receipt"
    );

    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.visibility = "hidden";

    document.body.appendChild(printFrame);

    const frameDocument =
      printFrame.contentDocument ||
      printFrame.contentWindow?.document;

    if (!frameDocument) {
      printFrame.remove();
      return;
    }

    frameDocument.open();
    frameDocument.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Supplier Remittance Receipt</title>

          <style>
            @page {
              size: 8.5in 13in;
              margin: 0.38in;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif !important;
            }

            .hs-remit-doc {
              width: 100%;
              max-width: none;
              margin: 0;
              padding: 0;
              border: 0;
              background: #ffffff;
              box-shadow: none;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif !important;
            }

            .hs-remit-header {
              display: grid;
              grid-template-columns: auto 1fr auto;
              gap: 14px;
              align-items: center;
              padding-bottom: 11px;
              border-bottom: 1px solid #111827;
            }

            .hs-remit-logo {
              width: 48px;
              height: 48px;
              object-fit: contain;
            }

            .hs-remit-brand h1 {
              margin: 0;
              font-size: 14px;
              font-weight: 800;
              text-transform: none;
            }

            .hs-remit-brand p {
              margin: 3px 0 0;
              font-size: 7.5px;
            }

            .hs-remit-number {
              min-width: 145px;
              text-align: right;
            }

            .hs-remit-number span {
              display: block;
              margin-bottom: 3px;
              font-size: 7px;
              font-weight: 700;
              text-transform: uppercase;
            }

            .hs-remit-number strong {
              font-size: 10px;
            }

            .hs-remit-title {
              padding: 12px 0 10px;
              text-align: center;
            }

            .hs-remit-title h2 {
              margin: 0;
              font-size: 13px;
              font-weight: 700;
              text-transform: uppercase;
            }

            .hs-remit-fields {
              display: grid;
              grid-template-columns: 1fr 0.62fr;
              gap: 7px 34px;
              margin-bottom: 12px;
            }

            .hs-remit-field {
              display: grid;
              grid-template-columns: 95px 1fr;
              gap: 8px;
              align-items: end;
              min-width: 0;
            }

            .hs-remit-field > span {
              padding-bottom: 3px;
              font-size: 7px;
              font-weight: 700;
              text-transform: uppercase;
              white-space: nowrap;
            }

            .hs-remit-field > strong {
              min-width: 0;
              min-height: 18px;
              padding: 2px 3px 3px;
              border-bottom: 0.7px solid #555555;
              font-size: 8px;
              font-weight: 500;
              overflow-wrap: anywhere;
            }

            .hs-remit-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }

            .hs-remit-table th,
            .hs-remit-table td {
              height: 27px;
              padding: 4px 6px;
              border: 0.65px solid #777777;
              background: #ffffff;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif !important;
              font-size: 8px;
              vertical-align: middle;
            }

            .hs-remit-table th {
              font-size: 7.6px;
              font-weight: 700;
              text-align: center;
              text-transform: uppercase;
            }

            .hs-remit-table th:nth-child(1) {
              width: 32%;
            }

            .hs-remit-table th:nth-child(2),
            .hs-remit-table th:nth-child(3),
            .hs-remit-table th:nth-child(4) {
              width: 22.66%;
            }

            .hs-remit-table td:not(:first-child) {
              text-align: right;
            }

            .hs-remit-empty-row td {
              height: 27px;
            }

            .hs-remit-total-row td {
              height: 25px;
              font-weight: 700;
            }

            .hs-remit-total-label {
              text-align: right !important;
              text-transform: uppercase;
            }

            .hs-remit-total-value {
              text-align: right !important;
              font-weight: 700 !important;
            }

            .hs-remit-summary {
              display: flex;
              justify-content: flex-end;
              gap: 18px;
              margin-top: 7px;
              font-size: 7.5px;
            }

            .hs-remit-summary span {
              display: flex;
              gap: 5px;
            }

            .hs-remit-certification {
              margin-top: 16px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              font-size: 7px;
              line-height: 1.4;
            }

            .hs-remit-certification p {
              margin: 0;
            }

            .hs-remit-signatures {
              margin-top: 31px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 42px;
              page-break-inside: avoid;
            }

            .hs-remit-signature {
              text-align: center;
            }

            .hs-remit-signature .line {
              min-height: 18px;
              padding-bottom: 3px;
              border-bottom: 0.8px solid #333333;
              font-size: 8px;
            }

            .hs-remit-signature strong {
              display: block;
              margin-top: 4px;
              font-size: 7.5px;
              font-weight: 700;
            }

            .hs-remit-footnote {
              margin-top: 15px;
              padding-top: 6px;
              border-top: 0.5px solid #cbd5e1;
              color: #64748b;
              font-size: 6.8px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          ${receiptElement.outerHTML}
        </body>
      </html>
    `);

    frameDocument.close();

    const runPrint = () => {
      const frameWindow =
        printFrame.contentWindow;

      if (!frameWindow) {
        printFrame.remove();
        return;
      }

      frameWindow.focus();
      frameWindow.print();

      window.setTimeout(() => {
        printFrame.remove();
      }, 1000);
    };

    const logo =
      frameDocument.querySelector(
        ".hs-remit-logo"
      );

    if (logo && !logo.complete) {
      logo.addEventListener(
        "load",
        runPrint,
        { once: true }
      );

      logo.addEventListener(
        "error",
        runPrint,
        { once: true }
      );
    } else {
      window.setTimeout(runPrint, 250);
    }
  };

  return (
    <div className="modal-overlay supplier-modal-overlay supplier-receipt-overlay">
      <style>{`
        .supplier-receipt-modal.hs-remit-modal {
          width: min(1050px, 94vw) !important;
          max-width: 1050px !important;
          max-height: 92vh !important;
          padding: 0 !important;
          overflow: hidden !important;
          border-radius: 18px !important;
          background: #ffffff !important;
        }

        .hs-remit-modal .supplier-modal-header {
          padding: 18px 22px !important;
          border-bottom: 1px solid #e5e7eb !important;
          background: #ffffff !important;
        }

        .hs-remit-modal .supplier-receipt-scroll-area {
          height: calc(92vh - 142px);
          padding: 18px 24px;
          overflow: auto;
          background: #eef1f5 !important;
        }

        .hs-remit-doc {
          width: min(860px, 100%);
          min-height: 640px;
          margin: 0 auto;
          padding: 32px 38px 27px;
          border: 1px solid #cbd5e1;
          background: #ffffff !important;
          color: #111827 !important;
          font-family: Arial, Helvetica, sans-serif !important;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
        }

        .hs-remit-doc,
        .hs-remit-doc * {
          font-family: Arial, Helvetica, sans-serif !important;
          letter-spacing: normal !important;
        }

        .hs-remit-header {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 14px;
          align-items: center;
          padding-bottom: 13px;
          border-bottom: 1px solid #111827;
        }

        .hs-remit-logo {
          width: 54px;
          height: 54px;
          object-fit: contain;
        }

        .hs-remit-brand h1 {
          margin: 0;
          color: #111827;
          font-size: 18px;
          font-weight: 900;
          text-transform: none;
        }

        .hs-remit-brand p {
          margin: 4px 0 0;
          color: #475569;
          font-size: 10px;
        }

        .hs-remit-number {
          min-width: 175px;
          text-align: right;
        }

        .hs-remit-number span {
          display: block;
          margin-bottom: 4px;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .hs-remit-number strong {
          color: #111827;
          font-size: 13px;
          font-weight: 900;
        }

        .hs-remit-title {
          padding: 18px 0 15px;
          text-align: center;
        }

        .hs-remit-title h2 {
          margin: 0;
          color: #111827;
          font-size: 17px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .hs-remit-fields {
          display: grid;
          grid-template-columns: 1fr 0.62fr;
          gap: 10px 36px;
          margin-bottom: 16px;
        }

        .hs-remit-field {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 9px;
          align-items: end;
          min-width: 0;
        }

        .hs-remit-field > span {
          padding-bottom: 4px;
          color: #475569;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .hs-remit-field > strong {
          min-width: 0;
          min-height: 23px;
          padding: 3px 4px 4px;
          border-bottom: 1px solid #64748b;
          color: #111827;
          font-size: 10.5px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .hs-remit-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .hs-remit-table th,
        .hs-remit-table td {
          height: 36px;
          padding: 6px 9px;
          border: 1px solid #94a3b8 !important;
          background: #ffffff !important;
          color: #111827 !important;
          font-size: 10px;
          vertical-align: middle;
        }

        .hs-remit-table th {
          font-size: 9px;
          font-weight: 900;
          text-align: center;
          text-transform: uppercase;
          background: #f8fafc !important;
        }

        .hs-remit-table th:nth-child(1) {
          width: 32%;
        }

        .hs-remit-table th:nth-child(2),
        .hs-remit-table th:nth-child(3),
        .hs-remit-table th:nth-child(4) {
          width: 22.66%;
        }

        .hs-remit-table td:not(:first-child) {
          text-align: right;
        }

        .hs-remit-empty-row td {
          height: 36px;
        }

        .hs-remit-total-row td {
          height: 32px;
          background: #ffffff !important;
          font-weight: 800;
        }

        .hs-remit-total-label {
          text-align: right !important;
          text-transform: uppercase;
        }

        .hs-remit-total-value {
          text-align: right !important;
          font-weight: 900 !important;
        }

        .hs-remit-summary {
          display: flex;
          justify-content: flex-end;
          gap: 18px;
          margin-top: 8px;
          color: #475569;
          font-size: 9px;
        }

        .hs-remit-summary span {
          display: flex;
          gap: 5px;
        }

        .hs-remit-summary strong {
          color: #111827;
        }

        .hs-remit-certification {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 42px;
          color: #475569;
          font-size: 9px;
          line-height: 1.45;
        }

        .hs-remit-certification p {
          margin: 0;
        }

        .hs-remit-signatures {
          margin-top: 40px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 55px;
        }

        .hs-remit-signature {
          text-align: center;
        }

        .hs-remit-signature .line {
          min-height: 23px;
          padding-bottom: 4px;
          border-bottom: 1px solid #111827;
          color: #111827;
          font-size: 10px;
        }

        .hs-remit-signature strong {
          display: block;
          margin-top: 5px;
          color: #111827;
          font-size: 9px;
          font-weight: 800;
        }

        .hs-remit-footnote {
          margin-top: 18px;
          padding-top: 7px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 8px;
          text-align: center;
        }

        .hs-remit-modal .supplier-modal-footer {
          flex: 0 0 auto;
          padding: 14px 22px !important;
          border-top: 1px solid #e5e7eb !important;
          background: #ffffff !important;
        }

        @media (max-width: 760px) {
          .hs-remit-modal .supplier-receipt-scroll-area {
            padding: 12px;
          }

          .hs-remit-doc {
            padding: 24px 20px;
          }

          .hs-remit-header {
            grid-template-columns: auto 1fr;
          }

          .hs-remit-number {
            grid-column: 1 / -1;
            text-align: left;
          }

          .hs-remit-fields {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="modal-box supplier-receipt-modal hs-remit-modal">
        <div className="supplier-modal-header no-print">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon">
                <ReceiptText size={21} />
              </div>

              <h2>
                Supplier Remittance Receipt
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="supplier-receipt-scroll-area">
          <main
            className="hs-remit-doc"
            id="hs-remittance-document"
          >
            <header className="hs-remit-header">
              <img
                className="hs-remit-logo"
                src={bacnotanLogo}
                alt="Bacnotan Logo"
              />

              <div className="hs-remit-brand">
                <h1>
                  Bacnotan Farmers Agri-Tourism Center
                </h1>

                <p>
                  HiveSync Integrated Business and Operations Management System
                </p>
              </div>

              <div className="hs-remit-number">
                <span>
                  Remittance Receipt No.
                </span>

                <strong>
                  {order.remittance_order_no ||
                    "N/A"}
                </strong>
              </div>
            </header>

            <section className="hs-remit-title">
              <h2>
                Supplier Remittance Receipt
              </h2>
            </section>

            <section className="hs-remit-fields">
              <div className="hs-remit-field">
                <span>Released To</span>

                <strong>
                  BACNOTAN FARMERS AGRI-TOURISM CENTER
                </strong>
              </div>

              <div className="hs-remit-field">
                <span>Date</span>

                <strong>
                  {order.release_date
                    ? formatDate(
                        order.release_date
                      )
                    : "Not released"}
                </strong>
              </div>

              <div className="hs-remit-field">
                <span>Supplier</span>

                <strong>
                  {supplierName}
                </strong>
              </div>

              <div className="hs-remit-field">
                <span>Released By</span>

                <strong>
                  {releasedBy}
                </strong>
              </div>

              <div className="hs-remit-field">
                <span>Supplier Address</span>

                <strong>
                  {supplierAddress}
                </strong>
              </div>

              <div className="hs-remit-field">
                <span>Status</span>

                <strong>
                  {order.status || "N/A"}
                </strong>
              </div>
            </section>

            <table className="hs-remit-table">
              <thead>
                <tr>
                  <th>Delivery</th>
                  <th>Payable</th>
                  <th>Paid</th>
                  <th>Balance</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="4">
                      No linked payable details.
                    </td>
                  </tr>
                ) : (
                  items.map(
                    (item, index) => (
                      <tr
                        key={
                          item.payable_id ||
                          index
                        }
                      >
                        <td>
                          {item.delivery_order_no ||
                            item.delivery_id ||
                            "N/A"}
                        </td>

                        <td>
                          {formatPeso(
                            item.payable_amount ||
                              item.amount ||
                              item.remittance_amount
                          )}
                        </td>

                        <td>
                          {formatPeso(
                            item.paid_amount
                          )}
                        </td>

                        <td>
                          {formatPeso(
                            item.balance_amount
                          )}
                        </td>
                      </tr>
                    )
                  )
                )}

                {Array.from({
                  length: blankRows,
                }).map((_, index) => (
                  <tr
                    key={`hs-remit-empty-${index}`}
                    className="hs-remit-empty-row"
                  >
                    <td>&nbsp;</td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}

                <tr className="hs-remit-total-row">
                  <td colSpan="2"></td>

                  <td className="hs-remit-total-label">
                    Total Remittance
                  </td>

                  <td className="hs-remit-total-value">
                    {formatPeso(
                      order.total_amount
                    )}
                  </td>
                </tr>

                <tr className="hs-remit-total-row">
                  <td colSpan="2"></td>

                  <td className="hs-remit-total-label">
                    Total Paid
                  </td>

                  <td className="hs-remit-total-value">
                    {formatPeso(totalPaid)}
                  </td>
                </tr>

                <tr className="hs-remit-total-row">
                  <td colSpan="2"></td>

                  <td className="hs-remit-total-label">
                    Remaining
                  </td>

                  <td className="hs-remit-total-value">
                    {formatPeso(
                      remainingBalance
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="hs-remit-summary">
              <span>
                Payable Lines:
                <strong>
                  {items.length}
                </strong>
              </span>

              <span>
                Payments:
                <strong>
                  {payments.length}
                </strong>
              </span>
            </div>

            <section className="hs-remit-certification">
              <p>
                Checked and certified that the above supplier remittance was processed and recorded in HiveSync.
              </p>

              <p>
                Payment and balance details are based on the recorded supplier finance transaction.
              </p>
            </section>

            <section className="hs-remit-signatures">
              <div className="hs-remit-signature">
                <div className="line">
                  {preparedBy}
                </div>

                <strong>
                  Prepared / Processed By
                </strong>
              </div>

              <div className="hs-remit-signature">
                <div className="line">
                  {approvedBy}
                </div>

                <strong>
                  Approved / Acknowledged By
                </strong>
              </div>
            </section>

            <footer className="hs-remit-footnote">
              This supplier remittance receipt was generated through HiveSync.
            </footer>
          </main>
        </div>

        <div className="supplier-modal-footer no-print">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={printReceipt}
          >
            <Printer size={16} />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}


function SupplierFormModal({
  mode,
  data,
  saving,
  onChange,
  onSubmit,
  onClose,
}) {
  const isEditing = mode === "edit";

  return (
    <div className="modal-overlay supplier-modal-overlay">
      <div className="modal-box supplier-profile-modal">
        <div className="supplier-modal-header">
          <div>
            <div className="supplier-modal-title-row">
              <div className="supplier-modal-icon">
                <Building2 size={21} />
              </div>

              <h2>
                {isEditing
                  ? "Edit Supplier"
                  : "Add Supplier"}
              </h2>
            </div>

            <p>
              {isEditing
                ? "Update the supplier profile reused throughout HiveSync."
                : "Register the supplier once, then reuse it in deliveries, inventory, payments, and reports."}
            </p>
          </div>

          <button
            type="button"
            className="supplier-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="supplier-profile-body">
            <div className="supplier-profile-summary">
              <div className="supplier-profile-summary-icon">
                <Building2 size={27} />
              </div>

              <div>
                <h3>
                  Business Profile
                </h3>

                <p>
                  Product, quantity, pricing,
                  expiry, and consignment are
                  entered later in Delivery
                  Management to prevent duplicate
                  encoding.
                </p>
              </div>
            </div>

            <div className="supplier-form-section">
              <div className="supplier-business-form-grid">
                <SupplierInput
                  label="Supplier Name"
                  required
                  icon={<Building2 size={17} />}
                >
                  <input
                    type="text"
                    name="vendor_name"
                    value={data.vendor_name}
                    onChange={onChange}
                    placeholder="Enter supplier or business name"
                    maxLength={150}
                    autoFocus
                  />
                </SupplierInput>

                <SupplierInput
                  label="Contact Person"
                  icon={<UserRound size={17} />}
                >
                  <input
                    type="text"
                    name="contact_person"
                    value={
                      data.contact_person
                    }
                    onChange={onChange}
                    placeholder="Enter primary contact person"
                    maxLength={150}
                  />
                </SupplierInput>

                <SupplierInput
                  label="Phone Number"
                  icon={<Phone size={17} />}
                  wide
                  help="Use an 11-digit Philippine mobile number beginning with 09."
                >
                  <input
                    type="text"
                    name="phone"
                    value={data.phone}
                    onChange={onChange}
                    placeholder="09XXXXXXXXX"
                    inputMode="numeric"
                    maxLength={11}
                  />
                </SupplierInput>

                <SupplierInput
                  label="Business Address"
                  icon={<MapPin size={17} />}
                  wide
                  textarea
                >
                  <textarea
                    name="address"
                    value={data.address}
                    onChange={onChange}
                    placeholder="Enter complete supplier address"
                    rows="4"
                    maxLength={500}
                  />
                </SupplierInput>
              </div>
            </div>

            <div className="supplier-process-note">
              <Truck size={19} />

              <div>
                <strong>
                  Connected business process
                </strong>

                <span>
                  After saving, select this
                  supplier in Delivery Management.
                  Products and stock are created or
                  updated there only once.
                </span>
              </div>
            </div>
          </div>

          <div className="supplier-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving && (
                <LoaderCircle
                  size={17}
                  className="supplier-spinner"
                />
              )}

              {saving
                ? "Saving..."
                : isEditing
                ? "Update Supplier"
                : "Save Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplierInput({
  label,
  required,
  icon,
  wide,
  textarea,
  help,
  children,
}) {
  return (
    <div
      className={`supplier-field ${
        wide ? "supplier-full-field" : ""
      }`}
    >
      <label>
        {label}
        {required && <strong> *</strong>}
      </label>

      <div
        className={
          textarea
            ? "supplier-textarea-wrap"
            : "supplier-input-wrap"
        }
      >
        {icon}
        {children}
      </div>

      {help && <small>{help}</small>}
    </div>
  );
}

function SupplierStatCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="module-card supplier-stat-card">
      <div className="supplier-stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <h2>{value}</h2>
      </div>
    </div>
  );
}

function SupplierOverviewCard({
  icon,
  label,
  value,
  type = "",
}) {
  return (
    <div
      className={`supplier-overview-card ${type}`}
    >
      <div>{icon}</div>

      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function SupplierMiniSummary({
  icon,
  label,
  value,
  wide,
}) {
  return (
    <div
      className={
        wide
          ? "supplier-summary-wide"
          : ""
      }
    >
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SupplierContactItem({
  icon,
  label,
  value,
}) {
  return (
    <div>
      {icon}

      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function MetricRow({
  label,
  value,
  important,
  success,
}) {
  return (
    <div
      className={`supplier-metric-row ${
        important ? "important" : ""
      } ${success ? "success" : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BusinessTable({
  headings,
  className,
  children,
}) {
  return (
    <div className="supplier-business-table-wrapper">
      <table
        className={`supplier-business-table ${className}`}
      >
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function StatusBadge({ value }) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <span
      className={`supplier-delivery-status ${normalized}`}
    >
      {value || "Unknown"}
    </span>
  );
}

function PaymentStatusBadge({
  status,
  overdue = false,
}) {
  const normalized = String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <span
      className={`supplier-payment-status ${normalized} ${
        overdue ? "overdue" : ""
      }`}
    >
      {overdue
        ? "Overdue"
        : status || "Not Generated"}
    </span>
  );
}

function LoadingState({ text }) {
  return (
    <div className="supplier-loading-state">
      <LoaderCircle
        size={29}
        className="supplier-spinner"
      />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="supplier-empty-state">
      <div className="supplier-empty-icon">
        <Building2 size={28} />
      </div>

      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

function ConfirmationModal({
  data,
  saving,
  onConfirm,
  onClose,
}) {
  const danger = data.action === "archive";

  return (
    <div className="modal-overlay supplier-modal-top">
      <div className="modal-box supplier-confirm-modal">
        <div
          className={`supplier-confirm-icon ${
            danger ? "danger" : ""
          }`}
        >
          {danger ? (
            <Archive size={28} />
          ) : (
            <ArchiveRestore size={28} />
          )}
        </div>

        <h2>{data.title}</h2>
        <p>{data.message}</p>

        <div className="supplier-confirm-actions">
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
              danger
                ? "supplier-danger-btn"
                : "primary-btn"
            }
            onClick={onConfirm}
            disabled={saving}
          >
            {saving && (
              <LoaderCircle
                size={17}
                className="supplier-spinner"
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
  const isError = data.type === "error";

  return (
    <div
      className="modal-overlay supplier-notice-overlay"
      style={{ zIndex: 20000 }}
    >
      <div
        className="modal-box supplier-notice-modal"
        style={{ zIndex: 20001 }}
      >
        <div
          className={`supplier-notice-icon ${
            isError ? "error" : ""
          }`}
        >
          {isError ? (
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

export default VendorManagement;