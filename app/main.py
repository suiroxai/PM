from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
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

@app.get("/")
async def read_root(request: Request):
    # Читаем файл прямо здесь, чтобы изменения в HTML подхватывались без перезагрузки
    html_content = INDEX_FILE.read_text(encoding="utf-8")
    return HTMLResponse(content=html_content)

@app.get("/search/{query}")
async def search_query(query: str):
    return await app.state.parser.search(query)



#docker-compose up --build    <---- первый раз (для сборки докера) аня...