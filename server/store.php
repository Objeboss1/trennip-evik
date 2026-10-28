<?php
declare(strict_types=1);

const DIARY_CONFIG = '/home/firstadv/private/paevik-db.php';

function diary_connect(string $password): PDO
{
    return new PDO(
        'pgsql:host=127.0.0.1;port=5432;dbname=firstadv_sport;sslmode=disable',
        'firstadv_user',
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
    );
}

function diary_load_config(): ?array
{
    if (!is_file(DIARY_CONFIG)) {
        return null;
    }
    $config = include DIARY_CONFIG;
    return is_array($config) ? $config : null;
}

function diary_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('PAEVIKSESS');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/app/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function diary_body(): array
{
    $data = json_decode((string) file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function diary_email(string $email): string
{
    return strtolower(trim($email));
}

function diary_public_user(array $user): array
{
    $joined = new DateTimeImmutable((string) $user['loodud']);
    $joined = $joined->setTimezone(new DateTimeZone('Europe/Tallinn'));
    return [
        'email' => $user['email'],
        'liitus' => $joined->format('j.m.Y'),
    ];
}

function diary_current_user(PDO $pdo): ?array
{
    diary_session();
    $id = $_SESSION['user_id'] ?? null;
    if (!$id) {
        return null;
    }
    $statement = $pdo->prepare('SELECT id, email, loodud FROM kasutajad WHERE id = :id');
    $statement->execute(['id' => $id]);
    $user = $statement->fetch(PDO::FETCH_ASSOC);
    return $user ?: null;
}

function diary_sign_in(PDO $pdo, int $id): array
{
    diary_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $id;
    $statement = $pdo->prepare('SELECT id, email, loodud FROM kasutajad WHERE id = :id');
    $statement->execute(['id' => $id]);
    $user = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        throw new RuntimeException('Kontot ei leitud.');
    }
    return diary_public_user($user);
}

function diary_json(mixed $value, bool $object): string
{
    if (!is_array($value) || ($object && array_is_list($value))) {
        $value = $object ? (object) [] : [];
    }
    return json_encode($value, JSON_UNESCAPED_UNICODE);
}

function diary_decode(mixed $value, bool $object): mixed
{
    if (is_string($value)) {
        $value = json_decode($value, true);
    }
    if (!is_array($value)) {
        return $object ? [] : [];
    }
    return $value;
}

function diary_from_user(array $row): array
{
    return [
        'choices' => diary_decode($row['kalender'], true),
        'muscles' => diary_decode($row['lihased'], true),
        'layout' => ['spots' => diary_decode($row['punktid'], false)],
        'plan' => diary_decode($row['treeningkava'], false),
        'nutrition' => (string) ($row['tekst'] ?? ''),
    ];
}

function diary_read_user(PDO $pdo, int $id): array
{
    $statement = $pdo->prepare(
        'SELECT tekst, treeningkava, kalender, punktid, lihased FROM kasutajad WHERE id = :id',
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch(PDO::FETCH_ASSOC);
    return $row ? diary_from_user($row) : [];
}

function diary_has_plan(mixed $plan): bool
{
    if (!is_array($plan)) {
        return false;
    }
    foreach ($plan as $column) {
        if (!is_array($column)) {
            continue;
        }
        if (trim((string) ($column['title'] ?? '')) !== '') {
            return true;
        }
        foreach ($column['rows'] ?? [] as $row) {
            if (!is_array($row)) {
                continue;
            }
            if (trim((string) ($row['text'] ?? '')) !== '' || trim((string) ($row['reps'] ?? '')) !== '') {
                return true;
            }
        }
    }
    return false;
}

function diary_merge(array $base, array $incoming): array
{
    $next = $base;
    if (!empty($incoming['choices']) && is_array($incoming['choices'])) {
        $next['choices'] = array_replace($base['choices'] ?? [], $incoming['choices']);
    }
    if (isset($incoming['muscles']) && is_array($incoming['muscles'])) {
        $muscles = $base['muscles'] ?? [];
        foreach ($incoming['muscles'] as $name => $value) {
            $previous = $muscles[$name] ?? [];
            $value = is_array($value) ? $value : [];
            $exercises = trim((string) ($value['exercises'] ?? ''));
            $reps = trim((string) ($value['reps'] ?? ''));
            $muscles[$name] = [
                'exercises' => $exercises !== '' ? $value['exercises'] : ($previous['exercises'] ?? ''),
                'reps' => $reps !== '' ? $value['reps'] : ($previous['reps'] ?? ''),
            ];
        }
        $next['muscles'] = $muscles;
    }
    if (isset($incoming['nutrition']) && trim((string) $incoming['nutrition']) !== '') {
        $next['nutrition'] = $incoming['nutrition'];
    }
    if (diary_has_plan($incoming['plan'] ?? null)) {
        $next['plan'] = $incoming['plan'];
    }
    if (!empty($incoming['layout']['spots']) && is_array($incoming['layout']['spots'])) {
        $next['layout'] = $incoming['layout'];
    }
    return $next;
}

function diary_write_user(PDO $pdo, int $id, array $data): void
{
    $statement = $pdo->prepare(
        'UPDATE kasutajad
         SET tekst = :tekst,
             treeningkava = :kava::jsonb,
             kalender = :kalender::jsonb,
             punktid = :punktid::jsonb,
             lihased = :lihased::jsonb,
             uuendatud = now()
         WHERE id = :id',
    );
    $statement->execute([
        'id' => $id,
        'tekst' => (string) ($data['nutrition'] ?? ''),
        'kava' => diary_json($data['plan'] ?? [], false),
        'kalender' => diary_json($data['choices'] ?? [], true),
        'punktid' => diary_json($data['layout']['spots'] ?? [], false),
        'lihased' => diary_json($data['muscles'] ?? [], true),
    ]);
}
