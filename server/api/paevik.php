<?php
declare(strict_types=1);

require dirname(__DIR__) . '/store.php';

header('content-type: application/json; charset=utf-8');

$config = diary_load_config();
if ($config === null || !isset($config['password'])) {
    http_response_code(503);
    echo json_encode(['error' => 'Andmebaas ei ole ühendatud.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = diary_connect((string) $config['password']);
    $user = diary_current_user($pdo);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Logi sisse.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode(diary_read_user($pdo, (int) $user['id']), JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        exit;
    }
    $incoming = diary_body();
    $current = diary_read_user($pdo, (int) $user['id']);
    if (empty($incoming['edited'])) {
        echo json_encode($current, JSON_UNESCAPED_UNICODE);
        exit;
    }
    $merged = diary_merge($current, $incoming);
    diary_write_user($pdo, (int) $user['id'], $merged);
    echo json_encode($merged, JSON_UNESCAPED_UNICODE);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['error' => 'Andmebaas ei vasta.'], JSON_UNESCAPED_UNICODE);
}
