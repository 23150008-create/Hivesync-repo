import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  History,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Undo2,
  X,
  XCircle,
} from "lucide-react";

import "../styles/pos.css";
import bacnotanLogo from "../assets/Bacnotan Logo.png";
import API_BASE from "../config/api";

const POS_API =
  `${API_BASE}/pos_management`;

const AUDIT_API =
  `${API_BASE}/audit_trail/log_action.php`;

const BACKEND_URL =
  `${API_BASE}/`;

const EMPTY_NOTICE = {
  open: false,
  type: "success",
  title: "",
  message: "",
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


const createCheckoutRequestToken = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    "checkout",
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join("-");
};

function POSManagement({ user }) {
  const role = user?.role || "Staff";

  const canSell = ["Admin", "Staff"].includes(role);
  const canVoid =
    role === "Admin" ||
    role === "Staff";

  const activeView = "history";

  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(["All"]);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checkoutRequestToken, setCheckoutRequestToken] = useState(null);

  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const TRANSACTIONS_PER_PAGE = 15;

  const [transactionPage, setTransactionPage] = useState(1);

  const [transactionPagination, setTransactionPagination] = useState({
    current_page: 1,
    per_page: TRANSACTIONS_PER_PAGE,
    total_records: 0,
    total_pages: 1,
    from: 0,
    to: 0,
  });

  const [summary, setSummary] = useState({
    total_transactions: 0,
    recorded_sales: 0,
    total_refunded: 0,
    voided_transactions: 0,
    net_sales: 0,
  });

  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("WALK IN CLIENT");
  const [preparedBy, setPreparedBy] = useState(
    user?.full_name || "System Admin"
  );
  const [receivedBy, setReceivedBy] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [cashAmount, setCashAmount] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [customOfficeName, setCustomOfficeName] = useState("");
  const [receivableNotes, setReceivableNotes] = useState("");

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionDetails, setTransactionDetails] = useState(null);

  const [receipt, setReceipt] = useState(null);
  const [receiptMode, setReceiptMode] = useState("ORIGINAL");

  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnReason, setReturnReason] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const [notice, setNotice] = useState(EMPTY_NOTICE);

  const showNotice = (type, title, message) => {
    setNotice({
      open: true,
      type,
      title,
      message,
    });
  };

  const closeNotice = () => {
    setNotice(EMPTY_NOTICE);
  };

  const formatPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

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

  const apiRequest = async (request) => {
    try {
      const response = await request;
      return response.data;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Unable to connect to the HiveSync server.";

      throw new Error(message);
    }
  };

  const getCsrfToken = async () => {
    const response = await axios.get(
      `${BACKEND_URL}auth/csrf_token.php`,
      {
        withCredentials: true,
      }
    );

    if (
      !response.data?.success ||
      !response.data?.csrf_token
    ) {
      throw new Error(
        response.data?.message ||
          "Unable to verify the security token."
      );
    }

    return response.data.csrf_token;
  };

  const logAudit = async (action, details) => {
    try {
      await axios.post(AUDIT_API, {
        user_id: user?.user_id || 1,
        user_name: user?.full_name || "Unknown User",
        module: "Point of Sale",
        action,
        details,
      }, {
        withCredentials: true,
      });
    } catch (error) {
      console.error("Audit log error:", error);
    }
  };

  const getProductImage = (product) => {
    const image =
      product?.product_image_url ||
      product?.product_image ||
      "";

    if (!image) {
      return "";
    }

    if (
      String(image).startsWith("http://") ||
      String(image).startsWith("https://")
    ) {
      return image;
    }

    if (String(image).startsWith("uploads/")) {
      return `${BACKEND_URL}${image}`;
    }

    if (String(image).startsWith("products/")) {
      return `${BACKEND_URL}uploads/${image}`;
    }

    return `${BACKEND_URL}uploads/products/${image}`;
  };

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);

    try {
      const data = await apiRequest(
        axios.get(
          `${POS_API}/get_products.php?t=${Date.now()}`,
          {
            withCredentials: true,
          }
        )
      );

      if (!data.success) {
        throw new Error(data.message || "Failed to load POS products.");
      }

      const loadedProducts = Array.isArray(data.products)
        ? data.products
        : [];

      setProducts(loadedProducts);

      const categoryList = loadedProducts
        .map((product) => product.category_name || product.category)
        .filter(Boolean)
        .filter((category) => {
          const normalized = String(category).trim().toLowerCase();

          return normalized !== "other" && normalized !== "others";
        });

      setCategories(["All", ...new Set(categoryList)]);
    } catch (error) {
      setProducts([]);

      showNotice(
        "error",
        "Unable to Load Products",
        error.message
      );
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoadingTransactions(true);

    try {
      const params = new URLSearchParams();

      if (transactionSearch.trim()) {
        params.set("search", transactionSearch.trim());
      }

      if (transactionStatus !== "All") {
        params.set("status", transactionStatus);
      }

      if (dateFrom) {
        params.set("date_from", dateFrom);
      }

      if (dateTo) {
        params.set("date_to", dateTo);
      }

      params.set(
        "page",
        String(transactionPage)
      );
      params.set(
        "limit",
        String(TRANSACTIONS_PER_PAGE)
      );
      params.set("t", Date.now().toString());

      const data = await apiRequest(
        axios.get(
          `${POS_API}/get_transactions.php?${params.toString()}`,
          {
            withCredentials: true,
          }
        )
      );

      if (!data.success) {
        throw new Error(
          data.message || "Failed to load POS transactions."
        );
      }

      setTransactions(
        Array.isArray(data.transactions) ? data.transactions : []
      );

      const nextPagination = data.pagination || {};

      setTransactionPagination({
        current_page: Number(
          nextPagination.current_page ||
            transactionPage ||
            1
        ),
        per_page: Number(
          nextPagination.per_page ||
            TRANSACTIONS_PER_PAGE
        ),
        total_records: Number(
          nextPagination.total_records || 0
        ),
        total_pages: Math.max(
          1,
          Number(
            nextPagination.total_pages || 1
          )
        ),
        from: Number(
          nextPagination.from || 0
        ),
        to: Number(
          nextPagination.to || 0
        ),
      });

      if (
        Number(nextPagination.current_page || transactionPage) !==
        transactionPage
      ) {
        setTransactionPage(
          Number(nextPagination.current_page || 1)
        );
      }

      setSummary({
        total_transactions: data.summary?.total_transactions || 0,
        recorded_sales: data.summary?.recorded_sales || 0,
        total_refunded: data.summary?.total_refunded || 0,
        voided_transactions: data.summary?.voided_transactions || 0,
        net_sales: data.summary?.net_sales || 0,
      });
    } catch (error) {
      setTransactions([]);

      setTransactionPagination({
        current_page: 1,
        per_page: TRANSACTIONS_PER_PAGE,
        total_records: 0,
        total_pages: 1,
        from: 0,
        to: 0,
      });

      showNotice(
        "error",
        "Unable to Load Transactions",
        error.message
      );
    } finally {
      setLoadingTransactions(false);
    }
  }, [
    transactionSearch,
    transactionStatus,
    dateFrom,
    dateTo,
    transactionPage,
  ]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const transactionPageNumbers = useMemo(() => {
    const totalPages = Math.max(
      1,
      Number(
        transactionPagination.total_pages || 1
      )
    );

    const currentPage = Math.min(
      totalPages,
      Math.max(
        1,
        Number(
          transactionPagination.current_page ||
            transactionPage ||
            1
        )
      )
    );

    const pages = [];

    const addPage = (value) => {
      if (
        value >= 1 &&
        value <= totalPages &&
        !pages.includes(value)
      ) {
        pages.push(value);
      }
    };

    addPage(1);

    for (
      let page = currentPage - 1;
      page <= currentPage + 1;
      page += 1
    ) {
      addPage(page);
    }

    addPage(totalPages);

    return pages.sort((a, b) => a - b);
  }, [
    transactionPagination.current_page,
    transactionPagination.total_pages,
    transactionPage,
  ]);

  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();

    return products.filter((product) => {
      const category =
        product.category_name ||
        product.category ||
        "Uncategorized";

      const matchesCategory =
        selectedCategory === "All" ||
        category === selectedCategory;

      const matchesSearch =
        keyword === "" ||
        [
          product.product_name,
          product.sku,
          category,
          product.vendor_name,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(keyword)
        );

      return matchesCategory && matchesSearch;
    });
  }, [products, productSearch, selectedCategory]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0
      ),
    [cart]
  );

  const normalizedDiscountPercent = Math.min(
    100,
    Math.max(0, Number(discountPercent || 0))
  );

  const discountAmount =
    subtotal * (normalizedDiscountPercent / 100);

  const grandTotal = Math.max(
    0,
    subtotal - discountAmount
  );

  const amountTendered = Math.max(
    0,
    Number(cashAmount || 0)
  );

  const changeAmount =
    paymentType === "Cash"
      ? Math.max(0, amountTendered - grandTotal)
      : 0;

  const receivableBalance =
    paymentType === "Receivable"
      ? Math.max(0, grandTotal - amountTendered)
      : 0;

  const addToCart = (product) => {
    if (!canSell) {
      showNotice(
        "error",
        "Permission Denied",
        "Your account is not allowed to process POS sales."
      );
      return;
    }

    const stock = Number(product.quantity || 0);
    const price = Number(
      product.selling_price ||
        product.unit_price ||
        0
    );

    if (stock <= 0) {
      showNotice(
        "error",
        "Out of Stock",
        `${product.product_name} is currently out of stock.`
      );
      return;
    }

    if (price <= 0) {
      showNotice(
        "error",
        "Invalid Selling Price",
        `${product.product_name} does not have a valid selling price.`
      );
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) =>
          String(item.product_id) ===
          String(product.product_id)
      );

      if (existing) {
        if (Number(existing.quantity) >= stock) {
          showNotice(
            "error",
            "Maximum Stock Reached",
            `Only ${stock} item(s) of ${product.product_name} are available.`
          );

          return current;
        }

        return current.map((item) => {
          if (
            String(item.product_id) !==
            String(product.product_id)
          ) {
            return item;
          }

          const newQuantity =
            Number(item.quantity) + 1;

          return {
            ...item,
            quantity: newQuantity,
            subtotal: newQuantity * Number(item.price),
          };
        });
      }

      return [
        ...current,
        {
          product_id: product.product_id,
          product_name: product.product_name,
          sku: product.sku || "",
          stock,
          quantity: 1,
          price,
          subtotal: price,
          unit:
            product.unit_type ||
            product.unit ||
            "pcs",
        },
      ];
    });
  };

  const updateCartQuantity = (productId, value) => {
    setCart((current) =>
      current.map((item) => {
        if (
          String(item.product_id) !==
          String(productId)
        ) {
          return item;
        }

        if (value === "") {
          return {
            ...item,
            quantity: "",
            subtotal: 0,
          };
        }

        let quantity = Math.floor(Number(value));

        if (!Number.isFinite(quantity)) {
          quantity = 1;
        }

        quantity = Math.max(1, quantity);

        if (quantity > Number(item.stock)) {
          quantity = Number(item.stock);

          showNotice(
            "error",
            "Insufficient Stock",
            `Only ${item.stock} item(s) of ${item.product_name} are available.`
          );
        }

        return {
          ...item,
          quantity,
          subtotal: quantity * Number(item.price),
        };
      })
    );
  };

  const normalizeCartQuantity = (productId, value) => {
    if (
      value === "" ||
      Number(value) <= 0 ||
      !Number.isFinite(Number(value))
    ) {
      updateCartQuantity(productId, 1);
    }
  };

  const removeCartItem = (productId) => {
    setCart((current) =>
      current.filter(
        (item) =>
          String(item.product_id) !==
          String(productId)
      )
    );
  };

  const resetSaleForm = () => {
    setCart([]);
    setCustomerName("WALK IN CLIENT");
    setPreparedBy(user?.full_name || "System Admin");
    setReceivedBy("");
    setDiscountPercent("");
    setPaymentType("Cash");
    setCashAmount("");
    setEmployeeName("");
    setOfficeName("");
    setCustomOfficeName("");
    setReceivableNotes("");
  };

  const requestCheckout = () => {
    if (cart.length === 0) {
      showNotice(
        "error",
        "Empty Transaction",
        "Add at least one product before checkout."
      );
      return;
    }

    if (!customerName.trim()) {
      showNotice(
        "error",
        "Customer Name Required",
        "Enter the customer name before checkout."
      );
      return;
    }

    const invalidItem = cart.find(
      (item) =>
        Number(item.quantity) <= 0 ||
        Number(item.quantity) > Number(item.stock)
    );

    if (invalidItem) {
      showNotice(
        "error",
        "Invalid Quantity",
        `Review the quantity entered for ${invalidItem.product_name}.`
      );
      return;
    }

    const resolvedOfficeName =
      officeName === "Other"
        ? customOfficeName.trim()
        : officeName.trim();

    if (paymentType === "Cash") {
      if (amountTendered < grandTotal) {
        showNotice(
          "error",
          "Insufficient Cash",
          `The required cash amount is ${formatPeso(grandTotal)}.`
        );
        return;
      }
    } else {
      if (!employeeName.trim()) {
        showNotice(
          "error",
          "Employee Name Required",
          "Enter the employee name for this receivable transaction."
        );
        return;
      }

      if (!resolvedOfficeName) {
        showNotice(
          "error",
          "Office Required",
          officeName === "Other"
            ? "Specify the employee's office or department."
            : "Select the employee's office or department."
        );
        return;
      }

      if (amountTendered >= grandTotal) {
        showNotice(
          "error",
          "Invalid Receivable Amount",
          "A receivable transaction must have a remaining balance."
        );
        return;
      }
    }

    setCheckoutRequestToken(createCheckoutRequestToken());
    setShowCheckoutModal(true);
  };

  const loadReceipt = async (posId) => {
    const data = await apiRequest(
      axios.get(
        `${POS_API}/get_receipt.php?pos_id=${posId}&t=${Date.now()}`,
        {
          withCredentials: true,
        }
      )
    );

    if (!data.success) {
      throw new Error(data.message || "Failed to load receipt.");
    }

    return data.receipt || data.sale;
  };

  const completeCheckout = async () => {
    if (processing) return;

    setProcessing(true);

    const requestToken =
      checkoutRequestToken ||
      createCheckoutRequestToken();

    if (!checkoutRequestToken) {
      setCheckoutRequestToken(requestToken);
    }

    try {
      const csrfToken = await getCsrfToken();

      const data = await apiRequest(
        axios.post(`${POS_API}/create_sale.php`, {
          items: cart.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
          })),
          customer_name:
            customerName.trim() || "WALK IN CLIENT",
          prepared_by:
            preparedBy.trim() ||
            user?.full_name ||
            "System Admin",
          received_by:
            receivedBy.trim() ||
            customerName.trim() ||
            "WALK IN CLIENT",
          discount_percent: normalizedDiscountPercent,
          payment_type: paymentType,
          cash_amount: amountTendered,
          payment_method: "Cash",
          employee_name:
            paymentType === "Receivable"
              ? employeeName.trim()
              : "",
          office_name:
            paymentType === "Receivable"
              ? resolvedOfficeName
              : "",
          receivable_notes:
            paymentType === "Receivable"
              ? receivableNotes.trim()
              : "",
          created_by: user?.user_id || 1,
          request_token: requestToken,
        }, {
          withCredentials: true,
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        })
      );

      if (!data.success) {
        throw new Error(
          data.message || "Checkout failed."
        );
      }

      setCheckoutRequestToken(null);
      setShowCheckoutModal(false);
      resetSaleForm();

      Promise.resolve()
        .then(() =>
          logAudit(
            "Complete Sale",
            `Completed POS transaction ${data.transaction_code} worth ${formatPeso(
              data.total_amount
            )}.`
          )
        )
        .catch((auditError) => {
          console.error("POS audit error:", auditError);
        });

      Promise.allSettled([
        loadProducts(),
        loadTransactions(),
      ]);

      try {
        const loadedReceipt = await loadReceipt(data.pos_id);
        setReceipt(loadedReceipt);
        setReceiptMode("ORIGINAL");
        setShowReceiptModal(true);
      } catch (receiptError) {
        showNotice(
          "success",
          "Sale Completed",
          `${data.transaction_code} was saved successfully, but the receipt could not be loaded automatically. You can reprint it from Transaction History.`
        );
      }
    } catch (error) {
      showNotice(
        "error",
        "Checkout Failed",
        error.message
      );
    } finally {
      setProcessing(false);
    }
  };

  const viewTransaction = async (transaction) => {
    setSelectedTransaction(transaction);
    setTransactionDetails(null);
    setShowDetailsModal(true);
    setLoadingDetails(true);

    try {
      const data = await apiRequest(
        axios.get(
          `${POS_API}/get_transaction_details.php?pos_id=${transaction.pos_id}&t=${Date.now()}`,
          {
            withCredentials: true,
          }
        )
      );

      if (!data.success) {
        throw new Error(
          data.message ||
            "Failed to load transaction details."
        );
      }

      setTransactionDetails(data);
    } catch (error) {
      setShowDetailsModal(false);
      setSelectedTransaction(null);

      showNotice(
        "error",
        "Unable to Load Transaction",
        error.message
      );
    } finally {
      setLoadingDetails(false);
    }
  };

  const reprintReceipt = async (transaction) => {
    try {
      const loadedReceipt = await loadReceipt(
        transaction.pos_id
      );

      setReceipt(loadedReceipt);
      setReceiptMode("REPRINT");
      setShowReceiptModal(true);

      Promise.resolve()
        .then(() =>
          logAudit(
            "Reprint Receipt",
            `Reprinted receipt ${transaction.transaction_code}.`
          )
        )
        .catch((auditError) => {
          console.error("POS audit error:", auditError);
        });
    } catch (error) {
      showNotice(
        "error",
        "Unable to Reprint Receipt",
        error.message
      );
    }
  };

  const openReturnModal = () => {
    const transaction =
      transactionDetails?.transaction;

    if (!transaction) return;

    if (Number(transaction.can_return) !== 1) {
      showNotice(
        "error",
        "Return Period Expired",
        "Returns are allowed only within five calendar days from the transaction date."
      );
      return;
    }

    const initialQuantities = {};

    (transactionDetails.items || []).forEach((item) => {
      initialQuantities[item.item_id] = 0;
    });

    setReturnQuantities(initialQuantities);
    setReturnReason("");
    setShowReturnModal(true);
  };

  const updateReturnQuantity = (item, value) => {
    if (value === "") {
      setReturnQuantities((current) => ({
        ...current,
        [item.item_id]: "",
      }));
      return;
    }

    let quantity = Math.floor(Number(value));

    if (!Number.isFinite(quantity)) {
      quantity = 0;
    }

    quantity = Math.max(0, quantity);
    quantity = Math.min(
      quantity,
      Number(item.returnable_quantity || 0)
    );

    setReturnQuantities((current) => ({
      ...current,
      [item.item_id]: quantity,
    }));
  };

  const normalizeReturnQuantity = (item) => {
    const currentValue =
      returnQuantities[item.item_id];

    if (
      currentValue === "" ||
      !Number.isFinite(Number(currentValue)) ||
      Number(currentValue) < 0
    ) {
      setReturnQuantities((current) => ({
        ...current,
        [item.item_id]: 0,
      }));
    }
  };

  const selectedReturnItems = useMemo(
    () =>
      (transactionDetails?.items || [])
        .map((item) => ({
          ...item,
          selected_quantity: Number(
            returnQuantities[item.item_id] || 0
          ),
        }))
        .filter(
          (item) => item.selected_quantity > 0
        ),
    [transactionDetails, returnQuantities]
  );

  const estimatedRefund = useMemo(() => {
    const transaction =
      transactionDetails?.transaction;

    if (!transaction) return 0;

    const originalSubtotal = Number(
      transaction.subtotal_amount || 0
    );

    const netTotal = Number(
      transaction.total_amount || 0
    );

    const ratio =
      originalSubtotal > 0
        ? netTotal / originalSubtotal
        : 1;

    return selectedReturnItems.reduce(
      (sum, item) =>
        sum +
        Number(item.selected_quantity) *
          Number(item.price || 0) *
          ratio,
      0
    );
  }, [selectedReturnItems, transactionDetails]);

  const submitReturn = async () => {
    if (processing) return;

    if (selectedReturnItems.length === 0) {
      showNotice(
        "error",
        "No Products Selected",
        "Enter a return quantity for at least one product."
      );
      return;
    }

    if (!returnReason.trim()) {
      showNotice(
        "error",
        "Return Reason Required",
        "Enter the reason for returning the selected products."
      );
      return;
    }

    setProcessing(true);

    try {
      const csrfToken = await getCsrfToken();

      const transaction =
        transactionDetails.transaction;

      const data = await apiRequest(
        axios.post(`${POS_API}/return_items.php`, {
          pos_id: transaction.pos_id,
          items: selectedReturnItems.map((item) => ({
            item_id: item.item_id,
            quantity: item.selected_quantity,
          })),
          return_reason: returnReason.trim(),
          processed_by: user?.user_id || 1,
          processed_by_name:
            user?.full_name || "Unknown User",
        }, {
          withCredentials: true,
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        })
      );

      if (!data.success) {
        throw new Error(
          data.message || "Product return failed."
        );
      }

      Promise.resolve()
        .then(() =>
          logAudit(
            "Return POS Products",
            `Processed return ${data.return_number} for transaction ${transaction.transaction_code}.`
          )
        )
        .catch((auditError) => {
          console.error("POS audit error:", auditError);
        });

      setShowReturnModal(false);
      setShowDetailsModal(false);
      setSelectedTransaction(null);
      setTransactionDetails(null);

      await Promise.all([
        loadProducts(),
        loadTransactions(),
      ]);

      showNotice(
        "success",
        "Return Completed",
        `${data.message} Refund amount: ${formatPeso(
          data.refund_amount
        )}.`
      );
    } catch (error) {
      showNotice(
        "error",
        "Return Failed",
        error.message
      );
    } finally {
      setProcessing(false);
    }
  };

  const openVoidModal = () => {
    if (!canVoid) {
      showNotice(
        "error",
        "Administrator Required",
        "Admin and Staff can void a transaction."
      );
      return;
    }

    setVoidReason("");
    setShowVoidModal(true);
  };

  const submitVoid = async () => {
    if (processing) return;

    if (!voidReason.trim()) {
      showNotice(
        "error",
        "Void Reason Required",
        "Enter the reason for voiding this transaction."
      );
      return;
    }

    const transaction =
      transactionDetails?.transaction;

    if (!transaction) return;

    setProcessing(true);

    try {
      const csrfToken = await getCsrfToken();

      const data = await apiRequest(
        axios.post(`${POS_API}/void_transaction.php`, {
          pos_id: transaction.pos_id,
          void_reason: voidReason.trim(),
          voided_by: user?.user_id || 1,
          voided_by_name:
            user?.full_name || "Unknown User",
        }, {
          withCredentials: true,
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        })
      );

      if (!data.success) {
        throw new Error(
          data.message || "Transaction void failed."
        );
      }

      Promise.resolve()
        .then(() =>
          logAudit(
            "Void POS Transaction",
            `Voided transaction ${transaction.transaction_code}. Reason: ${voidReason.trim()}.`
          )
        )
        .catch((auditError) => {
          console.error("POS audit error:", auditError);
        });

      setShowVoidModal(false);
      setShowDetailsModal(false);
      setSelectedTransaction(null);
      setTransactionDetails(null);

      await Promise.all([
        loadProducts(),
        loadTransactions(),
      ]);

      showNotice(
        "success",
        "Transaction Voided",
        data.message
      );
    } catch (error) {
      showNotice(
        "error",
        "Void Failed",
        error.message
      );
    } finally {
      setProcessing(false);
    }
  };


  const printReceipt = () => {
    const receiptElement =
      document.getElementById("pos-receipt");

    if (!receiptElement) {
      showNotice(
        "error",
        "Receipt Not Ready",
        "The receipt content is not available yet."
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
        "Allow pop-ups for HiveSync, then click Print Receipt again."
      );
      return;
    }

    const receiptMarkup =
      receiptElement.outerHTML;

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>
            POS Receipt - ${
              receipt?.transaction_code || "HiveSync"
            }
          </title>

          <style>
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
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              width: 80mm;
              max-width: 80mm;
              padding: 0;
            }

            .print-sheet {
              width: 80mm;
              max-width: 80mm;
              display: flex;
              justify-content: flex-start;
              align-items: flex-start;
            }

            .pos-receipt-paper {
              width: 80mm;
              max-width: 80mm;
              margin: 0;
              padding: 5mm 4mm;
              position: relative;
              overflow: hidden;
              background: #ffffff;
              color: #111827;
              border: 1px solid #e7d28b;
              font-family: "Courier New", Courier, monospace;
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .pos-reprint-mark,
            .pos-voided-mark {
              position: absolute;
              top: 19px;
              right: -34px;
              width: 140px;
              padding: 6px 0;
              transform: rotate(38deg);
              text-align: center;
              font-size: 9px;
              font-weight: 900;
            }

            .pos-reprint-mark {
              background: #fff3c4;
              color: #7a5600;
            }

            .pos-voided-mark {
              background: #1b2430;
              color: #f4b400;
            }

            .pos-receipt-logo {
              width: 46px;
              height: 46px;
              margin: 0 auto;
              display: block;
              object-fit: contain;
            }

            .pos-receipt-paper header {
              margin-top: 6px;
              text-align: center;
            }

            .pos-receipt-paper header h3 {
              margin: 0;
              font-size: 12px;
              line-height: 1.25;
            }

            .pos-receipt-paper header p {
              margin: 3px 0 6px;
              font-size: 8px;
            }

            .pos-receipt-paper header h2 {
              margin: 0 0 6px;
              font-size: 11px;
              letter-spacing: 0.6px;
            }

            .pos-receipt-paper header > strong {
              color: #9a6d00;
              font-size: 10px;
            }

            .pos-receipt-divider {
              margin: 8px 0;
              border-top: 1px dashed #9a6d00;
            }

            .pos-receipt-row {
              margin: 4px 0;
              display: grid;
              grid-template-columns: 1fr 1.45fr;
              gap: 8px;
              font-size: 8px;
              line-height: 1.35;
            }

            .pos-receipt-row strong {
              text-align: right;
              overflow-wrap: anywhere;
            }

            .pos-receipt-row.bold {
              padding-top: 6px;
              border-top: 1px solid #d6b24a;
              font-size: 10px;
              font-weight: 900;
            }

            .pos-receipt-items {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 7.5px;
            }

            .pos-receipt-items th,
            .pos-receipt-items td {
              padding: 4px 2px;
              vertical-align: top;
              overflow-wrap: anywhere;
            }

            .pos-receipt-items th {
              border-bottom: 1px solid #d6b24a;
              text-transform: uppercase;
            }

            .pos-receipt-items th:first-child,
            .pos-receipt-items td:first-child {
              width: 10%;
              text-align: center;
            }

            .pos-receipt-items th:nth-child(2),
            .pos-receipt-items td:nth-child(2) {
              width: 44%;
            }

            .pos-receipt-items th:nth-child(3),
            .pos-receipt-items td:nth-child(3),
            .pos-receipt-items th:nth-child(4),
            .pos-receipt-items td:nth-child(4) {
              text-align: right;
              white-space: nowrap;
            }

            .pos-receipt-signatures {
              margin-top: 25px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              text-align: center;
              font-size: 7.5px;
            }

            .pos-receipt-signatures > div {
              padding-top: 5px;
              border-top: 1px solid #111827;
            }

            .pos-receipt-signatures span,
            .pos-receipt-signatures strong {
              display: block;
              overflow-wrap: anywhere;
            }

            .pos-receipt-signatures span {
              margin-bottom: 5px;
            }

            .pos-receipt-paper footer {
              margin-top: 20px;
              display: flex;
              flex-direction: column;
              gap: 3px;
              text-align: center;
              font-size: 7px;
            }

            .no-print,
            .pos-receipt-actions {
              display: none !important;
            }

            .pos-receipt-paper,
            .pos-receipt-paper * {
              color: #000000 !important;
              text-shadow: none !important;
            }

            .pos-receipt-paper {
              background: #ffffff !important;
              border-color: #000000 !important;
            }

            .pos-receipt-logo {
              filter: grayscale(100%) contrast(135%) !important;
            }

            .pos-reprint-mark,
            .pos-voided-mark {
              background: #ffffff !important;
              color: #000000 !important;
            }

            .pos-receipt-divider {
              border-top-color: #000000 !important;
            }

            .pos-receipt-row.bold {
              border-top-color: #000000 !important;
            }

            .pos-receipt-items th {
              border-bottom-color: #000000 !important;
              color: #000000 !important;
            }

            .pos-receipt-signatures > div {
              border-top-color: #000000 !important;
            }

            @page {
              margin: 0;
            }

            @media print {
              html,
              body {
                width: 80mm !important;
                max-width: 80mm !important;
                height: auto;
                margin: 0 !important;
                padding: 0 !important;
              }

              body {
                background: #ffffff !important;
              }

              .print-sheet {
                width: 80mm !important;
                max-width: 80mm !important;
                min-height: 0;
                justify-content: flex-start !important;
              }

              .pos-receipt-paper {
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 !important;
                padding: 5mm 4mm !important;
                border: 0 !important;
                box-shadow: none !important;
              }
            }
          </style>
        </head>

        <body>
          <main class="print-sheet">
            ${receiptMarkup}
          </main>

          <script>
            (function () {
              function waitForImages() {
                var images = Array.from(
                  document.images || []
                );

                return Promise.all(
                  images.map(function (image) {
                    if (image.complete) {
                      return Promise.resolve();
                    }

                    return new Promise(function (resolve) {
                      image.addEventListener(
                        "load",
                        resolve,
                        { once: true }
                      );

                      image.addEventListener(
                        "error",
                        resolve,
                        { once: true }
                      );
                    });
                  })
                );
              }

              window.addEventListener(
                "load",
                function () {
                  waitForImages().then(function () {
                    window.setTimeout(function () {
                      window.focus();
                      window.print();
                    }, 250);
                  });
                },
                { once: true }
              );
            })();
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <>
      <main className="pos-enterprise-page">
        <section className="pos-title-row">
          <div>
            <h1>Point of Sale</h1>
            <p>
              Manage completed sales, receipts, returns,
              voided transactions, and transaction history.
            </p>
          </div>
        </section>

        {activeView === "sale" ? (
          <div className="pos-sale-layout">
            <section className="pos-products-panel">
              <div className="pos-product-toolbar">
                <div className="pos-search-box">
                  <Search size={18} />

                  <input
                    type="text"
                    value={productSearch}
                    onChange={(event) =>
                      setProductSearch(event.target.value)
                    }
                    placeholder="Search product, SKU, category, or supplier..."
                  />

                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="pos-refresh-btn"
                  onClick={loadProducts}
                  disabled={loadingProducts}
                >
                  <RefreshCw
                    size={16}
                    className={
                      loadingProducts ? "pos-spin" : ""
                    }
                  />
                  Refresh
                </button>
              </div>

              <div className="pos-category-tabs">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={
                      selectedCategory === category
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setSelectedCategory(category)
                    }
                  >
                    {category}
                  </button>
                ))}
              </div>

              {loadingProducts ? (
                <LoadingState text="Loading products..." />
              ) : filteredProducts.length === 0 ? (
                <EmptyState
                  icon={<ShoppingCart size={35} />}
                  title="No available products"
                  message="Products will appear when they have available stock and a selling price."
                />
              ) : (
                <div className="pos-products-grid">
                  {filteredProducts.map((product) => {
                    const stock = Number(
                      product.quantity || 0
                    );

                    const reorderLevel = Number(
                      product.reorder_level || 0
                    );

                    const stockClass =
                      stock <= 0
                        ? "out"
                        : reorderLevel > 0 &&
                            stock <= reorderLevel
                          ? "low"
                          : "available";

                    const stockLabel =
                      stock <= 0
                        ? "Out of Stock"
                        : stockClass === "low"
                          ? "Low Stock"
                          : "In Stock";

                    return (
                      <article
                        className="pos-product-card"
                        key={product.product_id}
                      >
                        <div className="pos-product-image">
                          {getProductImage(product) ? (
                            <img
                              src={getProductImage(product)}
                              alt={product.product_name}
                              onError={(event) => {
                                event.currentTarget.style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <PackageCheck size={36} />
                          )}

                          <span
                            className={`pos-stock-status ${stockClass}`}
                          >
                            {stockLabel}
                          </span>
                        </div>

                        <div className="pos-product-body">
                          <small>
                            {product.category_name ||
                              product.category ||
                              "Uncategorized"}
                          </small>

                          <h3>{product.product_name}</h3>

                          <p>
                            SKU: {product.sku || "N/A"}
                          </p>

                          <p>
                            Supplier:{" "}
                            {product.vendor_name ||
                              "No supplier"}
                          </p>

                          <p>
                            Stock: {stock}{" "}
                            {product.unit_type ||
                              product.unit ||
                              "pcs"}
                          </p>

                          <div className="pos-product-bottom">
                            <strong>
                              {formatPeso(
                                product.selling_price ||
                                  product.unit_price
                              )}
                            </strong>

                            <button
                              type="button"
                              disabled={!canSell || stock <= 0}
                              onClick={() =>
                                addToCart(product)
                              }
                            >
                              <Plus size={15} />
                              Add
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {canSell && (
              <aside className="pos-cart-panel">
                <header className="pos-cart-header">
                  <div>
                    <h2>Current Transaction</h2>
                    <span>
                      {cart.length} product line(s)
                    </span>
                  </div>

                  <ShoppingCart size={23} />
                </header>

                <div className="pos-cart-items">
                  {cart.length === 0 ? (
                    <div className="pos-empty-cart">
                      <ShoppingCart size={38} />
                      <strong>No products added</strong>
                      <span>
                        Select products from the catalog.
                      </span>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        className="pos-cart-item"
                        key={item.product_id}
                      >
                        <div className="pos-cart-item-heading">
                          <div>
                            <strong>
                              {item.product_name}
                            </strong>
                            <span>
                              {formatPeso(item.price)} ·{" "}
                              {item.stock} available
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeCartItem(
                                item.product_id
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <div className="pos-cart-item-footer">
                          <div className="pos-quantity-box">
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQuantity(
                                  item.product_id,
                                  Number(
                                    item.quantity || 1
                                  ) - 1
                                )
                              }
                            >
                              <Minus size={14} />
                            </button>

                            <input
                              type="number"
                              min="1"
                              max={item.stock}
                              value={item.quantity}
                              onChange={(event) =>
                                updateCartQuantity(
                                  item.product_id,
                                  event.target.value
                                )
                              }
                              onBlur={(event) =>
                                normalizeCartQuantity(
                                  item.product_id,
                                  event.target.value
                                )
                              }
                            />

                            <button
                              type="button"
                              onClick={() =>
                                updateCartQuantity(
                                  item.product_id,
                                  Number(
                                    item.quantity || 0
                                  ) + 1
                                )
                              }
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <strong>
                            {formatPeso(item.subtotal)}
                          </strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pos-customer-fields">
                  <h3>Receipt Information</h3>

                  <label>
                    Customer Name
                    <input
                      type="text"
                      value={customerName}
                      onChange={(event) =>
                        setCustomerName(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <div>
                    <label>
                      Prepared By
                      <input
                        type="text"
                        value={preparedBy}
                        onChange={(event) =>
                          setPreparedBy(
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Received By
                      <input
                        type="text"
                        value={receivedBy}
                        onChange={(event) =>
                          setReceivedBy(
                            event.target.value
                          )
                        }
                        placeholder="Customer"
                      />
                    </label>
                  </div>
                </div>

                <div className="pos-payment-summary">
                  <SummaryLine
                    label="Subtotal"
                    value={formatPeso(subtotal)}
                  />

                  <label>
                    <span>Discount (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={(event) =>
                        setDiscountPercent(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <SummaryLine
                    label="Discount Amount"
                    value={`-${formatPeso(
                      discountAmount
                    )}`}
                    negative
                  />

                  <label>
                    <span>Payment Type</span>
                    <select
                      value={paymentType}
                      onChange={(event) => {
                        const nextType = event.target.value;
                        setPaymentType(nextType);
                        setCashAmount("");

                        if (nextType === "Cash") {
                          setEmployeeName("");
                          setOfficeName("");
                          setCustomOfficeName("");
                          setReceivableNotes("");
                        }
                      }}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Receivable">
                        Receivable
                      </option>
                    </select>
                  </label>

                  {paymentType === "Receivable" && (
                    <>
                      <label>
                        <span>Employee Name</span>
                        <input
                          type="text"
                          value={employeeName}
                          onChange={(event) =>
                            setEmployeeName(
                              event.target.value
                            )
                          }
                          placeholder="Employee name"
                        />
                      </label>

                      <label>
                        <span>Office / Department</span>
                        <select
                          value={officeName}
                          onChange={(event) => {
                            const value = event.target.value;
                            setOfficeName(value);

                            if (value !== "Other") {
                              setCustomOfficeName("");
                            }
                          }}
                          required
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

                      {officeName === "Other" && (
                        <label>
                          <span>
                            Specify Office / Department
                          </span>
                          <input
                            type="text"
                            value={customOfficeName}
                            onChange={(event) =>
                              setCustomOfficeName(
                                event.target.value
                              )
                            }
                            placeholder="Enter office or department"
                            required
                          />
                        </label>
                      )}

                      <label>
                        <span>Remarks</span>
                        <textarea
                          value={receivableNotes}
                          onChange={(event) =>
                            setReceivableNotes(
                              event.target.value
                            )
                          }
                          placeholder="Optional receivable remarks"
                          rows="3"
                        />
                      </label>
                    </>
                  )}

                  <label>
                    <span>
                      {paymentType === "Cash"
                        ? "Cash"
                        : "Initial Payment"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashAmount}
                      onChange={(event) =>
                        setCashAmount(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  {paymentType === "Cash" ? (
                    <SummaryLine
                      label="Change"
                      value={formatPeso(changeAmount)}
                    />
                  ) : (
                    <SummaryLine
                      label="Receivable Balance"
                      value={formatPeso(
                        receivableBalance
                      )}
                    />
                  )}

                  <div className="pos-total-line">
                    <span>Total</span>
                    <strong>
                      {formatPeso(grandTotal)}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="pos-checkout-btn"
                    disabled={processing}
                    onClick={requestCheckout}
                  >
                    <ReceiptText size={17} />
                    Checkout
                  </button>
                </div>
              </aside>
            )}
          </div>
        ) : (
          <section className="pos-history-view">
            <div className="pos-summary-grid">
              <MetricCard
                title="Transactions"
                value={summary.total_transactions}
                icon={<ReceiptText size={19} />}
              />

              <MetricCard
                title="Recorded Sales"
                value={formatPeso(
                  summary.recorded_sales
                )}
                icon={<PackageCheck size={19} />}
                type="success"
              />

              <MetricCard
                title="Refunded"
                value={formatPeso(
                  summary.total_refunded
                )}
                icon={<Undo2 size={19} />}
                type="warning"
              />

              <MetricCard
                title="Voided"
                value={summary.voided_transactions}
                icon={<XCircle size={19} />}
                type="danger"
              />

              <MetricCard
                title="Net Sales"
                value={formatPeso(summary.net_sales)}
                icon={<History size={19} />}
                type="info"
              />
            </div>

            <div className="pos-history-card">
              <div className="pos-history-toolbar">
                <div className="pos-search-box">
                  <Search size={18} />

                  <input
                    type="text"
                    value={transactionSearch}
                    onChange={(event) => {
                      setTransactionSearch(
                        event.target.value
                      );
                      setTransactionPage(1);
                    }}
                    placeholder="Search transaction, customer, or cashier..."
                  />
                </div>

                <div className="pos-history-filters">
                  <div className="pos-select-box">
                    <select
                      value={transactionStatus}
                      onChange={(event) => {
                        setTransactionStatus(
                          event.target.value
                        );
                        setTransactionPage(1);
                      }}
                    >
                      <option value="All">
                        All Status
                      </option>
                      <option value="Completed">
                        Completed
                      </option>
                      <option value="Partially Returned">
                        Partially Returned
                      </option>
                      <option value="Returned">
                        Returned
                      </option>
                      <option value="Voided">
                        Voided
                      </option>
                    </select>

                    <ChevronDown size={15} />
                  </div>

                  <label>
                    <CalendarDays size={15} />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => {
                        setDateFrom(event.target.value);
                        setTransactionPage(1);
                      }}
                    />
                  </label>

                  <label>
                    <CalendarDays size={15} />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => {
                        setDateTo(event.target.value);
                        setTransactionPage(1);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    className="pos-clear-btn"
                    onClick={() => {
                      setTransactionSearch("");
                      setTransactionStatus("All");
                      setDateFrom("");
                      setDateTo("");
                      setTransactionPage(1);
                    }}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className="pos-refresh-btn"
                    onClick={loadTransactions}
                    disabled={loadingTransactions}
                  >
                    <RefreshCw
                      size={16}
                      className={
                        loadingTransactions
                          ? "pos-spin"
                          : ""
                      }
                    />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="pos-table-wrapper">
                <table className="pos-history-table">
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Cashier</th>
                      <th>Quantity</th>
                      <th>Total</th>
                      <th>Refunded</th>
                      <th>Net Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loadingTransactions ? (
                      <tr>
                        <td colSpan="10">
                          <LoadingState text="Loading transactions..." />
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan="10">
                          <EmptyState
                            icon={<History size={34} />}
                            title="No transactions found"
                            message="Transactions matching your selected filters will appear here."
                          />
                        </td>
                      </tr>
                    ) : (
                      transactions.map((transaction) => (
                        <tr key={transaction.pos_id}>
                          <td>
                            <strong>
                              {
                                transaction.transaction_code
                              }
                            </strong>
                          </td>

                          <td>
                            {formatDateTime(
                              transaction.transaction_date
                            )}
                          </td>

                          <td>
                            {transaction.customer_name ||
                              "WALK IN CLIENT"}
                          </td>

                          <td>
                            {transaction.cashier_name ||
                              "Unknown"}
                          </td>

                          <td>
                            {transaction.total_items}
                          </td>

                          <td>
                            {formatPeso(
                              transaction.total_amount
                            )}
                          </td>

                          <td>
                            {formatPeso(
                              transaction.refunded_amount
                            )}
                          </td>

                          <td>
                            <strong>
                              {formatPeso(
                                transaction.net_amount
                              )}
                            </strong>
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                transaction.transaction_status
                              }
                            />
                          </td>

                          <td>
                            <div className="pos-row-actions">
                              <button
                                type="button"
                                title="View transaction"
                                onClick={() =>
                                  viewTransaction(
                                    transaction
                                  )
                                }
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                title="Reprint receipt"
                                onClick={() =>
                                  reprintReceipt(
                                    transaction
                                  )
                                }
                              >
                                <Printer size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {!loadingTransactions &&
                transactionPagination.total_records > 0 && (
                  <div className="pos-pagination">
                    <div className="pos-pagination-info">
                      Showing{" "}
                      <strong>
                        {transactionPagination.from}
                      </strong>
                      {" – "}
                      <strong>
                        {transactionPagination.to}
                      </strong>
                      {" of "}
                      <strong>
                        {
                          transactionPagination.total_records
                        }
                      </strong>
                      {" transactions"}
                    </div>

                    <div className="pos-pagination-controls">
                      <button
                        type="button"
                        className="pos-page-nav"
                        disabled={
                          transactionPagination.current_page <=
                          1
                        }
                        onClick={() =>
                          setTransactionPage(
                            Math.max(
                              1,
                              transactionPagination.current_page -
                                1
                            )
                          )
                        }
                        aria-label="Previous transaction page"
                      >
                        <ChevronLeft size={15} />
                        Previous
                      </button>

                      <div className="pos-page-numbers">
                        {transactionPageNumbers.map(
                          (page, index) => {
                            const previousPage =
                              transactionPageNumbers[
                                index - 1
                              ];

                            const showGap =
                              index > 0 &&
                              page - previousPage > 1;

                            return (
                              <span
                                key={`transaction-page-${page}`}
                                className="pos-page-number-wrap"
                              >
                                {showGap && (
                                  <span className="pos-page-gap">
                                    …
                                  </span>
                                )}

                                <button
                                  type="button"
                                  className={
                                    page ===
                                    transactionPagination.current_page
                                      ? "pos-page-number active"
                                      : "pos-page-number"
                                  }
                                  onClick={() =>
                                    setTransactionPage(page)
                                  }
                                >
                                  {page}
                                </button>
                              </span>
                            );
                          }
                        )}
                      </div>

                      <button
                        type="button"
                        className="pos-page-nav"
                        disabled={
                          transactionPagination.current_page >=
                          transactionPagination.total_pages
                        }
                        onClick={() =>
                          setTransactionPage(
                            Math.min(
                              transactionPagination.total_pages,
                              transactionPagination.current_page +
                                1
                            )
                          )
                        }
                        aria-label="Next transaction page"
                      >
                        Next
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    <div className="pos-pagination-page-label">
                      Page{" "}
                      <strong>
                        {
                          transactionPagination.current_page
                        }
                      </strong>
                      {" of "}
                      <strong>
                        {
                          transactionPagination.total_pages
                        }
                      </strong>
                    </div>
                  </div>
                )}
            </div>
          </section>
        )}
      </main>

      {showCheckoutModal && (
        <ModalOverlay>
          <div className="pos-modal pos-confirm-sale-modal">
            <ModalHeader
              title="Confirm Sale"
              subtitle="Review the transaction before completing checkout."
              onClose={() =>
                !processing &&
                setShowCheckoutModal(false)
              }
            />

            <div className="pos-modal-content">
              <div className="pos-confirm-customer">
                <span>Customer</span>
                <strong>{customerName}</strong>
              </div>

              <div className="pos-confirm-products">
                {cart.map((item) => (
                  <div key={item.product_id}>
                    <span>
                      {item.product_name} ×{" "}
                      {item.quantity}
                    </span>

                    <strong>
                      {formatPeso(item.subtotal)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="pos-confirm-totals">
                <SummaryLine
                  label="Subtotal"
                  value={formatPeso(subtotal)}
                />

                <SummaryLine
                  label={`Discount (${normalizedDiscountPercent}%)`}
                  value={`-${formatPeso(
                    discountAmount
                  )}`}
                />

                <SummaryLine
                  label="Payment Type"
                  value={paymentType}
                />

                {paymentType === "Receivable" && (
                  <>
                    <SummaryLine
                      label="Employee"
                      value={employeeName}
                    />
                    <SummaryLine
                      label="Office / Department"
                      value={
                        officeName === "Other"
                          ? customOfficeName
                          : officeName
                      }
                    />
                  </>
                )}

                <SummaryLine
                  label={
                    paymentType === "Cash"
                      ? "Cash"
                      : "Initial Payment"
                  }
                  value={formatPeso(amountTendered)}
                />

                <SummaryLine
                  label={
                    paymentType === "Cash"
                      ? "Change"
                      : "Receivable Balance"
                  }
                  value={formatPeso(
                    paymentType === "Cash"
                      ? changeAmount
                      : receivableBalance
                  )}
                />

                <div className="pos-total-line">
                  <span>Grand Total</span>
                  <strong>
                    {formatPeso(grandTotal)}
                  </strong>
                </div>
              </div>
            </div>

            <ModalFooter>
              <button
                type="button"
                className="pos-secondary-btn"
                disabled={processing}
                onClick={() =>
                  setShowCheckoutModal(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="pos-primary-btn"
                disabled={processing}
                onClick={completeCheckout}
              >
                {processing ? (
                  <>
                    <Loader2
                      size={16}
                      className="pos-spin"
                    />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Confirm Sale
                  </>
                )}
              </button>
            </ModalFooter>
          </div>
        </ModalOverlay>
      )}

      {showDetailsModal && selectedTransaction && (
        <ModalOverlay>
          <div className="pos-modal pos-details-modal">
            <ModalHeader
              title="Transaction Details"
              subtitle="Review products, totals, returns, and transaction status."
              onClose={() => {
                if (!loadingDetails) {
                  setShowDetailsModal(false);
                  setSelectedTransaction(null);
                  setTransactionDetails(null);
                }
              }}
            />

            {loadingDetails ? (
              <LoadingState text="Loading transaction details..." />
            ) : (
              <>
                <div className="pos-modal-content">
                  <div className="pos-transaction-hero">
                    <div>
                      <span>Transaction Code</span>

                      <h2>
                        {
                          transactionDetails
                            ?.transaction
                            ?.transaction_code
                        }
                      </h2>

                      <p>
                        {formatDateTime(
                          transactionDetails
                            ?.transaction
                            ?.transaction_date
                        )}
                      </p>
                    </div>

                    <StatusBadge
                      status={
                        transactionDetails
                          ?.transaction
                          ?.transaction_status
                      }
                    />
                  </div>

                  <div className="pos-detail-metrics">
                    <DetailMetric
                      label="Customer"
                      value={
                        transactionDetails
                          ?.transaction
                          ?.customer_name ||
                        "WALK IN CLIENT"
                      }
                    />

                    <DetailMetric
                      label="Cashier"
                      value={
                        transactionDetails
                          ?.transaction
                          ?.cashier_name ||
                        "Unknown"
                      }
                    />

                    <DetailMetric
                      label="Subtotal"
                      value={formatPeso(
                        transactionDetails
                          ?.transaction
                          ?.subtotal_amount
                      )}
                    />

                    <DetailMetric
                      label="Discount"
                      value={formatPeso(
                        transactionDetails
                          ?.transaction
                          ?.discount
                      )}
                    />

                    <DetailMetric
                      label="Total"
                      value={formatPeso(
                        transactionDetails
                          ?.transaction
                          ?.total_amount
                      )}
                    />

                    <DetailMetric
                      label="Refunded"
                      value={formatPeso(
                        transactionDetails
                          ?.transaction
                          ?.refunded_amount
                      )}
                    />
                  </div>

                  <section className="pos-details-section">
                    <h3>Products</h3>

                    <div className="pos-table-wrapper">
                      <table className="pos-details-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Sold</th>
                            <th>Returned</th>
                            <th>Returnable</th>
                            <th>Price</th>
                            <th>Subtotal</th>
                            <th>Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {(
                            transactionDetails?.items ||
                            []
                          ).map((item) => (
                            <tr key={item.item_id}>
                              <td>
                                <strong>
                                  {item.product_name}
                                </strong>
                                <small>
                                  {item.sku || "No SKU"}
                                </small>
                              </td>

                              <td>{item.quantity}</td>

                              <td>
                                {item.returned_quantity}
                              </td>

                              <td>
                                {item.returnable_quantity}
                              </td>

                              <td>
                                {formatPeso(item.price)}
                              </td>

                              <td>
                                {formatPeso(
                                  item.subtotal
                                )}
                              </td>

                              <td>
                                {item.item_status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="pos-details-section">
                    <h3>Return and Void History</h3>

                    {(
                      transactionDetails?.returns || []
                    ).length === 0 ? (
                      <div className="pos-empty-history">
                        No return or void activity.
                      </div>
                    ) : (
                      <div className="pos-return-history">
                        {transactionDetails.returns.map(
                          (record) => (
                            <article
                              key={record.return_id}
                            >
                              <div>
                                <strong>
                                  {
                                    record.return_number
                                  }
                                </strong>
                                <span>
                                  {record.return_type}
                                </span>
                              </div>

                              <div>
                                <strong>
                                  {formatPeso(
                                    record.refund_amount
                                  )}
                                </strong>
                                <span>
                                  {formatDateTime(
                                    record.return_date
                                  )}
                                </span>
                              </div>

                              <p>
                                {record.return_reason}
                              </p>
                            </article>
                          )
                        )}
                      </div>
                    )}
                  </section>

                  {transactionDetails?.transaction
                    ?.void_reason && (
                    <div className="pos-void-reason">
                      <AlertTriangle size={18} />

                      <div>
                        <strong>Void Reason</strong>
                        <span>
                          {
                            transactionDetails
                              .transaction
                              .void_reason
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <ModalFooter>
                  <button
                    type="button"
                    className="pos-secondary-btn"
                    onClick={() =>
                      reprintReceipt(
                        transactionDetails.transaction
                      )
                    }
                  >
                    <Printer size={16} />
                    Reprint
                  </button>

                  {Number(
                    transactionDetails?.transaction
                      ?.can_return
                  ) === 1 && (
                    <button
                      type="button"
                      className="pos-return-btn"
                      onClick={openReturnModal}
                    >
                      <RotateCcw size={16} />
                      Return Products
                    </button>
                  )}

                  {canVoid &&
                    [
                      "Completed",
                      "Partially Returned",
                    ].includes(
                      transactionDetails
                        ?.transaction
                        ?.transaction_status
                    ) && (
                      <button
                        type="button"
                        className="pos-danger-btn"
                        onClick={openVoidModal}
                      >
                        <XCircle size={16} />
                        Void Transaction
                      </button>
                    )}

                  <button
                    type="button"
                    className="pos-primary-btn"
                    onClick={() =>
                      setShowDetailsModal(false)
                    }
                  >
                    Close
                  </button>
                </ModalFooter>
              </>
            )}
          </div>
        </ModalOverlay>
      )}

      {showReturnModal && transactionDetails && (
        <ModalOverlay stacked>
          <div className="pos-modal pos-return-modal">
            <ModalHeader
              title="Return Products"
              subtitle={`Transaction ${transactionDetails.transaction.transaction_code}`}
              onClose={() =>
                !processing &&
                setShowReturnModal(false)
              }
            />

            <div className="pos-modal-content">
              <div className="pos-return-products">
                {(transactionDetails.items || []).map(
                  (item) => (
                    <div
                      key={item.item_id}
                      className={
                        Number(
                          item.returnable_quantity || 0
                        ) <= 0
                          ? "disabled"
                          : ""
                      }
                    >
                      <div>
                        <strong>
                          {item.product_name}
                        </strong>

                        <span>
                          Sold: {item.quantity} ·
                          Returned:{" "}
                          {item.returned_quantity} ·
                          Available:{" "}
                          {item.returnable_quantity}
                        </span>
                      </div>

                      <label>
                        Return Qty
                        <input
                          type="number"
                          min="0"
                          max={
                            item.returnable_quantity
                          }
                          value={
                            returnQuantities[
                              item.item_id
                            ] ?? 0
                          }
                          disabled={
                            Number(
                              item.returnable_quantity ||
                                0
                            ) <= 0
                          }
                          onChange={(event) =>
                            updateReturnQuantity(
                              item,
                              event.target.value
                            )
                          }
                          onBlur={() =>
                            normalizeReturnQuantity(
                              item
                            )
                          }
                        />
                      </label>
                    </div>
                  )
                )}
              </div>

              <label className="pos-reason-field">
                Return Reason
                <textarea
                  value={returnReason}
                  onChange={(event) =>
                    setReturnReason(
                      event.target.value
                    )
                  }
                  placeholder="Explain why the selected products are being returned..."
                />
              </label>

              <div className="pos-refund-preview">
                <span>Estimated Refund</span>
                <strong>
                  {formatPeso(estimatedRefund)}
                </strong>
              </div>
            </div>

            <ModalFooter>
              <button
                type="button"
                className="pos-secondary-btn"
                disabled={processing}
                onClick={() =>
                  setShowReturnModal(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="pos-return-btn"
                disabled={processing}
                onClick={submitReturn}
              >
                {processing ? (
                  <>
                    <Loader2
                      size={16}
                      className="pos-spin"
                    />
                    Processing...
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    Confirm Return
                  </>
                )}
              </button>
            </ModalFooter>
          </div>
        </ModalOverlay>
      )}

      {showVoidModal && transactionDetails && (
        <ModalOverlay stacked>
          <div className="pos-modal pos-void-modal">
            <div className="pos-warning-icon">
              <AlertTriangle size={30} />
            </div>

            <h2>Void Transaction</h2>

            <p>
              Voiding transaction{" "}
              <strong>
                {
                  transactionDetails.transaction
                    .transaction_code
                }
              </strong>{" "}
              restores all remaining products to
              inventory. The original record will remain
              preserved.
            </p>

            <label className="pos-reason-field">
              Void Reason
              <textarea
                value={voidReason}
                onChange={(event) =>
                  setVoidReason(event.target.value)
                }
                placeholder="Enter the reason for voiding this transaction..."
              />
            </label>

            <ModalFooter>
              <button
                type="button"
                className="pos-secondary-btn"
                disabled={processing}
                onClick={() =>
                  setShowVoidModal(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="pos-danger-btn"
                disabled={processing}
                onClick={submitVoid}
              >
                {processing ? (
                  <>
                    <Loader2
                      size={16}
                      className="pos-spin"
                    />
                    Voiding...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Void Transaction
                  </>
                )}
              </button>
            </ModalFooter>
          </div>
        </ModalOverlay>
      )}

      {showReceiptModal && receipt && (
        <ModalOverlay>
          <div className="pos-receipt-modal">
            <div
              id="pos-receipt"
              className="pos-receipt-paper"
            >
              {receipt.transaction_status ===
                "Voided" && (
                <span className="pos-voided-mark">
                  VOIDED
                </span>
              )}

              <img
                src={bacnotanLogo}
                alt="Bacnotan Logo"
                className="pos-receipt-logo"
              />

              <header>
                <h3>MUNICIPALITY OF BACNOTAN</h3>
                <p>Province of La Union</p>
                <h2>ACKNOWLEDGEMENT RECEIPT</h2>
                <strong>
                  NO. {receipt.transaction_code}
                </strong>
              </header>

              <ReceiptDivider />

              <div className="pos-receipt-info">
                <ReceiptRow
                  label="Date and Time"
                  value={formatDateTime(
                    receipt.transaction_date ||
                      receipt.created_at
                  )}
                />

                <ReceiptRow
                  label="Customer"
                  value={
                    receipt.customer_name ||
                    "WALK IN CLIENT"
                  }
                />

                <ReceiptRow
                  label="Status"
                  value={
                    receipt.transaction_status ||
                    "Completed"
                  }
                />

                <ReceiptRow
                  label="Payment Type"
                  value={
                    receipt.payment_type ||
                    "Cash"
                  }
                />

                {receipt.payment_type ===
                  "Receivable" && (
                  <>
                    <ReceiptRow
                      label="Employee"
                      value={
                        receipt.employee_name ||
                        receipt.customer_name ||
                        "Not recorded"
                      }
                    />
                    <ReceiptRow
                      label="Office / Department"
                      value={
                        receipt.office_name ||
                        "Not recorded"
                      }
                    />
                  </>
                )}
              </div>

              <ReceiptDivider />

              <table className="pos-receipt-items">
                <thead>
                  <tr>
                    <th>Qty</th>
                    <th>Item</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {(receipt.items || []).map((item) => (
                    <tr key={item.item_id}>
                      <td>{item.quantity}</td>
                      <td>{item.product_name}</td>
                      <td>
                        {formatPeso(
                          item.price ||
                            item.unit_price
                        )}
                      </td>
                      <td>
                        {formatPeso(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ReceiptDivider />

              <div className="pos-receipt-totals">
                <ReceiptRow
                  label="Subtotal"
                  value={formatPeso(
                    receipt.subtotal_amount
                  )}
                />

                <ReceiptRow
                  label={`Discount (${
                    receipt.discount_percent || 0
                  }%)`}
                  value={`-${formatPeso(
                    receipt.discount
                  )}`}
                />

                <ReceiptRow
                  label="Grand Total"
                  value={formatPeso(
                    receipt.total_amount
                  )}
                  bold
                />

                <ReceiptRow
                  label={
                    receipt.payment_type ===
                    "Receivable"
                      ? "Initial Payment"
                      : "Cash"
                  }
                  value={formatPeso(
                    receipt.payment_amount ??
                      receipt.cash_amount
                  )}
                />

                {receipt.payment_type ===
                "Receivable" ? (
                  <ReceiptRow
                    label="Balance"
                    value={formatPeso(
                      Math.max(
                        0,
                        Number(
                          receipt.total_amount || 0
                        ) -
                          Number(
                            receipt.payment_amount ||
                              0
                          )
                      )
                    )}
                  />
                ) : (
                  <ReceiptRow
                    label="Change"
                    value={formatPeso(
                      receipt.change_amount
                    )}
                  />
                )}

                {Number(
                  receipt.refunded_amount || 0
                ) > 0 && (
                  <ReceiptRow
                    label="Refunded"
                    value={formatPeso(
                      receipt.refunded_amount
                    )}
                  />
                )}
              </div>

              <ReceiptDivider />

              <div className="pos-receipt-signatures">
                <div>
                  <span>Prepared By</span>
                  <strong>
                    {receipt.prepared_by ||
                      receipt.cashier_name ||
                      "System Admin"}
                  </strong>
                </div>

                <div>
                  <span>Received By</span>
                  <strong>
                    {receipt.received_by ||
                      receipt.customer_name ||
                      "WALK IN CLIENT"}
                  </strong>
                </div>
              </div>

              <footer>
                <strong>HiveSync Business System</strong>
                <span>Thank you for visiting!</span>
              </footer>
            </div>

            <div className="pos-receipt-actions no-print">
              <button
                type="button"
                className="pos-primary-btn"
                onClick={printReceipt}
              >
                <Printer size={16} />
                Print Receipt
              </button>

              <button
                type="button"
                className="pos-secondary-btn"
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceipt(null);
                }}
              >
                <X size={16} />
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {notice.open && (
        <ModalOverlay stacked>
          <div className="pos-notice-modal">
            <div
              className={`pos-notice-icon ${notice.type}`}
            >
              {notice.type === "error" ? (
                <XCircle size={31} />
              ) : (
                <CheckCircle2 size={31} />
              )}
            </div>

            <h2>{notice.title}</h2>
            <p>{notice.message}</p>

            <button
              type="button"
              className="pos-primary-btn"
              onClick={closeNotice}
            >
              Okay
            </button>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}

function ModalOverlay({ children, stacked = false }) {
  return (
    <div
      className={`pos-modal-overlay ${
        stacked ? "stacked" : ""
      }`}
    >
      {children}
    </div>
  );
}

function ModalHeader({
  title,
  subtitle,
  onClose,
}) {
  return (
    <header className="pos-modal-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <button type="button" onClick={onClose}>
        <X size={19} />
      </button>
    </header>
  );
}

function ModalFooter({ children }) {
  return (
    <footer className="pos-modal-footer">
      {children}
    </footer>
  );
}

function LoadingState({ text }) {
  return (
    <div className="pos-loading-state">
      <Loader2 size={30} className="pos-spin" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  message,
}) {
  return (
    <div className="pos-empty-state">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  negative = false,
}) {
  return (
    <div className="pos-summary-line">
      <span>{label}</span>
      <strong className={negative ? "negative" : ""}>
        {value}
      </strong>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  type = "",
}) {
  return (
    <article className={`pos-metric-card ${type}`}>
      <div>{icon}</div>

      <span>
        <small>{title}</small>
        <strong>{value}</strong>
      </span>
    </article>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "Completed")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <span className={`pos-status-badge ${normalized}`}>
      {status || "Completed"}
    </span>
  );
}

function DetailMetric({ label, value }) {
  return (
    <div className="pos-detail-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReceiptDivider() {
  return <div className="pos-receipt-divider" />;
}

function ReceiptRow({
  label,
  value,
  bold = false,
}) {
  return (
    <div
      className={`pos-receipt-row ${
        bold ? "bold" : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default POSManagement;