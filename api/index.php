<?php

declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function config(): array
{
    $config = require __DIR__ . '/config.php';
    return is_array($config) ? $config : [];
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = config();
    $driver = $config['driver'] ?? 'pgsql';
    if ($driver === 'sqlite') {
        $path = $config['sqlite'] ?? (__DIR__ . '/trennipaevik.sqlite');
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        $pdo->exec(
            'create table if not exists kasutajad (
                id integer primary key autoincrement,
                email text not null unique,
                parool_hash text not null,
                paevik text not null default \'{}\',
                loodud text not null default current_timestamp,
                uuendatud text not null default current_timestamp
            )'
        );
        return $pdo;
    }

    $pdo = new PDO(
        (string) ($config['dsn'] ?? ''),
        (string) ($config['user'] ?? ''),
        (string) ($config['password'] ?? ''),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec(file_get_contents(__DIR__ . '/schema.sql') ?: '');
    return $pdo;
}

function startSession(): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function readBody(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }
    $parsed = json_decode($raw);
    if (!$parsed instanceof stdClass) {
        return [];
    }
    return [
        'email' => $parsed->email ?? '',
        'password' => $parsed->password ?? '',
        'diary' => $parsed->diary ?? null,
    ];
}

function emailOf(array $body): string
{
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(400, ['ok' => false, 'error' => 'E-post ei kõlba.']);
    }
    return $email;
}

function passwordOf(array $body): string
{
    $password = (string) ($body['password'] ?? '');
    if (strlen($password) < 8) {
        respond(400, ['ok' => false, 'error' => 'Parool peab olema vähemalt 8 märki.']);
    }
    if (strlen($password) > 200) {
        respond(400, ['ok' => false, 'error' => 'Parool on liiga pikk.']);
    }
    return $password;
}

function diaryJson(array $body): string
{
    $diary = $body['diary'] ?? null;
    if (!$diary instanceof stdClass) {
        respond(400, ['ok' => false, 'error' => 'Päevik ei kõlba.']);
    }
    $json = json_encode($diary, JSON_UNESCAPED_UNICODE);
    if ($json === false || strlen($json) > 1_500_000) {
        respond(400, ['ok' => false, 'error' => 'Päevik on liiga suur.']);
    }
    return $json;
}

function decodeDiary(mixed $value): mixed
{
    if ($value instanceof stdClass || is_array($value)) {
        return $value;
    }
    $decoded = json_decode((string) $value);
    return $decoded instanceof stdClass ? $decoded : new stdClass();
}

function userById(int $id): ?array
{
    $statement = db()->prepare('select id, email, paevik, loodud from kasutajad where id = ?');
    $statement->execute([$id]);
    $row = $statement->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function publicUser(array $row, mixed $diary): array
{
    return [
        'ok' => true,
        'user' => [
            'id' => (string) $row['id'],
            'email' => $row['email'],
            'loodud' => $row['loodud'],
        ],
        'diary' => $diary,
    ];
}

function requireUser(): array
{
    $id = (int) ($_SESSION['user_id'] ?? 0);
    if ($id < 1) {
        respond(401, ['ok' => false, 'error' => 'Logi sisse.']);
    }
    $row = userById($id);
    if (!$row) {
        unset($_SESSION['user_id']);
        respond(401, ['ok' => false, 'error' => 'Logi sisse.']);
    }
    return $row;
}

function saveDiary(int $id, string $json): void
{
    $driver = config()['driver'] ?? 'pgsql';
    if ($driver === 'sqlite') {
        $statement = db()->prepare('update kasutajad set paevik = ?, uuendatud = current_timestamp where id = ?');
        $statement->execute([$json, $id]);
        return;
    }
    $statement = db()->prepare('update kasutajad set paevik = ?::jsonb, uuendatud = now() where id = ?');
    $statement->execute([$json, $id]);
}

try {
    startSession();
    $action = (string) ($_GET['action'] ?? '');
    $body = readBody();

    if ($action === 'session') {
        $id = (int) ($_SESSION['user_id'] ?? 0);
        $row = $id > 0 ? userById($id) : null;
        if (!$row) {
            respond(200, ['ok' => true, 'user' => null]);
        }
        respond(200, publicUser($row, decodeDiary($row['paevik'])));
    }

    if ($action === 'register') {
        $email = emailOf($body);
        $password = passwordOf($body);
        $json = diaryJson($body);
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $driver = config()['driver'] ?? 'pgsql';
        try {
            if ($driver === 'sqlite') {
                $statement = db()->prepare('insert into kasutajad (email, parool_hash, paevik) values (?, ?, ?)');
                $statement->execute([$email, $hash, $json]);
                $id = (int) db()->lastInsertId();
            } else {
                $statement = db()->prepare('insert into kasutajad (email, parool_hash, paevik) values (?, ?, ?::jsonb) returning id');
                $statement->execute([$email, $hash, $json]);
                $id = (int) $statement->fetchColumn();
            }
        } catch (PDOException $error) {
            if ($error->getCode() === '23000' || $error->getCode() === '23505') {
                respond(409, ['ok' => false, 'error' => 'See e-post on juba kasutusel.']);
            }
            throw $error;
        }
        $_SESSION['user_id'] = $id;
        $row = userById($id);
        respond(200, publicUser($row ?: ['id' => $id, 'email' => $email, 'loodud' => date(DATE_ATOM)], decodeDiary($json)));
    }

    if ($action === 'login') {
        $email = emailOf($body);
        $password = passwordOf($body);
        $statement = db()->prepare('select id, email, parool_hash, paevik, loodud from kasutajad where email = ?');
        $statement->execute([$email]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$row || !password_verify($password, (string) $row['parool_hash'])) {
            respond(401, ['ok' => false, 'error' => 'Vale e-post või parool.']);
        }
        $_SESSION['user_id'] = (int) $row['id'];
        respond(200, publicUser($row, decodeDiary($row['paevik'])));
    }

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(200, ['ok' => true]);
    }

    if ($action === 'save') {
        $row = requireUser();
        saveDiary((int) $row['id'], diaryJson($body));
        respond(200, ['ok' => true]);
    }

    respond(404, ['ok' => false, 'error' => 'Tundmatu toiming.']);
} catch (Throwable $error) {
    respond(500, ['ok' => false, 'error' => 'Server ei vasta.']);
}
