# Wordle server setup

The browser never receives an answer until its daily game or custom challenge is over. `wordle.php` verifies each
Firebase ID token, checks household membership, and uses a server-only service account to read/write the private
answer and progress collections. The service-account key and daily selection secret must stay outside the web root and
out of the repository.

The existing Turbify hosting plan serves this PHP endpoint; Firebase Auth and Firestore usage stays within their free
quotas (Spark projects stop accepting requests at quota limits rather than silently billing for overages).

## One-time server configuration

1. In Google Cloud Console for the same Firebase project, create a service account for the Wordle endpoint and grant it
   **Cloud Datastore User**. Create a JSON key and place it somewhere outside the Align document root. Do not commit or
   send the key.
2. Create `.align-wordle-config.php` in the parent directory of the document root, with permissions limited to the
   hosting account. For example:

   ```php
   <?php
   return [
       'projectId' => 'your-firebase-project-id',
       'apiKey' => 'your-firebase-web-api-key',
       'allowedOrigin' => 'https://align.itsallonesong.com',
       'serviceAccountFile' => '/home/your-account/.align-wordle-service-account.json',
       'dailySecret' => 'replace-with-at-least-32-random-characters',
       'dailyWords' => [
           'apple', 'brave', 'cabin', 'dance', 'eager', 'flame', 'grape', 'happy',
           'ivory', 'jolly', 'kneel', 'lemon', 'mango', 'noble', 'ocean', 'peace',
           'quiet', 'river', 'smile', 'tiger', 'uncle', 'vivid', 'water', 'young',
       ],
   ];
   ```

   Use the Firebase web API key from the production app configuration. It is not a service credential. Generate the
   `dailySecret` on the server with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`. Replace the sample daily
   words with a substantially larger, family-friendly list of unique five-letter words. The secret HMAC picks a
   stable answer for each date; the endpoint saves that answer in the server-only `wordleSecrets` collection.
3. Confirm Turbify runs PHP 8.1+ with cURL and OpenSSL. After building and uploading, `GET
   https://align.itsallonesong.com/wordle.php` should return JSON `405`, never PHP source. A POST without a valid
   Firebase ID token should return JSON `401`.

## Build and deploy

`npm run build` emits `dist/wordle.php` from `wordle-api.php`; normal web deployment uploads it alongside `index.html`.
Deploy the changed Firestore rules before the web app. The rules deny all client access to `wordleSecrets` and
`wordleProgress`, deny clients writing Wordle scores or invitations, and still permit family members to read the
public scores and recipient-visible invitations. The service account uses IAM on the server and is not subject to
client Firestore rules.
