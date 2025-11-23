import time
import requests

def search_wildberries(query: str):
    url = "https://search.wb.ru/exactmatch/ru/common/v18/search"
    params = {
        "appType": 1,
        "curr": "rub",
        "dest": -1257786,
        "lang": "ru",
        "page": 1,
        "query": query,
        "resultset": "catalog",
        "sort": "popular",
        "spp": 30
    }

    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
    }

    # простой anti-429
    for attempt in range(3):
        response = requests.get(url, params=params, headers=headers)
        if response.status_code == 429:
            time.sleep(1)
            continue
        break

    if response.status_code != 200:
        return {"error": f"HTTP {response.status_code}"}

    data = response.json()

    # WB бывает отдаёт два варианта структуры
    products = data.get("data", {}).get("products") or data.get("products", [])

    result = []
    for p in products:
        name = p.get("name", "")
        seller = p.get("supplier", "")
        price = p.get("sizes", [{}])[0].get("price", {}).get("product", 0) / 100

        result.append({
            "name": name,
            "price": price,
            "seller": seller
        })

    return result
