(function () {
    'use strict';

    if (window.immichV2Loaded) return;
    window.immichV2Loaded = true;

    function init() {
        console.log('[Immich v2] init');

        try {
            Lampa.SettingsApi.addComponent({
                component: 'immich_v2',
                name: 'Immich v2',
                icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>'
            });

            Lampa.SettingsApi.addParam({
                component: 'immich_v2',
                param: {
                    name: 'immich_v2_url',
                    type: 'input',
                    default: ''
                },
                field: {
                    name: 'Immich URL'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'immich_v2',
                param: {
                    name: 'immich_v2_key',
                    type: 'input',
                    default: ''
                },
                field: {
                    name: 'API Key'
                }
            });

            console.log('[Immich v2] Параметры добавлены успешно');
            Lampa.Noty.show('Immich v2: готово');

        } catch (e) {
            console.error('[Immich v2] Ошибка в init:', e);
        }
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
    }
})();
