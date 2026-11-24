/**
 * CyberNexus Master On-Demand MySQL Backup Console (SYNC-01)
 * - Configure Master MySQL server (127.0.0.1:3306, AES-256 encrypted credentials)
 * - Toggle per-store MySQL backup (provisions isolated schema `cn_store_<code>` & user `<code>@localhost` using store's default PIN)
 * - On-demand Verify (CHECK_DB_SYNC) and Sync Now (SYNC_DB_BACKUP) strictly for the selected store only
 */
(function (window) {
    'use strict';

    const MasterMysqlBackup = {
        esc(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        },

        async openConsole() {
            let modal = document.getElementById('sa-mysql-backup-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'sa-mysql-backup-modal';
                modal.className = 'fixed inset-0 z-[9998] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4';
                modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                document.body.appendChild(modal);
            }

            const [cfgRes, tenRes] = await Promise.all([
                fetch('/api/admin/mysql_backup_config').then(r => r.json()).catch(() => ({})),
                fetch('/api/super_admin.php?action=get_tenants').then(r => r.json()).catch(() => ({}))
            ]);
            const cfg = (cfgRes && cfgRes.data) || { host: '127.0.0.1', port: '3306', user: 'root', has_password: false };
            const tenants = (tenRes && Array.isArray(tenRes.data)) ? tenRes.data : ((tenRes && Array.isArray(tenRes.tenants)) ? tenRes.tenants : []);

            modal.innerHTML = `
                <div class="w-full max-w-5xl max-h-[88vh] rounded-2xl bg-slate-900/95 border border-sky-500/35 shadow-2xl flex flex-col overflow-hidden text-xs">
                    <div class="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/50">
                        <div>
                            <h3 class="text-sm font-black text-white flex items-center gap-2"><i class="fas fa-database text-sky-400"></i> SAO LƯU &amp; ĐỒNG BỘ MYSQL ON-DEMAND THEO TỪNG QUÁN</h3>
                            <p class="text-[11px] text-slate-400">Chế độ thủ công (On-Demand) — KHÔNG tự động chạy nền, chỉ hoạt động khi Master gửi lệnh xuống đúng quán đó</p>
                        </div>
                        <button type="button" onclick="document.getElementById('sa-mysql-backup-modal')?.remove()" class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                    </div>

                    <div class="p-4 overflow-y-auto space-y-4 flex-1">
                        <div class="p-3.5 rounded-xl bg-slate-950/70 border border-white/10 space-y-2.5">
                            <div class="font-bold text-sky-300 uppercase text-[11px]">1. Cấu hình MySQL Server trên Master (Nội bộ — không mở port 3306 ra WAN)</div>
                            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                                <div><label class="text-slate-400 block mb-1">Host</label><input id="mb-host" value="${this.esc(cfg.host)}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono" /></div>
                                <div><label class="text-slate-400 block mb-1">Port</label><input id="mb-port" value="${this.esc(cfg.port)}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono" /></div>
                                <div><label class="text-slate-400 block mb-1">Admin User</label><input id="mb-user" value="${this.esc(cfg.user)}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono" /></div>
                                <div><label class="text-slate-400 block mb-1">Password ${cfg.has_password ? '(đã lưu)' : ''}</label><input id="mb-pass" type="password" placeholder="${cfg.has_password ? '•••••• (giữ nguyên)' : 'Nhập mật khẩu...'}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono" /></div>
                                <div class="flex gap-1.5">
                                    <button type="button" onclick="SuperAdmin.mysqlBackup.testConfig()" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/30 font-bold">Test</button>
                                    <button type="button" onclick="SuperAdmin.mysqlBackup.saveConfig()" class="px-3 py-1.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/35 font-bold flex-1">Lưu</button>
                                </div>
                            </div>
                            <div id="mb-cfg-status" class="text-[11px] text-slate-400"></div>
                        </div>

                        <div class="rounded-xl border border-white/10 bg-slate-950/60 overflow-hidden">
                            <table class="w-full text-left">
                                <thead class="bg-slate-900 text-[10px] uppercase text-slate-400 border-b border-white/10">
                                    <tr>
                                        <th class="py-2 px-3">Quán / Mã</th>
                                        <th class="py-2 px-2">Schema &amp; User Cô Lập</th>
                                        <th class="py-2 px-2">Đồng bộ gần nhất</th>
                                        <th class="py-2 px-3 text-right">Điều khiển On-Demand</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-white/5">
                                    ${tenants.map(t => {
                                        const on = Number(t.mysql_backup_enabled) === 1;
                                        const code = String(t.tenant_code || '').toLowerCase();
                                        const schema = t.mysql_schema || ('cn_store_' + code);
                                        const muser = t.mysql_user || (code + '@localhost');
                                        return `
                                            <tr class="hover:bg-white/[0.03]">
                                                <td class="py-2 px-3">
                                                    <div class="font-bold text-white">${this.esc(t.store_name || t.tenant_code)}</div>
                                                    <div class="text-[10px] font-mono text-sky-400">${this.esc(t.tenant_code)}</div>
                                                </td>
                                                <td class="py-2 px-2 font-mono text-[11px]">
                                                    <div class="text-emerald-300">${this.esc(schema)}</div>
                                                    <div class="text-slate-400 text-[10px]">${this.esc(muser)}</div>
                                                </td>
                                                <td class="py-2 px-2 text-[11px]">
                                                    <div class="text-slate-300 font-mono">${this.esc(t.last_mysql_sync_at || 'Chưa đồng bộ')}</div>
                                                    <div class="text-[10px] ${t.last_mysql_sync_status === 'ok' ? 'text-emerald-400' : (t.last_mysql_sync_status === 'error' ? 'text-rose-400' : 'text-amber-300')}">${this.esc(t.last_mysql_sync_summary || t.last_mysql_sync_status || '—')}</div>
                                                </td>
                                                <td class="py-2 px-3 text-right">
                                                    <div class="inline-flex items-center gap-1.5">
                                                        <button type="button" onclick="SuperAdmin.mysqlBackup.toggleStore(${t.id}, ${on ? 0 : 1})" class="px-2.5 py-1 rounded-lg font-bold ${on ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-white/10'}">${on ? 'Đang BẬT' : 'Đang TẮT'}</button>
                                                        <button type="button" ${on ? '' : 'disabled'} onclick="SuperAdmin.mysqlBackup.verifyStore(${t.id})" class="px-2.5 py-1 rounded-lg font-bold ${on ? 'bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 border border-sky-500/35' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}"><i class="fas fa-check-double mr-1"></i>Kiểm tra</button>
                                                        <button type="button" ${on ? '' : 'disabled'} onclick="SuperAdmin.mysqlBackup.syncStore(${t.id})" class="px-2.5 py-1 rounded-lg font-bold ${on ? 'bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-200 border border-indigo-500/40' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}"><i class="fas fa-sync mr-1"></i>Đồng bộ</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div id="mb-action-log" class="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 font-mono text-[11px] text-slate-300 min-h-[38px]">Sẵn sàng nhận lệnh đồng bộ / kiểm tra cho từng quán.</div>
                    </div>
                </div>
            `;
        },

        setLog(msg, ok = true) {
            const el = document.getElementById('mb-action-log');
            if (el) {
                el.className = 'p-2.5 rounded-xl bg-slate-950/80 border font-mono text-[11px] ' + (ok ? 'border-emerald-500/35 text-emerald-300' : 'border-rose-500/35 text-rose-300');
                el.textContent = msg;
            }
        },

        async testConfig() {
            const payload = {
                action: 'test',
                host: document.getElementById('mb-host')?.value.trim() || '127.0.0.1',
                port: document.getElementById('mb-port')?.value.trim() || '3306',
                user: document.getElementById('mb-user')?.value.trim() || 'root',
                password: document.getElementById('mb-pass')?.value || ''
            };
            const st = document.getElementById('mb-cfg-status');
            if (st) st.textContent = 'Đang kiểm tra kết nối MySQL...';
            const r = await fetch('/api/admin/mysql_backup_config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(x => x.json()).catch(e => ({ success: false, message: e.message }));
            if (st) st.innerHTML = `<span class="${r.success ? 'text-emerald-400' : 'text-rose-400'}">${this.esc(r.message)}</span>`;
        },

        async saveConfig() {
            const payload = {
                action: 'save',
                host: document.getElementById('mb-host')?.value.trim() || '127.0.0.1',
                port: document.getElementById('mb-port')?.value.trim() || '3306',
                user: document.getElementById('mb-user')?.value.trim() || 'root',
                password: document.getElementById('mb-pass')?.value || ''
            };
            const r = await fetch('/api/admin/mysql_backup_config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(x => x.json()).catch(e => ({ success: false, message: e.message }));
            const st = document.getElementById('mb-cfg-status');
            if (st) st.innerHTML = `<span class="${r.success ? 'text-emerald-400' : 'text-rose-400'}">${this.esc(r.message)}</span>`;
        },

        async toggleStore(tenantId, enabled) {
            this.setLog(enabled ? 'Đang khởi tạo Schema & User MySQL riêng cho quán...' : 'Đang tắt chế độ sao lưu MySQL...', true);
            const r = await fetch('/api/admin/tenants/mysql_backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenantId, action: 'toggle', enabled }) }).then(x => x.json()).catch(e => ({ success: false, message: e.message }));
            this.setLog(r.message || 'Hoàn tất', !!r.success);
            if (r.success) setTimeout(() => this.openConsole(), 600);
        },

        async verifyStore(tenantId) {
            this.setLog('Đang gửi lệnh CHECK_DB_SYNC xuống quán & đối soát với MySQL...', true);
            const r = await fetch('/api/admin/tenants/mysql_backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenantId, action: 'verify', pull_fresh: true }) }).then(x => x.json()).catch(e => ({ success: false, message: e.message }));
            this.setLog(r.message || JSON.stringify(r), !!r.success);
        },

        async syncStore(tenantId) {
            this.setLog('Đang gửi lệnh SYNC_DB_BACKUP tức thì xuống đúng quán được chọn...', true);
            const r = await fetch('/api/admin/tenants/mysql_backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenantId, action: 'sync_now' }) }).then(x => x.json()).catch(e => ({ success: false, message: e.message }));
            this.setLog(r.message || 'Đã gửi lệnh đồng bộ', !!r.success);
        }
    };

    window.MasterMysqlBackup = MasterMysqlBackup;
    if (window.SuperAdmin) {
        window.SuperAdmin.mysqlBackup = MasterMysqlBackup;
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            if (window.SuperAdmin) window.SuperAdmin.mysqlBackup = MasterMysqlBackup;
        });
    }
})(window);
