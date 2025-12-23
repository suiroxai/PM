document.addEventListener("DOMContentLoaded", () => {
    // === ЭЛЕМЕНТЫ DOM ===
    const input = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const resultsContainer = document.getElementById("results");
    const sortSelect = document.getElementById("sortSelect");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const resultsCount = document.getElementById("resultsCount");

    // Статусы UI
    const loadingState = document.getElementById("loadingState");
    const emptyState = document.getElementById("emptyState");
    const errorState = document.getElementById("errorState");
    const retryBtn = document.getElementById("retryBtn");

    // Статистика
    const totalProductsEl = document.getElementById("totalProducts");
    const avgPriceEl = document.getElementById("avgPrice");
    const minPriceEl = document.getElementById("minPrice");

    // Кнопки управления
    const toggleViewBtn = document.getElementById("toggleView");
    const exportBtn = document.getElementById("exportBtn");

    // === БЫСТРЫЙ ПОИСК ===
    const quickBtns = document.querySelectorAll(".quick-search");
    quickBtns.forEach(btn => {
        if(btn.dataset.query && btn.dataset.query.toLowerCase() === 'кофемашина') {
            btn.dataset.query = 'кроссовки';
            btn.innerHTML = '<i class="fa-solid fa-shoe-prints me-1"></i> Кроссовки';
        }

        btn.onclick = () => {
            // Если нажали на тег, заполняем инпут и ищем
            if (input) input.value = btn.dataset.query;
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

        // Безопасная проверка bootstrap
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const el = document.createElement("div");
            el.className = "toast show align-items-center text-bg-primary border-0 mb-2";
            el.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">${msg}</div>
                    <button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>`;
            toastContainer.appendChild(el);
            setTimeout(() => el.remove(), 3000);
        } else {
            console.log("Toast:", msg);
        }
    }

    // === АНИМАЦИЯ ЦИФР ===
    function animateValue(obj, start, end, duration, isPrice = false) {
        if(!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
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
    function updateStats() {
        if(!totalProductsEl) return;
        const valid = products.filter(p => toNum(p.price) > 0);
        const currentTotal = parseInt(totalProductsEl.textContent) || 0;
        const targetTotal = valid.length;
        let targetAvg = 0;
        let targetMin = 0;

        if (valid.length) {
            const prices = valid.map(p => toNum(p.price));
            const sum = prices.reduce((a,b)=>a+b, 0);
            targetAvg = Math.round(sum / prices.length);
            targetMin = Math.min(...prices);
        }

        animateValue(totalProductsEl, currentTotal, targetTotal, 1000, false);
        animateValue(avgPriceEl, 0, targetAvg, 1000, true);
        animateValue(minPriceEl, 0, targetMin, 1000, true);
    }

    async function search(query) {
        // Если query не передан, берем из инпута
        if (!query && input) query = input.value.trim();

        if (!query) return showToast("Введите запрос");
        if (isLoading) return;

        isLoading = true;

        // UI Updates
        if(resultsContainer) resultsContainer.innerHTML = '';
        if(loadingState) loadingState.style.display = 'block';
        if(emptyState) emptyState.style.display = 'none';
        if(errorState) errorState.style.display = 'none';
        if(resultsContainer) resultsContainer.style.display = 'none';

        try {
            const res = await fetch(`/search/${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error("Ошибка сети");
            products = await res.json();

            updateStats();
            render();
            showToast(`Найдено ${products.length} товаров`);

        } catch (e) {
            console.error(e);
            if(loadingState) loadingState.style.display = 'none';
            if(errorState) errorState.style.display = 'block';
            if(document.getElementById("errorMessage")) document.getElementById("errorMessage").textContent = "Не удалось загрузить данные";
        } finally {
            isLoading = false;
        }
    }

    function render() {
        let list = products;
        if (currentMarket !== 'all') {
            list = list.filter(p => p.source === currentMarket);
        }

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
            if(resultsContainer) resultsContainer.style.display = 'none';
            if(emptyState) emptyState.style.display = 'block';
            if(resultsCount) resultsCount.textContent = "";
            return;
        }

        if(emptyState) emptyState.style.display = 'none';

        if(resultsContainer) {
            if (currentView === 'grid') {
                resultsContainer.style.display = 'grid';
                resultsContainer.className = 'products-grid';
                resultsContainer.innerHTML = list.map(item => getGridHtml(item)).join('');
            } else {
                resultsContainer.style.display = 'flex';
                resultsContainer.className = 'd-flex flex-column gap-3';
                resultsContainer.innerHTML = list.map(item => getListHtml(item)).join('');
            }
        }

        const mNames = { 'all': 'Все площадки', 'wb': 'Wildberries', 'ozon': 'Ozon' };
        if(resultsCount) resultsCount.innerHTML = `<span class="badge bg-secondary">${list.length}</span> <small class="text-muted">товаров (${mNames[currentMarket]})</small>`;
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

    function getListHtml(p) {
        const isWb = p.source === 'wb';
        const cardBorderClass = isWb ? 'card-wb' : 'card-ozon';
        const labelText = isWb ? 'WB' : 'OZON';
        const labelColor = isWb ? '#f24be8' : '#4dabf7';
        const img = p.img || 'https://via.placeholder.com/200?text=No+Img';

        return `
        <div class="list-card ${cardBorderClass}">
            <div class="list-img-wrapper"><img src="${img}" class="list-img" loading="lazy"></div>
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
            <a href="${p.link}" target="_blank" class="list-btn btn btn-outline-light btn-sm"><i class="fa-solid fa-arrow-right"></i></a>
        </div>`;
    }

    // === СОБЫТИЯ ===
    if(searchBtn) searchBtn.onclick = () => search();

    if(input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") search();
        });
        // Убеждаемся, что инпут доступен
        input.disabled = false;
        input.readOnly = false;
    }

    if(retryBtn) retryBtn.onclick = () => search();
    if(sortSelect) sortSelect.onchange = render;

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
            }
        });
    }

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