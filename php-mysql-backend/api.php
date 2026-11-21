<?php
// php-mysql-backend/api.php - REST API Reference for Apache/Nginx PHP + MySQL Deployment
declare(strict_types=1);

header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$body = json_decode(file_get_contents('php://input') ?: '{}', true) ?? [];

// Example routes with PDO prepared statements and password_hash / password_verify:
if ($action === 'items' && $method === 'GET') {
    $stmt = $pdo->query('SELECT * FROM items ORDER BY updated_at DESC, id DESC');
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($action === 'items' && $method === 'POST') {
    $barcode = !empty($body['barcode'])
        ? strtoupper(trim($body['barcode']))
        : generate_item_barcode((string) ($body['name'] ?? 'ITM'));

    $stmt = $pdo->prepare(
        'INSERT INTO items (name, sku, barcode, category, unit, mrp, selling_price, buying_price, tax_rate, stock_qty, low_stock_threshold, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        trim((string) $body['name']),
        trim((string) ($body['sku'] ?? 'SKU-' . $barcode)),
        $barcode,
        trim((string) ($body['category'] ?? 'General')),
        trim((string) ($body['unit'] ?? 'pcs')),
        (float) ($body['mrp'] ?? 0),
        (float) ($body['selling_price'] ?? 0),
        (float) ($body['buying_price'] ?? 0),
        (float) ($body['tax_rate'] ?? 0),
        (int) ($body['stock_qty'] ?? 0),
        (int) ($body['low_stock_threshold'] ?? 10),
        (string) ($body['image_url'] ?? ''),
    ]);
    echo json_encode(['id' => $pdo->lastInsertId(), 'barcode' => $barcode]);
    exit;
}

if ($action === 'create_user' && $method === 'POST') {
    $hash = password_hash((string) ($body['password'] ?? ''), PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (username, full_name, role, password_hash) VALUES (?, ?, ?, ?)');
    $stmt->execute([
        strtolower(trim((string) $body['username'])),
        trim((string) $body['full_name']),
        in_array($body['role'] ?? '', ['admin', 'manager', 'cashier'], true) ? $body['role'] : 'cashier',
        $hash,
    ]);
    echo json_encode(['ok' => true]);
    exit;
}

echo json_encode(['status' => 'StockLedger PHP/MySQL API ready']);
