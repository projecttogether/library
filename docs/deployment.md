# Deployment

For the person who runs Library on a Linux server, such as a VPS with Debian
or Ubuntu: [what runs](#what-runs), [setup](#setup),
[settings from the command line](#settings-from-the-command-line),
[health checks](#health-checks), [upgrades](#upgrades), and
[builds and deploys](#builds-and-deploys). Every environment variable is
described in [Configuration](configuration.md).

## What runs

The [Deploy workflow](#builds-and-deploys) builds the image
`ghcr.io/projecttogether/library` (linux/amd64) from every commit on `main`
that passes CI, tagged `sha-<commit>` and `latest`. There are no numbered
releases: the commit is the version. `LIBRARY_IMAGE_TAG` in `.env` picks the
image: `latest` (the default) or `sha-<commit>` for one build. The image's
command selects the process:

| Command          | What it does                                                                                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrate`        | Applies the SQL migrations in `drizzle/`, then exits. Run it before `web` and `worker` start, on every deployment                                                                                                                                                                 |
| `web`            | The Next.js server on port 3000                                                                                                                                                                                                                                                   |
| `worker`         | Background jobs: uploads (text, screen, duplicate check, AI draft), the Slack bot and the intake mailbox, notifications, reminders and weekly digests, the webhook, and the Keycloak directory sync. One is enough; more can run, since jobs are coordinated through the database |
| `directory-sync` | Runs one Keycloak directory sync, then exits                                                                                                                                                                                                                                      |
| `cli …`          | The operator command ([below](#settings-from-the-command-line)); also `cli` on the image's `PATH`                                                                                                                                                                                 |

Scripts in the image run with `node dist/<name>.mjs`: `taxonomy-import` and
`replay` ([taxonomy and replay test](taxonomy.md)).

| File                    | Contains                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| `Dockerfile`            | The image, with `ocrmypdf` for scanned PDFs. Its command picks the process.  |
| `compose.yaml`          | A one-off `migrate`, the web app (`web`) and the `worker`.                   |
| `compose.postgres.yaml` | Adds a PostgreSQL 18 container, for servers without a database of their own. |
| `compose.dev.yaml`      | Development only: PostgreSQL, Keycloak, S3 storage and Mailpit.              |

The library needs PostgreSQL 18. Background jobs (pg-boss) keep their tables
in the `pgboss` schema of the same database. The image runs as an
unprivileged user (uid 1000). `web` and `worker` share the volume
`originals` (`/data/originals`) for originals with
`STORAGE_DRIVER=filesystem`; `compose.postgres.yaml` keeps the database in
the volume `postgres-data`.

Put a reverse proxy that terminates TLS in front of `web` (Caddy, see
[setup](#setup)) and use its public URL as `LIBRARY_BASE_URL`. Use exactly
that URL: sign-in redirects and links in messages are built from it. `web`
answers on `127.0.0.1:3000` of the host, on the server only. When another
service holds that port (Docker reports `port is already allocated`), set
`LIBRARY_PORT` to a free one. Set `TZ` to your organization's time zone
(default UTC); scheduled jobs run in that zone.

### Storage

`compose.yaml` keeps originals in an S3-compatible bucket by default
(`STORAGE_DRIVER=s3`), such as Hetzner Object Storage, AWS S3, or a
self-hosted MinIO or RustFS. Create a bucket for the library alone and a key
that may only use it. Turn on bucket versioning or copy the bucket to a
second location: the bucket and the database together are the library's
data. With `STORAGE_DRIVER=filesystem`, `web` and `worker` share the
`originals` volume of `compose.yaml` (`STORAGE_DIR=/data/originals`).
Without any `S3_*` variable, storage is off: the library runs and takes
links, and refuses files until storage is set up.

### Building the image yourself

To run your own build, for example of a change that is not on `main` yet,
build the image from a clone of the repository and give it a tag of its own:

```sh
docker build -t ghcr.io/projecttogether/library:local .
# In .env: LIBRARY_IMAGE_TAG=local
docker compose up -d
```

## Setup

On a server with Debian 12 or later, or a similar system such as Ubuntu,
run the commands as root (`sudo -i`).

1. **Docker:** install Docker Engine and the Compose plugin from Docker's
   apt repository ([Debian](https://docs.docker.com/engine/install/debian/),
   [Ubuntu](https://docs.docker.com/engine/install/ubuntu/)), and Git:
   `apt install git`.
2. **Get the files:**

   ```sh
   git clone https://github.com/projecttogether/library.git /srv/library
   cd /srv/library
   ```

3. **Register the library at your provider** with the redirect URI
   `<LIBRARY_BASE_URL>/api/auth/callback/oidc`
   ([identity and access](identity-and-access.md)).
4. **Create `.env`** from `.env.example` (`cp .env.example .env`,
   `chmod 600 .env`) and set the production values
   ([configuration](configuration.md)): `LIBRARY_BASE_URL`, `DATABASE_URL`,
   a new `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), the `OIDC_*`
   variables, `DIRECTORY` with its settings, and for files the `S3_*`
   variables. Remove `NOTIFICATION_TRANSPORT` (production sends for real),
   `AI_PROVIDER=fake`, and the `STORAGE_*` lines ([storage](#storage)).
   The AI model, email, Slack and the other outside services are not set
   here but in the library ([step 2](#first-steps-after-the-first-start)).
   Keep a copy of `.env` apart from the server: `BETTER_AUTH_SECRET` opens
   the secrets the database stores.

   Without a PostgreSQL of your own, set these values for the database.
   `COMPOSE_FILE` makes every `docker compose` command also use
   [`compose.postgres.yaml`](../compose.postgres.yaml), which runs PostgreSQL
   18 next to the library and keeps its data in the volume `postgres-data`:

   ```sh
   COMPOSE_FILE=compose.yaml:compose.postgres.yaml
   # openssl rand -hex 32: no characters that would need escaping in the URL
   POSTGRES_PASSWORD=<password>
   DATABASE_URL=postgres://library:<password>@postgres:5432/library
   ```

   PostgreSQL takes the password once, when it creates the database at the
   first start. Changing `POSTGRES_PASSWORD` later does not change it.

5. **Start:** `docker compose up -d --pull always`.
6. **HTTPS:** point the domain's DNS at the server, install Caddy
   (`apt install caddy`), and put this site into `/etc/caddy/Caddyfile`, in
   place of the package's example site `:80` and next to the sites of other
   apps:

   ```text
   library.example.org {
       reverse_proxy 127.0.0.1:3000
   }
   ```

   With another `LIBRARY_PORT`, use that port. Then
   `systemctl reload caddy`. Caddy gets the certificate itself.

7. Open `LIBRARY_BASE_URL` and take the
   [first steps](#first-steps-after-the-first-start).

## First steps after the first start

1. Sign in as an admin: with `DIRECTORY=manual`, an address in
   `INITIAL_ADMIN_EMAILS`; with `DIRECTORY=keycloak`, a member of
   `KEYCLOAK_ADMIN_GROUP` ([identity and access](identity-and-access.md)).
2. Set up the integrations under **Admin → Integrations**, or on the server
   with [`cli settings`](#settings-from-the-command-line): the AI model (until
   then, uploads wait at the draft), email, and as needed Slack, the weekly
   digest, the webhook and the intake mailbox
   ([configuration](configuration.md#integrations)). Each has a test.
3. Fill the taxonomy under **Maintenance → Taxonomy**, or import it
   ([taxonomy](taxonomy.md)). The AI model picks tags only from it. Topic
   areas and document types start with defaults; adjust them there.
4. Optionally, run the [replay test](taxonomy.md#replay-test) against the
   configured AI model before people start uploading.

## Settings from the command line

`cli` is the library's operator command. It sets what admins set under
**Admin → Integrations**, with the same checks, and the audit log names the
`operator` and the command. On the server, in `/srv/library`:

```sh
docker compose run --rm -T migrate cli settings list
```

In a running container, `cli` is on the `PATH`:
`docker compose exec web cli settings list`.

| Command                      | What it does                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `cli settings list [--json]` | Every setting: set, not set or incomplete, with hints (last characters; scheme, host and port of URLs)                       |
| `cli settings show <name>`   | The setting as JSON, as the admin page reads it                                                                              |
| `cli settings apply <name>`  | Reads the JSON body from stdin, the one the admin page sends, and saves it with the page's checks. Prints what `show` prints |
| `cli settings test <name>`   | What the page's test button does: `ai`, `email` (`--to <address>`), `slack`, `email-intake`                                  |
| `cli help`                   | The commands and the setting names                                                                                           |

A body changes only the fields it names. A secret that is left out or empty
stays as saved; `null` removes it (and clears any other field). Secrets go
only on stdin, never in an argument: arguments show in `ps` and the shell
history. Typed or pasted into a terminal, the body is not shown; end it with
Ctrl-D. Exit codes: 0 done, 1 refused (the page's message on stderr), 2 a
wrong command or a body that is not JSON. The command needs
`BETTER_AUTH_SECRET`, which `compose.yaml` passes to `migrate`. Library
issues no tokens, so there is no `cli tokens`.

An AI agent with access to the server sets a secret like this: the secret
arrives as a file, the agent pipes the body into `cli settings apply`, runs
`cli settings test`, and deletes the file.

```sh
docker compose run --rm -T migrate cli settings apply ai < ai.json
docker compose run --rm -T migrate cli settings test ai
rm ai.json
```

One example body per setting ([fields](configuration.md#integrations)):

### ai

```json
{ "provider": "anthropic", "apiKey": "sk-ant-…", "model": "claude-opus-5-5" }
```

For an OpenAI-compatible API, such as Mistral:

```json
{
  "provider": "openai-compatible",
  "apiKey": "…",
  "model": "mistral-medium-latest",
  "baseUrl": "https://api.mistral.ai/v1"
}
```

### email

```json
{
  "provider": "smtp",
  "smtpUrl": "smtps://library%40example.org:password@mail.example.org:465",
  "from": "library@example.org",
  "fromName": "Library"
}
```

With MailerSend: `{ "provider": "mailersend", "mailersendToken": "mlsn.…", "from": "library@example.org" }`.
Test: `cli settings test email --to you@example.org`.

### slack

```json
{ "botToken": "xoxb-…", "signingSecret": "…" }
```

### digest

```json
{ "slackChannelId": "C0123456789", "emailTo": "all-staff@example.org" }
```

### webhook

```json
{ "url": "https://hooks.example.org/library", "secret": "…" }
```

`{ "url": null }` switches the webhook off.

### email-intake

```json
{
  "imapUrl": "imaps://library-intake%40example.org:password@imap.example.org:993",
  "domains": ["example.org"],
  "mailbox": "INBOX",
  "doneMailbox": "Processed"
}
```

## Health checks

| Endpoint         | Meaning                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /-/healthz` | Liveness: the process answers, with the version (`version`: the commit, `null` for images built from source). No dependency checks |
| `GET /-/readyz`  | Readiness: the database answers and every migration of this build is applied. 503 otherwise                                        |

The worker writes a heartbeat file every 30 seconds;
`node dist/worker-healthcheck.mjs` fails when it is older than 90 seconds. The
admin page shows the worker's last heartbeat.

## Operations

- **Logs** are JSON lines on stdout. The `service` field names the process.
- **Admin page** (`/admin`): worker heartbeat, uploads waiting and on hold,
  whether an AI model is set up, directory sync status, notification
  channels, last week's messages per channel (Slack, email, Slack channel
  posts, list mail) and failures, webhook deliveries, and the version.
- **Data:** the database (with the `pgboss` schema) and the originals
  (bucket or volume). Deleting a note deletes its original; the audit log
  keeps only its number. Keep `BETTER_AUTH_SECRET` apart from copies of the
  database: stored sign-in tokens and the secrets of the
  [integrations](configuration.md#integrations) are encrypted with it.

## Upgrades

An upgrade pulls a newer image. In `/srv/library`:

1. Read the pull requests merged since the running commit (**Admin →
   Version** and **Settings → About** show it). A pull request labeled
   `breaking` says what to do; take those steps.
2. Run `git pull` for the newest `compose.yaml`, then
   `docker compose up -d --pull always`. With `LIBRARY_IMAGE_TAG` pinned to
   `sha-<commit>`, set the new commit first.

`migrate` applies new migrations before `web` and `worker` start; migrations
only move forward and keep the previous image working. An upgrade can happen
at any time: the worker finishes the draft, message or webhook delivery at
hand and takes nothing new ([restarts](architecture.md#restarts-and-deploys)).
Pages show an error for the seconds `web` restarts.

The integrations live in the database only. Variables that once held them
(`AI_API_KEY`, `SMTP_URL`, `SLACK_BOT_TOKEN`, `WEBHOOK_URL`, …) are not read;
delete them from `.env` once the settings show under **Admin →
Integrations**. A webhook URL that an earlier version saved in plain text is
encrypted when `web` starts.

## Builds and deploys

Every commit on `main` that passes CI is built and, at ProjectTogether,
deployed. There are no numbered releases: the commit is the version.

- **CI** (`.github/workflows/ci.yaml`, on every pull request and on `main`):
  the history for secrets (Gitleaks), the files for private artifacts,
  internal names and credential formats (`scripts/check-public-repository.mjs`),
  lint, formatting, types, unit tests, migration drift, the build, `npm audit`,
  the integration tests (PostgreSQL), the end-to-end tests (Keycloak,
  PostgreSQL, Playwright), and the image (OCR, started with `compose.yaml`,
  the operator command, a clean stop of the worker).
- **Deploy** (`.github/workflows/deploy.yml`), when CI passes on `main`, or
  by hand (Actions → Deploy → Run workflow), for example after a setting
  changed:
  1. It builds `ghcr.io/projecttogether/library` with `APP_VERSION` set to
     the first 12 characters of the commit and pushes it as `sha-<commit>`
     and `latest`.
  2. It sends the image and the app's settings to the server of the GitHub
     environment `production` over SSH. The server's deploy script pulls the
     image, writes the settings, runs the migrations, starts `web` and
     `worker`, waits until both are healthy, and puts the previous image and
     settings back when they do not become healthy. One deploy runs at a
     time; a newer one waits.

Without the variable `DEPLOY_HOST` in the environment `production`, step 2
deploys nothing. Label a pull request `breaking` when the people who run the
app must act on it, and write the steps into its description; merging
deploys it, so take steps that must come first before merging.

The package `library` in GitHub's container registry must be public, so that
servers can pull it without a token: an owner of the organization sets that
once, after the first build.

### Settings

The settings come from two places:

- **Server settings**, written on the server by its own configuration
  (ProjectTogether's infrastructure repository): `LIBRARY_BASE_URL`,
  `DATABASE_URL`, `POSTGRES_PASSWORD` with `compose.postgres.yaml`, `TZ`,
  `BETTER_AUTH_SECRET` (signs sessions and encrypts the stored secrets),
  `LIBRARY_PORT` and `STORAGE_DIR`. They win over the app settings.
- **App settings**, sent by the Deploy workflow at each deploy from the
  environment `production`: every other variable of
  [Configuration](configuration.md) that the app reads in production, as the
  workflow's `SETTINGS` list names them. Empty values are left out, so the
  app's default applies. A new setting needs a line in `SETTINGS` and its own
  line below it. `AI_PROVIDER` and `NOTIFICATION_TRANSPORT` are for
  development and tests only, and not in the list.

| Kind      | Names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secrets   | `DEPLOY_SSH_KEY`, `OIDC_CLIENT_SECRET`, `KEYCLOAK_CLIENT_SECRET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `SENTRY_DSN`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Variables | `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`, `APP_URL` (the environment's link only), `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_SCOPES`, `OIDC_TRUST_EMAIL`, `OIDC_PROVIDER_NAME`, `DIRECTORY`, `INITIAL_ADMIN_EMAILS`, `KEYCLOAK_ACCESS_GROUP`, `KEYCLOAK_ADMIN_GROUP`, `KEYCLOAK_MAINTAINER_GROUP`, `KEYCLOAK_TEAMS_GROUP`, `KEYCLOAK_CLIENT_ID`, `STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `UPLOAD_MAX_MB`, `AI_DAILY_LIMIT`, `AI_TIMEOUT_MS`, `OCR_COMMAND`, `OCR_LANGUAGES`, `LOG_LEVEL`, `SENTRY_ENVIRONMENT` |

The build reads one more secret, of the repository or the organization, not
of the environment: `SENTRY_AUTH_TOKEN`. With it, the Deploy workflow uploads
the source maps of the web process and the worker to the Sentry project
`projecttogether/library`, so that stack traces show the TypeScript files;
without it, nothing is uploaded. Sentry names the release `library@<commit>`
([error reporting](configuration.md#error-reporting-web-worker)).
Elsewhere, `compose.yaml` with a plain `.env` holds both kinds of settings
([Setup](#setup)).

### Rollbacks

A deploy that does not become healthy puts the previous image back by
itself. To go back by hand, revert the change on `main`, or run the server's
rollback. Neither undoes database migrations, so a migration keeps the
previous version working: add columns with a database default.
