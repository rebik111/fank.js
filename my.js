/**
 * My PL - Universal Lampa Streaming Plugin
 * Version: 3.6.0
 * Multi-source production-ready plugin with ZenithJS parser integration
 */

(function () {
    'use strict';

    // ========== КОНФІГУРАЦІЯ ==========
    const PLUGIN_ID = 'my-pl';
    const PLUGIN_VERSION = '3.6.0';
    const ANWAP_BASE = 'https://my.anwap.love';
    const ANWAP_MEDIA = 'https://mm.anwap.media';

    // Локалізація
    const i18n = {
        uk: {
            name: 'my',
            desc: 'Мультиджерельний потік',
            search: 'Пошук у my',
            play: 'Відтворити',
            loading: 'Завантаження...',
            error: 'Помилка отримання потоку',
            noResults: 'Результатів не знайдено',
            parseError: 'Не вдалося витягти відеопотік'
        },
        ru: {
            name: 'my',
            desc: 'Мультиджерельный поток',
            search: 'Поиск в my',
            play: 'Воспроизвести',
            loading: 'Загрузка...',
            error: 'Ошибка получения потока',
            noResults: 'Результатов не найдено',
            parseError: 'Не удалось извлечь видеопоток'
        }
    };

    function getLang(key) {
        const lang = (window.Lampa && Lampa.Storage.get('lang')) || 'uk';
        return i18n[lang]?.[key] || i18n['uk'][key];
    }

    // ========== РУШІЙ ПАРСИНГУ ПОТОКІВ ==========
    const StreamParser = {
        // Step 1: Пошук фільму на Anwap
        searchAnwap: function (query, callback, errorCallback) {
            var network = new Lampa.Reguest();
            var url = ANWAP_BASE + '/films/search/?slv=' + encodeURIComponent(query);

            network.timeout(10000);
            network.native(url, function (html) {
                var results = [];
                // Регулярний вираз для збору карток фільмів з пошукової видачі
                var itemRegex = /<a href=["'](\/films\/\d+)["'][^>]*>[\s\S]*?<div class="namefilm">([^<]+)<\/div>/g;
                var match;

                while ((match = itemRegex.exec(html)) !== null) {
                    results.push({
                        id: match[1].replace('/films/', ''),
                        title: match[2].trim(),
                        url: ANWAP_MEDIA + match[1],
                        source: 'ANWAP'
                    });
                }

                if (results.length > 0) {
                    callback(results);
                } else {
                    errorCallback(getLang('noResults'));
                }
            }, function (err) {
                errorCallback(err);
            }, false, { dataType: 'text' });
        },

        // Step 2 & 3: Витягування iframe ZenithJS та парсинг прямих посилань m3u8
        getStreamUrl: function (filmUrl, callback, errorCallback) {
            var network = new Lampa.Reguest();
            
            // Завантажуємо сторінку фільму для пошуку iframe
            network.native(filmUrl, function (html) {
                var iframeMatch = html.match(/iframe\.src\s*=\s*["'](https:\/\/api\.zenithjs\.ws\/embed\/movie\/\d+)["']/i) ||
                                  html.match(/src=["'](https:\/\/api\.zenithjs\.ws\/embed\/[^\s"']+)["']/i);
                
                if (!iframeMatch) {
                    return errorCallback(getLang('parseError'));
                }

                var embedUrl = iframeMatch[1];

                // Завантажуємо вміст iframe ZenithJS
                var embedNetwork = new Lampa.Reguest();
                embedNetwork.native(embedUrl, function (iframeHtml) {
                    // Шукаємо посилання master.m3u8 всередині параметру download плеєра VenomPlayer
                    var streamMatch = iframeHtml.match(/m=(https?%3A%2F%2F[^"&]+master\.m3u8[^"&]*)/i) || 
                                      iframeHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);

                    if (streamMatch) {
                        var rawUrl = streamMatch[1];
                        var finalUrl = rawUrl.indexOf('%') > -1 ? decodeURIComponent(rawUrl) : rawUrl;
                        callback(finalUrl);
                    } else {
                        errorCallback(getLang('parseError'));
                    }
                }, function () {
                    errorCallback(getLang('error'));
                }, false, { dataType: 'text' });

            }, function () {
                errorCallback(getLang('error'));
            }, false, { dataType: 'text' });
        }
    };

    // ========== КОМПОНЕНТ СІТКИ ПОШУКУ (ОБОВ'ЯЗКОВИЙ ДЛЯ LAMPA) ==========
    function MyPLSearchComponent(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var grid = new Lampa.Grid({ cols: 4 });
        var html = $('<div class="directory-preview MyPL-search"></div>');
        var active = 1;

        this.create = function () {
            var self = this;
            this.activity.loader(true);

            // Викликаємо парсер для пошуку
            StreamParser.searchAnwap(object.searchQuery, function (results) {
                self.activity.loader(false);
                self.buildRows(results);
            }, function (msg) {
                self.activity.loader(false);
                html.append('<div class="empty-paragraph">' + msg + '</div>');
                self.activity.toggle();
            });

            return this.render();
        };

        this.buildRows = function (items) {
            var self = this;
            grid.clear();

            items.forEach(function (item) {
                // Створення картки у сітці результатів
                var card = Lampa.Template.get('card', {
                    title: item.title,
                    release_date: item.source
                });

                card.addClass('selector');
                card.find('.card__age').remove();

                card.on('hover:enter', function () {
                    // Показуємо завантажувач перед початком парсингу відео
                    Lampa.Select.show({
                        title: getLang('loading'),
                        items: [],
                        onSelect: function() {}
                    });

                    StreamParser.getStreamUrl(item.url, function (m3u8Url) {
                        Lampa.Select.close(); // Закриваємо модалку завантаження
                        
                        // Запуск вбудованого плеєра Lampa
                        Lampa.Player.play({
                            url: m3u8Url,
                            title: item.title,
                            card: object.cardData
                        });
                        
                        var videoObject = {
                            url: m3u8Url,
                            title: item.title
                        };
                        Lampa.Player.callback(videoObject);
                    }, function (errText) {
                        Lampa.Select.close();
                        Lampa.Noty.show(errText);
                    });
                });

                grid.append(card);
            });

            scroll.append(grid.render());
            html.append(scroll.render());
            this.activity.toggle();
        };

        this.register = function () {
            Lampa.Controller.add('my_pl_search', {
                toggle: function () {
                    grid.toggle();
                },
                right: function () { grid.right(); },
                left: function () { grid.left(); },
                down: function () { grid.down(); },
                up: function () { grid.up(); },
                back: function () {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('my_pl_search');
        };

        this.start = function () {
            this.register();
        };

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            network.clear();
            grid.destroy();
            scroll.destroy();
            html.remove();
        };
    }

    // ========== БЕЗПЕЧНА ІНЖЕКЦІЯ КНОПКИ "my" ==========
    function startPlugin() {
        // Реєстрація компонента у системі Lampa
        Lampa.Component.add('my-pl-search', MyPLSearchComponent);

        // Слухаємо відкриття сторінки з описом фільму (картки)
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite' || e.type === 'ready') {
                var render = e.object.activity.render();
                
                // Перевірка, щоб уникнути дублювання кнопки
                if (!render || render.find('.view--my-plugin-btn').length) return;

                // Створення кнопки з назвою "my" за канонами Lampa
                var buttonHtml = '<div class="full-start__button selector view--my-plugin-btn" data-action="my-stream">' +
                                 '<span>' + getLang('name') + '</span>' +
                                 '</div>';

                var $btn = $(buttonHtml);

                // Опрацювання кліку / натискання Enter на пульті
                $btn.on('hover:enter', function () {
                    var card = e.object.card_data || e.object.movie;
                    var titleQuery = card.title || card.name || card.original_title;

                    if (!titleQuery) {
                        Lampa.Noty.show(getLang('noResults'));
                        return;
                    }

                    // Перехід у створений пошуковий екран нашого плагіна
                    Lampa.Activity.push({
                        url: '',
                        title: getLang('search') + ': ' + titleQuery,
                        component: 'my-pl-search',
                        searchQuery: titleQuery,
                        cardData: card,
                        page: 1
                    });
                });

                // Безпечне додавання в контейнер кнопок (не ламає інші розширення)
                var container = render.find('.full-start__buttons');
                if (container.length) {
                    container.append($btn);
                    
                    // Оновлюємо просторову навігацію пульта, щоб нова кнопка підхопила фокус
                    if (e.object.toggle) {
                        // Якщо Lampa потребує ре-ініціалізації фокусу на сторінці
                    }
                }
            }
        });

        console.log('%c✅ My PL Plugin Ready v' + PLUGIN_VERSION, 'color: #667eea; font-size: 14px; font-weight: bold;');
    }

    // Очікування готовності оболонки Lampa/MSX
    if (window.appready) {
        startPlugin();
    } else if (window.Lampa && window.Lampa.Listener) {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') startPlugin();
        });
    }
})();
