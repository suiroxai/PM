from camoufox.async_api import AsyncCamoufox
import asyncio
import logging

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
            logger.info(f"WB: Запуск поиска '{query}'")

            page = await self.browser_wb.new_page()
            await page.goto(url, timeout=30000)

            try:
                await page.wait_for_selector("h1", timeout=30000)
            except Exception:
                logger.error("WB: Заголовок не найден. Возможно, капча или пустая выдача.")
                await page.close()
                return []

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

            logger.info(f"WB: Успешно собрано {len(items)} товаров")
            await page.close()
            return items
        except Exception as e:
            logger.error(f"WB: Ошибка метода search: {e}")
            if 'page' in locals(): await page.close()
            return [{"error": str(e)}]

    async def search_ozon(self, query: str) -> list[dict]:
        """
        Исправленный парсер Ozon. Улучшен поиск названий.
        """
        try:
            url = f"https://www.ozon.ru/search/?text={query}&from_global=true"
            logger.info(f"Ozon: Запуск поиска '{query}'")

            page = await self.browser_ozon.new_page()

            # Устанавливаем таймаут и ждем загрузки
            try:
                await page.goto(url, timeout=45000, wait_until="load")
            except Exception as e:
                logger.warning(f"Ozon: Страница загружена частично: {e}")

            # Ждем появления товаров
            try:
                await page.wait_for_selector("a[href*='/product/']", timeout=15000)
            except Exception:
                logger.error("Ozon: Товары не найдены. Возможно, капча или пустая выдача.")
                await page.close()
                return []

            # --- СКРОЛЛИНГ ---
            # Немного прокручиваем страницу, чтобы подгрузить товары
            for i in range(4):
                await page.evaluate("window.scrollBy(0, 1200)")
                await page.wait_for_timeout(1000)

            # --- СБОР ДАННЫХ ---
            items = await page.evaluate("""
                () => {
                    const results = [];
                    const seenLinks = new Set(); 

                    // Ищем все плитки товаров
                    const cards = document.querySelectorAll('[data-widget*="tile"], [class*="tile-root"], .tile-root');

                    cards.forEach(card => {
                        const linkEl = card.querySelector('a[href*="/product/"]');
                        if (!linkEl) return;

                        const link = linkEl.href.split('?')[0]; 
                        if (seenLinks.has(link)) return;

                        // 1. ПОИСК ЦЕНЫ
                        let price = null;
                        const priceSpans = Array.from(card.querySelectorAll('span'))
                            .filter(s => s.innerText.includes('₽'));

                        if (priceSpans.length > 0) {
                            const rawPrice = priceSpans[0].innerText.replace(/[^0-9]/g, '');
                            if (rawPrice.length > 1 && rawPrice.length < 9) {
                                price = rawPrice;
                            }
                        }

                        if (!price) return; // Если цены нет, пропускаем

                        // 2. ПОИСК НАЗВАНИЯ (Улучшенная логика)
                        let name = null;

                        // Шаг А: Пробуем найти по конкретным классам заголовков Ozon
                        const specificTitle = card.querySelector('span.tsBody500Medium, span.tsBodyL, span.tsBodyM');
                        if (specificTitle && specificTitle.innerText.length > 3) {
                            name = specificTitle.innerText.trim();
                        }

                        // Шаг Б: Если не нашли, ищем самый длинный текст, исключая мусор
                        if (!name) {
                            const candidates = Array.from(linkEl.querySelectorAll('span, div'))
                                .filter(el => {
                                    const text = el.innerText.trim();
                                    return text.length > 3 &&  // Снизил порог с 10 до 3
                                           !text.includes('₽') &&
                                           !/^\d+$/.test(text) && // Не цифры
                                           !/^\d+ \/ \d+$/.test(text) && // Не счетчик фото (1/5)
                                           !['Распродажа', 'Бестселлер', 'Новинка', 'Ozon Карта', 'Express', 'Оригинал', 'Хит', 'Скидка'].some(bad => text.includes(bad));
                                });

                            if (candidates.length > 0) {
                                // Сортируем по длине (самый длинный - скорее всего название)
                                name = candidates.sort((a, b) => b.innerText.length - a.innerText.length)[0].innerText.trim();
                            }
                        }

                        // Если все еще нет названия, ставим заглушку
                        if (!name) name = "Товар Ozon";

                        // 3. КАРТИНКА
                        const imgEl = card.querySelector('img');

                        // 4. РЕЙТИНГ (Заглушка)
                        let rating = "4.9";
                        let reviews = "0";

                        seenLinks.add(link);
                        results.push({
                            source: "ozon",
                            name: name,
                            price: price,
                            link: link,
                            img: imgEl ? imgEl.src : null,
                            rating: rating, 
                            reviews_qty: reviews
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
        results_wb, results_ozon = await asyncio.gather(self.search_wb(query), self.search_ozon(query),
                                                        return_exceptions=True)

        final_results = []
        if isinstance(results_wb, list): final_results.extend(results_wb)
        if isinstance(results_ozon, list): final_results.extend(results_ozon)

        return final_results