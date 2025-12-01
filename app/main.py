from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from utils.parsing import Parser
from contextlib import asynccontextmanager
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

INDEX_FILE =  Path("templates/index.html")
HTML_TEMPLATE = INDEX_FILE.read_text(encoding="utf-8")

@asynccontextmanager
async def lifespan(app: FastAPI):
    parser = Parser()
    await parser.initialize()
    app.state.parser = parser
    yield
    await parser.close()

app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root(request: Request):
    html_content = INDEX_FILE.read_text(encoding="utf-8")
    return HTMLResponse(content=HTML_TEMPLATE)

@app.get("/search/{query}")   #Докрутить асинхронность
async def search_query(query: str):
    return await app.state.parser.search(query)

#uvicorn app:app --host 0.0.0.0 --port 8000
#http://127.0.0.1:8000/wb?query=

