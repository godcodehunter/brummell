<div align="center">

# Brummell

*This is a blog I wrote for my own personal use. You can see what it looks like [here](http://godcodehunter.com/).*

</div>

# Key features

| Feature                             | Description                                             | Status    |
| ----------------------------------- | ------------------------------------------------------- | --------- |
| **Design**                          | Minimalist functional brutalism                         | ✅         |
| **Wide range of supported content** | Native support for short, articles and podcasts         | ✅         |
| **MDX support**                     | Write articles filled with dynamic content              | 🚧 Partial |
| **Latext Math Formules**            | Write usual latext formules in mdx                      | ✅         |
| **GFM tables**                      | GitHub-flavored markdown tables in articles             | ✅         |
| **TG notifications**                | Receive notifications directly in Telegram              | ✅         |
| **Open Graph support**              | Share articles on social media with a beautiful preview | ⏳ Planned |

# Why did I do this?

## Articles with dynamic content

As a child, when I read books, my imagination carried me far away, sometimes even to other worlds. But later, when I got a PC, I felt a certain disappointment. Books were no match for the color palette of a lamp monitor.
That was the first time the idea came to me: what if books were filled with dynamic content? 

## Podcasts

I often enjoy chatting with someone or writing down my thoughts. They're often of questionable value, but sometimes I stumble upon gems that would be a shame to lose. Many of my friends say I should post them, since they like to listen while going about their own activities. So I decided to integrate podcasts natively into my blog.

## The usefulness of short posts

Size-limited short posts are useful in two situations: when you want to share something quickly, and when the constraint itself forces you to shape a thought into something tight and worth reading. Twitter's core idea — that a hard character limit makes writing better, not worse — is genuinely brilliant.

# A little about code design

The classic client-server model was chosen for the project.
I've heard of polymorphic code — a single codebase shared between client and server, which the toolset then splits automatically using a DAG — but I have no experience with it, so the result would be unpredictable.
The only thing I wish I had was Solid instead of React — its granular reactivity really does sound cool — but back when the project started, Solid simply didn't exist 🤣.

# How to host?

This guide walks through deploying the blog to a fresh Ubuntu 24.04 VPS.

Tested on a small VPS: 1 CPU, 1 GB RAM, 5 GB disk. The frontend is built
**locally** and only the `dist/` folder is shipped — building Vite + tsc on
1 GB RAM tends to OOM.

Replace the placeholders with your own values:

- `MY_STRONG_PASS` — root password from your hosting panel.
- `server_ip` — server's public IP (in this guide: `46.29.166.201`).
- `my_user` — `root` initially.

---

## 1. Connect to the server

```
sshpass -p 'MY_STRONG_PASS' ssh my_user@server_ip
```

If `sshpass` is not installed locally: `sudo apt install sshpass`.

For a long-lived setup, run `ssh-copy-id my_user@server_ip` once and drop
the password from later commands.

## 2. Install system tools

Run on the server:

```
apt update && apt upgrade -y
apt install -y git nginx build-essential python3 curl
```

`build-essential` and `python3` are required to compile the native
`better-sqlite3` module during `npm install`.

## 3. Install Node.js 20

Ubuntu 24.04 ships an old Node by default — install the LTS from NodeSource:

```
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verify:

```
node -v        # ≥ v20
npm -v         # ≥ 10
git --version
nginx -v       # ≥ 1.24
```

## 4. Clone the repo

```
mkdir -p /opt && cd /opt
git clone https://github.com/godcodehunter/brummell.git
cd brummell
```

## 5. Install backend dependencies

```
cd /opt/brummell/backend
npm install
```

`npm install` will compile `better-sqlite3` from source — takes 1–2 minutes
on a small VPS.

The database is created automatically on first start (`initDatabase()` in
`src/server.ts` runs `CREATE TABLE IF NOT EXISTS`), so no migrations are
needed. The SQLite file lives in `/opt/brummell/backend/data/app.db`.

Optional smoke test (Ctrl+C to stop):

```
npm start
# → 🚀 GraphQL ready at http://localhost:4000/graphql
```

## 6. Build the frontend locally and upload

The frontend talks to the backend via the relative path `/graphql`, which
nginx proxies to `localhost:4000`. The same code works in dev because
`vite.config.ts` sets up a proxy for `/graphql` → `localhost:4000`.

**On your local machine:**

```
cd frontend
npm install                  # if you haven't already
npx vite build               # skips tsc; pure Vite build
```

The build output goes to `frontend/dist/`.

**On the server**, prepare the target directory:

```
mkdir -p /var/www/brummell
```

**On your local machine**, ship the build:

```
rsync -avz --delete \
  /media/mrsmith/backup/projects/brummell/frontend/dist/ \
  root@46.29.166.201:/var/www/brummell/
```

The trailing slash on `dist/` matters — it copies the contents, not the
folder itself.

## 7. Run backend as a systemd service

systemd auto-starts the backend on boot, restarts it on crash, and pipes
logs into `journalctl`.

Create `/etc/systemd/system/brummell-backend.service`:

```ini
[Unit]
Description=Brummell GraphQL backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/brummell/backend
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```
systemctl daemon-reload
systemctl enable brummell-backend
systemctl start brummell-backend
systemctl status brummell-backend --no-pager
```

Verify it's listening on port 4000:

```
ss -tlnp | grep 4000
curl -s http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
# → {"data":{"__typename":"Query"}}
```

Logs:

```
journalctl -u brummell-backend -n 50 --no-pager
journalctl -u brummell-backend -f          # follow
```

## 8. Configure nginx

nginx serves the static frontend from `/var/www/brummell` and proxies
`/graphql` (both HTTP and WebSocket) to the backend.

Create `/etc/nginx/sites-available/brummell`:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    root /var/www/brummell;
    index index.html;

    # GraphQL HTTP + WebSocket → backend.
    location /graphql {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Subscriptions hold the connection open.
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Vite emits hashed filenames under /assets — safe to cache forever.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # /files/* → backend. The admin uploads via PUT and deletes via DELETE;
    # GET also goes through the backend because files.ts adds ETag, MIME
    # detection and auth. Without this block PUT/DELETE land in the SPA
    # `try_files` below and nginx replies 405 Not Allowed for any non-GET.
    location /files/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # backend caps uploads at 50 MB (MAX_UPLOAD_BYTES in files.ts);
        # nginx default body limit is 1 MB and would 413 anything larger.
        client_max_body_size 50m;
        # Stream large uploads straight to the backend instead of buffering
        # the whole request on disk first.
        proxy_request_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    # SPA fallback for React Router.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Don't cache the entry point — clients need to see new builds.
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

Enable the site, drop the default, reload:

```
ln -sf /etc/nginx/sites-available/brummell /etc/nginx/sites-enabled/brummell
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Open `http://server_ip` in a browser — the blog should load.

If anything is off, check:

```
tail -n 30 /var/log/nginx/error.log
tail -n 30 /var/log/nginx/access.log
```

## 9. Domain + HTTPS

The site runs on `godcodehunter.com` (apex + `www`), served over HTTPS with a
free Let's Encrypt certificate.

**DNS.** Point the domain at the server with two `A` records — both the apex
and `www` resolve to `server_ip`:

```
A  @    → 46.29.166.201
A  www  → 46.29.166.201
```

Wait until they actually resolve before issuing a cert (`dig +short
godcodehunter.com` should print the IP), otherwise the HTTP-01 challenge fails.

**Certificate.** Install Certbot and its nginx plugin, then issue the cert.
The `server_name` in the `brummell` site already lists both names, so Certbot
finds them automatically:

```
apt install -y certbot python3-certbot-nginx

certbot --nginx \
  -d godcodehunter.com -d www.godcodehunter.com \
  --email mamhigtt@gmail.com --agree-tos --no-eff-email --redirect
```

`--redirect` makes Certbot rewrite the site in place: the original server block
moves to `listen 443 ssl` with the cert paths, and a second port-80 server block
301-redirects all HTTP to HTTPS. The `location` blocks from section 8 are left
untouched. Re-test and reload:

```
nginx -t && systemctl reload nginx
curl -sI http://godcodehunter.com    # 301 → https://…
curl -sI https://godcodehunter.com   # 200
```

**Auto-renewal.** Certbot installs a `certbot.timer` systemd unit (`systemctl
status certbot.timer`) that runs twice a day and reloads nginx after a renewal.
Certs are valid 90 days and renew ~30 days before expiry. Verify the whole
renewal path — challenge included — without touching the live cert:

```
certbot renew --dry-run --no-random-sleep-on-renew
# → "Congratulations, all simulated renewals succeeded"
```

> Plain `certbot renew` sleeps a random 0–12 min before running (load-spreading
> for Let's Encrypt) — that's the timer's job, not a hang. Add
> `--no-random-sleep-on-renew` when you want to test it by hand.

The nginx authenticator answers the renewal challenge over port 80 even with the
HTTPS redirect in place, so no extra `.well-known` carve-out is needed. Certs
live under `/etc/letsencrypt/live/godcodehunter.com/`.

---

## Updating the site later

**Frontend changes** — rebuild locally and rsync:

```
cd frontend
npx vite build
rsync -avz --delete dist/ root@server_ip:/var/www/brummell/
```

**Backend changes** — pull on the server and restart:

```
cd /opt/brummell
git pull
cd backend && npm install   # only if package.json changed
systemctl restart brummell-backend
```

# Enable search engine

The blog search hits a self-hosted [SearXNG](https://docs.searxng.org/) instance, which aggregates 70+ upstream engines (DuckDuckGo, Brave, Mojeek, Qwant, …) into one JSON API. Backend uses Google's `site:` operator through SearXNG to restrict matches to your own domain, then parses entity id/type out of the returned URLs and filters by tags / content type in the DB.

If `SEARXNG_URL` is unset, the backend transparently falls back to a local `LIKE %query%` search over the SQLite — handy for development.

## 1. Run SearXNG

```
docker run -d --name searxng -p 8080:8080 \
  -v $PWD/searxng:/etc/searxng \
  searxng/searxng
```

## 2. Enable the JSON format

In `searxng/settings.yml` make sure `search.formats` includes `json` (it ships with `html` only by default):

```yaml
search:
  formats:
    - html
    - json
```

Restart the container after editing: `docker restart searxng`.

## 3. Point the backend at it

Add to the backend's `.env`:

```
SEARXNG_URL=http://localhost:8080
SITE_URL=mysiteaddress.com
```

- `SEARXNG_URL` — base URL of the SearXNG instance (no trailing slash needed).
- `SITE_URL` — bare domain, no protocol. Becomes `site:<SITE_URL>` in the upstream query. Omit it (or leave it unset) to search the whole web — useful while testing.

Restart the backend (`systemctl restart brummell-backend` in prod) — `searchBlogContent` will now route through SearXNG.

# How integrate tg bot for notifies?

1. Create new bot and copy token.
2. Start chat with bot and write any msg.
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` where `<TOKEN>` is your token and find in result Json update with your chat id.
4. Rerгn backend with `tg` flag