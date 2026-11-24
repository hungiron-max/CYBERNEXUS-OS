window.onlineOrderPermissions = { payment: true, delivery: true };
async function handleOnlineLogout() {
    if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_onl_p.cb29f859','Bạn có chắc muốn đăng xuất khỏi hệ thống?'):'Bạn có chắc muốn đăng xuất khỏi hệ thống?')))) return;
    try { await fetch('api/auth.php?action=logout'); } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('online_orders_page.js', e) : console.debug('online_orders_page.js', e)); }
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
    sessionStorage.clear();
    document.cookie = "pos_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "PHPSESSID=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.replace('login.html?logout=1');
}
function renderOnlineBackLinks() {
    var zone = document.getElementById('online-admin-badge-zone');
    var u = window.currentUser;
    if (!zone || !u) return;
    var tr = function (k, fb) { return (typeof window.cnxT === 'function') ? window.cnxT(k, fb) : fb; };
    var isAdmin = (u.role === 'admin' || u.is_super_admin === true);
    var isCashier = (u.role === 'cashier');
    if (!isAdmin && !isCashier) { zone.innerHTML = ''; return; }
    var html = '';
    if (isAdmin) {
        html += '<a href="admin.html" class="btn-glass cn-nav-btn bg-amber-500/20 hover:bg-amber-500/35 border-amber-400/40 text-amber-200"><i class="fas fa-arrow-left text-[10px]"></i><span>' + tr('common.back_admin', 'Quản Trị') + '</span></a>';
        html += '<a href="index.html" class="btn-glass cn-nav-btn bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/40 text-sky-200"><i class="fas fa-cash-register text-xs"></i><span>POS</span></a>';
    } else if (isCashier) {
        html += '<a href="index.html" class="btn-glass cn-nav-btn bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/40 text-sky-200"><i class="fas fa-arrow-left text-[10px]"></i><span>' + tr('common.back_pos', 'Quay lại POS') + '</span></a>';
    }
    zone.innerHTML = html;
}
document.addEventListener('DOMContentLoaded', renderOnlineBackLinks);
window.addEventListener('cybernexus:langchange', renderOnlineBackLinks);
window.addEventListener('cnx:lang-changed', renderOnlineBackLinks);
window.addEventListener('cnx:i18n-ready', renderOnlineBackLinks);

// HR-12: Duy trì heartbeat chấm công định kỳ (30s) trên trang Đơn Online để không báo 'Mất kết nối' oan
(function () {
    const sendOnlineHb = () => {
        if (document.visibilityState === 'hidden') return;
        fetch('/api/auth.php?action=heartbeat', { cache: 'no-store' }).catch(() => {});
    };
    sendOnlineHb();
    setInterval(sendOnlineHb, 30 * 1000);
    window.addEventListener('focus', sendOnlineHb);
    window.addEventListener('online', sendOnlineHb);
})();
