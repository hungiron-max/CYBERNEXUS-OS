/**
 * Đồng bộ nền và thông báo khi quyền thay đổi, không tự tải lại trang đang thao tác.
 */
(function () {
    const script = document.currentScript;
    const initialRevision = script && script.dataset.licenseRights;
    if (!initialRevision) return;

    function showChanged() {
        if (document.getElementById('license-rights-changed')) return;
        const notice = document.createElement('div');
        notice.id = 'license-rights-changed';
        notice.setAttribute('role', 'status');
        notice.style.cssText = 'position:fixed;z-index:2147483647;bottom:1rem;left:1rem;right:1rem;max-width:38rem;margin:auto;padding:1rem;border:1px solid #38bdf8;border-radius:.75rem;background:#0f172a;color:#fff;font:14px system-ui;box-shadow:0 4px 20px #0008';
        const text = document.createElement('span');
        text.textContent = 'Quyền sử dụng đã thay đổi. Lưu công việc đang làm, sau đó tải lại trang để cập nhật giao diện. ';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Tải lại';
        button.style.cssText = 'padding:.4rem .8rem;border:0;border-radius:.4rem;background:#0284c7;color:white;cursor:pointer';
        button.addEventListener('click', function () { window.location.reload(); });
        notice.append(text, button);
        document.body.appendChild(notice);
    }

    async function ping() {
        try {
            const response = await fetch('api/license_client.php?action=sync_if_due', { method: 'POST', cache: 'no-store' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            if (!result.success) console.warn('Đồng bộ bản quyền:', result.message);
            if (result.rights_revision && result.rights_revision !== initialRevision) showChanged();
        } catch (error) {
            console.warn('Không kiểm tra được bản quyền:', error);
        }
    }
    ping();
    setInterval(ping, 5 * 60 * 1000);
})();
