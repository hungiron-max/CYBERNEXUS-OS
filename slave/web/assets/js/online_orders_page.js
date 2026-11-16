window.onlineOrderPermissions = { payment: true, delivery: true };
async function handleOnlineLogout() {
    if (!confirm('Bạn có chắc muốn đăng xuất khỏi hệ thống?')) return;
    try { await fetch('api/auth.php?action=logout'); } catch (e) {}
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
    sessionStorage.clear();
    document.cookie = "pos_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "PHPSESSID=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.replace('login.html?logout=1');
}
document.addEventListener('DOMContentLoaded', function() {
    var zone = document.getElementById('online-admin-badge-zone');
    var u = window.currentUser;
    if (zone && u && (u.role === 'admin' || u.is_super_admin === true)) {
        zone.innerHTML = '<a href="admin.html" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-amber-500/40 hover:border-amber-400 text-xs shrink-0 whitespace-nowrap shadow-sm transition-all cursor-pointer" title="Quay về Trang Quản Trị (Chủ quán)">'
            + '<i class="fas fa-crown text-amber-400 text-xs"></i>'
            + '<span class="hidden sm:inline font-bold text-amber-200">' + (u.fullname || u.username) + '</span>'
            + '<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/40">ADMIN</span>'
            + '</a>';
    }
});
