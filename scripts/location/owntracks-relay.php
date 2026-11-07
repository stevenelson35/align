<?php
// OwnTracks → Align's Apps Script relay (scripts/location/README.md). The build copies this to dist/owntracks.php with
// the web app URL filled in.
//
// Apps Script answers every POST with a 302 to the response. OwnTracks for iPhone doesn't follow redirects and treats
// the 302 as a failed send: the report stays first in its queue and is sent again forever, so the map never moves
// past the first report. This page posts the report to the script itself, follows the redirect, and answers 200.
// It only ever posts to the one fixed URL, so it can't be used to reach anything else.

$target = '__ALIGN_APPS_SCRIPT_URL__';

header('Content-Type: application/json');
header('Cache-Control: no-store');

// OwnTracks keeps a report and retries it later on 5xx; on 4xx it drops it and shows the error on the phone.
function reply($status, $body = '[]') {
    http_response_code($status);
    echo $body;
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reply(405);
}
$loc = isset($_GET['loc']) && is_string($_GET['loc']) ? $_GET['loc'] : '';
if (!preg_match('/^[A-Za-z0-9]{1,128}\.[0-9a-f]{32}$/', $loc)) reply(403);
$body = file_get_contents('php://input', false, null, 0, 65537);
if ($body === false || strlen($body) > 65536) reply(413);

$url = $target . (strpos($target, '?') === false ? '?' : '&') . 'loc=' . rawurlencode($loc);
[$status, $text] = function_exists('curl_init') && !getenv('ALIGN_RELAY_NO_CURL') ? viaCurl($url, $body) : viaStream($url, $body);
if ($status !== 200 || $text === null) reply(502);

$json = json_decode($text, true);
// The script's {ok: false} answers: a link it doesn't recognize is permanent; anything else (Firestore busy, …) is
// worth retrying.
if (is_array($json) && array_key_exists('ok', $json) && $json['ok'] === false) {
    reply(($json['error'] ?? '') === 'Unknown location link.' ? 403 : 502);
}
reply(200, is_array($json) && ($json === [] || array_keys($json) === range(0, count($json) - 1)) ? $text : '[]');

// curl turns the POST into a GET on the 302, which is what Apps Script's redirect expects.
function viaCurl($url, $body) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 45,
    ]);
    $text = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    return [$status, $text === false ? null : $text];
}

// Without curl: PHP's http wrapper also follows the 302 with a GET.
function viaStream($url, $body) {
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $body,
        'follow_location' => 1,
        'max_redirects' => 4,
        'timeout' => 45,
        'ignore_errors' => true,
    ]]);
    $text = @file_get_contents($url, false, $context);
    $status = 0;
    // $http_response_header holds every response in the chain; the last status line is the final answer.
    foreach ($http_response_header ?? [] as $line) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) $status = (int) $m[1];
    }
    return [$status, $text === false ? null : $text];
}
