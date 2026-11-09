(function () {
    'use strict';

    const key = 'saleapp-theme';
    const root = document.documentElement;
    let theme = 'dark';

    try {
        theme = localStorage.getItem(key) === 'light' ? 'light' : 'dark';
    } catch (error) {
        console.warn('Không thể đọc giao diện đã lưu:', error);
    }

    function apply(value) {
        theme = value === 'light' ? 'light' : 'dark';
        root.dataset.theme = theme;
        document.querySelectorAll('.saleapp-theme-toggle').forEach(function (toggle) {
            toggle.setAttribute('aria-pressed', String(theme === 'light'));
            toggle.setAttribute('aria-label', theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng');
            toggle.title = toggle.getAttribute('aria-label');
            toggle.textContent = theme === 'light' ? '☾ Tối' : '☀ Sáng';
        });
    }

    apply(theme);
    window.addEventListener('storage', function (event) {
        if (event.key === key) apply(event.newValue);
    });
    document.addEventListener('DOMContentLoaded', function () {
        function createToggle() {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'saleapp-theme-toggle';
            toggle.addEventListener('click', function () {
                apply(theme === 'dark' ? 'light' : 'dark');
                try {
                    localStorage.setItem(key, theme);
                } catch (error) {
                    console.warn('Không thể lưu giao diện:', error);
                }
            });
            return toggle;
        }
        const toggle = createToggle();
        toggle.id = 'saleapp-theme-toggle';
        const header = document.querySelector('body > header');
        const target = header && (header.querySelector(':scope > .max-w-6xl') || header);
        if (target) {
            target.appendChild(toggle);
        } else {
            toggle.classList.add('saleapp-theme-toggle-floating');
            document.body.appendChild(toggle);
        }
        const loginDialog = document.querySelector('#login-modal .liquid-modal-content');
        if (loginDialog) {
            const loginToggle = createToggle();
            loginToggle.classList.add('saleapp-theme-login-toggle');
            loginDialog.appendChild(loginToggle);
        }
        apply(theme);
    });
}());
