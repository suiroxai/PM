from fastapi import FastAPI
from wb_parse import search_wildberries

app = FastAPI()

@app.get("/wb")
def wb(query: str):
    result = search_wildberries(query)
    return {"Запрос": query, "Количество": len(result), "товары": result}


#uvicorn main:app --reload
#http://127.0.0.1:8000/wb?query=

