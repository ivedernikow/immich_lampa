(function () {
    'use strict';

    if (window.immichTestLoaded) return;
    window.immichTestLoaded = true;

    function init() {
        console.log('[Immich] init');

        Lampa.SettingsApi.addComponent({
            component: 'immich_test',
            name: 'Immich',
            icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>'
        });

        Lampa.SettingsApi.addParam({
            component: 'immich_test',
            param: {
                name: 'immich_url',
                type: 'input',
                placeholder: 'https://immich.example.com',
                default: ''
            },
            field: {
                name: 'Immich URL',
                description: 'Базовый адрес  сервера Immich'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'immich_test',
            param: {
                name: 'immich_api_key',
                type: 'input',
                placeholder: 'API-ключ',
                default: ''
            },
            field: {
                name: 'API Key',
                description: 'API-ключ Immich'
            }
        });

        Lampa.Noty.show('Immich: настройки добавлены');
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
    }
})();
