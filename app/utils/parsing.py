from camoufox.async_api import AsyncCamoufox
import asyncio
import logging
import json
from urllib.parse import quote_plus
import time

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
        self._cache = {}
        self._cache_ttl = 7200  # Время жизни кэша: 2 часа (7200 секунд)
        
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

    async def search_wb(self, query: str, page_num: int = 1) -> list[dict]:
        """
        Метод поиска WB на основе DOM (1-в-1 как у Ozon).
        Эмулирует пользователя, скроллит страницу и забирает данные.
        """
        try:
            safe_query = quote_plus(query)
            url = f"https://www.wildberries.ru/catalog/0/search.aspx?search={safe_query}&page={page_num}"
            logger.info(f"WB: Запуск поиска DOM '{query}', страница {page_num}")

            page = await self.browser_wb.new_page()

            # Картинки НЕ блокируем, они часто нужны для корректного рендеринга
            try:
                await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            except Exception as e:
                logger.warning(f"WB: Страница загружена частично: {e}")

            try:
                # Ожидаем появления карточек
                await page.wait_for_selector("article.product-card", timeout=15000)
            except Exception:
                logger.error("WB: Товары не найдены. Возможно, капча или пустая выдача.")
                await page.close()
                return []

            # --- ДИНАМИЧЕСКИЙ СКРОЛЛИНГ (ДО 40+ ТОВАРОВ) ---
            target_count = 42
            max_loops = 15
            
            for loop in range(max_loops):
                current_cards_count = await page.evaluate("() => document.querySelectorAll('article.product-card').length")
                logger.info(f"WB Скролл-шаг {loop + 1}: Найдено карточек в DOM -> {current_cards_count}")
                
                if current_cards_count >= target_count:
                    logger.info("WB: Достигнут лимит в 40+ товаров, прекращаем скролл.")
                    break
                    
                await page.evaluate("window.scrollBy(0, 1000)")
                await page.wait_for_timeout(450)

            await page.wait_for_timeout(500)

            # --- СБОР ДАННЫХ ИЗ DOM ---
            items = await page.evaluate(r"""
                () => {
                    const results = [];
                    const seenLinks = new Set();
                    const cards = document.querySelectorAll('article.product-card');

                    cards.forEach(card => {
                        const linkEl = card.querySelector('a'); // первая ссылка в карточке
                        if (!linkEl) return;

                        const link = linkEl.href.split('?')[0];
                        if (seenLinks.has(link)) return;

                        let price = null;
                        const priceEl = card.querySelector('ins.price__lower-price, .price__lower-price, .price__wrap ins');
                        if (priceEl) {
                            price = priceEl.innerText.replace(/[^0-9]/g, '');
                        } else {
                            const altPriceEl = card.querySelector('.price__wrap, .product-card__price');
                            if (altPriceEl) {
                                const priceText = altPriceEl.innerText.split('₽')[0] || altPriceEl.innerText;
                                price = priceText.replace(/[^0-9]/g, '');
                            }
                        }
                        if (!price) return;

                        let name = "Товар WB";
                        const brandEl = card.querySelector('.product-card__brand, .brand-name');
                        const nameEl = card.querySelector('.product-card__name, .goods-name');
                        
                        let brandText = brandEl ? brandEl.innerText.trim() : "";
                        let nameText = nameEl ? nameEl.innerText.trim() : "";
                        if (nameText.startsWith("/")) nameText = nameText.substring(1).trim();
                        
                        if (brandText || nameText) {
                            name = (brandText + " " + nameText).trim();
                        }

                        const imgEl = card.querySelector('img');
                        
                        let rating = "0";
                        const ratingEl = card.querySelector('.address-rate-mini, .product-card__rating');
                        if (ratingEl) {
                            rating = ratingEl.innerText.trim().replace(",", ".");
                        }
                        
                        let reviews = "0";
                        const reviewsEl = card.querySelector('.product-card__count');
                        if (reviewsEl) {
                            reviews = reviewsEl.innerText.replace(/[^0-9]/g, '');
                        }
                        
                        seenLinks.add(link);
                        results.push({
                            source: "wb",
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

            logger.info(f"WB: Успешно собрано {len(items)} товаров")
            await page.close()
            return items

        except Exception as e:
            logger.error(f"WB: Ошибка метода search: {e}")
            if 'page' in locals(): await page.close()
            return []

    async def clear_cache(self):
        """Очищает внутренний кэш результатов поиска."""
        cache_size = len(self._cache)
        self._cache.clear()
        logger.info(f"Кэш успешно очищен. Удалено {cache_size} записей.")
        return {"status": "success", "message": f"Cache cleared, {cache_size} items removed."}

    async def search_ozon(self, query: str, page_num: int = 1) -> list[dict]:
        """
        Твой парсер Ozon с динамическим интеллектуальным скроллингом 
        для гарантированного сбора ~40+ товаров за один запрос.
        """
        try:
            safe_query = quote_plus(query)
            url = f"https://www.ozon.ru/search/?text={safe_query}&from_global=true&page={page_num}"
            logger.info(f"Ozon: Запуск поиска '{query}', страница {page_num}")

            page = await self.browser_ozon.new_page()
            
            # Картинки НЕ блокируем, они нужны Ozon для корректного рендеринга структуры
            try:
                await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            except Exception as e:
                logger.warning(f"Ozon: Страница загружена частично: {e}")

            try:
                await page.wait_for_selector("a[href*='/product/']", timeout=10000)
            except Exception:
                logger.error("Ozon: Товары не найдены. Возможно, капча или пустая выдача.")
                await page.close()
                return []

            # --- ДИНАМИЧЕСКИЙ ИНТЕЛЛЕКТУАЛЬНЫЙ СКРОЛЛИНГ (ДО 40+ ТОВАРОВ) ---
            target_count = 42  # Желаемый лимит карточек (с запасом)
            max_loops = 15     # Защита от бесконечного цикла, если товаров на выдаче меньше
            
            for loop in range(max_loops):
                # Считаем, сколько уникальных плиток Ozon видит JS в данный момент
                current_cards_count = await page.evaluate("""
                    () => document.querySelectorAll('[data-widget*="tile"], [class*="tile-root"], .tile-root').length
                """)
                
                logger.info(f"Ozon Скролл-шаг {loop + 1}: Найдено карточек в DOM -> {current_cards_count}")
                
                if current_cards_count >= target_count:
                    logger.info("Ozon: Достигнут лимит в 40+ товаров, прекращаем скролл.")
                    break
                    
                # Мягко прокручиваем чуть ниже, имитируя человека
                await page.evaluate("window.scrollBy(0, 1000)")
                # Даем паузу, чтобы Docker-контейнер и скрипты Ozon успели отрендерить новые карточки
                await page.wait_for_timeout(450)

            # На всякий случай делаем финальную мини-паузу для догрузки изображений последних карточек
            await page.wait_for_timeout(500)

            # --- СБОР ДАННЫХ (Твоя исходная JS-логика без изменений) ---
            items = await page.evaluate(r"""
                () => {
                    const results = [];
                    const seenLinks = new Set(); 
                    const cards = document.querySelectorAll('[data-widget*="tile"], [class*="tile-root"], .tile-root');

                    cards.forEach(card => {
                        const linkEl = card.querySelector('a[href*="/product/"]');
                        if (!linkEl) return;

                        const link = linkEl.href.split('?')[0];
                        if (seenLinks.has(link)) return;

                        let price = null;
                        const priceSpans = Array.from(card.querySelectorAll('span'))
                            .filter(s => s.innerText.includes('₽'));

                        if (priceSpans.length > 0) {
                            const rawPrice = priceSpans[0].innerText.replace(/[^0-9]/g, '');
                            if (rawPrice.length > 1 && rawPrice.length < 9) {
                                price = rawPrice;
                            }
                        }

                        if (!price) return; 

                        let name = null;
                        const specificTitle = card.querySelector('span.tsBody500Medium, span.tsBodyL, span.tsBodyM');
                        if (specificTitle && specificTitle.innerText.length > 3) {
                            name = specificTitle.innerText.trim();
                        }

                        if (!name) {
                            const candidates = Array.from(linkEl.querySelectorAll('span'))
                                .filter(el => {
                                    const text = el.innerText.trim();
                                    return text.length > 3 && 
                                           !text.includes('₽') &&
                                           !/^\d+$/.test(text) &&
                                           !/^\d+ \/ \d+$/.test(text) &&
                                           !['Распродажа', 'Бестселлер', 'Новинка', 'Ozon Карта', 'Express', 'Оригинал', 'Хит', 'Скидка'].some(bad => text.includes(bad));
                                });

                            if (candidates.length > 0) {
                                name = candidates.sort((a, b) => b.innerText.length - a.innerText.length)[0].innerText.trim();
                            }
                        }

                        if (!name) name = "Товар Ozon";

                        const imgEl = card.querySelector('img');
                        
                        let rating = card.querySelector('span[style*="color: var(--textPremium);"]')?.innerText?.trim();
                        if (!rating) {
                            const ratingElements = Array.from(card.querySelectorAll('span'))
                                .filter(el => {
                                    const text = el.innerText.trim();
                                    return text.length < 4 && /\d[\.]\d/.test(text);
                                });
                            
                            if (ratingElements.length > 0) {
                                rating = ratingElements[0].innerText.trim();
                            } else {
                                rating = "0";
                            }
                        }
                        
                        let reviews = card.querySelector('span[style*="color: var(--textSecondary);"]')?.innerText?.trim();
                        if (!reviews) {
                            const reviewsElements = Array.from(card.querySelectorAll('span'))
                                .filter(el => {
                                    const text = el.innerText.trim();
                                    return text.length > 3 && text.includes('отзыв');
                                });
                            
                            if (reviewsElements.length > 0) {
                                reviews  = reviewsElements[0].innerText;
                            } else {
                                reviews = "0";
                            }
                        }
                        reviews = reviews.replace(/отзыв[а-я]*/, '').trim();
                        
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

    async def search(self, query: str, page_num: int = 1, no_cache: bool = False) -> list[dict]:
        page_num = max(page_num, 1)
        
        # Уникальный ключ кэша (приводим к нижнему регистру, чтобы "Iphone" и "iphone" были одним запросом)
        cache_key = f"{query.strip().lower()}_{page_num}"
        
        # Проверяем, есть ли данные в кэше и не протухли ли они
        if not no_cache:
            if cache_key in self._cache:
                cached_data = self._cache[cache_key]
                if time.time() - cached_data["timestamp"] < self._cache_ttl:
                    logger.info(f"Кэш-хит! Отдаем результаты для '{query}' (стр {page_num}) из оперативной памяти.")
                    return cached_data["data"]
                else:
                    logger.info(f"Кэш для '{query}' устарел (прошло > 2 часов), парсим заново.")
                    del self._cache[cache_key]
        else:
            logger.info(f"Принудительный обход кэша для запроса '{query}'.")

        results_wb, results_ozon = await asyncio.gather(
            self.search_wb(query, page_num), 
            self.search_ozon(query, page_num),
            return_exceptions=True
        )

        final_results = []
        if isinstance(results_wb, list): final_results.extend(results_wb)
        if isinstance(results_ozon, list): final_results.extend(results_ozon)

        # Сохраняем успешные результаты в кэш
        if final_results:
            self._cache[cache_key] = {
                "data": final_results,
                "timestamp": time.time()
            }
            logger.info(f"Результаты для '{query}' сохранены в кэш.")

        return final_results