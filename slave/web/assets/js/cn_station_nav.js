/**
 * CyberNexus Unified Station Navigator (UI-04)
 * Single Source of Truth for the 6 Slave work stations across ALL pages:
 *   1. POS Bán Hàng (index.html)
 *   2. Phục Vụ (order.html)
 *   3. Bếp (kitchen.html)
 *   4. Đơn Online (online_orders.html)
 *   5. Theo Dõi Ca (attendance.html)
 *   6. Quản Trị (admin.html)
 */
(function (window) {
    'use strict';

    const CN_STATIONS = [
        {
            id: 'pos',
            href: '/pos',
            aliases: ['/pos', '/index', '/index.html', '/index.php'],
            label: 'POS Bán Hàng',
            icon: 'fa-cash-register',
            roles: ['admin', 'cashier'],
            cls: 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border-emerald-500/40'
        },
        {
            id: 'order',
            href: '/order',
            aliases: ['/order', '/order.html', '/order.php'],
            label: 'Phục Vụ',
            icon: 'fa-clipboard-list',
            roles: ['admin', 'cashier', 'waiter'],
            cls: 'bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/40'
        },
        {
            id: 'kitchen',
            href: '/kitchen',
            aliases: ['/kitchen', '/kitchen.html', '/kitchen.php'],
            label: 'Bếp',
            icon: 'fa-fire-burner',
            roles: ['admin', 'kitchen'],
            cls: 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border-amber-500/40'
        },
        {
            id: 'online',
            href: '/online',
            aliases: ['/online', '/online_orders', '/online_orders.html'],
            label: 'Đơn Online',
            icon: 'fa-bag-shopping',
            roles: ['admin', 'cashier', 'waiter'],
            cls: 'bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border-indigo-500/40'
        },
        {
            id: 'attendance',
            href: '/attendance',
            aliases: ['/attendance', '/attendance.html'],
            label: 'Theo Dõi Ca',
            icon: 'fa-signal',
            roles: ['admin', 'cashier', 'kitchen', 'waiter'],
            cls: 'bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 border-teal-500/40'
        },
        {
            id: 'admin',
            href: '/admin',
            aliases: ['/admin', '/admin.html', '/admin.php'],
            label: 'Quản Trị',
            icon: 'fa-sliders',
            roles: ['admin'],
            cls: 'bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border-purple-500/40'
        }
    ];

    function getCurrentPath() {
        const p = (window.location.pathname || '/pos').toLowerCase().replace(/\/+$/, '');
        return p || '/';
    }

    function renderStationNav(containerId, role) {
        const host = document.getElementById(containerId);
        if (!host) return;
        const curPath = getCurrentPath();
        const r = String(role || (window.currentUser && window.currentUser.role) || 'admin').toLowerCase();
        const items = CN_STATIONS.filter(st => {
            if (st.aliases.includes(curPath)) return false;
            return r === 'super_admin' || st.roles.includes(r);
        });
        const labelCls = containerId === 'pos-station-nav-zone' ? 'hidden' : 'hidden sm:inline';
        host.innerHTML = items.map(st => `
            <a href="${st.href}" class="btn-glass cn-nav-btn ${st.cls}" title="${st.label}">
                <i class="fas ${st.icon} text-xs"></i>
                <span class="${labelCls}">${st.label}</span>
            </a>
        `).join('');
    }

    function ensureMobileNavControls() {
        const nav = document.querySelector('.cn-top-nav');
        if (!nav) return;
        if (!nav.querySelector('.cn-mobile-actions')) {
            const box = document.createElement('div');
            box.className = 'cn-mobile-actions';
            const curLang = (window.CNX_I18N && window.CNX_I18N.getLang && window.CNX_I18N.getLang()) || 'vi';
            box.innerHTML = `
                <button type="button" id="cn-mob-lang-btn" class="cn-nav-btn bg-slate-800/90 text-sky-300 border border-white/15 text-[11px] font-black">${curLang.toUpperCase()}</button>
                <button type="button" id="cn-mob-menu-btn" class="cn-nav-btn bg-sky-500/20 text-sky-300 border border-sky-400/40" aria-label="Menu">
                    <i class="fas fa-bars text-sm"></i>
                </button>
            `;
            nav.appendChild(box);
            box.querySelector('#cn-mob-lang-btn').addEventListener('click', () => {
                if (!window.CNX_I18N) return;
                const next = window.CNX_I18N.getLang() === 'en' ? 'vi' : 'en';
                window.CNX_I18N.setLang(next);
                box.querySelector('#cn-mob-lang-btn').textContent = next.toUpperCase();
            });
            box.querySelector('#cn-mob-menu-btn').addEventListener('click', openMobileDrawer);
        }
    }

    function openMobileDrawer() {
        let overlay = document.getElementById('cn-mobile-drawer-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'cn-mobile-drawer-overlay';
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('open');
            });
            document.body.appendChild(overlay);
        }
        const u = window.currentUser || null;
        const role = String((u && u.role) || 'admin').toLowerCase();
        const curPath = getCurrentPath();
        const stations = CN_STATIONS.filter(st => role === 'super_admin' || st.roles.includes(role));
        const curLang = (window.CNX_I18N && window.CNX_I18N.getLang && window.CNX_I18N.getLang()) || 'vi';
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';

        overlay.innerHTML = `
            <div class="cn-mobile-drawer">
                <div class="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                        <div class="text-xs font-black text-white">${u ? (u.fullname || u.username || 'Nhân viên') : 'Chưa đăng nhập'}</div>
                        <div class="text-[10px] font-mono uppercase text-sky-400">${u ? (u.role || 'staff') : 'guest'}</div>
                    </div>
                    <button type="button" id="cn-mob-close" class="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-lg">&times;</button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <button type="button" id="cn-mob-theme-btn" class="py-2 px-3 rounded-xl bg-slate-800/90 border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5 text-amber-300">
                        <i class="fas ${isLight ? 'fa-moon' : 'fa-sun'}"></i>
                        <span>${isLight ? 'Chế độ Tối' : 'Chế độ Sáng'}</span>
                    </button>
                    <button type="button" id="cn-mob-drawer-lang" class="py-2 px-3 rounded-xl bg-slate-800/90 border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5 text-sky-300">
                        <i class="fas fa-language"></i>
                        <span>${curLang === 'en' ? 'Tiếng Việt' : 'English'}</span>
                    </button>
                </div>
                <div>
                    <div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">Chuyển trạm làm việc</div>
                    <div class="grid grid-cols-2 gap-2">
                        ${stations.map(st => {
                            const active = st.aliases.includes(curPath);
                            return `<a href="${st.href}" class="py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${active ? 'bg-sky-500/25 border-sky-400 text-white' : 'bg-slate-800/70 border-white/10 text-slate-200'}"><i class="fas ${st.icon} text-sky-400"></i><span class="truncate">${st.label}</span></a>`;
                        }).join('')}
                    </div>
                </div>
                <div class="mt-auto pt-3 border-t border-white/10">
                    <button type="button" id="cn-mob-auth-btn" class="w-full py-2.5 px-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-2">
                        <i class="fas ${u ? 'fa-sign-out-alt' : 'fa-sign-in-alt'}"></i>
                        <span>${u ? 'Đăng xuất' : 'Đăng nhập'}</span>
                    </button>
                </div>
            </div>
        `;
        overlay.classList.add('open');
        overlay.querySelector('#cn-mob-close')?.addEventListener('click', () => overlay.classList.remove('open'));
        overlay.querySelector('#cn-mob-theme-btn')?.addEventListener('click', () => {
            if (window.CNX_THEME && typeof window.CNX_THEME.toggle === 'function') {
                window.CNX_THEME.toggle();
            } else {
                const desktopThemeBtn = document.getElementById('saleapp-theme-toggle') || document.querySelector('.saleapp-theme-toggle');
                if (desktopThemeBtn) desktopThemeBtn.click();
            }
            overlay.classList.remove('open');
        });
        overlay.querySelector('#cn-mob-drawer-lang')?.addEventListener('click', () => {
            if (!window.CNX_I18N) return;
            const next = window.CNX_I18N.getLang() === 'en' ? 'vi' : 'en';
            window.CNX_I18N.setLang(next);
            const pillBtn = document.getElementById('cn-mob-lang-btn');
            if (pillBtn) pillBtn.textContent = next.toUpperCase();
            overlay.classList.remove('open');
        });
        overlay.querySelector('#cn-mob-auth-btn')?.addEventListener('click', () => {
            overlay.classList.remove('open');
            const deskBtn = document.querySelector('.cn-nav-right .cn-nav-btn--danger, .cn-nav-right button[onclick*="Logout"], .cn-nav-right button[onclick*="openLoginModal"]');
            if (deskBtn) deskBtn.click();
            else if (typeof window.handleLogout === 'function') window.handleLogout();
            else if (typeof window.openLoginModal === 'function') window.openLoginModal();
        });
    }

    function autoMountAll() {
        const role = (window.currentUser && window.currentUser.role) || '';
        const zones = [
            'pos-station-nav-zone',
            'admin-station-nav-zone',
            'order-nav-back-zone',
            'kitchen-nav-back-zone',
            'online-admin-badge-zone',
            'att-nav-back-zone'
        ];
        zones.forEach(z => {
            if (document.getElementById(z)) renderStationNav(z, role);
        });
        ensureMobileNavControls();
    }

    window.CyberStationNav = {
        STATIONS: CN_STATIONS,
        render: renderStationNav,
        autoMount: autoMountAll
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoMountAll);
    } else {
        autoMountAll();
    }
    // Re-sync once auth user finishes loading asynchronously
    let lastRole = (window.currentUser && window.currentUser.role) || '';
    let authWatchAttempts = 0;
    const authWatchTimer = setInterval(() => {
        authWatchAttempts++;
        const curRole = (window.currentUser && window.currentUser.role) || '';
        if (curRole && curRole !== lastRole) {
            lastRole = curRole;
            autoMountAll();
            clearInterval(authWatchTimer);
        } else if (curRole || authWatchAttempts >= 40) {
            clearInterval(authWatchTimer);
        }
    }, 500);
})(window);
