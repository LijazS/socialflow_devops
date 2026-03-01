# SocialFlow — Social Media Platform

A full-stack social media platform built with **React + FastAPI microservices**, **MySQL**, and **Docker**.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   React Frontend                      │
│       Vite + React Router + Axios + WebSocket         │
│                   Port: 3000                          │
└──────────────────────────────────────────────────────┘
          │          │          │             │
    ┌─────▼──┐  ┌────▼───┐ ┌───▼────┐ ┌──────▼──────┐
    │  Auth  │  │  Post  │ │  Feed  │ │Notification │
    │Service │  │Service │ │Service │ │  Service    │
    │:8001   │  │ :8002  │ │ :8003  │ │  :8004      │
    └────────┘  └────────┘ └────────┘ └─────────────┘
          │          │                       │
          └──────────┴──────────┬────────────┘
                         ┌──────▼──────┐
                         │    MySQL    │
                         │  auth_db   │
                         │  post_db   │
                         │notif_db    │
                         └─────────────┘
```

## Microservices

| Service | Port | Description |
|---|---|---|
| Auth/User | 8001 | JWT auth, profiles, follow/unfollow |
| Post | 8002 | Create/view posts, image upload, likes, comments |
| Feed | 8003 | Paginated timeline aggregation |
| Notification | 8004 | REST + WebSocket real-time alerts |
| Frontend | 3000 | React SPA |

## Quick Start (Docker Compose)

```bash
# 1. Copy and configure environment variables
cp .env.example .env

# 2. Build and start all services
docker-compose up --build

# 3. Open the app
open http://localhost:3000
```

## API Endpoints Summary

### Auth Service (`:8001`)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET | `/users/me/profile` | My profile |
| GET | `/users/{id}` | User profile |
| POST | `/users/{id}/follow` | Follow user |
| DELETE | `/users/{id}/follow` | Unfollow |

### Post Service (`:8002`)
| Method | Path | Description |
|---|---|---|
| POST | `/posts` | Create post |
| GET | `/posts/{id}` | Get post |
| DELETE | `/posts/{id}` | Delete post |
| POST | `/posts/upload-image` | Upload media |
| POST | `/posts/{id}/like` | Like post |
| DELETE | `/posts/{id}/like` | Unlike |
| POST | `/posts/{id}/comments` | Add comment |
| GET | `/posts/{id}/comments` | Get comments |

### Feed Service (`:8003`)
| Method | Path | Description |
|---|---|---|
| GET | `/feed?offset=0&limit=20` | Personal timeline |
| GET | `/feed/user/{id}` | User's posts |

### Notification Service (`:8004`)
| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | List notifications |
| PATCH | `/notifications/{id}/read` | Mark read |
| PATCH | `/notifications/read-all` | Mark all read |
| WS | `/ws/{user_id}` | Real-time stream |

## AWS Deployment (EC2 + RDS)

1. Launch an EC2 instance (Amazon Linux 2 / Ubuntu), open ports: **3000, 8001–8004, 3306** in the security group.
2. Install Docker + Docker Compose on the instance.
3. Clone this repo onto the instance.
4. Edit `.env`:
   - Set `VITE_AUTH_URL=http://<EC2_PUBLIC_IP>:8001` etc.
   - Set each service's `DATABASE_URL` to your **RDS endpoint**.
   - Remove the `mysql` block from `docker-compose.yml` (use RDS instead).
5. Run `docker-compose up --build -d`.

## Project Structure

```
PROJECT/
├── auth-service/          # FastAPI: JWT auth, users, follows
├── post-service/          # FastAPI: posts, likes, comments, uploads
├── feed-service/          # FastAPI: timeline aggregation
├── notification-service/  # FastAPI: WebSocket + REST notifications
├── frontend/              # React (Vite) SPA
├── init-db.sql            # MySQL DB init script
├── docker-compose.yml     # Orchestration
└── .env.example           # Environment variable template
```

## Tech Stack

- **Frontend**: React 18, Vite, React Router, Axios, react-hot-toast, react-icons
- **Backend**: FastAPI, SQLAlchemy, PyMySQL, Passlib (bcrypt), python-jose (JWT)
- **Database**: MySQL 8 (or AWS RDS MySQL)
- **Real-time**: WebSockets (FastAPI native)
- **Containerisation**: Docker, Docker Compose
- **Web server**: nginx (frontend)
