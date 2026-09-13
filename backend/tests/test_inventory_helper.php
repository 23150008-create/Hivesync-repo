<?php
// backend/tests/test_inventory_helper.php
// Run this to test the inventory helper functions

require_once '../config/database.php';
require_once '../inventory_management/inventory_helper.php';

$database = new Database();
$conn = $database->getConnection();

echo "Testing Inventory Helper Functions\n";
echo "==================================\n\n";

// Test 1: Get product info
$productId = 1; // Change to a valid product ID
echo "Test 1: Getting product info for ID $productId\n";

$stmt = $conn->prepare("SELECT * FROM tbl_inv WHERE product_id = ?");
$stmt->execute([$productId]);
$product = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Product: {$product['product_name']}\n";
echo "Current Stock: {$product['quantity']}\n\n";

// Test 2: Get inventory batches
echo "Test 2: Getting inventory batches\n";
$batches = getInventoryBatches($conn, $productId);
echo "Found " . count($batches) . " batches\n";
foreach ($batches as $batch) {
    echo " - Batch ID: {$batch['batch_id']}, Quantity: {$batch['quantity']}, Expiry: {$batch['expiry_date']}\n";
}
echo "\n";

// Test 3: Stock out
echo "Test 3: Stock out (sell 1 unit)\n";
$result = inventoryStockOut($conn, $productId, 1, 'TEST', 999, 1, 'Test sale');
if ($result['success']) {
    echo "✓ Stock out successful\n";
    echo "New quantity: {$result['new_quantity']}\n";
    echo "Deducted from " . count($result['deducted_batches']) . " batches\n";
} else {
    echo "✗ Stock out failed: {$result['message']}\n";
}
echo "\n";

// Test 4: Get history
echo "Test 4: Getting inventory history\n";
$history = getInventoryHistory($conn, $productId, 5);
echo "Last 5 history records:\n";
foreach ($history as $record) {
    echo " - {$record['created_at']}: {$record['movement']} {$record['quantity']} units (Balance: {$record['balance_after']})\n";
    echo "   {$record['remarks']}\n";
}
echo "\n";

// Test 5: Stock in
echo "Test 5: Stock in (add 5 units)\n";
$result = inventoryStockIn($conn, $productId, 5, date('Y-m-d', strtotime('+1 year')), 100.00, null, 1, 'Test stock in');
if ($result['success']) {
    echo "✓ Stock in successful\n";
    echo "New quantity: {$result['new_quantity']}\n";
    echo "Batch ID: {$result['batch_id']}\n";
} else {
    echo "✗ Stock in failed: {$result['message']}\n";
}

echo "\nAll tests completed.\n";
?>