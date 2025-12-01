document.addEventListener("DOMContentLoaded", () => {

    const input = document.getElementById("searchInput");
    const btn = document.getElementById("searchBtn");
    const results = document.getElementById("results");
    const sortSelect = document.getElementById("sortSelect");
    const filterButtons = document.querySelectorAll("[data-market]");
    const searchIcon = document.querySelector(".search-icon");
    const loaderIcon = document.querySelector(".loader-icon");
    const emptyState = document.getElementById("emptyState");
    const resultsCount = document.getElementById("resultsCount");

    let products = [];
    let isLoading = false;
    let currentMarket = "all";

    async function search() {
        const q = input.value.trim();
        if (!q) {
            showEmptyState("Введите запрос для поиска");
            return;
        }
        if (isLoading) return;

        isLoading = true;
        btn.disabled = true;
        searchIcon.style.display = "none";
        loaderIcon.style.display = "inline-block";

        try {
            const res = await fetch(`/search/${q}`);
            products = await res.json();
            render();
        } catch (err) {
            console.error("Ошибка запроса:", err);
            showEmptyState("Ошибка при загрузке данных");
        } finally {
            isLoading = false;
            btn.disabled = false;
            loaderIcon.style.display = "none";
            searchIcon.style.display = "inline-block";
        }
    }

    function render() {
        let list = [...products];

        // Фильтрация по источнику
        if (currentMarket !== "all") {
            list = list.filter(p => p.source && p.source.toLowerCase() === currentMarket);
        }

        // Сортировка
        switch (sortSelect.value) {
            case "price_asc":  list.sort((a,b)=>toNum(a.price)-toNum(b.price)); break;
            case "price_desc": list.sort((a,b)=>toNum(b.price)-toNum(a.price)); break;
            case "rating_desc":list.sort((a,b)=>parseFloat(b.rating||0)-parseFloat(a.rating||0)); break;
            case "reviews_desc":list.sort((a,b)=>parseInt(b.reviews_qty||0)-parseInt(a.reviews_qty||0)); break;
        }

        // Обновляем счетчик
        updateResultsCount(list.length);

        if (list.length === 0) {
            showEmptyState("Товары не найдены");
            return;
        }

        hideEmptyState();

        results.innerHTML = list.map(p => {
            // Бейдж источника
            const sourceBadge = p.source ?
                `<span class="source-badge badge rounded-pill source-${p.source.toLowerCase()}">${getSourceName(p.source)}</span>` :
                '';

            // Рейтинг и отзывы
            const ratingValue = p.rating || 'нет';
            const reviewsValue = p.reviews_qty || 'нет отзывов';
            const ratingDisplay = `
                <div class="rating-stars">
                    ⭐ ${ratingValue}
                    <small class="text-muted">${reviewsValue}</small>
                </div>
            `;

            // Цены
            const priceDisplay = p.oldPrice ? `
                <div class="price-current">${p.price}</div>
                <div class="price-old">${p.oldPrice}</div>
            ` : `<div class="price-current">${p.price}</div>`;

            return `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="card h-100">
                    <img src="${p.img}" class="card-img-top"
                         onerror="this.src='https://via.placeholder.com/200x200/1a1a1a/666?text=Нет+изображения'"
                         alt="${p.name}">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title flex-grow-1 text-light">${p.name}</h6>
                            ${sourceBadge}
                        </div>
                        ${ratingDisplay}
                        <div class="mt-auto">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                ${priceDisplay}
                            </div>
                            <button class="card-button" onclick="window.open('${p.link}')">
                                Перейти к товару
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join("");
    }

    function getSourceName(source) {
        const sources = {
            'wb': 'Wildberries',
            'ozon': 'Ozon'
        };
        return sources[source.toLowerCase()] || source;
    }

    function updateResultsCount(count) {
        const marketName = currentMarket === 'all' ? 'Все площадки' :
                          currentMarket === 'wb' ? 'Wildberries' : 'Ozon';
        resultsCount.textContent = `Найдено: ${count} товаров (${marketName})`;
        resultsCount.className = count > 0 ? 'text-success' : 'text-muted';
    }

    function showEmptyState(message) {
        emptyState.style.display = 'block';
        results.style.display = 'none';
        emptyState.innerHTML = `
            <div class="empty-icon mb-3">🔍</div>
            <h3 class="text-muted">${message}</h3>
        `;
        resultsCount.textContent = '';
    }

    function hideEmptyState() {
        emptyState.style.display = 'none';
        results.style.display = 'flex';
    }

    const toNum = s => Number(s.replace(/\D/g, ""));

    // События
    btn.onclick = search;
    input.addEventListener("keydown", e => e.key === "Enter" && search());
    sortSelect.onchange = render;

    // Фильтрация по маркетплейсам
    filterButtons.forEach(btn => {
        btn.onclick = () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentMarket = btn.dataset.market;
            render();
        };
    });

    // Показываем пустое состояние при загрузке
    showEmptyState("Начните поиск товаров");
});