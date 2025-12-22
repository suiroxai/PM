document.addEventListener("DOMContentLoaded", () => {
    // Элементы DOM
    const input = document.getElementById("searchInput");
    const btn = document.getElementById("searchBtn");
    const results = document.getElementById("results");
    const sortSelect = document.getElementById("sortSelect");
    const filterButtons = document.querySelectorAll("[data-market]");
    const emptyState = document.getElementById("emptyState");
    const loadingState = document.getElementById("loadingState");
    const errorState = document.getElementById("errorState");
    const retryBtn = document.getElementById("retryBtn");
    const resultsCount = document.getElementById("resultsCount");
    const totalProductsEl = document.getElementById("totalProducts");
    const avgPriceEl = document.getElementById("avgPrice");
    const minPriceEl = document.getElementById("minPrice");
    const exportBtn = document.getElementById("exportBtn");
    const toggleViewBtn = document.getElementById("toggleView");
    const quickSearchBtns = document.querySelectorAll(".quick-search");

    // Состояние приложения
    let products = [];
    let isLoading = false;
    let currentMarket = "all";
    let currentView = "grid";

    // Форматирование цены
    function formatPrice(price) {
        if (!price) return "0 ₽";
        const num = parseInt(price.replace(/\D/g, ""));
        return new Intl.NumberFormat('ru-RU').format(num) + " ₽";
    }

    // Показать уведомление
    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast align-items-center text-bg-${type} border-0`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        document.getElementById("toastContainer").appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();

        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    }

    // Обновить статистику
    function updateStats() {
        const validProducts = products.filter(p => p.price && !isNaN(toNum(p.price)));

        totalProductsEl.textContent = validProducts.length;

        if (validProducts.length > 0) {
            const prices = validProducts.map(p => toNum(p.price));
            const avg = Math.round(prices.reduce((a, b) => a + b) / prices.length);
            const min = Math.min(...prices);

            avgPriceEl.textContent = formatPrice(avg.toString());
            minPriceEl.textContent = formatPrice(min.toString());
        } else {
            avgPriceEl.textContent = "0 ₽";
            minPriceEl.textContent = "0 ₽";
        }
    }

    // Поиск товаров
    async function search(query = input.value.trim()) {
        if (!query) {
            showEmptyState("Введите запрос для поиска");
            return;
        }
        if (isLoading) return;

        input.value = query;
        isLoading = true;

        // Показать состояние загрузки
        showLoadingState();

        try {
            const res = await fetch(`/search/${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

            products = await res.json();

            // Проверка на ошибки парсинга
            if (products.some(p => p.error)) {
                showToast("Некоторые данные могут быть неполными", "warning");
            }

            updateStats();
            render();
            showToast(`Найдено ${products.length} товаров`, "success");

        } catch (err) {
            console.error("Ошибка запроса:", err);
            showErrorState("Не удалось загрузить данные. Проверьте подключение к интернету.");
        } finally {
            isLoading = false;
        }
    }

    // Рендеринг товаров
    function render() {
        let list = [...products];

        // Фильтрация по источнику
        if (currentMarket !== "all") {
            list = list.filter(p => p.source && p.source.toLowerCase() === currentMarket);
        }

        // Сортировка
        switch (sortSelect.value) {
            case "price_asc":
                list.sort((a,b) => toNum(a.price || 0) - toNum(b.price || 0));
                break;
            case "price_desc":
                list.sort((a,b) => toNum(b.price || 0) - toNum(a.price || 0));
                break;
            case "rating_desc":
                list.sort((a,b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
                break;
            case "reviews_desc":
                list.sort((a,b) => parseInt(b.reviews_qty || 0) - parseInt(a.reviews_qty || 0));
                break;
        }

        // Обновляем счетчик
        updateResultsCount(list.length);

        if (list.length === 0) {
            showEmptyState("Товары не найдены. Попробуйте изменить запрос.");
            return;
        }

        hideEmptyState();
        hideErrorState();

        // Рендеринг в зависимости от выбранного вида
        if (currentView === "list") {
            renderListView(list);
        } else {
            renderGridView(list);
        }
    }

    // Рендеринг в виде сетки
    function renderGridView(list) {
        results.innerHTML = list.map((p, index) => {
            const delay = (index * 0.1).toFixed(1);
            return `
            <div class="col-12 col-md-6 col-lg-4" style="animation-delay: ${delay}s">
                <div class="card h-100">
                    <div class="card-img-container">
                        <img src="${p.img || 'https://via.placeholder.com/300x300/1a1a2e/4ecdc4?text=Нет+изображения'}"
                             class="card-img-top"
                             alt="${p.name || 'Товар'}"
                             loading="lazy">
                    </div>
                    <div class="card-body d-flex flex-column p-4">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <span class="source-badge source-${p.source}">
                                ${getSourceName(p.source)}
                            </span>
                            <div class="rating-stars">
                                <i class="fas fa-star"></i> ${p.rating || 'Нет'}
                                <small class="text-muted ms-2">
                                    <i class="fas fa-comment"></i> ${p.reviews_qty || '0'}
                                </small>
                            </div>
                        </div>

                        <h6 class="card-title text-light mb-3" title="${p.name || ''}">
                            ${p.name ? (p.name.length > 60 ? p.name.substring(0, 60) + '...' : p.name) : 'Без названия'}
                        </h6>

                        <div class="mt-auto">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <div class="price-current">${formatPrice(p.price)}</div>
                                    ${p.oldPrice ? `<div class="price-old">${formatPrice(p.oldPrice)}</div>` : ''}
                                </div>
                                <div class="text-muted">
                                    <i class="fas fa-tag"></i>
                                </div>
                            </div>

                            <div class="d-grid gap-2">
                                <button class="card-button" onclick="window.open('${p.link || '#'}', '_blank')">
                                    <i class="fas fa-external-link-alt me-2"></i>Перейти к товару
                                </button>
                                <button class="btn btn-outline-secondary btn-sm"
                                        onclick="addToCompare('${p.name}', ${toNum(p.price)})">
                                    <i class="fas fa-balance-scale me-2"></i>Сравнить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join("");
    }

    // Рендеринг в виде списка
    function renderListView(list) {
        results.innerHTML = list.map(p => `
            <div class="col-12">
                <div class="card mb-3">
                    <div class="row g-0">
                        <div class="col-md-2">
                            <div class="card-img-container h-100">
                                <img src="${p.img || 'https://via.placeholder.com/200x200/1a1a2e/4ecdc4?text=Нет+изображения'}"
                                     class="img-fluid rounded-start h-100 w-100 object-fit-cover"
                                     alt="${p.name}">
                            </div>
                        </div>
                        <div class="col-md-10">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <span class="source-badge source-${p.source} mb-2">
                                            ${getSourceName(p.source)}
                                        </span>
                                        <h5 class="card-title mb-2">${p.name}</h5>
                                        <div class="rating-stars mb-2">
                                            ⭐ ${p.rating || 'Нет'}
                                            <small class="text-muted ms-3">
                                                <i class="fas fa-comment"></i> ${p.reviews_qty || '0'} отзывов
                                            </small>
                                        </div>
                                    </div>
                                    <div class="text-end">
                                        <div class="price-current h4 mb-2">${formatPrice(p.price)}</div>
                                        ${p.oldPrice ? `<div class="price-old">${formatPrice(p.oldPrice)}</div>` : ''}
                                    </div>
                                </div>
                                <div class="d-flex justify-content-between align-items-center mt-3">
                                    <div>
                                        <button class="btn btn-outline-primary btn-sm me-2"
                                                onclick="window.open('${p.link}', '_blank')">
                                            <i class="fas fa-shopping-cart me-1"></i> Купить
                                        </button>
                                        <button class="btn btn-outline-secondary btn-sm"
                                                onclick="showDetails('${p.name}')">
                                            <i class="fas fa-info-circle me-1"></i> Подробнее
                                        </button>
                                    </div>
                                    <small class="text-muted">
                                        Обновлено только что
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join("");
    }

    // Вспомогательные функции
    function getSourceName(source) {
        const sources = {
            'wb': 'Wildberries',
            'ozon': 'Ozon'
        };
        return sources[source.toLowerCase()] || source;
    }

    function toNum(s) {
        if (!s) return 0;
        return parseInt(s.toString().replace(/\D/g, "")) || 0;
    }

    // Обновление счетчика результатов
    function updateResultsCount(count) {
        const marketName = currentMarket === 'all' ? 'Все площадки' :
                          currentMarket === 'wb' ? 'Wildberries' : 'Ozon';
        resultsCount.innerHTML = `
            <span class="text-success">${count}</span> товаров найдено на
            <span class="badge bg-primary">${marketName}</span>
        `;
    }

    // Состояния UI
    function showLoadingState() {
        loadingState.style.display = 'block';
        emptyState.style.display = 'none';
        errorState.style.display = 'none';
        results.style.display = 'none';
    }

    function showEmptyState(message) {
        loadingState.style.display = 'none';
        errorState.style.display = 'none';
        results.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.querySelector('h3').textContent = message;
    }

    function showErrorState(message) {
        loadingState.style.display = 'none';
        emptyState.style.display = 'none';
        results.style.display = 'none';
        errorState.style.display = 'block';
        document.getElementById('errorMessage').textContent = message;
    }

    function hideEmptyState() {
        emptyState.style.display = 'none';
        results.style.display = 'flex';
    }

    function hideErrorState() {
        errorState.style.display = 'none';
    }

    // Экспорт данных
    function exportData() {
        if (products.length === 0) {
            showToast("Нет данных для экспорта", "warning");
            return;
        }

        const csv = [
            ['Источник', 'Название', 'Цена', 'Рейтинг', 'Отзывы', 'Ссылка'],
            ...products.map(p => [
                p.source,
                `"${p.name || ''}"`,
                p.price || '',
                p.rating || '',
                p.reviews_qty || '',
                p.link || ''
            ])
        ].map(row => row.join(';')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `price_compare_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast("Данные экспортированы в CSV", "success");
    }

    // Глобальные функции для кнопок
    window.addToCompare = function(name, price) {
        showToast(`Товар "${name}" добавлен к сравнению`, "info");
    };

    window.showDetails = function(name) {
        showToast(`Подробности о товаре "${name}"`, "info");
    };

    // Обработчики событий
    btn.onclick = () => search();
    input.addEventListener("keydown", e => e.key === "Enter" && search());
    sortSelect.onchange = render;
    retryBtn.onclick = () => search();
    exportBtn.onclick = exportData;

    // Переключение вида
    toggleViewBtn.onclick = () => {
        currentView = currentView === "grid" ? "list" : "grid";
        toggleViewBtn.innerHTML = currentView === "grid" ?
            '<i class="fas fa-th"></i>' :
            '<i class="fas fa-list"></i>';
        render();
    };

    // Фильтрация по маркетплейсам
    filterButtons.forEach(btn => {
        btn.onclick = () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentMarket = btn.dataset.market;
            render();
        };
    });

    // Быстрый поиск
    quickSearchBtns.forEach(btn => {
        btn.onclick = () => {
            const query = btn.dataset.query;
            search(query);
        };
    });

    // Инициализация
    showEmptyState("Начните поиск товаров");
    updateStats();
});