import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Eye,
  FileClock,
  FileSpreadsheet,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Package,
  Pencil,
  PhilippinePeso,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";

import "../styles/module.css";
import "../styles/inventory.css";
import API_BASE from "../config/api";



const EMPTY_RESTOCK_FORM = {
  quantity: "",
  preferred_delivery_date: "",
  remarks: "",
};

const EMPTY_FORM = {
  product_name: "",
  sku: "",
  category_id: "",
  category: "",
  unit_type: "pcs",
  unit: "pcs",
  reorder_level: "5",
  supplier_price: "",
  selling_price: "",
  expiry_date: "",
  no_expiry: false,
  vendor_id: "",
  product_image: null,
  family_id: "",
  request_variant_id: "",
  variant_label: "",
  variant_value: "",
  variant_unit: "",
  variant_sort: "0",
  publication_status: "Draft",
};

const DEFAULT_UNIT_OPTIONS = [
  { value: "pcs", label: "Piece / pcs" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "set", label: "Set" },
];

const addDaysToDate = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">
      <rect width="320" height="220" fill="#F5F7FA"/>
      <rect x="1" y="1" width="318" height="218" rx="12"
            fill="none" stroke="#E5E7EB" stroke-width="2"/>

      <g transform="translate(128 60)">
        <rect x="0" y="0" width="64" height="64" rx="10"
              fill="#FFFFFF" stroke="#F4B400" stroke-width="3"/>

        <path d="M16 46 L28 32 L37 40 L45 31 L54 46"
              fill="none" stroke="#1B2430"
              stroke-width="3" stroke-linecap="round"
              stroke-linejoin="round"/>

        <circle cx="43" cy="20" r="6" fill="#F4B400"/>
      </g>

      <text x="160" y="153"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="16"
            font-weight="700"
            fill="#1B2430">
        No Product Image
      </text>

      <text x="160" y="176"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="12"
            fill="#6B7280">
        HiveSync
      </text>
    </svg>
  `);


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


function InventoryManagement({ user }) {
  const role = user?.role || "Staff";

  const isSupplier =
    role === "Supplier" || role === "Vendor";

  const canManageInventory =
    role === "Admin" || role === "Staff";

  const supplierVendorId =
    user?.vendor_id || user?.supplier_id || "";

  const currentDate = new Date();
  const today = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1
  ).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] =
    useState(true);
  const [saving, setSaving] = useState(false);
  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const INVENTORY_PAGE_SIZE = 15;
  const [inventoryPage, setInventoryPage] = useState(1);
  const [categoryFilter, setCategoryFilter] =
    useState("All");
  const [supplierFilter, setSupplierFilter] =
    useState("All");
  const [stockFilter, setStockFilter] =
    useState("All");
  const [expiryFilter, setExpiryFilter] =
    useState("All");
  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");

  const [showProductModal, setShowProductModal] =
    useState(false);
  const [showDetailsModal, setShowDetailsModal] =
    useState(false);
  const [showRestockModal, setShowRestockModal] =
    useState(false);
  const [showConfirmModal, setShowConfirmModal] =
    useState(false);
  const [showPublishModal, setShowPublishModal] =
    useState(false);

  const [formMode, setFormMode] = useState("add");
  const [formData, setFormData] =
    useState(EMPTY_FORM);
  const [imagePreview, setImagePreview] =
    useState("");
  const [restockForm, setRestockForm] =
    useState(EMPTY_RESTOCK_FORM);
  const [publishPrice, setPublishPrice] =
    useState("");

  const [selectedProduct, setSelectedProduct] =
    useState(null);
  const [productDetails, setProductDetails] =
    useState(null);

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
    product: null,
  });

  const parseJsonResponse = async (response) => {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Invalid server response:", text);

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

  const formatProductId = (productId) =>
    `INV-${String(productId || 0).padStart(4, "0")}`;

  const formatPeso = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (value) => {
    if (!value) {
      return "No expiry";
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
      return "Not recorded";
    }

    const normalized = String(value).replace(" ", "T");
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

  const getProductImage = (product) => {
    const image =
      product?.product_image_url ||
      product?.product_image ||
      product?.image_preview ||
      "";

    if (!image) {
      return PLACEHOLDER_IMAGE;
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
            module: "Inventory Management",
            action,
            details,
          }),
        }
      );
    } catch (error) {
      console.error("Audit Trail error:", error);
    }
  };

  const loadProducts = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        role,
        vendor_id: isSupplier
          ? String(supplierVendorId || "")
          : "",
        time: String(Date.now()),
      });

      const response = await fetch(
        `${API_BASE}/inventory_management/get_products.php?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to retrieve inventory products."
        );
      }

      setProducts(data.products || []);
    } catch (error) {
      console.error("Inventory loading error:", error);
      setProducts([]);

      showNotice(
        "error",
        "Unable to Load Inventory",
        error.message ||
          "Inventory products could not be retrieved."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    setReferenceLoading(true);

    try {
      const [categoryResponse, vendorResponse] =
        await Promise.all([
          fetch(
            `${API_BASE}/inventory_management/get_categories.php?time=${Date.now()}`,
            {
              credentials: "include",
            }
          ),
          fetch(
            `${API_BASE}/vendor_management/get_vendors.php?time=${Date.now()}`,
            {
              credentials: "include",
            }
          ),
        ]);

      const [categoryData, vendorData] =
        await Promise.all([
          parseJsonResponse(categoryResponse),
          parseJsonResponse(vendorResponse),
        ]);

      if (!categoryData.success) {
        throw new Error(
          categoryData.message ||
            "Unable to load categories."
        );
      }

      if (!vendorData.success) {
        throw new Error(
          vendorData.message ||
            "Unable to load suppliers."
        );
      }

      setCategories(categoryData.categories || []);

      setVendors(
        (vendorData.vendors || []).filter(
          (vendor) =>
            vendor.status !== "Archived"
        )
      );
    } catch (error) {
      console.error(
        "Inventory reference error:",
        error
      );

      showNotice(
        "error",
        "Unable to Load Inventory References",
        error.message ||
          "Categories and suppliers could not be loaded."
      );
    } finally {
      setReferenceLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();

    if (!isSupplier) {
      loadReferenceData();
    }
  }, [role, supplierVendorId]);

  const getStockStatus = (product) => {
    const quantity = Number(product.quantity || 0);
    const reorderLevel = Number(
      product.reorder_level || 0
    );
    const deliveryCount = Number(
      product.delivery_count || 0
    );

    if (quantity <= 0 && deliveryCount <= 0) {
      return "Awaiting First Delivery";
    }

    if (product.computed_status) {
      return product.computed_status;
    }

    if (quantity <= 0) {
      return "Out of Stock";
    }

    if (quantity <= reorderLevel) {
      return "Low Stock";
    }

    return "In Stock";
  };

  const getExpiryStatus = (product) => {
  const expiryValue =
    product.nearest_expiry_date ||
    product.expiry_date;

  if (!expiryValue) {
    return "No Expiry";
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const expiryDate = new Date(
    `${expiryValue}T00:00:00`
  );
  expiryDate.setHours(0, 0, 0, 0);

  const differenceDays = Math.ceil(
    (expiryDate.getTime() - currentDate.getTime()) /
      86400000
  );

  if (differenceDays <= 0) {
    return "Expired";
  }

  if (differenceDays <= 10) {
    return "Near Expiry";
  }

  return "Safe";
};
  const statistics = useMemo(() => {
    return products.reduce(
      (summary, product) => {
        const status = getStockStatus(product);

        summary.total += 1;

        if (status === "In Stock") {
          summary.inStock += 1;
        }

        if (status === "Low Stock") {
          summary.lowStock += 1;
        }

        if (status === "Out of Stock") {
          summary.outOfStock += 1;
        }

        if (
          getExpiryStatus(product) === "Near Expiry"
        ) {
          summary.nearExpiry += 1;
        }

        return summary;
      },
      {
        total: 0,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
        nearExpiry: 0,
      }
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = searchTerm
      .trim()
      .toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !keyword ||
        [
          formatProductId(product.product_id),
          product.product_name,
          product.sku,
          product.category_name,
          product.category,
          product.vendor_name,
          product.variant_label,
          product.variant_unit,
          product.display_name,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(keyword)
        );

      const matchesCategory =
        categoryFilter === "All" ||
        String(product.category_id) ===
          String(categoryFilter);

      const matchesSupplier =
        supplierFilter === "All" ||
        String(product.vendor_id) ===
          String(supplierFilter);

      const matchesStock =
        stockFilter === "All" ||
        getStockStatus(product) === stockFilter;

      const matchesExpiry =
        expiryFilter === "All" ||
        getExpiryStatus(product) ===
          expiryFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesSupplier &&
        matchesStock &&
        matchesExpiry
      );
    });
  }, [
    products,
    searchTerm,
    categoryFilter,
    supplierFilter,
    stockFilter,
    expiryFilter,
  ]);

  const paginatedProducts = useMemo(() => {
    const start =
      (inventoryPage - 1) *
      INVENTORY_PAGE_SIZE;

    return filteredProducts.slice(
      start,
      start + INVENTORY_PAGE_SIZE
    );
  }, [
    filteredProducts,
    inventoryPage,
  ]);

  useEffect(() => {
    setInventoryPage(1);
  }, [
    searchTerm,
    categoryFilter,
    supplierFilter,
    stockFilter,
    expiryFilter,
  ]);


  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("All");
    setSupplierFilter("All");
    setStockFilter("All");
    setExpiryFilter("All");
  };

  const exportInventory = () => {
    if (exportFromDate && exportToDate && exportFromDate > exportToDate) {
      showNotice(
        "error",
        "Invalid Date Range",
        "The From Date cannot be later than the To Date."
      );
      return;
    }

    const params = new URLSearchParams();

    if (exportFromDate) {
      params.set("from_date", exportFromDate);
    }

    if (exportToDate) {
      params.set("to_date", exportToDate);
    }

    if (isSupplier && supplierVendorId) {
      params.set("vendor_id", String(supplierVendorId));
    }

    params.set("role", role);
    params.set("time", String(Date.now()));

    window.location.href =
      `${API_BASE}/inventory_management/export_inventory.php?${params.toString()}`;
  };

  const getCategoryRecord = (categoryId) =>
    categories.find(
      (category) =>
        String(category.category_id) ===
        String(categoryId)
    ) || null;

  const getCategoryName = (categoryId) =>
    getCategoryRecord(categoryId)?.category_name || "";

  const normalizeUnitOptions = (category) => {
    if (!category?.units || !Array.isArray(category.units)) {
      return DEFAULT_UNIT_OPTIONS;
    }

    return category.units.map((unit) =>
      typeof unit === "string"
        ? { value: unit, label: unit }
        : unit
    );
  };

  const revokePreview = () => {
    if (
      imagePreview &&
      String(imagePreview).startsWith("blob:")
    ) {
      URL.revokeObjectURL(imagePreview);
    }
  };

  const openEditModal = (product) => {
    if (!canManageInventory) {
      return;
    }

    revokePreview();

    setFormMode("edit");
    setSelectedProduct(product);

    setFormData({
      product_name: product.product_name || "",
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
      reorder_level: String(
        product.reorder_level ?? 5
      ),
      supplier_price: String(
        product.supplier_price ?? ""
      ),
      selling_price: String(
        product.selling_price ?? ""
      ),
      expiry_date: product.expiry_date || "",
      no_expiry: !product.expiry_date,
      vendor_id: product.vendor_id || "",
      product_image: null,
      family_id: product.family_id || product.product_id || "",
      request_variant_id: product.request_variant_id || "",
      variant_label: product.variant_label === "Standard" ? "" : (product.variant_label || ""),
      variant_value: product.variant_value ?? "",
      variant_unit: product.variant_unit || "",
      variant_sort: String(product.variant_sort ?? 0),
      publication_status: product.publication_status || "Draft",
    });

    setImagePreview(getProductImage(product));
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    if (saving) {
      return;
    }

    revokePreview();

    setShowProductModal(false);
    setSelectedProduct(null);
    setFormMode("add");
    setFormData(EMPTY_FORM);
    setImagePreview("");
  };

  const handleFormChange = (event) => {
    const { name, value, files, checked } =
      event.target;

    if (name === "product_image") {
      const file = files?.[0] || null;

      revokePreview();

      setFormData((current) => ({
        ...current,
        product_image: file,
      }));

      setImagePreview(
        file ? URL.createObjectURL(file) : ""
      );

      return;
    }

    if (name === "category_id") {
      const category = getCategoryRecord(value);
      const unitOptions = normalizeUnitOptions(category);
      const firstUnit = unitOptions[0]?.value || "pcs";
      const allowsExpiry = category?.allows_expiry !== false;
      const defaultExpiryDays = Number(
        category?.default_expiry_days || 0
      );

      setFormData((current) => ({
        ...current,
        category_id: value,
        category: category?.category_name || "",
        unit_type: firstUnit,
        unit: firstUnit,
        no_expiry: !allowsExpiry,
        expiry_date: !allowsExpiry
          ? ""
          : defaultExpiryDays > 0
          ? addDaysToDate(defaultExpiryDays)
          : current.expiry_date,
      }));

      return;
    }

    if (name === "product_name") {
      setFormData((current) => ({
        ...current,
        product_name: value,
      }));

      return;
    }

    if (name === "unit_type") {
      setFormData((current) => ({
        ...current,
        unit_type: value,
        unit: value,
      }));

      return;
    }

    if (name === "no_expiry") {
      const category = getCategoryRecord(
        formData.category_id
      );

      if (category?.allows_expiry === false) {
        return;
      }

      setFormData((current) => ({
        ...current,
        no_expiry: checked,
        expiry_date: checked
          ? ""
          : current.expiry_date ||
            (category?.default_expiry_days
              ? addDaysToDate(
                  category.default_expiry_days
                )
              : ""),
      }));

      return;
    }

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const validateProductForm = () => {
    if (!formData.product_name.trim()) {
      showNotice(
        "error",
        "Product Name Required",
        "Enter the product name."
      );

      return false;
    }

    if (!formData.category_id) {
      showNotice(
        "error",
        "Category Required",
        "Select the product category."
      );

      return false;
    }

    if (!formData.vendor_id) {
      showNotice(
        "error",
        "Supplier Required",
        "Select the supplier associated with this product."
      );

      return false;
    }

    if (!formData.unit_type) {
      showNotice(
        "error",
        "Unit Required",
        "Select the product unit."
      );

      return false;
    }

    const selectedCategory = getCategoryRecord(
      formData.category_id
    );

    if (
      selectedCategory?.requires_expiry &&
      !formData.expiry_date
    ) {
      showNotice(
        "error",
        "Expiry Date Required",
        `Expiry date is required for ${selectedCategory.category_name}.`
      );

      return false;
    }

    if (
      Number(formData.reorder_level || 0) < 0
    ) {
      showNotice(
        "error",
        "Invalid Reorder Level",
        "Reorder level cannot be negative."
      );

      return false;
    }

    if (
      Number(formData.supplier_price || 0) < 0
    ) {
      showNotice(
        "error",
        "Invalid Supplier Price",
        "Supplier price cannot be negative."
      );

      return false;
    }

    if (
      Number(formData.selling_price || 0) <= 0
    ) {
      showNotice(
        "error",
        "Invalid Selling Price",
        "Selling price must be greater than zero."
      );

      return false;
    }

    if (
      !formData.no_expiry &&
      formData.expiry_date &&
      formData.expiry_date < today
    ) {
      showNotice(
        "error",
        "Invalid Expiry Date",
        "Expiry date cannot be in the past."
      );

      return false;
    }

    if ((formData.variant_value !== "" || formData.variant_unit.trim()) && !formData.variant_label.trim()) {
      showNotice(
        "error",
        "Variation Label Required",
        "Enter a variation label such as 100 ml, 250 ml, Small, or Large."
      );
      return false;
    }

    if (formData.variant_value !== "" && Number(formData.variant_value) < 0) {
      showNotice("error", "Invalid Variation Value", "Variation value cannot be negative.");
      return false;
    }

    return true;
  };

  const buildProductFormData = () => {
    const payload = new FormData();

    payload.append(
      "product_name",
      formData.product_name.trim()
    );

    payload.append(
      "sku",
      formData.sku.trim()
    );

    payload.append(
      "category_id",
      formData.category_id
    );

    payload.append(
      "category",
      formData.category
    );

    payload.append(
      "unit_type",
      formData.unit_type
    );

    payload.append("unit", formData.unit);

    payload.append(
      "reorder_level",
      String(
        Number(formData.reorder_level || 0)
      )
    );

    payload.append(
      "supplier_price",
      String(
        Number(formData.supplier_price || 0)
      )
    );

    payload.append(
      "selling_price",
      String(
        Number(formData.selling_price || 0)
      )
    );

    payload.append(
      "expiry_date",
      formData.no_expiry
        ? ""
        : formData.expiry_date
    );

    payload.append(
      "vendor_id",
      formData.vendor_id
    );

    payload.append("family_id", formData.family_id || "");
    payload.append("request_variant_id", formData.request_variant_id || "");
    payload.append("variant_label", formData.variant_label.trim());
    payload.append("variant_value", formData.variant_value === "" ? "" : String(Number(formData.variant_value)));
    payload.append("variant_unit", formData.variant_unit.trim());
    payload.append("variant_sort", String(Number(formData.variant_sort || 0)));
    payload.append("publication_status", formData.publication_status || "Draft");

    if (formData.product_image) {
      payload.append(
        "product_image",
        formData.product_image
      );
    }

    if (
      formMode === "edit" &&
      selectedProduct
    ) {
      payload.append(
        "product_id",
        selectedProduct.product_id
      );
    }

    return payload;
  };

  const submitProduct = async (event) => {
    event.preventDefault();

    if (!canManageInventory) {
      showNotice(
        "error",
        "Permission Denied",
        "Only an administrator can register or edit product information."
      );

      return;
    }

    if (!validateProductForm()) {
      return;
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();
      const editing = formMode === "edit";

      const endpoint = editing
        ? `${API_BASE}/inventory_management/update_product.php`
        : `${API_BASE}/inventory_management/add_product.php`;

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": csrfToken,
        },
        body: buildProductFormData(),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to save the product information."
        );
      }

      Promise.resolve()
        .then(() =>
          logAudit(
            editing
              ? "Update Product Information"
              : "Register Product",
            editing
              ? `Updated product information: ${formData.product_name}`
              : `Registered product catalog record: ${formData.product_name}`
          )
        )
        .catch((auditError) => {
          console.error("Inventory audit error:", auditError);
        });

      closeProductModal();
      await loadProducts();

      showNotice(
        "success",
        editing
          ? "Product Updated"
          : "Product Registered",

        data.message ||
          (editing
            ? "Product information was updated successfully."
            : "Product was registered with zero stock. Add stock through Delivery Management.")
      );
    } catch (error) {
      console.error("Product save error:", error);

      showNotice(
        "error",
        formMode === "edit"
          ? "Unable to Update Product"
          : "Unable to Register Product",
        error.message ||
          "The product information could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };


  const openPublishModal = (product) => {
    if (!canManageInventory) {
      showNotice(
        "error",
        "Permission Denied",
        "Only an administrator can set the final selling price and publish a product."
      );
      return;
    }

    if (Number(product.quantity || 0) <= 0) {
      showNotice(
        "error",
        "No Stock Available",
        "Receive physical stock first before publishing this product."
      );
      return;
    }

    setSelectedProduct(product);
    setPublishPrice(
      Number(product.selling_price || 0) > 0
        ? String(product.selling_price)
        : ""
    );
    setShowPublishModal(true);
  };

  const closePublishModal = () => {
    if (saving) {
      return;
    }

    setShowPublishModal(false);
    setPublishPrice("");
    setSelectedProduct(null);
  };

  const submitPublishProduct = async (event) => {
    event.preventDefault();

    if (!selectedProduct || !canManageInventory) {
      return;
    }

    const finalPrice = Number(publishPrice || 0);

    if (finalPrice <= 0) {
      showNotice(
        "error",
        "Selling Price Required",
        "Enter BFATC's final selling price before publishing the product."
      );
      return;
    }

    if (
      Number(selectedProduct.quantity || 0) <= 0
    ) {
      showNotice(
        "error",
        "No Stock Available",
        "This product cannot be published until physical stock has been received."
      );
      return;
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE}/inventory_management/publish_product.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            product_id: selectedProduct.product_id,
            selling_price: finalPrice,
            published_by_user_id:
              user?.user_id || null,
            published_by_name:
              user?.full_name ||
              user?.name ||
              "System Admin",
          }),
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to publish the product."
        );
      }

      Promise.resolve()
        .then(() =>
          logAudit(
            "Set Price & Publish Product",
            `Published ${selectedProduct.product_name} at ${formatPeso(finalPrice)}.`
          )
        )
        .catch((auditError) => {
          console.error("Inventory audit error:", auditError);
        });

      setShowPublishModal(false);
      setPublishPrice("");
      setSelectedProduct(null);

      await loadProducts();

      showNotice(
        "success",
        "Product Published",
        data.message ||
          "The final BFATC selling price was saved. The product is now eligible for Landing Page and POS."
      );
    } catch (error) {
      showNotice(
        "error",
        "Unable to Publish Product",
        error.message ||
          "The product selling price could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const openRestockModal = (product) => {
    if (!canManageInventory) {
      return;
    }

    setSelectedProduct(product);
    setRestockForm({
      quantity: "",
      preferred_delivery_date: "",
      remarks: "",
    });
    setShowRestockModal(true);
  };

  const closeRestockModal = () => {
    if (saving) {
      return;
    }

    setShowRestockModal(false);
    setSelectedProduct(null);
    setRestockForm(EMPTY_RESTOCK_FORM);
  };

  const handleRestockChange = (event) => {
    const { name, value } = event.target;

    setRestockForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const triggerRestockPostProcessing = async (
    restockData
  ) => {
    if (
      !restockData?.post_processing_required ||
      !restockData?.restock_request_id
    ) {
      return;
    }

    try {
      const csrfToken = await getCsrfToken();

      fetch(
        `${API_BASE}/inventory_management/post_restock_communication.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
            "X-CSRF-Token": csrfToken,
          },
        body: JSON.stringify({
          restock_request_id:
            restockData.restock_request_id,
          request_no:
            restockData.request_no || "",
        }),
      }
    )
      .then(async (response) => {
        const text =
          await response.text();

        let data = null;

        try {
          data = JSON.parse(text);
        } catch {
          console.warn(
            "Invalid post-restock communication response:",
            text
          );

          return;
        }

        if (
          !response.ok ||
          !data.success
        ) {
          console.warn(
            "Restock email communication failed:",
            data.message ||
              "Unknown communication error."
          );
        }
      })
      .catch((error) => {
        console.warn(
          "Restock email communication failed:",
          error
        );
      });
    } catch (error) {
      console.warn(
        "Restock communication security error:",
        error
      );
    }
  };

  const submitRestock = async (event) => {
    event.preventDefault();

    if (!canManageInventory || !selectedProduct) {
      showNotice("error","Permission Denied","You do not have permission to create a restock request.");
      return;
    }

    const quantity = Number(restockForm.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      showNotice("error","Invalid Requested Quantity","Requested quantity must be a whole number greater than zero.");
      return;
    }

    if (restockForm.preferred_delivery_date &&
        restockForm.preferred_delivery_date < today) {
      showNotice("error","Invalid Preferred Date","Preferred delivery date cannot be in the past.");
      return;
    }

    setSaving(true);
    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE}/inventory_management/create_restock_request.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            product_id: selectedProduct.product_id,
            requested_quantity: quantity,
            preferred_delivery_date: restockForm.preferred_delivery_date,
            remarks: restockForm.remarks.trim(),
            requested_by: user?.user_id || null,
            requested_by_name: user?.full_name || user?.name || "System User",
          }),
        }
      );
      const data = await parseJsonResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to send the restock request.");
      }

      triggerRestockPostProcessing(data);

      Promise.resolve()
        .then(() =>
          logAudit(
            "Request Restock",
            `Sent ${data.request_no || "restock request"} for ${selectedProduct.product_name}: ${quantity} ${
              selectedProduct.unit_type || selectedProduct.unit || "pcs"
            } from ${selectedProduct.vendor_name || "supplier"}.`
          )
        )
        .catch((auditError) => {
          console.error("Inventory audit error:", auditError);
        });

      closeRestockModal();
      showNotice(
        "success",
        "Restock Request Sent",
        data.message ||
          "The supplier was notified in HiveSync. Registered-email delivery continues separately."
      );
    } catch (error) {
      showNotice("error","Unable to Request Restock",
        error.message || "The restock request could not be sent.");
    } finally {
      setSaving(false);
    }
  };

  const openProductDetails = async (product) => {
    setSelectedProduct(product);
    setProductDetails(null);
    setShowDetailsModal(true);
    setDetailsLoading(true);

    try {
      const [
        detailsResponse,
        batchesResponse,
        historyResponse,
      ] = await Promise.all([
        fetch(
          `${API_BASE}/inventory_management/get_product_details.php?product_id=${product.product_id}&time=${Date.now()}`,
          {
            credentials: "include",
          }
        ),
        fetch(
          `${API_BASE}/inventory_management/get_product_batches.php?product_id=${product.product_id}&time=${Date.now()}`,
          {
            credentials: "include",
          }
        ),
        fetch(
          `${API_BASE}/inventory_management/get_inventory_history.php?product_id=${product.product_id}&time=${Date.now()}`,
          {
            credentials: "include",
          }
        ),
      ]);

      const [
        data,
        batchData,
        historyData,
      ] = await Promise.all([
        parseJsonResponse(detailsResponse),
        parseJsonResponse(batchesResponse),
        parseJsonResponse(historyResponse),
      ]);

      if (!detailsResponse.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to retrieve the product profile."
        );
      }

      if (!batchesResponse.ok || !batchData.success) {
        throw new Error(
          batchData.message ||
            "Unable to retrieve product batches."
        );
      }

      if (!historyResponse.ok || !historyData.success) {
        throw new Error(
          historyData.message ||
            "Unable to retrieve inventory movement history."
        );
      }

      setProductDetails({
        ...data,
        batches: batchData.batches || [],
        batch_summary:
          batchData.summary || null,
        inventory_history:
          historyData.history || [],
        movement_summary:
          historyData.summary || null,
      });
    } catch (error) {
      console.error(
        "Product details error:",
        error
      );

      setShowDetailsModal(false);
      setSelectedProduct(null);

      showNotice(
        "error",
        "Unable to Load Product Profile",
        error.message ||
          "Product history could not be retrieved."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetailsModal = () => {
    if (detailsLoading) {
      return;
    }

    setShowDetailsModal(false);
    setSelectedProduct(null);
    setProductDetails(null);
  };

  const requestArchive = (product) => {
    if (!canManageInventory) {
      return;
    }

    setConfirmation({
      title: "Archive Product",
      message: `Archive ${product.product_name}? The product will be removed from active Inventory and POS, but its deliveries, sales, batches, prices, and audit records will remain preserved.`,
      confirmText: "Archive Product",
      product,
    });

    setShowConfirmModal(true);
  };

  const archiveProduct = async () => {
    const product = confirmation.product;

    if (!product) {
      return;
    }

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE}/inventory_management/archive_product.php`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            product_id: product.product_id,
          }),
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to archive the product."
        );
      }

      Promise.resolve()
        .then(() =>
          logAudit(
            "Archive Product",
            `Archived product: ${product.product_name}`
          )
        )
        .catch((auditError) => {
          console.error("Inventory audit error:", auditError);
        });

      setShowConfirmModal(false);
      setConfirmation({
        title: "",
        message: "",
        confirmText: "",
        product: null,
      });

      await loadProducts();

      showNotice(
        "success",
        "Product Archived",
        data.message ||
          "The product was archived successfully."
      );
    } catch (error) {
      console.error(
        "Product archive error:",
        error
      );

      showNotice(
        "error",
        "Unable to Archive Product",
        error.message ||
          "The product could not be archived."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page inventory-page">
      <div className="page-header inventory-page-header">
        <div>
          <h1>
            {isSupplier
              ? "My Products"
              : "Inventory Management"}
          </h1>

          <span>
            {isSupplier
              ? "View products, stock, delivery activity, expiry, sales, and consignment records linked to your supplier account."
              : "Monitor product information, stock levels, delivery batches, expiry, supplier links, and sales activity."}
          </span>
        </div>

        <div className="inventory-header-actions">
          {canManageInventory && (
            <>
              <div className="inventory-export-date-range">
                <CalendarDays size={15} />

                <input
                  type="date"
                  value={exportFromDate}
                  max={exportToDate || undefined}
                  onChange={(event) =>
                    setExportFromDate(event.target.value)
                  }
                  aria-label="Export from date"
                />

                <span>—</span>

                <input
                  type="date"
                  value={exportToDate}
                  min={exportFromDate || undefined}
                  onChange={(event) =>
                    setExportToDate(event.target.value)
                  }
                  aria-label="Export to date"
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={exportInventory}
              >
                <FileSpreadsheet size={17} />
                Export Excel
              </button>
            </>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadProducts}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "inventory-spinner"
                  : ""
              }
            />
            Refresh
          </button>

        </div>
      </div>

      <section className="inventory-stat-grid">
        <InventoryStatCard
          icon={<Boxes size={20} />}
          label={
            isSupplier
              ? "My Products"
              : "Total Products"
          }
          value={statistics.total}
        />

        <InventoryStatCard
          icon={<CheckCircle2 size={20} />}
          label="In Stock"
          value={statistics.inStock}
          type="success"
        />

        <InventoryStatCard
          icon={<AlertTriangle size={20} />}
          label="Low Stock"
          value={statistics.lowStock}
          type="warning"
        />

        <InventoryStatCard
          icon={<Package size={20} />}
          label="Out of Stock"
          value={statistics.outOfStock}
          type="danger"
        />

        <InventoryStatCard
          icon={<CalendarDays size={20} />}
          label="Near Expiry"
          value={statistics.nearExpiry}
          type="expiry"
        />
      </section>

      <section className="inventory-record-card">
        <div className="inventory-toolbar">
          <div className="inventory-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search product, SKU, category, or supplier..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() =>
                  setSearchTerm("")
                }
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="inventory-filter-grid">
            <InventoryFilter>
              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All Categories
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
            </InventoryFilter>

            {!isSupplier && (
              <InventoryFilter>
                <select
                  value={supplierFilter}
                  onChange={(event) =>
                    setSupplierFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="All">
                    All Suppliers
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
              </InventoryFilter>
            )}

            <InventoryFilter>
              <select
                value={stockFilter}
                onChange={(event) =>
                  setStockFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All Stock Levels
                </option>
                <option value="In Stock">
                  In Stock
                </option>
                <option value="Low Stock">
                  Low Stock
                </option>
                <option value="Awaiting First Delivery">
                  Awaiting First Delivery
                </option>
                <option value="Out of Stock">
                  Out of Stock
                </option>
              </select>
            </InventoryFilter>

            <InventoryFilter>
              <select
                value={expiryFilter}
                onChange={(event) =>
                  setExpiryFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All Expiry Status
                </option>
                <option value="Safe">Safe</option>
                <option value="Near Expiry">
                  Near Expiry
                </option>
                <option value="Expired">
                  Expired
                </option>
                <option value="No Expiry">
                  No Expiry
                </option>
              </select>
            </InventoryFilter>

            <button
              type="button"
              className="inventory-clear-filters"
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Current Stock</th>
                <th>Supplier Price</th>
                <th>Selling Price</th>
                <th>Stock Status</th>
                <th>Expiry</th>
                <th>Deliveries</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11">
                    <InventoryLoading />
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="11">
                    <InventoryEmpty
                      isSupplier={isSupplier}
                    />
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.product_id}>
                    <td>
                      <div className="inventory-product-cell">
                        <img
                          src={getProductImage(product)}
                          alt={product.product_name}
                          onError={(event) => {
                            event.currentTarget.src =
                              PLACEHOLDER_IMAGE;
                          }}
                        />

                        <div>
                          <span>
                            {formatProductId(
                              product.product_id
                            )}
                          </span>

                          <strong>
                            {product.product_name}
                          </strong>
                          {product.variant_label && product.variant_label !== "Standard" && (
                            <small className="inventory-field-help">Variation: {product.variant_label}</small>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <strong>
                        {product.sku || "N/A"}
                      </strong>
                    </td>

                    <td>
                      {product.category_name ||
                        product.category ||
                        "Uncategorized"}
                    </td>

                    <td>
                      {product.vendor_name ||
                        "No supplier"}
                    </td>

                    <td>
                      <strong className="inventory-stock-value">
                        {Number(
                          product.quantity || 0
                        ).toLocaleString("en-PH")}{" "}
                        {product.unit_type ||
                          product.unit ||
                          "pcs"}
                      </strong>
                    </td>

                    <td>
                      {formatPeso(
                        product.supplier_price
                      )}
                    </td>

                    <td>
                      {Number(
                        product.selling_price || 0
                      ) > 0 ? (
                        <strong>
                          {formatPeso(
                            product.selling_price
                          )}
                        </strong>
                      ) : (
                        <span
                          title="Set BFATC selling price before publishing"
                          style={{
                            fontWeight: 800,
                            color: "#111827",
                          }}
                        >
                          Price Pending
                        </span>
                      )}
                    </td>

                    <td>
                      <StockBadge
                        status={getStockStatus(
                          product
                        )}
                      />
                    </td>

                    <td>
                      <ExpiryBadge
                        status={getExpiryStatus(
                          product
                        )}
                        date={
                          product.nearest_expiry_date ||
                          product.expiry_date
                        }
                        formatDate={formatDate}
                      />
                    </td>

                    <td>
                      {Number(
                        product.delivery_count || 0
                      )}
                    </td>

                    <td>
                      <div className="inventory-actions action-group">
                        <button
                          type="button"
                          className="icon-btn"
                          title="View product profile"
                          onClick={() =>
                            openProductDetails(product)
                          }
                        >
                          <Eye size={17} />
                        </button>

                        {canManageInventory && (
                          <>
                            {Number(product.quantity || 0) > 0 &&
                              Number(product.selling_price || 0) <= 0 && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Set selling price & publish"
                                  aria-label="Set selling price and publish"
                                  onClick={() =>
                                    openPublishModal(product)
                                  }
                                >
                                  <ShoppingCart size={17} />
                                </button>
                              )}

                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit product information"
                              onClick={() =>
                                openEditModal(product)
                              }
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              type="button"
                              className="icon-btn"
                              title="Add restock"
                              onClick={() =>
                                openRestockModal(product)
                              }
                            >
                              <Plus size={17} />
                            </button>

                            <button
                              type="button"
                              className="icon-btn"
                              title="Archive product"
                              onClick={() =>
                                requestArchive(product)
                              }
                            >
                              <Archive size={17} />
                            </button>
                          </>
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
          filteredProducts.length > 0 && (
            <PaginationBar
              totalItems={filteredProducts.length}
              currentPage={inventoryPage}
              pageSize={INVENTORY_PAGE_SIZE}
              onPageChange={setInventoryPage}
              itemLabel="products"
            />
          )}
      </section>

      {showProductModal && (
        <ProductFormModal
          mode={formMode}
          data={formData}
          categories={categories}
          vendors={vendors}
          imagePreview={imagePreview}
          loading={referenceLoading}
          saving={saving}
          today={today}
          onChange={handleFormChange}
          onSubmit={submitProduct}
          onClose={closeProductModal}
        />
      )}

      {showRestockModal && selectedProduct && (
        <RestockModal
          product={selectedProduct}
          data={restockForm}
          saving={saving}
          today={today}
          formatProductId={formatProductId}
          getProductImage={getProductImage}
          onChange={handleRestockChange}
          onSubmit={submitRestock}
          onClose={closeRestockModal}
        />
      )}

      {showPublishModal && selectedProduct && (
        <PublishProductModal
          product={selectedProduct}
          price={publishPrice}
          saving={saving}
          formatPeso={formatPeso}
          getProductImage={getProductImage}
          onPriceChange={setPublishPrice}
          onSubmit={submitPublishProduct}
          onClose={closePublishModal}
        />
      )}

      {showDetailsModal && selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          details={productDetails}
          loading={detailsLoading}
          formatProductId={formatProductId}
          formatPeso={formatPeso}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          getProductImage={getProductImage}
          getStockStatus={getStockStatus}
          getExpiryStatus={getExpiryStatus}
          onClose={closeDetailsModal}
        />
      )}

      {showConfirmModal && (
        <ConfirmModal
          data={confirmation}
          saving={saving}
          onConfirm={archiveProduct}
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


function PublishProductModal({
  product,
  price,
  saving,
  formatPeso,
  getProductImage,
  onPriceChange,
  onSubmit,
  onClose,
}) {
  return (
    <div className="modal-overlay">
      <div
        className="modal-box inventory-product-modal inventory-publish-modal"
      >
        <div className="inventory-modal-header">
          <div>
            <div className="inventory-modal-title">
              <div>
                <ShoppingCart size={22} />
              </div>

              <h2>Set Price & Publish</h2>
            </div>

            <p>
              Set BFATC's final selling price. Publishing makes
              this received product eligible for the Landing
              Page and POS.
            </p>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="inventory-modal-body inventory-publish-body">
            <div className="inventory-publish-product">
              <img
                src={getProductImage(product)}
                alt={product.product_name}
                className="inventory-publish-image"
              />

              <div className="inventory-publish-info">
                <strong className="inventory-publish-name">
                  {product.display_name || product.product_name}
                </strong>

                <span className="inventory-publish-sku">
                  {product.sku || "No SKU"}
                </span>

                <div className="inventory-publish-meta">
                  <span>
                    Current Stock:{" "}
                    <strong>
                      {Number(
                        product.quantity || 0
                      ).toLocaleString("en-PH")}{" "}
                      {product.unit_type ||
                        product.unit ||
                        "pcs"}
                    </strong>
                  </span>

                  <span>
                    Supplier Cost:{" "}
                    <strong>
                      {formatPeso(
                        product.supplier_price
                      )}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <InventoryField
              label="BFATC Selling Price"
              required
              wide
            >
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(event) =>
                  onPriceChange(event.target.value)
                }
                placeholder="Enter final selling price"
                autoFocus
              />
            </InventoryField>
          </div>

          <div className="inventory-modal-footer inventory-publish-footer">
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
                  size={17}
                  className="inventory-spinner"
                />
              ) : (
                <ShoppingCart size={17} />
              )}

              {saving
                ? "Publishing..."
                : "Save & Publish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InventoryStatCard({
  icon,
  label,
  value,
  type = "",
}) {
  return (
    <div
      className={`inventory-stat-card ${type}`}
    >
      <div>{icon}</div>

      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function InventoryFilter({ children }) {
  return (
    <div className="inventory-filter">
      {children}
      <ChevronDown size={15} />
    </div>
  );
}

function StockBadge({ status }) {
  return (
    <span
      className={`inventory-stock-badge ${String(
        status
      )
        .toLowerCase()
        .replace(/\s+/g, "-")}`}
    >
      {status}
    </span>
  );
}

function ExpiryBadge({
  status,
  date,
  formatDate,
}) {
  return (
    <div className="inventory-expiry-cell">
      <span
        className={`inventory-expiry-badge ${String(
          status
        )
          .toLowerCase()
          .replace(/\s+/g, "-")}`}
      >
        {status}
      </span>

      <small>
        {date ? formatDate(date) : "Not applicable"}
      </small>
    </div>
  );
}

function InventoryLoading() {
  return (
    <div className="inventory-loading-state">
      <LoaderCircle
        size={29}
        className="inventory-spinner"
      />
      <span>Loading inventory records...</span>
    </div>
  );
}

function InventoryEmpty({ isSupplier }) {
  return (
    <div className="inventory-empty-state">
      <div>
        <Boxes size={30} />
      </div>

      <h3>No inventory products found</h3>

      <p>
        {isSupplier
          ? "Products will appear after your supplier account is linked and used in Delivery Management."
          : "Products appear here after they are added through Supplier Management or received through Delivery Management."}
      </p>
    </div>
  );
}

function ProductFormModal({
  mode,
  data,
  categories,
  vendors,
  imagePreview,
  loading,
  saving,
  today,
  onChange,
  onSubmit,
  onClose,
}) {
  const editing = mode === "edit";

  const selectedCategory = categories.find(
    (category) =>
      String(category.category_id) ===
      String(data.category_id)
  );

  const unitOptions =
    selectedCategory?.units &&
    Array.isArray(selectedCategory.units)
      ? selectedCategory.units.map((unit) =>
          typeof unit === "string"
            ? { value: unit, label: unit }
            : unit
        )
      : DEFAULT_UNIT_OPTIONS;

  const allowsExpiry =
    selectedCategory?.allows_expiry !== false;

  const requiresExpiry =
    selectedCategory?.requires_expiry === true;

  return (
    <div className="modal-overlay">
      <div className="modal-box inventory-product-modal">
        <div className="inventory-modal-header">
          <div>
            <div className="inventory-modal-title">
              <div>
                <Package size={22} />
              </div>

              <h2>
                {editing
                  ? "Edit Product Information"
                  : "Register Product"}
              </h2>
            </div>

            <p>
              {editing
                ? "Update descriptive product information without changing stock directly."
                : "Create a reusable catalog record with zero stock. Stock is received through Delivery Management."}
            </p>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <InventoryLoading />
        ) : (
          <form onSubmit={onSubmit}>
            <div className="inventory-modal-body">
              <div className="inventory-zero-stock-note">
                <Layers3 size={20} />

                <div>
                  <strong>
                    Quantity is transaction-controlled
                  </strong>

                  <span>
                    Product registration does not add
                    stock. Confirm a delivery to create
                    the stock batch and inventory
                    movement.
                  </span>
                </div>
              </div>

              <section className="inventory-form-section">
                <h3>Product Identity</h3>

                <div className="inventory-form-layout">
                  <label className="inventory-image-uploader">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Product preview"
                        onError={(event) => {
                          event.currentTarget.src =
                            PLACEHOLDER_IMAGE;
                        }}
                      />
                    ) : (
                      <div>
                        <ImagePlus size={28} />
                        <strong>
                          Upload Product Image
                        </strong>
                        <span>
                          JPG, PNG, or WEBP
                        </span>
                      </div>
                    )}

                    <input
                      type="file"
                      name="product_image"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={onChange}
                    />
                  </label>

                  <div className="inventory-form-grid">
                    <InventoryField
                      label="Product Name"
                      required
                      wide
                    >
                      <input
                        type="text"
                        name="product_name"
                        value={data.product_name}
                        onChange={onChange}
                        placeholder="Enter product name"
                        maxLength={150}
                      />
                    </InventoryField>

                    <InventoryField label="SKU">
                      <input
                        type="text"
                        name="sku"
                        value={
                          editing
                            ? data.sku
                            : "Generated automatically after save"
                        }
                        readOnly
                      />
                      {!editing && (
                        <small className="inventory-field-help">
                          HiveSync creates a unique SKU using the category and product name.
                        </small>
                      )}
                    </InventoryField>

                    <InventoryField
                      label="Category"
                      required
                    >
                      <select
                        name="category_id"
                        value={data.category_id}
                        onChange={onChange}
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
                      {selectedCategory && (
                        <small className="inventory-field-help">
                          {selectedCategory.allows_expiry === false
                            ? "Non-expiring category"
                            : selectedCategory.requires_expiry
                            ? "Expiry date required"
                            : "Expiry date optional"}
                        </small>
                      )}
                    </InventoryField>

                    <InventoryField
                      label="Supplier"
                      required
                      wide
                    >
                      <select
                        name="vendor_id"
                        value={data.vendor_id}
                        onChange={onChange}
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
                    </InventoryField>
                  </div>
                </div>
              </section>

              <section className="inventory-form-section">
                <h3>Product Variation / Size</h3>
                <div className="inventory-form-grid">
                  <InventoryField label="Variation Label" wide>
                    <input type="text" name="variant_label" value={data.variant_label || ""} onChange={onChange} placeholder="e.g. 100 ml, 250 ml, Large" maxLength={100} />
                    <small className="inventory-field-help">Leave blank for products with no size or variation.</small>
                  </InventoryField>
                  <InventoryField label="Variation Value">
                    <input type="number" name="variant_value" min="0" step="0.001" value={data.variant_value ?? ""} onChange={onChange} placeholder="e.g. 250" />
                  </InventoryField>
                  <InventoryField label="Variation Unit">
                    <input type="text" name="variant_unit" value={data.variant_unit || ""} onChange={onChange} placeholder="e.g. ml, g, kg" maxLength={30} />
                  </InventoryField>
                  <InventoryField label="Variant Sort">
                    <input type="number" name="variant_sort" min="0" step="1" value={data.variant_sort ?? "0"} onChange={onChange} />
                    <small className="inventory-field-help">Lower numbers appear first within the same product family.</small>
                  </InventoryField>
                  {editing && (
                    <InventoryField label="Product Family ID">
                      <input type="text" name="family_id" value={data.family_id || ""} readOnly />
                    </InventoryField>
                  )}
                </div>
              </section>

              <section className="inventory-form-section">
                <h3>Stock Configuration</h3>

                <div className="inventory-form-grid">
                  <InventoryField
                    label="Unit"
                    required
                  >
                    <select
                      name="unit_type"
                      value={data.unit_type}
                      onChange={onChange}
                    >
                      {unitOptions.map(
                        (option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        )
                      )}
                    </select>
                  </InventoryField>

                  <InventoryField label="Reorder Level">
                    <input
                      type="number"
                      name="reorder_level"
                      min="0"
                      value={data.reorder_level}
                      onChange={onChange}
                    />
                  </InventoryField>

                  <InventoryField label="Current Stock">
                    <input
                      type="text"
                      value={
                        editing
                          ? "Controlled by Delivery and POS"
                          : "0 — receive through Delivery"
                      }
                      readOnly
                    />
                  </InventoryField>
                </div>
              </section>

              <section className="inventory-form-section">
                <h3>Pricing and Expiry</h3>

                <div className="inventory-form-grid">
                  <InventoryField label="Supplier Price">
                    <input
                      type="number"
                      name="supplier_price"
                      min="0"
                      step="0.01"
                      value={data.supplier_price}
                      onChange={onChange}
                      placeholder="0.00"
                    />
                  </InventoryField>

                  <InventoryField
                    label="Selling Price"
                    required
                  >
                    <input
                      type="number"
                      name="selling_price"
                      min="0.01"
                      step="0.01"
                      value={data.selling_price}
                      onChange={onChange}
                      placeholder="0.00"
                    />
                  </InventoryField>

                  {allowsExpiry ? (
                    <>
                      <InventoryField
                        label={
                          requiresExpiry
                            ? "Expiry Date *"
                            : "Expiry Date"
                        }
                      >
                        <input
                          type="date"
                          name="expiry_date"
                          min={today}
                          value={data.expiry_date}
                          onChange={onChange}
                          disabled={data.no_expiry}
                        />
                        {selectedCategory?.default_expiry_days && (
                          <small className="inventory-field-help">
                            Suggested automatically based on the selected category.
                          </small>
                        )}
                      </InventoryField>

                      {!requiresExpiry && (
                        <label className="inventory-no-expiry">
                          <input
                            type="checkbox"
                            name="no_expiry"
                            checked={data.no_expiry}
                            onChange={onChange}
                          />

                          <span>
                            <strong>No expiration date</strong>
                            <small>Use only when this specific product does not expire.</small>
                          </span>
                        </label>
                      )}
                    </>
                  ) : (
                    <div className="inventory-non-expiring-note">
                      <CheckCircle2 size={19} />
                      <span>
                        <strong>No expiry required</strong>
                        <small>
                          {selectedCategory?.category_name || "This category"} is treated as a non-expiring product category.
                        </small>
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="inventory-modal-footer">
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
                    className="inventory-spinner"
                  />
                )}

                {saving
                  ? "Saving..."
                  : editing
                  ? "Update Product"
                  : "Register Product"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function InventoryField({
  label,
  required,
  wide,
  children,
}) {
  return (
    <div
      className={`inventory-field ${
        wide ? "wide" : ""
      }`}
    >
      <label>
        {label}
        {required && <strong> *</strong>}
      </label>

      {children}
    </div>
  );
}

function ProductDetailsModal({
  product,
  details,
  loading,
  formatProductId,
  formatPeso,
  formatDate,
  formatDateTime,
  getProductImage,
  getStockStatus,
  getExpiryStatus,
  onClose,
}) {
  const [activeTab, setActiveTab] =
    useState("overview");
  const [batchFilter, setBatchFilter] =
    useState("Active");
  const [detailPages, setDetailPages] = useState({
    deliveries: 1,
    batches: 1,
    sales: 1,
    history: 1,
  });

  const DETAIL_PAGE_SIZE = 5;

  const completeProduct =
    details?.product || product;

  const deliveries = details?.deliveries || [];
  const batches = details?.batches || [];
  const sales = details?.sales || [];
  const inventoryHistory =
    details?.inventory_history || [];

  const movementSummary =
    details?.movement_summary || {
      total_movements: inventoryHistory.length,
      total_stock_in: 0,
      total_stock_out: 0,
    };

  const physicalStock = Number(completeProduct.quantity || 0);
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const expiredStock = batches.reduce((total, batch) => {
    if (!batch?.expiry_date) {
      return total;
    }

    const expiryDate = new Date(`${batch.expiry_date}T00:00:00`);
    expiryDate.setHours(0, 0, 0, 0);

    if (Number.isNaN(expiryDate.getTime()) || expiryDate > todayDate) {
      return total;
    }

    return total + Math.max(0, Number(batch.quantity || 0));
  }, 0);

  const sellableStock = Math.max(0, physicalStock - expiredStock);

  const getBatchStatus = (batch) => {
    const quantity = Number(batch?.quantity || 0);

    if (quantity <= 0) {
      return "Depleted";
    }

    if (batch?.expiry_date) {
      const expiryDate = new Date(
        `${batch.expiry_date}T00:00:00`
      );
      expiryDate.setHours(0, 0, 0, 0);

      if (
        !Number.isNaN(expiryDate.getTime()) &&
        expiryDate <= todayDate
      ) {
        return "Expired";
      }
    }

    return "Active";
  };

  const activeBatches = batches
    .filter((batch) => getBatchStatus(batch) === "Active")
    .sort((a, b) => {
      if (!a.expiry_date && !b.expiry_date) {
        return Number(a.batch_id || 0) - Number(b.batch_id || 0);
      }

      if (!a.expiry_date) {
        return 1;
      }

      if (!b.expiry_date) {
        return -1;
      }

      return String(a.expiry_date).localeCompare(
        String(b.expiry_date)
      );
    });

  const expiredBatches = batches.filter(
    (batch) => getBatchStatus(batch) === "Expired"
  );

  const depletedBatches = batches.filter(
    (batch) => getBatchStatus(batch) === "Depleted"
  );

  const historyBatchCount =
    expiredBatches.length + depletedBatches.length;

  const visibleBatches =
    batchFilter === "Active"
      ? activeBatches
      : batchFilter === "Expired"
      ? expiredBatches
      : batchFilter === "Depleted"
      ? depletedBatches
      : batches;

  const getDetailPage = (key, items) => {
    const totalPages = Math.max(
      1,
      Math.ceil(items.length / DETAIL_PAGE_SIZE)
    );
    const page = Math.min(
      Math.max(1, detailPages[key] || 1),
      totalPages
    );
    const start = (page - 1) * DETAIL_PAGE_SIZE;

    return {
      page,
      totalPages,
      items: items.slice(
        start,
        start + DETAIL_PAGE_SIZE
      ),
    };
  };

  const deliveryPage = getDetailPage(
    "deliveries",
    deliveries
  );
  const batchPage = getDetailPage(
    "batches",
    visibleBatches
  );
  const salesPage = getDetailPage(
    "sales",
    sales
  );
  const historyPage = getDetailPage(
    "history",
    inventoryHistory
  );

  const changeDetailPage = (key, page) => {
    setDetailPages((current) => ({
      ...current,
      [key]: page,
    }));
  };

  const stockUnit =
    completeProduct.unit_type ||
    completeProduct.unit ||
    "pcs";

  const getMovementClass = (movement) => {
    const direction = String(
      movement?.direction || ""
    ).toLowerCase();

    if (direction === "in") {
      return "stock-in";
    }

    if (direction === "out") {
      return "stock-out";
    }

    return "neutral";
  };

  const getMovementQuantity = (movement) => {
    const quantity = Number(
      movement?.quantity || 0
    );

    const direction = String(
      movement?.direction || ""
    ).toLowerCase();

    if (direction === "in") {
      return `+${quantity}`;
    }

    if (direction === "out") {
      return `-${quantity}`;
    }

    return String(quantity);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box inventory-details-modal">
        <div className="inventory-modal-header">
          <div>
            <div className="inventory-modal-title">
              <div>
                <Boxes size={22} />
              </div>

              <h2>Product Business Profile</h2>
            </div>

            <p>
              Connected inventory, delivery, batch,
              expiry, supplier, sales, and stock movement history.
            </p>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <InventoryLoading />
        ) : (
          <>
            <div className="inventory-details-body">
              <div className="inventory-product-hero">
                <img
                  src={getProductImage(
                    completeProduct
                  )}
                  alt={
                    completeProduct.product_name
                  }
                  onError={(event) => {
                    event.currentTarget.src =
                      PLACEHOLDER_IMAGE;
                  }}
                />

                <div>
                  <span>
                    {formatProductId(
                      completeProduct.product_id
                    )}
                  </span>

                  <h3>
                    {completeProduct.product_name}
                  </h3>

                  <p>
                    {completeProduct.sku} ·{" "}
                    {completeProduct.category_name ||
                      completeProduct.category ||
                      "Uncategorized"}
                  </p>
                </div>

                <StockBadge
                  status={getStockStatus(
                    completeProduct
                  )}
                />
              </div>

              <div className="inventory-profile-summary">
                <ProfileMetric
                  label="Current Stock"
                  value={`${physicalStock.toLocaleString("en-PH")} ${stockUnit}`}
                />

                <ProfileMetric
                  label="Sellable Stock"
                  value={`${sellableStock.toLocaleString("en-PH")} ${stockUnit}`}
                />

                <ProfileMetric
                  label="Expired Stock"
                  value={`${expiredStock.toLocaleString("en-PH")} ${stockUnit}`}
                />

                <ProfileMetric
                  label="Supplier"
                  value={
                    completeProduct.vendor_name ||
                    "No supplier"
                  }
                />

                <ProfileMetric
                  label="Latest Supplier Cost"
                  value={formatPeso(
                    completeProduct.supplier_price
                  )}
                />

                <ProfileMetric
                  label="Selling Price"
                  value={formatPeso(
                    completeProduct.selling_price
                  )}
                />

                <ProfileMetric
                  label="Deliveries"
                  value={deliveries.length}
                />

                <ProfileMetric
                  label="Active Batches"
                  value={activeBatches.length}
                />

                <ProfileMetric
                  label="Movements"
                  value={Number(
                    movementSummary.total_movements ||
                      inventoryHistory.length
                  )}
                />
              </div>

              <div className="inventory-details-tabs">
                {[
                  ["overview", "Overview"],
                  [
                    "deliveries",
                    `Deliveries (${deliveries.length})`,
                  ],
                  [
                    "batches",
                    `Batches (${activeBatches.length} Active / ${historyBatchCount} History)`,
                  ],
                  [
                    "sales",
                    `Sales (${sales.length})`,
                  ],
                  [
                    "history",
                    `Movements (${inventoryHistory.length})`,
                  ],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      activeTab === id
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setActiveTab(id)
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <div className="inventory-overview-grid">
                  <DetailsPanel title="Product Information">
                    <DetailRow
                      label="SKU"
                      value={
                        completeProduct.sku ||
                        "N/A"
                      }
                    />

                    <DetailRow
                      label="Variation"
                      value={completeProduct.variant_label && completeProduct.variant_label !== "Standard" ? completeProduct.variant_label : "Standard"}
                    />

                    <DetailRow
                      label="Category"
                      value={
                        completeProduct.category_name ||
                        completeProduct.category ||
                        "Uncategorized"
                      }
                    />

                    <DetailRow
                      label="Unit"
                      value={
                        completeProduct.unit_type ||
                        completeProduct.unit ||
                        "pcs"
                      }
                    />

                    <DetailRow
                      label="Reorder Level"
                      value={Number(
                        completeProduct.reorder_level ||
                          0
                      )}
                    />
                  </DetailsPanel>

                  <DetailsPanel title="Expiry and Consignment">
                    <DetailRow
                      label="Expiry Status"
                      value={getExpiryStatus(
                        completeProduct
                      )}
                    />

                    <DetailRow
                      label="Expiry Date"
                      value={formatDate(
                        completeProduct.nearest_expiry_date ||
                          completeProduct.expiry_date
                      )}
                    />

                    <DetailRow
                      label="Consignment"
                      value={
                        Number(
                          completeProduct.is_consignment ||
                            0
                        ) === 1
                          ? "Yes"
                          : "No"
                      }
                    />

                    <DetailRow
                      label="Pull-out Date"
                      value={formatDate(
                        completeProduct.consignment_pullout_date
                      )}
                    />
                  </DetailsPanel>

                  <DetailsPanel title="Connected Activity">
                    <DetailRow
                      label="Total Delivered"
                      value={Number(
                        completeProduct.total_delivered_quantity ||
                          0
                      )}
                    />

                    <DetailRow
                      label="Total Sold"
                      value={Number(
                        completeProduct.total_sold ||
                          0
                      )}
                    />

                    <DetailRow
                      label="Sales Value"
                      value={formatPeso(
                        completeProduct.total_sales_value
                      )}
                    />

                    <DetailRow
                      label="Last Delivery"
                      value={formatDate(
                        completeProduct.last_delivery_date
                      )}
                    />
                  </DetailsPanel>
                </div>
              )}

              {activeTab === "deliveries" && (
                <>
                  <ProfileTable
                    headings={[
                      "Delivery No.",
                      "Date",
                      "Quantity",
                      "Supplier Price",
                      "Retail Price",
                      "Status",
                    ]}
                    empty="No delivery history for this product."
                  >
                    {deliveryPage.items.map((delivery) => (
                      <tr
                        key={
                          delivery.delivery_item_id
                        }
                      >
                        <td>
                          <strong>
                            {
                              delivery.delivery_order_no
                            }
                          </strong>
                        </td>
                        <td>
                          {formatDate(
                            delivery.delivery_date
                          )}
                        </td>
                        <td>
                          {delivery.quantity}{" "}
                          {delivery.unit}
                        </td>
                        <td>
                          {formatPeso(
                            delivery.supplier_price
                          )}
                        </td>
                        <td>
                          {formatPeso(
                            delivery.retail_price
                          )}
                        </td>
                        <td>
                          {delivery.status}
                        </td>
                      </tr>
                    ))}
                  </ProfileTable>

                  <DetailPagination
                    currentPage={deliveryPage.page}
                    totalPages={deliveryPage.totalPages}
                    totalItems={deliveries.length}
                    pageSize={DETAIL_PAGE_SIZE}
                    onPageChange={(page) =>
                      changeDetailPage(
                        "deliveries",
                        page
                      )
                    }
                  />
                </>
              )}

              {activeTab === "batches" && (
                <div className="inventory-batch-section">
                  <div className="inventory-batch-toolbar">
                    <div>
                      <strong>Inventory Batches</strong>
                      <span>
                        Active stock is shown first. Expired and depleted batches remain available for history and audit.
                      </span>
                    </div>

                    <div className="inventory-batch-filters">
                      {[
                        ["Active", activeBatches.length],
                        ["Expired", expiredBatches.length],
                        ["Depleted", depletedBatches.length],
                        ["All", batches.length],
                      ].map(([filter, count]) => (
                        <button
                          key={filter}
                          type="button"
                          className={
                            batchFilter === filter
                              ? "active"
                              : ""
                          }
                          onClick={() => {
                            setBatchFilter(filter);
                            changeDetailPage(
                              "batches",
                              1
                            );
                          }}
                        >
                          {filter}
                          <span>{count}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <ProfileTable
                    headings={[
                      "Batch ID",
                      "Delivery",
                      "Quantity",
                      "Supplier Price",
                      "Expiry",
                      "Status",
                    ]}
                    empty={`No ${batchFilter.toLowerCase()} batches for this product.`}
                  >
                    {batchPage.items.map((batch) => {
                      const batchStatus =
                        getBatchStatus(batch);

                      return (
                        <tr key={batch.batch_id}>
                          <td>
                            BAT-
                            {String(
                              batch.batch_id
                            ).padStart(4, "0")}
                          </td>
                          <td>
                            {batch.delivery_order_no ||
                              "No delivery"}
                          </td>
                          <td>
                            {batch.quantity}
                          </td>
                          <td>
                            {formatPeso(
                              batch.supplier_price
                            )}
                          </td>
                          <td>
                            {formatDate(
                              batch.expiry_date
                            )}
                          </td>
                          <td>
                            <span
                              className={`inventory-batch-status ${batchStatus.toLowerCase()}`}
                            >
                              {batchStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </ProfileTable>

                  <DetailPagination
                    currentPage={batchPage.page}
                    totalPages={batchPage.totalPages}
                    totalItems={visibleBatches.length}
                    pageSize={DETAIL_PAGE_SIZE}
                    onPageChange={(page) =>
                      changeDetailPage(
                        "batches",
                        page
                      )
                    }
                  />
                </div>
              )}

              {activeTab === "sales" && (
                <>
                  <ProfileTable
                    headings={[
                      "Transaction",
                      "Date",
                      "Quantity",
                      "Price",
                      "Subtotal",
                    ]}
                    empty="No POS sales history for this product."
                  >
                    {salesPage.items.map((sale) => (
                      <tr
                        key={`${sale.pos_id}-${sale.product_id}`}
                      >
                        <td>
                          <strong>
                            {
                              sale.transaction_code
                            }
                          </strong>
                        </td>
                        <td>
                          {sale.transaction_date}
                        </td>
                        <td>{sale.quantity}</td>
                        <td>
                          {formatPeso(sale.price)}
                        </td>
                        <td>
                          {formatPeso(
                            sale.subtotal
                          )}
                        </td>
                      </tr>
                    ))}
                  </ProfileTable>

                  <DetailPagination
                    currentPage={salesPage.page}
                    totalPages={salesPage.totalPages}
                    totalItems={sales.length}
                    pageSize={DETAIL_PAGE_SIZE}
                    onPageChange={(page) =>
                      changeDetailPage(
                        "sales",
                        page
                      )
                    }
                  />
                </>
              )}

              {activeTab === "history" && (
                <div className="inventory-movement-section">
                  <div className="inventory-movement-summary">
                    <div>
                      <span>Total Movements</span>
                      <strong>
                        {Number(
                          movementSummary.total_movements ||
                            inventoryHistory.length
                        ).toLocaleString("en-PH")}
                      </strong>
                    </div>

                    <div className="stock-in">
                      <span>Total Stock In</span>
                      <strong>
                        +{Number(
                          movementSummary.total_stock_in || 0
                        ).toLocaleString("en-PH")}
                      </strong>
                    </div>

                    <div className="stock-out">
                      <span>Total Stock Out</span>
                      <strong>
                        -{Number(
                          movementSummary.total_stock_out || 0
                        ).toLocaleString("en-PH")}
                      </strong>
                    </div>
                  </div>

                  <ProfileTable
                    headings={[
                      "Date & Time",
                      "Movement",
                      "Reference",
                      "Quantity",
                      "Previous Stock",
                      "New Stock",
                      "User",
                      "Remarks",
                    ]}
                    empty="No inventory movement history for this product."
                  >
                    {historyPage.items.map(
                      (movement, index) => (
                        <tr
                          key={
                            movement.history_id ||
                            `${movement.created_at}-${index}`
                          }
                        >
                          <td>
                            {formatDateTime(
                              movement.created_at
                            )}
                          </td>

                          <td>
                            <span
                              className={`inventory-movement-badge ${getMovementClass(
                                movement
                              )}`}
                            >
                              {movement.action_type ||
                                movement.movement_type ||
                                "Inventory Update"}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {movement.reference_no ||
                                movement.delivery_order_no ||
                                "No reference"}
                            </strong>
                          </td>

                         <td>
                      <strong className="inventory-movement-quantity">
                        {getMovementQuantity(movement)}
                      </strong>
                    </td>

                          <td>
                            {movement.previous_quantity !==
                            null
                              ? Number(
                                  movement.previous_quantity
                                ).toLocaleString(
                                  "en-PH"
                                )
                              : "N/A"}
                          </td>

                          <td>
                            {movement.new_quantity !== null
                              ? Number(
                                  movement.new_quantity
                                ).toLocaleString(
                                  "en-PH"
                                )
                              : "N/A"}
                          </td>

                          <td>
                            {movement.created_by_name ||
                              movement.user_name ||
                              "System User"}
                          </td>

                          <td>
                            {movement.remarks ||
                              "No remarks"}
                          </td>
                        </tr>
                      )
                    )}
                  </ProfileTable>

                  <DetailPagination
                    currentPage={historyPage.page}
                    totalPages={historyPage.totalPages}
                    totalItems={inventoryHistory.length}
                    pageSize={DETAIL_PAGE_SIZE}
                    onPageChange={(page) =>
                      changeDetailPage(
                        "history",
                        page
                      )
                    }
                  />
                </div>
              )}
            </div>

            <div className="inventory-modal-footer">
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
    </div>
  );
}

function DetailPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) {
  if (totalItems <= pageSize) {
    return null;
  }

  const start =
    (currentPage - 1) * pageSize + 1;
  const end = Math.min(
    currentPage * pageSize,
    totalItems
  );

  return (
    <div className="inventory-detail-pagination">
      <span>
        Showing {start}–{end} of {totalItems}
      </span>

      <div>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() =>
            onPageChange(currentPage - 1)
          }
        >
          ‹ Previous
        </button>

        <strong>
          Page {currentPage} of {totalPages}
        </strong>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() =>
            onPageChange(currentPage + 1)
          }
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

function ProfileMetric({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailsPanel({ title, children }) {
  return (
    <section className="inventory-details-panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="inventory-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfileTable({
  headings,
  empty,
  children,
}) {
  const childCount =
    Array.isArray(children)
      ? children.length
      : children
      ? 1
      : 0;

  return (
    <div className="inventory-profile-table-wrap">
      <table className="inventory-profile-table">
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {childCount > 0 ? (
            children
          ) : (
            <tr>
              <td colSpan={headings.length}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RestockModal({
  product, data, saving, today, formatProductId,
  getProductImage, onChange, onSubmit, onClose,
}) {
  const unit = product.unit_type || product.unit || "pcs";
  const quantity = Number(data.quantity || 0);
  const currentStock = Number(product.quantity || 0);
  const reorderLevel = Number(product.reorder_level || 0);

  return (
    <div className="modal-overlay inventory-top-modal">
      <div className="modal-box inventory-restock-modal">
        <div className="inventory-modal-header">
          <div>
            <div className="inventory-modal-title">
              <div className="inventory-restock-title-icon"><Truck size={22} /></div>
              <h2>Request Restock</h2>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={saving}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="inventory-restock-body">
            <div className="inventory-restock-product">
              <img src={getProductImage(product)} alt={product.product_name}
                onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMAGE; }} />
              <div>
                <span>{formatProductId(product.product_id)}</span>
                <h3>{product.product_name}</h3>
                <p>{product.sku || "No SKU"} · {product.vendor_name || "No supplier"}</p>
              </div>
            </div>

            <div className="inventory-restock-summary">
              <div><span>Current Stock</span><strong>{currentStock.toLocaleString("en-PH")} {unit}</strong></div>
              <div><span>Reorder Level</span><strong>{reorderLevel.toLocaleString("en-PH")} {unit}</strong></div>
              <div><span>Requested Qty</span><strong>{quantity.toLocaleString("en-PH")} {unit}</strong></div>
            </div>

            <section className="inventory-restock-form-section">
              <div className="inventory-form-grid">
                <InventoryField label={`Requested Quantity (${unit})`} required>
                  <input type="number" name="quantity" min="1" step="1"
                    value={data.quantity} onChange={onChange}
                    placeholder="Enter quantity needed" autoFocus />
                </InventoryField>

                <InventoryField label="Preferred Delivery Date">
                  <input type="date" name="preferred_delivery_date" min={today}
                    value={data.preferred_delivery_date} onChange={onChange} />
                </InventoryField>

                <InventoryField label="Supplier">
                  <input type="text" value={product.vendor_name || "No supplier linked"} readOnly />
                </InventoryField>

                

                <div className="inventory-field wide">
                  <label>Remarks</label>
                  <textarea name="remarks" value={data.remarks} onChange={onChange}
                    rows="4" maxLength="1000"
                    placeholder="Optional instructions for the supplier..." />
                </div>
              </div>
            </section>
          </div>

          <div className="inventory-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary inventory-restock-submit" disabled={saving}>
              {saving ? <LoaderCircle size={17} className="inventory-spinner" /> : <Truck size={17} />}
              {saving ? "Sending Request..." : "Send Restock Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({
  data,
  saving,
  onConfirm,
  onClose,
}) {
  return (
    <div className="modal-overlay inventory-top-modal">
      <div className="modal-box inventory-confirm-modal">
        <div>
          <Archive size={28} />
        </div>

        <h2>{data.title}</h2>
        <p>{data.message}</p>

        <section>
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
            className="btn btn-dark"
            onClick={onConfirm}
            disabled={saving}
          >
            {saving && (
              <LoaderCircle
                size={17}
                className="inventory-spinner"
              />
            )}

            {saving
              ? "Archiving..."
              : data.confirmText}
          </button>
        </section>
      </div>
    </div>
  );
}

function NoticeModal({ data, onClose }) {
  const error = data.type === "error";

  return (
    <div className="modal-overlay inventory-top-modal">
      <div className="modal-box inventory-notice-modal">
        <div className={error ? "error" : ""}>
          {error ? (
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

export default InventoryManagement;