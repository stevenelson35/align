<?php
// Wordle's answers and progress are server-only. Configure the service account outside the document root; never
// place its key in the web build or Firebase client configuration.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply($status, $body) {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($status, $message) {
    reply($status, ['error' => $message]);
}

function loadWordList($path, $minimum, $description) {
    $documentRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');
    $realPath = is_string($path) ? realpath($path) : false;
    $isPublic = $documentRoot && is_string($realPath) && (
        $documentRoot === DIRECTORY_SEPARATOR
        || $realPath === $documentRoot
        || str_starts_with($realPath, rtrim($documentRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)
    );
    if (!$documentRoot || !$realPath || !is_file($realPath) || !is_readable($realPath) || $isPublic) {
        fail(503, 'The private Wordle ' . $description . ' list is missing or inside the public web root.');
    }
    $lines = file($realPath, FILE_IGNORE_NEW_LINES);
    if ($lines === false) fail(503, 'The Wordle ' . $description . ' list could not be read.');
    $words = [];
    foreach ($lines as $line) {
        $word = strtoupper(trim($line));
        if ($word === '') continue;
        if (!preg_match('/^[A-Z]{5}$/', $word)) {
            fail(503, 'The Wordle ' . $description . ' list must contain one five-letter word per line.');
        }
        $words[$word] = true;
    }
    if (count($words) < $minimum) {
        fail(503, 'The Wordle ' . $description . ' list is incomplete.');
    }
    return array_keys($words);
}

function config() {
    $path = dirname(__DIR__, 2) . '/.align-wordle-config.php';
    if (!is_file($path)) fail(503, 'Wordle is not configured on this server yet.');
    $config = require $path;
    if (!is_array($config)) fail(503, 'Wordle server configuration is invalid.');
    foreach (['projectId', 'apiKey', 'allowedOrigin', 'serviceAccountFile', 'dailySecret', 'answerWordsFile', 'validGuessesFile'] as $key) {
        if (!isset($config[$key])) fail(503, 'Wordle server configuration is incomplete.');
    }
    foreach (['projectId', 'apiKey', 'allowedOrigin', 'serviceAccountFile', 'answerWordsFile', 'validGuessesFile'] as $key) {
        if (!is_string($config[$key]) || trim($config[$key]) === '') fail(503, 'Wordle server configuration is invalid.');
    }
    $origin = parse_url($config['allowedOrigin']);
    if (!is_array($origin) || ($origin['scheme'] ?? '') !== 'https' || empty($origin['host'])
        || isset($origin['path']) || isset($origin['query']) || isset($origin['fragment'])) {
        fail(503, 'The Wordle allowed origin must be an HTTPS origin without a path.');
    }
    if (!is_string($config['dailySecret']) || strlen(trim($config['dailySecret'])) < 32) {
        fail(503, 'Wordle daily secret must be at least 32 characters.');
    }
    $answers = loadWordList($config['answerWordsFile'], 2000, 'answer');
    $guesses = loadWordList($config['validGuessesFile'], 10000, 'valid guess');
    $config['answerWords'] = $answers;
    $config['validGuesses'] = array_fill_keys($guesses, true);
    foreach ($answers as $word) {
        if (!isset($config['validGuesses'][$word])) fail(503, 'Every Wordle answer must also be an accepted guess.');
    }
    return $config;
}

function b64url($value) {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function serviceToken($config) {
    $keyPath = $config['serviceAccountFile'];
    $documentRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');
    $realKeyPath = is_string($keyPath) ? realpath($keyPath) : false;
    $keyIsPublic = $documentRoot && is_string($realKeyPath) && (
        $documentRoot === DIRECTORY_SEPARATOR
        || $realKeyPath === $documentRoot
        || str_starts_with($realKeyPath, rtrim($documentRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)
    );
    if (!$documentRoot || !$realKeyPath || !is_readable($realKeyPath) || $keyIsPublic) {
        fail(503, 'The private Wordle service-account file is missing or is inside the public web root.');
    }
    $account = json_decode(file_get_contents($realKeyPath), true);
    if (!is_array($account) || empty($account['client_email']) || empty($account['private_key'])) {
        fail(503, 'The private Wordle service-account file is invalid.');
    }
    $now = time();
    $claims = [
        'iss' => $account['client_email'],
        'scope' => 'https://www.googleapis.com/auth/datastore',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ];
    $unsigned = b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])) . '.' . b64url(json_encode($claims));
    if (!openssl_sign($unsigned, $signature, $account['private_key'], OPENSSL_ALGO_SHA256)) {
        fail(503, 'Could not sign the Wordle server credential.');
    }
    [$status, $response] = httpJson('POST', 'https://oauth2.googleapis.com/token', [
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $unsigned . '.' . b64url($signature),
    ], null, 'application/x-www-form-urlencoded');
    if ($status !== 200 || !isset($response['access_token'])) fail(503, 'Could not authorize the Wordle server with Firebase.');
    return $response['access_token'];
}

function httpJson($method, $url, $body, $bearer = null, $contentType = 'application/json') {
    if (!function_exists('curl_init')) fail(503, 'The Wordle server requires PHP cURL.');
    $headers = ['Accept: application/json'];
    if ($body !== null) $headers[] = 'Content-Type: ' . $contentType;
    if ($bearer !== null) $headers[] = 'Authorization: Bearer ' . $bearer;
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    if ($body !== null) {
        $payload = $contentType === 'application/x-www-form-urlencoded'
            ? http_build_query($body)
            : (is_string($body) ? $body : json_encode($body));
        curl_setopt($curl, CURLOPT_POSTFIELDS, $payload);
    }
    $text = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($text === false) {
        curl_close($curl);
        fail(502, 'The Wordle server could not reach its authentication or database service.');
    }
    curl_close($curl);
    $decoded = json_decode($text, true);
    if (!is_array($decoded)) $decoded = [];
    return [$status, $decoded];
}

function firestoreUrl($config, $collection, $id = null) {
    $base = 'https://firestore.googleapis.com/v1/projects/' . rawurlencode($config['projectId'])
        . '/databases/(default)/documents/' . rawurlencode($collection);
    return $base . ($id === null ? '' : '/' . rawurlencode($id));
}

function encodeValue($value) {
    if ($value === null) return ['nullValue' => null];
    if (is_bool($value)) return ['booleanValue' => $value];
    if (is_int($value)) return ['integerValue' => (string) $value];
    if (is_float($value)) return ['doubleValue' => $value];
    if (is_string($value)) return ['stringValue' => $value];
    if (is_array($value) && array_is_list($value)) {
        return ['arrayValue' => ['values' => array_map('encodeValue', $value)]];
    }
    if (is_array($value)) {
        return ['mapValue' => ['fields' => encodeFields($value)]];
    }
    throw new RuntimeException('Unsupported Firestore value.');
}

function encodeFields($fields) {
    $encoded = [];
    foreach ($fields as $key => $value) {
        $encoded[$key] = in_array($key, ['startedAt', 'createdAt', 'completedAt', 'updatedAt'], true)
            ? ['timestampValue' => $value]
            : encodeValue($value);
    }
    return $encoded;
}

function decodeValue($value) {
    if (array_key_exists('stringValue', $value)) return $value['stringValue'];
    if (array_key_exists('integerValue', $value)) return (int) $value['integerValue'];
    if (array_key_exists('doubleValue', $value)) return (float) $value['doubleValue'];
    if (array_key_exists('booleanValue', $value)) return $value['booleanValue'];
    if (array_key_exists('timestampValue', $value)) return $value['timestampValue'];
    if (array_key_exists('nullValue', $value)) return null;
    if (isset($value['mapValue']['fields'])) return decodeFields($value['mapValue']['fields']);
    if (isset($value['arrayValue']['values'])) return array_map('decodeValue', $value['arrayValue']['values']);
    if (isset($value['arrayValue'])) return [];
    return null;
}

function decodeFields($fields) {
    $decoded = [];
    foreach ($fields as $key => $value) $decoded[$key] = decodeValue($value);
    return $decoded;
}

function firestoreGet($config, $token, $collection, $id) {
    [$status, $body] = httpJson('GET', firestoreUrl($config, $collection, $id), null, $token);
    if ($status === 404) return null;
    if ($status !== 200 || !isset($body['fields'])) fail(502, 'The Wordle server could not read game data.');
    return ['fields' => decodeFields($body['fields']), 'updateTime' => $body['updateTime'] ?? null];
}

function firestoreCreate($config, $token, $collection, $id, $fields) {
    $url = firestoreUrl($config, $collection) . '?documentId=' . rawurlencode($id);
    [$status, $body] = httpJson('POST', $url, ['fields' => encodeFields($fields)], $token);
    if ($status === 409) return false;
    if ($status !== 200) fail(502, 'The Wordle server could not save game data.');
    return true;
}

function firestorePatch($config, $token, $collection, $id, $fields, $updateTime = null) {
    $query = [];
    foreach (array_keys($fields) as $field) $query[] = 'updateMask.fieldPaths=' . rawurlencode($field);
    if ($updateTime) $query[] = 'currentDocument.updateTime=' . rawurlencode($updateTime);
    $url = firestoreUrl($config, $collection, $id) . '?' . implode('&', $query);
    [$status] = httpJson('PATCH', $url, ['fields' => encodeFields($fields)], $token);
    if ($status === 409 || $status === 412) fail(409, 'This Wordle changed in another tab. Reload the puzzle and try again.');
    if ($status !== 200) fail(502, 'The Wordle server could not update game data.');
}

function requireMember($config, $token, $uid) {
    $household = firestoreGet($config, $token, 'household', 'main');
    $member = $household['fields']['members'][$uid] ?? null;
    if (!is_array($member) || ($member['role'] ?? '') !== 'member') fail(403, 'Wordle is for household members.');
    return $household['fields'];
}

function authenticate($config) {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
                break;
            }
        }
    }
    if (!preg_match('/^Bearer ([A-Za-z0-9._-]+)$/', $header, $match)) fail(401, 'Sign in to play Wordle.');
    [$status, $body] = httpJson(
        'POST',
        'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . rawurlencode($config['apiKey']),
        ['idToken' => $match[1]],
    );
    $uid = $body['users'][0]['localId'] ?? null;
    if ($status !== 200 || !is_string($uid) || $uid === '') fail(401, 'Your sign-in expired. Sign in again to play Wordle.');
    $token = serviceToken($config);
    requireMember($config, $token, $uid);
    return [$uid, $token];
}

function currentDate() {
    return new DateTimeImmutable('now', new DateTimeZone('America/New_York'));
}

function dailySecret($config, $token, $date) {
    $id = 'daily_' . str_replace('-', '', $date);
    $existing = firestoreGet($config, $token, 'wordleSecrets', $id);
    if ($existing) return $existing['fields'];
    $words = $config['answerWords'];
    $index = hexdec(substr(hash_hmac('sha256', $date, $config['dailySecret']), 0, 8)) % count($words);
    $answer = $words[$index];
    $fields = ['mode' => 'daily', 'date' => $date, 'answer' => $answer];
    firestoreCreate($config, $token, 'wordleSecrets', $id, $fields);
    $stored = firestoreGet($config, $token, 'wordleSecrets', $id);
    if (!$stored) fail(502, 'The daily Wordle could not be initialized.');
    return $stored['fields'];
}

function newProgress($config, $token, $id, $uid, $seed, $length, $answer) {
    $now = gmdate('Y-m-d\TH:i:s\Z');
    $fields = [
        'uid' => $uid,
        'seed' => $seed,
        'length' => $length,
        'answer' => $answer,
        'guessesJson' => '[]',
        'startedAt' => $now,
        'complete' => false,
        'solved' => false,
    ];
    firestoreCreate($config, $token, 'wordleProgress', $id, $fields);
    return firestoreGet($config, $token, 'wordleProgress', $id);
}

function elapsedMs($startedAt) {
    $start = new DateTimeImmutable($startedAt);
    return max(1, (int) round((microtime(true) - (float) $start->format('U.u')) * 1000));
}

function wordleMarks($answer, $guess) {
    $answer = strtoupper($answer);
    $guess = strtoupper($guess);
    $marks = array_fill(0, strlen($answer), 'absent');
    $remaining = [];
    for ($i = 0; $i < strlen($answer); $i++) {
        if ($answer[$i] === $guess[$i]) $marks[$i] = 'correct';
        else $remaining[$answer[$i]] = ($remaining[$answer[$i]] ?? 0) + 1;
    }
    for ($i = 0; $i < strlen($guess); $i++) {
        if ($marks[$i] === 'correct') continue;
        if (($remaining[$guess[$i]] ?? 0) > 0) {
            $marks[$i] = 'present';
            $remaining[$guess[$i]]--;
        }
    }
    return $marks;
}

function hardModeError($previousGuesses, $guess) {
    $requiredLetters = [];
    $fixedLetters = [];
    $excludedPositions = [];
    foreach ($previousGuesses as $row) {
        $rowRequired = [];
        foreach (str_split($row['word']) as $index => $letter) {
            $mark = $row['marks'][$index] ?? 'absent';
            if ($mark === 'correct') {
                $fixedLetters[$index] = $letter;
                $rowRequired[$letter] = ($rowRequired[$letter] ?? 0) + 1;
            } elseif ($mark === 'present') {
                $rowRequired[$letter] = ($rowRequired[$letter] ?? 0) + 1;
                $excludedPositions[$index][$letter] = true;
            }
        }
        foreach ($rowRequired as $letter => $count) {
            $requiredLetters[$letter] = max($requiredLetters[$letter] ?? 0, $count);
        }
    }

    $attempt = str_split($guess);
    foreach ($fixedLetters as $index => $letter) {
        if (($attempt[$index] ?? '') !== $letter) return 'Keep ' . $letter . ' in position ' . ($index + 1) . '.';
    }
    foreach ($excludedPositions as $index => $letters) {
        if (isset($letters[$attempt[$index] ?? ''])) {
            return 'Move ' . $attempt[$index] . ' from position ' . ($index + 1) . '.';
        }
    }
    foreach ($requiredLetters as $letter => $count) {
        if (substr_count($guess, $letter) < $count) {
            return 'Use at least ' . $count . ' ' . $letter . ($count === 1 ? '' : 's') . ' revealed by your earlier guesses.';
        }
    }
    return null;
}

function updateBestScore($config, $token, $uid, $seed, $guesses, $ms, $length) {
    $id = $uid . '_wordle_' . $seed;
    $old = firestoreGet($config, $token, 'gameScores', $id);
    $best = $old['fields']['best'] ?? null;
    $result = ['guesses' => $guesses, 'ms' => $ms];
    if ($length === 5) $result['hardMode'] = true;
    $isBetter = !is_array($best)
        || $guesses < ($best['guesses'] ?? PHP_INT_MAX)
        || ($guesses === ($best['guesses'] ?? PHP_INT_MAX) && $ms < ($best['ms'] ?? PHP_INT_MAX));
    $fields = [
        'uid' => $uid,
        'gameId' => 'wordle',
        'seed' => $seed,
        'best' => $isBetter ? $result : $best,
        'plays' => ($old['fields']['plays'] ?? 0) + 1,
        'updatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
    ];
    if ($old) firestorePatch($config, $token, 'gameScores', $id, $fields, $old['updateTime']);
    else firestoreCreate($config, $token, 'gameScores', $id, $fields);
}

function stateResponse($mode, $seed, $length, $progress, $date = null, $challengeStatus = null) {
    $fields = $progress['fields'];
    $guesses = json_decode($fields['guessesJson'] ?? '[]', true);
    if (!is_array($guesses)) $guesses = [];
    $elapsed = !empty($fields['complete']) ? (int) ($fields['elapsedMs'] ?? elapsedMs($fields['startedAt'])) : elapsedMs($fields['startedAt']);
    $state = [
        'mode' => $mode,
        'seed' => $seed,
        'length' => $length,
        'guesses' => $guesses,
        'startedAt' => $fields['startedAt'],
        'elapsedMs' => $elapsed,
        'complete' => (bool) ($fields['complete'] ?? false),
        'solved' => (bool) ($fields['solved'] ?? false),
    ];
    if ($date !== null) $state['date'] = $date;
    if ($state['complete']) $state['answer'] = $fields['answer'];
    if (!empty($fields['abandoned'])) $state['abandoned'] = true;
    if ($challengeStatus !== null) $state['challengeStatus'] = $challengeStatus;
    return $state;
}

function dailyState($config, $token, $uid, $guess = null) {
    $date = currentDate()->format('Y-m-d');
    $secret = dailySecret($config, $token, $date);
    $seed = 'daily-' . $date;
    $progressId = 'daily_' . str_replace('-', '', $date) . '_' . $uid;
    $progress = firestoreGet($config, $token, 'wordleProgress', $progressId);
    if (!$progress) $progress = newProgress($config, $token, $progressId, $uid, $seed, 5, $secret['answer']);
    if ($guess !== null) $progress = submitGuess($config, $token, $progressId, $progress, $guess, $uid, $seed);
    return stateResponse('daily', $seed, 5, $progress, $date);
}

function abandonDailyWordle($config, $token, $uid) {
    $date = currentDate()->format('Y-m-d');
    $secret = dailySecret($config, $token, $date);
    $seed = 'daily-' . $date;
    $progressId = 'daily_' . str_replace('-', '', $date) . '_' . $uid;
    $progress = firestoreGet($config, $token, 'wordleProgress', $progressId);
    if (!$progress) $progress = newProgress($config, $token, $progressId, $uid, $seed, 5, $secret['answer']);
    $fields = $progress['fields'];
    if (!empty($fields['complete'])) fail(409, 'This Wordle is already complete.');
    $elapsed = elapsedMs($fields['startedAt']);
    firestorePatch($config, $token, 'wordleProgress', $progressId, [
        'complete' => true,
        'solved' => false,
        'elapsedMs' => $elapsed,
        'abandoned' => true,
    ], $progress['updateTime']);
    $finished = firestoreGet($config, $token, 'wordleProgress', $progressId);
    return stateResponse('daily', $seed, 5, $finished, $date);
}

function challengeProgressId($groupId, $uid) {
    return 'custom_' . $groupId . '_' . $uid;
}

function challengeHasLiveProgress($secret) {
    // Older challenges all published live progress, so keep that behavior when no type was stored.
    return ($secret['fields']['challengeType'] ?? 'live-chosen') !== 'invite';
}

function ensureChallengeProgress($config, $token, $groupId, $uid, $participants, $length) {
    $id = challengeProgressId($groupId, $uid);
    $existing = firestoreGet($config, $token, 'wordleChallengeProgress', $id);
    if ($existing) return $existing;
    firestoreCreate($config, $token, 'wordleChallengeProgress', $id, [
        'groupId' => $groupId,
        'uid' => $uid,
        'participants' => $participants,
        'length' => $length,
        'rows' => [],
        'started' => false,
        'complete' => false,
        'solved' => false,
        'updatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
    ]);
    $created = firestoreGet($config, $token, 'wordleChallengeProgress', $id);
    if (!$created) fail(502, 'The Wordle challenge progress could not be initialized.');
    return $created;
}

function challengeState($config, $token, $uid, $challengeId, $guess = null) {
    if (!is_string($challengeId) || !preg_match('/^[a-f0-9]{32}$/', $challengeId)) fail(400, 'That Wordle challenge link is invalid.');
    $challenge = firestoreGet($config, $token, 'gameChallenges', $challengeId);
    if (!$challenge || ($challenge['fields']['gameId'] ?? '') !== 'wordle' || ($challenge['fields']['to'] ?? '') !== $uid) {
        fail(404, 'That Wordle challenge is unavailable for this account.');
    }
    $fields = $challenge['fields'];
    $status = $fields['status'] ?? '';
    if (!in_array($status, ['pending', 'completed', 'abandoned'], true)) fail(409, 'That Wordle challenge is no longer available.');
    $groupId = $fields['payload']['puzzleId'] ?? '';
    if (!is_string($groupId) || !preg_match('/^[a-f0-9]{32}$/', $groupId)) fail(502, 'The Wordle challenge data is invalid.');
    $secret = firestoreGet($config, $token, 'wordleSecrets', 'custom_' . $groupId);
    if (!$secret || !in_array($uid, $secret['fields']['recipients'] ?? [], true)) fail(404, 'The Wordle answer is not available for this account.');
    $participants = $secret['fields']['recipients'];
    $viewers = $secret['fields']['participants'] ?? array_values(array_unique(array_merge([$secret['fields']['from']], $participants)));
    $seed = 'custom-' . $groupId;
    $progressId = 'custom_' . $challengeId;
    $progress = firestoreGet($config, $token, 'wordleProgress', $progressId);
    if (!$progress) $progress = newProgress($config, $token, $progressId, $uid, $seed, $secret['fields']['length'], $secret['fields']['answer']);
    $liveProgress = challengeHasLiveProgress($secret);
    if ($liveProgress) {
        $publicProgress = ensureChallengeProgress($config, $token, $groupId, $uid, $viewers, $secret['fields']['length']);
        if ($status === 'pending' && empty($publicProgress['fields']['started'])) {
            firestorePatch($config, $token, 'wordleChallengeProgress', challengeProgressId($groupId, $uid), [
                'started' => true,
                'updatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
            ]);
        }
    }
    if ($guess !== null) {
        $progress = submitGuess(
            $config,
            $token,
            $progressId,
            $progress,
            $guess,
            $uid,
            $seed,
            $challengeId,
            $liveProgress ? $groupId : null,
            $viewers,
        );
    }
    $latestChallenge = firestoreGet($config, $token, 'gameChallenges', $challengeId);
    return stateResponse('custom', $seed, $secret['fields']['length'], $progress, null, $latestChallenge['fields']['status'] ?? $status);
}

function pendingWordleChallenge($config, $token, $uid, $challengeId) {
    if (!is_string($challengeId) || !preg_match('/^[a-f0-9]{32}$/', $challengeId)) fail(400, 'That Wordle challenge link is invalid.');
    $challenge = firestoreGet($config, $token, 'gameChallenges', $challengeId);
    if (!$challenge || ($challenge['fields']['gameId'] ?? '') !== 'wordle' || ($challenge['fields']['to'] ?? '') !== $uid) {
        fail(404, 'That Wordle challenge is unavailable for this account.');
    }
    if (($challenge['fields']['status'] ?? '') !== 'pending') fail(409, 'That Wordle challenge is no longer available.');
    $groupId = $challenge['fields']['payload']['puzzleId'] ?? '';
    if (!is_string($groupId) || !preg_match('/^[a-f0-9]{32}$/', $groupId)) fail(502, 'The Wordle challenge data is invalid.');
    $secret = firestoreGet($config, $token, 'wordleSecrets', 'custom_' . $groupId);
    if (!$secret || !in_array($uid, $secret['fields']['recipients'] ?? [], true)) fail(404, 'The Wordle answer is not available for this account.');
    $participants = $secret['fields']['participants'] ?? array_values(array_unique(array_merge(
        [$secret['fields']['from']],
        $secret['fields']['recipients'],
    )));
    return [$challenge, $secret, $groupId, $participants];
}

function declineWordleChallenge($config, $token, $uid, $challengeId) {
    [$challenge, $secret, $groupId, $participants] = pendingWordleChallenge($config, $token, $uid, $challengeId);
    if (challengeHasLiveProgress($secret)) {
        $progress = ensureChallengeProgress($config, $token, $groupId, $uid, $participants, (int) $secret['fields']['length']);
        firestorePatch($config, $token, 'wordleChallengeProgress', challengeProgressId($groupId, $uid), [
            'complete' => true,
            'solved' => false,
            'status' => 'declined',
            'updatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
        ], $progress['updateTime']);
    }
    firestorePatch($config, $token, 'gameChallenges', $challengeId, [
        'status' => 'declined',
        'completedAt' => gmdate('Y-m-d\TH:i:s\Z'),
    ], $challenge['updateTime']);
    return ['challengeStatus' => 'declined'];
}

function abandonWordleChallenge($config, $token, $uid, $challengeId) {
    [$challenge, $secret, $groupId, $participants] = pendingWordleChallenge($config, $token, $uid, $challengeId);
    $seed = 'custom-' . $groupId;
    $progressId = 'custom_' . $challengeId;
    $progress = firestoreGet($config, $token, 'wordleProgress', $progressId);
    if (!$progress) $progress = newProgress($config, $token, $progressId, $uid, $seed, $secret['fields']['length'], $secret['fields']['answer']);
    $fields = $progress['fields'];
    if (!empty($fields['complete'])) fail(409, 'This Wordle is already complete.');
    $guesses = json_decode($fields['guessesJson'] ?? '[]', true);
    if (!is_array($guesses)) $guesses = [];
    $elapsed = elapsedMs($fields['startedAt']);
    firestorePatch($config, $token, 'wordleProgress', $progressId, [
        'complete' => true,
        'solved' => false,
        'elapsedMs' => $elapsed,
        'abandoned' => true,
    ], $progress['updateTime']);
    if (challengeHasLiveProgress($secret)) {
        $publicProgress = ensureChallengeProgress($config, $token, $groupId, $uid, $participants, (int) $secret['fields']['length']);
        firestorePatch($config, $token, 'wordleChallengeProgress', challengeProgressId($groupId, $uid), [
            'complete' => true,
            'solved' => false,
            'status' => 'abandoned',
            'elapsedMs' => $elapsed,
            'updatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
        ], $publicProgress['updateTime']);
    }
    firestorePatch($config, $token, 'gameChallenges', $challengeId, [
        'status' => 'abandoned',
        'result' => [
            'guesses' => count($guesses),
            'ms' => $elapsed,
            'solved' => false,
            'hardMode' => (int) $secret['fields']['length'] === 5,
            'abandoned' => true,
        ],
        'completedAt' => gmdate('Y-m-d\TH:i:s\Z'),
    ], $challenge['updateTime']);
    $finished = firestoreGet($config, $token, 'wordleProgress', $progressId);
    return stateResponse('custom', $seed, (int) $secret['fields']['length'], $finished, null, 'abandoned');
}

function submitGuess($config, $token, $progressId, $progress, $guess, $uid, $seed, $challengeId = null, $groupId = null, $participants = []) {
    if (!is_string($guess) || !preg_match('/^[A-Za-z]{2,12}$/', $guess)) fail(400, 'Enter a word using letters only.');
    $fields = $progress['fields'];
    if (!empty($fields['complete'])) fail(409, 'This Wordle is already complete.');
    if (strlen($guess) !== (int) $fields['length']) fail(400, 'Your guess must match the word length.');
    $guess = strtoupper($guess);
    if ((int) $fields['length'] === 5 && !isset($config['validGuesses'][$guess])) {
        fail(400, 'That is not an accepted five-letter Wordle guess.');
    }
    $guesses = json_decode($fields['guessesJson'] ?? '[]', true);
    if (!is_array($guesses)) $guesses = [];
    if (count($guesses) >= 6) fail(409, 'You have used all six guesses.');
    if ((int) $fields['length'] === 5) {
        $violation = hardModeError($guesses, $guess);
        if ($violation !== null) fail(400, 'Hard mode: ' . $violation);
    }
    $marks = wordleMarks($fields['answer'], $guess);
    $guesses[] = ['word' => $guess, 'marks' => $marks];
    $solved = $guess === strtoupper($fields['answer']);
    $complete = $solved || count($guesses) >= 6;
    $elapsed = $complete ? elapsedMs($fields['startedAt']) : null;
    $updates = [
        'guessesJson' => json_encode($guesses),
        'complete' => $complete,
        'solved' => $solved,
    ];
    if ($complete) $updates['elapsedMs'] = $elapsed;
    firestorePatch($config, $token, 'wordleProgress', $progressId, $updates, $progress['updateTime']);
    if ($challengeId !== null && $groupId !== null) {
        $publicProgress = ensureChallengeProgress($config, $token, $groupId, $uid, $participants, (int) $fields['length']);
        firestorePatch($config, $token, 'wordleChallengeProgress', challengeProgressId($groupId, $uid), [
            'rows' => array_map(static fn($row) => implode('', array_map(
                static fn($mark) => ['correct' => 'C', 'present' => 'P', 'absent' => 'A'][$mark] ?? 'A',
                $row['marks'],
            )), $guesses),
            'complete' => $complete,
            'solved' => $solved,
            'started' => true,
            'elapsedMs' => $complete ? $elapsed : null,
            'updatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
        ], $publicProgress['updateTime']);
    }
    if ($complete) {
        if ($solved) updateBestScore($config, $token, $uid, $seed, count($guesses), $elapsed, (int) $fields['length']);
        if ($challengeId !== null) {
            $currentChallenge = firestoreGet($config, $token, 'gameChallenges', $challengeId);
            if ($currentChallenge && $currentChallenge['fields']['status'] === 'pending') {
                firestorePatch($config, $token, 'gameChallenges', $challengeId, [
                    'status' => 'completed',
                    'result' => [
                        'guesses' => count($guesses),
                        'ms' => $elapsed,
                        'solved' => $solved,
                        'hardMode' => (int) $fields['length'] === 5,
                    ],
                    'completedAt' => gmdate('Y-m-d\TH:i:s\Z'),
                ], $currentChallenge['updateTime']);
            }
        }
    }
    return firestoreGet($config, $token, 'wordleProgress', $progressId);
}

function createCustomChallenges($config, $token, $uid, $body) {
    $challengeType = $body['challengeType'] ?? (($body['randomWord'] ?? false) === true ? 'random-live' : 'invite');
    if (!in_array($challengeType, ['invite', 'live-chosen', 'random-live'], true)) {
        fail(400, 'Choose a valid Wordle challenge type.');
    }
    $randomWord = $challengeType === 'random-live';
    $liveProgress = $challengeType !== 'invite';
    $word = $randomWord
        ? $config['answerWords'][random_int(0, count($config['answerWords']) - 1)]
        : strtoupper(trim(is_string($body['word'] ?? null) ? $body['word'] : ''));
    $recipients = $body['recipients'] ?? null;
    if (!$randomWord && !preg_match('/^[A-Za-z]{2,12}$/', $word)) fail(400, 'Choose a word from 2 to 12 letters long.');
    if (strlen($word) === 5 && !isset($config['validGuesses'][$word])) {
        fail(400, 'Choose an accepted five-letter Wordle word.');
    }
    if (!is_array($recipients)) fail(400, 'Choose at least one family member to challenge.');
    $recipients = array_values(array_unique(array_filter($recipients, static fn($to) => is_string($to))));
    if ($randomWord) {
        if (!in_array($uid, $recipients, true) || count($recipients) < 2 || count($recipients) > 10) {
            fail(400, 'A live Wordle challenge needs you and 1 to 9 other participants.');
        }
    } else {
        if (in_array($uid, $recipients, true)) fail(400, 'Choose other family members; you cannot join this challenge.');
        if (count($recipients) < 1 || count($recipients) > 10) fail(400, 'Choose between 1 and 10 people to challenge.');
    }
    $players = $recipients;
    $viewers = array_values(array_unique(array_merge([$uid], $players)));
    $household = requireMember($config, $token, $uid);
    foreach ($players as $to) {
        if (($household['members'][$to]['role'] ?? '') !== 'member') fail(400, 'Every recipient must be a household member.');
    }
    $groupId = bin2hex(random_bytes(16));
    $seed = 'custom-' . $groupId;
    firestoreCreate($config, $token, 'wordleSecrets', 'custom_' . $groupId, [
        'mode' => 'custom',
        'answer' => $word,
        'length' => strlen($word),
        'challengeType' => $challengeType,
        'from' => $uid,
        'recipients' => $players,
        'participants' => $viewers,
        'createdAt' => gmdate('Y-m-d\TH:i:s\Z'),
    ]);
    $ownChallengeId = null;
    foreach ($players as $to) {
        $challengeId = bin2hex(random_bytes(16));
        if ($to === $uid) $ownChallengeId = $challengeId;
        $challenge = [
            'gameId' => 'wordle',
            'from' => $uid,
            'to' => $to,
            'challengeType' => $challengeType,
            'payload' => ['puzzleId' => $groupId, 'wordLength' => strlen($word), 'version' => 1],
            'status' => 'pending',
            'createdAt' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
        $challenge['participants'] = $viewers;
        $challenge['players'] = $players;
        firestoreCreate($config, $token, 'gameChallenges', $challengeId, $challenge);
        if ($liveProgress) ensureChallengeProgress($config, $token, $groupId, $to, $viewers, strlen($word));
    }
    $result = [
        'invited' => count(array_filter($players, static fn($to) => $to !== $uid)),
        'participants' => count($players),
    ];
    if ($ownChallengeId !== null) $result['challengeId'] = $ownChallengeId;
    return $result;
}

try {
    $config = config();
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && !hash_equals($config['allowedOrigin'], $origin)) fail(403, 'This origin cannot use the Wordle service.');
    if ($origin !== '') header('Access-Control-Allow-Origin: ' . $config['allowedOrigin']);
    header('Vary: Origin');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Access-Control-Max-Age: 600');
        http_response_code(204);
        exit;
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST, OPTIONS');
        fail(405, 'Use POST for Wordle actions.');
    }
    $raw = file_get_contents('php://input', false, null, 0, 8193);
    if ($raw === false || strlen($raw) > 8192) fail(413, 'The Wordle request is too large.');
    $body = json_decode($raw, true);
    if (!is_array($body)) fail(400, 'The Wordle request is invalid.');
    [$uid, $token] = authenticate($config);
    $action = $body['action'] ?? '';
    switch ($action) {
        case 'daily_status':
            reply(200, dailyState($config, $token, $uid));
        case 'daily_guess':
            reply(200, dailyState($config, $token, $uid, $body['guess'] ?? null));
        case 'daily_abandon':
            reply(200, abandonDailyWordle($config, $token, $uid));
        case 'challenge_status':
            reply(200, challengeState($config, $token, $uid, $body['challengeId'] ?? null));
        case 'challenge_guess':
            reply(200, challengeState($config, $token, $uid, $body['challengeId'] ?? null, $body['guess'] ?? null));
        case 'challenge_decline':
            reply(200, declineWordleChallenge($config, $token, $uid, $body['challengeId'] ?? null));
        case 'challenge_abandon':
            reply(200, abandonWordleChallenge($config, $token, $uid, $body['challengeId'] ?? null));
        case 'custom_create':
            reply(200, createCustomChallenges($config, $token, $uid, $body));
        default:
            fail(400, 'Unknown Wordle action.');
    }
} catch (Throwable $error) {
    error_log('Wordle endpoint failed: ' . $error->getMessage());
    fail(500, 'Wordle could not complete that request. Please try again.');
}
