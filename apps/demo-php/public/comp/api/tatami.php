<?php
declare(strict_types=1);

require dirname(__DIR__) . '/lib/store.php';

try {
    $id = isset($_GET['id']) ? (string) $_GET['id'] : '';
    if ($id === '') {
        comp_json_response(['error' => 'missing id'], 400);
    }
    $data = comp_load();
    $tatami = null;
    foreach ($data['tatamis'] as $t) {
        if (($t['id'] ?? '') === $id) {
            $tatami = $t;
            break;
        }
    }
    if ($tatami === null) {
        comp_json_response(['error' => 'tatami not found'], 404);
    }
    $categories = comp_categories_for_tatami($data, $id);
    $bouts = comp_bouts_for_tatami($data, $id);
    $session = comp_get_session($id);
    comp_json_response([
        'event' => $data['event'],
        'tatami' => $tatami,
        'categories' => $categories,
        'bouts' => $bouts,
        'liveBout' => comp_live_bout($data, $id),
        'nextWaiting' => comp_next_waiting($data, $id),
        'session' => $session,
    ]);
} catch (Throwable $e) {
    comp_json_response(['error' => $e->getMessage()], 500);
}
