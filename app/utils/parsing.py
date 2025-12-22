from camoufox.async_api import AsyncCamoufox
import asyncio

import logging
import asyncio
from camoufox.async_api import AsyncCamoufox

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

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
        """
        Универсальный парсер Ozon: исправлены цены и количество товаров.
        """
        try:
            url = f"https://www.ozon.ru/search/?text={query}&from_global=true"
            logger.info(f"Ozon: Запуск поиска '{query}'")

            page = await self.browser_ozon.new_page()

            # Устанавливаем таймаут и ждем загрузки (с учетом редиректов на бренды)
            try:
                await page.goto(url, timeout=45000, wait_until="load")
            except Exception as e:
                logger.warning(f"Ozon: Страница загружена частично: {e}")

            # Ждем появления хотя бы одного товара
            try:
                await page.wait_for_selector("a[href*='/product/']", timeout=15000)
            except Exception:
                logger.error("Ozon: Товары не найдены. Возможно, капча или пустая выдача.")
                await page.close()
                return []

            # --- УЛУЧШЕННЫЙ СКРОЛЛИНГ ---
            # Скроллим 4 раза по чуть-чуть, чтобы Ozon успел подгрузить Lazy Load блоки
            for i in range(4):
                await page.evaluate("window.scrollBy(0, 1200)")
                await page.wait_for_timeout(1000)  # Даем время на рендеринг

            # --- СБОР ДАННЫХ ---
            items = await page.evaluate("""
                () => {
                    const results = [];
                    const seenLinks = new Set(); 

                    // Ищем все плитки товаров через атрибуты и классы
                    const cards = document.querySelectorAll('[data-widget*="tile"], [class*="tile-root"], .tile-root');

                    cards.forEach(card => {
                        const linkEl = card.querySelector('a[href*="/product/"]');
                        if (!linkEl) return;

                        const link = linkEl.href.split('?')[0]; 
                        if (seenLinks.has(link)) return;

                        // ИСПРАВЛЕНИЕ ЦЕНЫ: Ищем только актуальную цену
                        // Ozon часто ставит актуальную цену в первый span с символом ₽
                        let price = null;
                        const priceSpans = Array.from(card.querySelectorAll('span'))
                            .filter(s => s.innerText.includes('₽'));

                        if (priceSpans.length > 0) {
                            // Берем только ПЕРВЫЙ найденный элемент с рублем (это обычно текущая цена)
                            // и очищаем его от всего, кроме цифр
                            const rawPrice = priceSpans[0].innerText.replace(/[^0-9]/g, '');
                            if (rawPrice.length > 1 && rawPrice.length < 9) {
                                price = rawPrice;
                            }
                        }

                        if (!price) return; // Пропускаем товары без цены

                        // ИСПРАВЛЕНИЕ НАЗВАНИЯ: Ищем в стандартных классах Ozon
                        const nameEl = card.querySelector('span.tsBody500Medium, span.tsBody400Small, [class*="tsBody"]');
                        const name = nameEl ? nameEl.innerText.trim() : "Товар Ozon";

                        // КАРТИНКА
                        const imgEl = card.querySelector('img');

                        seenLinks.add(link);
                        results.push({
                            source: "ozon",
                            name: name,
                            price: price,
                            link: link,
                            img: imgEl ? imgEl.src : null,
                            rating: "4.9", 
                            reviews_qty: "Ozon"
                        });
                    });

                    return results;
                }
            """)

            logger.info(f"Ozon: Успешно собрано {len(items)} товаров")
            await page.close()
            return items

        except Exception as e:
            logger.error(f"Ozon: Ошибка метода search: {e}")
            if 'page' in locals(): await page.close()
            return []

    async def search(self, query: str) -> list[dict]:
            results_wb, results_ozon  = await asyncio.gather(self.search_wb(query), self.search_ozon(query),
                                                             return_exceptions=True)
            return results_wb + results_ozon
