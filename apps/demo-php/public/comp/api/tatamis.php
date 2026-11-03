<?php
declare(strict_types=1);

require dirname(__DIR__) . '/lib/store.php';

try {
    $data = comp_load();
    $out = [];
    foreach ($data['tatamis'] as $t) {
        $bouts = comp_bouts_for_tatami($data, $t['id']);
        $waiting = count(array_filter($bouts, static fn($b) => ($b['status'] ?? '') === 'waiting'));
        $live = count(array_filter($bouts, static fn($b) => ($b['status'] ?? '') === 'live'));
        $done = count(array_filter($bouts, static fn($b) => ($b['status'] ?? '') === 'done'));
        $session = comp_get_session($t['id']);
        $out[] = [
            'id' => $t['id'],
            'name' => $t['name'],
            'counts' => [
                'waiting' => $waiting,
                'live' => $live,
                'done' => $done,
                'total' => count($bouts),
            ],
            'sessionCode' => $session['sessionCode'] ?? null,
            'liveBoutId' => comp_live_bout($data, $t['id'])['id'] ?? null,
        ];
    }
    comp_json_response([
        'event' => $data['event'],
        'tatamis' => $out,
    ]);
} catch (Throwable $e) {
    comp_json_response(['error' => $e->getMessage()], 500);
}
