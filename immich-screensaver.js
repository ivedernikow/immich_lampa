(function () {
    'use strict';
    if (window.immichV3Loaded) return;
    window.immichV3Loaded = true;

    function init() {
        console.log('[Immich v3] Регистрация компонента');
        try {
            Lampa.SettingsApi.addComponent({
                component: 'immich_v3',
                name: 'Immich v3 (Пустой)',
                icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>'
            });
            console.log('[Immich v3] Компонент зарегистрирован');
        } catch (e) {
            console.error('[Immich v3] Ошибка:', e);
        }
    }
    if (window.appready) { init(); } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
    }
})();
