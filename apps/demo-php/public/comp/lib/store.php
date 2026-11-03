<?php
declare(strict_types=1);

/**
 * Competition fixture store — seed in fixtures/, runtime under data/ (gitignored).
 */

function comp_paths(): array
{
    $root = dirname(__DIR__, 3); // apps/demo-php
    return [
        'seed' => $root . DIRECTORY_SEPARATOR . 'fixtures' . DIRECTORY_SEPARATOR . 'competition.seed.json',
        'dataDir' => $root . DIRECTORY_SEPARATOR . 'data',
        'runtime' => $root . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'competition.json',
        'sessions' => $root . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'sessions',
    ];
}

function comp_ensure_runtime(): string
{
    $p = comp_paths();
    if (!is_dir($p['dataDir'])) {
        mkdir($p['dataDir'], 0775, true);
    }
    if (!is_dir($p['sessions'])) {
        mkdir($p['sessions'], 0775, true);
    }
    if (!is_file($p['runtime'])) {
        if (!is_file($p['seed'])) {
            throw new RuntimeException('Missing competition seed: ' . $p['seed']);
        }
        if (!copy($p['seed'], $p['runtime'])) {
            throw new RuntimeException('Cannot copy seed to runtime');
        }
    }
    return $p['runtime'];
}

function comp_load(): array
{
    $path = comp_ensure_runtime();
    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException('Cannot read competition data');
    }
    $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($data)) {
        throw new RuntimeException('Invalid competition JSON');
    }
    return $data;
}

function comp_save(array $data): void
{
    $path = comp_ensure_runtime();
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $tmp = $path . '.tmp';
    if (file_put_contents($tmp, $json . "\n") === false) {
        throw new RuntimeException('Cannot write competition data');
    }
    rename($tmp, $path);
}

function comp_reset_from_seed(): array
{
    $p = comp_paths();
    comp_ensure_runtime();
    if (!copy($p['seed'], $p['runtime'])) {
        throw new RuntimeException('Cannot reset from seed');
    }
    return comp_load();
}

function comp_session_path(string $tatamiId): string
{
    $p = comp_paths();
    comp_ensure_runtime();
    $safe = preg_replace('/[^a-zA-Z0-9_-]/', '', $tatamiId) ?: 'unknown';
    return $p['sessions'] . DIRECTORY_SEPARATOR . $safe . '.json';
}

function comp_get_session(string $tatamiId): ?array
{
    $path = comp_session_path($tatamiId);
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function comp_set_session(string $tatamiId, array $session): void
{
    $path = comp_session_path($tatamiId);
    $json = json_encode($session, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    file_put_contents($path, $json . "\n");
}

function comp_categories_for_tatami(array $data, string $tatamiId): array
{
    return array_values(array_filter(
        $data['categories'] ?? [],
        static fn($c) => ($c['tatamiId'] ?? '') === $tatamiId,
    ));
}

function comp_bouts_for_tatami(array $data, string $tatamiId): array
{
    $catIds = array_column(comp_categories_for_tatami($data, $tatamiId), 'id');
    $catMap = [];
    foreach ($data['categories'] ?? [] as $c) {
        $catMap[$c['id']] = $c;
    }
    $bouts = [];
    foreach ($data['bouts'] ?? [] as $b) {
        if (!in_array($b['categoryId'] ?? '', $catIds, true)) {
            continue;
        }
        $b['_categoryName'] = $catMap[$b['categoryId']]['name'] ?? $b['categoryId'];
        $bouts[] = $b;
    }
    usort($bouts, static function ($a, $b) {
        $ca = $a['_categoryName'] <=> $b['_categoryName'];
        if ($ca !== 0) {
            return $ca;
        }
        return ($a['order'] ?? 0) <=> ($b['order'] ?? 0);
    });
    return $bouts;
}

function comp_find_bout(array &$data, string $boutId): ?int
{
    foreach ($data['bouts'] as $i => $b) {
        if (($b['id'] ?? '') === $boutId) {
            return $i;
        }
    }
    return null;
}

function comp_live_bout(array $data, string $tatamiId): ?array
{
    foreach (comp_bouts_for_tatami($data, $tatamiId) as $b) {
        if (($b['status'] ?? '') === 'live') {
            return $b;
        }
    }
    return null;
}

function comp_next_waiting(array $data, string $tatamiId): ?array
{
    foreach (comp_bouts_for_tatami($data, $tatamiId) as $b) {
        if (($b['status'] ?? '') === 'waiting') {
            return $b;
        }
    }
    return null;
}

function comp_json_response(mixed $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function comp_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
