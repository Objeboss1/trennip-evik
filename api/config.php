<?php

$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
    return require $local;
}

return [
    'driver' => 'pgsql',
    'dsn' => 'pgsql:host=127.0.0.1;port=5432;dbname=firstadv_sport',
    'user' => 'firstadv_sport',
    'password' => '',
];
