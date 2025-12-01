from camoufox.async_api import AsyncCamoufox
import asyncio

class Parser:
    def __init__(self):
        self.playwright_wb = None
        self.playwright_ozon = None
        self.browser_wb = None
        self.browser_ozon = None

    async def initialize(self):
        self.playwright_wb = AsyncCamoufox(headless=True)
        self.playwright_ozon = AsyncCamoufox(headless=True)

        self.browser_wb = await self.playwright_wb.__aenter__()
        self.browser_ozon = await self.playwright_ozon.__aenter__()


    async def close(self):
        if self.browser_wb:
            await self.playwright_wb.__aexit__(None, None, None)
        if self.browser_ozon:
            await self.playwright_ozon.__aexit__(None, None, None)

    async def search_wb(self, query: str) -> list[dict]:
        try:
            url = f"https://www.wildberries.ru/catalog/0/search.aspx?search={query}"
            page = await self.browser_wb.new_page()
            await page.goto(url, timeout=30000)
            await page.wait_for_selector("h1", timeout=30000)
            items = await page.eval_on_selector_all(
                "article.product-card.j-card-item.j-analitics-item",
                """
                nodes => nodes.map(n => {
                    const a = n.querySelector('a.product-card__link');
                    const img = n.querySelector('img.j-thumbnail');
                    return {
                        source: "wb",
                        name: a?.getAttribute('aria-label')?.trim() || null,
                        price: n.querySelector('ins.price__lower-price')?.innerText.trim() || null,
                        rating: n.querySelector('span.address-rate-mini')?.innerText.trim() || null,
                        reviews_qty: n.querySelector('span.product-card__count')?.innerText.trim() || null,
                        link: a?.href || null,
                        img: img?.getAttribute('src') || null
                    };
                })
                """)

            await page.close()
            return items
        except Exception as e:
            return [{"error": str(e)}]


    async def search_ozon(self, query: str) -> list[dict]:
        try:
            url = f"https://www.ozon.ru/search/?text={query}&from_global=true"
            page = await self.browser_ozon.new_page()
            await page.goto(url, timeout=30000)
            await page.wait_for_selector("div.yc1_11.tsCompactControl500Medium.y1c_11", timeout=10000)
            await page.evaluate("window.scrollBy(0, 3500)")
            await page.wait_for_timeout(2000)
            items = await page.eval_on_selector_all(
                "div.tile-root",
                """
                nodes => nodes.map(n => {
                    const a = n.querySelector('a.tile-clickable-element');
                    const img = n.querySelector('img');
                    return {
                        source: "ozon",
                        name: n.querySelector('span.tsBody500Medium')?.innerText?.trim() || null,
                        price: n.querySelector('span.tsHeadline500Medium')?.innerText?.trim() || null,
                        rating: n.querySelector('span[style*="color:var(--textPremium)"]')?.innerText?.trim() || null,
                        reviews_qty: n.querySelector('span[style*="color:var(--textSecondary)"]')?.innerText?.trim() || null,
                        link: a ? "https://www.ozon.ru" + a.getAttribute('href') : null,
                        img: img?.getAttribute('src') || null
                    };
                })
                """
            )

            await page.close()
            return items
        except Exception as e:
            return [{"error": str(e)}]

    async def search(self, query: str) -> list[dict]:
            results_wb, results_ozon  = await asyncio.gather(self.search_wb(query), self.search_ozon(query),
                                                             return_exceptions=True)
            return results_wb + results_ozon
