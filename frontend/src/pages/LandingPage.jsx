import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import PageHeader from "../components/PageHeader";

import "../styles/landing.css";
import hiveLogo from "../assets/Hive-logo.png";
import bacnotanLogo from "../assets/Bacnotan Logo.png";
import API_BASE from "../config/api";

const POS_API =
  `${API_BASE}/pos_management`;

const INVENTORY_API =
  `${API_BASE}/inventory_management`;

const BACKEND_URL =
  `${API_BASE}/`;

const CART_STORAGE_KEY = "hivesync_landing_cart";

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

function LandingPage({
  user,
  pendingCheckout,
  onPendingCheckoutHandled,
  onRequireLogin,
  onLogout,
  onNotificationNavigate,
}) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Available");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [receivableRecordedOpen, setReceivableRecordedOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checkoutRequestToken, setCheckoutRequestToken] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productDetails, setProductDetails] = useState(null);
  const [productDetailsLoading, setProductDetailsLoading] = useState(false);
  const [productDetailsError, setProductDetailsError] = useState("");
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [selectedVariantByFamily, setSelectedVariantByFamily] = useState({});
  const [cartVariantPicker, setCartVariantPicker] = useState({
    open: false,
    mode: "change",
    cartProductId: null,
    selectedProductId: null,
    quantity: 1,
  });

  const [customerName, setCustomerName] = useState("WALK IN CLIENT");
  const [employeeName, setEmployeeName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [customOfficeName, setCustomOfficeName] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [receivableNotes, setReceivableNotes] = useState("");
  const [receipt, setReceipt] = useState(null);

  const [notice, setNotice] = useState({
    open: false,
    title: "",
    message: "",
  });

  const role = user?.role || "";
  const canCheckout =
    Boolean(user) && ["Admin", "Staff"].includes(role);

  const formatPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (value) => {
    if (!value) return "Not specified";

    const parsed = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }

    return parsed.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "";

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

  const showNotice = (title, message) => {
    setNotice({
      open: true,
      title,
      message,
    });
  };

  const getCsrfToken = async () => {
    const response = await axios.get(
      `${API_BASE}/auth/csrf_token.php`,
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

  const getProductImage = (product) => {
    const image =
      product?.product_image_url ||
      product?.product_image ||
      "";

    if (!image) return "";

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

  const getVariantLabel = (product) => {
    const directLabel = String(
      product?.variant_label ||
        product?.variant_display ||
        ""
    ).trim();

    if (directLabel) {
      return directLabel;
    }

    const value = String(product?.variant_value ?? "").trim();
    const unit = String(product?.variant_unit ?? "").trim();

    if (value || unit) {
      return [value, unit].filter(Boolean).join(" ");
    }

    return "Standard";
  };

  const getFamilyKey = (product) => {
    if (product?.family_key) {
      return String(product.family_key);
    }

    if (Number(product?.family_id || 0) > 0) {
      return `family-${product.family_id}`;
    }

    const hasVariantIdentity =
      Boolean(String(product?.variant_label || "").trim()) ||
      Boolean(String(product?.variant_value || "").trim()) ||
      Number(product?.request_variant_id || 0) > 0;

    if (hasVariantIdentity) {
      return [
        String(product?.product_name || "").trim().toLowerCase(),
        String(product?.vendor_id || ""),
        String(product?.category_id || ""),
      ].join("::");
    }

    return `product-${product?.product_id}`;
  };

  const getProductStock = (product) =>
    Number(
      product?.available_stock ??
        product?.quantity ??
        product?.total_remaining ??
        0
    );

  const getProductPrice = (product) =>
    Number(
      product?.selling_price ??
        product?.unit_price ??
        0
    );

  const loadProducts = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoadingProducts(true);
        setProductError("");
      }

      try {
        const response = await axios.get(
          `${POS_API}/get_products.php?t=${Date.now()}`,
          {
            withCredentials: true,
          }
        );

        if (!response.data?.success) {
          throw new Error(
            response.data?.message ||
              "Unable to load products."
          );
        }

        const loadedProducts = Array.isArray(
          response.data.products
        )
          ? response.data.products
          : [];

        setProducts(loadedProducts);

        if (!silent) {
          setProductError("");
        }
      } catch (error) {
        const message =
          error.response?.data?.message ||
          error.message ||
          "Unable to connect to the HiveSync backend.";

        if (silent) {
          console.error(
            "Silent product refresh failed:",
            message
          );
          return;
        }

        setProducts([]);
        setProductError(message);
      } finally {
        if (!silent) {
          setLoadingProducts(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadProducts();

    const refreshProductsSilently = () => {
      loadProducts({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshProductsSilently();
      }
    };

    const refreshTimer = window.setInterval(
      refreshProductsSilently,
      15000
    );

    window.addEventListener(
      "focus",
      refreshProductsSilently
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(refreshTimer);

      window.removeEventListener(
        "focus",
        refreshProductsSilently
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadProducts]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (loadingProducts || products.length === 0) {
      return;
    }

    setCart((currentCart) => {
      let changed = false;

      const nextCart = currentCart
        .map((item) => {
          const product = products.find(
            (candidate) =>
              String(candidate.product_id) ===
              String(item.product_id)
          );

          if (!product) {
            changed = true;
            return null;
          }

          const stock = Number(
            product.available_stock ??
              product.quantity ??
              0
          );

          const price = Number(
            product.selling_price ??
              product.unit_price ??
              0
          );

          if (stock <= 0 || price <= 0) {
            changed = true;
            return null;
          }

          const quantity = Math.min(
            Math.max(1, Number(item.quantity || 1)),
            stock
          );

          if (
            quantity !== Number(item.quantity) ||
            stock !== Number(item.stock) ||
            price !== Number(item.price)
          ) {
            changed = true;
          }

          return {
            ...item,
            stock,
            price,
            quantity,
            product_name:
              product.product_name ||
              item.product_name,
            sku: product.sku || item.sku,
            variant_label:
              getVariantLabel(product) ||
              item.variant_label ||
              "Standard",
            unit:
              product.unit_type ||
              product.unit ||
              item.unit,
            image:
              getProductImage(product) ||
              item.image,
          };
        })
        .filter(Boolean);

      return changed ? nextCart : currentCart;
    });
  }, [products, loadingProducts]);


  useEffect(() => {
    if (pendingCheckout && canCheckout) {
      setCartOpen(false);
      setCheckoutOpen(false);
      onPendingCheckoutHandled?.();
    }
  }, [
    pendingCheckout,
    canCheckout,
    onPendingCheckoutHandled,
  ]);

  const productFamilies = useMemo(() => {
    const familyMap = new Map();

    products.forEach((product) => {
      const familyKey = getFamilyKey(product);

      if (!familyMap.has(familyKey)) {
        familyMap.set(familyKey, {
          ...product,
          family_key: familyKey,
          variants: [],
        });
      }

      familyMap.get(familyKey).variants.push({
        ...product,
        family_key: familyKey,
        variant_label: getVariantLabel(product),
      });
    });

    return Array.from(familyMap.values()).map((family) => {
      const variants = [...family.variants].sort((a, b) => {
        const aOrder = Number(a.variant_sort_order ?? a.sort_order ?? 9999);
        const bOrder = Number(b.variant_sort_order ?? b.sort_order ?? 9999);

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        const aValue = Number(a.variant_value);
        const bValue = Number(b.variant_value);

        if (
          Number.isFinite(aValue) &&
          Number.isFinite(bValue) &&
          aValue !== bValue
        ) {
          return aValue - bValue;
        }

        return getVariantLabel(a).localeCompare(
          getVariantLabel(b),
          undefined,
          { numeric: true, sensitivity: "base" }
        );
      });

      const availableVariants = variants.filter(
        (variant) =>
          getProductStock(variant) > 0 &&
          getProductPrice(variant) > 0
      );

      const pricedVariants = variants.filter(
        (variant) => getProductPrice(variant) > 0
      );

      const prices = pricedVariants.map((variant) =>
        getProductPrice(variant)
      );

      return {
        ...family,
        variants,
        available_variants: availableVariants,
        total_available_stock: variants.reduce(
          (sum, variant) => sum + Math.max(0, getProductStock(variant)),
          0
        ),
        min_selling_price:
          prices.length > 0 ? Math.min(...prices) : 0,
        max_selling_price:
          prices.length > 0 ? Math.max(...prices) : 0,
        has_available_variant: availableVariants.length > 0,
      };
    });
  }, [products]);

  useEffect(() => {
    setSelectedVariantByFamily((current) => {
      const next = { ...current };
      let changed = false;

      productFamilies.forEach((family) => {
        const variants = family.variants || [];
        const currentId = next[family.family_key];

        const currentStillExists = variants.some(
          (variant) =>
            String(variant.product_id) === String(currentId) &&
            getProductPrice(variant) > 0
        );

        if (!currentStillExists) {
          const preferred =
            variants.find(
              (variant) =>
                getProductStock(variant) > 0 &&
                getProductPrice(variant) > 0
            ) ||
            variants.find(
              (variant) => getProductPrice(variant) > 0
            ) ||
            variants[0];

          if (preferred) {
            next[family.family_key] = preferred.product_id;
            changed = true;
          }
        }
      });

      return changed ? next : current;
    });
  }, [productFamilies]);

  const getSelectedFamilyVariant = (family) => {
    const variants = family?.variants || [];
    const selectedId =
      selectedVariantByFamily[family?.family_key];

    return (
      variants.find(
        (variant) =>
          String(variant.product_id) === String(selectedId)
      ) ||
      variants.find(
        (variant) =>
          getProductStock(variant) > 0 &&
          getProductPrice(variant) > 0
      ) ||
      variants[0] ||
      null
    );
  };

  const selectFamilyVariant = (familyKey, productId) => {
    setSelectedVariantByFamily((current) => ({
      ...current,
      [familyKey]: productId,
    }));
  };

  const categories = useMemo(() => {
    const values = productFamilies
      .map(
        (family) =>
          family.category_name ||
          family.category ||
          "Uncategorized"
      )
      .filter(Boolean);

    return [
      "Available",
      "All",
      ...new Set(values),
      "Out of Stock",
    ];
  }, [productFamilies]);

  const filteredProducts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return productFamilies.filter((family) => {
      const category =
        family.category_name ||
        family.category ||
        "Uncategorized";

      const familyStock = Number(
        family.total_available_stock || 0
      );

      const matchesCategory =
        selectedCategory === "Available"
          ? familyStock > 0
          : selectedCategory === "All"
          ? true
          : selectedCategory === "Out of Stock"
          ? familyStock <= 0
          : category === selectedCategory &&
            familyStock > 0;

      const searchableValues = [
        family.product_name,
        category,
        family.vendor_name,
        ...(family.variants || []).flatMap((variant) => [
          variant.sku,
          getVariantLabel(variant),
        ]),
      ];

      const matchesSearch =
        keyword === "" ||
        searchableValues.some((value) =>
          String(value || "").toLowerCase().includes(keyword)
        );

      return matchesCategory && matchesSearch;
    });
  }, [
    productFamilies,
    searchTerm,
    selectedCategory,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / pageSize)
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const visibleProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          Number(item.price || 0) *
            Number(item.quantity || 0),
        0
      ),
    [cart]
  );

  const normalizedDiscount = Math.min(
    100,
    Math.max(0, Number(discountPercent || 0))
  );

  const discountAmount =
    subtotal * (normalizedDiscount / 100);

  const total = Math.max(0, subtotal - discountAmount);

  const enteredPayment = Math.max(
    0,
    Number(cashAmount || 0)
  );

  const amountApplied =
    paymentType === "Receivable"
      ? 0
      : total;

  const remainingBalance =
    paymentType === "Receivable"
      ? total
      : 0;

  const change =
    paymentType === "Cash" &&
    paymentMethod === "Cash"
      ? Math.max(0, enteredPayment - total)
      : 0;

  const requiresReceivable =
    paymentType === "Receivable";

  const resolvedOfficeName =
    officeName === "Other"
      ? customOfficeName.trim()
      : officeName.trim();

  const totalCartQuantity = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0),
        0
      ),
    [cart]
  );

  const normalizeProductDetails = (responseData, fallbackProduct) => {
    return (
      responseData?.product ||
      responseData?.details ||
      responseData?.data ||
      fallbackProduct
    );
  };

  const openProductDetails = async (product) => {
    setSelectedProduct(product);
    setProductDetails(product);
    setDetailQuantity(1);
    setProductDetailsError("");
    setProductDetailsLoading(true);

    try {
      const detailsResponse = await axios.get(
        `${INVENTORY_API}/get_product_details.php?product_id=${
          product.product_id
        }&t=${Date.now()}`,
        {
          withCredentials: true,
        }
      );

      if (detailsResponse.data?.success) {
        setProductDetails(
          normalizeProductDetails(
            detailsResponse.data,
            product
          )
        );
      } else {
        setProductDetailsError(
          detailsResponse.data?.message ||
            "Additional product information could not be loaded."
        );
      }
    } catch (error) {
      setProductDetailsError(
        error.response?.data?.message ||
          "Additional product information could not be loaded."
      );
    } finally {
      setProductDetailsLoading(false);
    }
  };

  const closeProductDetails = () => {
    setSelectedProduct(null);
    setProductDetails(null);
    setDetailQuantity(1);
    setProductDetailsError("");
  };

  const addToCart = (product, requestedQuantity = 1) => {
    const stock = Number(
      product.available_stock ??
        product.quantity ??
        product.total_remaining ??
        0
    );

    const price = Number(
      product.selling_price ??
        product.unit_price ??
        0
    );

    const quantityToAdd = Math.max(
      1,
      Math.min(stock, Number(requestedQuantity || 1))
    );

    if (stock <= 0) {
      showNotice(
        "Product unavailable",
        `${product.product_name} is currently out of stock.`
      );
      return false;
    }

    if (price <= 0) {
      showNotice(
        "Invalid selling price",
        `${product.product_name} cannot be sold yet.`
      );
      return false;
    }

    let successful = true;

    setCart((current) => {
      const existing = current.find(
        (item) =>
          String(item.product_id) ===
          String(product.product_id)
      );

      if (existing) {
        const nextQuantity =
          Number(existing.quantity) + quantityToAdd;

        if (nextQuantity > stock) {
          successful = false;
          showNotice(
            "Stock limit reached",
            `Only ${stock} item(s) are available.`
          );
          return current;
        }

        return current.map((item) =>
          String(item.product_id) ===
          String(product.product_id)
            ? {
                ...item,
                stock,
                quantity: nextQuantity,
              }
            : item
        );
      }

      return [
        ...current,
        {
          product_id: product.product_id,
          product_name: product.product_name,
          variant_label: getVariantLabel(product),
          family_key: getFamilyKey(product),
          sku: product.sku || "",
          category:
            product.category_name ||
            product.category ||
            "Uncategorized",
          unit:
            product.unit_type ||
            product.unit ||
            "pcs",
          price,
          stock,
          image: getProductImage(product),
          quantity: quantityToAdd,
        },
      ];
    });

    return successful;
  };

  const getCartItemFamily = (item) => {
    if (!item) return null;

    return (
      productFamilies.find(
        (family) =>
          String(family.family_key) ===
          String(item.family_key)
      ) ||
      productFamilies.find((family) =>
        (family.variants || []).some(
          (variant) =>
            String(variant.product_id) ===
            String(item.product_id)
        )
      ) ||
      null
    );
  };

  const openCartVariantPicker = (item) => {
    setCartVariantPicker({
      open: true,
      mode: "change",
      cartProductId: item.product_id,
      selectedProductId: item.product_id,
      quantity: Math.max(1, Number(item.quantity || 1)),
    });
  };

  const openAddAnotherVariantPicker = (item) => {
    const family = getCartItemFamily(item);

    if (!family || (family.variants || []).length <= 1) {
      showNotice(
        "No other variation",
        "This product has no other available size or variation."
      );
      return;
    }

    const firstAlternative = (family.variants || []).find(
      (variant) =>
        String(variant.product_id) !== String(item.product_id) &&
        getProductStock(variant) > 0 &&
        getProductPrice(variant) > 0
    );

    setCartVariantPicker({
      open: true,
      mode: "add",
      cartProductId: item.product_id,
      selectedProductId:
        firstAlternative?.product_id || item.product_id,
      quantity: 1,
    });
  };

  const closeCartVariantPicker = () => {
    setCartVariantPicker({
      open: false,
      mode: "change",
      cartProductId: null,
      selectedProductId: null,
      quantity: 1,
    });
  };

  const confirmAddAnotherVariant = () => {
    const currentItem = cart.find(
      (item) =>
        String(item.product_id) ===
        String(cartVariantPicker.cartProductId)
    );

    if (!currentItem) {
      closeCartVariantPicker();
      return;
    }

    const family = getCartItemFamily(currentItem);

    if (!family) {
      showNotice(
        "Variation unavailable",
        "The available variations for this product could not be loaded."
      );
      return;
    }

    const nextVariant = (family.variants || []).find(
      (variant) =>
        String(variant.product_id) ===
        String(cartVariantPicker.selectedProductId)
    );

    if (!nextVariant) {
      showNotice(
        "Variation unavailable",
        "Select an available product variation."
      );
      return;
    }

    const stock = getProductStock(nextVariant);
    const price = getProductPrice(nextVariant);
    const requestedQuantity = Math.max(
      1,
      Number(cartVariantPicker.quantity || 1)
    );

    if (stock <= 0) {
      showNotice(
        "Variation out of stock",
        `${getVariantLabel(nextVariant)} is currently out of stock.`
      );
      return;
    }

    if (price <= 0) {
      showNotice(
        "Variation unavailable",
        `${getVariantLabel(nextVariant)} is not available for sale yet.`
      );
      return;
    }

    if (requestedQuantity > stock) {
      showNotice(
        "Stock limit reached",
        `Only ${stock} item(s) of ${getVariantLabel(
          nextVariant
        )} are available.`
      );
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) =>
          String(item.product_id) ===
          String(nextVariant.product_id)
      );

      if (existing) {
        const combined =
          Number(existing.quantity || 0) +
          requestedQuantity;

        if (combined > stock) {
          showNotice(
            "Stock limit reached",
            `Only ${stock} item(s) of ${getVariantLabel(
              nextVariant
            )} are available.`
          );
          return current;
        }

        return current.map((item) =>
          String(item.product_id) ===
          String(nextVariant.product_id)
            ? {
                ...item,
                quantity: combined,
                stock,
                price,
              }
            : item
        );
      }

      return [
        ...current,
        {
          product_id: nextVariant.product_id,
          product_name:
            nextVariant.product_name ||
            currentItem.product_name,
          variant_label:
            getVariantLabel(nextVariant),
          family_key:
            getFamilyKey(nextVariant),
          sku: nextVariant.sku || "",
          category:
            nextVariant.category_name ||
            nextVariant.category ||
            currentItem.category ||
            "Uncategorized",
          unit:
            nextVariant.unit_type ||
            nextVariant.unit ||
            currentItem.unit ||
            "pcs",
          price,
          stock,
          image:
            getProductImage(nextVariant) ||
            currentItem.image,
          quantity: requestedQuantity,
        },
      ];
    });

    closeCartVariantPicker();
  };

  const confirmCartVariant = () => {
    const currentItem = cart.find(
      (item) =>
        String(item.product_id) ===
        String(cartVariantPicker.cartProductId)
    );

    if (!currentItem) {
      closeCartVariantPicker();
      return;
    }

    const family = getCartItemFamily(currentItem);

    if (!family) {
      showNotice(
        "Variation unavailable",
        "The available variations for this product could not be loaded."
      );
      return;
    }

    const nextVariant = (family.variants || []).find(
      (variant) =>
        String(variant.product_id) ===
        String(cartVariantPicker.selectedProductId)
    );

    if (!nextVariant) {
      showNotice(
        "Variation unavailable",
        "Select an available product variation."
      );
      return;
    }

    const nextStock = getProductStock(nextVariant);
    const nextPrice = getProductPrice(nextVariant);

    if (nextStock <= 0) {
      showNotice(
        "Variation out of stock",
        `${getVariantLabel(nextVariant)} is currently out of stock.`
      );
      return;
    }

    if (nextPrice <= 0) {
      showNotice(
        "Variation unavailable",
        `${getVariantLabel(nextVariant)} is not available for sale yet.`
      );
      return;
    }

    const currentQuantity = Math.max(
      1,
      Number(currentItem.quantity || 1)
    );

    setCart((current) => {
      const targetAlreadyInCart = current.find(
        (item) =>
          String(item.product_id) ===
            String(nextVariant.product_id) &&
          String(item.product_id) !==
            String(currentItem.product_id)
      );

      if (targetAlreadyInCart) {
        const mergedQuantity =
          Number(targetAlreadyInCart.quantity || 0) +
          currentQuantity;

        if (mergedQuantity > nextStock) {
          showNotice(
            "Stock limit reached",
            `Only ${nextStock} item(s) of ${getVariantLabel(
              nextVariant
            )} are available.`
          );
          return current;
        }

        return current
          .filter(
            (item) =>
              String(item.product_id) !==
              String(currentItem.product_id)
          )
          .map((item) =>
            String(item.product_id) ===
            String(nextVariant.product_id)
              ? {
                  ...item,
                  quantity: mergedQuantity,
                  stock: nextStock,
                  price: nextPrice,
                  variant_label:
                    getVariantLabel(nextVariant),
                  family_key:
                    getFamilyKey(nextVariant),
                  sku: nextVariant.sku || "",
                  image:
                    getProductImage(nextVariant) ||
                    item.image,
                  unit:
                    nextVariant.unit_type ||
                    nextVariant.unit ||
                    item.unit ||
                    "pcs",
                }
              : item
          );
      }

      const safeQuantity = Math.min(
        currentQuantity,
        nextStock
      );

      return current.map((item) =>
        String(item.product_id) ===
        String(currentItem.product_id)
          ? {
              ...item,
              product_id: nextVariant.product_id,
              product_name:
                nextVariant.product_name ||
                currentItem.product_name,
              variant_label:
                getVariantLabel(nextVariant),
              family_key:
                getFamilyKey(nextVariant),
              sku: nextVariant.sku || "",
              category:
                nextVariant.category_name ||
                nextVariant.category ||
                currentItem.category ||
                "Uncategorized",
              unit:
                nextVariant.unit_type ||
                nextVariant.unit ||
                currentItem.unit ||
                "pcs",
              price: nextPrice,
              stock: nextStock,
              image:
                getProductImage(nextVariant) ||
                currentItem.image,
              quantity: safeQuantity,
            }
          : item
      );
    });

    closeCartVariantPicker();
  };

  const addSelectedProductToCart = () => {
    if (!selectedProduct) return;

    const mergedProduct = {
      ...selectedProduct,
      ...(productDetails || {}),
    };

    if (addToCart(mergedProduct, detailQuantity)) {
      closeProductDetails();
      setCartOpen(true);
    }
  };

  const buySelectedProductNow = () => {
    if (!selectedProduct) return;

    const mergedProduct = {
      ...selectedProduct,
      ...(productDetails || {}),
    };

    if (addToCart(mergedProduct, detailQuantity)) {
      closeProductDetails();

      if (!canCheckout) {
        onRequireLogin?.();
      } else {
        setCheckoutOpen(true);
      }
    }
  };

  const updateQuantity = (productId, nextValue) => {
    setCart((current) =>
      current.map((item) => {
        if (
          String(item.product_id) !==
          String(productId)
        ) {
          return item;
        }

        if (nextValue === "") {
          return {
            ...item,
            quantity: "",
          };
        }

        const requested = Math.floor(Number(nextValue));

        if (!Number.isFinite(requested)) {
          return item;
        }

        const quantity = Math.max(
          1,
          Math.min(
            Number(item.stock || 1),
            requested
          )
        );

        return {
          ...item,
          quantity,
        };
      })
    );
  };

  const normalizeQuantity = (productId) => {
    setCart((current) =>
      current.map((item) => {
        if (
          String(item.product_id) !==
          String(productId)
        ) {
          return item;
        }

        const stock = Math.max(1, Number(item.stock || 1));
        const requested = Math.floor(Number(item.quantity));

        return {
          ...item,
          quantity:
            Number.isFinite(requested) && requested >= 1
              ? Math.min(stock, requested)
              : 1,
        };
      })
    );
  };

  const removeFromCart = (productId) => {
    setCart((current) =>
      current.filter(
        (item) =>
          String(item.product_id) !==
          String(productId)
      )
    );
  };

  const startCheckout = () => {
    if (cart.length === 0) {
      showNotice(
        "Your cart is empty",
        "Add at least one product before checkout."
      );
      return;
    }

    if (!canCheckout) {
      onRequireLogin?.();
      return;
    }

    setCheckoutOpen(true);
    setCartOpen(false);
  };

  const triggerPostSaleCommunication = async (
    saleData
  ) => {
    if (
      !saleData?.post_processing_required ||
      !Array.isArray(
        saleData?.reorder_events
      ) ||
      saleData.reorder_events.length === 0
    ) {
      return;
    }

    try {
      const csrfToken = await getCsrfToken();

      await axios.post(
        `${POS_API}/post_sale_communication.php`,
        {
          transaction_code:
            saleData.transaction_code,
          reorder_events:
            saleData.reorder_events,
        },
        {
          timeout: 30000,
          withCredentials: true,
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );
    } catch (error) {
      console.warn(
        "Post-sale communication failed:",
        error.response?.data?.message ||
          error.message
      );
    }
  };

  const loadCompletedSaleReceipt = async (
    posId,
    maxAttempts = 4
  ) => {
    let lastError = null;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt += 1
    ) {
      try {
        const response = await axios.get(
          `${POS_API}/get_receipt.php?pos_id=${
            posId
          }&t=${Date.now()}`,
          {
            timeout: 10000,
            withCredentials: true,
          }
        );

        if (response.data?.success) {
          return response.data;
        }

        lastError = new Error(
          response.data?.message ||
            "Unable to load receipt."
        );
      } catch (error) {
        lastError = error;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) =>
          window.setTimeout(
            resolve,
            250 * attempt
          )
        );
      }
    }

    throw (
      lastError ||
      new Error(
        "Sale completed, but the receipt could not be loaded."
      )
    );
  };

  const completeSale = async () => {
    if (processing) return;

    if (paymentType === "Cash") {
      if (!customerName.trim()) {
        showNotice(
          "Customer name required",
          "Enter the customer name."
        );
        return;
      }

      if (
        paymentMethod === "Cash" &&
        enteredPayment < total
      ) {
        showNotice(
          "Insufficient cash",
          `The required amount is ${formatPeso(total)}.`
        );
        return;
      }

      if (
        paymentMethod !== "Cash" &&
        !paymentReference.trim()
      ) {
        showNotice(
          "Payment reference required",
          `Enter the ${paymentMethod} reference number before confirming the sale.`
        );
        return;
      }
    }

    if (paymentType === "Receivable") {
      if (!employeeName.trim()) {
        showNotice(
          "Employee name required",
          "Enter the employee name for this receivable."
        );
        return;
      }

      if (!resolvedOfficeName) {
        showNotice(
          "Office / Department required",
          officeName === "Other"
            ? "Specify the employee's office or department."
            : "Select the employee's office or department."
        );
        return;
      }

    }

    setProcessing(true);

    const requestToken =
      checkoutRequestToken ||
      createCheckoutRequestToken();

    if (!checkoutRequestToken) {
      setCheckoutRequestToken(requestToken);
    }

    let committedSale = null;

    try {
      const csrfToken = await getCsrfToken();

      const saleResponse = await axios.post(
        `${POS_API}/create_sale.php`,
        {
          items: cart.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
          })),
          customer_name:
            paymentType === "Receivable"
              ? employeeName.trim()
              : customerName.trim() || "WALK IN CLIENT",
          prepared_by:
            user?.full_name || "HiveSync Staff",
          received_by:
            paymentType === "Receivable"
              ? employeeName.trim()
              : customerName.trim() || "WALK IN CLIENT",
          discount_percent: normalizedDiscount,

          payment_type: paymentType,
          payment_method:
            paymentType === "Receivable"
              ? "Cash"
              : paymentMethod,
          payment_reference:
            paymentType === "Receivable" ||
            paymentMethod === "Cash"
              ? ""
              : paymentReference.trim(),
          cash_amount:
            paymentType === "Receivable"
              ? 0
              : (
                  paymentType === "Cash" &&
                  paymentMethod !== "Cash"
                    ? total
                    : enteredPayment
                ),

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

          created_by: user?.user_id,
          request_token: requestToken,
        },
        {
          timeout: 30000,
          withCredentials: true,
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );

      if (!saleResponse.data?.success) {
        throw new Error(
          saleResponse.data?.message ||
            "Unable to complete the sale."
        );
      }

      committedSale = saleResponse.data;
      setCheckoutRequestToken(null);

      triggerPostSaleCommunication(
        committedSale
      );

      const receiptResponse =
        await loadCompletedSaleReceipt(
          committedSale.pos_id
        );

      const loadedReceipt =
        receiptResponse.receipt ||
        receiptResponse.sale;

      setReceipt({
        ...loadedReceipt,
        payment_type:
          loadedReceipt?.payment_type ||
          saleResponse.data?.payment_type ||
          paymentType,
        payment_method:
          loadedReceipt?.payment_method ||
          saleResponse.data?.payment_method ||
          paymentMethod,
        payment_reference:
          loadedReceipt?.payment_reference ||
          saleResponse.data?.payment_reference ||
          paymentReference.trim(),
        amount_paid:
          loadedReceipt?.amount_paid ??
          saleResponse.data?.amount_paid ??
          amountApplied,
        balance_amount:
          loadedReceipt?.balance_amount ??
          loadedReceipt?.receivable_balance_amount ??
          saleResponse.data?.balance_amount ??
          remainingBalance,
        employee_name:
          loadedReceipt?.employee_name ||
          saleResponse.data?.employee_name ||
          employeeName.trim(),
        office_name:
          loadedReceipt?.office_name ||
          saleResponse.data?.office_name ||
          resolvedOfficeName,
        receivable_notes:
          loadedReceipt?.receivable_notes ||
          saleResponse.data?.receivable_notes ||
          receivableNotes.trim(),
      });

      setCheckoutOpen(false);

      if (paymentType === "Receivable") {
        setReceivableRecordedOpen(true);
      } else {
        setReceiptOpen(true);
      }

      setCart([]);
      localStorage.removeItem(CART_STORAGE_KEY);

      setCustomerName("WALK IN CLIENT");
      setEmployeeName("");
      setOfficeName("");
      setCustomOfficeName("");
      setDiscountPercent("");
      setCashAmount("");
      setPaymentType("Cash");
      setPaymentMethod("Cash");
      setPaymentReference("");
      setReceivableNotes("");

      await loadProducts({ silent: true });
    } catch (error) {
      if (committedSale?.pos_id) {
        setCheckoutOpen(false);
        setCart([]);
        localStorage.removeItem(
          CART_STORAGE_KEY
        );

        setCustomerName(
          "WALK IN CLIENT"
        );
        setEmployeeName("");
        setOfficeName("");
        setCustomOfficeName("");
        setDiscountPercent("");
        setCashAmount("");
        setPaymentType("Cash");
        setPaymentMethod("Cash");
        setPaymentReference("");
        setReceivableNotes("");

        await loadProducts({
          silent: true,
        });

        showNotice(
          "Sale completed",
          `Transaction ${
            committedSale.transaction_code ||
            committedSale.sale_number ||
            ""
          } was saved successfully, but the receipt could not be opened automatically. You can open or print the receipt from POS transaction history.`
        );
      } else {
        showNotice(
          "Checkout failed",
          error.response?.data?.message ||
            error.message ||
            "Unable to complete the transaction."
        );
      }
    } finally {
      setProcessing(false);
    }
  };

  const printReceipt = () => {
    const receiptElement = document.querySelector(".store-receipt");

    if (!receiptElement) {
      showNotice(
        "Receipt unavailable",
        "The receipt could not be prepared for printing."
      );
      return;
    }

    const printWindow = window.open("", "_blank", "width=420,height=760");

    if (!printWindow) {
      showNotice(
        "Print window blocked",
        "Allow pop-ups for HiveSync, then try printing the receipt again."
      );
      return;
    }

    const receiptHtml = receiptElement.outerHTML;

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Receipt ${receipt?.transaction_code || ""}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 2mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: 80mm !important;
              min-width: 80mm !important;
              max-width: 80mm !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: Arial, Helvetica, sans-serif !important;
            }

            body {
              display: block !important;
            }

            .store-receipt {
              width: 76mm !important;
              min-width: 76mm !important;
              max-width: 76mm !important;
              margin: 0 !important;
              padding: 2mm 2.5mm 3mm !important;
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-size: 9px !important;
              line-height: 1.25 !important;
            }

            .store-receipt-logo {
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              margin: 0 0 1mm !important;
            }

            .store-receipt-logo img {
              display: block !important;
              width: 10mm !important;
              height: 10mm !important;
              object-fit: contain !important;
              filter: grayscale(1) contrast(1.25) !important;
            }

            .store-receipt-government {
              text-align: center !important;
              margin: 0 !important;
            }

            .store-receipt-government h2 {
              margin: 0 !important;
              padding: 0 !important;
              font-size: 11px !important;
              line-height: 1.15 !important;
              font-weight: 800 !important;
              letter-spacing: 0 !important;
            }

            .store-receipt-government p {
              margin: 0.7mm 0 1.5mm !important;
              font-size: 8px !important;
            }

            .store-receipt > h3 {
              margin: 0 0 1mm !important;
              text-align: center !important;
              font-size: 10px !important;
              line-height: 1.2 !important;
              font-weight: 800 !important;
              letter-spacing: 0.2px !important;
            }

            .store-receipt-number {
              margin: 0 0 1.5mm !important;
              text-align: center !important;
              font-size: 9px !important;
              font-weight: 800 !important;
            }

            .store-receipt-divider {
              width: 100% !important;
              height: 0 !important;
              margin: 1.5mm 0 !important;
              border: 0 !important;
              border-top: 1px dashed #000000 !important;
            }

            .store-receipt-info {
              display: block !important;
              margin: 0 !important;
            }

            .store-receipt-info > div,
            .store-receipt-totals > div {
              display: grid !important;
              grid-template-columns: minmax(0, 1fr) auto !important;
              align-items: start !important;
              gap: 2mm !important;
              margin: 0 0 1mm !important;
            }

            .store-receipt-info span,
            .store-receipt-totals span {
              min-width: 0 !important;
              font-size: 8px !important;
              font-weight: 400 !important;
            }

            .store-receipt-info strong,
            .store-receipt-totals strong {
              max-width: 42mm !important;
              text-align: right !important;
              font-size: 8px !important;
              font-weight: 700 !important;
              overflow-wrap: anywhere !important;
            }

            .store-receipt-items {
              width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
              border-spacing: 0 !important;
              margin: 0 !important;
              font-size: 8px !important;
            }

            .store-receipt-items th,
            .store-receipt-items td {
              border: 0 !important;
              padding: 1mm 0.7mm !important;
              vertical-align: top !important;
              color: #000000 !important;
              background: transparent !important;
              overflow-wrap: anywhere !important;
            }

            .store-receipt-items th {
              font-size: 7px !important;
              font-weight: 800 !important;
              border-bottom: 1px solid #000000 !important;
            }

            .store-receipt-items th:nth-child(1),
            .store-receipt-items td:nth-child(1) {
              width: 9% !important;
              text-align: center !important;
            }

            .store-receipt-items th:nth-child(2),
            .store-receipt-items td:nth-child(2) {
              width: 45% !important;
              text-align: left !important;
            }

            .store-receipt-items th:nth-child(3),
            .store-receipt-items td:nth-child(3) {
              width: 22% !important;
              text-align: right !important;
              white-space: nowrap !important;
            }

            .store-receipt-items th:nth-child(4),
            .store-receipt-items td:nth-child(4) {
              width: 24% !important;
              text-align: right !important;
              white-space: nowrap !important;
            }

            .store-receipt-totals {
              margin: 0 !important;
            }

            .store-receipt-totals .grand {
              margin: 1mm 0 !important;
              padding: 1mm 0 !important;
              border-top: 1px solid #000000 !important;
              border-bottom: 1px solid #000000 !important;
            }

            .store-receipt-totals .grand span,
            .store-receipt-totals .grand strong {
              font-size: 9px !important;
              font-weight: 800 !important;
            }

            .store-receipt-signatures {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 4mm !important;
              margin: 4mm 0 2mm !important;
            }

            .store-receipt-signatures > div {
              min-width: 0 !important;
              text-align: center !important;
            }

            .store-receipt-signatures span {
              display: block !important;
              margin-bottom: 5mm !important;
              font-size: 7px !important;
            }

            .store-receipt-signatures strong {
              display: block !important;
              padding-top: 1mm !important;
              border-top: 1px solid #000000 !important;
              font-size: 7px !important;
              overflow-wrap: anywhere !important;
            }

            .store-receipt-system {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              gap: 0.5mm !important;
              margin-top: 2mm !important;
              text-align: center !important;
              font-size: 7px !important;
            }

            .store-receipt-system strong,
            .store-receipt-system span {
              font-size: 7px !important;
            }

            @media print {
              html,
              body {
                width: 80mm !important;
                min-width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 !important;
                padding: 0 !important;
              }

              .store-receipt {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          </style>
        </head>
        <body>
          ${receiptHtml}
          <script>
            window.addEventListener("load", function () {
              var images = Array.from(document.images);

              if (images.length === 0) {
                window.focus();
                window.print();
                return;
              }

              Promise.all(
                images.map(function (image) {
                  if (image.complete) return Promise.resolve();

                  return new Promise(function (resolve) {
                    image.onload = resolve;
                    image.onerror = resolve;
                  });
                })
              ).then(function () {
                window.focus();
                window.print();
              });
            });
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const selectedFamily = useMemo(() => {
    if (!selectedProduct) return null;

    return (
      productFamilies.find((family) =>
        (family.variants || []).some(
          (variant) =>
            String(variant.product_id) ===
            String(selectedProduct.product_id)
        )
      ) || null
    );
  }, [productFamilies, selectedProduct]);

  const detailVariants =
    selectedFamily?.variants ||
    (selectedProduct ? [selectedProduct] : []);

  const changeDetailVariant = (productId) => {
    const variant = detailVariants.find(
      (item) =>
        String(item.product_id) === String(productId)
    );

    if (!variant) return;

    if (selectedFamily?.family_key) {
      selectFamilyVariant(
        selectedFamily.family_key,
        variant.product_id
      );
    }

    openProductDetails(variant);
  };

  const detailStock = Number(
    productDetails?.available_stock ??
      productDetails?.quantity ??
      selectedProduct?.available_stock ??
      selectedProduct?.quantity ??
      0
  );

  const detailPrice = Number(
    productDetails?.selling_price ??
      productDetails?.unit_price ??
      selectedProduct?.selling_price ??
      selectedProduct?.unit_price ??
      0
  );

  const detailImage = getProductImage({
    ...(selectedProduct || {}),
    ...(productDetails || {}),
  });


  return (
    <div className="store-page">
      <div className="landing-enterprise-header-wrap">
        <PageHeader
          showSystemHeader
          user={user}
          onLogout={onLogout}
          onNotificationNavigate={
            onNotificationNavigate
          }
          className="landing-enterprise-header landing-public-header"
        />
      </div>

      <main className="landing-ref-shell">
        <section className="landing-ref-left">
          <div className="landing-ref-toolbar">
            <div className="landing-ref-search-row">
              <div className="landing-ref-search-box">
                <Search size={17} />
                <input
                  type="text"
                  placeholder="Search for items..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />

                {searchTerm && (
                  <button
                    type="button"
                    className="landing-ref-search-clear"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                className="landing-ref-refresh"
                onClick={() => loadProducts()}
                title="Refresh products"
              >
                <RefreshCw size={17} />
              </button>
            </div>

            <div className="landing-ref-category-row">
              {categories.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={selectedCategory === category ? "active" : ""}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="landing-ref-products-wrap">
            {loadingProducts ? (
              <div className="store-state landing-ref-state">
                <RefreshCw size={30} className="store-spin" />
                <strong>Loading products</strong>
                <span>Retrieving the latest stock records.</span>
              </div>
            ) : productError ? (
              <div className="store-state landing-ref-state">
                <Package size={32} />
                <strong>Unable to load products</strong>
                <span>{productError}</span>
                <button type="button" onClick={() => loadProducts()}>
                  Try Again
                </button>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="store-state landing-ref-state">
                <Package size={32} />
                <strong>No matching products</strong>
                <span>Try another search or category.</span>
              </div>
            ) : (
              <>
                <div className="landing-ref-grid">
                  {visibleProducts.map((product) => {
                    const variants = product.variants || [];
                    const selectedVariant = getSelectedFamilyVariant(product);
                    const selectedStock = selectedVariant
                      ? getProductStock(selectedVariant)
                      : 0;
                    const selectedPrice = selectedVariant
                      ? getProductPrice(selectedVariant)
                      : 0;
                    const availableVariantCount = variants.filter(
                      (variant) =>
                        getProductStock(variant) > 0 &&
                        getProductPrice(variant) > 0
                    ).length;
                    const familyOutOfStock = availableVariantCount === 0;
                    const image = getProductImage(selectedVariant || product);

                    return (
                      <article
                        className={`landing-ref-card${
                          familyOutOfStock ? " is-out" : ""
                        }`}
                        key={product.family_key}
                        onClick={() => {
                          if (!familyOutOfStock && selectedVariant) {
                            openProductDetails(selectedVariant);
                          }
                        }}
                      >
                        <div className="landing-ref-card-image">
                          {image ? (
                            <img src={image} alt={product.product_name} />
                          ) : (
                            <Package size={34} />
                          )}

                          <span
                            className={`landing-ref-availability${
                              familyOutOfStock ? " unavailable" : ""
                            }`}
                          >
                            {familyOutOfStock ? "Not Available" : "Available"}
                          </span>
                        </div>

                        <div className="landing-ref-card-body">
                          <div className="landing-ref-card-title-row">
                            <h3>{product.product_name}</h3>
                            <strong>{formatPeso(selectedPrice)}</strong>
                          </div>

                          <div className="landing-ref-stock-under-name">
                            {familyOutOfStock
                              ? "Out of stock"
                              : `${selectedStock} ${
                                  selectedVariant?.unit_type ||
                                  selectedVariant?.unit ||
                                  "pcs"
                                } left`}
                          </div>



                          <div
                            className={`landing-ref-variant-slot${
                              variants.length > 1 ? " has-variants" : ""
                            }`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {variants.length > 1 && (
                              <div className="landing-ref-variant-dropdown">
                                <select
                                  value={selectedVariant?.product_id || ""}
                                  onChange={(event) =>
                                    selectFamilyVariant(
                                      product.family_key,
                                      event.target.value
                                    )
                                  }
                                  aria-label={`Select size or variant for ${product.product_name}`}
                                >
                                  {variants.map((variant) => {
                                    const variantStock =
                                      getProductStock(variant);
                                    const variantPrice =
                                      getProductPrice(variant);
                                    const unavailable =
                                      variantStock <= 0 ||
                                      variantPrice <= 0;

                                    return (
                                      <option
                                        key={variant.product_id}
                                        value={variant.product_id}
                                        disabled={unavailable}
                                      >
                                        {getVariantLabel(variant)}
                                        {unavailable ? " - Out of stock" : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="landing-ref-add-button"
                            onClick={(event) => {
                              event.stopPropagation();

                              if (
                                !selectedVariant ||
                                familyOutOfStock ||
                                selectedStock <= 0 ||
                                selectedPrice <= 0
                              ) {
                                return;
                              }

                              addToCart(selectedVariant, 1);
                            }}
                            disabled={
                              familyOutOfStock ||
                              !selectedVariant ||
                              selectedStock <= 0 ||
                              selectedPrice <= 0
                            }
                          >
                            {familyOutOfStock ? (
                              "Not Available"
                            ) : (
                              <>
                                <Plus size={13} />
                                Add to Cart
                              </>
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="landing-ref-pagination">
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={page === 1}
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <span>
                    Page {page} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) =>
                        Math.min(totalPages, current + 1)
                      )
                    }
                    disabled={page === totalPages}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="landing-ref-order landing-checkout-panel">
          <div className="landing-checkout-head">
            <div>
              <span>CURRENT ORDER</span>
              <h2>Order Summary</h2>
            </div>

            <div className="landing-checkout-count">
              <ShoppingCart size={22} />
              <strong>
                {totalCartQuantity} item
                {totalCartQuantity === 1 ? "" : "s"}
              </strong>
            </div>
          </div>

          <div className="landing-checkout-cart">
            {cart.length === 0 ? (
              <div className="landing-checkout-empty">
                <div className="landing-checkout-empty-icon">
                  <ShoppingCart size={31} />
                </div>
                <strong>No items yet</strong>
                <span>Add products from the catalog.</span>
              </div>
            ) : (
              <>
                <div className="landing-checkout-items">
                  {cart.map((item) => (
                    <div
                      className="landing-checkout-item"
                      key={item.product_id}
                    >
                      <div className="landing-checkout-item-image">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.product_name}
                          />
                        ) : (
                          <Package size={20} />
                        )}
                      </div>

                      <div className="landing-checkout-item-copy">
                        <strong>{item.product_name}</strong>
                        <span>
                          {item.variant_label || "Standard"} ·{" "}
                          {formatPeso(item.price)}
                        </span>
                      </div>

                      <div className="landing-checkout-item-controls">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.product_id,
                              Math.max(
                                1,
                                Number(item.quantity) - 1
                              )
                            )
                          }
                        >
                          <Minus size={12} />
                        </button>

                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          onChange={(event) =>
                            updateQuantity(
                              item.product_id,
                              event.target.value
                            )
                          }
                          onBlur={() =>
                            normalizeQuantity(item.product_id)
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.product_id,
                              Number(item.quantity) + 1
                            )
                          }
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <strong className="landing-checkout-item-total">
                        {formatPeso(
                          Number(item.price) *
                            Number(item.quantity)
                        )}
                      </strong>

                      <button
                        type="button"
                        className="landing-checkout-item-delete"
                        onClick={() =>
                          removeFromCart(item.product_id)
                        }
                        aria-label={`Remove ${item.product_name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="landing-checkout-clear"
                  onClick={() => setCart([])}
                >
                  Clear Order
                </button>
              </>
            )}
          </div>

          <div className="landing-checkout-section">
            {paymentType === "Receivable" ? (
              <div className="landing-checkout-form-grid">
                <label className="landing-checkout-field">
                  <span>Employee Name</span>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(event) =>
                      setEmployeeName(event.target.value)
                    }
                    placeholder="Enter employee name"
                  />
                </label>

                <label className="landing-checkout-field">
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
                  >
                    <option value="">
                      Select office / department
                    </option>
                    {OFFICE_OPTIONS.map((office) => (
                      <option key={office} value={office}>
                        {office}
                      </option>
                    ))}
                  </select>
                </label>

                {officeName === "Other" && (
                  <label className="landing-checkout-field landing-checkout-field-full">
                    <span>Specify Office / Department</span>
                    <input
                      type="text"
                      value={customOfficeName}
                      onChange={(event) =>
                        setCustomOfficeName(
                          event.target.value
                        )
                      }
                      placeholder="Enter office or department"
                    />
                  </label>
                )}
              </div>
            ) : (
              <label className="landing-checkout-field">
                <span>Customer Name</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) =>
                    setCustomerName(event.target.value)
                  }
                  placeholder="Customer name"
                />
              </label>
            )}
          </div>

          <div className="landing-checkout-section">
            <div className="landing-checkout-section-title">
              Payment Type
            </div>

            <div className="landing-checkout-type-grid">
              <button
                type="button"
                className={
                  paymentType === "Cash" ? "active" : ""
                }
                onClick={() => {
                  setPaymentType("Cash");
                  setPaymentMethod("Cash");
                  setPaymentReference("");
                  setCashAmount("");
                  setEmployeeName("");
                  setOfficeName("");
                  setCustomOfficeName("");
                  setReceivableNotes("");
                }}
              >
                Full Payment
              </button>

              <button
                type="button"
                className={
                  paymentType === "Receivable"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setPaymentType("Receivable");
                  setCashAmount("");
                  setPaymentReference("");
                }}
              >
                Receivable
              </button>
            </div>

            {paymentType === "Cash" ? (
              <>
                <div className="landing-checkout-section-title landing-checkout-method-title">
                  Payment Method
                </div>

                <div className="landing-checkout-method-grid">
                  {[
                    "Cash",
                    "GCash",
                    "Maya",
                    "Bank Transfer",
                    "Other",
                  ].map((method) => (
                    <button
                      type="button"
                      key={method}
                      className={
                        paymentMethod === method
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setPaymentMethod(method);
                        setPaymentReference("");
                        if (method !== "Cash") {
                          setCashAmount("");
                        }
                      }}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                {paymentMethod === "Cash" ? (
                  <div className="landing-checkout-cash-row">
                    <label className="landing-checkout-field">
                      <span>Cash Received</span>
                      <div className="landing-checkout-money-input">
                        <span>₱</span>
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
                          placeholder="0.00"
                        />
                      </div>
                    </label>

                    <div className="landing-checkout-change">
                      <span>Change</span>
                      <strong>{formatPeso(change)}</strong>
                    </div>
                  </div>
                ) : (
                  <label className="landing-checkout-field landing-checkout-reference">
                    <span>
                      {paymentMethod} Reference No.
                    </span>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(event) =>
                        setPaymentReference(
                          event.target.value
                        )
                      }
                      placeholder="Enter transaction reference"
                    />
                  </label>
                )}
              </>
            ) : (
              <label className="landing-checkout-field landing-checkout-reference">
                <span>Receivable Notes</span>
                <textarea
                  value={receivableNotes}
                  onChange={(event) =>
                    setReceivableNotes(
                      event.target.value
                    )
                  }
                  placeholder="Optional notes for this receivable"
                />
              </label>
            )}
          </div>

          <div className="landing-checkout-summary-card">
            <div className="landing-checkout-summary-row">
              <span>Sub Total</span>
              <strong>{formatPeso(subtotal)}</strong>
            </div>

            <div className="landing-checkout-summary-row landing-checkout-discount-row">
              <span>Discount (%)</span>
              <div className="landing-checkout-discount-input">
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
                <span>%</span>
              </div>
            </div>

            <div className="landing-checkout-summary-row">
              <span>Discount Amount</span>
              <strong>
                -{formatPeso(discountAmount)}
              </strong>
            </div>

            <div className="landing-checkout-total-row">
              <span>Total</span>
              <strong>{formatPeso(total)}</strong>
            </div>
          </div>

          <div className="landing-checkout-action">
            <button
              type="button"
              className="landing-checkout-pay"
              disabled={
                cart.length === 0 ||
                processing
              }
              onClick={() => {
                if (!canCheckout) {
                  onRequireLogin?.();
                  return;
                }

                setPaymentConfirmOpen(true);
              }}
            >
              {processing
                ? "Processing..."
                : paymentType === "Receivable"
                ? "Record Receivable"
                : "Pay Now"}
            </button>

            <small>
              Processed by{" "}
              <strong>
                {user?.full_name ||
                  "Not signed in"}
              </strong>
            </small>
          </div>
        </aside>
      </main>

      <footer className="store-footer landing-ref-footer">
        <div>
          <img src={hiveLogo} alt="The Hive" />
          <div>
            <strong>HiveSync</strong>
            <span>Integrated Business and Operations Management System</span>
          </div>
        </div>

        <p>Bacnotan Farmers Agri-Tourism Center · La Union · © 2026</p>
      </footer>

      {selectedProduct && (
        <div
          className="store-modal-backdrop"
          onMouseDown={closeProductDetails}
        >
          <div
            className="product-details-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="product-details-close"
              onClick={closeProductDetails}
            >
              <X size={22} />
            </button>

            <div className="product-details-layout">
              <div className="product-details-media">
                <div className="product-details-main-image">
                  {detailImage ? (
                    <img
                      src={detailImage}
                      alt={
                        productDetails?.product_name ||
                        selectedProduct.product_name
                      }
                    />
                  ) : (
                    <Package size={62} />
                  )}
                </div>

                <div className="product-details-stock">
                  <strong>{detailStock}</strong>
                  <span>
                    {productDetails?.unit_type ||
                      productDetails?.unit ||
                      selectedProduct.unit_type ||
                      selectedProduct.unit ||
                      "items"}{" "}
                    available
                  </span>
                </div>
              </div>

              <div className="product-details-content">
                <span className="product-details-category">
                  {productDetails?.category_name ||
                    productDetails?.category ||
                    selectedProduct.category_name ||
                    selectedProduct.category ||
                    "Uncategorized"}
                </span>

                <h2>
                  {productDetails?.product_name ||
                    selectedProduct.product_name}
                </h2>

                <p className="product-details-sku">
                  SKU:{" "}
                  {productDetails?.sku ||
                    selectedProduct.sku ||
                    "Not specified"}
                </p>

                <label className="product-details-variant-field">
                  <span>Size / Variant</span>

                  <select
                    value={selectedProduct.product_id}
                    onChange={(event) =>
                      changeDetailVariant(event.target.value)
                    }
                  >
                    {detailVariants.map((variant) => {
                      const variantStock =
                        getProductStock(variant);
                      const variantPrice =
                        getProductPrice(variant);

                      return (
                        <option
                          key={variant.product_id}
                          value={variant.product_id}
                          disabled={
                            variantStock <= 0 ||
                            variantPrice <= 0
                          }
                        >
                          {getVariantLabel(variant)}
                          {" — "}
                          {formatPeso(variantPrice)}
                          {" — "}
                          {variantStock > 0
                            ? `${variantStock} available`
                            : "Out of stock"}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <div className="product-details-price">
                  {formatPeso(detailPrice)}
                </div>

                <div className="product-details-information">
                  <div>
                    <span>Supplier</span>
                    <strong>
                      {productDetails?.vendor_name ||
                        productDetails?.supplier_name ||
                        selectedProduct.vendor_name ||
                        "Not specified"}
                    </strong>
                  </div>

                  <div>
                    <span>Unit</span>
                    <strong>
                      {productDetails?.unit_type ||
                        productDetails?.unit ||
                        selectedProduct.unit_type ||
                        selectedProduct.unit ||
                        "Not specified"}
                    </strong>
                  </div>

                  <div>
                    <span>Reorder Level</span>
                    <strong>
                      {productDetails?.reorder_level ??
                        selectedProduct.reorder_level ??
                        "Not specified"}
                    </strong>
                  </div>

                  <div>
                    <span>Nearest Expiry</span>
                    <strong>
                      {formatDate(
                        productDetails?.nearest_expiry_date ||
                          productDetails?.expiry_date ||
                          selectedProduct.expiry_date
                      )}
                    </strong>
                  </div>
                </div>

                {productDetailsError && (
                  <div className="product-details-warning">
                    {productDetailsError}
                  </div>
                )}

                {productDetailsLoading && (
                  <div className="product-details-loading">
                    <RefreshCw
                      size={18}
                      className="store-spin"
                    />
                    Loading complete product information...
                  </div>
                )}

                <div className="product-details-purchase">
                  <div className="product-details-quantity">
                    <span>Quantity</span>

                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setDetailQuantity((current) =>
                            Math.max(1, current - 1)
                          )
                        }
                      >
                        <Minus size={16} />
                      </button>

                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, detailStock)}
                        value={detailQuantity}
                        onChange={(event) =>
                          setDetailQuantity(
                            Math.max(
                              1,
                              Math.min(
                                Math.max(1, detailStock),
                                Number(event.target.value || 1)
                              )
                            )
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setDetailQuantity((current) =>
                            Math.min(
                              Math.max(1, detailStock),
                              current + 1
                            )
                          )
                        }
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="product-details-actions">
                    <button
                      type="button"
                      className="product-details-add"
                      onClick={addSelectedProductToCart}
                      disabled={detailStock <= 0}
                    >
                      <ShoppingCart size={18} />
                      Add to Cart
                    </button>

                    <button
                      type="button"
                      className="product-details-buy"
                      onClick={buySelectedProductNow}
                      disabled={detailStock <= 0}
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            </div>

            </div>
          </div>
      )}

      {cartOpen && (
        <div
          className="store-modal-backdrop"
          onMouseDown={() => setCartOpen(false)}
        >
          <div
            className="cart-table-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="store-modal-header">
              <div>
                <span>Shopping Cart</span>
                <h2>
                  {totalCartQuantity} selected item
                  {totalCartQuantity === 1 ? "" : "s"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setCartOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="cart-table-content">
              {cart.length === 0 ? (
                <div className="store-empty-cart">
                  <ShoppingCart size={42} />
                  <strong>Your cart is empty</strong>
                  <span>
                    Add products to begin a transaction.
                  </span>
                </div>
              ) : (
                <div className="cart-table-wrap">
                  <table className="cart-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Unit Price</th>
                        <th>Variation</th>
                        <th>Quantity</th>
                        <th>Total Price</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {cart.map((item) => (
                        <tr key={item.product_id}>
                          <td>
                            <div className="cart-product-cell">
                              <div className="cart-product-image">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.product_name}
                                  />
                                ) : (
                                  <Package size={24} />
                                )}
                              </div>

                              <div>
                                <strong>
                                  {item.product_name}
                                </strong>
                                <span className="cart-product-variant">
                                  Selected: {item.variant_label || "Standard"}
                                </span>
                                <span>
                                  SKU: {item.sku || "N/A"}
                                </span>
                                <span>
                                  {item.stock} available
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>{formatPeso(item.price)}</td>

                          <td>
                            {(() => {
                              const family =
                                getCartItemFamily(item);
                              const variants =
                                family?.variants || [];
                              const hasOtherAvailable =
                                variants.some(
                                  (variant) =>
                                    String(variant.product_id) !==
                                      String(item.product_id) &&
                                    getProductStock(variant) > 0 &&
                                    getProductPrice(variant) > 0
                                );

                              return (
                                <div className="cart-variation-cell">
                                  <button
                                    type="button"
                                    className="cart-variation-trigger"
                                    onClick={() =>
                                      openCartVariantPicker(
                                        item
                                      )
                                    }
                                    disabled={
                                      variants.length <= 1
                                    }
                                    title={
                                      variants.length > 1
                                        ? "Change size / variation"
                                        : "No other variation available"
                                    }
                                  >
                                    <span>
                                      {item.variant_label ||
                                        "Standard"}
                                    </span>

                                    {variants.length > 1 && (
                                      <ChevronDown
                                        size={14}
                                      />
                                    )}
                                  </button>

                                  {variants.length > 1 && (
                                    <button
                                      type="button"
                                      className="cart-add-another-variation"
                                      onClick={() =>
                                        openAddAnotherVariantPicker(
                                          item
                                        )
                                      }
                                      disabled={
                                        !hasOtherAvailable
                                      }
                                    >
                                      <Plus size={12} />
                                      Add another variation
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          <td>
                            <div className="store-quantity-control">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.product_id,
                                    Math.max(1, Number(item.quantity) || 1) - 1
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
                                  updateQuantity(
                                    item.product_id,
                                    event.target.value
                                  )
                                }
                                onBlur={() =>
                                  normalizeQuantity(item.product_id)
                                }
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.product_id,
                                    (Number(item.quantity) || 0) + 1
                                  )
                                }
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </td>

                          <td>
                            <strong>
                              {formatPeso(
                                Number(item.price) *
                                  Number(item.quantity)
                              )}
                            </strong>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="cart-remove-button"
                              onClick={() =>
                                removeFromCart(item.product_id)
                              }
                            >
                              <Trash2 size={16} />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="cart-table-footer">
              <button
                type="button"
                className="cart-continue-button"
                onClick={() => setCartOpen(false)}
              >
                Continue Shopping
              </button>

              <div className="cart-total-area">
                <div>
                  <span>Total ({totalCartQuantity} item(s))</span>
                  <strong>{formatPeso(subtotal)}</strong>
                </div>

                <button
                  type="button"
                  className="cart-checkout-button"
                  onClick={startCheckout}
                  disabled={cart.length === 0}
                >
                  Check Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cartVariantPicker.open && (() => {
        const currentItem = cart.find(
          (item) =>
            String(item.product_id) ===
            String(cartVariantPicker.cartProductId)
        );

        const family =
          getCartItemFamily(currentItem);

        const variants =
          family?.variants || [];

        const selectedVariant =
          variants.find(
            (variant) =>
              String(variant.product_id) ===
              String(
                cartVariantPicker.selectedProductId
              )
          ) || null;

        return (
          <div
            className="store-modal-backdrop cart-variation-backdrop"
            onMouseDown={closeCartVariantPicker}
          >
            <div
              className="cart-variation-picker"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="cart-variation-picker-header">
                <div>
                  <span>
                    {cartVariantPicker.mode === "add"
                      ? "Add Another Variation"
                      : "Variation"}
                  </span>

                  <h3>
                    {currentItem?.product_name ||
                      "Choose product size"}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={closeCartVariantPicker}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="cart-variation-picker-body">
                <div className="cart-variation-product">
                  <div className="cart-variation-product-image">
                    {currentItem?.image ? (
                      <img
                        src={currentItem.image}
                        alt={
                          currentItem.product_name ||
                          "Product"
                        }
                      />
                    ) : (
                      <Package size={28} />
                    )}
                  </div>

                  <div>
                    <strong>
                      {currentItem?.product_name}
                    </strong>
                    <span>
                      {cartVariantPicker.mode === "add"
                        ? "Choose another available size / variation to add as a separate cart item."
                        : "Choose an available size / variation."}
                    </span>
                  </div>
                </div>

                <div className="cart-variation-options">
                  {variants.map((variant) => {
                    const stock =
                      getProductStock(variant);
                    const price =
                      getProductPrice(variant);
                    const alreadyInCart =
                      cart.some(
                        (cartItem) =>
                          String(cartItem.product_id) ===
                          String(variant.product_id)
                      );

                    const disabled =
                      stock <= 0 || price <= 0;

                    const selected =
                      String(
                        cartVariantPicker.selectedProductId
                      ) ===
                      String(variant.product_id);

                    return (
                      <button
                        type="button"
                        key={variant.product_id}
                        className={`cart-variation-option${
                          selected ? " selected" : ""
                        }`}
                        disabled={disabled}
                        onClick={() =>
                          setCartVariantPicker(
                            (current) => ({
                              ...current,
                              selectedProductId:
                                variant.product_id,
                            })
                          )
                        }
                      >
                        <strong>
                          {getVariantLabel(variant)}
                        </strong>

                        <small>
                          {stock <= 0
                            ? "Out of stock"
                            : price <= 0
                            ? "Unavailable"
                            : alreadyInCart &&
                              cartVariantPicker.mode ===
                                "add"
                            ? "Already in cart • add more"
                            : `${stock} available`}
                        </small>

                        {price > 0 && (
                          <span>
                            {formatPeso(price)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {cartVariantPicker.mode === "add" &&
                  selectedVariant && (
                    <div className="cart-variation-add-quantity">
                      <span>Quantity</span>

                      <div className="store-quantity-control">
                        <button
                          type="button"
                          onClick={() =>
                            setCartVariantPicker(
                              (current) => ({
                                ...current,
                                quantity: Math.max(
                                  1,
                                  Number(
                                    current.quantity || 1
                                  ) - 1
                                ),
                              })
                            )
                          }
                        >
                          −
                        </button>

                        <input
                          type="number"
                          min="1"
                          max={Math.max(
                            1,
                            getProductStock(
                              selectedVariant
                            )
                          )}
                          value={
                            cartVariantPicker.quantity
                          }
                          onChange={(event) =>
                            setCartVariantPicker(
                              (current) => ({
                                ...current,
                                quantity: Math.max(
                                  1,
                                  Number(
                                    event.target.value ||
                                      1
                                  )
                                ),
                              })
                            )
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setCartVariantPicker(
                              (current) => ({
                                ...current,
                                quantity: Math.min(
                                  getProductStock(
                                    selectedVariant
                                  ),
                                  Number(
                                    current.quantity || 1
                                  ) + 1
                                ),
                              })
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                {selectedVariant && (
                  <div className="cart-variation-selected-info">
                    <div>
                      <span>Selected</span>
                      <strong>
                        {getVariantLabel(
                          selectedVariant
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Stock</span>
                      <strong>
                        {getProductStock(
                          selectedVariant
                        )}{" "}
                        available
                      </strong>
                    </div>

                    <div>
                      <span>Price</span>
                      <strong>
                        {formatPeso(
                          getProductPrice(
                            selectedVariant
                          )
                        )}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="cart-variation-picker-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeCartVariantPicker}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={
                    cartVariantPicker.mode === "add"
                      ? confirmAddAnotherVariant
                      : confirmCartVariant
                  }
                  disabled={
                    !selectedVariant ||
                    getProductStock(
                      selectedVariant
                    ) <= 0 ||
                    getProductPrice(
                      selectedVariant
                    ) <= 0 ||
                    (cartVariantPicker.mode === "add" &&
                      Number(
                        cartVariantPicker.quantity || 0
                      ) <= 0)
                  }
                >
                  {cartVariantPicker.mode === "add"
                    ? "Add to Cart"
                    : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {receivableRecordedOpen && (
        <div className="store-modal-backdrop">
          <div
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "min(430px, calc(100vw - 32px))",
              background: "#ffffff",
              borderRadius: "20px",
              boxShadow: "0 26px 80px rgba(15, 23, 42, 0.28)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "30px 28px 22px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "62px",
                  height: "62px",
                  margin: "0 auto 16px",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  background: "#ecfdf3",
                  color: "#16a34a",
                  fontSize: "30px",
                  fontWeight: 900,
                }}
              >
                ✓
              </div>

              <span
                style={{
                  display: "block",
                  marginBottom: "7px",
                  color: "#64748b",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Transaction Saved
              </span>

              <h2
                style={{
                  margin: 0,
                  color: "#111827",
                  fontSize: "23px",
                  lineHeight: 1.25,
                }}
              >
                Receivable Recorded
              </h2>

              <p
                style={{
                  margin: "11px 0 0",
                  color: "#64748b",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                The receivable has been recorded successfully. You can now
                view the transaction receipt.
              </p>

              <div
                style={{
                  marginTop: "20px",
                  padding: "15px 17px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    marginBottom: "9px",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "#64748b" }}>Employee</span>
                  <strong
                    style={{
                      color: "#111827",
                      textAlign: "right",
                    }}
                  >
                    {receipt?.employee_name || "—"}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    marginBottom: "9px",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "#64748b" }}>Office</span>
                  <strong
                    style={{
                      color: "#111827",
                      textAlign: "right",
                    }}
                  >
                    {receipt?.office_name || "—"}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    paddingTop: "10px",
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <span
                    style={{
                      color: "#111827",
                      fontSize: "13px",
                      fontWeight: 800,
                    }}
                  >
                    Receivable Amount
                  </span>
                  <strong
                    style={{
                      color: "#111827",
                      fontSize: "17px",
                    }}
                  >
                    {formatPeso(
                      receipt?.balance_amount ??
                        receipt?.receivable_balance_amount ??
                        total
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "0 28px 27px",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setReceivableRecordedOpen(false);
                  setReceiptOpen(true);
                }}
                style={{
                  width: "100%",
                  minHeight: "46px",
                }}
              >
                View Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentConfirmOpen && (
        <div
          className="store-modal-backdrop"
          onMouseDown={() => {
            if (!processing) {
              setPaymentConfirmOpen(false);
            }
          }}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "min(430px, calc(100vw - 32px))",
              background: "#ffffff",
              borderRadius: "18px",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.24)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "24px 26px 18px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  display: "block",
                  marginBottom: "6px",
                  color: "#b77900",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Payment Confirmation
              </span>

              <h2
                style={{
                  margin: 0,
                  color: "#111827",
                  fontSize: "22px",
                  lineHeight: 1.25,
                }}
              >
                Confirm this transaction?
              </h2>

              <p
                style={{
                  margin: "10px 0 0",
                  color: "#64748b",
                  fontSize: "13px",
                  lineHeight: 1.55,
                }}
              >
                Review the order and payment details. If cash change is due,
                it is shown below. Confirm once to record the sale and open the receipt.
              </p>
            </div>

            <div style={{ padding: "20px 26px" }}>
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  padding: "14px 16px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "#64748b" }}>Items</span>
                  <strong style={{ color: "#111827" }}>
                    {totalCartQuantity}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "#64748b" }}>Payment</span>
                  <strong style={{ color: "#111827" }}>
                    {paymentType === "Receivable"
                      ? "Receivable"
                      : paymentMethod}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    paddingTop: "10px",
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <span
                    style={{
                      color: "#111827",
                      fontSize: "14px",
                      fontWeight: 800,
                    }}
                  >
                    Total
                  </span>
                  <strong
                    style={{
                      color: "#111827",
                      fontSize: "18px",
                    }}
                  >
                    {formatPeso(total)}
                  </strong>
                </div>
                {paymentType === "Cash" &&
                  paymentMethod === "Cash" &&
                  change > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        paddingTop: "10px",
                        borderTop: "1px solid #e5e7eb",
                        fontSize: "13px",
                      }}
                    >
                      <span
                        style={{
                          color: "#64748b",
                          fontWeight: 700,
                        }}
                      >
                        Change to Give
                      </span>

                      <strong
                        style={{
                          color: "#9a6d00",
                          fontSize: "16px",
                        }}
                      >
                        {formatPeso(change)}
                      </strong>
                    </div>
                  )}

              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                padding: "0 26px 24px",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPaymentConfirmOpen(false)}
                disabled={processing}
                style={{ minHeight: "44px" }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={processing}
                onClick={() => {
                  setPaymentConfirmOpen(false);
                  completeSale();
                }}
                style={{ minHeight: "44px" }}
              >
                {processing ? "Processing..." : "Confirm & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div
          className="store-modal-backdrop"
          onMouseDown={() =>
            !processing && setCheckoutOpen(false)
          }
        >
          <div
            className="store-checkout-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="store-modal-header">
              <div>
                <span>Checkout</span>
                <h2>Complete Payment</h2>
              </div>

              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                disabled={processing}
              >
                <X size={20} />
              </button>
            </div>

            <div className="store-checkout-layout">
              <div className="store-checkout-form">
                <div className="store-form-section store-checkout-person-section">
                  <div className="store-checkout-section-heading">
                    <div className="store-checkout-section-number">01</div>
                    <div>
                      <h3>
                        {paymentType === "Receivable"
                          ? "Employee Details"
                          : "Customer Details"}
                      </h3>
                      <p>
                        {paymentType === "Receivable"
                          ? "Identify the employee and office responsible for this receivable."
                          : "Enter the customer information for this transaction."}
                      </p>
                    </div>
                  </div>
                  <h3 className="store-checkout-legacy-heading">
                    {paymentType === "Receivable"
                      ? "Employee Information"
                      : "Customer Information"}
                  </h3>

                  {paymentType === "Receivable" ? (
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
                          placeholder="Enter employee name"
                          required
                        />
                      </label>

                      <label>
                        <span>Office / Department</span>
                        <select
                          value={officeName}
                          onChange={(event) => {
                            const value =
                              event.target.value;

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
                    </>
                  ) : (
                    <label>
                      <span>Customer Name</span>
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
                  )}

                </div>

                <div className="store-form-section store-checkout-payment-section">
                  <div className="store-checkout-section-heading">
                    <div className="store-checkout-section-number">02</div>
                    <div>
                      <h3>{paymentType === "Receivable" ? "Receivable Details" : "Payment Details"}</h3>
                      <p>
                        {paymentType === "Receivable"
                          ? "The full discounted total will be recorded as an unpaid receivable."
                          : "Choose how this transaction will be paid and recorded."}
                      </p>
                    </div>
                  </div>
                  <h3 className="store-checkout-legacy-heading">Payment Information</h3>

                  <div className="store-payment-grid">
                    <label className="payment-method-field">
                      <span>Payment Type</span>
                      <select
                        value={paymentType}
                        onChange={(event) => {
                          const nextType =
                            event.target.value;

                          setPaymentType(nextType);
                          setCashAmount("");
                          setPaymentMethod("Cash");
                          setPaymentReference("");
                          setReceivableNotes("");

                          if (nextType === "Cash") {
                            setEmployeeName("");
                            setOfficeName("");
                            setCustomOfficeName("");
                          }
                        }}
                      >
                        <option value="Cash">
                          Full Payment
                        </option>
                        <option value="Receivable">
                          Employee Receivable
                        </option>
                      </select>
                    </label>

                    {paymentType === "Cash" && (
                      <label className="payment-method-field">
                        <span>Payment Method</span>
                        <select
                          value={paymentMethod}
                          onChange={(event) => {
                            const nextMethod =
                              event.target.value;

                            setPaymentMethod(nextMethod);
                            setPaymentReference("");

                            if (
                              nextMethod !== "Cash"
                            ) {
                              setCashAmount("");
                            }
                          }}
                        >
                          <option value="Cash">Cash</option>
                          <option value="GCash">GCash</option>
                          <option value="Maya">Maya</option>
                          <option value="Bank Transfer">
                            Bank Transfer
                          </option>
                          <option value="Other">Other</option>
                        </select>
                      </label>
                    )}

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

                    {paymentType === "Cash" && (
                      paymentMethod !== "Cash" ? (
                        <label>
                          <span>Amount Paid</span>
                          <input
                            type="text"
                            value={formatPeso(total)}
                            disabled
                          />
                        </label>
                      ) : (
                        <label>
                          <span>Cash Amount</span>
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
                      )
                    )}

                    {paymentType === "Cash" &&
                      paymentMethod !== "Cash" && (
                        <label className="payment-method-field">
                          <span>
                            {paymentMethod} Reference No.
                          </span>
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(event) =>
                              setPaymentReference(
                                event.target.value
                              )
                            }
                            placeholder="Enter transaction reference"
                          />
                        </label>
                      )}

                    {requiresReceivable && (
                      <>
                        <div className="store-receivable-record-note">
                          <strong>
                            No initial payment required
                          </strong>
                          <span>
                            The full transaction total will be recorded as an unpaid employee receivable. Payment can be recorded later from the Receivables module.
                          </span>
                        </div>

                        <label>
                          <span>Receivable Amount</span>
                          <input
                            type="text"
                            value={formatPeso(
                              remainingBalance
                            )}
                            disabled
                          />
                        </label>

                        <label className="payment-method-field">
                          <span>Receivable Notes</span>
                          <textarea
                            value={receivableNotes}
                            onChange={(event) =>
                              setReceivableNotes(
                                event.target.value
                              )
                            }
                            placeholder="Optional notes for the employee receivable"
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                <div className="store-cashier store-checkout-processed-by">
                  <div className="store-processed-label">Processed by</div>
                  <span>Cashier</span>
                  <strong>
                    {user?.full_name || "Not signed in"}
                  </strong>
                  <small>{role || "No role"}</small>
                </div>
              </div>

              <div className="store-order-summary store-order-summary-professional">
                <div className="store-summary-heading">
                  <div>
                    <span>Transaction Summary</span>
                    <h3>Order Summary</h3>
                  </div>
                  <div className="store-summary-count">{totalCartQuantity} item(s)</div>
                </div>

                <div className="store-summary-items">
                  {cart.map((item) => (
                    <div key={item.product_id}>
                      <span>
                        {item.quantity} × {item.product_name}
                        {item.variant_label
                          ? ` — ${item.variant_label}`
                          : ""}
                      </span>

                      <strong>
                        {formatPeso(
                          Number(item.price) *
                            Number(item.quantity)
                        )}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="store-summary-totals">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatPeso(subtotal)}</strong>
                  </div>

                  <div>
                    <span>Discount</span>
                    <strong>
                      -{formatPeso(discountAmount)}
                    </strong>
                  </div>

                  <div className="grand">
                    <span>Total</span>
                    <strong>{formatPeso(total)}</strong>
                  </div>

                  <div className="store-summary-line">
                    <span>Payment Type</span>
                    <strong>
                      {paymentType === "Cash"
                        ? "Full Payment"
                        : "Employee Receivable"}
                    </strong>
                  </div>

                  <div className="store-summary-line">
                    <span>
                      {paymentType === "Receivable"
                        ? "Recording"
                        : "Payment Method"}
                    </span>
                    <strong>
                      {paymentType === "Receivable"
                        ? "Receivables"
                        : paymentMethod}
                    </strong>
                  </div>

                  {paymentType === "Cash" &&
                  paymentMethod === "Cash" ? (
                    <>
                      <div className="store-summary-line">
                        <span>Cash</span>
                        <strong>
                          {formatPeso(enteredPayment)}
                        </strong>
                      </div>

                      <div className="store-summary-line">
                        <span>Change</span>
                        <strong>
                          {formatPeso(change)}
                        </strong>
                      </div>
                    </>
                  ) : requiresReceivable ? (
                    <>
                      <div className="store-summary-line">
                        <span>Employee</span>
                        <strong>
                          {employeeName || "—"}
                        </strong>
                      </div>

                      <div className="store-summary-line">
                        <span>Office / Department</span>
                        <strong>
                          {resolvedOfficeName || "—"}
                        </strong>
                      </div>

                      <div className="store-summary-line">
                        <span>Amount Recorded</span>
                        <strong>
                          {formatPeso(remainingBalance)}
                        </strong>
                      </div>

                      <div className="store-summary-line">
                        <span>Receivable Status</span>
                        <strong>Unpaid</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="store-summary-line">
                        <span>Paid</span>
                        <strong>{formatPeso(total)}</strong>
                      </div>

                      <div className="store-summary-line">
                        <span>Reference</span>
                        <strong>
                          {paymentReference.trim() || "—"}
                        </strong>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  className="store-complete-sale"
                  onClick={completeSale}
                  disabled={processing}
                >
                  {processing
                    ? "Processing Sale..."
                    : "Confirm Sale"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {receiptOpen && receipt && (
        <div className="store-modal-backdrop">
          <div className="store-receipt-modal">
            <div className="store-receipt">
              <div className="store-receipt-logo">
                <img
                  src={bacnotanLogo}
                  alt="Municipality of Bacnotan"
                />
              </div>

              <div className="store-receipt-government">
                <h2>MUNICIPALITY OF BACNOTAN</h2>
                <p>Province of La Union</p>
              </div>

              <h3>ACKNOWLEDGEMENT RECEIPT</h3>

              <div className="store-receipt-number">
                NO. {receipt.transaction_code}
              </div>

              <div className="store-receipt-divider"></div>

              <div className="store-receipt-info">
                <div>
                  <span>Date and Time</span>
                  <strong>
                    {formatDateTime(
                      receipt.transaction_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    {receipt.payment_type === "Receivable"
                      ? "Employee"
                      : "Customer"}
                  </span>
                  <strong>
                    {receipt.payment_type === "Receivable"
                      ? receipt.employee_name ||
                        receipt.customer_name
                      : receipt.customer_name}
                  </strong>
                </div>

                {receipt.payment_type === "Receivable" && (
                  <div>
                    <span>Office / Department</span>
                    <strong>
                      {receipt.office_name ||
                        "Not specified"}
                    </strong>
                  </div>
                )}

                <div>
                  <span>Payment Type</span>
                  <strong>
                    {receipt.payment_type === "Receivable"
                      ? "Employee Receivable"
                      : "Full Payment"}
                  </strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>
                    {receipt.transaction_status || "Completed"}
                  </strong>
                </div>
              </div>

              <div className="store-receipt-divider"></div>

              <table className="store-receipt-items">
                <thead>
                  <tr>
                    <th>QTY</th>
                    <th>ITEM</th>
                    <th>PRICE</th>
                    <th>TOTAL</th>
                  </tr>
                </thead>

                <tbody>
                  {(receipt.items || []).map((item) => (
                    <tr key={item.item_id}>
                      <td>{item.quantity}</td>
                      <td>
                        {item.product_name}
                        {item.variant_label
                          ? ` — ${item.variant_label}`
                          : ""}
                      </td>
                      <td>{formatPeso(item.price)}</td>
                      <td>{formatPeso(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="store-receipt-divider"></div>

              <div className="store-receipt-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>
                    {formatPeso(receipt.subtotal_amount)}
                  </strong>
                </div>

                <div>
                  <span>
                    Discount (
                    {Number(
                      receipt.discount_percent || 0
                    ).toFixed(2)}
                    %)
                  </span>

                  <strong>
                    -{formatPeso(receipt.discount)}
                  </strong>
                </div>

                <div className="grand">
                  <span>Grand Total</span>
                  <strong>
                    {formatPeso(receipt.total_amount)}
                  </strong>
                </div>

                <div>
                  <span>{receipt.payment_type === "Receivable" ? "Recording" : "Payment Method"}</span>
                  <strong>
                    {receipt.payment_type === "Receivable"
                      ? "Receivables"
                      : receipt.payment_method || "Cash"}
                  </strong>
                </div>

                {receipt.payment_type ===
                "Receivable" ? (
                  <>

                    <div>
                      <span>Remaining Balance</span>
                      <strong>
                        {formatPeso(
                          receipt.receivable_balance_amount ??
                            receipt.balance_amount ??
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
                      </strong>
                    </div>

                    {receipt.payment_method !== "Cash" && (
                      <div>
                        <span>Reference No.</span>
                        <strong>
                          {receipt.payment_reference ||
                            "N/A"}
                        </strong>
                      </div>
                    )}
                  </>
                ) : (receipt.payment_method || "Cash") ===
                  "Cash" ? (
                  <>
                    <div>
                      <span>Cash</span>
                      <strong>
                        {formatPeso(
                          receipt.payment_amount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Change</span>
                      <strong>
                        {formatPeso(
                          receipt.change_amount
                        )}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div>
                    <span>Reference No.</span>
                    <strong>
                      {receipt.payment_reference ||
                        "N/A"}
                    </strong>
                  </div>
                )}
              </div>

              <div className="store-receipt-divider"></div>

              <div className="store-receipt-signatures">
                <div>
                  <span>Prepared By</span>
                  <strong>
                    {receipt.prepared_by ||
                      receipt.cashier_name}
                  </strong>
                </div>

                <div>
                  <span>Received By</span>
                  <strong>
                    {receipt.received_by ||
                      receipt.customer_name}
                  </strong>
                </div>
              </div>

              <div className="store-receipt-system">
                <strong>HiveSync Business System</strong>
                <span>Thank you for visiting!</span>
              </div>
            </div>

            <div className="store-receipt-actions no-print">
              <button
                type="button"
                className="store-receipt-print"
                onClick={printReceipt}
              >
                <Printer size={18} />
                Print Receipt
              </button>

              <button
                type="button"
                className="store-receipt-close"
                onClick={() => setReceiptOpen(false)}
              >
                <X size={18} />
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {notice.open && (
        <div
          className="store-modal-backdrop"
          onMouseDown={() =>
            setNotice({
              open: false,
              title: "",
              message: "",
            })
          }
        >
          <div
            className="store-notice"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div>
              <Package size={28} />
            </div>

            <h3>{notice.title}</h3>
            <p>{notice.message}</p>

            <button
              type="button"
              onClick={() =>
                setNotice({
                  open: false,
                  title: "",
                  message: "",
                })
              }
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;
