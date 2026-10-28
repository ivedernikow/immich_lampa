/*
 * Immich Screensaver for Lampa
 * Version: 1.1.0
 */
(function () {
    'use strict';

    var VERSION = '1.1.0';

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

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Универсальная обёртка над штатной клавиатурой Lampa
    function editText(title, currentValue, onDone) {
        var opts = {
            title: title,
            value: currentValue || '',
            free: true,
            nosave: true,
            onSave: function (value) { onDone(value); },
            onCancel: function () {}
        };
        try {
            var res = Lampa.Input.edit(opts);
            // В новых версиях Lampa Input.edit возвращает Promise
            if (res && typeof res.then === 'function') {
                res.then(function (value) {
                    if (value !== undefined && value !== null) onDone(value);
                }).then(null, function () {});
            }
        } catch (e) {
            console.error('[Immich] Input.edit error:', e);
            notify('Immich: не удалось открыть клавиатуру');
        }
    }

    // ---------- ОКНО НАСТРОЕК ----------

    function openSettings() {
        if ($('.immich-settings-overlay').length) return;

        var html =
            '<div class="immich-settings-overlay">' +
                '<div class="immich-settings-box">' +
                    '<div class="immich-settings-title">Immich — настройки (v' + VERSION + ')</div>' +

                    '<div class="immich-settings-row">' +
                        '<label>URL сервера</label>' +
                        '<div class="immich-value-btn" id="immich-row-url">' +
                            '<span class="immich-value-text" id="immich-value-url">—</span>' +
                            '<span class="immich-value-edit">Изменить</span>' +
                        '</div>' +
                    '</div>' +

                    '<div class="immich-settings-row">' +
                        '<label>API-ключ</label>' +
                        '<div class="immich-value-btn" id="immich-row-key">' +
                            '<span class="immich-value-text" id="immich-value-key">—</span>' +
                            '<span class="immich-value-edit">Изменить</span>' +
                        '</div>' +
                    '</div>' +

                    '<div class="immich-settings-buttons">' +
                        '<div class="immich-btn immich-btn-primary" id="immich-btn-start">Запустить показ</div>' +
                        '<div class="immich-btn" id="immich-btn-close">Закрыть</div>' +
                    '</div>' +

                    '<div class="immich-settings-hint">Нажмите OK на строке, чтобы открыть клавиатуру Lampa.</div>' +
                '</div>' +
            '</div>';

        $('body').append(html);

        function refreshLabels() {
            var u = getUrl();
            var k = getKey();
            $('#immich-value-url').text(u || '— не задан —');
            $('#immich-value-key').text(k ? ('••••' + k.slice(-4)) : '— не задан —');
        }
        refreshLabels();

        function close() {
            $('.immich-settings-overlay').remove();
        }

        $('#immich-row-url').on('hover:enter click', function () {
            editText('URL сервера Immich', getUrl(), function (value) {
                Lampa.Storage.set('immich_url', String(value || '').trim().replace(/\/+$/, ''));
                refreshLabels();
            });
        });

        $('#immich-row-key').on('hover:enter click', function () {
            editText('API-ключ Immich', getKey(), function (value) {
                Lampa.Storage.set('immich_api_key', String(value || '').trim());
                refreshLabels();
            });
        });

        $('#immich-btn-close').on('click hover:enter', close);

        $('#immich-btn-start').on('click hover:enter', function () {
            close();
            startSlideshow();
        });
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
            var msg = err && err.message ? err.message : 'network';
            notify('Immich: ошибка запроса (' + msg + ')');
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

        $(document).on('keydown.immich', onSlideKey);
        overlay.on('click', stopSlideshow);
    }

    function onSlideKey(e) {
        var code = e && (e.keyCode || e.which);
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
        $(document).off('keydown.immich', onSlideKey);
        if (slideshowState.overlay) {
            slideshowState.overlay.remove();
            slideshowState.overlay = null;
        }
        slideshowState.urls.forEach(function (u) {
            try { URL.revokeObjectURL(u); } catch (e) {}
        });
        slideshowState.urls = [];
        notify('Immich: показ остановлен');
    }

    // ---------- ПУНКТ В ГЛАВНОМ МЕНЮ ----------

    function addMenuItem() {
        var menu = $('.menu__list').first();
        if (!menu.length) menu = $('.menu .list').first();
        if (!menu.length) return false;
        if (menu.find('.immich-menu-item').length) return true;

        var item = $(
            '<li class="menu__item selector immich-menu-item">' +
                '<div class="menu__text">Immich (v' + VERSION + ')</div>' +
            '</li>'
        );
        item.on('hover:enter click', openSettings);
        menu.append(item);
        console.log('[Immich] пункт меню добавлен');
        return true;
    }

    function watchMenu() {
        if (addMenuItem()) {
            var target = $('.menu').first();
            if (target.length && window.MutationObserver) {
                new MutationObserver(addMenuItem).observe(target[0], { childList: true, subtree: false });
            }
            return;
        }
        var tries = 0;
        var interval = setInterval(function () {
            tries++;
            if (addMenuItem() || tries > 40) clearInterval(interval);
        }, 500);
    }

    // ---------- СТИЛИ ----------

    function injectStyles() {
        if ($('#immich-styles').length) return;
        var css =
            '.immich-settings-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;}' +
            '.immich-settings-box{background:#1a1a1a;color:#fff;padding:24px;border-radius:10px;width:560px;max-width:92%;font-family:sans-serif;}' +
            '.immich-settings-title{font-size:20px;margin-bottom:16px;font-weight:bold;}' +
            '.immich-settings-row{margin-bottom:14px;}' +
            '.immich-settings-row label{display:block;margin-bottom:6px;font-size:14px;color:#bbb;}' +
            '.immich-value-btn{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#2a2a2a;border:1px solid #444;border-radius:6px;cursor:pointer;}' +
            '.immich-value-btn:hover{background:#333;border-color:#666;}' +
            '.immich-value-text{font-size:15px;word-break:break-all;max-width:75%;}' +
            '.immich-value-edit{color:#2a6df4;font-size:13px;flex-shrink:0;}' +
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
