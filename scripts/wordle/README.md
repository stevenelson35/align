# Wordle server setup

The browser never receives an answer until its daily game or custom challenge is over. `wordle.php` verifies each
Firebase ID token, checks household membership, and uses a server-only service account to read/write the private
answer and progress collections. Live challenges publish colored marks only; actual guesses and answers remain
private. The service-account key and daily selection secret must stay outside the web root and out of the repository.

The existing Turbify hosting plan serves this PHP endpoint; Firebase Auth and Firestore usage stays within their free
quotas (Spark projects stop accepting requests at quota limits rather than silently billing for overages).

## One-time server configuration

1. In Google Cloud Console for the same Firebase project, create a service account for the Wordle endpoint and grant it
   **Cloud Datastore User**. Create a JSON key and place it somewhere outside the Align document root. Do not commit or
   send the key.
2. Create `.align-wordle-config.php` in the hosting account's home directory, outside `public_html`, with permissions
   limited to the hosting account. For the Turbify layout where `wordle.php` is at
   `/home/ACCOUNT/public_html/align.itsallonesong.com/wordle.php`, the endpoint looks for
   `/home/ACCOUNT/.align-wordle-config.php`. For example:

   Download the two newline-separated word lists to files outside the document root:

   - Answer words: <https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b/raw/>
   - Accepted guesses: <https://raw.githubusercontent.com/tabatkins/wordle-list/main/words>

   Save them as `wordle-answers.txt` and `wordle-guesses.txt` in a private directory. The endpoint checks that the
   files contain at least 2,000 and 10,000 unique five-letter words respectively, and that every answer is also an
   accepted guess. These files are read by PHP and must not be put in the public web directory or committed to Align.

   ```php
   <?php
   return [
       'projectId' => 'your-firebase-project-id',
       'apiKey' => 'your-firebase-web-api-key',
       'allowedOrigin' => 'https://align.itsallonesong.com',
       'serviceAccountFile' => '/home/your-account/private/align-wordle-service-account.json',
       'dailySecret' => 'replace-with-at-least-32-random-characters',
       'answerWordsFile' => '/home/your-account/private/wordle-answers.txt',
       'validGuessesFile' => '/home/your-account/private/wordle-guesses.txt',
   ];
   ```

   Set `apiKey` to the exact production Firebase web API key in `.env.production.local`
   (`VITE_FIREBASE_API_KEY`) for the same project. This is a public web-app key, not a service credential. A mismatch
   makes the endpoint reject an otherwise valid sign-in token.

   Set `serviceAccountFile` to the exact absolute path of the JSON key file on the server. Confirm the file exists,
   is readable by PHP, and is outside the document root; the endpoint deliberately refuses keys in the public web
   directory. Keep both the JSON key and this config out of the repository.

   Generate the `dailySecret` on the server with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`. The secret
   HMAC picks a stable answer from the answer list for each date; live challenges select a random answer from that
   same list. Answers are saved in the server-only `wordleSecrets` collection. All five-letter games use accepted
   guesses only and enforce hard mode.

   Hard mode keeps green letters in place and requires revealed yellow letters, including repeated letters, but permits
   yellow letters in the same position in later guesses. Run `php tests/wordle/hard-mode.php` from the repository root
   to check the PHP implementation.
3. Confirm Turbify runs PHP 8.1+ with cURL and OpenSSL. After building and uploading, `GET
   https://align.itsallonesong.com/wordle.php` should return JSON `405`, never PHP source. A POST without a valid
   Firebase ID token should return JSON `401`.

## Troubleshooting

- **“Your sign-in expired”**: verify `.align-wordle-config.php` uses the production web app `apiKey` from
  `.env.production.local`, and that the key belongs to the configured Firebase `projectId`.
- **“The private Wordle service-account file is missing or is inside the public web root”**: verify the
  `serviceAccountFile` absolute path and filename, then confirm the file exists and PHP can read it outside the
  document root.
- Turbify may send JSON error bodies with HTTP `200` instead of the status selected by PHP. The browser checks the
  JSON `error` field as well as the HTTP status, so use the visible error message to diagnose setup rather than
  assuming a `200` response means the action succeeded.

## Build and deploy

`npm run build` emits `dist/wordle.php` from `wordle-api.php`; normal web deployment uploads it alongside `index.html`.
Update the private config and install both word-list files before uploading the changed endpoint. Deploy the changed
Firestore rules before the web app. The rules deny all client access to `wordleSecrets` and `wordleProgress`, deny
clients writing Wordle scores or invitations, and permit only challenge participants to read `wordleChallengeProgress`.
That collection contains six rows of color marks and finish status, never guess text. Progress updates live for the
sender and all invitees. Invitees can decline, and a player can give up; both outcomes appear in the live challenge
panel for the other players. Daily Wordle can also be ended by giving up. Each player's timer starts when they open
their own game except in Real-time Live Wordle.

Word challenges have four types: a chosen-word invite (players solve separately), a live chosen-word challenge
(the sender watches while invitees solve), a live random-word challenge (the sender joins the invited players), and
Real-time Live Wordle. In the real-time lobby each participant opens their invitation and taps Ready. The shared
timer and game start only after everyone is ready; any participant can cancel while it is waiting. The lobby expires
15 minutes after creation, but with no scheduled backend the timeout is applied on the next endpoint request after
the deadline, not at an exact instant while everyone is offline. Only live types publish colored guess rows; all
challenge types update invite statuses and completion results.
The service account uses IAM on the server and is not subject to client Firestore rules.
