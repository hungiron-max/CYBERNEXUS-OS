/**
 * CyberNexus OS — Attendance Portal & Kiosk PIN Controller (HR-07)
 */
(function (global) {
    'use strict';

    const AttendanceKiosk = {
        mode: 'live',
        camStream: null,
        liveData: null,
        _liveTimer: null,
        _liveInFlight: false,

        init() {
            this.updateClock();
            setInterval(() => this.updateClock(), 1000);
            this.loadPersonalStatus();
            window.addEventListener('cnx:lang-changed', () => { if (this._lastUser) this.renderRoleNav(this._lastUser); });
            const pinEl = document.getElementById('att-kiosk-pin');
            if (pinEl) {
                pinEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') this.submitKioskPunch();
                });
            }
            this._liveTimer = setInterval(() => {
                if (this.mode === 'live' && !document.hidden && this._lastUser) {
                    this.loadLiveBoard(true);
                }
            }, 5000);
        },

        updateClock() {
            const el = document.getElementById('att-live-clock');
            if (!el) return;
            const now = new Date();
            el.textContent = now.toLocaleTimeString('vi-VN') + ' • ' + now.toLocaleDateString('vi-VN');
        },

        showBanner(msg, type = 'info') {
            const el = document.getElementById('att-banner');
            if (!el) return;
            const cls = type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                : (type === 'error' ? 'bg-rose-500/15 border-rose-500/40 text-rose-200' : 'bg-sky-500/15 border-sky-500/40 text-sky-200');
            el.className = `p-3.5 rounded-xl border text-xs font-semibold ${cls}`;
            el.textContent = msg;
            el.classList.remove('hidden');
        },

        switchMode(nextMode) {
            this.mode = ['live', 'kiosk', 'personal'].includes(nextMode) ? nextMode : 'live';
            document.getElementById('att-panel-live')?.classList.toggle('hidden', this.mode !== 'live');
            document.getElementById('att-panel-personal')?.classList.toggle('hidden', this.mode !== 'personal');
            document.getElementById('att-panel-kiosk')?.classList.toggle('hidden', this.mode !== 'kiosk');
            const btns = {
                live: document.getElementById('att-mode-live-btn'),
                personal: document.getElementById('att-mode-personal-btn'),
                kiosk: document.getElementById('att-mode-kiosk-btn')
            };
            Object.keys(btns).forEach(k => {
                if (!btns[k]) return;
                btns[k].className = this.mode === k
                    ? 'px-4 py-2 rounded-xl text-xs font-bold bg-sky-500/25 text-sky-200 border border-sky-400/40'
                    : 'px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-white/10';
            });
            if (this.mode === 'live' && this._lastUser) this.loadLiveBoard(true);
        },

        authHeaders() {
            const token = localStorage.getItem('pos_token') || '';
            return {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': 'Bearer ' + token } : {})
            };
        },

        renderRoleNav(user) {
            const backZone = document.getElementById('att-nav-back-zone');
            const badgeZone = document.getElementById('att-user-badge-zone');
            const tr = (k, fb) => (typeof window.cnxT === 'function' ? window.cnxT(k, fb) : fb);
            if (!user || !user.username) {
                if (backZone) backZone.innerHTML = '';
                if (badgeZone) badgeZone.innerHTML = '';
                return;
            }
            const r = user.role || 'staff';
            const isAdmin = (r === 'admin' || user.is_super_admin === true);
            if (backZone) {
                let html = '';
                if (isAdmin) {
                    html += `<a href="admin.html" class="btn-glass cn-nav-btn bg-amber-500/20 hover:bg-amber-500/35 border-amber-400/40 text-amber-200"><i class="fas fa-arrow-left text-[10px]"></i><span>${tr('common.back_admin', 'Quản Trị')}</span></a>`;
                    html += `<a href="index.html" class="btn-glass cn-nav-btn bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/40 text-sky-200"><i class="fas fa-cash-register text-xs"></i><span>POS</span></a>`;
                } else if (r === 'cashier') {
                    html += `<a href="index.html" class="btn-glass cn-nav-btn bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/40 text-sky-200"><i class="fas fa-arrow-left text-[10px]"></i><span>${tr('common.back_pos', 'Quay lại POS')}</span></a>`;
                } else if (r === 'kitchen') {
                    html += `<a href="kitchen.html" class="btn-glass cn-nav-btn bg-amber-500/20 text-amber-200 border-amber-400/40"><i class="fas fa-arrow-left text-[10px]"></i><span>KDS</span></a>`;
                } else if (r === 'waiter') {
                    html += `<a href="order.html" class="btn-glass cn-nav-btn bg-sky-500/20 text-sky-200 border-sky-400/40"><i class="fas fa-arrow-left text-[10px]"></i><span>Order</span></a>`;
                }
                if (html) html += '<span class="cn-nav-divider"></span>';
                backZone.innerHTML = html;
            }
            if (badgeZone) {
                const rawName = user.fullname || user.username || '';
                const disp = (isAdmin && /Quản Trị Viên/i.test(rawName)) ? tr('nav.owner_name', 'Chủ quán') : rawName;
                const safeName = (global.escapeHtml ? global.escapeHtml(disp) : disp);
                const roleLbl = isAdmin ? tr('nav.role_admin', 'ADMIN') : r.toUpperCase();
                badgeZone.innerHTML = `<div class="cn-user-pill bg-slate-800/80 border border-white/10 text-slate-200"><i class="fas ${isAdmin ? 'fa-crown text-amber-400' : 'fa-user-tag text-sky-400'} text-xs"></i><span class="cn-user-name">${safeName}</span><span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-sky-500/20 text-sky-300 border border-sky-400/40">${roleLbl}</span></div><button type="button" onclick="AttendanceKiosk.personalLogout()" class="cn-nav-btn cn-nav-btn--danger"><i class="fas fa-sign-out-alt text-xs"></i><span>${tr('common.logout', 'Đăng xuất')}</span></button>`;
            }
        },

        async loadPersonalStatus() {
            const loginBox = document.getElementById('att-login-box');
            const profBox = document.getElementById('att-profile-box');
            try {
                const res = await fetch('/api/operations.php?action=my_attendance_status', { headers: this.authHeaders(), credentials: 'same-origin' });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    loginBox?.classList.remove('hidden');
                    profBox?.classList.add('hidden');
                    this.renderRoleNav(null);
                    this.switchMode('kiosk');
                    return;
                }
                loginBox?.classList.add('hidden');
                profBox?.classList.remove('hidden');
                const u = data.user || {};
                this._lastUser = u;
                this.renderRoleNav(u);
                this.switchMode('live');
                const fn = document.getElementById('att-user-fullname');
                const rl = document.getElementById('att-user-role');
                if (fn) fn.textContent = u.fullname || u.username || '';
                if (rl) rl.textContent = `${window.cnxT?window.cnxT('js.s_inv.66e1d2ea','Vai trò:'):'Vai trò:'} ${u.role || 'staff'} ${window.cnxT?window.cnxT('js.s_att.5bba9e86','• Hôm nay:'):'• Hôm nay:'} ${data.today || ''}`;

                const shiftEl = document.getElementById('att-active-shift-card');
                const sh = data.active_shift;
                if (shiftEl) {
                    if (sh && sh.id) {
                        shiftEl.innerHTML = `<span class="text-emerald-300 font-bold">🟢 Đang trong ca từ ${(global.escapeHtml ? global.escapeHtml(sh.check_in_time || '') : (sh.check_in_time || ''))}</span> <span class="text-slate-400">(${sh.source || 'auto'})</span>`;
                    } else {
                        shiftEl.innerHTML = (window.cnxT?window.cnxT('js.s_att.0f3a9383','<span class="text-slate-400">Chưa check-in ca làm việc hôm nay.</span>'):'<span class="text-slate-400">Chưa check-in ca làm việc hôm nay.</span>');
                    }
                }

                const histEl = document.getElementById('att-personal-history');
                if (histEl) {
                    const rows = data.recent_records || [];
                    histEl.innerHTML = rows.length ? rows.map(r => `
                        <tr>
                            <td class="py-1.5 font-mono">${r.work_date || ''}</td>
                            <td class="py-1.5 font-mono text-sky-300">${(r.check_in_time || '').slice(11, 16)}</td>
                            <td class="py-1.5 font-mono text-amber-300">${r.check_out_time ? r.check_out_time.slice(11, 16) : (window.cnxT?window.cnxT('js.s_att.5d7b4580','Đang ca'):'Đang ca')}</td>
                            <td class="py-1.5">${r.source || 'auto'}</td>
                            <td class="py-1.5 text-right font-mono font-bold">${Number(r.work_hours || 0).toFixed(2)}h</td>
                        </tr>
                    `).join('') : (window.cnxT?window.cnxT('js.s_att.56dcd521','<tr><td colspan="5" class="py-4 text-center text-slate-500">Chưa có dữ liệu chấm công</td></tr>'):'<tr><td colspan="5" class="py-4 text-center text-slate-500">Chưa có dữ liệu chấm công</td></tr>');
                }
            } catch (e) {
                loginBox?.classList.remove('hidden');
                profBox?.classList.add('hidden');
            }
        },

        async loadLiveBoard(silent = false) {
            if (this._liveInFlight) return;
            this._liveInFlight = true;
            try {
                const res = await fetch('/api/hr/live-board', { headers: this.authHeaders(), credentials: 'same-origin' });
                const data = await res.json();
                if (!res.ok || !data.success) return;
                this.liveData = data;
                this.renderLiveBoard();
            } catch (e) {
                if (!silent) this.showBanner('Không tải được bảng theo dõi ca real-time', 'error');
            } finally {
                this._liveInFlight = false;
            }
        },

        renderLiveBoard() {
            const d = this.liveData;
            if (!d) return;
            const c = d.counts || {};
            const kpiCfg = [
                ['working', 'Đang trực', 'text-emerald-300 border-emerald-500/30'],
                ['lost_connect', 'Mất kết nối', 'text-amber-300 border-amber-500/30'],
                ['delivering', 'Giao hàng', 'text-sky-300 border-sky-500/30'],
                ['break_temp', 'Nghỉ giữa ca', 'text-purple-300 border-purple-500/30'],
                ['early_leave', 'Chốt ca sớm', 'text-yellow-300 border-yellow-500/30'],
                ['overtime', 'Tăng ca OT', 'text-orange-300 border-orange-500/30'],
                ['checked_out', 'Đã tan ca', 'text-slate-300 border-slate-500/30'],
                ['absent_or_late', 'Chưa vào ca', 'text-rose-300 border-rose-500/30']
            ];
            const kpiEl = document.getElementById('hr-live-kpis');
            if (kpiEl) {
                kpiEl.innerHTML = kpiCfg.map(([k, lbl, cls]) => `<div class="liquid-glass p-2.5 rounded-xl border ${cls}"><div class="text-[10px] uppercase text-slate-400 font-bold">${lbl}</div><div class="text-xl font-black mt-0.5">${c[k] || 0}</div></div>`).join('');
            }

            const myBar = document.getElementById('hr-my-shift-bar');
            const myRow = (d.staff || []).find(s => this._lastUser && Number(s.user_id) === Number(this._lastUser.id));
            if (myBar && myRow) {
                myBar.classList.remove('hidden');
                const tEl = document.getElementById('hr-my-shift-title');
                const sEl = document.getElementById('hr-my-shift-sub');
                if (tEl) tEl.textContent = `${myRow.fullname} (${myRow.role}) — Trạng thái: ${myRow.live_status}`;
                if (sEl) sEl.textContent = myRow.check_in_time ? `Vào ca: ${myRow.check_in_time} • Nguồn: ${myRow.source} • Nghỉ giữa ca: ${myRow.break_minutes || 0}p` : 'Chưa Check-in hôm nay';
            }

            const hikEl = document.getElementById('hr-hik-status-bar');
            if (hikEl) {
                const devs = d.devices || [];
                const unm = d.unmatched_logs || [];
                if (d.is_admin && (devs.length || unm.length)) {
                    hikEl.classList.remove('hidden');
                    const devHtml = devs.map(dv => `<span class="px-2 py-0.5 rounded-lg border ${dv.last_error ? 'bg-rose-500/15 border-rose-500/40 text-rose-300' : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'}">${dv.name} (${dv.ip_address}): ${dv.last_error ? 'Offline' : 'Online'}</span>`).join(' ');
                    const unmHtml = unm.length ? `<div class="text-amber-300 font-bold mt-1">⚠ ${unm.length} lượt quẹt Hikvision chưa khớp mã nhân viên: ${unm.map(u => `${u.employee_no} (${u.user_name})`).join(', ')}</div>` : '';
                    hikEl.innerHTML = `<div class="flex flex-wrap items-center gap-2"><span class="font-bold text-indigo-300">Thiết bị Hikvision:</span>${devHtml || '<span class="text-slate-400">Chế độ thuần Web & Kiosk</span>'}</div>${unmHtml}`;
                } else {
                    hikEl.classList.add('hidden');
                }
            }

            const roleFilter = document.getElementById('hr-role-filter')?.value || 'ALL';
            const rows = (d.staff || []).filter(s => roleFilter === 'ALL' || s.role === roleFilter);
            const badges = {
                working: ['Đang trực ca', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'],
                lost_connect: ['Mất kết nối', 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'],
                delivering: ['Đi giao hàng', 'bg-sky-500/20 text-sky-300 border-sky-500/40'],
                break_temp: ['Nghỉ giữa buổi', 'bg-purple-500/20 text-purple-300 border-purple-500/40'],
                early_leave: ['Chốt ca sớm', 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'],
                overtime: ['Tăng ca OT', 'bg-orange-500/20 text-orange-300 border-orange-500/40'],
                checked_out: ['Đã tan ca', 'bg-slate-700/60 text-slate-300 border-slate-500/40'],
                pending_manager_review: ['Chờ duyệt chốt ca', 'bg-rose-500/20 text-rose-300 border-rose-500/40'],
                absent_or_late: ['Chưa vào ca', 'bg-rose-500/15 text-rose-300 border-rose-500/30']
            };
            const tbody = document.getElementById('hr-live-tbody');
            if (tbody) {
                const esc = (v) => (global.escapeHtml ? global.escapeHtml(String(v || '')) : String(v || ''));
                tbody.innerHTML = rows.length ? rows.map(s => {
                    const [lbl, cls] = badges[s.live_status] || [s.live_status, 'bg-slate-800 text-slate-300 border-white/10'];
                    const detail = [
                        s.delivery_order_code ? `Đơn: #${esc(s.delivery_order_code)}` : '',
                        s.break_minutes ? `Nghỉ: ${s.break_minutes}p` : '',
                        s.early_leave_reason ? `Lý do: ${esc(s.early_leave_reason)}` : ''
                    ].filter(Boolean).join(' • ') || '—';
                    let actions = '';
                    if (d.is_admin) {
                        if (s.live_status === 'absent_or_late') {
                            actions = `<button type="button" onclick="AttendanceKiosk.adminForceStatus(${Number(s.user_id)}, 'force_checkin')" class="btn-glass text-[10px] py-1 px-2 text-emerald-300">Điểm danh</button>`;
                        } else if (s.live_status !== 'checked_out' && s.live_status !== 'early_leave') {
                            actions = `<button type="button" onclick="AttendanceKiosk.adminForceStatus(${Number(s.user_id)}, 'force_checkout')" class="btn-glass text-[10px] py-1 px-2 text-rose-300">Chốt ca hộ</button>`;
                        }
                    }
                    return `<tr>
                        <td class="py-2"><div class="font-bold text-white">${esc(s.fullname)}</div><div class="text-[10px] text-slate-400">${esc(s.role)} ${s.user_code ? '• ' + esc(s.user_code) : ''}</div></td>
                        <td><span class="px-2 py-0.5 rounded-full border text-[10px] font-bold ${cls}">${lbl}</span></td>
                        <td class="text-[11px] text-slate-300">${esc(s.source || '—')}</td>
                        <td class="font-mono text-[11px]"><div>${esc((s.check_in_time || '').slice(11, 16) || '—')}</div><div class="text-[10px] text-slate-500">${esc((s.last_heartbeat_at || '').slice(11, 19))}</div></td>
                        <td class="text-[11px] text-slate-300">${detail}</td>
                        <td class="text-right">${actions}</td>
                    </tr>`;
                }).join('') : '<tr><td colspan="6" class="py-4 text-center text-slate-500">Không có nhân viên nào</td></tr>';
            }
        },

        async setShiftStatus(status, note = '', orderCode = '', managerPin = '') {
            try {
                const res = await fetch('/api/hr/shift-status', {
                    method: 'POST',
                    headers: this.authHeaders(),
                    credentials: 'same-origin',
                    body: JSON.stringify({ status, note, order_code: orderCode, manager_pin: managerPin })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    this.showBanner(data.message || 'Không cập nhật được trạng thái ca!', 'error');
                    return;
                }
                this.showBanner(data.message || 'Đã cập nhật trạng thái ca!', 'success');
                await this.loadLiveBoard(true);
            } catch (e) {
                this.showBanner('Lỗi kết nối máy chủ!', 'error');
            }
        },

        async adminForceStatus(userId, status) {
            try {
                const res = await fetch('/api/hr/shift-status', {
                    method: 'POST',
                    headers: this.authHeaders(),
                    credentials: 'same-origin',
                    body: JSON.stringify({ user_id: userId, status, note: 'Quản lý cập nhật trên Bảng Real-Time' })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    this.showBanner(data.message || 'Thao tác thất bại!', 'error');
                    return;
                }
                this.showBanner(data.message || 'Đã cập nhật!', 'success');
                await this.loadLiveBoard(true);
            } catch (e) {
                this.showBanner('Lỗi kết nối!', 'error');
            }
        },

        async promptDelivery() {
            const code = await (window.cnxPrompt ? window.cnxPrompt('Nhập mã đơn giao hàng (tuỳ chọn):', '') : Promise.resolve(''));
            if (code === null) return;
            await this.setShiftStatus('delivering', 'Ra ngoài giao hàng', String(code || '').trim());
        },

        async promptEarlyLeave() {
            const reason = await (window.cnxPrompt ? window.cnxPrompt('Nhập lý do xin chốt ca sớm:', '') : Promise.resolve(''));
            if (!reason || !String(reason).trim()) return;
            let pin = '';
            if (this._lastUser && this._lastUser.role !== 'admin' && !this._lastUser.is_super_admin) {
                pin = await (window.cnxPrompt ? window.cnxPrompt('Nhập mã PIN Quản lý để duyệt chốt ca sớm:', '') : Promise.resolve(''));
                if (pin === null) return;
            }
            await this.setShiftStatus('early_leave', String(reason).trim(), '', String(pin || '').trim());
        },

        async personalLogin() {
            const username = (document.getElementById('att-login-user')?.value || '').trim();
            const password = document.getElementById('att-login-pass')?.value || '';
            try {
                const res = await fetch('/api/auth.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (!data.success || !data.token) {
                    this.showBanner(data.message || (window.cnxT?window.cnxT('js.s_att.f4db9236','Đăng nhập thất bại!'):'Đăng nhập thất bại!'), 'error');
                    return;
                }
                localStorage.setItem('pos_token', data.token);
                this.showBanner((window.cnxT?window.cnxT('js.s_att.fc803d86','Đăng nhập thành công!'):'Đăng nhập thành công!'), 'success');
                await this.loadPersonalStatus();
            } catch (e) {
                this.showBanner((window.cnxT?window.cnxT('js.s_att.30177c31','Lỗi kết nối khi đăng nhập'):'Lỗi kết nối khi đăng nhập'), 'error');
            }
        },

        async personalLogout() {
            const msg = (typeof window.cnxT === 'function')
                ? window.cnxT('js.s_onl_p.cb29f859', 'Bạn có chắc muốn đăng xuất khỏi hệ thống?')
                : 'Bạn có chắc muốn đăng xuất khỏi hệ thống?';
            if (typeof window.cnxConfirm === 'function') {
                if (!(await window.cnxConfirm(msg))) return;
            }
            try { await fetch('api/auth.php?action=logout', { credentials: 'same-origin' }); } catch (_) {}
            localStorage.removeItem('pos_token');
            localStorage.removeItem('pos_user');
            sessionStorage.clear();
            document.cookie = 'pos_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = 'PHPSESSID=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            window.location.replace('login.html?logout=1');
        },

        captureSelfieBase64() {
            const video = document.getElementById('att-webcam-video');
            const canvas = document.getElementById('att-webcam-canvas');
            if (!video || !canvas || !this.camStream || video.readyState < 2) return '';
            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 240;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/png');
        },

        async toggleCamera() {
            const video = document.getElementById('att-webcam-video');
            const ph = document.getElementById('att-webcam-placeholder');
            const btn = document.getElementById('btn-toggle-cam');
            if (this.camStream) {
                this.camStream.getTracks().forEach(t => t.stop());
                this.camStream = null;
                if (video) video.classList.add('hidden');
                if (ph) ph.classList.remove('hidden');
                if (btn) btn.textContent = (window.cnxT?window.cnxT('ui.att_html.button_3dea1462','Bật Camera'):'Bật Camera');
                return;
            }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showBanner((window.cnxT?window.cnxT('js.s_att.abd17015','Trình duyệt không hỗ trợ webcam ở giao thức hiện tại.'):'Trình duyệt không hỗ trợ webcam ở giao thức hiện tại.'), 'error');
                return;
            }
            try {
                this.camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
                if (video) {
                    video.srcObject = this.camStream;
                    video.classList.remove('hidden');
                }
                if (ph) ph.classList.add('hidden');
                if (btn) btn.textContent = (window.cnxT?window.cnxT('js.s_att.15e22ecd','Tắt Camera'):'Tắt Camera');
            } catch (e) {
                this.showBanner((window.cnxT?window.cnxT('js.s_att.9f704f20','Không thể truy cập camera: '):'Không thể truy cập camera: ') + (e.message || e), 'error');
            }
        },

        async submitWebPunch(actionName) {
            const note = (document.getElementById('att-personal-note')?.value || '').trim();
            try {
                const res = await fetch(`/api/operations.php?action=${actionName}`, {
                    method: 'POST',
                    headers: this.authHeaders(),
                    body: JSON.stringify({ note })
                });
                const data = await res.json();
                this.showBanner(data.message || (data.success ? 'Chấm công thành công!' : (window.cnxT?window.cnxT('js.s_att.4ca165b6','Lỗi chấm công'):'Lỗi chấm công')), data.success ? 'success' : 'error');
                await this.loadPersonalStatus();
            } catch (e) {
                this.showBanner((window.cnxT?window.cnxT('js.s_att.280189ff','Lỗi kết nối khi chấm công'):'Lỗi kết nối khi chấm công'), 'error');
            }
        },

        appendPin(ch) {
            const inp = document.getElementById('att-kiosk-pin');
            if (inp && inp.value.length < 8) inp.value += ch;
        },

        clearPin() {
            const inp = document.getElementById('att-kiosk-pin');
            if (inp) inp.value = '';
        },

        async submitKioskPunch() {
            const pin = (document.getElementById('att-kiosk-pin')?.value || '').trim();
            const mode = document.getElementById('att-kiosk-mode')?.value || 'auto';
            const photo = this.captureSelfieBase64();
            if (!pin) {
                this.showBanner((window.cnxT?window.cnxT('js.s_att.504dc0ca','Vui lòng nhập mã PIN 6 số!'):'Vui lòng nhập mã PIN 6 số!'), 'error');
                return;
            }
            try {
                const res = await fetch('/api/operations.php?action=kiosk_punch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin_code: pin, mode, photo_base64: photo })
                });
                const data = await res.json();
                this.showBanner(data.message || (data.success ? 'Quẹt công thành công!' : (window.cnxT?window.cnxT('js.s_att.f7c9945d','Lỗi Kiosk'):'Lỗi Kiosk')), data.success ? 'success' : 'error');
                if (data.success) this.clearPin();
            } catch (e) {
                this.showBanner((window.cnxT?window.cnxT('js.s_att.0a35e9c4','Lỗi kết nối Kiosk'):'Lỗi kết nối Kiosk'), 'error');
            }
        }
    };

    global.AttendanceKiosk = AttendanceKiosk;
    document.addEventListener('DOMContentLoaded', () => AttendanceKiosk.init());
})(window);
