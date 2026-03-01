# Database Architecture — SocialFlow Platform

This document answers exactly how the databases are structured, how many there are,
who owns what, how services access each other's data, and what "sharing" actually
means in this architecture.

---

## PART 1 — The Big Picture: One Server, Three Databases

The most important thing to understand first:

> **There is ONE MySQL server. Inside it live THREE separate databases.**

```
┌─────────────────────────────────────────────────────┐
│              MySQL Server (one process)              │
│         running in the `socialflow-mysql` container │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │   auth_db    │  │   post_db    │  │   notification_db     │  │
│  │              │  │              │  │                       │  │
│  │  users       │  │  posts       │  │  notifications        │  │
│  │  follows     │  │  likes       │  │                       │  │
│  │              │  │  comments    │  │                       │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

This is like having three spreadsheet workbooks inside one Excel application.
The application is the same, but each workbook holds different data and you can
open them separately.

### Why three databases instead of one?
This follows the **microservices principle of database isolation**:
- Each service **owns its own data** and is the single source of truth for it
- Services cannot directly modify each other's tables
- If you scale out or replace a service, its database stays self-contained
- In a full production setup, each database could even be on a separate server

---

## PART 2 — Who Owns What

### `auth_db` — Owned by auth-service

This database stores everything about **users and social connections**.

```
auth_db
├── users
│   ├── id             (INT, primary key, auto-increment)
│   ├── username       (VARCHAR 50, unique)
│   ├── email          (VARCHAR 100, unique)
│   ├── hashed_password(VARCHAR 255)
│   ├── bio            (TEXT, nullable)
│   ├── avatar_url     (VARCHAR 500, nullable)
│   └── created_at     (DATETIME)
│
└── follows
    ├── id             (INT, primary key)
    ├── follower_id    (INT → references users.id)
    ├── followee_id    (INT → references users.id)
    └── created_at     (DATETIME)
    [UNIQUE constraint on (follower_id, followee_id) — can't follow twice]
```

**auth-service is the ONLY service that writes to auth_db.**
It handles: register, login, update profile, follow, unfollow.

**About passwords:** Passwords are NEVER stored as plain text. They go through
`bcrypt` hashing (a one-way cryptographic function). The `hashed_password` column
contains something like `$2b$12$eImiTXuWVxfM37uY4JANjQ...`, not your actual password.
Even if the database was stolen, passwords cannot be reversed from this hash.

---

### `post_db` — Owned by post-service

This database stores everything about **content**.

```
post_db
├── posts
│   ├── id             (INT, primary key)
│   ├── author_id      (INT) ← user's ID from auth_db, but NO foreign key constraint
│   ├── content        (TEXT)
│   ├── image_url      (VARCHAR 500, nullable)
│   └── created_at     (DATETIME)
│
├── likes
│   ├── id             (INT, primary key)
│   ├── post_id        (INT → references posts.id within post_db)
│   ├── user_id        (INT) ← user's ID, no cross-DB foreign key
│   └── created_at     (DATETIME)
│
└── comments
    ├── id             (INT, primary key)
    ├── post_id        (INT → references posts.id)
    ├── author_id      (INT) ← user's ID, no cross-DB foreign key
    ├── content        (TEXT)
    └── created_at     (DATETIME)
```

**Notice:** `author_id`, `user_id`, and `comment.author_id` store an integer
(the user's ID) but do NOT have a database-level foreign key constraint pointing
to `auth_db.users.id`. This is intentional in microservices architecture — you
cannot create a database foreign key that crosses database boundaries.

The link between users and posts is maintained at the **application level** (the
Python code knows a `user_id` refers to a user), not at the database level.

---

### `notification_db` — Owned by notification-service

```
notification_db
└── notifications
    ├── id             (INT, primary key)
    ├── user_id        (INT) ← recipient's ID
    ├── actor_id       (INT, nullable) ← who triggered it
    ├── type           (VARCHAR 50) → "like" | "comment" | "follow"
    ├── reference_id   (INT, nullable) → post_id or user_id being referenced
    ├── message        (TEXT) → human-readable e.g. "Alice liked your post"
    ├── is_read        (BOOLEAN, default false)
    └── created_at     (DATETIME)
```

Completely self-contained. Only the notification-service writes to this.

---

## PART 3 — The Critical Question: Are Databases Sharing Data?

**Short answer: The databases do NOT share data with each other.**

**Long answer: They share a MySQL server but are completely isolated databases.**

Let's be precise about what "sharing" means and doesn't mean:

### What IS shared:
- The **MySQL server process** — one single MySQL instance hosts all three databases
- The **MySQL root credentials** — the same username/password can access all databases
- The **network hostname** — all services connect to `mysql:3306`

### What is NOT shared:
- **Tables** — each database has its own private tables
- **Data** — data inserted into `auth_db` cannot be read by a query targeting `notification_db`
- **Write access** — auth-service never writes to post_db, and post-service never writes to auth_db
- **Foreign key constraints** — there are no cross-database FK constraints

---

## PART 4 — The Feed Service: The Special Case

The feed service is the only service that **reads from two databases** simultaneously.
This is the heart of the cross-service data question.

### What feed-service needs to do:
```
"Give me the timeline for user ID 5"
→ Step 1: Find everyone user 5 follows        (data lives in auth_db.follows)
→ Step 2: Find posts by those people          (data lives in post_db.posts)
→ Step 3: Return posts sorted by newest first
```

To do this, it needs to read from BOTH `auth_db` and `post_db`.

### How it does it (feed-service/app/database.py):

```python
AUTH_DB_URL = "mysql+pymysql://root:password@mysql:3306/auth_db"
POST_DB_URL = "mysql+pymysql://root:password@mysql:3306/post_db"

auth_engine = create_engine(AUTH_DB_URL)   # connection to auth_db
post_engine = create_engine(POST_DB_URL)   # connection to post_db
```

The feed service opens **two separate database connections simultaneously** — one
per database. This is perfectly legal because both databases sit on the same
MySQL host. It's the equivalent of having two tabs open in a database GUI tool,
each connected to a different schema.

### The feed router (simplified):

```python
def get_feed(user_id, auth_db, post_db):
    # Query 1: hits auth_db — get the list of people user_id follows
    follows = auth_db.query(Follow).filter(Follow.follower_id == user_id).all()
    followee_ids = [f.followee_id for f in follows]

    # Query 2: hits post_db — get posts authored by those people
    posts = post_db.query(Post).filter(Post.author_id.in_(followee_ids)).all()
    return posts
```

These are two completely separate SQL queries, to two completely separate databases.
There is NO SQL JOIN across databases happening through SQLAlchemy here.

### Is this reading "shared" data?
It is **reading** data that was written by other services, yes — but through its
own connection, with its own credentials, as a read-only consumer. The feed service
has **zero write access** to auth_db or post_db (there are no INSERT/UPDATE/DELETE
calls in feed-service code).

---

## PART 5 — How Data Flows End-to-End (A Real Example)

Let's trace what happens when **User A (id=1) likes a post by User B (id=2)**:

```
Browser (User A)
    │
    │  POST /posts/42/like
    │  Authorization: Bearer <JWT>
    ▼
post-service (port 8002)
    │
    │  1. Verifies JWT (reads JWT_SECRET from env, no DB call needed)
    │  2. Checks if post 42 exists → SELECT from post_db.posts WHERE id=42
    │  3. Checks if already liked → SELECT from post_db.likes WHERE post_id=42 AND user_id=1
    │  4. Inserts like → INSERT INTO post_db.likes (post_id=42, user_id=1)
    │
    │  5. Returns 201 Created to browser
    │
    ▼
Browser (JavaScript PostCard component)
    │
    │  POST /notifications   (fire-and-forget HTTP call)
    │  Body: { user_id: 2, actor_id: 1, type: "like", message: "Alice liked your post" }
    ▼
notification-service (port 8004)
    │
    │  1. Inserts notification → INSERT INTO notification_db.notifications (...)
    │  2. Checks if User B has an active WebSocket connection
    │  3. If yes → pushes the notification JSON over WebSocket in real-time
    │
    ▼
Browser (User B's tab, NotificationBell component)
    → Bell icon updates: unread count +1
    → Toast popup: "Alice liked your post"
```

Notice: **post-service never talks to notification-service directly.**
The browser acts as the coordinator. In a more sophisticated system, post-service
would call notification-service via HTTP internally, but this approach works
cleanly for our setup.

---

## PART 6 — How Tables Are Created (Schema Management)

There is no manual migration script. SQLAlchemy handles this automatically.

When each FastAPI service starts, its `main.py` runs:

```python
Base.metadata.create_all(bind=engine)
```

This tells SQLAlchemy: "Look at every class I've defined that inherits from Base
(my model classes). For each one, check if its table exists in the database.
If it doesn't exist, CREATE it. If it already exists, leave it alone."

This happens in order:

```
1. MySQL starts, init-db.sql runs → creates auth_db, post_db, notification_db (empty)
2. auth-service starts → creates users table, follows table in auth_db
3. post-service starts → creates posts, likes, comments tables in post_db
4. notification-service starts → creates notifications table in notification_db
5. feed-service starts → does NOT create any tables (it only reads)
```

**⚠️ Important limitation:** `create_all` only creates missing tables. It does NOT
alter existing columns if you change a model. If you add a column to a model later,
you need to either:
- Drop and recreate the table (loses data)
- Write a manual `ALTER TABLE` SQL statement
- Use a migration tool like Alembic (the production-grade solution)

---

## PART 7 — How IDs Link Data Across Databases

Since we cannot use database foreign keys across databases, the link between data
in different databases is maintained by **integer IDs stored as plain columns**.

Here is the full ID reference map:

```
auth_db.users.id
    │
    ├──► post_db.posts.author_id          "who wrote this post"
    ├──► post_db.likes.user_id            "who liked this post"
    ├──► post_db.comments.author_id       "who wrote this comment"
    ├──► auth_db.follows.follower_id      "who is following"
    ├──► auth_db.follows.followee_id      "who is being followed"
    ├──► notification_db.notifications.user_id   "who receives this"
    └──► notification_db.notifications.actor_id  "who triggered this"

post_db.posts.id
    │
    ├──► post_db.likes.post_id            (within same DB — real FK constraint)
    ├──► post_db.comments.post_id         (within same DB — real FK constraint)
    └──► notification_db.notifications.reference_id  "which post this is about"
```

**Real FK constraint** = MySQL enforces the relationship (e.g., can't like a post
that doesn't exist). These only work within the same database.

**Plain integer reference** = just a number that the application code knows
refers to something in another database. MySQL does not enforce this at all.

---

## PART 8 — What Happens If a User is Deleted?

This is the practical consequence of not having cross-database foreign keys:

If you delete a user from `auth_db.users`:
- ✅ Their follows in `auth_db.follows` ARE deleted (same DB, cascade possible)
- ❌ Their posts in `post_db.posts` are NOT automatically deleted
- ❌ Their likes/comments in `post_db` are NOT automatically deleted
- ❌ Their notifications in `notification_db` are NOT automatically cleaned up

This is a known trade-off in microservices architecture. The solution is to
publish a "user deleted" event that each service listens to and handles its own
cleanup. For a production app, this would typically use a message queue like
AWS SQS or Kafka.

---

## PART 9 — Database Connection Strings Explained

Every service uses a connection string (the `DATABASE_URL` environment variable)
that follows this format:

```
mysql+pymysql://username:password@host:port/database_name
```

| Part | Meaning | Example value |
|---|---|---|
| `mysql` | Database type | MySQL |
| `+pymysql` | Python driver | PyMySQL library |
| `username` | DB user to authenticate as | `root` |
| `password` | Database password | from `.env` |
| `host` | Server hostname | `mysql` (Docker DNS) or RDS endpoint |
| `port` | MySQL port | `3306` (always for MySQL) |
| `database_name` | Which database to use | `auth_db`, `post_db`, etc. |

**Why `mysql` as the host?**
Inside Docker Compose, containers find each other by their `container_name`. The
MySQL container is named `socialflow-mysql` but it can ALSO be referenced by its
service name `mysql`. Docker has a built-in DNS server that resolves the service
name `mysql` to the container's internal IP address automatically.

**On AWS RDS**, you replace the `mysql` host with the RDS endpoint:
```
mysql+pymysql://admin:password@socialflow-db.xxxxxx.rds.amazonaws.com:3306/auth_db
```

---

## PART 10 — Visual Summary of the Entire Database Architecture

```
                        MYSQL SERVER
          ┌──────────────────────────────────────────┐
          │  auth_db          post_db     notif_db   │
          │  ─────────────    ────────    ─────────  │
          │  users            posts       notifs     │
          │  follows          likes                  │
          │                   comments               │
          └──────────────────────────────────────────┘
               ▲    ▲              ▲    ▲          ▲
               │    │              │    │          │
          ┌────┘    └────┐    ┌────┘  ┌─┘     ┌───┘
          │              │    │       │        │
   ┌──────────┐    ┌─────────────┐ ┌────────────────────┐
   │   AUTH   │    │    POST     │ │    NOTIFICATION     │
   │ SERVICE  │    │  SERVICE    │ │     SERVICE         │
   │  :8001   │    │   :8002     │ │      :8004          │
   │          │    │             │ │                     │
   │ R/W      │    │ R/W         │ │ R/W notification_db │
   │ auth_db  │    │ post_db     │ │ WebSocket push      │
   └──────────┘    └─────────────┘ └────────────────────┘

                ┌─────────────────────┐
                │    FEED SERVICE     │
                │       :8003         │
                │                     │
                │ READ ONLY auth_db   │── ─── ─►  auth_db.follows
                │ READ ONLY post_db   │── ─── ─►  post_db.posts
                │ (no writes at all)  │
                └─────────────────────┘

   ┌────────────────────────────────────────────────────┐
   │              REACT FRONTEND  :3000                 │
   │  Talks to each service via HTTP/WebSocket          │
   │  Acts as coordinator (triggers notifications)      │
   └────────────────────────────────────────────────────┘
```

---

## Quick Reference

| Question | Answer |
|---|---|
| How many MySQL servers? | **1** |
| How many databases? | **3** (auth_db, post_db, notification_db) |
| Do databases share tables? | **No** — each DB has its own private tables |
| Does any service write to another's DB? | **No** — each service only writes to its own DB |
| Does feed-service write anything? | **No** — it is 100% read-only |
| How does feed find posts from followed users? | Two separate queries: one to auth_db, one to post_db |
| Are cross-DB foreign keys enforced by MySQL? | **No** — links are maintained by application code |
| How are tables created? | Automatically by SQLAlchemy `create_all()` at service startup |
| What happens to a user's posts if user is deleted? | **Nothing automatically** — no cascades across DBs |
