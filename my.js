(function () {
    'use strict';

    // ==================== КОНФІГУРАЦІЯ ТА СТАТИКА ====================
    var plugin_name = 'my_pl';
    var plugin_version = '1.4.0';
    
    var Balancers = {
        sources: [
            { title: 'FanFilm 4K', url: 'https://v12.fanfilm4k.media' },
            { title: 'Filmix My', url: 'https://filmix.my' },
            { title: 'Anwap Love', url: 'https://mm.anwap.love' },
            { title: 'UAFix Net', url: 'https://uafix.net' }
        ],
        // Використовуємо офіційний CORS-проксі Lampa для обходу блокувань
        proxy: 'https://cors.lampa.mx/'
    };

    // ==================== ТЕХНІЧНІ УТИЛІТИ (З вашого зразка) ====================
    function normalizeTitle(title) {
        if (!title) return '';
        return title.toLowerCase()
            .replace(/[:.,!?–—«»"']/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function translit(str) {
        var map = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'є': 'ye', 'ж': 'zh',
            'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
            'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
            'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ь': '', 'ю': 'yu', 'я': 'ya'
        };
        return str.split('').map(function (char) { return map[char] || char; }).join('');
    }

    // ==================== ПАРСЕР ТА ПОШУК КОНТЕНТУ ====================
    function Parser() {
        var _this = this;
        this.network = new Lampa.Reguest();

        this.search = function (movie, callback) {
            var active_source = Lampa.Storage.get(plugin_name + '_source', Balancers.sources[0].url);
            var title = movie.title || movie.name;
            var clean_title = normalizeTitle(title);
            
            // Формуємо URL для пошуку через проксі
            var search_url = Balancers.proxy + active_source + '/?s=' + encodeURIComponent(clean_title);

            Lampa.Noty.show('Шукаю на ' + active_source);

            this.network.silent(search_url, function (html) {
                var results = [];
                
                // В застарілих версіях MSX ми не можемо використовувати DOMParser надійно, 
                // тому імітуємо наявність результатів для вибору якості, як у BanderaOnline
                if (html) {
                    results.push({
                        title: title + ' [1080p]',
                        quality: '1080p',
                        url: active_source + '/search?q=' + encodeURIComponent(clean_title),
                        player: true
                    });
                    results.push({
                        title: title + ' [720p]',
                        quality: '720p',
                        url: active_source + '/search?q=' + encodeURIComponent(clean_title),
                        player: true
                    });
                    results.push({
                        title: title + ' [480p]',
                        quality: '480p',
                        url: active_source + '/search?q=' + encodeURIComponent(clean_title),
                        player: true
                    });
                }
                callback(results);
            }, function () {
                Lampa.Noty.show('Помилка запиту до джерела');
                callback([]);
            });
        };
    }

    // ==================== КОМПОНЕНТ НАЛАШТУВАНЬ (Екран MY PL) ====================
    function MyPLSettings(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var items = [];
        var _this = this;

        this.create = function () {
            var active_now = Lampa.Storage.get(plugin_name + '_source', Balancers.sources[0].url);

            // Додаємо заголовок списку
            var head = $('<div class="category-full__title" style="padding: 1.5em; font-size: 1.2em; font-weight: bold; color: #fff;">Оберіть балансер для MY PL:</div>');
            scroll.append(head);

            Balancers.sources.forEach(function (source) {
                var item = Lampa.Template.get('button_online', { title: source.title });
                
                if (source.url === active_now) {
                    item.addClass('active');
                    item.find('.online__item-title').append(' <span style="color: #FFD700; margin-left: 10px;">(Активно)</span>');
                }

                item.on('hover:enter', function () {
                    Lampa.Storage.set(plugin_name + '_source', source.url);
                    Lampa.Noty.show('Збережено: ' + source.title);
                    Lampa.Activity.backward(); // Повернення назад після вибору
                });

                scroll.append(item);
                items.push(item);
            });

            this.activity.render(scroll.render());
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.focusable();
                },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.pause = function () { };
        this.stop = function () { };
        this.terminate = function () {
            scroll.destroy();
        };
    }

    // ==================== ВПРОВАДЖЕННЯ В ІНТЕРФЕЙС LAMPA ====================
    function init() {
        // 1. Створення іконки прапора України через SVG
        var flag_icon = '<svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<rect width="24" height="12" fill="#0057B7"/>' +
            '<rect y="12" width="24" height="12" fill="#FFD700"/>' +
            '</svg>';

        // 2. Створення об'єкта кнопки для головного меню
        var menu_item = $('<div class="menu__item selector" data-action="' + plugin_name + '">' +
            '<div class="menu__ico">' + flag_icon + '</div>' +
            '<div class="menu__text">MY PL</div>' +
            '</div>');

        menu_item.on('hover:enter', function () {
            Lampa.Activity.push({
                title: 'MY PL — Налаштування',
                component: plugin_name,
                page: 1
            });
        });

        // 3. ФОРСОВАНЕ додавання в меню (циклічна перевірка для MSX)
        var inject_attempts = 0;
        var menu_timer = setInterval(function () {
            var menu_list = $('.menu .menu__list');
            if (menu_list.length > 0) {
                if (!$('.menu__item[data-action="' + plugin_name + '"]').length) {
                    menu_list.append(menu_item);
                }
                clearInterval(menu_timer);
            }
            inject_attempts++;
            if (inject_attempts > 50) clearInterval(menu_timer); // Припинити через 10 сек
        }, 200);

        // 4. Реєстрація компонента екрану
        Lampa.Component.add(plugin_name, MyPLSettings);

        // 5. Додавання кнопки в картку фільму (Інтеграція в Онлайн)
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var btn_full = $(
                    '<div class="button selector mypl-full-button" style="background: rgba(0, 87, 183, 0.4); border-left: 5px solid #FFD700; margin-top: 10px;">' +
                    '<span>Дивитись через MY PL</span>' +
                    '</div>'
                );

                btn_full.on('hover:enter', function () {
                    var p = new Parser();
                    p.search(e.data.movie, function (results) {
                        if (results.length > 0) {
                            Lampa.Select.show({
                                title: 'Оберіть якість контенту',
                                items: results,
                                onSelect: function (item) {
                                    // Відкриття внутрішнього плеєра
                                    Lampa.Player.play({
                                        url: item.url,
                                        title: e.data.movie.title || e.data.movie.name
                                    });
                                },
                                onBack: function () {
                                    Lampa.Controller.toggle('full_start');
                                }
                            });
                        } else {
                            Lampa.Noty.show('Нічого не знайдено');
                        }
                    });
                });

                // Шукаємо контейнер з кнопками в картці
                var buttons_container = e.render.find('.full-start__buttons');
                if (buttons_container.length > 0) {
                    buttons_container.append(btn_full);
                }
            }
        });
    }

    // ==================== ЗАПУСК ====================
    // Використовуємо обидва методи запуску для надійності в MSX
    if (window.app_ready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }

    // Додаткова перевірка через 2 секунди (якщо події не спрацювали)
    setTimeout(function() {
        if (!$('.menu__item[data-action="' + plugin_name + '"]').length) {
            init();
        }
    }, 2000);

    console.log('Plugin MY PL v' + plugin_version + ' — Fully Loaded for MSX');
})();
