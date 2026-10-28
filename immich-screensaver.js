(function () {
    'use strict';

    // Уникальное имя для защиты от повторной загрузки
    if (window.immichSettingsV1Loaded) return;
    window.immichSettingsV1Loaded = true;

    function init() {
        console.log('[Immich] Инициализация настроек (v1)');

        try {
            // 1. Регистрируем раздел
            Lampa.SettingsApi.addComponent({
                component: 'immich_settings_v1', // Новое уникальное имя
                name: 'Immich (Настройки)',
                icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>'
            });

            // 2. Поле для URL
            Lampa.SettingsApi.addParam({
                component: 'immich_settings_v1',
                param: {
                    name: 'immich_url',
                    type: 'input',
                    default: '',
                    placeholder: 'https://immich.example.com'
                },
                field: {
                    name: 'Immich URL',
                    description: 'Базовый адрес вашего сервера Immich'
                }
            });

            // 3. Поле для API-ключа
            Lampa.SettingsApi.addParam({
                component: 'immich_settings_v1',
                param: {
                    name: 'immich_api_key',
                    type: 'input',
                    default: '',
                    placeholder: 'Ваш API-ключ'
                },
                field: {
                    name: 'API Key',
                    description: 'Ключ для доступа к API Immich'
                }
            });

            console.log('[Immich] Поля настроек успешно добавлены.');
            Lampa.Noty.show('Immich: настройки (v1) загружены');

        } catch (e) {
            console.error('[Immich] Критическая ошибка при добавлении настроек:', e);
            Lampa.Noty.show('Immich: ошибка в консоли');
        }
    }

    // Запуск после готовности приложения
    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
    }
})();
