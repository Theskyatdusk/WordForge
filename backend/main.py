"""WordForge FastAPI application entry point.

Serves both the REST API and the built frontend (dist/) from a single server,
so the entire app runs on http://localhost:8000 in production.
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from database import init_db
from seed import run_seed
from routers import (
    vocabulary,
    progress,
    wordbook,
    study,
    checkin,
    settings,
    shop,
    sync,
)
from tts_test import router as tts_test_router

# Path to the built frontend (dist folder)
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed default data on startup."""
    init_db()
    run_seed()
    yield


app = FastAPI(
    title="WordForge API",
    description="English vocabulary learning app — FastAPI backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for development (no credentials needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def cache_control_middleware(request: Request, call_next):
    """Set proper cache-control headers to prevent stale UI issues."""
    response = await call_next(request)
    path = request.url.path

    # index.html and SPA routes: NEVER cache (always fetch fresh)
    # This ensures users always get the latest HTML which references
    # the correct hashed JS/CSS files
    if (
        path == "/"
        or path == "/index.html"
        or (not path.startswith("/api/")
            and not path.startswith("/assets/")
            and not path.startswith("/docs")
            and not path.startswith("/openapi")
            and "." not in path.split("/")[-1])  # SPA routes like /study, /library
    ):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    # Hashed assets (JS, CSS with content hash in filename): cache forever
    elif path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"

    # sw.js and manifest: don't cache
    elif path in ("/sw.js", "/manifest.webmanifest"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    # API responses: don't cache
    elif path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"

    return response


# Register API routers
app.include_router(vocabulary.router)
app.include_router(progress.router)
app.include_router(wordbook.router)
app.include_router(study.router)
app.include_router(checkin.router)
app.include_router(settings.router)
app.include_router(shop.router)
app.include_router(sync.router)
app.include_router(tts_test_router)  # TTS diagnostic page at /tts-test


def _serve_index_html():
    """Serve index.html with no-cache headers."""
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return FileResponse(
            index_path,
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return None


@app.get("/")
def root():
    """Serve the frontend index.html if dist exists, otherwise API info."""
    result = _serve_index_html()
    if result:
        return result
    return {
        "name": "WordForge API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "note": "Frontend not built. Run 'npm run build' in frontend/ directory.",
    }


@app.get("/api")
def api_root():
    """API root — list available endpoint groups."""
    return {
        "groups": [
            "/api/vocabulary",
            "/api/progress",
            "/api/wordbook",
            "/api/study",
            "/api/checkin",
            "/api/settings",
            "/api/shop",
            "/api/sync",
        ]
    }


# Serve static assets (JS, CSS, images) from the frontend dist folder
if FRONTEND_DIST.exists():
    assets_path = FRONTEND_DIST / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    # Serve other static files at root level (favicon, icons, etc.)
    for static_file in FRONTEND_DIST.iterdir():
        if static_file.is_file() and static_file.name != "index.html":
            name = static_file.name

            def _make_route(fname: str):
                def _serve():
                    return FileResponse(FRONTEND_DIST / fname)
                return _serve

            app.get(f"/{name}")(_make_route(name))


# SPA fallback — any non-API route returns index.html
@app.get("/{full_path:path}")
async def spa_fallback(request: Request, full_path: str):
    """Catch-all route for SPA client-side routing."""
    # Don't intercept API routes
    if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi"):
        return JSONResponse(
            status_code=404,
            content={"detail": "Not Found"},
        )

    # Try to serve a static file first (with path traversal protection)
    file_path = (FRONTEND_DIST / full_path).resolve()
    try:
        file_path.relative_to(FRONTEND_DIST.resolve())
    except ValueError:
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)

    # Fall back to index.html for SPA routing
    result = _serve_index_html()
    if result:
        return result

    return JSONResponse(
        status_code=404,
        content={"detail": "Frontend not built. Run 'npm run build' in frontend/ directory."},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
