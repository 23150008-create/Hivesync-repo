import { useEffect, useState } from "react";
import { Search, Tag, Edit, X, Save, Package, TrendingUp, AlertTriangle } from "lucide-react";

function PricingManagement() {
  const API_URL = "http://localhost/HiveSync/backend/pricing_management/";

  const [prices, setPrices] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    product_id: "",
    product_name: "",
    supplier_price: "",
    selling_price: "",
  });

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      const res = await fetch(API_URL + "get_prices.php");
      const data = await res.json();

      if (data.success) {
        setPrices(data.prices || []);
      }
    } catch (error) {
      console.log("Pricing error:", error);
    }
  };

  const peso = (value) => `₱${Number(value || 0).toLocaleString()}`;

  const getMargin = (selling, supplier) => {
    return Number(selling || 0) - Number(supplier || 0);
  };

  const getMarginPercent = (selling, supplier) => {
    const sellingPrice = Number(selling || 0);
    if (sellingPrice === 0) return 0;

    return (getMargin(selling, supplier) / sellingPrice) * 100;
  };

  const getMarginBadge = (percent) => {
    if (percent >= 30) return "good";
    if (percent >= 15) return "warning";
    return "danger";
  };

  const totalProducts = prices.length;

  const averageMargin =
    prices.length === 0
      ? 0
      : prices.reduce(
          (sum, item) =>
            sum + getMargin(Number(item.selling_price), Number(item.supplier_price)),
          0
        ) / prices.length;

  const highestMarginItem =
    prices.length === 0
      ? null
      : [...prices].sort(
          (a, b) =>
            getMargin(b.selling_price, b.supplier_price) -
            getMargin(a.selling_price, a.supplier_price)
        )[0];

  const lowestMarginItem =
    prices.length === 0
      ? null
      : [...prices].sort(
          (a, b) =>
            getMargin(a.selling_price, a.supplier_price) -
            getMargin(b.selling_price, b.supplier_price)
        )[0];

  const openEdit = (item) => {
    setFormData({
      product_id: item.product_id,
      product_name: item.product_name,
      supplier_price: item.supplier_price,
      selling_price: item.selling_price,
    });

    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData({
      product_id: "",
      product_name: "",
      supplier_price: "",
      selling_price: "",
    });
  };

  const updatePrice = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(API_URL + "update_price.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        closeForm();
        loadPrices();
      } else {
        alert(data.message || "Failed to update price.");
      }
    } catch (error) {
      console.log(error);
      alert("Cannot connect to update_price.php");
    }
  };

  const filteredPrices = prices.filter((item) =>
    `${item.product_name} ${item.category} ${item.vendor_name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p>HiveSync › Pricing Management</p>
          <h1>Pricing Management</h1>
          <span>Manage supplier costs, selling prices, and profit margins</span>
        </div>
      </div>

      <section className="module-stats">
        <div className="module-card">
          <span>Total Products</span>
          <h2>{totalProducts}</h2>
        </div>

        <div className="module-card">
          <span>Average Margin</span>
          <h2>{peso(averageMargin)}</h2>
        </div>

        <div className="module-card">
          <span>Highest Margin</span>
          <h2>{highestMarginItem ? peso(getMargin(highestMarginItem.selling_price, highestMarginItem.supplier_price)) : "₱0"}</h2>
          <p>{highestMarginItem ? highestMarginItem.product_name : "No data"}</p>
        </div>

        <div className="module-card">
          <span>Lowest Margin</span>
          <h2>{lowestMarginItem ? peso(getMargin(lowestMarginItem.selling_price, lowestMarginItem.supplier_price)) : "₱0"}</h2>
          <p>{lowestMarginItem ? lowestMarginItem.product_name : "No data"}</p>
        </div>
      </section>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-box inventory-modal">
            <div className="modal-header">
              <h2>Update Price</h2>

              <button className="modal-close" onClick={closeForm}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={updatePrice}>
              <label>Product</label>
              <input value={formData.product_name} disabled />

              <label>Supplier Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.supplier_price}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_price: e.target.value })
                }
                required
              />

              <label>Selling Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.selling_price}
                onChange={(e) =>
                  setFormData({ ...formData, selling_price: e.target.value })
                }
                required
              />

              <label>Profit Margin</label>
              <input
                value={peso(getMargin(formData.selling_price, formData.supplier_price))}
                disabled
              />

              <label>Margin Percentage</label>
              <input
                value={`${getMarginPercent(
                  formData.selling_price,
                  formData.supplier_price
                ).toFixed(1)}%`}
                disabled
              />

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={closeForm}>
                  Cancel
                </button>

                <button type="submit" className="primary-btn">
                  <Save size={18} />
                  Save Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Search product prices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Supplier Price</th>
              <th>Selling Price</th>
              <th>Margin</th>
              <th>Margin %</th>
              <th>Vendor</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredPrices.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-row">
                  No pricing records yet. Product prices will appear here.
                </td>
              </tr>
            ) : (
              filteredPrices.map((item) => {
                const marginValue = getMargin(item.selling_price, item.supplier_price);
                const percentValue = getMarginPercent(
                  item.selling_price,
                  item.supplier_price
                );

                return (
                  <tr key={item.product_id}>
                    <td>{item.product_name}</td>
                    <td>{item.category}</td>
                    <td>{peso(item.supplier_price)}</td>
                    <td>{peso(item.selling_price)}</td>
                    <td>{peso(marginValue)}</td>
                    <td>
                      <span className={`margin-badge ${getMarginBadge(percentValue)}`}>
                        {percentValue.toFixed(1)}%
                      </span>
                    </td>
                    <td>{item.vendor_name || "No vendor"}</td>
                    <td>
                      <button className="icon-btn" onClick={() => openEdit(item)}>
                        <Edit size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PricingManagement;