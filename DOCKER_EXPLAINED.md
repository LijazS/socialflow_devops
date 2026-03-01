# Docker Deep Dive — SocialFlow Platform

This document explains, from basics, exactly how every Dockerfile in this project
works, and then how `docker-compose.yml` orchestrates them all together.
Written for someone who understands the application but wants to deeply understand
the Docker layer.

---

## PART 1 — Docker Fundamentals (What You Must Know First)

### What is a Docker Image?
A Docker **image** is a read-only blueprint for a container.
Think of it like a class in programming — it describes what a container will look like
but is not running yet. Images are built from a `Dockerfile`.

### What is a Docker Container?
A Docker **container** is a running instance of an image.
Think of it like an object instantiated from a class.
You can run many containers from the same image at once.

### What is a Dockerfile?
A `Dockerfile` is a plain-text script of instructions that Docker reads top-to-bottom
to build an image layer by layer. Each instruction adds a new **layer** on top of the
previous one. Layers are cached — if a layer did not change since the last build,
Docker reuses it, making rebuilds much faster.

### What is a Layer?
Every instruction in a Dockerfile (FROM, COPY, RUN, etc.) creates a new layer.
Layers are stacked like a sandwich:

```
[ CMD — start server          ]  ← layer 6
[ EXPOSE — declare port       ]  ← layer 5
[ COPY . . — copy source code ]  ← layer 4
[ RUN pip install             ]  ← layer 3
[ COPY requirements.txt       ]  ← layer 2
[ WORKDIR /app                ]  ← layer 1
[ FROM python:3.11-slim       ]  ← base layer (downloaded from Docker Hub)
```

### Why does layer order matter?
Docker rebuilds only the layers that changed AND every layer below them.
That is why we always `COPY requirements.txt` and `RUN pip install` BEFORE
`COPY . .`. If you copy source code first, every code change invalidates the pip
install layer and Docker has to reinstall all packages again — very slow.

---

## PART 2 — The Backend Service Dockerfiles

All four FastAPI services (auth, post, feed, notification) follow the exact same
pattern. We will walk through `auth-service/Dockerfile` line by line, then explain
what is different in the others.

---

### 2.1 — `auth-service/Dockerfile` (Full Walk-Through)

```dockerfile
# Auth Service Dockerfile
FROM python:3.11-slim
```

**`FROM python:3.11-slim`**
This is always the first instruction. It tells Docker which **base image** to start
from. A base image is a pre-built image pulled from Docker Hub (hub.docker.com).

- `python` → the official Python image maintained by the Python team
- `3.11` → use Python version 3.11
- `slim` → a stripped-down variant (~50 MB vs ~900 MB for the full image).
  It removes documentation, man pages, and unnecessary system packages.
  This is best practice for production — smaller = faster to pull and less attack surface.

```dockerfile
WORKDIR /app
```

**`WORKDIR /app`**
Sets the working directory inside the container. All subsequent instructions
(`COPY`, `RUN`, `CMD`) are executed relative to this path.
If `/app` does not exist, Docker creates it automatically.
This is the equivalent of `cd /app` but persistent for every future instruction.

```dockerfile
COPY requirements.txt .
```

**`COPY requirements.txt .`**
Copies the file `requirements.txt` from your **local machine** (the build context,
which is the `auth-service/` folder) into the container at the current working
directory (`/app/requirements.txt`).

Why copy ONLY this file first and not everything?
→ Docker caches layers. `requirements.txt` changes rarely.
  By copying it alone and running pip install as a separate step, the pip install
  layer stays cached even when you change your Python source code.
  If you `COPY . .` first, every code change kills the cache and pip reinstalls
  all packages — very slow.

```dockerfile
RUN pip install --no-cache-dir -r requirements.txt
```

**`RUN pip install --no-cache-dir -r requirements.txt`**
`RUN` executes a shell command during the **build** phase (not at runtime).
Here it installs all Python packages listed in `requirements.txt`.

- `-r requirements.txt` → install from the requirements file
- `--no-cache-dir` → tells pip NOT to keep a local download cache inside the image.
  pip normally caches downloaded packages to speed up future installs, but since
  this is a Docker image we will never run pip again — so the cache just wastes
  disk space. This flag removes it, making the image smaller.

```dockerfile
COPY . .
```

**`COPY . .`**
Now we copy ALL remaining files from the `auth-service/` folder into `/app/` inside
the container. This includes:
- `app/main.py`
- `app/models.py`
- `app/schemas.py`
- `app/utils.py`
- `app/routers/auth.py`
- `app/routers/users.py`
- All `__init__.py` files

This step comes AFTER pip install deliberately (cache efficiency, explained above).

```dockerfile
EXPOSE 8001
```

**`EXPOSE 8001`**
Documents that the container will listen on port 8001 at runtime.
This is purely **documentation** — it does NOT actually publish the port to your
host machine. Port publishing is done in `docker-compose.yml` with the `ports:` key.
Think of `EXPOSE` as a label that says "I intend to listen here."

```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

**`CMD [...]`**
The default command to run when the container starts. This is executed at
**runtime**, not at build time.

- `uvicorn` → the ASGI server that runs FastAPI apps
- `app.main:app` → Python module path: `app/main.py`, the variable named `app`
  (the `FastAPI()` instance)
- `--host 0.0.0.0` → **CRITICAL.** Tells uvicorn to listen on all network
  interfaces inside the container. If you use `127.0.0.1` (localhost), the server
  is only reachable from inside the container itself — Docker's port mapping
  cannot reach it. `0.0.0.0` means "accept connections from anywhere."
- `--port 8001` → the port uvicorn binds to inside the container

The **exec form** `["uvicorn", ...]` (JSON array) is preferred over the shell form
`CMD uvicorn ...` because it runs the process directly without a shell wrapper,
making signals (like SIGTERM for graceful shutdown) work correctly.

---

### 2.2 — `post-service/Dockerfile` — What's Different

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /app/uploads   # ← NEW
EXPOSE 8002                  # ← different port
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
```

**`RUN mkdir -p /app/uploads`**
The post service allows image uploads. This pre-creates the `/app/uploads` directory
inside the image so the app does not fail on startup when it tries to mount the
static file server. The `-p` flag means "create parent directories too, and don't
error if it already exists."

In `docker-compose.yml`, this directory is mapped to a named volume (`post_uploads`)
so that uploaded files survive container restarts.

---

### 2.3 — `feed-service/Dockerfile` — What's Different

```dockerfile
EXPOSE 8003
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
```

Identical pattern, different port. The feed service has no uploads, so no
`mkdir` needed.

---

### 2.4 — `notification-service/Dockerfile` — What's Different

```dockerfile
EXPOSE 8004
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
```

Same pattern again, port 8004. Even though the notification service uses WebSockets,
no Dockerfile changes are needed — WebSockets are just a protocol upgrade over HTTP
and uvicorn handles it natively.

---

## PART 3 — The Frontend Dockerfile (Multi-Stage Build)

The frontend Dockerfile is fundamentally different from the backend ones.
It uses a **multi-stage build** — one of the most powerful Docker patterns.

```dockerfile
# Stage 1: Build the React app
FROM node:20-alpine AS builder
```

**`FROM node:20-alpine AS builder`**
- `node:20-alpine` → Node.js version 20 on Alpine Linux (~180 MB vs ~1 GB for the
  full node image). Alpine is a minimal Linux distro popular for small Docker images.
- `AS builder` → Names this stage `builder`. Other stages can reference it later.
  This is what makes it a "multi-stage" build.

```dockerfile
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install
```

**Same cache-efficient pattern as Python:**
Copy `package.json` first, run `npm install`, THEN copy source code.
If you only change a React component, Docker reuses the `npm install` layer.
`package-lock.json*` — the `*` glob means "copy if it exists, skip if not."

```dockerfile
COPY . .
```

Now copy all React source files (`src/`, `index.html`, `vite.config.js`, etc.)

```dockerfile
ARG VITE_AUTH_URL=http://localhost:8001
ARG VITE_POST_URL=http://localhost:8002
ARG VITE_FEED_URL=http://localhost:8003
ARG VITE_NOTIF_URL=http://localhost:8004
ARG VITE_NOTIF_WS_URL=ws://localhost:8004
```

**`ARG`** declarations define build-time arguments — values passed in from outside
during `docker build` or `docker compose up --build`. They are NOT available at
runtime (unlike `ENV`).

Default values are provided after `=` so the build works even without passing
`--build-arg`. When deploying to EC2, `docker-compose.yml` overrides these with
your EC2 public IP.

```dockerfile
ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_POST_URL=$VITE_POST_URL
...
```

**`ENV`** from `ARG` — This is a crucial pattern. Vite (the React build tool)
reads environment variables prefixed with `VITE_` at **build time** and embeds
them directly into the compiled JavaScript bundle.

The flow is:
```
docker-compose.yml args → ARG in Dockerfile → ENV in Dockerfile → RUN npm run build → embedded in JS bundle
```

This means the API URLs are **hardcoded into the static HTML/JS files** at build
time. If you change an EC2 IP, you MUST rebuild the image (`--build`).

```dockerfile
RUN npm run build
```

Runs `vite build`, which compiles the React app into static files:
- JavaScript bundles (minified, tree-shaken)
- CSS
- `index.html`
All output goes into `/app/dist/`.

At this point the `builder` stage is done. We have a `/app/dist` folder with
pure static files that need NO Node.js to serve.

```dockerfile
# Stage 2: Serve with nginx
FROM nginx:alpine
```

**This starts a completely fresh image.** The `node:20-alpine` image with all
of Node.js, npm, and your source code is DISCARDED. Only what we explicitly copy
carries forward. This is the power of multi-stage builds.

`nginx:alpine` is a tiny (~25 MB) web server image — perfect for serving static files.

```dockerfile
COPY --from=builder /app/dist /usr/share/nginx/html
```

**`COPY --from=builder`** copies files FROM the `builder` stage (the previous FROM
block) into the current stage. We take only the compiled output (`/app/dist`) and
place it where nginx expects to find static files to serve.

Your source code, `node_modules` (~200-500 MB), and all build tooling are NOT
included. Final image size: ~30 MB.

```dockerfile
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

Replaces nginx's default configuration with our custom `nginx.conf` which:
- Serves files from `/usr/share/nginx/html`
- Uses `try_files $uri $uri/ /index.html` for React Router (SPA routing)
- Enables gzip compression
- Adds long-term caching headers for JS/CSS assets

```dockerfile
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Nginx listens on port 80 inside the container.

`daemon off;` — by default nginx starts as a background daemon and immediately
exits the foreground process. Docker monitors the foreground process — if it exits,
Docker thinks the container crashed and restarts it. `daemon off;` keeps nginx
in the foreground so Docker can track it correctly.

### Summary: Why Multi-Stage?

| Stage | Base Image | Size | Purpose |
|---|---|---|---|
| builder | `node:20-alpine` | ~350 MB | Compile React to static files |
| final | `nginx:alpine` | ~30 MB | Serve static files |

Without multi-stage, the final image would be ~350 MB and include Node.js,
npm, all source code, and dev dependencies — none of which are needed at runtime.

---

## PART 4 — `docker-compose.yml` From First Principles

### What is Docker Compose?
Docker Compose is a tool for defining and running **multiple containers** together
as one application. Instead of running 6 separate `docker run` commands with dozens
of flags, you write everything in one `docker-compose.yml` file and run:

```bash
docker compose up
```

Compose reads the file, builds images if needed, creates a shared network, and
starts all containers in the right order.

---

### Line-by-Line Breakdown

```yaml
version: "3.9"
```

Specifies the Compose file format version. Version 3.9 supports all modern features
including health checks, named volumes, build args, and `depends_on` conditions.

```yaml
services:
```

The top-level key that contains all your containers. Each entry under `services:`
becomes one container.

---

### The `mysql` Service

```yaml
  mysql:
    image: mysql:8.0
```

**`image:`** — Instead of `build:`, this tells Compose to use a pre-built image
directly from Docker Hub. No Dockerfile needed. Docker pulls `mysql:8.0` if it
is not already cached locally.

```yaml
    container_name: socialflow-mysql
```

**`container_name:`** — Gives the container a fixed, human-readable name instead
of the auto-generated `project-service-1` name. Also becomes the **DNS hostname**
inside the Docker network. Other services connect to MySQL using `mysql` as the
hostname (e.g., in `DATABASE_URL: ...@mysql:3306/...`).

```yaml
    restart: unless-stopped
```

**`restart:`** — The container restart policy.
- `unless-stopped` → Docker will automatically restart the container if it crashes
  OR if Docker/the host reboots — UNLESS you manually stopped it with
  `docker compose stop`. This is the recommended production setting.
- Other options: `always`, `on-failure`, `no`

```yaml
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword}
      MYSQL_USER: ${MYSQL_USER:-sfuser}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-sfpassword}
```

**`environment:`** — Sets environment variables inside the container at runtime.
The MySQL image reads these on first startup to configure the database.

**`${VARIABLE:-default}`** — Compose variable substitution syntax:
- Reads the variable from your `.env` file or your shell environment
- If the variable is not set, uses the value after `:-` as a fallback default
- Example: if `.env` has `MYSQL_ROOT_PASSWORD=mypassword`, that value is used.
  If `.env` doesn't have it, `rootpassword` is used.

```yaml
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro
```

**`volumes:`** — Mounts storage into the container.

**Line 1: `mysql_data:/var/lib/mysql`**
- `mysql_data` → a named volume managed by Docker (defined at the bottom of the file)
- `/var/lib/mysql` → where MySQL stores all its database files inside the container
- This means: "store MySQL's data in the `mysql_data` volume, not inside the
  container's writable layer"
- Without this, all data is lost every time the container is removed/recreated.
  With a volume, data persists across `docker compose down` and `docker compose up`.

**Line 2: `./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro`**
- A **bind mount** — maps a file from your host directly into the container
- `./init-db.sql` → your local SQL file (relative to where docker-compose.yml is)
- `/docker-entrypoint-initdb.d/` → a special MySQL image convention: any `.sql`
  or `.sh` files placed here are automatically executed on the FIRST startup
- `:ro` → read-only. The container can read the file but not write to it.
  This prevents accidental modification.

```yaml
    ports:
      - "3306:3306"
```

**`ports:`** — Publishes container ports to the host machine.
Format: `"HOST_PORT:CONTAINER_PORT"`

`"3306:3306"` means:
- Container listens on port 3306 (MySQL's default)
- Host machine can reach it on port 3306
- You can connect with a MySQL client from your laptop: `mysql -h 127.0.0.1 -P 3306`

```yaml
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD:-rootpassword}"]
      interval: 10s
      timeout: 5s
      retries: 10
```

**`healthcheck:`** — Docker periodically runs this command inside the container
to determine if the service is "healthy" (ready to accept connections).

- `test:` → the command to run. `mysqladmin ping` asks MySQL if it is alive.
  Returns exit code 0 (success/healthy) or non-zero (unhealthy).
- `interval: 10s` → run the test every 10 seconds
- `timeout: 5s` → if the command takes longer than 5 seconds, consider it failed
- `retries: 10` → after 10 consecutive failures, mark the container as unhealthy

**Why this matters:** Other services use `depends_on: mysql: condition: service_healthy`.
Without the health check, Compose would start the Python services immediately when
MySQL starts, but MySQL takes ~20s to initialise — causing connection errors.
The health check makes Compose wait until MySQL is actually ready.

---

### The `auth-service` Service

```yaml
  auth-service:
    build:
      context: ./auth-service
      dockerfile: Dockerfile
```

**`build:`** — Tells Compose to BUILD an image rather than pulling one.
- `context: ./auth-service` → the build context: the folder whose contents
  are sent to Docker to build the image. All `COPY` instructions in the Dockerfile
  are relative to this folder.
- `dockerfile: Dockerfile` → which Dockerfile to use (redundant here since
  `Dockerfile` is the default name, but explicit is good practice).

```yaml
    ports:
      - "8001:8001"
```

Maps container port 8001 → host port 8001.

```yaml
    environment:
      DATABASE_URL: mysql+pymysql://root:${MYSQL_ROOT_PASSWORD:-rootpassword}@mysql:3306/auth_db
      JWT_SECRET: ${JWT_SECRET:-supersecretkey_change_in_production}
      ACCESS_TOKEN_EXPIRE_MINUTES: ${ACCESS_TOKEN_EXPIRE_MINUTES:-60}
```

**`DATABASE_URL`** — the SQLAlchemy connection string format:
```
dialect+driver://username:password@host:port/database_name
```
- `mysql+pymysql` → use MySQL with the PyMySQL Python driver
- `root` → MySQL root user
- `@mysql:3306` → `mysql` is the container_name of the MySQL service.
  Inside the Docker network, containers find each other by `container_name`.
  This is Docker's built-in DNS — no IP addresses needed!
- `/auth_db` → the database to connect to

```yaml
    depends_on:
      mysql:
        condition: service_healthy
```

**`depends_on:`** — Controls startup order.

`condition: service_healthy` → "Do NOT start `auth-service` until `mysql`
has passed its health check." This ensures MySQL is fully initialised before
the Python app tries to connect and run `Base.metadata.create_all()` to create tables.

Compare to `condition: service_started` (used for auth-service → feed-service):
that only waits for the container to START, not for it to be ready.

---

### The `post-service` Service

```yaml
    volumes:
      - post_uploads:/app/uploads
```

An extra named volume for uploaded images. The post service writes images to
`/app/uploads` inside the container. By mounting a volume here, those files
persist even if the container is recreated. This maps to the `post_uploads`
volume defined at the bottom of the file.

---

### The `feed-service` Service

```yaml
    environment:
      AUTH_DATABASE_URL: mysql+pymysql://...@mysql:3306/auth_db
      POST_DATABASE_URL: mysql+pymysql://...@mysql:3306/post_db
```

The feed service gets **two** database URLs because it reads from both `auth_db`
(to get the list of users a person follows) and `post_db` (to fetch those users'
posts). This is unique to feed — all other services use a single database.

```yaml
    depends_on:
      mysql:
        condition: service_healthy
      auth-service:
        condition: service_started
      post-service:
        condition: service_started
```

Feed depends on three things:
1. MySQL is healthy (so tables exist)
2. auth-service has started (schema for `follows` table created by auth-service startup)
3. post-service has started (schema for `posts` table created by post-service startup)

This ensures the tables feed reads from actually exist before it tries to query them.

---

### The `notification-service` Service

```yaml
    environment:
      DATABASE_URL: mysql+pymysql://...@mysql:3306/notification_db
```

Uses its own isolated `notification_db` database. Only stores notification records.

---

### The `frontend` Service

```yaml
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_AUTH_URL: ${VITE_AUTH_URL:-http://localhost:8001}
        VITE_POST_URL: ${VITE_POST_URL:-http://localhost:8002}
        VITE_FEED_URL: ${VITE_FEED_URL:-http://localhost:8003}
        VITE_NOTIF_URL: ${VITE_NOTIF_URL:-http://localhost:8004}
        VITE_NOTIF_WS_URL: ${VITE_NOTIF_WS_URL:-ws://localhost:8004}
```

**`args:`** under `build:` passes **build-time arguments** to the Dockerfile's
`ARG` instructions. These are different from `environment:` (which are runtime vars).

These values end up baked into the compiled JavaScript bundle. This is why you
must set them to your EC2 public IP before building for production.

```yaml
    ports:
      - "3000:80"
```

Maps container port 80 (where nginx listens) → host port 3000.
So visiting `http://localhost:3000` on your machine reaches nginx inside the
container, which serves the React app.

```yaml
    depends_on:
      - auth-service
      - post-service
      - feed-service
      - notification-service
```

Simple list format (no `condition:`) = uses default `condition: service_started`.
Ensures all backend services are at least running before the frontend starts.

---

### Named Volumes

```yaml
volumes:
  mysql_data:
  post_uploads:
```

Named volumes are Docker-managed storage areas that live outside any container.

- `mysql_data` → persists MySQL database files. Even after `docker compose down`,
  your data is still here. Only `docker compose down -v` deletes volumes.
- `post_uploads` → persists uploaded images from the post service.

Named volumes vs. bind mounts:
| | Named Volume | Bind Mount |
|---|---|---|
| Managed by | Docker | You (host filesystem) |
| Path on host | Docker-managed (`/var/lib/docker/volumes/`) | You specify |
| Use case | Persist app data | Share config files (like `init-db.sql`) |

---

## PART 5 — How It All Fits Together

When you run `docker compose up --build`, here is the exact sequence:

```
1. Compose reads docker-compose.yml
2. Reads .env file, substitutes ${VAR} placeholders
3. Builds images:
   a. Builds auth-service image   (from ./auth-service/Dockerfile)
   b. Builds post-service image   (from ./post-service/Dockerfile)
   c. Builds feed-service image   (from ./feed-service/Dockerfile)
   d. Builds notification image   (from ./notification-service/Dockerfile)
   e. Builds frontend image       (from ./frontend/Dockerfile — 2 stages)
4. Creates a Docker bridge network: "project_default"
   → All containers join this network automatically
   → They can reach each other by container_name (DNS)
5. Starts mysql container
   → Runs init-db.sql (creates auth_db, post_db, notification_db)
   → Health check polls every 10s until MySQL is ready
6. Once mysql is HEALTHY:
   → Starts auth-service (port 8001)
      → SQLAlchemy creates users + follows tables in auth_db
   → Starts post-service (port 8002)
      → SQLAlchemy creates posts + likes + comments tables in post_db
   → Starts notification-service (port 8004)
      → SQLAlchemy creates notifications table in notification_db
7. Once auth + post + mysql are ready:
   → Starts feed-service (port 8003)
8. Once all services started:
   → Starts frontend (port 80 → mapped to host:3000)
      → nginx serves the pre-built React bundle
9. All 6 containers run inside the same Docker network
   → Frontend browser calls hit ports on the HOST (3000, 8001-8004)
   → These are forwarded by Docker into the containers
   → Containers talk to each other by name (e.g., auth → mysql:3306)
```

---

## PART 6 — Essential Docker Commands Reference

```bash
# Build images and start all containers in the background (-d = detached)
docker compose up --build -d

# Start without rebuilding (uses cached images)
docker compose up -d

# Stop all containers (keeps containers, just stops them)
docker compose stop

# Stop AND remove containers + network (volumes preserved)
docker compose down

# Stop AND remove containers + network + volumes (DELETES ALL DATA)
docker compose down -v

# View running containers and their status
docker compose ps

# Live logs from all services
docker compose logs -f

# Live logs from ONE service only
docker compose logs -f auth-service

# Restart a single service (after a code fix)
docker compose restart post-service

# Rebuild and restart ONLY one service
docker compose up --build auth-service -d

# Open a shell inside a running container (for debugging)
docker compose exec auth-service bash

# Run a one-off command inside a service container
docker compose exec mysql mysql -u root -p

# See all Docker images on your machine
docker images

# See all running containers (across all projects)
docker ps

# Delete unused images to free disk space
docker image prune -f
```
