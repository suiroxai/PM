document.addEventListener("DOMContentLoaded", () => {
    // === ЭЛЕМЕНТЫ DOM ===
    const input = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const resultsContainer = document.getElementById("results");
    const sortSelect = document.getElementById("sortSelect");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const resultsCount = document.getElementById("resultsCount");

    // Статусы UI (Загрузка, Пусто, Ошибка)
    const loadingState = document.getElementById("loadingState");
    const emptyState = document.getElementById("emptyState");
    const errorState = document.getElementById("errorState");
    const retryBtn = document.getElementById("retryBtn");

    // Статистика (сверху)
    const totalProductsEl = document.getElementById("totalProducts");
    const avgPriceEl = document.getElementById("avgPrice");
    const minPriceEl = document.getElementById("minPrice");

    // Кнопки управления
    const toggleViewBtn = document.getElementById("toggleView");
    const exportBtn = document.getElementById("exportBtn");

    // === ХАК: Подмена "Кофемашины" на "Кроссовки" ===
    const quickBtns = document.querySelectorAll(".quick-search");
    quickBtns.forEach(btn => {
        if(btn.dataset.query && btn.dataset.query.toLowerCase() === 'кофемашина') {
            btn.dataset.query = 'кроссовки';
            btn.innerHTML = '<i class="fa-solid fa-shoe-prints me-1"></i> Кроссовки';
        }

        btn.onclick = () => {
            search(btn.dataset.query);
        };
    });

    // === СОСТОЯНИЕ ПРИЛОЖЕНИЯ ===
    let products = [];
    let isLoading = false;
    let currentMarket = "all";
    let currentView = "grid"; // 'grid' или 'list'

    // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

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

        const el = document.createElement("div");
        el.className = "toast show align-items-center text-bg-primary border-0 mb-2";
        el.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${msg}</div>
                <button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>`;
        toastContainer.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    // === АНИМАЦИЯ ЦИФР ===
    function animateValue(obj, start, end, duration, isPrice = false) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            // Плавное замедление (easeOutQuad)
            const easeProgress = 1 - (1 - progress) * (1 - progress);

            const currentVal = Math.floor(easeProgress * (end - start) + start);

            obj.textContent = isPrice ? formatPrice(currentVal) : currentVal;

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                 obj.textContent = isPrice ? formatPrice(end) : end;
            }
        };
        window.requestAnimationFrame(step);
    }

    // === ЛОГИКА ===

    // Обновление цифр статистики с анимацией
    function updateStats() {
        const valid = products.filter(p => toNum(p.price) > 0);

        // Текущие значения (или 0, если пустые) для анимации
        const currentTotal = parseInt(totalProductsEl.textContent) || 0;

        // Целевые значения
        const targetTotal = valid.length;

        let targetAvg = 0;
        let targetMin = 0;

        if (valid.length) {
            const prices = valid.map(p => toNum(p.price));
            const sum = prices.reduce((a,b)=>a+b, 0);
            targetAvg = Math.round(sum / prices.length);
            targetMin = Math.min(...prices);
        }

        // Запуск анимации (за 1 секунду)
        animateValue(totalProductsEl, currentTotal, targetTotal, 1000, false);
        // Для цен мы не знаем текущее числовое значение из текста "1 200 ₽", поэтому просто анимируем от 0 или обновляем
        // Но лучше анимировать от 0 для эффекта
        animateValue(avgPriceEl, 0, targetAvg, 1000, true);
        animateValue(minPriceEl, 0, targetMin, 1000, true);
    }

    // Основная функция поиска
    async function search(query = input.value.trim()) {
        if (!query) return showToast("Введите запрос");
        if (isLoading) return;

        input.value = query;
        isLoading = true;

        resultsContainer.innerHTML = '';
        loadingState.style.display = 'block';
        emptyState.style.display = 'none';
        errorState.style.display = 'none';
        resultsContainer.style.display = 'none';

        try {
            const res = await fetch(`/search/${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error("Ошибка сети");
            products = await res.json();

            updateStats(); // Теперь с анимацией!
            render();
            showToast(`Найдено ${products.length} товаров`);

        } catch (e) {
            console.error(e);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
            document.getElementById("errorMessage").textContent = "Не удалось загрузить данные";
        } finally {
            isLoading = false;
        }
    }

    // Рендеринг (отрисовка) товаров
    function render() {
        let list = products;
        if (currentMarket !== 'all') {
            list = list.filter(p => p.source === currentMarket);
        }

        const mode = sortSelect.value;
        list.sort((a,b) => {
            const pa = toNum(a.price), pb = toNum(b.price);
            if (mode === 'price_asc') return pa - pb;
            if (mode === 'price_desc') return pb - pa;
            if (mode === 'rating_desc') return (parseFloat(b.rating)||0) - (parseFloat(a.rating)||0);
            return 0;
        });

        loadingState.style.display = 'none';

        if (list.length === 0) {
            resultsContainer.style.display = 'none';
            emptyState.style.display = 'block';
            resultsCount.textContent = "";
            return;
        }

        emptyState.style.display = 'none';

        if (currentView === 'grid') {
            resultsContainer.style.display = 'grid';
            resultsContainer.className = 'products-grid';
            resultsContainer.innerHTML = list.map(item => getGridHtml(item)).join('');
        } else {
            resultsContainer.style.display = 'flex';
            resultsContainer.className = 'd-flex flex-column gap-3';
            resultsContainer.innerHTML = list.map(item => getListHtml(item)).join('');
        }

        const mNames = { 'all': 'Все площадки', 'wb': 'Wildberries', 'ozon': 'Ozon' };
        resultsCount.innerHTML = `<span class="badge bg-secondary">${list.length}</span> <small class="text-muted">товаров (${mNames[currentMarket]})</small>`;
    }

    // === HTML ГЕНЕРАТОРЫ ===

    function getGridHtml(p) {
        const isWb = p.source === 'wb';
        const labelText = isWb ? 'Wildberries' : 'Ozon';
        const textClass = isWb ? 'text-wb' : 'text-ozon';
        const cardBorderClass = isWb ? 'card-wb' : 'card-ozon';
        const img = p.img || 'https://via.placeholder.com/200?text=No+Img';

        return `
        <div class="card ${cardBorderClass}">
            <div class="card-img-container">
                <img src="${img}" class="card-img-top" loading="lazy" alt="${p.name}">
            </div>

            <div class="card-body">
                <div>
                    <span class="market-label ${textClass}">
                        ${labelText}
                    </span>
                </div>

                <div class="card-title" title="${p.name}">${p.name}</div>

                <div class="meta-row">
                    <i class="fa-solid fa-star rating-val" style="color:#ffc107"></i>
                    <span class="fw-bold">${p.rating || '0'}</span>
                    <span class="opacity-75">(${p.reviews_qty || 0})</span>
                </div>

                <div class="price-current">${formatPrice(p.price)}</div>

                <a href="${p.link}" target="_blank" class="btn-card">
                    В магазин
                </a>
            </div>
        </div>
        `;
    }

    function getListHtml(p) {
        const isWb = p.source === 'wb';
        const cardBorderClass = isWb ? 'card-wb' : 'card-ozon';
        const labelText = isWb ? 'WB' : 'OZON';
        const labelColor = isWb ? '#f24be8' : '#4dabf7';
        const img = p.img || 'https://via.placeholder.com/200?text=No+Img';

        return `
        <div class="list-card ${cardBorderClass}">
            <div class="list-img-wrapper">
                <img src="${img}" class="list-img" loading="lazy">
            </div>

            <div class="list-content">
                <div class="list-header">
                    <div class="list-title" title="${p.name}">${p.name}</div>
                    <div class="list-price">${formatPrice(p.price)}</div>
                </div>

                <div class="list-meta">
                    <span style="color: ${labelColor}; font-weight: bold; font-size: 0.75rem;">${labelText}</span>
                    <span>|</span>
                    <i class="fa-solid fa-star text-warning"></i> ${p.rating || '0'}
                    <span>(${p.reviews_qty || 0} отз.)</span>
                </div>
            </div>

            <a href="${p.link}" target="_blank" class="list-btn btn btn-outline-light btn-sm">
                <i class="fa-solid fa-arrow-right"></i>
            </a>
        </div>
        `;
    }

    // === ОБРАБОТЧИКИ СОБЫТИЙ ===
    searchBtn.onclick = () => search();
    input.onkeydown = (e) => e.key === 'Enter' && search();
    retryBtn.onclick = () => search();

    sortSelect.onchange = render;

    toggleViewBtn.onclick = () => {
        currentView = currentView === 'grid' ? 'list' : 'grid';
        toggleViewBtn.innerHTML = currentView === 'grid'
            ? '<i class="fa-solid fa-th"></i>'
            : '<i class="fa-solid fa-list"></i>';
        render();
    };

    filterButtons.forEach(btn => {
        btn.onclick = () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMarket = btn.dataset.market;
            render();
        }
    });

    if(exportBtn) {
        exportBtn.onclick = () => {
            if(!products.length) return showToast("Нет данных");
            let csv = "Магазин;Название;Цена\n" + products.map(p => `${p.source};${p.name};${p.price}`).join("\n");
            const blob = new Blob([csv], {type: 'text/csv'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'export.csv';
            a.click();
        }
    }
});