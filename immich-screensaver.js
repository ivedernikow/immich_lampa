/*
 * Immich Screensaver for Lampa
 * Version: 1.0.0
 * Автор: ivedernikow
 */
(function () {
    'use strict';

    var VERSION = '1.0.0';

    if (window.immichScreensaverLoaded) return;
    window.immichScreensaverLoaded = true;

    // ---------- УТИЛИТЫ ----------

    function getUrl() {
        return (Lampa.Storage.get('immich_url', '') || '').replace(/\/+$/, '');
    }

    function getKey() {
        return Lampa.Storage.get('immich_api_key', '') || '';
    }

    function notify(msg) {
        try { Lampa.Noty.show(msg); } catch (e) { console.log('[Immich]', msg); }
    }

    // ---------- МОДАЛЬНОЕ ОКНО НАСТРОЕК ----------

    function openSettings() {
        // Если окно уже открыто — не дублируем
        if ($('.immich-settings-overlay').length) return;

        var url = getUrl();
        var key = getKey();

        var html =
            '<div class="immich-settings-overlay">' +
                '<div class="immich-settings-box">' +
                    '<div class="immich-settings-title">Immich — настройки (v' + VERSION + ')</div>' +
                    '<div class="immich-settings-row">' +
                        '<label>URL сервера</label>' +
                        '<input type="text" class="immich-input" id="immich-input-url" value="' + escapeHtml(url) + '" placeholder="https://immich.example.com">' +
                    '</div>' +
                    '<div class="immich-settings-row">' +
                        '<label>API-ключ</label>' +
                        '<input type="text" class="immich-input" id="immich-input-key" value="' + escapeHtml(key) + '" placeholder="Ваш API-ключ">' +
                    '</div>' +
                    '<div class="immich-settings-buttons">' +
                        '<div class="immich-btn" id="immich-btn-save">Сохранить</div>' +
                        '<div class="immich-btn immich-btn-primary" id="immich-btn-start">Запустить показ</div>' +
                        '<div class="immich-btn" id="immich-btn-close">Закрыть</div>' +
                    '</div>' +
                    '<div class="immich-settings-hint">Вводите текст с подключённой клавиатуры. Сохранение — кнопкой «Сохранить».</div>' +
                '</div>' +
            '</div>';

        $('body').append(html);

        function close() {
            $('.immich-settings-overlay').remove();
        }

        $('#immich-btn-close').on('click hover:enter', close);

        $('#immich-btn-save').on('click hover:enter', function () {
            var newUrl = ($('#immich-input-url').val() || '').trim();
            var newKey = ($('#immich-input-key').val() || '').trim();
            Lampa.Storage.set('immich_url', newUrl);
            Lampa.Storage.set('immich_api_key', newKey);
            notify('Immich: настройки сохранены');
        });

        $('#immich-btn-start').on('click hover:enter', function () {
            var newUrl = ($('#immich-input-url').val() || '').trim();
            var newKey = ($('#immich-input-key').val() || '').trim();
            Lampa.Storage.set('immich_url', newUrl);
            Lampa.Storage.set('immich_api_key', newKey);
            close();
            startSlideshow();
        });

        // Фокус на первое поле для удобства с клавиатуры
        setTimeout(function () { $('#immich-input-url').focus(); }, 100);
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ---------- СЛАЙДШОУ ----------

    var slideshowState = {
        active: false,
        timer: null,
        urls: [],
        index: 0,
        overlay: null
    };

    function startSlideshow() {
        var url = getUrl();
        var key = getKey();

        if (!url || !key) {
            notify('Immich: сначала задайте URL и API-ключ');
            openSettings();
            return;
        }

        notify('Immich: загрузка фотографий...');

        // Запрос случайных ассетов
        fetch(url + '/api/assets/random?count=10', {
            headers: { 'x-api-key': key, 'Accept': 'application/json' }
        })
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function (data) {
            var assets = Array.isArray(data) ? data : (data && data.assets) || [];
            if (!assets.length) {
                notify('Immich: фотографий не найдено');
                return;
            }
            // Загружаем превью как blob (нужен заголовок x-api-key)
            var loads = assets.map(function (asset) {
                var id = asset.id || asset.assetId;
                if (!id) return Promise.resolve(null);
                return fetch(url + '/api/assets/' + id + '/thumbnail?size=preview', {
                    headers: { 'x-api-key': key }
                })
                .then(function (r) {
                    if (!r.ok) return null;
                    return r.blob();
                })
                .then(function (blob) {
                    return blob ? URL.createObjectURL(blob) : null;
                })
                .then(null, function () { return null; });
            });

            return Promise.all(loads).then(function (urls) {
                var valid = urls.filter(function (u) { return !!u; });
                if (!valid.length) {
                    notify('Immich: не удалось загрузить изображения');
                    return;
                }
                showSlideshow(valid);
            });
        })
        .then(null, function (err) {
            console.error('[Immich] fetch error:', err);
            notify('Immich: ошибка запроса (' + (err && err.message ? err.message : 'network') + ')');
        });
    }

    function showSlideshow(urls) {
        slideshowState.urls = urls;
        slideshowState.index = 0;
        slideshowState.active = true;

        var overlay = $(
            '<div class="immich-slideshow-overlay">' +
                '<div class="immich-slide" id="immich-slide"></div>' +
                '<div class="immich-slideshow-hint">Back — выход</div>' +
            '</div>'
        );
        $('body').append(overlay);
        slideshowState.overlay = overlay;

        nextSlide();

        // Выход по Back/Return через обработчик клавиш Lampa
        try {
            Lampa.Keypad && Lampa.Keypad.listener && Lampa.Keypad.listener.follow('keydown', onSlideKey);
        } catch (e) {}
        // Резервный обработчик
        $(document).on('keydown.immich', onSlideKey);
        // Клик по оверлею — выход
        overlay.on('click', stopSlideshow);
    }

    function onSlideKey(e) {
        var code = e && (e.keyCode || e.which);
        // 8 = Backspace, 27 = Esc, 461 = Back на LG, 10009 = Return на Samsung
        if (code === 8 || code === 27 || code === 461 || code === 10009) {
            e.preventDefault && e.preventDefault();
            stopSlideshow();
        }
    }

    function nextSlide() {
        if (!slideshowState.active) return;

        var slide = $('#immich-slide');
        if (!slide.length) return;

        var url = slideshowState.urls[slideshowState.index];
        slideshowState.index = (slideshowState.index + 1) % slideshowState.urls.length;

        slide.css('background-image', 'url("' + url + '")');
        slide.removeClass('immich-slide-anim');
        // Перезапуск CSS-анимации
        void slide[0].offsetWidth;
        slide.addClass('immich-slide-anim');

        slideshowState.timer = setTimeout(nextSlide, 8000);
    }

    function stopSlideshow() {
        slideshowState.active = false;
        if (slideshowState.timer) {
            clearTimeout(slideshowState.timer);
            slideshowState.timer = null;
        }
        try { Lampa.Keypad && Lampa.Keypad.listener && Lampa.Keypad.listener.stopFollow('keydown', onSlideKey); } catch (e) {}
        $(document).off('keydown.immich', onSlideKey);
        if (slideshowState.overlay) {
            slideshowState.overlay.remove();
            slideshowState.overlay = null;
        }
        // Освобождаем blob-URL
        slideshowState.urls.forEach(function (u) {
            try { URL.revokeObjectURL(u); } catch (e) {}
        });
        slideshowState.urls = [];
        notify('Immich: показ остановлен');
    }

    // ---------- ПУНКТ В ГЛАВНОМ МЕНЮ ----------

    function addMenuItem() {
        // Ищем контейнер главного меню Lampa
        var menu = $('.menu__list').first();
        if (!menu.length) menu = $('.menu .list').first();
        if (!menu.length) return false;

        if (menu.find('.immich-menu-item').length) return true;

        var item = $(
            '<li class="menu__item selector immich-menu-item">' +
                '<div class="menu__text">Immich (v' + VERSION + ')</div>' +
            '</li>'
        );

        item.on('hover:enter click', function () {
            openSettings();
        });

        menu.append(item);
        console.log('[Immich] пункт меню добавлен');
        return true;
    }

    function watchMenu() {
        // Пытаемся добавить сразу
        if (addMenuItem()) {
            // Следим за перерисовкой меню, чтобы пункт не пропал
            var target = $('.menu').first();
            if (target.length && window.MutationObserver) {
                var obs = new MutationObserver(function () { addMenuItem(); });
                obs.observe(target[0], { childList: true, subtree: false });
            }
            return;
        }
        // Меню ещё не построено — ждём
        var tries = 0;
        var interval = setInterval(function () {
            tries++;
            if (addMenuItem() || tries > 40) {
                clearInterval(interval);
            }
        }, 500);
    }

    // ---------- СТИЛИ ----------

    function injectStyles() {
        if ($('#immich-styles').length) return;
        var css =
            '.immich-settings-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;}' +
            '.immich-settings-box{background:#1a1a1a;color:#fff;padding:24px;border-radius:10px;width:520px;max-width:90%;font-family:sans-serif;}' +
            '.immich-settings-title{font-size:20px;margin-bottom:16px;font-weight:bold;}' +
            '.immich-settings-row{margin-bottom:14px;}' +
            '.immich-settings-row label{display:block;margin-bottom:6px;font-size:14px;color:#bbb;}' +
            '.immich-input{width:100%;padding:10px;font-size:16px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:6px;box-sizing:border-box;}' +
            '.immich-settings-buttons{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;}' +
            '.immich-btn{padding:10px 16px;background:#333;color:#fff;border-radius:6px;cursor:pointer;user-select:none;font-size:15px;}' +
            '.immich-btn:hover{background:#444;}' +
            '.immich-btn-primary{background:#2a6df4;}' +
            '.immich-btn-primary:hover{background:#3a7dff;}' +
            '.immich-settings-hint{margin-top:14px;font-size:12px;color:#888;}' +
            '.immich-slideshow-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:99998;overflow:hidden;}' +
            '.immich-slide{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;background-position:center;background-repeat:no-repeat;opacity:0;transform:scale(1);transition:opacity 1.2s ease;}' +
            '.immich-slide-anim{opacity:1;animation:immich-zoom 8s linear forwards;}' +
            '@keyframes immich-zoom{from{transform:scale(1);}to{transform:scale(1.08);}}' +
            '.immich-slideshow-hint{position:absolute;bottom:20px;right:20px;color:#fff;opacity:0.5;font-family:sans-serif;font-size:14px;}';
        $('head').append('<style id="immich-styles">' + css + '</style>');
    }

    // ---------- ИНИЦИАЛИЗАЦИЯ ----------

    function init() {
        console.log('[Immich] init v' + VERSION);
        injectStyles();
        watchMenu();
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
    }
})();
