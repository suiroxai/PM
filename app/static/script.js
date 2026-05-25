document.addEventListener("DOMContentLoaded", () => {
    // === ЭЛЕМЕНТЫ DOM ===
    const input = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const clearBtn = document.getElementById("clearBtn");
    const clearBtnWrapper = document.getElementById("clearBtnWrapper");

    const resultsContainer = document.getElementById("results");
    const sortSelect = document.getElementById("sortSelect");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const resultsCount = document.getElementById("resultsCount");
    const historyContainer = document.getElementById("searchHistory");

    const loadingState = document.getElementById("loadingState");
    const loadingTip = document.getElementById("loadingTip");
    const skeletonGrid = document.getElementById("skeletonGrid");
    const emptyState = document.getElementById("emptyState");
    const errorState = document.getElementById("errorState");
    const retryBtn = document.getElementById("retryBtn");
    const backToTopBtn = document.getElementById("backToTop");
    const loadMoreWrapper = document.getElementById("loadMoreWrapper");
    const loadMoreBtn = document.getElementById("loadMoreBtn");

    const totalProductsEl = document.getElementById("totalProducts");
    const avgPriceEl = document.getElementById("avgPrice");
    const minPriceEl = document.getElementById("minPrice");

    const toggleViewBtn = document.getElementById("toggleView");
    const exportBtn = document.getElementById("exportBtn");

    // === УПРАВЛЕНИЕ ТЕМАМИ ===
    let currentTheme = localStorage.getItem("app_theme") || "cosmic";
    
    function applyTheme(theme) {
        document.body.setAttribute("data-theme", theme);
        const themeBtn = document.getElementById("themeToggleBtn");
        if (themeBtn) {
            themeBtn.innerHTML = theme === "cosmic" 
                ? '<i class="fa-solid fa-moon"></i> Cosmic' 
                : '<i class="fa-solid fa-pen-nib"></i> Ink';
        }
    }
    

    // Если кнопки нет в HTML, создадим её динамически рядом с кнопкой экспорта
    if (!document.getElementById("themeToggleBtn") && exportBtn) {
        const themeBtn = document.createElement("button");
        themeBtn.id = "themeToggleBtn";
        themeBtn.className = "btn btn-outline-light ms-2";
        themeBtn.title = "Переключить тему";
        exportBtn.parentNode.insertBefore(themeBtn, exportBtn.nextSibling);
    }

    const themeToggleBtn = document.getElementById("themeToggleBtn");
    applyTheme(currentTheme);

    // === ИЗБРАННОЕ ===
    const favoritesList = document.getElementById("favoritesList");
    const favoritesEmpty = document.getElementById("favoritesEmpty");
    const favCountBadge = document.getElementById("favCountBadge");

    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    function updateFavoritesUI() {
        if (favCountBadge) {
            favCountBadge.textContent = favorites.length;
            favCountBadge.style.display = favorites.length > 0 ? 'inline-block' : 'none';
        }
        if (favoritesList && favoritesEmpty) {
            if (favorites.length === 0) {
                favoritesList.innerHTML = '';
                favoritesList.style.display = 'none';
                favoritesEmpty.style.display = 'block';
            } else {
                favoritesEmpty.style.display = 'none';
                favoritesList.style.display = 'grid';
                favoritesList.innerHTML = favorites.map(item => getGridHtml(item, 0, true)).join('');

                favoritesList.querySelectorAll('.favorite-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        e.preventDefault();
                        const link = btn.dataset.link;
                        toggleFavorite(favorites.find(p => p.link === link));
                    };
                });
            }
        }
    }

    function toggleFavorite(product) {
        if (!product) return;
        const index = favorites.findIndex(p => p.link === product.link);

        if (index === -1) {
            favorites.push(product);
            showToast("Добавлено в избранное");
        } else {
            favorites.splice(index, 1);
            showToast("Удалено из избранного");
        }

        localStorage.setItem('favorites', JSON.stringify(favorites));
        updateFavoritesUI();

        const btns = document.querySelectorAll(`.favorite-btn[data-link="${product.link}"], .favorite-btn-list[data-link="${product.link}"]`);
        btns.forEach(btn => {
            const isFav = favorites.some(p => p.link === product.link);
            if (btn.classList.contains('favorite-btn')) {
                if(isFav) {
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
                } else {
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
                }
            }
            if (btn.classList.contains('favorite-btn-list')) {
                if(isFav) {
                    btn.classList.remove('btn-outline-danger');
                    btn.classList.add('btn-danger');
                    btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
                } else {
                    btn.classList.add('btn-outline-danger');
                    btn.classList.remove('btn-danger');
                    btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
                }
            }
        });
    }

    updateFavoritesUI();

    // === СОВЕТЫ ПРИ ЗАГРУЗКЕ ===
    const tips = [
        "Совет: Сортируйте отзывы по дате — качество товара часто меняется от партии к партии.",
        "Лайфхак: Смотрите негативные отзывы первыми — они быстрее покажут реальные проблемы.",
        "Факт: Утром (6–9) и поздно ночью цены обновляются чаще всего.",
        "Лайфхак: Один и тот же товар часто дешевле в другом цвете или комплекте.",
        "Факт: WB и Ozon могут давать разные цены одному и тому же пользователю."
    ];
    let tipInterval;

    // === УПРАВЛЕНИЕ ИСТОРИЕЙ ПОИСКА ===
    let searchHistory = [];
    try {
        searchHistory = JSON.parse(localStorage.getItem("search_history") || "[]");
        if (!Array.isArray(searchHistory)) searchHistory = [];
    } catch {
        searchHistory = [];
    }

    function renderHistory() {
        if (!historyContainer) return;
        if (searchHistory.length === 0) {
            historyContainer.innerHTML = '<span class="text-muted small">История пуста</span>';
            return;
        }

        // Контейнер для тегов + кнопка очистки
        let html = '<div class="d-flex flex-wrap align-items-center gap-2">';
        searchHistory.forEach(tag => {
            html += `<span class="history-tag">${tag}</span>`;
        });
        html += `<button id="clearHistoryBtn" class="btn btn-sm btn-link text-danger p-0 ms-2" style="text-decoration:none; font-size:0.8rem;"><i class="fa-solid fa-trash-can"></i> Очистить историю</button>`;
        html += `<button id="clearCacheBtn" class="btn btn-sm btn-link text-warning p-0 ms-2" style="text-decoration:none; font-size:0.8rem;" title="Очистить кэш на сервере"><i class="fa-solid fa-database"></i> Очистить кэш</button>`;
        html += '</div>';
        
        historyContainer.innerHTML = html;

        // Клик по тегам
        historyContainer.querySelectorAll(".history-tag").forEach(el => {
            el.onclick = (e) => {
                input.value = el.innerText;
                toggleClearBtn();
                search(el.innerText, e.ctrlKey || e.shiftKey);
            };
        });

        // Клик по кнопке очистки истории
        const clearHistoryBtn = document.getElementById("clearHistoryBtn");
        if (clearHistoryBtn) {
            clearHistoryBtn.onclick = () => {
                searchHistory = [];
                localStorage.setItem("search_history", JSON.stringify([]));
                renderHistory();
                showToast("История поиска очищена");
            };
        }

        // Клик по кнопке очистки кэша
        const clearCacheBtn = document.getElementById("clearCacheBtn");
        if (clearCacheBtn) {
            clearCacheBtn.onclick = async () => {
                clearCacheBtn.disabled = true;
                try {
                    const res = await fetch('/cache/clear', { method: 'POST' });
                    if (res.ok) {
                        showToast("Кэш на сервере успешно очищен");
                    } else {
                        showToast("Ошибка при очистке кэша");
                    }
                } catch (e) {
                    showToast("Ошибка сети при очистке кэша");
                } finally {
                    clearCacheBtn.disabled = false;
                }
            };
        }
    }
    
    function saveHistory(query) {
        const normalizedQuery = query?.trim();
        if (!normalizedQuery) return;
        searchHistory = [
            normalizedQuery,
            ...searchHistory.filter(item => item.toLowerCase() !== normalizedQuery.toLowerCase())
        ].slice(0, 8);
        try {
            localStorage.setItem("search_history", JSON.stringify(searchHistory));
        } catch (e) {
            console.warn("Search history was not saved", e);
        }
        renderHistory();
    }

    // === УПРАВЛЕНИЕ INPUT ===
    function toggleClearBtn() {
        if (input.value.trim().length > 0) {
            clearBtnWrapper.style.display = 'block';
        } else {
            clearBtnWrapper.style.display = 'none';
        }
    }
    if (input) { input.addEventListener("input", toggleClearBtn); toggleClearBtn(); }
    if (clearBtn) { clearBtn.onclick = () => { input.value = ""; input.focus(); toggleClearBtn(); }; }

    // === КНОПКА НАВЕРХ ===
    if (backToTopBtn) {
        window.addEventListener("scroll", () => {
            if (window.scrollY > 300) backToTopBtn.classList.add("show");
            else backToTopBtn.classList.remove("show");
        });
        backToTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // === БЫСТРЫЙ ПОИСК ===
    document.querySelectorAll(".quick-search").forEach(btn => {
        btn.onclick = (e) => {
            if (input) { input.value = btn.dataset.query; toggleClearBtn(); }
            search(btn.dataset.query, e.ctrlKey || e.shiftKey);
        };
    });

    // === ТЕКУЩЕЕ СОСТОЯНИЕ ===
    let products = [];
    let isLoading = false;
    let isLoadingMore = false;
    let currentPage = 1;
    let currentQuery = "";
    let hasMoreResults = false;
    let currentMarket = "all";
    let currentView = "grid";

    // === УТИЛИТЫ ===
    function formatPrice(val) {
        if (!val) return "0 ₽";
        const num = typeof val === 'number' ? val : parseInt(val.toString().replace(/\D/g, ""));
        return new Intl.NumberFormat('ru-RU').format(num) + " ₽";
    }

    function toNum(val) {
        return typeof val === 'number' ? val : parseInt(val?.toString().replace(/\D/g, "") || 0);
    }

    // Тосты оповещений
    function showToast(msg) {
        const toastContainer = document.getElementById("toastContainer");
        if (!toastContainer) return;
        const el = document.createElement("div");
        el.className = "toast show align-items-center text-bg-primary border-0 mb-2";
        el.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
        toastContainer.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    // Плавная анимация изменения цифр в блоке статистики
    function animateValue(obj, start, end, duration, isPrice = false) {
        if(!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - (1 - progress) * (1 - progress);
            const currentVal = Math.floor(easeProgress * (end - start) + start);
            obj.textContent = isPrice ? formatPrice(currentVal) : currentVal;
            if (progress < 1) window.requestAnimationFrame(step);
            else obj.textContent = isPrice ? formatPrice(end) : end;
        };
        window.requestAnimationFrame(step);
    }

    // === ЛОГИКА СТАТИСТИКИ ===
    function updateStats() {
        if(!totalProductsEl) return;
        
        // Фильтруем массив в зависимости от выбранного маркетплейса
        let filtered = products;
        if (currentMarket !== 'all') {
            filtered = products.filter(p => p.source === currentMarket);
        }

        const valid = filtered.filter(p => toNum(p.price) > 0);
        const currentTotal = parseInt(totalProductsEl.textContent) || 0;
        const targetTotal = filtered.length; // Фиксируем корректное число для плашки "найдено"

        let targetAvg = 0, targetMin = 0;
        if (valid.length) {
            const prices = valid.map(p => toNum(p.price));
            targetAvg = Math.round(prices.reduce((a,b)=>a+b, 0) / prices.length);
            targetMin = Math.min(...prices);
        }

        animateValue(totalProductsEl, currentTotal, targetTotal, 600, false);
        animateValue(avgPriceEl, 0, targetAvg, 600, true);
        animateValue(minPriceEl, 0, targetMin, 600, true);
    }

    function setLoadMoreVisible(visible) {
        if (!loadMoreWrapper) return;
        // Требование 1: Показываем блок только при наличии первой пачки данных и флага доступности
        loadMoreWrapper.style.display = (visible && products.length > 0) ? 'block' : 'none';
        if (loadMoreBtn && !isLoadingMore) loadMoreBtn.disabled = !visible;
    }

    function setLoadMoreLoading(loading) {
        if (!loadMoreBtn) return;
        const text = loadMoreBtn.querySelector('.load-more-text');
        const spinner = loadMoreBtn.querySelector('.load-more-spinner');
        loadMoreBtn.disabled = loading || !hasMoreResults || !currentQuery;
        if (text) text.textContent = loading ? 'Загружаем...' : 'Загрузить ещё';
        if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
    }

    async function fetchProducts(query, page, bypassCache = false) {
        let url = `/search/${encodeURIComponent(query)}?page=${page}`;
        if (bypassCache) {
            url += '&no_cache=true';
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("Ошибка сети");
        return await res.json();
    }

    function mergeProducts(newProducts) {
        const seenLinks = new Set(products.map(p => p.link).filter(Boolean));
        const unique = newProducts.filter(item => {
            if (!item || item.error) return false;
            if (!item.link) return true;
            if (seenLinks.has(item.link)) return false;
            seenLinks.add(item.link);
            return true;
        });
        products.push(...unique);
        return unique;
    }

    // ПЕРВЫЙ ПОИСК
    async function search(query, bypassCache = false) {
        if (!query && input) query = input.value.trim();
        if (!query) return showToast("Введите запрос");
        if (isLoading) return;

        isLoading = true;
        currentPage = 1;
        currentQuery = query;
        hasMoreResults = false;
        products = []; // Очищаем старые результаты

        if (bypassCache) {
            showToast("Запрос без кэша (Ctrl/Shift + Enter)");
        }

        // UI State
        if(resultsContainer) resultsContainer.style.display = 'none';
        if(loadingState) loadingState.style.display = 'block';
        if(emptyState) emptyState.style.display = 'none';
        if(errorState) errorState.style.display = 'none';
        
        // Скрываем кнопку подгрузки до окончания первого запроса (Требование 1)
        setLoadMoreVisible(false);

        // СТАЛО: Динамический расчет скелетонов на 3 ряда
// НАДЕЖНЫЙ АДАПТИВНЫЙ РАСЧЕТ СКЕЛЕТОНОВ НА 3 РЯДА
        if (skeletonGrid) {
            // Берём базовые параметры прямо из CSS
            const minCardWidth = 180; // Минимальная ширина карточки из minmax(180px, 1fr)
            const gap = 16;           // Отступ сетки gap: 16px
    
            // Получаем текущую ширину контейнера на экране (с учетом масштаба и разрешения)
            const containerWidth = skeletonGrid.getBoundingClientRect().width;
            
            // Рассчитываем, сколько колонок физически помещается в контейнер
            // Формула учитывает, что отступов (gap) всегда на один меньше, чем карточек
            const itemsPerRow = Math.floor((containerWidth + gap) / (minCardWidth + gap)) || 1;
            
            // Нам нужно строго 3 ряда скелетонов
            const totalSkeletons = itemsPerRow * 3;
            
            // Рендерим ровно столько карточек, сколько заполнит видимую область без дыр
            skeletonGrid.innerHTML = Array(totalSkeletons).fill('<div class="skeleton-card"></div>').join('');
}

        if (loadingTip) {
            let i = 0;
            loadingTip.textContent = tips[0];
            tipInterval = setInterval(() => {
                i = (i + 1) % tips.length;
                loadingTip.textContent = tips[i];
            }, 5000);
        }

        try {
            const data = await fetchProducts(query, currentPage, bypassCache);
            products = data.filter(item => !item?.error);
            hasMoreResults = products.length > 0;
            saveHistory(query);

            render(); // Отрендерит сетку с сортировкой
            updateStats(); // Перепишет плашки статистики
            setLoadMoreVisible(hasMoreResults); // Включит кнопку, если товары есть
            showToast(`Найдено ${products.length} товаров`);

        } catch (e) {
            console.error(e);
            if(loadingState) loadingState.style.display = 'none';
            if(errorState) errorState.style.display = 'block';
        } finally {
            isLoading = false;
            if(tipInterval) clearInterval(tipInterval);
        }
    }

    // ПОДГРУЗКА ПРИ НАЖАТИИ "ЗАГРУЗИТЬ ЕЩЕ"
    async function loadMore() {
        if (!currentQuery || isLoading || isLoadingMore || !hasMoreResults) return;

        isLoadingMore = true;
        setLoadMoreLoading(true);

        try {
            const nextPage = currentPage + 1;
            const fetched = await fetchProducts(currentQuery, nextPage);
            const unique = mergeProducts(fetched);

            if (unique.length === 0) {
                hasMoreResults = false;
                setLoadMoreVisible(false);
                showToast("Больше товаров не найдено");
                return;
            }

            currentPage = nextPage;
            
            // Требование 3: Сначала заново рендерим (внутри отработает сортировка возрастания цены)
            render(); 
            // Требование 3: Пересчитываем и переписываем плашки ("найдено товаров", "мин. цена")
            updateStats(); 
            
            showToast(`Добавлено и отсортировано ${unique.length} товаров`);
        } catch (e) {
            console.error(e);
            showToast("Не удалось загрузить ещё");
        } finally {
            isLoadingMore = false;
            setLoadMoreLoading(false);
        }
    }

    // РЕНДЕРИНГ И СОРТИРОВКА
    function render() {
        let list = [...products]; // Делаем копию массива для безопасных манипуляций
        if (currentMarket !== 'all') list = list.filter(p => p.source === currentMarket);

        const prices = list.map(p => toNum(p.price)).filter(p => p > 0);
        const minPrice = prices.length ? Math.min(...prices) : 0;

        // Сортировка (по умолчанию или по выбору пользователя всегда будет сохранять порядок цен)
        const mode = sortSelect ? sortSelect.value : 'price_asc';
        list.sort((a, b) => {
            const pa = toNum(a.price), pb = toNum(b.price);
            if (mode === 'price_asc') {
                if (pa === 0 && pb !== 0) return 1;
                if (pb === 0 && pa !== 0) return -1;
                return pa - pb;
            }
            if (mode === 'price_desc') return pb - pa;
            if (mode === 'rating_desc') return (parseFloat(b.rating)||0) - (parseFloat(a.rating)||0);
            return 0;
        });

        if(loadingState) loadingState.style.display = 'none';

        if (list.length === 0) {
            if(resultsContainer) resultsContainer.style.display = 'none';
            if(emptyState) emptyState.style.display = 'block';
            if(resultsCount) resultsCount.textContent = "";
            return;
        }

        if(emptyState) emptyState.style.display = 'none';

        if(resultsContainer) {
            resultsContainer.style.display = currentView === 'grid' ? 'grid' : 'flex';
            resultsContainer.className = currentView === 'grid' ? 'products-grid' : 'd-flex flex-column gap-3';
            resultsContainer.innerHTML = '';
            
            // Вставляем отсортированные элементы в DOM
            appendProducts(list, minPrice);

            document.querySelectorAll('.favorite-btn, .favorite-btn-list').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const link = btn.dataset.link;
                    const product = list.find(p => p.link === link);
                    toggleFavorite(product);
                };
            });
        }

        updateResultsCount();
    }

    function appendProducts(items, minPrice) {
        if (!resultsContainer) return;
        const template = document.createElement('template');

        items.forEach(item => {
            template.innerHTML = currentView === 'grid' ? getGridHtml(item, minPrice) : getListHtml(item, minPrice);
            const card = template.content.firstElementChild;
            if (card) {
                resultsContainer.appendChild(card);
            }
        });
    }

    function updateResultsCount() {
        if(!resultsCount) return;
        let list = products;
        if (currentMarket !== 'all') list = list.filter(p => p.source === currentMarket);
        const mNames = { 'all': 'Все площадки', 'wb': 'Wildberries', 'ozon': 'Ozon' };
        resultsCount.innerHTML = `<span class="badge bg-secondary">${list.length}</span> <small class="text-muted">товаров (${mNames[currentMarket]})</small>`;
    }

    // === HTML ГЕНЕРАТОРЫ ===
    function getGridHtml(p, minPrice, isModal = false) {
        const isWb = p.source === 'wb';
        const labelText = isWb ? 'Wildberries' : 'Ozon';
        const textClass = isWb ? 'text-wb' : 'text-ozon';
        const cardBorderClass = isWb ? 'card-wb' : 'card-ozon';
        const img = p.img || 'https://via.placeholder.com/200?text=No+Img';
        const priceNum = toNum(p.price);

        const bestPriceBadge = (!isModal && priceNum > 0 && priceNum === minPrice)
            ? `<div class="best-price-label"><i class="fa-solid fa-fire"></i> Лучшая цена</div>` : '';

        const isFav = favorites.some(fav => fav.link === p.link);
        const heartClass = isFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        const btnActiveClass = isFav ? 'active' : '';

        return `
        <div class="card ${cardBorderClass}">
            ${bestPriceBadge}
            <button class="favorite-btn ${btnActiveClass}" data-link="${p.link}" title="В избранное">
                <i class="${heartClass}"></i>
            </button>
            <div class="card-img-container">
                <img src="${img}" class="card-img-top" loading="lazy" alt="${p.name}">
            </div>
            <div class="card-body">
                <div><span class="market-label ${textClass}">${labelText}</span></div>
                <div class="card-title" title="${p.name}">${p.name}</div>
                <div class="meta-row">
                    <i class="fa-solid fa-star rating-val" style="color:#ffc107"></i>
                    <span class="fw-bold">${p.rating || '0'}</span>
                    <span class="opacity-75">(${p.reviews_qty || 0})</span>
                </div>
                <div class="price-current">${formatPrice(p.price)}</div>
                <a href="${p.link}" target="_blank" class="btn-card">В магазин</a>
            </div>
        </div>`;
    }

    function getListHtml(p, minPrice) {
        const isWb = p.source === 'wb';
        const cardBorderClass = isWb ? 'card-wb' : 'card-ozon';
        const labelText = isWb ? 'WB' : 'OZON';
        const labelColor = isWb ? '#f24be8' : '#4dabf7';
        const img = p.img || 'https://via.placeholder.com/200?text=No+Img';
        const priceNum = toNum(p.price);

        const bestPriceBadge = (priceNum > 0 && priceNum === minPrice)
             ? `<span class="badge bg-success ms-2"><i class="fa-solid fa-fire"></i> Лучшая цена</span>` : '';

        const isFav = favorites.some(fav => fav.link === p.link);

        return `
        <div class="list-card ${cardBorderClass}">
            <div class="list-img-wrapper"><img src="${img}" class="list-img" loading="lazy"></div>
            <div class="list-content">
                <div class="list-header">
                    <div class="list-title" title="${p.name}">${p.name}</div>
                    <div class="d-flex align-items-center">
                        ${bestPriceBadge}
                        <div class="list-price ms-3">${formatPrice(p.price)}</div>
                    </div>
                </div>
                <div class="list-meta">
                    <span style="color: ${labelColor}; font-weight: bold; font-size: 0.75rem;">${labelText}</span>
                    <span>|</span>
                    <i class="fa-solid fa-star text-warning"></i> ${p.rating || '0'}
                    <span>(${p.reviews_qty || 0} отз.)</span>
                </div>
            </div>
            <div class="d-flex flex-column gap-2 ms-3">
                 <button class="btn btn-sm ${isFav ? 'btn-danger' : 'btn-outline-danger'} favorite-btn-list" data-link="${p.link}">
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
                <a href="${p.link}" target="_blank" class="list-btn btn btn-outline-light btn-sm"><i class="fa-solid fa-arrow-right"></i></a>
            </div>
        </div>`;
    }

    // === НАВЕШИВАНИЕ СОБЫТИЙ ===
    renderHistory();
    if(searchBtn) searchBtn.onclick = (e) => search(null, e.ctrlKey || e.shiftKey);
    if(input) { 
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                search(null, e.ctrlKey || e.shiftKey);
            }
        });
        input.disabled = false; 
        input.readOnly = false; 
    }
    if(retryBtn) retryBtn.onclick = (e) => search(currentQuery, e.ctrlKey || e.shiftKey);
    if(loadMoreBtn) loadMoreBtn.onclick = loadMore;
    
    if(sortSelect) {
        sortSelect.onchange = () => {
            render();
            updateStats();
        };
    }
    
    if(toggleViewBtn) {
        toggleViewBtn.onclick = () => { 
            currentView = currentView === 'grid' ? 'list' : 'grid'; 
            toggleViewBtn.innerHTML = currentView === 'grid' ? '<i class="fa-solid fa-th"></i>' : '<i class="fa-solid fa-list"></i>'; 
            render(); 
        };
    }
    
    if(filterButtons) {
        filterButtons.forEach(btn => { 
            btn.onclick = () => { 
                filterButtons.forEach(b => b.classList.remove('active')); 
                btn.classList.add('active'); 
                currentMarket = btn.dataset.market; 
                render(); 
                updateStats(); // Обновляем плашки под выбранный фильтр маркетплейса
            } 
        });
    }
    
    if(exportBtn) {
        exportBtn.onclick = () => {
            if(!products.length) return showToast("Нет данных");
            // Багфикс: очищаем названия от точек с запятой, чтобы не сломать CSV-структуру
            let csv = "Магазин;Название;Цена\n" + products.map(p => `${p.source};${p.name.replace(/;/g, ' ')};${p.price}`).join("\n");
            const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'export.csv'; a.click();
        }
    }
    
    if(themeToggleBtn) {
        themeToggleBtn.onclick = () => {
            currentTheme = currentTheme === "cosmic" ? "ink" : "cosmic";
            localStorage.setItem("app_theme", currentTheme);
            applyTheme(currentTheme);
        };
    }
});