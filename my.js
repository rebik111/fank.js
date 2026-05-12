(function () {
    'use strict';

    var plugin_name = 'my_pl';
    var plugin_version = '1.5.0';

    // Джерела
    var Balancers = {
        sources: [
            { title: 'FanFilm 4K', url: 'https://v12.fanfilm4k.media' },
            { title: 'Filmix My', url: 'https://filmix.my' },
            { title: 'Anwap Love', url: 'https://mm.anwap.love' },
            { title: 'UAFix Net', url: 'https://uafix.net' }
        ],
        proxy: 'https://cors.lampa.mx/'
    };

    // Об'єкт для роботи з мережею та пошуком (аналог з вашого файлу)
    function Parser() {
        var network = new Lampa.Reguest();
        
        this.search = function (movie, callback) {
            var active_url = Lampa.Storage.get(plugin_name + '_source', Balancers.sources[0].url);
            var query = movie.title || movie.name;
            var clean_query = query.toLowerCase().replace(/[:.,!?–—«»"']/g, '').replace(/\s+/g, ' ').trim();
            
            // Формуємо пошуковий запит
            var search_url = Balancers.proxy + active_url + '/?s=' + encodeURIComponent(clean_query);

            network.silent(search_url, function (html) {
                // Емуляція результатів (вибір якості)
                var results = [
                    { title: '1080p', quality: '1080', url: active_url },
                    { title: '720p', quality: '720', url: active_url },
                    { title: '480p', quality: '480', url: active_url }
                ];
                callback(results);
            }, function () {
                Lampa.Noty.show('Помилка з'єднання з джерелом');
                callback([]);
            });
        };
    }

    // Компонент налаштувань (вибір балансера)
    function MyPLComponent(object) {
        var scroll = new Lampa.Scroll({mask: true, over: true});
        
        this.create = function () {
            var _this = this;
            var current = Lampa.Storage.get(plugin_name + '_source', Balancers.sources[0].url);

            var list = $('<div class="category-full__title" style="padding: 20px; font-weight: bold;">MY PL: Вибір джерела</div>');
            scroll.append(list);

            Balancers.sources.forEach(function (src) {
                var item = Lampa.Template.get('button_online', { title: src.title });
                
                if (src.url === current) {
                    item.addClass('active');
                    item.find('.online__item-title').append(' <span style="color: #2196f3;">(Обрано)</span>');
                }

                item.on('hover:enter', function () {
                    Lampa.Storage.set(plugin_name + '_source', src.url);
                    Lampa.Noty.show('Джерело змінено');
                    Lampa.Activity.backward();
                });
                scroll.append(item);
            });

            return scroll.render();
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

        this.pause = function () {};
        this.stop = function () {};
        this.terminate = function () { scroll.destroy(); };
    }

    // Головна функція ініціалізації
    function startPlugin() {
        // 1. ПРАПОР УКРАЇНИ (SVG для MSX)
        var flag_icon = '<svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<rect width="24" height="12" fill="#0057B7"/>' +
            '<rect y="12" width="24" height="12" fill="#FFD700"/>' +
        '</svg>';

        // 2. КНОПКА В МЕНЮ (як у зразку)
        var menu_item = $('<div class="menu__item selector" data-action="' + plugin_name + '">' +
            '<div class="menu__ico">' + flag_icon + '</div>' +
            '<div class="menu__text">MY PL</div>' +
        '</div>');

        menu_item.on('hover:enter', function () {
            Lampa.Activity.push({
                title: 'MY PL Settings',
                component: plugin_name,
                page: 1
            });
        });

        // Форсована ін'єкція в меню для MSX (через інтервал)
        var inject_timer = setInterval(function () {
            var menu = $('.menu .menu__list');
            if (menu.length > 0) {
                if (!$('.menu__item[data-action="' + plugin_name + '"]').length) {
                    menu.append(menu_item);
                }
                clearInterval(inject_timer);
            }
        }, 500);

        // 3. РЕЄСТРАЦІЯ КОМПОНЕНТА
        Lampa.Component.add(plugin_name, MyPLComponent);

        // 4. ІНТЕРФЕЙС У КАРТЦІ ФІЛЬМУ (Кнопка "Онлайн")
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var btn = $(
                    '<div class="button selector mypl-btn" style="background: rgba(0, 87, 183, 0.4); border-left: 5px solid #FFD700; margin-top: 10px;">' +
                        '<span>Дивитись через MY PL</span>' +
                    '</div>'
                );
                
                btn.on('hover:enter', function () {
                    var p = new Parser();
                    Lampa.Noty.show('Шукаємо контент...');
                    
                    p.search(e.data.movie, function (results) {
                        if (results.length > 0) {
                            Lampa.Select.show({
                                title: 'Якість відео',
                                items: results,
                                onSelect: function (item) {
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

                var container = e.render.find('.full-start__buttons');
                if (container.length > 0) {
                    container.append(btn);
                }
            }
        });
    }

    // Запуск (враховуючи специфіку Media Station X)
    if (window.app_ready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                startPlugin();
            }
        });
    }

    // Запасний варіант ініціалізації для застарілих MSX
    setTimeout(function() {
        if (!$('.menu__item[data-action="' + plugin_name + '"]').length) {
            startPlugin();
        }
    }, 3000);

})();
