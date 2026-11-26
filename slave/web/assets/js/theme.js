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

    function tTheme(k, fb) {
        return (typeof window.cnxT === 'function') ? window.cnxT(k, fb) : fb;
    }

    function apply(value) {
        theme = value === 'light' ? 'light' : 'dark';
        root.dataset.theme = theme;
        document.querySelectorAll('.saleapp-theme-toggle').forEach(function (toggle) {
            toggle.setAttribute('aria-pressed', String(theme === 'light'));
            const lbl = theme === 'light'
                ? tTheme('common.theme_to_dark', 'Chuyển sang giao diện tối')
                : tTheme('common.theme_to_light', 'Chuyển sang giao diện sáng');
            toggle.setAttribute('aria-label', lbl);
            toggle.title = lbl;
            toggle.textContent = theme === 'light'
                ? tTheme('common.theme_dark', '☾ Tối')
                : tTheme('common.theme_light', '☀ Sáng');
        });
    }

    apply(theme);
    window.CNX_THEME = {
        get: function () { return theme; },
        set: function (val) {
            apply(val);
            try { localStorage.setItem(key, theme); } catch (_) {}
            return theme;
        },
        toggle: function () {
            apply(theme === 'dark' ? 'light' : 'dark');
            try { localStorage.setItem(key, theme); } catch (_) {}
            return theme;
        }
    };
    window.addEventListener('storage', function (event) {
        if (event.key === key) apply(event.newValue);
    });
    window.addEventListener('cybernexus:langchange', function () { apply(theme); });
    window.addEventListener('cnx:lang-changed', function () { apply(theme); });
    window.addEventListener('cnx:i18n-ready', function () { apply(theme); });
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
        const themeSlot = document.getElementById('cn-theme-slot');
        const langBtn = header && header.querySelector('[data-cnx-lang-btn]');
        const langWrap = langBtn && langBtn.parentElement;
        const navRight = header && header.querySelector('.cn-nav-right');
        const target = header && (header.querySelector(':scope > .max-w-6xl') || header);
        if (themeSlot) {
            themeSlot.replaceWith(toggle);
        } else if (navRight && langWrap && langWrap.parentElement === navRight) {
            langWrap.insertAdjacentElement('afterend', toggle);
        } else if (navRight) {
            navRight.insertBefore(toggle, navRight.firstChild);
        } else if (langWrap && langWrap.parentElement) {
            langWrap.insertAdjacentElement('afterend', toggle);
        } else if (target) {
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
