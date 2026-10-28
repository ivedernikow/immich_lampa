(function () {
    'use strict';
    if (window.immichSettingsModalLoaded) return;
    window.immichSettingsModalLoaded = true;

    // Функция для открытия окна настроек
    function openSettingsModal() {
        // Создаем простой HTML для формы
        var html = `
            <div class="immich-settings-modal">
                <div class="settings-item">
                    <div class="settings-item__name">Immich URL</div>
                    <input type="text" id="immich-url-input" class="settings-item__input" value="${Lampa.Storage.get('immich_url', '')}">
                </div>
                <div class="settings-item">
                    <div class="settings-item__name">API Key</div>
                    <input type="text" id="immich-key-input" class="settings-item__input" value="${Lampa.Storage.get('immich_api_key', '')}">
                </div>
                <div class="settings-item">
                    <button id="immich-save-btn" class="settings-item__button">Сохранить</button>
                </div>
            </div>
        `;

        // Показываем модальное окно
        Lampa.Modal.open({
            title: 'Настройки Immich',
            html: html,
            onBack: function() {
                Lampa.Modal.close();
            }
        });

        // Обработчик кнопки "Сохранить"
        $('#immich-save-btn').on('hover:enter click', function() {
            var url = $('#immich-url-input').val();
            var key = $('#immich-key-input').val();
            Lampa.Storage.set('immich_url', url);
            Lampa.Storage.set('immich_api_key', key);
            Lampa.Noty.show('Настройки Immich сохранены');
            Lampa.Modal.close();
        });
    }

    // Добавляем кнопку в меню плагинов (или в любое другое место)
    function addSettingsButton() {
        // Пример: добавляем кнопку в меню расширений
        var button = $('<div class="menu__item">Настройки Immich</div>');
        button.on('hover:enter', openSettingsModal);
        // ... вставить кнопку в нужный контейнер ...
    }

    // Инициализация после готовности приложения
    if (window.appready) {
        addSettingsButton();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') addSettingsButton();
        });
    }
})();
