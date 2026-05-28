(function () {
    'use strict';

    const PLUGIN_NAME = 'My PL';
    const API_HOST = 'https://api.zenithjs.ws/embed/movie/';

    // Логіка отримання реального потоку
    const StreamParser = {
        async getStream(movieId) {
            try {
                // Використовуємо проксі Лампи для обходу CORS
                const network = new Lampa.Reguest();
                const url = API_HOST + movieId;
                
                return new Promise((resolve) => {
                    network.native(url, (data) => {
                        // Парсимо JSON відповідь з API
                        if (data && data.video) {
                            resolve({ url: data.video, title: 'Якість HD' });
                        } else {
                            resolve(null);
                        }
                    }, () => resolve(null), false);
                });
            } catch (e) {
                return null;
            }
        }
    };

    // Функція інтеграції кнопки
    function injectButton(render, movie) {
        if (render.find('.view--my-pl-trigger').length) return;

        const btn = $(`<div class="full-start__button selector view--my-pl-trigger" style="background: #3f51b5 !important; color: #fff !important; font-weight: bold; margin-right: 10px !important; display: inline-flex !important;">
            <span>my</span>
        </div>`);

        btn.on('hover:enter', async () => {
            Lampa.Loading.start();
            // Тут ми беремо ID з метаданих (або прописуємо пошук ID)
            const movieId = movie.id || '76677'; // В реальності тут має бути ID з парсингу Anwap
            const stream = await StreamParser.getStream(movieId);
            
            Lampa.Loading.stop();
            if (stream) {
                Lampa.Player.play({
                    url: stream.url,
                    title: movie.title || movie.name
                });
            } else {
                Lampa.Noty.show('Помилка завантаження потоку');
            }
        });

        render.find('.full-start__buttons').prepend(btn);
    }

    // Слухач подій
    Lampa.Listener.follow('full', (e) => {
        if (e.type === 'complite') {
            setTimeout(() => injectButton(e.object.activity.render(), e.data.movie || e.card), 300);
        }
    });

    console.log('✅ My PL v3.5.0: Парсер ZenithJS активовано.');
})();
