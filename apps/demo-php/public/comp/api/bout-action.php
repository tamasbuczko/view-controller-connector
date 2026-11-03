<?php
declare(strict_types=1);

require dirname(__DIR__) . '/lib/store.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        comp_json_response(['error' => 'POST required'], 405);
    }
    $body = comp_read_json_body();
    $action = (string) ($body['action'] ?? '');
    $tatamiId = (string) ($body['tatamiId'] ?? '');
    $boutId = (string) ($body['boutId'] ?? '');

    if ($action === 'reset-seed') {
        $data = comp_reset_from_seed();
        // clear session files
        $p = comp_paths();
        foreach (glob($p['sessions'] . DIRECTORY_SEPARATOR . '*.json') ?: [] as $f) {
            @unlink($f);
        }
        comp_json_response(['ok' => true, 'event' => $data['event']]);
    }

    if ($tatamiId === '') {
        comp_json_response(['error' => 'tatamiId required'], 400);
    }

    $data = comp_load();

    if ($action === 'start') {
        if ($boutId === '') {
            $next = comp_next_waiting($data, $tatamiId);
            if ($next === null) {
                comp_json_response(['error' => 'no waiting bout'], 400);
            }
            $boutId = $next['id'];
        }
        // Complete any other live bout on this tatami first
        foreach ($data['bouts'] as $i => $b) {
            $cats = array_column(comp_categories_for_tatami($data, $tatamiId), 'id');
            if (!in_array($b['categoryId'] ?? '', $cats, true)) {
                continue;
            }
            if (($b['status'] ?? '') === 'live' && ($b['id'] ?? '') !== $boutId) {
                $data['bouts'][$i]['status'] = 'done';
                if ($data['bouts'][$i]['score'] === null) {
                    $data['bouts'][$i]['score'] = ['aka' => 0, 'ao' => 0, 'winner' => 'draw'];
                }
            }
        }
        $idx = comp_find_bout($data, $boutId);
        if ($idx === null) {
            comp_json_response(['error' => 'bout not found'], 404);
        }
        $data['bouts'][$idx]['status'] = 'live';
        $data['bouts'][$idx]['score'] = ['aka' => 0, 'ao' => 0];
        $data['bouts'][$idx]['startedAt'] = gmdate('c');
        comp_save($data);
        $bout = $data['bouts'][$idx];
        $bout['_categoryName'] = null;
        foreach ($data['categories'] as $c) {
            if ($c['id'] === $bout['categoryId']) {
                $bout['_categoryName'] = $c['name'];
                break;
            }
        }
        comp_json_response([
            'ok' => true,
            'bout' => $bout,
            'competitors' => [
                'boutId' => $bout['id'],
                'aka' => $bout['aka'],
                'ao' => $bout['ao'],
                'categoryName' => $bout['_categoryName'],
                'order' => $bout['order'],
            ],
        ]);
    }

    if ($action === 'score') {
        $idx = $boutId !== '' ? comp_find_bout($data, $boutId) : null;
        if ($idx === null) {
            $live = comp_live_bout($data, $tatamiId);
            if ($live === null) {
                comp_json_response(['error' => 'no live bout'], 400);
            }
            $idx = comp_find_bout($data, $live['id']);
        }
        if ($idx === null) {
            comp_json_response(['error' => 'bout not found'], 404);
        }
        $aka = (int) ($body['aka'] ?? $data['bouts'][$idx]['score']['aka'] ?? 0);
        $ao = (int) ($body['ao'] ?? $data['bouts'][$idx]['score']['ao'] ?? 0);
        $data['bouts'][$idx]['score'] = ['aka' => $aka, 'ao' => $ao];
        comp_save($data);
        comp_json_response(['ok' => true, 'bout' => $data['bouts'][$idx]]);
    }

    if ($action === 'complete') {
        $idx = $boutId !== '' ? comp_find_bout($data, $boutId) : null;
        if ($idx === null) {
            $live = comp_live_bout($data, $tatamiId);
            if ($live === null) {
                comp_json_response(['error' => 'no live bout'], 400);
            }
            $idx = comp_find_bout($data, $live['id']);
        }
        if ($idx === null) {
            comp_json_response(['error' => 'bout not found'], 404);
        }
        $aka = (int) ($body['aka'] ?? $data['bouts'][$idx]['score']['aka'] ?? 0);
        $ao = (int) ($body['ao'] ?? $data['bouts'][$idx]['score']['ao'] ?? 0);
        $winner = $aka > $ao ? 'aka' : ($ao > $aka ? 'ao' : 'draw');
        if (isset($body['winner']) && in_array($body['winner'], ['aka', 'ao', 'draw'], true)) {
            $winner = $body['winner'];
        }
        $data['bouts'][$idx]['status'] = 'done';
        $data['bouts'][$idx]['score'] = [
            'aka' => $aka,
            'ao' => $ao,
            'winner' => $winner,
        ];
        $data['bouts'][$idx]['completedAt'] = gmdate('c');
        comp_save($data);
        comp_json_response(['ok' => true, 'bout' => $data['bouts'][$idx]]);
    }

    if ($action === 'next') {
        // Complete live if any, then start next waiting
        $live = comp_live_bout($data, $tatamiId);
        if ($live !== null) {
            $idx = comp_find_bout($data, $live['id']);
            if ($idx !== null) {
                $aka = (int) ($body['aka'] ?? $data['bouts'][$idx]['score']['aka'] ?? 0);
                $ao = (int) ($body['ao'] ?? $data['bouts'][$idx]['score']['ao'] ?? 0);
                $winner = $aka > $ao ? 'aka' : ($ao > $aka ? 'ao' : 'draw');
                $data['bouts'][$idx]['status'] = 'done';
                $data['bouts'][$idx]['score'] = [
                    'aka' => $aka,
                    'ao' => $ao,
                    'winner' => $winner,
                ];
                $data['bouts'][$idx]['completedAt'] = gmdate('c');
            }
        }
        comp_save($data);
        $next = comp_next_waiting($data, $tatamiId);
        if ($next === null) {
            comp_json_response([
                'ok' => true,
                'done' => true,
                'bout' => null,
                'message' => 'Nincs több várakozó küzdelem',
            ]);
        }
        // re-enter start logic via recursive call shape
        $idx = comp_find_bout($data, $next['id']);
        $data['bouts'][$idx]['status'] = 'live';
        $data['bouts'][$idx]['score'] = ['aka' => 0, 'ao' => 0];
        $data['bouts'][$idx]['startedAt'] = gmdate('c');
        comp_save($data);
        $bout = $data['bouts'][$idx];
        foreach ($data['categories'] as $c) {
            if ($c['id'] === $bout['categoryId']) {
                $bout['_categoryName'] = $c['name'];
                break;
            }
        }
        comp_json_response([
            'ok' => true,
            'done' => false,
            'bout' => $bout,
            'competitors' => [
                'boutId' => $bout['id'],
                'aka' => $bout['aka'],
                'ao' => $bout['ao'],
                'categoryName' => $bout['_categoryName'] ?? null,
                'order' => $bout['order'],
            ],
        ]);
    }

    comp_json_response(['error' => 'unknown action'], 400);
} catch (Throwable $e) {
    comp_json_response(['error' => $e->getMessage()], 500);
}
