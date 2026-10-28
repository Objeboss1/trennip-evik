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
    echo json_encode($user ? diary_public_user($user) : ['email' => null], JSON_UNESCAPED_UNICODE);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['error' => 'Andmebaas ei vasta.'], JSON_UNESCAPED_UNICODE);
}
