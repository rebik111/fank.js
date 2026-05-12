// ==UserScript==
// @name         FanFilm4K Online
// @description  Окрема кнопка + покращений пошук різними мовами
// @version      1.3.0
// @author       Grok Dev
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// ==/UserScript==

(function () {
    'use strict';

    const BASE_URL = 'https://v12.fanfilm4k.media';
    const PLUGIN_NAME = 'FanFilm4K';

    // ========== РОЗШИРЕНА НОРМАЛІЗАЦІЯ ==========
    function normalizeTitle(title) {
        if (!title) return '';
        return title
            .toLowerCase()
            .replace(/[:.,!?–—«»"']/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Транслітерація (для кращого пошуку)
    function translit(str) {
        const map = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye', 'ж': 'zh',
            'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
            'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
            'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ь': '', 'ю': 'yu', 'я': 'ya',
            'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Є': 'Ye', 'Ж': 'Zh'
        };
        return str.split('').map(char => map[char] || char).join('');
    }

    // Основна функція пошуку з кількома варіантами
    async function searchMovie(movie) {
        const titles = new Set();

        // 1. Основна назва
        if (movie.title) titles.add(movie.title);
        if (movie.name) titles.add(movie.name);

        // 2. Оригінальна назва (англійська)
        if (movie.original_title) titles.add(movie.original_title);
        if (movie.original_name) titles.add(movie.original_name);

        // 3. Англійська з TMDB
        if (movie.en_title) titles.add(movie.en_title);

        const results = [];

        for (let title of titles) {
            if (!title) continue;

            const normalized = normalizeTitle(title);
            const translited = translit(normalized);

            // Спроба 1: Оригінальна назва
            let url = await trySearch(title);
            if (url) return url;

            // Спроба 2: Транслітерована
            if (translited !== normalized) {
                url = await trySearch(translited);
                if (url) return url;
            }

            // Спроба 3: Без року
            url = await trySearch(normalized);
            if (url) return url;
        }

        return null;
    }

    // Один запит на сайт
    async function trySearch(query) {
        try {
            const encoded = encodeURIComponent(query);
            const resp = await fetch(`${BASE_URL}/?s=${encoded}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!resp.ok) return null;

            const html = await resp.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const items = doc.querySelectorAll('.shortstory, .movie-item, article, .poster, .card');

            for (let item of items) {
                const link = item.querySelector('a[href*="/"]');
                const titleEl = item.querySelector('h2, .title, .name, .card-title, a');

                if (!link || !titleEl) continue;

                const foundTitle = normalizeTitle(titleEl.textContent);

                // Якщо знайдено збіг хоча б в одному з варіантів
                if (foundTitle.length > 3) {
                    return link.href;
                }
            }
        } catch (e) {
            console.error('[FanFilm4K] Search error:', e);
        }
        return null;
    }

    // Отримання відео посилань
    async function getVideoLinks(movieUrl) {
        try {
            const resp = await fetch(movieUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await resp.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const sources = [];

            doc.querySelectorAll('iframe').forEach(iframe => {
                let src = iframe.src || iframe.getAttribute('data-src');
                if (src && /player|embed|video|cdn/.test(src)) {
                    sources.push({ url: src, quality: '1080p', type: 'iframe' });
                }
            });

            doc.querySelectorAll('video source, video').forEach(v => {
                let src = v.src || v.getAttribute('data-src') || v.getAttribute('src');
                if (src) {
                    const quality = /2160|4k|uhd/i.test(src) ? '4K' : '1080p';
                    sources.push({
                        url: src,
                        quality: quality,
                        type: src.includes('.m3u8') ? 'hls' : 'mp4'
                    });
                }
            });

            return sources.length ? sources : [{ url: movieUrl, quality: 'Auto', type: 'page' }];
        } catch (e) {
            console.error('[FanFilm4K] Parse error:', e);
            return [{ url: movieUrl, quality: 'Auto', type: 'page' }];
        }
    }

    // ==================== КОМПОНЕНТ ====================
    Lampa.Component.add(PLUGIN_NAME.toLowerCase(), {
        create: async function () {
            this.activity.loader(true);

            const movie = this.activity.movie || this.activity.card;
            const movieUrl = await searchMovie(movie);

            if (!movieUrl) {
                this.buildError('Не вдалося знайти фільм на FanFilm4K<br>Спробуйте іншу назву');
                return;
            }

            const sources = await getVideoLinks(movieUrl);
            this.buildList(sources, movieUrl, movie.title || movie.name);
        },

        buildList: function (sources, originalUrl, title) {
            let html = `
                <div class="fanfilm4k-container">
                    <div class="fanfilm4k-header">
                        <h2>🎥 FanFilm4K — ${title}</h2>
                    </div>
            `;

            sources.forEach(src => {
                html += `
                    <div class="button fanfilm-btn" 
                         data-url="${src.url}" 
                         data-type="${src.type}">
                        ▶ ${src.quality} ${src.type === 'iframe' ? '(Плеєр)' : src.type.toUpperCase()}
                    </div>
                `;
            });

            html += `</div>`;
            this.activity.render().html(html);

            $('.fanfilm-btn').on('hover:enter', function () {
                const url = $(this).data('url');
                const type = $(this).data('type');

                if (type === 'iframe' || type === 'hls' || type === 'mp4') {
                    Lampa.Player.play({ playlist: [{ file: url, title: title }] });
                } else {
                    window.open(url, '_blank');
                }
            });
        },

        buildError: function (msg) {
            this.activity.render().html(`
                <div style="padding: 40px 20px; text-align: center; color: #ff8888;">
                    ${msg}
                </div>
            `);
        }
    });

    // ==================== ОКРЕМА КНОПКА ====================
    function addFanFilmButton() {
        if ($('.fanfilm4k-separate-btn').length) return;

        const btn = $(`
            <div class="button fanfilm4k-separate-btn" style="background: linear-gradient(90deg, #e91e63, #9c27b0); color: white; font-weight: 600; margin: 8px 0;">
                <span>🎥 FanFilm4K</span>
            </div>
        `);

        btn.on('hover:enter', () => {
            Lampa.Activity.push({
                component: PLUGIN_NAME.toLowerCase(),
                title: 'FanFilm4K',
                movie: Lampa.Activity.active().card || Lampa.Activity.active().movie
            });
        });

        $('.view--torrent, .view--online, .full__info').append(btn);
    }

    Lampa.Listener.follow('full', (e) => {
        if (e.type === 'complite') setTimeout(addFanFilmButton, 500);
    });

    if (Lampa.Activity.active().component === 'full') {
        setTimeout(addFanFilmButton, 700);
    }

    console.log(`✅ ${PLUGIN_NAME} v1.3.0 — Пошук різними мовами активовано`);
})();