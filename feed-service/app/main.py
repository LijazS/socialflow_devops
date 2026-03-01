from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import auth_engine, post_engine
from .routers import feed

app = FastAPI(title="Feed Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(feed.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "feed-service"}
