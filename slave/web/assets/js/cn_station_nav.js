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
        host.innerHTML = items.map(st => `
            <a href="${st.href}" class="btn-glass cn-nav-btn ${st.cls}" title="${st.label}">
                <i class="fas ${st.icon} text-xs"></i>
                <span class="hidden sm:inline">${st.label}</span>
            </a>
        `).join('');
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
    let lastRole = '';
    setInterval(() => {
        const curRole = (window.currentUser && window.currentUser.role) || '';
        if (curRole && curRole !== lastRole) {
            lastRole = curRole;
            autoMountAll();
        }
    }, 500);
})(window);
