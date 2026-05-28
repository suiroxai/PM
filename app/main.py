from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import secrets
from app.utils.parsing import Parser
from contextlib import asynccontextmanager
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "templates" / "index.html"
STATIC_DIR = BASE_DIR / "static"

@asynccontextmanager
async def lifespan(app: FastAPI):
    parser = Parser()
    await parser.initialize()
    app.state.parser = parser
    yield
    await parser.close()

app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

security = HTTPBasic()

def verify_password(credentials: HTTPBasicCredentials = Depends(security)):
    correct_password = secrets.compare_digest(credentials.password, "2232")
    if not correct_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

@app.get("/")
async def read_root(request: Request, username: str = Depends(verify_password)):
    # Читаем файл прямо здесь, чтобы изменения в HTML подхватывались без перезагрузки
    html_content = INDEX_FILE.read_text(encoding="utf-8")
    return HTMLResponse(content=html_content)

@app.get("/search/{query}")
async def search_query(query: str, page: int = 1, no_cache: bool = False, username: str = Depends(verify_password)):
    page = max(page, 1)
    return await app.state.parser.search(query, page, no_cache=no_cache)


@app.post("/cache/clear")
async def clear_cache(username: str = Depends(verify_password)):
    """Эндпоинт для ручной очистки кэша на сервере."""
    return await app.state.parser.clear_cache()

#docker-compose up --build    <---- первый раз (для сборки докера) аня...
