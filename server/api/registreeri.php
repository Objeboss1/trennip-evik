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

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'E-post ei kõlba.'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['error' => 'Parool peab olema vähemalt 8 märki.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = diary_connect((string) $config['password']);
    $statement = $pdo->prepare('SELECT id, parool_hash FROM kasutajad WHERE email = :email');
    $statement->execute(['email' => $email]);
    $existing = $statement->fetch(PDO::FETCH_ASSOC);
    if ($existing && $existing['parool_hash']) {
        http_response_code(409);
        echo json_encode(['error' => 'See e-post on juba kasutusel.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($existing) {
        $update = $pdo->prepare('UPDATE kasutajad SET parool_hash = :hash, nimi = :nimi, loodud = now(), uuendatud = now() WHERE id = :id');
        $update->execute(['hash' => $hash, 'nimi' => $email, 'id' => $existing['id']]);
        $id = (int) $existing['id'];
    } else {
        $insert = $pdo->prepare(
            'INSERT INTO kasutajad (nimi, email, parool_hash) VALUES (:nimi, :email, :hash) RETURNING id',
        );
        $insert->execute(['nimi' => $email, 'email' => $email, 'hash' => $hash]);
        $id = (int) $insert->fetchColumn();
    }
    echo json_encode(diary_sign_in($pdo, $id), JSON_UNESCAPED_UNICODE);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['error' => 'Andmebaas ei vasta.'], JSON_UNESCAPED_UNICODE);
}
