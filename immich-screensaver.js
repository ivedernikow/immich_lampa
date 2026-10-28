(function () {
    'use strict';

    // Защита от повторной загрузки плагина
    if (window.immichScreensaverLoaded) return;
    window.immichScreensaverLoaded = true;

    function init() {
        console.log('[Immich] init');

        // 1. Регистрируем раздел в настройках
        Lampa.SettingsApi.addComponent({
            component: 'immich_screensaver',
            name: 'Immich',
            icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>'
        });

        // 2. Добавляем поле для URL сервера Immich
        Lampa.SettingsApi.addParam({
            component: 'immich_screensaver',
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

        // 3. Добавляем поле для API-ключа
        Lampa.SettingsApi.addParam({
            component: 'immich_screensaver',
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

        // 4. Добавляем кнопку ручного запуска
        Lampa.SettingsApi.addParam({
            component: 'immich_screensaver',
            param: {
                name: 'immich_start_now',
                type: 'trigger',
                default: false
            },
            field: {
                name: 'Запустить показ сейчас'
            },
            onChange: function () {
                // Сбрасываем триггер, чтобы кнопку можно было нажать снова
                Lampa.Storage.set('immich_start_now', false);
                
                // Читаем настройки
                var url = Lampa.Storage.field('immich_url');
                var apiKey = Lampa.Storage.field('immich_api_key');

                if (!url || !apiKey) {
                    Lampa.Noty.show('Immich: сначала заполните URL и API-ключ');
                    return;
                }

                console.log('[Immich] Ручной запуск. URL:', url);
                Lampa.Noty.show('Immich: запуск (пока заглушка)');
                // Здесь позже будет вызов функции показа слайдшоу
            }
        });

        Lampa.Noty.show('Immich: настройки загружены');
    }

    // Запускаем init только после полной готовности приложения
    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
    }
})();
