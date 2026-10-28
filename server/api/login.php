<?php
declare(strict_types=1);

require dirname(__DIR__) . '/store.php';

header('content-type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$config = diary_load_config();
if ($config === null || !isset($config['password'])) {
    http_response_code(503);
    echo json_encode(['error' => 'Andmebaas ei ole ühendatud.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$body = diary_body();
$email = diary_email((string) ($body['email'] ?? ''));
$password = (string) ($body['password'] ?? '');

try {
    $pdo = diary_connect((string) $config['password']);
    $statement = $pdo->prepare('SELECT id, parool_hash FROM kasutajad WHERE email = :email');
    $statement->execute(['email' => $email]);
    $user = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$user || !$user['parool_hash'] || !password_verify($password, (string) $user['parool_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Vale e-post või parool.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(diary_sign_in($pdo, (int) $user['id']), JSON_UNESCAPED_UNICODE);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['error' => 'Andmebaas ei vasta.'], JSON_UNESCAPED_UNICODE);
}
