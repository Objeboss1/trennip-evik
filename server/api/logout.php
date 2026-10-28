<?php
declare(strict_types=1);

require dirname(__DIR__) . '/store.php';

header('content-type: application/json; charset=utf-8');

diary_session();
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}
session_destroy();
echo json_encode(['email' => null]);
