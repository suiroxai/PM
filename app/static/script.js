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

    const totalProductsEl = document.getElementById("totalProducts");
    const avgPriceEl = document.getElementById("avgPrice");
    const minPriceEl = document.getElementById("minPrice");

    const toggleViewBtn = document.getElementById("toggleView");
    const exportBtn = document.getElementById("exportBtn");

    // === ИЗБРАННОЕ ===
    const favoritesList = document.getElementById("favoritesList");
    const favoritesEmpty = document.getElementById("favoritesEmpty");
    const favCountBadge = document.getElementById("favCountBadge");

    // Инициализация избранного
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    function updateFavoritesUI() {
        // Обновляем бейдж
        if (favCountBadge) {
            favCountBadge.textContent = favorites.length;
            favCountBadge.style.display = favorites.length > 0 ? 'inline-block' : 'none';
        }

        // Обновляем список в модальном окне
        if (favoritesList && favoritesEmpty) {
            if (favorites.length === 0) {
                favoritesList.innerHTML = '';
                favoritesList.style.display = 'none';
                favoritesEmpty.style.display = 'block';
            } else {
                favoritesEmpty.style.display = 'none';
                favoritesList.style.display = 'grid';
                favoritesList.innerHTML = favorites.map(item => getGridHtml(item, 0, true)).join('');

                // Вешаем обработчики на сердечки в модалке (УДАЛЕНИЕ ПРИ КЛИКЕ)
                favoritesList.querySelectorAll('.favorite-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        e.preventDefault();
                        const link = btn.dataset.link;
                        // Находим товар и удаляем его
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

        // Обновляем иконку во всех местах (в списке-плитке и в списке-строках)
        const btns = document.querySelectorAll(`.favorite-btn[data-link="${product.link}"], .favorite-btn-list[data-link="${product.link}"]`);

        btns.forEach(btn => {
            const isFav = favorites.some(p => p.link === product.link);

            // Если это кнопка на плитке (Grid) или в модалке
            if (btn.classList.contains('favorite-btn')) {
                if(isFav) {
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
                } else {
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
                }
            }

            // Если это кнопка в списке (List View)
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

    updateFavoritesUI(); // Первый запуск

    // === СОВЕТЫ ===
    const tips = [
        "Совет: Сортируйте отзывы по дате — качество товара часто меняется от партии к партии.",
        "Лайфхак: Смотрите негативные отзывы первыми — они быстрее покажут реальные проблемы.",
        "Факт: Одинаковый товар у разных продавцов может отличаться по комплектации, свойствам и т.д.",
        "Факт: Утром (6–9) и поздно ночью цены обновляются чаще всего.",
        "Совет: Проверяйте дату отзывов — старые могут относиться к другой версии товара.",
        "Лайфхак: Один и тот же товар часто дешевле в другом цвете или комплекте.",
        "Факт: WB и Ozon могут давать разные цены одному и тому же пользователю.",
        "Лайфхак: Проверяйте описание внизу карточки — там прячут важные ограничения.",
        "Факт: 'Оригинал' не всегда означает официальный бренд — проверяйте продавца.",
        "Совет: Смотрите чаще отзывы — фото магазина часто обманчивы.",
        "Факт: Высокий рейтинг при малом числе отзывов — повод насторожиться.",
        "Лайфхак: Сравнивайте цену с прошлой неделей — скидка может быть фейковой.",
        "Факт: Бесплатный возврат — это часть цены товара, она уже заложена.",
        "Подождите, мы ищем самые выгодные предложения...",
        "Факт: Самые выгодные скидки часто появляются без уведомлений."
    ];
    let tipInterval;

    // === ИСТОРИЯ ПОИСКА ===
    let searchHistory = JSON.parse(localStorage.getItem("search_history") || "[]");

    function renderHistory() {
        if (!historyContainer) return;
        if (searchHistory.length === 0) {
            historyContainer.innerHTML = "";
            return;
        }
        historyContainer.innerHTML = searchHistory.map(tag =>
            `<span class="history-tag">${tag}</span>`
        ).join('');

        document.querySelectorAll(".history-tag").forEach(el => {
            el.onclick = () => {
                input.value = el.innerText;
                toggleClearBtn();
                search(el.innerText);
            };
        });
    }

    function saveHistory(query) {
        if (!query) return;
        searchHistory = [query, ...searchHistory.filter(item => item !== query)].slice(8);
        localStorage.setItem("search_history", JSON.stringify(searchHistory));
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
        btn.onclick = () => {
            if (input) { input.value = btn.dataset.query; toggleClearBtn(); }
            search(btn.dataset.query);
        };
    });

    // === СОСТОЯНИЕ ===
    let products = [];
    let isLoading = false;
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

    function showToast(msg) {
        const toastContainer = document.getElementById("toastContainer");
        if (!toastContainer) return;
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const el = document.createElement("div");
            el.className = "toast show align-items-center text-bg-primary border-0 mb-2";
            el.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
            toastContainer.appendChild(el);
            setTimeout(() => el.remove(), 3000);
        }
    }

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

    // === ЛОГИКА ПОИСКА ===
    function updateStats() {
        if(!totalProductsEl) return;
        const valid = products.filter(p => toNum(p.price) > 0);
        const currentTotal = parseInt(totalProductsEl.textContent) || 0;
        const targetTotal = valid.length;

        let targetAvg = 0, targetMin = 0;
        if (valid.length) {
            const prices = valid.map(p => toNum(p.price));
            targetAvg = Math.round(prices.reduce((a,b)=>a+b, 0) / prices.length);
            targetMin = Math.min(...prices);
        }

        animateValue(totalProductsEl, currentTotal, targetTotal, 1000, false);
        animateValue(avgPriceEl, 0, targetAvg, 1000, true);
        animateValue(minPriceEl, 0, targetMin, 1000, true);
    }

    async function search(query) {
        if (!query && input) query = input.value.trim();
        if (!query) return showToast("Введите запрос");
        if (isLoading) return;

        isLoading = true;
        saveHistory(query);

        // UI Updates: Показываем скелетоны
        if(resultsContainer) resultsContainer.style.display = 'none';
        if(loadingState) loadingState.style.display = 'block';
        if(emptyState) emptyState.style.display = 'none';
        if(errorState) errorState.style.display = 'none';

        // Генерируем 24 скелетона (чтобы хватало на большие экраны при уменьшении масштаба)
        if(skeletonGrid) {
            skeletonGrid.innerHTML = Array(27).fill('<div class="skeleton-card"></div>').join('');
        }

        // Запуск советов
        if (loadingTip) {
            let i = 0;
            loadingTip.textContent = tips[0];
            tipInterval = setInterval(() => {
                i = (i + 1) % tips.length;
                loadingTip.textContent = tips[i];
            }, 5000);
        }

        try {
            const res = await fetch(`/search/${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error("Ошибка сети");
            products = await res.json();

            updateStats();
            render();
            showToast(`Найдено ${products.length} товаров`);

        } catch (e) {
            console.error(e);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
        } finally {
            isLoading = false;
            if(tipInterval) clearInterval(tipInterval);
        }
    }

    function render() {
        let list = products;
        if (currentMarket !== 'all') list = list.filter(p => p.source === currentMarket);

        const prices = list.map(p => toNum(p.price)).filter(p => p > 0);
        const minPrice = prices.length ? Math.min(...prices) : 0;

        if(sortSelect) {
            const mode = sortSelect.value;
            list.sort((a,b) => {
                const pa = toNum(a.price), pb = toNum(b.price);
                if (mode === 'price_asc') return pa - pb;
                if (mode === 'price_desc') return pb - pa;
                if (mode === 'rating_desc') return (parseFloat(b.rating)||0) - (parseFloat(a.rating)||0);
                return 0;
            });
        }

        if(loadingState) loadingState.style.display = 'none';

        if (list.length === 0) {
            resultsContainer.style.display = 'none';
            emptyState.style.display = 'block';
            if(resultsCount) resultsCount.textContent = "";
            return;
        }

        if(emptyState) emptyState.style.display = 'none';

        if(resultsContainer) {
            resultsContainer.style.display = currentView === 'grid' ? 'grid' : 'flex';
            resultsContainer.className = currentView === 'grid' ? 'products-grid' : 'd-flex flex-column gap-3';

            resultsContainer.innerHTML = list.map(item =>
                currentView === 'grid' ? getGridHtml(item, minPrice) : getListHtml(item, minPrice)
            ).join('');

            // Навешиваем события на сердечки (поддерживаем и Grid и List классы)
            document.querySelectorAll('.favorite-btn, .favorite-btn-list').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const link = btn.dataset.link;
                    const product = list.find(p => p.link === link);
                    toggleFavorite(product);
                };
            });
        }

        const mNames = { 'all': 'Все площадки', 'wb': 'Wildberries', 'ozon': 'Ozon' };
        if(resultsCount) resultsCount.innerHTML = `<span class="badge bg-secondary">${list.length}</span> <small class="text-muted">товаров (${mNames[currentMarket]})</small>`;
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

        // Проверяем избранное
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

    // === СОБЫТИЯ ===
    renderHistory();
    if(searchBtn) searchBtn.onclick = () => search();
    if(input) { input.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); }); input.disabled = false; input.readOnly = false; }
    if(retryBtn) retryBtn.onclick = () => search();
    if(sortSelect) sortSelect.onchange = render;
    if(toggleViewBtn) toggleViewBtn.onclick = () => { currentView = currentView === 'grid' ? 'list' : 'grid'; toggleViewBtn.innerHTML = currentView === 'grid' ? '<i class="fa-solid fa-th"></i>' : '<i class="fa-solid fa-list"></i>'; render(); };
    if(filterButtons) filterButtons.forEach(btn => { btn.onclick = () => { filterButtons.forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentMarket = btn.dataset.market; render(); } });
    if(exportBtn) exportBtn.onclick = () => {
        if(!products.length) return showToast("Нет данных");
        let csv = "Магазин;Название;Цена\n" + products.map(p => `${p.source};${p.name};${p.price}`).join("\n");
        const blob = new Blob([csv], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'export.csv'; a.click();
    }
});