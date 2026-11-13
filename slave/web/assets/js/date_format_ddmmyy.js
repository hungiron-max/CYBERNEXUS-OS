(function () {
    function formatDateDDMMYY(val, withTime) {
        if (!val) return '-';
        const s = String(val).trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?/);
        if (!m) return s;
        const dd = m[3];
        const mm = m[2];
        const yy = m[1].slice(-2);
        const datePart = `${dd}/${mm}/${yy}`;
        if (withTime && m[4]) {
            return `${datePart} ${m[4]}`;
        }
        return datePart;
    }

    window.formatDateDDMMYY = formatDateDDMMYY;

    function injectStyles() {
        if (document.getElementById('cn-ddmmyy-style')) return;
        const style = document.createElement('style');
        style.id = 'cn-ddmmyy-style';
        style.textContent = `
            .cn-date-wrap {
                position: relative;
                display: inline-flex;
                align-items: center;
                vertical-align: middle;
            }
            .cn-date-wrap.cn-w-full { width: 100%; display: flex; }
            .cn-date-wrap.cn-flex-1 { flex: 1 1 0%; display: flex; }
            input[type="date"].cn-date-native {
                color: transparent !important;
                -webkit-text-fill-color: transparent !important;
                caret-color: transparent;
                position: relative;
                min-width: 112px;
            }
            input[type="date"].cn-date-native::-webkit-datetime-edit,
            input[type="date"].cn-date-native::-webkit-datetime-edit-fields-wrapper,
            input[type="date"].cn-date-native::-webkit-datetime-edit-text,
            input[type="date"].cn-date-native::-webkit-datetime-edit-month-field,
            input[type="date"].cn-date-native::-webkit-datetime-edit-day-field,
            input[type="date"].cn-date-native::-webkit-datetime-edit-year-field {
                color: transparent !important;
                -webkit-text-fill-color: transparent !important;
            }
            input[type="date"].cn-date-native::-webkit-calendar-picker-indicator {
                cursor: pointer;
                opacity: 0.85;
                filter: invert(0.8);
                z-index: 2;
            }
            .cn-date-overlay {
                position: absolute;
                left: 10px;
                right: 28px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 12px;
                font-weight: 600;
                color: #f1f5f9;
                white-space: nowrap;
                overflow: hidden;
                z-index: 1;
            }
            .cn-date-overlay.is-empty {
                color: #64748b;
                font-weight: 400;
            }
        `;
        document.head.appendChild(style);
    }

    function syncInput(input) {
        const overlay = input._cnOverlay;
        if (!overlay) return;
        if (input.value) {
            overlay.textContent = formatDateDDMMYY(input.value, false);
            overlay.classList.remove('is-empty');
        } else {
            overlay.textContent = 'dd/mm/yy';
            overlay.classList.add('is-empty');
        }
    }

    function enhanceDateInput(input) {
        if (!input || input.dataset.cnDateEnhanced === '1') return;
        input.dataset.cnDateEnhanced = '1';
        input.classList.add('cn-date-native');

        const wrap = document.createElement('span');
        wrap.className = 'cn-date-wrap';
        if (input.classList.contains('w-full')) wrap.classList.add('cn-w-full');
        if (input.classList.contains('flex-1')) wrap.classList.add('cn-flex-1');

        const overlay = document.createElement('span');
        overlay.className = 'cn-date-overlay';
        input._cnOverlay = overlay;

        if (input.parentNode) {
            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(input);
            wrap.appendChild(overlay);
        }

        input.addEventListener('input', () => syncInput(input));
        input.addEventListener('change', () => syncInput(input));
        input.addEventListener('click', () => {
            if (typeof input.showPicker === 'function') {
                try { input.showPicker(); } catch (e) {}
            }
        });
        syncInput(input);
    }

    function scanAndEnhance() {
        injectStyles();
        document.querySelectorAll('input[type="date"]').forEach(enhanceDateInput);
    }

    function syncAll() {
        document.querySelectorAll('input[type="date"].cn-date-native').forEach(syncInput);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            scanAndEnhance();
            setInterval(syncAll, 250);
        });
    } else {
        scanAndEnhance();
        setInterval(syncAll, 250);
    }

    const obs = new MutationObserver(() => scanAndEnhance());
    if (document.documentElement) {
        obs.observe(document.documentElement, { childList: true, subtree: true });
    }
})();
