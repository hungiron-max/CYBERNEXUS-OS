/**
 * CyberNexus License Lifecycle & Self-Service Gate UI (LIC-04 / LIC-06 / LIC-07)
 * - Đồng bộ nền & nhận biết đổi quyền nóng theo rights_revision thật
 * - Hiển thị Banner ân hạn (Grace Period) / sắp hết hạn (<= 7 ngày)
 * - Hiển thị Modal License Gate tự phục vụ (Copy Machine ID, Đồng bộ Master, Kích hoạt Key, Gia hạn VietQR)
 */
(function () {
    const script = document.currentScript;
    let knownRevision = (script && script.dataset.licenseRights) ? String(script.dataset.licenseRights) : '';

    function showChanged() {
        if (document.getElementById('license-rights-changed')) return;
        const notice = document.createElement('div');
        notice.id = 'license-rights-changed';
        notice.setAttribute('role', 'status');
        notice.style.cssText = 'position:fixed;z-index:2147483647;bottom:1rem;left:1rem;right:1rem;max-width:38rem;margin:auto;padding:.85rem 1rem;border:1px solid #38bdf8;border-radius:.75rem;background:#0f172a;color:#fff;font:13px system-ui;display:flex;align-items:center;justify-content:space-between;gap:.75rem;box-shadow:0 8px 28px #0009';
        const text = document.createElement('span');
        text.textContent = (window.cnxT ? window.cnxT('js.s_lic.dd02f1f8', 'Quyền sử dụng module vừa được Master cập nhật. Bấm Tải lại để áp dụng giao diện mới.') : 'Quyền sử dụng module vừa được Master cập nhật. Bấm Tải lại để áp dụng giao diện mới.');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = (window.cnxT ? window.cnxT('ui.admin_html.button_1df3d95d', 'Tải lại') : 'Tải lại');
        button.style.cssText = 'padding:.4rem .85rem;border:0;border-radius:.45rem;background:#0284c7;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap';
        button.addEventListener('click', function () { window.location.reload(); });
        notice.append(text, button);
        document.body.appendChild(notice);
    }

    function renderGraceBanner(data) {
        const old = document.getElementById('cnx-license-banner');
        if (old) old.remove();
        const st = data.state || '';
        const sub = data.subscription_status || '';
        if (st !== 'grace_period' && sub !== 'expiring_soon') return;
        const isGrace = st === 'grace_period';
        const bar = document.createElement('div');
        bar.id = 'cnx-license-banner';
        bar.style.cssText = `position:fixed;z-index:2147483640;bottom:.75rem;right:.75rem;max-width:28rem;padding:.65rem .9rem;border-radius:.75rem;border:1px solid ${isGrace ? '#f97316' : '#f59e0b'};background:${isGrace ? 'rgba(67,20,7,.95)' : 'rgba(69,26,3,.92)'};color:#fff;font:12px/1.4 system-ui;box-shadow:0 8px 24px #0008;display:flex;align-items:center;gap:.65rem`;
        bar.innerHTML = `<div style="flex:1"><b>${isGrace ? 'Đang trong thời gian Ân hạn' : 'Bản quyền sắp hết hạn'}</b><div style="opacity:.9;margin-top:2px">${data.message || ''}</div></div>`;
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer;padding:0 4px';
        closeBtn.onclick = () => bar.remove();
        bar.appendChild(closeBtn);
        document.body.appendChild(bar);
    }

    function renderLockModal(data) {
        const lockStates = ['unactivated', 'expired', 'suspended', 'offline_lease_exceeded', 'machine_mismatch', 'signature_tampered', 'clock_tampered'];
        const st = data.state || '';
        const existing = document.getElementById('cnx-license-lock-modal');
        if (!lockStates.includes(st)) {
            if (existing) existing.remove();
            return;
        }
        if (existing) return;
        const modal = document.createElement('div');
        modal.id = 'cnx-license-lock-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(2,6,23,.88);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem;font-family:system-ui,sans-serif;color:#e2e8f0';
        const titles = {
            unactivated: 'Chưa Kích Hoạt Bản Quyền POS',
            expired: 'Bản Quyền Đã Hết Hạn (Chế Độ Chỉ Đọc)',
            suspended: 'Thuê Bao Đang Tạm Khóa',
            offline_lease_exceeded: 'Quá Hạn Kết Nối Offline Master',
            machine_mismatch: 'Sai Phần Cứng (Hardware Node-Lock)',
            signature_tampered: 'Phát Hiện Can Thiệp Bản Quyền',
            clock_tampered: 'Phát Hiện Lệch Đồng Hồ Hệ Thống'
        };
        const mid = data.machine_id || '---';
        modal.innerHTML = `
            <div style="width:100%;max-width:460px;background:#0f172a;border:1px solid rgba(244,63,94,.45);border-radius:1rem;padding:1.25rem 1.35rem;box-shadow:0 20px 50px #000b">
                <div style="font-size:16px;font-weight:800;color:#fda4af;margin-bottom:.4rem">${titles[st] || 'Cảnh Báo Bản Quyền'}</div>
                <div style="font-size:13px;color:#cbd5e1;line-height:1.5;margin-bottom:.9rem">${data.message || ''}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;background:#020617;border:1px solid rgba(255,255,255,.12);border-radius:.6rem;padding:.55rem .75rem;margin-bottom:.9rem;font-size:12px">
                    <span>Machine ID: <b style="font-family:monospace;color:#38bdf8">${mid}</b></span>
                    <button type="button" id="cnx-copy-mid" style="padding:.25rem .6rem;border-radius:.4rem;border:1px solid rgba(56,189,248,.4);background:rgba(56,189,248,.15);color:#7dd3fc;cursor:pointer;font-size:11px;font-weight:700">Copy</button>
                </div>
                ${st === 'unactivated' ? `<div style="display:flex;gap:.5rem;margin-bottom:.85rem"><input id="cnx-act-key" type="text" placeholder="Nhập License Key (VD: CNX-XXXX-...)" style="flex:1;padding:.55rem .7rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.15);background:#020617;color:#fff;font-size:13px"><button type="button" id="cnx-act-btn" style="padding:.55rem .9rem;border:0;border-radius:.5rem;background:#10b981;color:#022c22;font-weight:800;cursor:pointer;font-size:12px">Kích hoạt</button></div>` : ''}
                <div style="display:flex;flex-wrap:wrap;gap:.5rem;justify-content:flex-end">
                    <button type="button" id="cnx-sync-now" style="padding:.5rem .9rem;border:0;border-radius:.5rem;background:#0284c7;color:#fff;font-weight:700;cursor:pointer;font-size:12px">Đồng bộ lại Master</button>
                    ${(st === 'expired' || st === 'offline_lease_exceeded') ? `<button type="button" id="cnx-dismiss-ro" style="padding:.5rem .85rem;border:1px solid rgba(255,255,255,.2);border-radius:.5rem;background:transparent;color:#cbd5e1;cursor:pointer;font-size:12px">Xem báo cáo (Chỉ đọc)</button>` : ''}
                </div>
                <div id="cnx-lock-feedback" style="font-size:12px;margin-top:.6rem;color:#fbbf24"></div>
            </div>`;
        document.body.appendChild(modal);
        const fb = modal.querySelector('#cnx-lock-feedback');
        modal.querySelector('#cnx-copy-mid')?.addEventListener('click', () => {
            navigator.clipboard?.writeText(mid).then(() => { if (fb) fb.textContent = 'Đã copy Machine ID: ' + mid; });
        });
        modal.querySelector('#cnx-dismiss-ro')?.addEventListener('click', () => modal.remove());
        modal.querySelector('#cnx-sync-now')?.addEventListener('click', async () => {
            if (fb) fb.textContent = 'Đang đồng bộ với Master...';
            try {
                const r = await fetch('/api/license_client?action=sync_now', { method: 'POST' });
                const j = await r.json();
                if (j.success) { window.location.reload(); return; }
                if (fb) fb.textContent = j.message || 'Đồng bộ chưa mở khóa được.';
            } catch (e) { if (fb) fb.textContent = 'Không kết nối được máy chủ.'; }
        });
        modal.querySelector('#cnx-act-btn')?.addEventListener('click', async () => {
            const key = (modal.querySelector('#cnx-act-key')?.value || '').trim();
            if (!key) { if (fb) fb.textContent = 'Vui lòng nhập License Key!'; return; }
            if (fb) fb.textContent = 'Đang kích hoạt với Master...';
            try {
                const r = await fetch('/api/license_client?action=activate', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ license_key: key })
                });
                const j = await r.json();
                if (j.success) { window.location.reload(); return; }
                if (fb) fb.textContent = j.message || 'Kích hoạt thất bại.';
            } catch (e) { if (fb) fb.textContent = 'Lỗi kết nối Master.'; }
        });
    }

    async function ping() {
        try {
            const response = await fetch('/api/license_client?action=sync_if_due', { method: 'POST', cache: 'no-store' });
            if (!response.ok) return;
            const result = await response.json();
            const rev = result.rights_revision ? String(result.rights_revision) : '';
            if (rev) {
                if (!knownRevision) knownRevision = rev;
                else if (rev !== knownRevision) { knownRevision = rev; showChanged(); }
            }
            if (result.data) {
                renderGraceBanner(result.data);
                renderLockModal(result.data);
            }
        } catch (error) {
            console.debug('License ping:', error);
        }
    }

    let _pingInFlight = false;
    async function runPing() {
        if (document.hidden || _pingInFlight) return;
        _pingInFlight = true;
        try { await ping(); } finally { _pingInFlight = false; }
    }
    setTimeout(runPing, 1500);
    setInterval(runPing, 5 * 60 * 1000);
})();
