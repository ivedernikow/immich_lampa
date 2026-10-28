/*
 * Immich Screensaver for Lampa
 * Version: 1.1.2
 */
(function () {
    'use strict';

    var VERSION = '1.1.2';
    var PROXY = 'https://test.cors.workers.dev/?';

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

    // Запрос с автоматическим fallback на CORS-прокси
    // Возвращает Promise<Response>
    function requestWithFallback(url, headers, tag) {
        function direct() {
            console.log('[Immich][' + tag + '] direct fetch:', url);
            return fetch(url, { method: 'GET', headers: headers, mode: 'cors', credentials: 'omit' });
        }
        function viaProxy() {
            var proxied = PROXY + encodeURIComponent(url);
            console.log('[Immich][' + tag + '] proxy fetch:', proxied);
            return fetch(proxied, { method: 'GET', headers: headers, credentials: 'omit' });
        }
        return direct().then(null, function (e) {
            console.warn('[Immich][' + tag + '] direct failed:', e && e.message);
            return viaProxy();
        });
    }

    // ---------- ВВОД ТЕКСТА ----------

    function editTextDirect(title, currentValue, onDone) {
        if ($('.immich-input-modal').length) return;
        var html =
            '<div class="immich-settings-overlay immich-input-modal">' +
                '<div class="immich-settings-box">' +
                    '<div class="immich-settings-title">' + escapeHtml(title) + '</div>' +
                    '<input type="text" class="immich-direct-field" value="' + escapeHtml(currentValue || '') + '">' +
                    '<div class="immich-settings-buttons">' +
                        '<div class="immich-btn immich-btn-primary" id="immich-direct-ok">Сохранить</div>' +
                        '<div class="immich-btn" id="immich-direct-cancel">Отмена</div>' +
                    '</div>' +
                    '<div class="immich-settings-hint">Введите текст с клавиатуры. Enter — сохранить, Esc — отмена.</div>' +
                '</div>' +
            '</div>';
        $('body').append(html);
        var $input = $('.immich-direct-field');

        function doSave() { var v = $input.val(); $('.immich-input-modal').remove(); onDone(v); }
        function doCancel() { $('.immich-input-modal').remove(); }

        [50, 200, 500, 1000, 2000].forEach(function (d) {
            setTimeout(function () {
                if ($input.length && $input.is(':visible')) {
                    try { $input[0].focus(); } catch (e) {}
                    try { var len = $input.val().length; $input[0].setSelectionRange(len, len); } catch (e) {}
                }
            }, d);
        });

        $input.on('keydown keypress keyup', function (e) {
            e.stopPropagation();
            if (e.type === 'keydown') {
                if (e.keyCode === 13) { e.preventDefault(); doSave(); }
                if (e.keyCode === 27) { e.preventDefault(); doCancel(); }
            }
        });

        $('#immich-direct-ok').on('click hover:enter', doSave);
        $('#immich-direct-cancel').on('click hover:enter', doCancel);
    }

    // ---------- ОКНО НАСТРОЕК ----------

    function openSettings() {
        if ($('.immich-settings-overlay:not(.immich-input-modal)').length) return;
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
                    '<div class="immich-settings-hint">При блокировке CORS запрос пойдёт через публичный прокси test.cors.workers.dev. API-ключ будет передан через этот прокси.</div>' +
                '</div>' +
            '</div>';
        $('body').append(html);

        function refresh() {
            $('#immich-value-url').text(getUrl() || '— не задан —');
            var k = getKey();
            $('#immich-value-key').text(k ? ('••••' + k.slice(-4)) : '— не задан —');
        }
        refresh();

        function close() { $('.immich-settings-overlay:not(.immich-input-modal)').remove(); }

        $('#immich-row-url').on('hover:enter click', function () {
            editTextDirect('URL сервера Immich', getUrl(), function (v) {
                Lampa.Storage.set('immich_url', String(v || '').trim().replace(/\/+$/, ''));
                refresh();
            });
        });
        $('#immich-row-key').on('hover:enter click', function () {
            editTextDirect('API-ключ Immich', getKey(), function (v) {
                Lampa.Storage.set('immich_api_key', String(v || '').trim());
                refresh();
            });
        });

        $('#immich-btn-close').on('click hover:enter', close);
        $('#immich-btn-start').on('click hover:enter', function () { close(); startSlideshow(); });
    }

    // ---------- СЛАЙДШОУ ----------

    var st = { active: false, timer: null, urls: [], index: 0, overlay: null };

    function startSlideshow() {
        var url = getUrl();
        var key = getKey();

        if (!url) { notify('Immich: URL не задан'); openSettings(); return; }
        if (!key) { notify('Immich: API-ключ не задан'); openSettings(); return; }

        var endpoint = url + '/api/assets/random?count=10';
        var headers = { 'x-api-key': key, 'Accept': 'application/json' };

        notify('Immich: запрос списка фото...');

        requestWithFallback(endpoint, headers, 'list')
        .then(function (r) {
            console.log('[Immich][list] status:', r.status, 'type:', r.type);
            if (!r.ok) {
                return r.text().then(function (t) {
                    throw new Error('HTTP ' + r.status + ' — ' + (t || '').slice(0, 120));
                });
            }
            return r.json();
        })
        .then(function (data) {
            var assets = Array.isArray(data) ? data
                : (data && (data.assets || data.items || data.results)) || [];
            console.log('[Immich] assets count:', assets.length);
            if (!assets.length) { notify('Immich: пустой список'); return; }

            var loads = assets.map(function (a) {
                var id = a.id || a.assetId;
                if (!id) return Promise.resolve(null);
                var thumbUrl = url + '/api/assets/' + id + '/thumbnail?size=preview';
                return requestWithFallback(thumbUrl, { 'x-api-key': key }, 'thumb')
                    .then(function (r2) {
                        if (!r2.ok) { console.warn('[Immich][thumb] status', r2.status); return null; }
                        return r2.blob();
                    })
                    .then(function (blob) {
                        if (!blob) return null;
                        try { return URL.createObjectURL(blob); } catch (e) { return null; }
                    })
                    .then(null, function (e) { console.warn('[Immich][thumb] err', e && e.message); return null; });
            });

            return Promise.all(loads).then(function (urls) {
                var valid = urls.filter(function (u) { return !!u; });
                console.log('[Immich] valid thumbs:', valid.length);
                if (!valid.length) { notify('Immich: превью не загрузились'); return; }
                showSlideshow(valid);
            });
        })
        .then(null, function (err) {
            var msg = err && err.message ? err.message : String(err);
            console.error('[Immich] error:', msg);
            notify('Immich: ' + msg);
        });
    }

    function showSlideshow(urls) {
        st.urls = urls; st.index = 0; st.active = true;
        var overlay = $(
            '<div class="immich-slideshow-overlay">' +
                '<div class="immich-slide" id="immich-slide"></div>' +
                '<div class="immich-slideshow-hint">Back — выход</div>' +
            '</div>'
        );
        $('body').append(overlay);
        st.overlay = overlay;
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
        if (!st.active) return;
        var slide = $('#immich-slide');
        if (!slide.length) return;
        var url = st.urls[st.index];
        st.index = (st.index + 1) % st.urls.length;
        slide.css('background-image', 'url("' + url + '")');
        slide.removeClass('immich-slide-anim');
        void slide[0].offsetWidth;
        slide.addClass('immich-slide-anim');
        st.timer = setTimeout(nextSlide, 8000);
    }
    function stopSlideshow() {
        st.active = false;
        if (st.timer) { clearTimeout(st.timer); st.timer = null; }
        $(document).off('keydown.immich', onSlideKey);
        if (st.overlay) { st.overlay.remove(); st.overlay = null; }
        st.urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
        st.urls = [];
        notify('Immich: показ остановлен');
    }

    // ---------- ПУНКТ МЕНЮ ----------

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
        return true;
    }
    function watchMenu() {
        if (addMenuItem()) {
            var t = $('.menu').first();
            if (t.length && window.MutationObserver) {
                new MutationObserver(addMenuItem).observe(t[0], { childList: true, subtree: false });
            }
            return;
        }
        var tries = 0;
        var iv = setInterval(function () { tries++; if (addMenuItem() || tries > 40) clearInterval(iv); }, 500);
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
            '.immich-direct-field{width:100%;padding:12px 14px;font-size:18px;background:#2a2a2a;border:2px solid #2a6df4;color:#fff;border-radius:6px;box-sizing:border-box;outline:none;}' +
            '.immich-direct-field:focus{border-color:#4a8dff;box-shadow:0 0 0 2px rgba(74,141,255,0.3);}' +
            '.immich-settings-buttons{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;}' +
            '.immich-btn{padding:10px 16px;background:#333;color:#fff;border-radius:6px;cursor:pointer;user-select:none;font-size:15px;}' +
            '.immich-btn:hover{background:#444;}' +
            '.immich-btn-primary{background:#2a6df4;}' +
            '.immich-btn-primary:hover{background:#3a7dff;}' +
            '.immich-settings-hint{margin-top:14px;font-size:12px;color:#888;line-height:1.4;}' +
            '.immich-slideshow-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:99998;overflow:hidden;}' +
            '.immich-slide{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;background-position:center;background-repeat:no-repeat;opacity:0;transform:scale(1);transition:opacity 1.2s ease;}' +
            '.immich-slide-anim{opacity:1;animation:immich-zoom 8s linear forwards;}' +
            '@keyframes immich-zoom{from{transform:scale(1);}to{transform:scale(1.08);}}' +
            '.immich-slideshow-hint{position:absolute;bottom:20px;right:20px;color:#fff;opacity:0.5;font-family:sans-serif;font-size:14px;}';
        $('head').append('<style id="immich-styles">' + css + '</style>');
    }

    function init() {
        console.log('[Immich] init v' + VERSION);
        injectStyles();
        watchMenu();
    }
    if (window.appready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') init(); });
})();
