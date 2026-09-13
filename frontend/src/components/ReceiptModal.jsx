import "./ReceiptModal.css";

export default function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const items = receipt.items || [];

  return (
    <div className="receipt-overlay">
      <div className="receipt-modal">
        <h2>HiveSync POS Receipt</h2>

        <div className="receipt-info">
          <p><strong>Transaction Code:</strong> {receipt.transaction_code}</p>
          <p><strong>Date:</strong> {receipt.transaction_date}</p>
        </div>

        <div className="receipt-table-wrapper">
          <table className="receipt-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Supplier Price</th>
                <th>Hive Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{item.product_name}</td>
                  <td>{item.quantity}</td>
                  <td>₱{Number(item.supplier_price || 0).toFixed(2)}</td>
                  <td>₱{Number(item.hive_price || 0).toFixed(2)}</td>
                  <td>₱{Number(item.subtotal || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="receipt-total">
          <p><strong>Total:</strong> ₱{Number(receipt.total_amount || 0).toFixed(2)}</p>
          <p><strong>Payment:</strong> ₱{Number(receipt.payment_amount || 0).toFixed(2)}</p>
          <p><strong>Change:</strong> ₱{Number(receipt.change_amount || 0).toFixed(2)}</p>
        </div>

        <button className="receipt-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}