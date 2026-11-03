<?php
declare(strict_types=1);

require dirname(__DIR__) . '/lib/store.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        comp_json_response(['error' => 'POST required'], 405);
    }
    $body = comp_read_json_body();
    $tatamiId = (string) ($body['tatamiId'] ?? '');
    $sessionCode = strtoupper(trim((string) ($body['sessionCode'] ?? '')));
    $sessionId = (string) ($body['sessionId'] ?? '');
    if ($tatamiId === '' || $sessionCode === '') {
        comp_json_response(['error' => 'tatamiId and sessionCode required'], 400);
    }
    $payload = [
        'tatamiId' => $tatamiId,
        'sessionCode' => $sessionCode,
        'sessionId' => $sessionId,
        'updatedAt' => gmdate('c'),
    ];
    comp_set_session($tatamiId, $payload);
    comp_json_response(['ok' => true, 'session' => $payload]);
} catch (Throwable $e) {
    comp_json_response(['error' => $e->getMessage()], 500);
}
