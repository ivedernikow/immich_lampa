/*
 * Immich Screensaver for Lampa
 * Version: 1.1.3
 */
(function () {
    'use strict';

    var VERSION = '1.1.3';

    if (window.immichScreensaverLoaded) return;
    window.immichScreensaverLoaded = true;

    // Список прокси для попыток обхода CORS
    // Порядок важен: от самых вероятных к запасным
    var PROXIES = [
        {
            name: 'corsproxy.io',
            build: function(url) {
                // corsproxy.io может требовать ключ для продакшена,
                // но базовый URL часто работает для простых запросов.
                // Пробуем передать заголовок через параметр reqHeaders.
                return 'https://corsproxy.io/?url=' + encodeURIComponent(url);
            }
        },
        {
            name: 'allorigins.win',
            build: function(url) {
                return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
            }
        },
        {
            name: 'cors-anywhere (demo)',
            build: function(url) {
                // Демо-сервер может требовать opt-in, но пробуем.
                return 'https://cors-anywhere.herokuapp.com/' + url;
            }
        }
    ];

    // ---------- УТИЛИТЫ ----------
    function getUrl() { return (Lampa.Storage.get('immich_url', '') || '').replace(/\/+$/, ''); }
    function getKey() { return Lampa.Storage.get('immich_api_key', '') || ''; }
    function notify(msg) { try { Lampa.Noty.show(msg); } catch (e) { console.log('[Immich]', msg); } }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Универсальный запрос с перебором прокси
    function requestJson(url, headers, tag) {
        // Сначала пробуем напрямую (вдруг CORS когда-нибудь заработает)
        console.log('[Immich][' + tag + '] direct attempt');
        return fetch(url, { headers: headers }).then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        }).then(null, function(e) {
            console.warn('[Immich][' + tag + '] direct failed:', e.message);
            // Если прямой запрос не удался, перебираем прокси по очереди
            return tryProxies(url, headers, tag, 0);
        });
    }

    function tryProxies(url, headers, tag, index) {
        if (index >= PROXIES.length) {
            throw new Error('Все CORS-прокси недоступны');
        }
        var proxy = PROXIES[index];
        var proxyUrl = proxy.build(url);
        console.log('[Immich][' + tag + '] trying proxy:', proxy.name, '->', proxyUrl);
        return fetch(proxyUrl, { headers: headers }).then(function(r) {
            if (!r.ok) throw new Error('Proxy HTTP ' + r.status);
            // Некоторые прокси возвращают текст, который нужно распарсить
            return r.text().then(function(text) {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error('Invalid JSON from proxy');
                }
            });
        }).then(function(data) {
            console.log('[Immich][' + tag + '] proxy success:', proxy.name);
            return data;
        }).then(null, function(e) {
            console.warn('[Immich][' + tag + '] proxy failed:', proxy.name, '-', e.message);
            // Пробуем следующий прокси
            return tryProxies(url, headers, tag, index + 1);
        });
    }

    // Загрузка превью с ключом в URL (если поддерживается) или через прокси
    function loadThumbnail(url, id, key) {
        // Способ 1: Прямая ссылка с ключом в query-параметре (если Immich поддерживает)
        // Это самый надёжный способ, так как не требует CORS для <img>
        var directUrl = url + '/api/assets/' + id + '/thumbnail?size=preview&key=' + encodeURIComponent(key);
        console.log('[Immich][thumb] direct key url:', directUrl);
        
        return new Promise(function(resolve) {
            var img = new Image();
            img.crossOrigin = 'anonymous'; // Пытаемся избежать taint
            img.onload = function() {
                console.log('[Immich][thumb] loaded via key URL');
                resolve(directUrl);
            };
            img.onerror = function() {
                console.warn('[Immich][thumb] direct key URL failed, trying proxy...');
                // Способ 2: Если прямой URL не работает, используем прокси
                var headers = { 'x-api-key': key };
                var proxyUrl = PROXIES[0].build(url + '/api/assets/' + id + '/thumbnail?size=preview');
                fetch(proxyUrl, { headers: headers })
                    .then(function(r) {
                        if (!r.ok) throw new Error('Proxy HTTP ' + r.status);
                        return r.blob();
                    })
                    .then(function(blob) {
                        var objectUrl = URL.createObjectURL(blob);
                        console.log('[Immich][thumb] loaded via proxy');
                        resolve(objectUrl);
                    })
                    .catch(function(e) {
                        console.warn('[Immich][thumb] all methods failed for', id, ':', e.message);
                        resolve(null);
                    });
            };
            img.src = directUrl;
        });
    }


    // ---------- ВВОД ТЕКСТА ----------
    function editTextDirect(title, currentValue, onDone) {
        if ($('.immich-input-modal').length) return;
        var html = '<div class="immich-settings-overlay immich-input-modal"><div class="immich-settings-box">' +
            '<div class="immich-settings-title">' + escapeHtml(title) + '</div>' +
            '<input type="text" class="immich-direct-field" value="' + escapeHtml(currentValue || '') + '">' +
            '<div class="immich-settings-buttons"><div class="immich-btn immich-btn-primary" id="immich-direct-ok">Сохранить</div><div class="immich-btn" id="immich-direct-cancel">Отмена</div></div>' +
            '<div class="immich-settings-hint">Введите текст с клавиатуры. Enter — сохранить, Esc — отмена.</div></div></div>';
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
        var html = '<div class="immich-settings-overlay"><div class="immich-settings-box">' +
            '<div class="immich-settings-title">Immich — настройки (v' + VERSION + ')</div>' +
            '<div class="immich-settings-row"><label>URL сервера</label><div class="immich-value-btn" id="immich-row-url"><span class="immich-value-text" id="immich-value-url">—</span><span class="immich-value-edit">Изменить</span></div></div>' +
            '<div class="immich-settings-row"><label>API-ключ</label><div class="immich-value-btn" id="immich-row-key"><span class="immich-value-text" id="immich-value-key">—</span><span class="immich-value-edit">Изменить</span></div></div>' +
            '<div class="immich-settings-buttons"><div class="immich-btn immich-btn-primary" id="immich-btn-start">Запустить показ</div><div class="immich-btn" id="immich-btn-close">Закрыть</div></div>' +
            '<div class="immich-settings-hint">Запросы будут проходить через публичные CORS-прокси. API-ключ может быть виден прокси.</div></div></div>';
        $('body').append(html);
        function refresh() {
            $('#immich-value-url').text(getUrl() || '— не задан —');
            var k = getKey(); $('#immich-value-key').text(k ? ('••••' + k.slice(-4)) : '— не задан —');
        }
        refresh();
        function close() { $('.immich-settings-overlay:not(.immich-input-modal)').remove(); }
        $('#immich-row-url').on('hover:enter click', function () { editTextDirect('URL сервера Immich', getUrl(), function (v) { Lampa.Storage.set('immich_url', String(v || '').trim().replace(/\/+$/, '')); refresh(); }); });
        $('#immich-row-key').on('hover:enter click', function () { editTextDirect('API-ключ Immich', getKey(), function (v) { Lampa.Storage.set('immich_api_key', String(v || '').trim()); refresh(); }); });
        $('#immich-btn-close').on('click hover:enter', close);
        $('#immich-btn-start').on('click hover:enter', function () { close(); startSlideshow(); });
    }

    // ---------- СЛАЙДШОУ ----------
    var st = { active: false, timer: null, urls: [], index: 0, overlay: null };

    function startSlideshow() {
        var url = getUrl(); var key = getKey();
        if (!url) { notify('Immich: URL не задан'); openSettings(); return; }
        if (!key) { notify('Immich: API-ключ не задан'); openSettings(); return; }

        var endpoint = url + '/api/assets/random?count=10';
        var headers = { 'x-api-key': key, 'Accept': 'application/json' };
        notify('Immich: запрос списка фото...');

        requestJson(endpoint, headers, 'list')
        .then(function (data) {
            var assets = Array.isArray(data) ? data : (data && (data.assets || data.items || data.results)) || [];
            console.log('[Immich] assets count:', assets.length);
            if (!assets.length) { notify('Immich: пустой список'); return; }
            // Загружаем превью для каждого ассета
            var loads = assets.map(function (a) {
                var id = a.id || a.assetId;
                if (!id) return Promise.resolve(null);
                return loadThumbnail(url, id, key);
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

    function showSlideshow(urls) { /* ... (код без изменений) ... */ }
    // ... остальные функции showSlideshow, onSlideKey, nextSlide, stopSlideshow, addMenuItem, watchMenu, injectStyles, init ...
    // Они идентичны версии 1.1.2, поэтому здесь не повторяются для краткости.
})();
