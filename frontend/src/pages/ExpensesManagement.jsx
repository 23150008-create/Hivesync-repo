import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Archive,
  CalendarDays,
  Edit3,
  Eye,
  FileText,
  Loader2,
  Package,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from "lucide-react";

import "../styles/expenses.css";

const API_BASE =
  "http://localhost/HiveSync/backend/expense_management";

const AUDIT_URL =
  "http://localhost/HiveSync/backend/audit_trail/log_action.php";

const EMPTY_SUMMARY = {
  total_records: 0,
  total_expenses: 0,
  today_expenses: 0,
  month_expenses: 0,
  packaging_expenses: 0,
  printing_expenses: 0,
  other_expenses: 0,
};

const MATERIAL_PRESETS = {
  Packaging: [
    "Plastic Bag - Small",
    "Plastic Bag - Medium",
    "Plastic Bag - Large",
    "Paper Bag",
    "Packaging Box",
    "Food Container",
    "Bubble Wrap",
    "Tape",
    "Label Sticker",
    "Wrapping Material",
    "Other Packaging Material",
  ],
  Printing: [
    "Coupon Bond - A4",
    "Coupon Bond - Short",
    "Coupon Bond - Long",
    "Receipt Paper",
    "Thermal Paper",
    "Printer Ink",
    "Printer Toner",
    "Other Printing Material",
  ],
  "Office Supplies": [
    "Ballpen",
    "Marker",
    "Notebook",
    "Folder",
    "Envelope",
    "Other Office Supply",
  ],
  "Cleaning Supplies": [
    "Alcohol",
    "Soap",
    "Detergent",
    "Tissue",
    "Trash Bag",
    "Other Cleaning Supply",
  ],
  Utilities: [
    "Electricity",
    "Water",
    "Internet",
    "Other Utility Expense",
  ],
  Transportation: [
    "Fuel",
    "Fare",
    "Delivery Transportation",
    "Other Transportation Expense",
  ],
  Maintenance: [
    "Equipment Repair",
    "Facility Repair",
    "Vehicle Maintenance",
    "Other Maintenance Expense",
  ],
  Marketing: [
    "Tarpaulin",
    "Flyers",
    "Brochure",
    "Other Marketing Expense",
  ],
  Miscellaneous: ["Other Operating Expense"],
  Other: ["Other Operating Expense"],
};

const UNIT_OPTIONS = [
  "piece",
  "sheet",
  "roll",
  "pack",
  "box",
  "ream",
  "bottle",
  "set",
];

const getToday = () => new Date().toISOString().split("T")[0];

const createEmptyForm = (user) => ({
  expense_id: "",
  expense_category: "Packaging",
  material_name: "Plastic Bag - Small",
  quantity: "1",
  unit: "piece",
  unit_cost: "",
  related_module: "Manual",
  reference_id: "",
  reference_code: "",
  reference_description: "",
  expense_date: getToday(),
  recorded_by: user?.user_id || user?.id || "",
  recorded_by_name:
    user?.full_name ||
    user?.name ||
    user?.username ||
    "System User",
  remarks: "",
});

const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

function ExpensesManagement({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [references, setReferences] = useState([]);

  const [loading, setLoading] = useState(true);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const [messageModal, setMessageModal] = useState({
    type: "success",
    title: "",
    message: "",
  });

  const [form, setForm] = useState(createEmptyForm(user));

  const computedTotal = useMemo(() => {
    const quantity = Number(form.quantity || 0);
    const unitCost = Number(form.unit_cost || 0);

    return quantity * unitCost;
  }, [form.quantity, form.unit_cost]);

  const showMessage = useCallback((type, title, message) => {
    setMessageModal({ type, title, message });
    setShowMessageModal(true);
  }, []);

  const logExpenseAction = useCallback(
    async (action, details) => {
      try {
        await axios.post(
          AUDIT_URL,
          {
            user_id: user?.user_id || user?.id || null,
            user_name:
              user?.full_name ||
              user?.name ||
              user?.username ||
              "System User",
            module: "Expenses",
            action,
            details,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      } catch (error) {
        console.error("Expense audit log error:", error);
      }
    },
    [user]
  );

  const loadExpenses = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        search: search.trim(),
        category: categoryFilter,
        module: moduleFilter,
        date_from: dateFrom,
        date_to: dateTo,
      };

      const response = await axios.get(`${API_BASE}/get_expenses.php`, {
        params,
      });

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || "Unable to load expense records."
        );
      }

      setExpenses(response.data.expenses || []);
      setSummary(response.data.summary || EMPTY_SUMMARY);
    } catch (error) {
      setExpenses([]);
      setSummary(EMPTY_SUMMARY);

      showMessage(
        "error",
        "Unable to Load Expenses",
        error.response?.data?.message ||
          error.message ||
          "The expense records could not be retrieved."
      );
    } finally {
      setLoading(false);
    }
  }, [
    categoryFilter,
    dateFrom,
    dateTo,
    moduleFilter,
    search,
    showMessage,
  ]);

  const loadReferences = useCallback(
    async (moduleName) => {
      if (!["POS", "Delivery"].includes(moduleName)) {
        setReferences([]);
        return;
      }

      setReferencesLoading(true);

      try {
        const response = await axios.get(
          `${API_BASE}/get_reference_transactions.php`,
          {
            params: {
              module: moduleName,
            },
          }
        );

        if (!response.data?.success) {
          throw new Error(
            response.data?.message ||
              "Unable to load transaction references."
          );
        }

        setReferences(response.data.references || []);
      } catch (error) {
        setReferences([]);

        showMessage(
          "error",
          "Unable to Load References",
          error.response?.data?.message ||
            error.message ||
            "Related transactions could not be retrieved."
        );
      } finally {
        setReferencesLoading(false);
      }
    },
    [showMessage]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadExpenses();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadExpenses]);

  const resetForm = () => {
    setForm(createEmptyForm(user));
    setEditingExpense(null);
    setReferences([]);
  };

  const openAddModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = async (expense) => {
    setEditingExpense(expense);

    setForm({
      expense_id: expense.expense_id,
      expense_category: expense.expense_category || "Packaging",
      material_name: expense.material_name || "",
      quantity: String(expense.quantity || 1),
      unit: expense.unit || "piece",
      unit_cost: String(expense.unit_cost || ""),
      related_module: expense.related_module || "Manual",
      reference_id: expense.reference_id || "",
      reference_code: expense.reference_code || "",
      reference_description: expense.reference_description || "",
      expense_date: expense.expense_date || getToday(),
      recorded_by:
        expense.recorded_by || user?.user_id || user?.id || "",
      recorded_by_name:
        expense.recorded_by_name ||
        user?.full_name ||
        user?.name ||
        "System User",
      remarks: expense.remarks || "",
    });

    if (["POS", "Delivery"].includes(expense.related_module)) {
      await loadReferences(expense.related_module);
    } else {
      setReferences([]);
    }

    setShowFormModal(true);
  };

  const openViewModal = (expense) => {
    setViewingExpense(expense);
    setShowViewModal(true);
  };

  const openArchiveModal = (expense) => {
    setArchiveTarget(expense);
    setShowArchiveModal(true);
  };

  const closeFormModal = () => {
    if (saving) return;

    setShowFormModal(false);
    resetForm();
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCategoryChange = (event) => {
    const category = event.target.value;
    const materials = MATERIAL_PRESETS[category] || [];

    setForm((current) => ({
      ...current,
      expense_category: category,
      material_name: materials[0] || "",
    }));
  };

  const handleModuleChange = async (event) => {
    const relatedModule = event.target.value;

    setForm((current) => ({
      ...current,
      related_module: relatedModule,
      reference_id: "",
      reference_code: "",
      reference_description: "",
    }));

    await loadReferences(relatedModule);
  };

  const handleReferenceChange = (event) => {
    const selectedId = event.target.value;

    const selectedReference = references.find(
      (reference) =>
        String(reference.reference_id) === String(selectedId)
    );

    setForm((current) => ({
      ...current,
      reference_id: selectedReference?.reference_id || "",
      reference_code: selectedReference?.reference_code || "",
      reference_description:
        selectedReference?.reference_description || "",
    }));
  };

  const validateForm = () => {
    if (!form.material_name.trim()) {
      showMessage(
        "error",
        "Expense Name Required",
        "Select or enter the expense name."
      );
      return false;
    }

    if (Number(form.quantity) <= 0) {
      showMessage(
        "error",
        "Invalid Quantity",
        "Quantity must be greater than zero."
      );
      return false;
    }

    if (Number(form.unit_cost) < 0 || form.unit_cost === "") {
      showMessage(
        "error",
        "Invalid Unit Cost",
        "Enter a valid unit cost."
      );
      return false;
    }

    if (!form.expense_date) {
      showMessage(
        "error",
        "Date Required",
        "Select the date when the expense was incurred."
      );
      return false;
    }

    if (form.expense_date > getToday()) {
      showMessage(
        "error",
        "Invalid Expense Date",
        "Expense date cannot be in the future."
      );
      return false;
    }

    if (
      ["POS", "Delivery"].includes(form.related_module) &&
      !form.reference_id
    ) {
      showMessage(
        "error",
        "Transaction Required",
        `Select the related ${form.related_module} transaction.`
      );
      return false;
    }

    return true;
  };

  const saveExpense = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    try {
      const endpoint = editingExpense
        ? "update_expense.php"
        : "add_expense.php";

      const payload = {
        ...form,
        quantity: Number(form.quantity),
        unit_cost: Number(form.unit_cost),
        recorded_by:
          form.recorded_by || user?.user_id || user?.id || null,
        recorded_by_name:
          form.recorded_by_name ||
          user?.full_name ||
          user?.name ||
          "System User",
      };

      const response = await axios.post(
        `${API_BASE}/${endpoint}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || "Unable to save the expense."
        );
      }

      const savedExpenseNo =
        response.data?.expense_no ||
        editingExpense?.expense_no ||
        form.expense_id;

      await logExpenseAction(
        editingExpense ? "Updated Expense" : "Added Expense",
        `${
          editingExpense ? "Updated" : "Added"
        } expense ${savedExpenseNo}: ${form.material_name} (${money(
          computedTotal
        )}).`
      );

      closeFormModal();
      await loadExpenses();

      showMessage(
        "success",
        editingExpense ? "Expense Updated" : "Expense Recorded",
        response.data.message
      );
    } catch (error) {
      showMessage(
        "error",
        "Unable to Save Expense",
        error.response?.data?.message ||
          error.message ||
          "The expense record could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const archiveExpense = async () => {
    if (!archiveTarget?.expense_id) return;

    setArchiving(true);

    try {
      const response = await axios.post(
        `${API_BASE}/archive_expense.php`,
        {
          expense_id: archiveTarget.expense_id,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
            "Unable to archive the expense record."
        );
      }

      await logExpenseAction(
        "Archived Expense",
        `Archived expense ${archiveTarget.expense_no}: ${archiveTarget.material_name}.`
      );

      setShowArchiveModal(false);
      setArchiveTarget(null);

      await loadExpenses();

      showMessage(
        "success",
        "Expense Archived",
        response.data.message
      );
    } catch (error) {
      showMessage(
        "error",
        "Unable to Archive Expense",
        error.response?.data?.message ||
          error.message ||
          "The expense record could not be archived."
      );
    } finally {
      setArchiving(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("All");
    setModuleFilter("All");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <main className="expenses-page">
      <section className="expenses-page-heading">
        <div>
          <p className="expenses-eyebrow">OPERATING EXPENSES</p>

          <h1>Expenses Management</h1>

          <p>
            Record packaging, printing, utilities, transportation, maintenance,
            and other operating expenses.
          </p>
        </div>

        <div className="expenses-heading-actions">
          <button
            type="button"
            className="expenses-secondary-button"
            onClick={loadExpenses}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={loading ? "expenses-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="expenses-primary-button"
            onClick={openAddModal}
          >
            <Plus size={18} />
            Record Expense
          </button>
        </div>
      </section>

      <section className="expenses-information-banner">
        <div className="expenses-information-icon">
          <Package size={20} />
        </div>

        <div>
          <strong>Expenses are recorded independently from sellable inventory.</strong>
          <p>
            These records do not increase or deduct product stock. POS and
            Delivery references can be reused to prevent duplicate typing.
          </p>
        </div>
      </section>

      <section className="expenses-summary-grid">
        <article className="expenses-summary-card">
          <div className="expenses-summary-icon gold">
            <WalletCards size={21} />
          </div>

          <div>
            <span>Total Expenses</span>
            <strong>{money(summary.total_expenses)}</strong>
            <small>{summary.total_records || 0} record(s)</small>
          </div>
        </article>

        <article className="expenses-summary-card">
          <div className="expenses-summary-icon green">
            <CalendarDays size={21} />
          </div>

          <div>
            <span>Today</span>
            <strong>{money(summary.today_expenses)}</strong>
            <small>Expenses recorded today</small>
          </div>
        </article>

        <article className="expenses-summary-card">
          <div className="expenses-summary-icon blue">
            <ReceiptText size={21} />
          </div>

          <div>
            <span>This Month</span>
            <strong>{money(summary.month_expenses)}</strong>
            <small>Monthly operating expenses</small>
          </div>
        </article>

        <article className="expenses-summary-card">
          <div className="expenses-summary-icon orange">
            <Package size={21} />
          </div>

          <div>
            <span>Packaging</span>
            <strong>{money(summary.packaging_expenses)}</strong>
            <small>Plastic and packaging materials</small>
          </div>
        </article>

        <article className="expenses-summary-card">
          <div className="expenses-summary-icon purple">
            <Printer size={21} />
          </div>

          <div>
            <span>Printing</span>
            <strong>{money(summary.printing_expenses)}</strong>
            <small>Paper and printing materials</small>
          </div>
        </article>

        <article className="expenses-summary-card">
          <div className="expenses-summary-icon slate">
            <FileText size={21} />
          </div>

          <div>
            <span>Other Operating</span>
            <strong>{money(summary.other_expenses)}</strong>
            <small>All other active expense categories</small>
          </div>
        </article>
      </section>

      <section className="expenses-records-card">
        <div className="expenses-filter-row">
          <label className="expenses-search-box">
            <Search size={17} />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search expense number, material, or transaction..."
            />
          </label>

          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value)
            }
          >
            <option value="All">All Categories</option>
            <option value="Packaging">Packaging</option>
            <option value="Printing">Printing</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Cleaning Supplies">Cleaning Supplies</option>
            <option value="Utilities">Utilities</option>
            <option value="Transportation">Transportation</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Marketing">Marketing</option>
            <option value="Miscellaneous">Miscellaneous</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
          >
            <option value="All">All Sources</option>
            <option value="POS">POS</option>
            <option value="Delivery">Delivery</option>
            <option value="Reports">Reports</option>
            <option value="Manual">Manual</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="Date from"
          />

          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="Date to"
          />

          <button
            type="button"
            className="expenses-clear-button"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        <div className="expenses-table-wrapper">
          <table className="expenses-table">
            <thead>
              <tr>
                <th>Expense No.</th>
                <th>Material</th>
                <th>Source</th>
                <th>Reference</th>
                <th>Quantity</th>
                <th>Unit Cost</th>
                <th>Total</th>
                <th>Date Used</th>
                <th>Recorded By</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10">
                    <div className="expenses-table-state">
                      <Loader2
                        size={28}
                        className="expenses-spin"
                      />
                      <strong>Loading expense records...</strong>
                    </div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="10">
                    <div className="expenses-table-state">
                      <WalletCards size={35} />
                      <strong>No expense records found</strong>
                      <span>
                        Record an operating expense to begin.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.expense_id}>
                    <td>
                      <strong className="expenses-number">
                        {expense.expense_no}
                      </strong>
                    </td>

                    <td>
                      <div className="expenses-material-cell">
                        <span
                          className={`expenses-material-icon ${expense.expense_category.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {expense.expense_category === "Printing" ? (
                            <Printer size={16} />
                          ) : (
                            <Package size={16} />
                          )}
                        </span>

                        <div>
                          <strong>{expense.material_name}</strong>
                          <small>{expense.expense_category}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="expenses-source-badge">
                        {expense.related_module}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {expense.reference_code || "No reference"}
                      </strong>
                    </td>

                    <td>
                      {Number(expense.quantity || 0).toLocaleString(
                        "en-PH"
                      )}{" "}
                      {expense.unit}
                    </td>

                    <td>{money(expense.unit_cost)}</td>

                    <td>
                      <strong>{money(expense.total_cost)}</strong>
                    </td>

                    <td>{formatDate(expense.expense_date)}</td>

                    <td>{expense.recorded_by_name}</td>

                    <td>
                      <div className="expenses-row-actions">
                        <button
                          type="button"
                          title="View expense"
                          onClick={() => openViewModal(expense)}
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          title="Edit expense"
                          onClick={() => openEditModal(expense)}
                        >
                          <Edit3 size={16} />
                        </button>

                        <button
                          type="button"
                          className="danger"
                          title="Archive expense"
                          onClick={() => openArchiveModal(expense)}
                        >
                          <Archive size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showFormModal && (
        <div className="expenses-modal-overlay">
          <section className="expenses-form-modal">
            <header className="expenses-modal-header">
              <div className="expenses-modal-title">
                <span>
                  {editingExpense ? (
                    <Edit3 size={20} />
                  ) : (
                    <Plus size={20} />
                  )}
                </span>

                <div>
                  <h2>
                    {editingExpense
                      ? "Edit Expense Record"
                      : "Record Material Expense"}
                  </h2>

                  <p>
                    Record operating expenses without
                    retyping connected transaction information.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="expenses-modal-close"
                onClick={closeFormModal}
              >
                <X size={21} />
              </button>
            </header>

            <form
              className="expenses-form-content"
              onSubmit={saveExpense}
            >
              <section className="expenses-form-section">
                <div className="expenses-section-heading">
                  <Package size={18} />

                  <div>
                    <h3>Expense Information</h3>
                    <p>
                      Select the operating expense that was incurred.
                    </p>
                  </div>
                </div>

                <div className="expenses-form-grid">
                  <label>
                    Expense Category <em>*</em>

                    <select
                      name="expense_category"
                      value={form.expense_category}
                      onChange={handleCategoryChange}
                    >
                      <option value="Packaging">Packaging</option>
                      <option value="Printing">Printing</option>
                      <option value="Office Supplies">Office Supplies</option>
                      <option value="Cleaning Supplies">Cleaning Supplies</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Transportation">Transportation</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Miscellaneous">Miscellaneous</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label>
                    Expense Name <em>*</em>

                    <select
                      name="material_name"
                      value={form.material_name}
                      onChange={handleFieldChange}
                    >
                      {(
                        MATERIAL_PRESETS[form.expense_category] || []
                      ).map((material) => (
                        <option key={material} value={material}>
                          {material}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Quantity <em>*</em>

                    <input
                      type="number"
                      name="quantity"
                      min="0.01"
                      step="0.01"
                      value={form.quantity}
                      onChange={handleFieldChange}
                    />
                  </label>

                  <label>
                    Unit <em>*</em>

                    <select
                      name="unit"
                      value={form.unit}
                      onChange={handleFieldChange}
                    >
                      {UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Unit Cost <em>*</em>

                    <div className="expenses-money-input">
                      <span>₱</span>

                      <input
                        type="number"
                        name="unit_cost"
                        min="0"
                        step="0.01"
                        value={form.unit_cost}
                        onChange={handleFieldChange}
                        placeholder="0.00"
                      />
                    </div>
                  </label>

                  <div className="expenses-computed-total">
                    <span>Total Expense</span>
                    <strong>{money(computedTotal)}</strong>
                    <small>
                      Quantity × unit cost, calculated automatically
                    </small>
                  </div>
                </div>
              </section>

              <section className="expenses-form-section">
                <div className="expenses-section-heading">
                  <ReceiptText size={18} />

                  <div>
                    <h3>Connected Transaction</h3>
                    <p>
                      Link the expense to POS or Delivery without
                      re-entering transaction details.
                    </p>
                  </div>
                </div>

                <div className="expenses-form-grid">
                  <label>
                    Related Module <em>*</em>

                    <select
                      name="related_module"
                      value={form.related_module}
                      onChange={handleModuleChange}
                    >
                      <option value="Manual">Manual Record</option>
                      <option value="POS">Point of Sale</option>
                      <option value="Delivery">Delivery</option>
                      <option value="Reports">Reports</option>
                    </select>
                  </label>

                  {["POS", "Delivery"].includes(
                    form.related_module
                  ) ? (
                    <label>
                      Related Transaction <em>*</em>

                      <select
                        value={form.reference_id}
                        onChange={handleReferenceChange}
                        disabled={referencesLoading}
                      >
                        <option value="">
                          {referencesLoading
                            ? "Loading transactions..."
                            : "Select transaction"}
                        </option>

                        {references.map((reference) => (
                          <option
                            key={`${reference.related_module}-${reference.reference_id}`}
                            value={reference.reference_id}
                          >
                            {reference.reference_code} —{" "}
                            {reference.reference_description}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label>
                      Reference Description

                      <input
                        type="text"
                        name="reference_description"
                        value={form.reference_description}
                        onChange={handleFieldChange}
                        placeholder="Optional manual reference"
                      />
                    </label>
                  )}

                  {form.reference_code && (
                    <div className="expenses-reference-preview span-2">
                      <ReceiptText size={18} />

                      <div>
                        <span>Selected Transaction</span>
                        <strong>{form.reference_code}</strong>
                        <p>{form.reference_description}</p>
                      </div>
                    </div>
                  )}

                  <label>
                    Expense Date <em>*</em>

                    <input
                      type="date"
                      name="expense_date"
                      max={getToday()}
                      value={form.expense_date}
                      onChange={handleFieldChange}
                    />
                  </label>

                  <label>
                    Recorded By

                    <input
                      type="text"
                      value={form.recorded_by_name}
                      readOnly
                    />
                  </label>

                  <label className="span-2">
                    Remarks

                    <textarea
                      name="remarks"
                      value={form.remarks}
                      onChange={handleFieldChange}
                      placeholder="Optional details about how the material was used"
                    />
                  </label>
                </div>
              </section>

              <footer className="expenses-modal-actions">
                <button
                  type="button"
                  className="expenses-danger-button"
                  onClick={closeFormModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="expenses-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={17}
                        className="expenses-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FileText size={17} />
                      {editingExpense
                        ? "Update Expense"
                        : "Save Expense"}
                    </>
                  )}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {showViewModal && viewingExpense && (
        <div className="expenses-modal-overlay">
          <section className="expenses-view-modal">
            <header className="expenses-modal-header">
              <div className="expenses-modal-title">
                <span>
                  <ReceiptText size={20} />
                </span>

                <div>
                  <h2>Expense Details</h2>
                  <p>
                    Complete operating expense information.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="expenses-modal-close"
                onClick={() => setShowViewModal(false)}
              >
                <X size={21} />
              </button>
            </header>

            <div className="expenses-view-content">
              <div className="expenses-view-hero">
                <div>
                  <span>{viewingExpense.expense_category}</span>
                  <h3>{viewingExpense.material_name}</h3>
                  <p>{viewingExpense.expense_no}</p>
                </div>

                <strong>{money(viewingExpense.total_cost)}</strong>
              </div>

              <div className="expenses-detail-grid">
                <div>
                  <span>Quantity Used</span>
                  <strong>
                    {viewingExpense.quantity} {viewingExpense.unit}
                  </strong>
                </div>

                <div>
                  <span>Unit Cost</span>
                  <strong>{money(viewingExpense.unit_cost)}</strong>
                </div>

                <div>
                  <span>Related Module</span>
                  <strong>{viewingExpense.related_module}</strong>
                </div>

                <div>
                  <span>Reference</span>
                  <strong>
                    {viewingExpense.reference_code || "Manual"}
                  </strong>
                </div>

                <div>
                  <span>Date Used</span>
                  <strong>
                    {formatDate(viewingExpense.expense_date)}
                  </strong>
                </div>

                <div>
                  <span>Recorded By</span>
                  <strong>
                    {viewingExpense.recorded_by_name}
                  </strong>
                </div>
              </div>

              {viewingExpense.reference_description && (
                <div className="expenses-view-note">
                  <span>Transaction Details</span>
                  <p>{viewingExpense.reference_description}</p>
                </div>
              )}

              <div className="expenses-view-note">
                <span>Remarks</span>
                <p>
                  {viewingExpense.remarks ||
                    "No additional remarks provided."}
                </p>
              </div>
            </div>

            <footer className="expenses-modal-actions">
              <button
                type="button"
                className="expenses-primary-button"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}

      {showArchiveModal && archiveTarget && (
        <div className="expenses-modal-overlay expenses-confirm-layer">
          <section className="expenses-confirm-modal">
            <div className="expenses-confirm-icon danger">
              <Archive size={28} />
            </div>

            <h2>Archive Expense Record?</h2>

            <p>
              <strong>{archiveTarget.expense_no}</strong> for{" "}
              <strong>{archiveTarget.material_name}</strong> will be
              removed from the active expense list but retained in the
              database.
            </p>

            <div className="expenses-confirm-actions">
              <button
                type="button"
                className="expenses-secondary-button"
                onClick={() => {
                  if (archiving) return;
                  setShowArchiveModal(false);
                  setArchiveTarget(null);
                }}
                disabled={archiving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="expenses-danger-button"
                onClick={archiveExpense}
                disabled={archiving}
              >
                {archiving ? (
                  <>
                    <Loader2
                      size={17}
                      className="expenses-spin"
                    />
                    Archiving...
                  </>
                ) : (
                  <>
                    <Archive size={17} />
                    Archive
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {showMessageModal && (
        <div className="expenses-modal-overlay expenses-message-layer">
          <section className="expenses-message-modal">
            <div
              className={`expenses-message-icon ${messageModal.type}`}
            >
              {messageModal.type === "success" ? (
                <FileText size={29} />
              ) : (
                <X size={29} />
              )}
            </div>

            <h2>{messageModal.title}</h2>
            <p>{messageModal.message}</p>

            <button
              type="button"
              className="expenses-primary-button"
              onClick={() => setShowMessageModal(false)}
            >
              Okay
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export default ExpensesManagement;