/**
 * CyberNexus OS — Extracted module from admin.js (Admin)
 */
Object.assign(Admin, {
    // 6. Users & Employees Management
    async loadUsers() {
        try {
            const res = await fetch('api/users.php');
            const data = await res.json();
            if (data.success) {
                this.users = data.data;
                this.renderUsersTable();
            }
        } catch (e) {
            console.error('Error loading users:', e);
        }
    },

    renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;

        if (!this.users || this.users.length === 0) {
            tbody.innerHTML = this.renderEmptyState(8, 'fa-users-gear', (window.cnxT?window.cnxT('js.s_ops.eb4e6846','Chưa có người dùng nào'):'Chưa có người dùng nào'), (window.cnxT?window.cnxT('js.s_ops.042d3dea','Bấm nút "Thêm Người Dùng Mới" để tạo tài khoản nhân viên hoặc thu ngân.'):'Bấm nút "Thêm Người Dùng Mới" để tạo tài khoản nhân viên hoặc thu ngân.'));
            return;
        }

        let html = '';
        this.users.forEach(u => {
            let roleBadge = '';
            let codeColor = 'text-sky-300 bg-sky-500/10 border-sky-500/20';

            if (u.role === 'admin') {
                roleBadge = (window.cnxT?window.cnxT('js.s_ops.d88b68ac','<span class="saas-badge bg-purple-500/15 text-purple-300 border border-purple-500/30"><i class="fas fa-crown text-[9px]"></i> Quản Trị (ADM)</span>'):'<span class="saas-badge bg-purple-500/15 text-purple-300 border border-purple-500/30"><i class="fas fa-crown text-[9px]"></i> Quản Trị (ADM)</span>');
                codeColor = 'text-purple-300 bg-purple-500/10 border-purple-500/20';
            } else if (u.role === 'cashier') {
                roleBadge = (window.cnxT?window.cnxT('js.s_ops.04493030','<span class="saas-badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><i class="fas fa-cash-register text-[9px]"></i> Thu Ngân (ACC)</span>'):'<span class="saas-badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><i class="fas fa-cash-register text-[9px]"></i> Thu Ngân (ACC)</span>');
                codeColor = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
            } else if (u.role === 'kitchen') {
                roleBadge = (window.cnxT?window.cnxT('js.s_ops.dc1516bd','<span class="saas-badge bg-amber-500/15 text-amber-300 border border-amber-500/30"><i class="fas fa-fire text-[9px]"></i> Bếp / Bar (KIT)</span>'):'<span class="saas-badge bg-amber-500/15 text-amber-300 border border-amber-500/30"><i class="fas fa-fire text-[9px]"></i> Bếp / Bar (KIT)</span>');
                codeColor = 'text-amber-300 bg-amber-500/10 border-amber-500/20';
            } else if (u.role === 'customer') {
                roleBadge = (window.cnxT?window.cnxT('js.s_ops.221a4d55','<span class="saas-badge bg-pink-500/15 text-pink-300 border border-pink-500/30"><i class="fas fa-user text-[9px]"></i> Khách Hàng (USR)</span>'):'<span class="saas-badge bg-pink-500/15 text-pink-300 border border-pink-500/30"><i class="fas fa-user text-[9px]"></i> Khách Hàng (USR)</span>');
                codeColor = 'text-pink-300 bg-pink-500/10 border-pink-500/20';
            } else {
                roleBadge = (window.cnxT?window.cnxT('js.s_ops.96398c9b','<span class="saas-badge bg-sky-500/15 text-sky-300 border border-sky-500/30"><i class="fas fa-person-walking text-[9px]"></i> Phục Vụ (STF)</span>'):'<span class="saas-badge bg-sky-500/15 text-sky-300 border border-sky-500/30"><i class="fas fa-person-walking text-[9px]"></i> Phục Vụ (STF)</span>');
                codeColor = 'text-sky-300 bg-sky-500/10 border-sky-500/20';
            }

            const isLocked = u.status === 'locked';

            html += `
                <tr class="hover:bg-sky-500/[0.04] transition-colors ${isLocked ? 'opacity-50' : ''}">
                    <td><span class="font-mono text-xs font-bold px-2 py-0.5 rounded border ${codeColor} whitespace-nowrap">${u.user_code || `U${u.id}`}</span></td>
                    <td><span class="text-xs text-slate-300 font-mono font-medium whitespace-nowrap">${u.username}</span></td>
                    <td class="col-name"><span class="text-xs font-bold text-white whitespace-nowrap">${u.fullname}</span></td>
                    <td class="col-center whitespace-nowrap">${roleBadge}</td>
                    <td><span class="text-xs text-slate-400 font-mono whitespace-nowrap">${u.phone || '-'}</span></td>
                    <td class="col-center"><span class="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs whitespace-nowrap">${u.pin_code || '-'}</span></td>
                    <td class="col-center">
                        <button type="button" onclick="Admin.toggleUserStatus(${u.id})" class="saas-badge ${isLocked ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'} cursor-pointer hover:opacity-80 transition whitespace-nowrap">
                            <span class="w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-rose-400' : 'bg-emerald-400'}"></span>
                            ${isLocked ? 'Đang khóa' : (window.cnxT?window.cnxT('ui.adm_html.span_a6a5375d','Hoạt động'):'Hoạt động')}
                        </button>
                    </td>
                    <td class="col-right">
                        <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button type="button" class="saas-action-btn btn-edit" onclick="Admin.openEditUserModal(${u.id})" title="Sửa thông tin">
                                <i class="fas fa-pen text-[10px]"></i>
                            </button>
                            <button type="button" class="saas-action-btn btn-key" onclick="Admin.openResetPassModal(${u.id})" title="Đổi mật khẩu / PIN">
                                <i class="fas fa-key text-[10px]"></i>
                            </button>
                            <button type="button" class="saas-action-btn btn-delete" onclick="Admin.deleteUser(${u.id})" title="Xóa người dùng">
                                <i class="fas fa-trash-can text-[10px]"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    suggestNextUserCode(role) {
        const prefixMap = {
            admin: 'ADM',
            cashier: 'ACC',
            waiter: 'STF',
            kitchen: 'KIT',
            customer: 'USR'
        };
        const prefix = prefixMap[role] || 'STF';
        let maxNum = 0;
        if (Array.isArray(this.users)) {
            this.users.forEach(u => {
                if (u.user_code && u.user_code.toUpperCase().startsWith(prefix)) {
                    const match = u.user_code.match(/\d+$/);
                    if (match) {
                        const num = parseInt(match[0], 10);
                        if (num > maxNum) maxNum = num;
                    }
                }
            });
        }
        return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    },

    onUserRoleChange() {
        const role = document.getElementById('modal-user-role').value;
        const codeInput = document.getElementById('modal-user-code');
        const isEdit = !!document.getElementById('modal-user-id').value;
        if (!isEdit || !codeInput.value) {
            codeInput.value = this.suggestNextUserCode(role);
        }
    },

    openAddUserModal() {
        document.getElementById('modal-user-id').value = '';
        document.getElementById('modal-user-role').value = 'waiter';
        document.getElementById('modal-user-code').value = this.suggestNextUserCode('waiter');
        document.getElementById('modal-user-username').value = '';
        document.getElementById('modal-user-username').disabled = false;
        document.getElementById('modal-user-fullname').value = '';
        document.getElementById('modal-user-phone').value = '';
        document.getElementById('modal-user-pincode').value = Math.floor(1000 + Math.random() * 9000);
        document.getElementById('modal-user-password').value = '123456';
        document.getElementById('modal-user-pass-container').classList.remove('hidden');
        document.getElementById('user-modal-title').innerText = (window.cnxT?window.cnxT('ui.admin_html.button_1b2708bd','Thêm Người Dùng Mới'):'Thêm Người Dùng Mới');
        document.getElementById('user-modal').classList.add('open');
    },

    openEditUserModal(userId) {
        const u = this.users.find(x => x.id === userId);
        if (!u) return;

        document.getElementById('modal-user-id').value = u.id;
        document.getElementById('modal-user-code').value = u.user_code || this.suggestNextUserCode(u.role);
        document.getElementById('modal-user-username').value = u.username;
        document.getElementById('modal-user-username').disabled = true; // Cannot edit username
        document.getElementById('modal-user-fullname').value = u.fullname;
        document.getElementById('modal-user-role').value = u.role;
        document.getElementById('modal-user-phone').value = u.phone || '';
        document.getElementById('modal-user-pincode').value = u.pin_code || '';
        document.getElementById('modal-user-pass-container').classList.add('hidden'); // Password changed via reset modal
        document.getElementById('user-modal-title').innerText = `${window.cnxT?window.cnxT('js.s_ops.15387ca8','Chỉnh Sửa:'):'Chỉnh Sửa:'} ${u.fullname} (${u.user_code || ''})`;
        document.getElementById('user-modal').classList.add('open');
    },

    async saveUser() {
        const id = document.getElementById('modal-user-id').value;
        const user_code = document.getElementById('modal-user-code').value.trim().toUpperCase();
        const username = document.getElementById('modal-user-username').value.trim();
        const fullname = document.getElementById('modal-user-fullname').value.trim();
        const role = document.getElementById('modal-user-role').value;
        const phone = document.getElementById('modal-user-phone').value.trim();
        const pin_code = document.getElementById('modal-user-pincode').value.trim();
        const password = document.getElementById('modal-user-password').value.trim();

        if (!fullname) {
            alert((window.cnxT?window.cnxT('js.s_ops.9c56c6d2','Vui lòng nhập họ và tên người dùng!'):'Vui lòng nhập họ và tên người dùng!'));
            return;
        }

        const isEdit = !!id;
        const url = isEdit ? 'api/users.php?action=update' : 'api/users.php?action=add';
        const payload = isEdit 
            ? { id, user_code, fullname, role, phone, pin_code, status: 'active' }
            : { user_code, username, fullname, role, phone, pin_code, password };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('user-modal').classList.remove('open');
                await this.loadUsers();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_ops.e834ef6c','Lỗi lưu thông tin người dùng'):'Lỗi lưu thông tin người dùng'));
            }
        } catch (e) {
            console.error('Error saving user:', e);
        }
    },

    openResetPassModal(userId) {
        const u = this.users.find(x => x.id === userId);
        if (!u) return;

        document.getElementById('reset-user-id').value = u.id;
        document.getElementById('reset-new-password').value = '';
        document.getElementById('reset-new-pin').value = u.pin_code || '';
        document.getElementById('reset-pass-modal').classList.add('open');
    },

    async submitResetPassword() {
        const id = document.getElementById('reset-user-id').value;
        const newPassword = document.getElementById('reset-new-password').value.trim();
        const newPin = document.getElementById('reset-new-pin').value.trim();

        if (!newPassword && !newPin) {
            alert((window.cnxT?window.cnxT('js.s_ops.783a9dff','Vui lòng nhập mật khẩu mới hoặc mã PIN mới!'):'Vui lòng nhập mật khẩu mới hoặc mã PIN mới!'));
            return;
        }

        try {
            const res = await fetch('api/users.php?action=reset_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, new_password: newPassword, new_pin: newPin })
            });
            const data = await res.json();
            if (data.success) {
                alert((window.cnxT?window.cnxT('js.s_ops.39beb411','Đổi mật khẩu / mã PIN thành công!'):'Đổi mật khẩu / mã PIN thành công!'));
                document.getElementById('reset-pass-modal').classList.remove('open');
                await this.loadUsers();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_ops.74eb2083','Lỗi đổi mật khẩu'):'Lỗi đổi mật khẩu'));
            }
        } catch (e) {
            console.error('Error resetting password:', e);
        }
    },

    async toggleUserStatus(userId) {
        try {
            const res = await fetch('api/users.php?action=toggle_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId })
            });
            const data = await res.json();
            if (data.success) {
                await this.loadUsers();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_adm.2d4e917e','Lỗi thao tác'):'Lỗi thao tác'));
            }
        } catch (e) {
            console.error('Error toggling user status:', e);
        }
    },

    async deleteUser(userId) {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_ops.1ed81930','Bạn có chắc chắn muốn xóa nhân viên này khỏi hệ thống?'):'Bạn có chắc chắn muốn xóa nhân viên này khỏi hệ thống?')))) return;
        try {
            const res = await fetch(`api/users.php?action=delete&id=${userId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                await this.loadUsers();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_ops.d973be90','Lỗi xóa nhân viên'):'Lỗi xóa nhân viên'));
            }
        } catch (e) {
            console.error('Error deleting user:', e);
        }
    },

    // 7. Kitchen & Staff Performance Analytics
    setAnalyticsPreset(preset) {
        const today = new Date();
        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        let fromDate = new Date();
        let toDate = new Date();

        if (preset === 'today') {
            fromDate = today;
            toDate = today;
        } else if (preset === 'yesterday') {
            fromDate.setDate(today.getDate() - 1);
            toDate.setDate(today.getDate() - 1);
        } else if (preset === '7days') {
            fromDate.setDate(today.getDate() - 6);
            toDate = today;
        } else if (preset === 'month') {
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
            toDate = today;
        }

        const fromInput = document.getElementById('ana-date-from');
        const toInput = document.getElementById('ana-date-to');
        if (fromInput) fromInput.value = formatDate(fromDate);
        if (toInput) toInput.value = formatDate(toDate);

        ['today', 'yesterday', '7days', 'month'].forEach(p => {
            const btn = document.getElementById(`btn-ana-${p}`);
            if (btn) {
                if (p === preset) {
                    btn.className = 'px-2.5 py-1 rounded-lg text-amber-300 bg-amber-500/20 font-bold';
                } else {
                    btn.className = 'px-2.5 py-1 rounded-lg text-slate-300 hover:text-white';
                }
            }
        });

        this.loadAnalyticsData();
    },

    async loadAnalyticsData() {
        const fromInput = document.getElementById('ana-date-from');
        const toInput = document.getElementById('ana-date-to');

        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const todayStr = formatDate(new Date());

        if (fromInput && !fromInput.value) fromInput.value = todayStr;
        if (toInput && !toInput.value) toInput.value = todayStr;

        const dateFrom = fromInput ? fromInput.value : todayStr;
        const dateTo = toInput ? toInput.value : todayStr;

        try {
            const res = await fetch(`api/reports.php?action=service_performance&date_from=${dateFrom}&date_to=${dateTo}`);
            const data = await res.json();
            if (!data.success) {
                const staffTbody = document.getElementById('ana-staff-tbody');
                if (staffTbody) staffTbody.innerHTML = this.renderEmptyState(6, 'fa-user-clock', (window.cnxT?window.cnxT('js.s_ops.55de0daa','Chưa có dữ liệu nhân viên'):'Chưa có dữ liệu nhân viên'), (window.cnxT?window.cnxT('js.s_ops.7f15db4a','Dữ liệu xếp hạng phục vụ & thu ngân sẽ hiển thị khi phát sinh ca làm việc.'):'Dữ liệu xếp hạng phục vụ & thu ngân sẽ hiển thị khi phát sinh ca làm việc.'));
                const dishesTbody = document.getElementById('ana-dishes-tbody');
                if (dishesTbody) dishesTbody.innerHTML = this.renderEmptyState(3, 'fa-mug-hot', (window.cnxT?window.cnxT('js.s_ops.4f686a73','Chưa có món chế biến'):'Chưa có món chế biến'), (window.cnxT?window.cnxT('js.s_ops.02a57825','Top món sẽ cập nhật ngay khi bộ phận bếp hoàn thành món ăn.'):'Top món sẽ cập nhật ngay khi bộ phận bếp hoàn thành món ăn.'));
                const logsTbody = document.getElementById('ana-logs-tbody');
                if (logsTbody) logsTbody.innerHTML = this.renderEmptyState(7, 'fa-clipboard-check', (window.cnxT?window.cnxT('js.s_ops.90d9c47c','Chưa có sự kiện nào'):'Chưa có sự kiện nào'), (window.cnxT?window.cnxT('js.s_ops.3e48d296','Nhật ký audit trail thời gian thực của bếp & phục vụ sẽ ghi nhận tại đây.'):'Nhật ký audit trail thời gian thực của bếp & phục vụ sẽ ghi nhận tại đây.'));
                return;
            }

            // 1. KPI Cards
            const kpi = data.kitchen_kpi || {};
            const setTxt = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = val;
            };

            setTxt('ana-stat-orders', kpi.total_orders_cooked || 0);
            setTxt('ana-stat-items', `${kpi.total_items_cooked || 0} ${window.cnxT?window.cnxT('js.s_ops.15fba45c','món / ly đã làm'):'món / ly đã làm'}`);
            setTxt('ana-stat-prep-time', `${kpi.avg_prep_minutes || 0} <span class="text-xs font-normal">${window.cnxT?window.cnxT('ui.adm_html.span_5e6a82b6','phút/đơn'):'phút/đơn'}</span>`);
            setTxt('ana-stat-deliver-time', `${kpi.avg_deliver_minutes || 0} <span class="text-xs font-normal">${window.cnxT?window.cnxT('ui.adm_html.span_e198d401','phút'):'phút'}</span>`);
            setTxt('ana-stat-ontime-rate', `${kpi.on_time_rate || 100}%`);

            // 2. Staff Ranking Table
            const staffTbody = document.getElementById('ana-staff-tbody');
            if (staffTbody) {
                const staff = data.staff_stats || [];
                if (staff.length === 0) {
                    staffTbody.innerHTML = this.renderEmptyState(6, 'fa-user-clock', (window.cnxT?window.cnxT('js.s_ops.55de0daa','Chưa có dữ liệu nhân viên'):'Chưa có dữ liệu nhân viên'), (window.cnxT?window.cnxT('js.s_ops.7f15db4a','Dữ liệu xếp hạng phục vụ & thu ngân sẽ hiển thị khi phát sinh ca làm việc.'):'Dữ liệu xếp hạng phục vụ & thu ngân sẽ hiển thị khi phát sinh ca làm việc.'));
                } else {
                    let html = '';
                    staff.forEach((u, i) => {
                        let roleBadge = (window.cnxT?window.cnxT('js.s_ops.2eb4e214','<span class="saas-badge bg-slate-800 text-slate-300">Nhân viên</span>'):'<span class="saas-badge bg-slate-800 text-slate-300">Nhân viên</span>');
                        if (u.role === 'admin') roleBadge = (window.cnxT?window.cnxT('js.s_ops.ea311076','<span class="saas-badge bg-purple-500/15 text-purple-300 border border-purple-500/30">Quản Lý</span>'):'<span class="saas-badge bg-purple-500/15 text-purple-300 border border-purple-500/30">Quản Lý</span>');
                        if (u.role === 'cashier') roleBadge = (window.cnxT?window.cnxT('js.s_ops.530b3d0b','<span class="saas-badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Thu Ngân</span>'):'<span class="saas-badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Thu Ngân</span>');
                        if (u.role === 'waiter') roleBadge = (window.cnxT?window.cnxT('js.s_ops.1e7b6512','<span class="saas-badge bg-sky-500/15 text-sky-300 border border-sky-500/30">Phục Vụ</span>'):'<span class="saas-badge bg-sky-500/15 text-sky-300 border border-sky-500/30">Phục Vụ</span>');
                        if (u.role === 'kitchen') roleBadge = (window.cnxT?window.cnxT('js.s_ops.a449ef53','<span class="saas-badge bg-amber-500/15 text-amber-300 border border-amber-500/30">Bếp / Bar</span>'):'<span class="saas-badge bg-amber-500/15 text-amber-300 border border-amber-500/30">Bếp / Bar</span>');

                        const rankMedal = i === 0 ? '🥇 ' : (i === 1 ? '🥈 ' : (i === 2 ? '🥉 ' : ''));

                        html += `
                            <tr class="hover:bg-sky-500/[0.04] transition-colors">
                                <td>
                                    <div class="font-bold text-white text-xs flex items-center gap-1.5">
                                        <span>${rankMedal}</span>
                                        <span>${u.fullname}</span>
                                        <span class="text-[10px] text-slate-400 font-mono">(@${u.username})</span>
                                    </div>
                                </td>
                                <td>${roleBadge}</td>
                                <td class="col-center font-mono font-bold text-sky-400 text-xs">${u.orders_created}</td>
                                <td class="col-center font-mono font-bold text-emerald-400 text-xs">${u.orders_served}</td>
                                <td class="col-money"><span class="font-mono font-bold text-amber-300 text-xs">${this.formatMoney(u.total_revenue)} đ</span></td>
                                <td class="col-center font-mono text-slate-300 text-xs">${u.avg_deliver_minutes > 0 ? (u.avg_deliver_minutes + 'p') : '--'}</td>
                            </tr>
                        `;
                    });
                    staffTbody.innerHTML = html;
                }
            }

            // 3. Top Cooked Dishes Table
            const dishesTbody = document.getElementById('ana-dishes-tbody');
            if (dishesTbody) {
                const dishes = data.top_cooked_dishes || [];
                if (dishes.length === 0) {
                    dishesTbody.innerHTML = this.renderEmptyState(3, 'fa-fire-burner', (window.cnxT?window.cnxT('js.s_ops.4f686a73','Chưa có món chế biến'):'Chưa có món chế biến'), (window.cnxT?window.cnxT('js.s_ops.02a57825','Top món sẽ cập nhật ngay khi bộ phận bếp hoàn thành món ăn.'):'Top món sẽ cập nhật ngay khi bộ phận bếp hoàn thành món ăn.'));
                } else {
                    let html = '';
                    dishes.forEach((d, i) => {
                        html += `
                            <tr class="hover:bg-sky-500/[0.04] transition-colors">
                                <td>
                                    <div class="font-bold text-white text-xs flex items-center gap-1">
                                        <span class="text-amber-400 font-mono font-bold text-xs">${i + 1}.</span>
                                        <span class="truncate">${d.product_name}</span>
                                    </div>
                                </td>
                                <td class="col-center font-mono font-bold text-amber-300 text-xs">
                                    <span class="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">x${d.total_qty} ${d.unit || ''}</span>
                                </td>
                                <td class="col-money"><span class="font-mono font-bold text-slate-200 text-xs">${this.formatMoney(d.total_revenue)} đ</span></td>
                            </tr>
                        `;
                    });
                    dishesTbody.innerHTML = html;
                }
            }

            // 4. Audit Service Logs Table
            const logsTbody = document.getElementById('ana-logs-tbody');
            if (logsTbody) {
                const logs = data.recent_logs || [];
                if (logs.length === 0) {
                    logsTbody.innerHTML = this.renderEmptyState(7, 'fa-clock-rotate-left', (window.cnxT?window.cnxT('js.s_ops.90d9c47c','Chưa có sự kiện nào'):'Chưa có sự kiện nào'), (window.cnxT?window.cnxT('js.s_ops.3e48d296','Nhật ký audit trail thời gian thực của bếp & phục vụ sẽ ghi nhận tại đây.'):'Nhật ký audit trail thời gian thực của bếp & phục vụ sẽ ghi nhận tại đây.'));
                } else {
                    let html = '';
                    logs.forEach(l => {
                        let actionBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">${l.action_label}</span>`;
                        if (l.action === 'order_created') actionBadge = (window.cnxT?window.cnxT('js.s_ops.5b8097e2','<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30"><i class="fas fa-clipboard-list mr-1"></i>Nhận Order</span>'):'<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30"><i class="fas fa-clipboard-list mr-1"></i>Nhận Order</span>');
                        if (l.action === 'kitchen_ready') actionBadge = (window.cnxT?window.cnxT('js.s_ops.085569cf','<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"><i class="fas fa-fire mr-1"></i>Bếp Xong</span>'):'<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"><i class="fas fa-fire mr-1"></i>Bếp Xong</span>');
                        if (l.action === 'waiter_served') actionBadge = (window.cnxT?window.cnxT('js.s_ops.f9ec39df','<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"><i class="fas fa-check-circle mr-1"></i>Đã Bưng Ra</span>'):'<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"><i class="fas fa-check-circle mr-1"></i>Đã Bưng Ra</span>');
                        if (l.action === 'checkout') actionBadge = (window.cnxT?window.cnxT('js.s_ops.9d62a3f1','<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30"><i class="fas fa-cash-register mr-1"></i>Thanh Toán</span>'):'<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30"><i class="fas fa-cash-register mr-1"></i>Thanh Toán</span>');
                        if (l.action === 'kitchen_reopen') actionBadge = (window.cnxT?window.cnxT('js.s_ops.32e395e1','<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30"><i class="fas fa-rotate-left mr-1"></i>Nấu Lại</span>'):'<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30"><i class="fas fa-rotate-left mr-1"></i>Nấu Lại</span>');
                        if (l.action === 'cancel_order') actionBadge = (window.cnxT?window.cnxT('js.s_ops.5d6f0456','<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/30 text-rose-400 border border-rose-500/40"><i class="fas fa-times-circle mr-1"></i>Hủy Đơn</span>'):'<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/30 text-rose-400 border border-rose-500/40"><i class="fas fa-times-circle mr-1"></i>Hủy Đơn</span>');

                        const timeFormatted = l.created_at ? l.created_at.substring(11, 19) + ' ' + l.created_at.substring(8, 10) + '/' + l.created_at.substring(5, 7) : '--';

                        html += `
                            <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors">
                                <td class="p-2 text-slate-400 font-mono text-[11px]">${timeFormatted}</td>
                                <td class="p-2 font-mono font-bold text-sky-400">${l.order_code}</td>
                                <td class="p-2 font-bold text-amber-300">${l.table_code}</td>
                                <td class="p-2">${actionBadge}</td>
                                <td class="p-2 text-white font-semibold">${l.user_name || (window.cnxT?window.cnxT('js.s_adm.fad65698','Hệ thống'):'Hệ thống')}</td>
                                <td class="p-2 text-slate-400 uppercase text-[10px]">${l.user_role || '--'}</td>
                                <td class="p-2 text-slate-300 text-[11px] font-sans">${l.note || ''}</td>
                            </tr>
                        `;
                    });
                    logsTbody.innerHTML = html;
                }
            }
        } catch (e) {
            console.error('Error loading analytics:', e);
        }
    },

    // ==========================================
    // CLOUD SYNC (MYSQL) MANAGEMENT
    // ==========================================
    async openCloudSyncModal() {
        if (!this.isModuleAllowed('cloud_sync_backup')) {
            alert((window.cnxT?window.cnxT('js.s_ops.b660b692','Module [cloud_sync_backup] chưa được cấp phép hoặc đã bị Master tắt/khóa!'):'Module [cloud_sync_backup] chưa được cấp phép hoặc đã bị Master tắt/khóa!'));
            return;
        }
        const modal = document.getElementById('cloud-sync-modal');
        if (!modal) return;

        // Reset alert and result
        this.hideSyncAlert();
        const resBox = document.getElementById('sync-result-box');
        if (resBox) resBox.classList.add('hidden');

        // Fetch current config
        try {
            const res = await fetch('api/sync_mysql.php?action=get_config');
            const data = await res.json();
            if (data.success && data.config) {
                const c = data.config;
                if (document.getElementById('sync-host')) document.getElementById('sync-host').value = c.host || '127.0.0.1';
                if (document.getElementById('sync-port')) document.getElementById('sync-port').value = c.port || 3306;
                if (document.getElementById('sync-database')) document.getElementById('sync-database').value = c.database || 'pos_sale_app';
                if (document.getElementById('sync-user')) document.getElementById('sync-user').value = c.user || 'root';
                if (document.getElementById('sync-password')) document.getElementById('sync-password').value = c.password || '';
            }
        } catch (err) {
            console.error('Error fetching MySQL config:', err);
        }

        modal.classList.add('open');
    },

    closeCloudSyncModal() {
        const modal = document.getElementById('cloud-sync-modal');
        if (modal) modal.classList.remove('open');
    },

    toggleSyncPasswordVisibility() {
        const passInput = document.getElementById('sync-password');
        const eyeIcon = document.getElementById('sync-pass-eye');
        if (!passInput || !eyeIcon) return;

        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        } else {
            passInput.type = 'password';
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    },

    showSyncAlert(type, message, technical = null) {
        const alertBox = document.getElementById('cloud-sync-alert');
        if (!alertBox) return;

        alertBox.className = 'mb-4 p-3.5 rounded-xl border text-xs leading-relaxed transition-all duration-300';

        let icon = 'fa-info-circle';
        let bgBorder = 'bg-sky-500/10 border-sky-500/30 text-sky-200';

        if (type === 'success') {
            icon = 'fa-circle-check';
            bgBorder = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200';
        } else if (type === 'error') {
            icon = 'fa-triangle-exclamation';
            bgBorder = 'bg-rose-500/15 border-rose-500/40 text-rose-200';
        }

        alertBox.className += ' ' + bgBorder;

        let techHtml = '';
        if (technical) {
            techHtml = `
                <div class="mt-2 pt-2 border-t border-white/10 text-[11px] font-mono text-slate-300">
                    <span class="text-slate-400 font-bold block mb-0.5">${window.cnxT?window.cnxT('js.s_ops.04601f9a','Chi tiết lỗi kỹ thuật (Technical Log):'):'Chi tiết lỗi kỹ thuật (Technical Log):'}</span>
                    <pre class="whitespace-pre-wrap break-all bg-black/40 p-2 rounded text-rose-300">${this.escapeHtml(technical)}</pre>
                </div>
            `;
        }

        alertBox.innerHTML = `
            <div class="flex items-start gap-2.5">
                <i class="fas ${icon} text-base mt-0.5 shrink-0"></i>
                <div class="flex-1">
                    <div class="whitespace-pre-line">${message}</div>
                    ${techHtml}
                </div>
            </div>
        `;
        alertBox.classList.remove('hidden');
    },

    hideSyncAlert() {
        const alertBox = document.getElementById('cloud-sync-alert');
        if (alertBox) {
            alertBox.classList.add('hidden');
            alertBox.innerHTML = '';
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    getSyncFormData() {
        const hostEl = document.getElementById('sync-host');
        const portEl = document.getElementById('sync-port');
        const dbEl = document.getElementById('sync-database');
        const userEl = document.getElementById('sync-user');
        const pwdEl = document.getElementById('sync-password');
        const autoCreateEl = document.getElementById('sync-auto-create-db');
        const saveCfgEl = document.getElementById('sync-save-config');
        return {
            host: hostEl && hostEl.value ? hostEl.value.trim() : '127.0.0.1',
            port: parseInt(portEl && portEl.value ? portEl.value : '3306'),
            database: dbEl && dbEl.value ? dbEl.value.trim() : 'pos_sale_app',
            user: userEl && userEl.value ? userEl.value.trim() : 'root',
            password: pwdEl && pwdEl.value ? pwdEl.value : '',
            auto_create_db: autoCreateEl ? autoCreateEl.checked : true,
            save_config: saveCfgEl ? saveCfgEl.checked : true
        };
    },

    async testCloudConnection() {
        const payload = this.getSyncFormData();
        const testBtn = document.getElementById('btn-sync-test');
        const origBtnText = testBtn ? testBtn.innerHTML : '';

        if (!payload.host) {
            this.showSyncAlert('error', (window.cnxT?window.cnxT('js.s_ops.597843ed','Vui lòng điền địa chỉ máy chủ MySQL (Host)!'):'Vui lòng điền địa chỉ máy chủ MySQL (Host)!'));
            return;
        }

        try {
            if (testBtn) {
                testBtn.disabled = true;
                testBtn.innerHTML = (window.cnxT?window.cnxT('js.s_ops.c6895581','<i class="fas fa-spinner fa-spin text-sky-400"></i><span>Đang kiểm tra...</span>'):'<i class="fas fa-spinner fa-spin text-sky-400"></i><span>Đang kiểm tra...</span>');
            }
            this.showSyncAlert('info', `${window.cnxT?window.cnxT('js.s_ops.76dbce02','Đang thử kết nối đến'):'Đang thử kết nối đến'} ${payload.host}:${payload.port}...`);

            const res = await fetch('api/sync_mysql.php?action=test_connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                const dbStatus = data.database_exists 
                    ? `<span class="text-emerald-400 font-bold">${window.cnxT?window.cnxT('js.s_ops.431a1d8f','Đã tồn tại'):'Đã tồn tại'}</span>`
                    : `<span class="text-amber-400 font-bold">${window.cnxT?window.cnxT('js.s_ops.c56e0228','Chưa có (hệ thống sẽ tự tạo khi đồng bộ)'):'Chưa có (hệ thống sẽ tự tạo khi đồng bộ)'}</span>`;

                this.showSyncAlert(
                    'success',
                    `✅ <b>${data.message}</b>${window.cnxT?window.cnxT('js.s_ops.cdbb1b0c','\\n• Phiên bản máy chủ:'):'\\n• Phiên bản máy chủ:'} <b>${data.server_version}</b>${window.cnxT?window.cnxT('js.s_ops.7465a74d','\\n• Trạng thái cơ sở dữ liệu'):'\\n• Trạng thái cơ sở dữ liệu'} <code>${data.database_name}</code>: ${dbStatus}`
                );
            } else {
                this.showSyncAlert('error', data.message || (window.cnxT?window.cnxT('js.s_ops.62e7354b','Kết nối MySQL thất bại!'):'Kết nối MySQL thất bại!'), data.technical);
            }
        } catch (err) {
            console.error('Test connection error:', err);
            this.showSyncAlert('error', (window.cnxT?window.cnxT('js.s_ops.1261a5a9','Không thể gửi yêu cầu kiểm tra kết nối đến backend!'):'Không thể gửi yêu cầu kiểm tra kết nối đến backend!'), err.message);
        } finally {
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.innerHTML = origBtnText;
            }
        }
    },

    async startCloudSync() {
        const payload = this.getSyncFormData();
        const startBtn = document.getElementById('btn-sync-start');
        const origBtnText = startBtn ? startBtn.innerHTML : '';

        if (!(await window.cnxConfirm(`${window.cnxT?window.cnxT('js.s_ops.f1105440','Bạn có chắc chắn muốn đồng bộ toàn bộ cơ sở dữ liệu lên MySQL tại'):'Bạn có chắc chắn muốn đồng bộ toàn bộ cơ sở dữ liệu lên MySQL tại'} ${payload.host}:${payload.port} [DB: ${payload.database}${window.cnxT?window.cnxT('js.s_ops.d6d0b5e2','] không?'):'] không?'}`))) {
            return;
        }

        try {
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.innerHTML = (window.cnxT?window.cnxT('js.s_ops.6308217f','<i class="fas fa-spinner fa-spin text-white"></i><span>Đang đồng bộ...</span>'):'<i class="fas fa-spinner fa-spin text-white"></i><span>Đang đồng bộ...</span>');
            }
            this.showSyncAlert('info', `${window.cnxT?window.cnxT('js.s_ops.b5a7253c','Đang sao lưu và đồng bộ toàn bộ bảng dữ liệu lên MySQL... Vui lòng chờ vài giây...'):'Đang sao lưu và đồng bộ toàn bộ bảng dữ liệu lên MySQL... Vui lòng chờ vài giây...'}`);

            const res = await fetch('api/sync_mysql.php?action=sync_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                this.showSyncAlert(
                    'success',
                    `🎉 <b>${data.message}</b>${window.cnxT?window.cnxT('js.s_ops.a14da15f','\\n• Máy chủ:'):'\\n• Máy chủ:'} <b>${data.host} (${data.server_version})</b> | CSDL: <b>${data.database}</b>${window.cnxT?window.cnxT('js.s_ops.1504a133','\\n• Tổng số bản ghi đã đồng bộ:'):'\\n• Tổng số bản ghi đã đồng bộ:'} <b>${data.total_records} dòng</b>${window.cnxT?window.cnxT('js.s_ops.cb4846e0','\\n• Thời gian hoàn thành:'):'\\n• Thời gian hoàn thành:'} <b>${data.synced_at}</b>`
                );

                // Render itemized tables breakdown
                const resBox = document.getElementById('sync-result-box');
                const resGrid = document.getElementById('sync-result-grid');
                if (resBox && resGrid && data.synced_counts) {
                    const tableNamesMap = {
                        'users': (window.cnxT?window.cnxT('ui.admin_html.th_e97b90bd','Tài khoản'):'Tài khoản'),
                        'categories': (window.cnxT?window.cnxT('js.s_ops.6660ca80','Danh mục'):'Danh mục'),
                        'products': (window.cnxT?window.cnxT('js.s_ops.04285e5f','Thực đơn/Món'):'Thực đơn/Món'),
                        'tables_areas': (window.cnxT?window.cnxT('js.s_ops.cabf64a3','Bàn / Khu'):'Bàn / Khu'),
                        'orders': (window.cnxT?window.cnxT('js.s_ops.f80132e6','Hóa đơn'):'Hóa đơn'),
                        'order_items': (window.cnxT?window.cnxT('js.s_ops.63f3262b','Chi tiết món'):'Chi tiết món'),
                        'store_settings': (window.cnxT?window.cnxT('js.s_ops.a0a98849','Cài đặt quán'):'Cài đặt quán'),
                        'kitchen_service_logs': (window.cnxT?window.cnxT('js.s_ops.24b3fe50','Nhật ký bếp'):'Nhật ký bếp')
                    };

                    let gridHtml = '';
                    for (const [tbl, count] of Object.entries(data.synced_counts)) {
                        const label = tableNamesMap[tbl] || tbl;
                        gridHtml += `
                            <div class="p-2 rounded bg-slate-800/80 border border-white/5 flex flex-col justify-between">
                                <span class="text-slate-400 text-[10px]">${label}</span>
                                <span class="text-cyan-300 font-bold text-sm font-mono">${count} <span class="text-[10px] text-slate-500 font-normal">${window.cnxT?window.cnxT('js.s_ops.260284e0','dòng'):'dòng'}</span></span>
                            </div>
                        `;
                    }
                    resGrid.innerHTML = gridHtml;
                    resBox.classList.remove('hidden');
                }
            } else {
                this.showSyncAlert('error', data.message || (window.cnxT?window.cnxT('js.s_ops.e1696f7b','Đồng bộ dữ liệu thất bại!'):'Đồng bộ dữ liệu thất bại!'), data.technical);
            }
        } catch (err) {
            console.error('Start sync error:', err);
            this.showSyncAlert('error', (window.cnxT?window.cnxT('js.s_ops.7e5210ec','Lỗi kết nối khi gửi dữ liệu đồng bộ!'):'Lỗi kết nối khi gửi dữ liệu đồng bộ!'), err.message);
        } finally {
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = origBtnText;
            }
        }
    },

    switchSettingsGroup(group) {
        const groups = document.querySelectorAll('#tab-settings .settings-group');
        groups.forEach(el => {
            const g = el.getAttribute('data-settings-group');
            el.classList.toggle('hidden', group !== 'all' && g !== group);
        });
        const btns = document.querySelectorAll('#settings-group-tabs [data-sg-btn]');
        btns.forEach(btn => {
            const active = btn.getAttribute('data-sg-btn') === group;
            if (btn.getAttribute('data-sg-btn') === 'all') {
                btn.className = active
                    ? 'px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-sky-500/25 text-sky-200 border border-sky-400/40 ml-auto transition'
                    : 'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white border border-transparent ml-auto transition';
            } else {
                btn.className = active
                    ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500/25 text-sky-200 border border-sky-400/40 transition'
                    : 'px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white border border-transparent transition';
            }
        });
        const saveRow = document.getElementById('settings-save-row');
        if (saveRow) saveRow.classList.toggle('hidden', group === 'wan');
        if ((group === 'receipt' || group === 'all') && typeof this.initReceiptStudioSettings === 'function') {
            this.initReceiptStudioSettings();
        }
        if ((group === 'wifi' || group === 'all') && typeof this.loadRouterDevices === 'function') {
            this.loadRouterDevices();
        }
    },

    // ========================================================
    async loadWanTunnelStatus() {
        const badge = document.getElementById('wan-tunnel-status-badge');
        const meta = document.getElementById('wan-tunnel-meta');
        const urlEl = document.getElementById('wan-master-url');
        const fbEl = document.getElementById('wan-master-fallback-url');
        const enEl = document.getElementById('wan-tunnel-enabled');
        if (!badge) return;
        try {
            const res = await fetch('api/wan_tunnel', { credentials: 'same-origin' });
            const json = await res.json();
            if (!json.success || !json.data) return;
            const d = json.data;
            if (urlEl && !urlEl.matches(':focus')) urlEl.value = d.master_url || '';
            if (fbEl && !fbEl.matches(':focus')) fbEl.value = d.master_fallback_url || '';
            if (enEl) enEl.checked = !!d.enabled;
            if (d.connected) {
                badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0';
                badge.innerHTML = (window.cnxT?window.cnxT('js.s_ops.4daaa19f','<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Đang Online (Master OK)'):'<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Đang Online (Master OK)');
            } else {
                badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-white/10 whitespace-nowrap shrink-0';
                badge.innerHTML = (window.cnxT?window.cnxT('js.s_ops.d6f735d3','<span class="w-2 h-2 rounded-full bg-slate-500"></span> Offline / Đang thử lại'):'<span class="w-2 h-2 rounded-full bg-slate-500"></span> Offline / Đang thử lại');
            }
            if (meta) {
                meta.textContent = `${window.cnxT?window.cnxT('js.s_ops.e4b9ead5','Chu kỳ Poll:'):'Chu kỳ Poll:'} ${d.poll_timeout_sec || 25}s | Heartbeat: ${d.heartbeat_interval_sec || 1800}s | PING ACK: ${d.ping_count || 0} ${window.cnxT?window.cnxT('js.s_ops.c3e2563c','lần ('):'lần ('}${d.last_ping_ack_at || (window.cnxT?window.cnxT('js.s_ops.d3252307','chưa có'):'chưa có')}${window.cnxT?window.cnxT('js.s_ops.b428a5ef',') | Lần cuối nối:'):') | Lần cuối nối:'} ${d.last_seen_at || (window.cnxT?window.cnxT('js.s_ops.d3252307','chưa có'):'chưa có')}${d.last_error ? (window.cnxT?window.cnxT('js.s_ops.e10e8f69',' | Lỗi: '):' | Lỗi: ') + d.last_error : ''}`;
            }
            const geoEl = document.getElementById('wan-net-geo-meta');
            if (geoEl && d.net_geo) {
                const ng = d.net_geo;
                const hasGeo = Number(ng.geo_lat) !== 0 && Number(ng.geo_lng) !== 0;
                const mapHref = hasGeo ? `https://www.google.com/maps?q=${ng.geo_lat},${ng.geo_lng}` : '#';
                geoEl.innerHTML = `
                    <span>LAN: <b class="text-sky-300">${ng.lan_ip || '—'}</b> &bull; WAN: <b class="text-purple-300">${ng.wan_ip || '—'}</b> ${window.cnxT?window.cnxT('js.s_ops.e07800cd','&bull; Vị trí:'):'&bull; Vị trí:'} <b class="text-emerald-300">${ng.geo_label || (window.cnxT?window.cnxT('js.m_sa.8da791db','Chưa định vị'):'Chưa định vị')}</b> (${ng.geo_source === 'gps' ? 'GPS Chính xác' : (window.cnxT?window.cnxT('js.m_sa.afb7f4e5','Ước lượng IP'):'Ước lượng IP')})</span>
                    ${hasGeo ? `<a href="${mapHref}" target="_blank" rel="noopener" class="text-rose-300 hover:underline font-bold"><i class="fas fa-map-location-dot mr-1"></i>${window.cnxT?window.cnxT('js.s_ops.18c3ccde','Xem trên Google Maps'):'Xem trên Google Maps'}</a>` : ''}
                `;
            }
        } catch (e) {
            if (meta) meta.textContent = (window.cnxT?window.cnxT('js.s_ops.0089c13a','Không lấy được trạng thái kênh WAN: '):'Không lấy được trạng thái kênh WAN: ') + e.message;
        }
    },

    async pinStoreGpsLocation() {
        const saveCoords = async (lat, lng, label) => {
            const res = await fetch('api/wan_tunnel', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_location', geo_lat: lat, geo_lng: lng, geo_label: label })
            });
            const json = await res.json();
            alert(json.message || (window.cnxT?window.cnxT('js.s_ops.348671a5','Đã ghim vị trí!'):'Đã ghim vị trí!'));
            this.loadWanTunnelStatus();
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const lat = Number(pos.coords.latitude.toFixed(6));
                    const lng = Number(pos.coords.longitude.toFixed(6));
                    const label = await window.cnxPrompt(`${window.cnxT?window.cnxT('js.s_ops.2d62bf7c','Đã lấy tọa độ GPS thiết bị:'):'Đã lấy tọa độ GPS thiết bị:'} ${lat}, ${lng}${window.cnxT?window.cnxT('js.s_ops.b43ca7cf','\\nNhập tên địa chỉ hiển thị ngắn (VD: Thủ Đức, TP.HCM):'):'\\nNhập tên địa chỉ hiển thị ngắn (VD: Thủ Đức, TP.HCM):'}`, '');
                    if (label !== null) await saveCoords(lat, lng, label.trim());
                },
                async () => {
                    const input = await window.cnxPrompt((window.cnxT?window.cnxT('js.s_ops.10f0f364','Trình duyệt không cấp quyền GPS.\nHãy dán link Google Maps (có @lat,lng) hoặc nhập tọa độ (VD: 10.85063, 106.77191):'):'Trình duyệt không cấp quyền GPS.\nHãy dán link Google Maps (có @lat,lng) hoặc nhập tọa độ (VD: 10.85063, 106.77191):'), '');
                    if (!input) return;
                    const m = input.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
                    if (!m) { alert((window.cnxT?window.cnxT('js.s_ops.7378dff1','Tọa độ không hợp lệ!'):'Tọa độ không hợp lệ!')); return; }
                    const label = await window.cnxPrompt((window.cnxT?window.cnxT('js.s_ops.490aec3b','Tên địa điểm ngắn gọn:'):'Tên địa điểm ngắn gọn:'), '') || '';
                    await saveCoords(parseFloat(m[1]), parseFloat(m[2]), label.trim());
                },
                { enableHighAccuracy: true, timeout: 6000 }
            );
        }
    },

    async saveWanTunnelConfig() {
        const url = (document.getElementById('wan-master-url')?.value || '').trim();
        const fallbackUrl = (document.getElementById('wan-master-fallback-url')?.value || '').trim();
        const enabled = !!document.getElementById('wan-tunnel-enabled')?.checked;
        if (!url) {
            alert((window.cnxT?window.cnxT('js.s_ops.696934e9','Vui lòng nhập địa chỉ Master Server URL!'):'Vui lòng nhập địa chỉ Master Server URL!'));
            return;
        }
        try {
            const res = await fetch('api/wan_tunnel', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save', master_server_url: url, master_fallback_url: fallbackUrl, enabled })
            });
            const json = await res.json();
            alert(json.message || (window.cnxT?window.cnxT('js.s_ops.96608abb','Đã cập nhật cấu hình kết nối Master!'):'Đã cập nhật cấu hình kết nối Master!'));
            setTimeout(() => this.loadWanTunnelStatus(), 1200);
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.s_ops.092ada3d','Lỗi lưu cấu hình WAN: '):'Lỗi lưu cấu hình WAN: ') + e.message);
        }
    },

    // 8. OPERATIONS: KHO, CHI PHÍ VẬT LIỆU, TIỀN LƯƠNG & REALTIME STAFF
    // ========================================================
    currentOpsSubtab: 'realtime',
    materialsList: [],
    realtimeTimer: null,

    loadOperationsTab() {
        this.switchOpsSubtab(this.currentOpsSubtab || 'realtime');
        // Setup realtime poll if not already running
        if (!this.realtimeTimer) {
            this._rtPollInFlight = false;
            this.realtimeTimer = setInterval(async () => {
                if (!document.hidden && this.currentTab === 'operations' && this.currentOpsSubtab === 'realtime' && !this._rtPollInFlight) {
                    this._rtPollInFlight = true;
                    try { await this.loadRealtimeStaff(); } finally { this._rtPollInFlight = false; }
                }
            }, 8000);
        }
    },

    switchOpsSubtab(subtab) {
        this.currentOpsSubtab = subtab;

        // Update sub-tab buttons
        ['realtime', 'inventory', 'payroll', 'kpi'].forEach(s => {
            const btn = document.getElementById(`ops-subtab-${s}`);
            const view = document.getElementById(`ops-subview-${s}`);
            if (btn) {
                if (s === subtab) {
                    btn.className = 'ops-subtab-btn px-3 py-1.5 rounded-lg font-bold transition-all bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1.5';
                } else {
                    btn.className = 'ops-subtab-btn px-3 py-1.5 rounded-lg font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5';
                }
            }
            if (view) {
                if (s === subtab) {
                    view.classList.remove('hidden');
                } else {
                    view.classList.add('hidden');
                }
            }
        });

        if (subtab === 'realtime') this.loadRealtimeStaff();
        const subviewReqMod = {
            inventory: 'inventory_recipes',
            payroll: 'staff_shifts',
            kpi: 'staff_kpi'
        }[subtab];
        if (subviewReqMod && !this.isModuleAllowed(subviewReqMod)) {
            this.applySubviewLicenseLock(subtab, subviewReqMod, false);
            return;
        }
        if (subtab === 'inventory') this.loadMaterials();
        if (subtab === 'payroll') this.loadPayroll();
        if (subtab === 'kpi' && typeof this.loadKpi === 'function') this.loadKpi();
    },

    toggleKpiConfigPanel() {
        const panel = document.getElementById('kpi-config-panel');
        if (panel) panel.classList.toggle('hidden');
    },

    async askAiCopilot(presetQuestion = '') {
        const inp = document.getElementById('ai-copilot-input');
        const out = document.getElementById('ai-copilot-answer');
        const q = (presetQuestion || inp?.value || '').trim() || (window.cnxT?window.cnxT('js.s_ops.331ac8a1','Tóm tắt tình hình kinh doanh hôm nay'):'Tóm tắt tình hình kinh doanh hôm nay');
        if (inp && presetQuestion) inp.value = presetQuestion;
        if (!out) return;
        out.classList.remove('hidden');
        out.innerHTML = (window.cnxT?window.cnxT('js.s_ops.eb09d110','<i class="fas fa-spinner fa-spin mr-1.5 text-purple-300"></i> Đang phân tích dữ liệu quán...'):'<i class="fas fa-spinner fa-spin mr-1.5 text-purple-300"></i> Đang phân tích dữ liệu quán...');
        try {
            const res = await fetch('/api/ai/copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q, use_ai: true })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_ops.59e94a7c','Lỗi AI Copilot'):'Lỗi AI Copilot'));
            const meta = data.credits_charged > 0
                ? `<div class="mt-2 pt-1.5 border-t border-white/10 text-[10px] text-purple-300 font-mono">⚡ ${data.engine} ${window.cnxT?window.cnxT('js.s_ops.39c178b6','· Đã dùng'):'· Đã dùng'} ${data.credits_charged} AI Credit</div>`
                : `<div class="mt-2 pt-1.5 border-t border-white/10 text-[10px] text-emerald-300 font-mono">⚡ ${data.engine} · Miễn phí (Offline)</div>`;
            out.innerHTML = `<div>${(data.answer || '').replace(/</g, '&lt;')}</div>${meta}`;
        } catch (e) {
            out.innerHTML = `<span class="text-rose-300">${e.message || (window.cnxT?window.cnxT('js.s_ops.f39060b1','Không thể kết nối AI Copilot'):'Không thể kết nối AI Copilot')}</span>`;
        }
    },

    async testAndSaveTelegramBot() {
        const telegram_bot_token = (document.getElementById('setting-tg-token')?.value || '').trim();
        const telegram_chat_id = (document.getElementById('setting-tg-chat-id')?.value || '').trim();
        try {
            const res = await fetch('/api/telegram/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegram_bot_token, telegram_chat_id })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_ops.7e0fcb13','Lỗi gửi Telegram'):'Lỗi gửi Telegram'));
            this.showToast(data.message || (window.cnxT?window.cnxT('js.s_ops.8e6af316','Đã gửi tin nhắn thử Telegram!'):'Đã gửi tin nhắn thử Telegram!'), 'success');
        } catch (e) {
            alert(e.message || (window.cnxT?window.cnxT('js.s_ops.fea26a80','Lỗi cấu hình Telegram Bot'):'Lỗi cấu hình Telegram Bot'));
        }
    },

    async loadRouterDevices() {
        try {
            const [cfgRes, devRes] = await Promise.all([
                fetch('/api/network/config').then(r => r.json()).catch(() => ({})),
                fetch('/api/network/devices').then(r => r.json()).catch(() => ({}))
            ]);
            if (cfgRes && cfgRes.config) {
                const c = cfgRes.config;
                if (document.getElementById('rq-type')) document.getElementById('rq-type').value = c.router_type || 'simulation';
                if (document.getElementById('rq-host')) document.getElementById('rq-host').value = c.host || '';
                if (document.getElementById('rq-port')) document.getElementById('rq-port').value = c.port || 22;
                if (document.getElementById('rq-user')) document.getElementById('rq-user').value = c.username || '';
                if (document.getElementById('rq-pass')) {
                    document.getElementById('rq-pass').value = (c.password === '********') ? '********' : '';
                    if (c.password === '********') document.getElementById('rq-pass').placeholder = 'Đã lưu mật khẩu (nhập mới để đổi)';
                }
                if (document.getElementById('rq-free-min')) document.getElementById('rq-free-min').value = c.free_minutes ?? 10;
                if (document.getElementById('rq-vip-min')) document.getElementById('rq-vip-min').value = c.vip_minutes ?? 180;
                if (document.getElementById('rq-max-dev')) document.getElementById('rq-max-dev').value = c.max_devices_per_order ?? 2;
                if (document.getElementById('rq-peak-windows')) document.getElementById('rq-peak-windows').value = c.peak_windows !== undefined ? c.peak_windows : '08:00-11:30, 18:30-22:00';
                if (document.getElementById('rq-throttle70')) document.getElementById('rq-throttle70').checked = c.throttle_after_70_pct !== false;
                const defaultHostIp = (window.location.hostname && window.location.hostname !== 'localhost') ? window.location.hostname : '';
                if (document.getElementById('rq-pos-ip')) document.getElementById('rq-pos-ip').value = c.pos_server_ip || defaultHostIp;
                if (document.getElementById('rq-pos-port')) document.getElementById('rq-pos-port').value = c.pos_server_port || Number(window.location.port || 8501);
                if (document.getElementById('rq-guest-ssid')) document.getElementById('rq-guest-ssid').value = c.guest_ssid_name || '';
                if (document.getElementById('rq-guest-iso')) document.getElementById('rq-guest-iso').checked = !!c.guest_isolation_enabled;
                if (document.getElementById('rq-admin-guard')) document.getElementById('rq-admin-guard').checked = !!c.admin_ip_guard_enabled;
                const qosSimBadge = document.getElementById('qos-sim-mode-badge');
                if (qosSimBadge) {
                    const isSim = (c.router_type || 'simulation') === 'simulation';
                    qosSimBadge.classList.toggle('hidden', !isSim);
                }
            }
            const fmtRem = (sec) => {
                if (!sec || sec <= 0) return '';
                const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
                return (window.cnxT?window.cnxT('js.s_ops.8072692e',' • còn '):' • còn ') + (h > 0 ? `${h}g ` : '') + `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            };
            const listEl = document.getElementById('router-qos-devices-list');
            if (listEl && devRes && Array.isArray(devRes.devices)) {
                if (devRes.devices.length === 0) {
                    const notice = devRes.message || (window.cnxT?window.cnxT('js.s_ops.f49d0039','Chưa phát hiện thiết bị LAN nào từ Router.'):'Chưa phát hiện thiết bị LAN nào từ Router.');
                    listEl.innerHTML = `<div class="p-2.5 rounded-lg bg-slate-900/60 border border-white/10 text-[11px] text-slate-400">${escapeHtml(notice)}</div>`;
                } else {
                    listEl.innerHTML = devRes.devices.map(d => {
                        const tier = d.tier || d.qos || 'free';
                        const remTxt = fmtRem(Number(d.remaining_sec || 0));
                        const stageTxt = Number(d.stage) === 2 ? ' (Giảm >90%)' : (Number(d.stage) === 1 ? ' (Giảm >70%)' : '');
                        const qBadge = d.whitelisted || tier === 'whitelist'
                            ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">Nội bộ ∞</span>'
                            : (tier === 'vip' || tier === 'vip_high_speed'
                                ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">VIP${escapeHtml(remTxt)}${escapeHtml(stageTxt)}</span>`
                                : (tier === 'blocked'
                                    ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">Đã ngắt</span>'
                                    : `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-bold">Free${escapeHtml(remTxt)}</span>`));
                        return `
                    <div class="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/70 border border-white/10 text-[11px]">
                        <div>
                            <b class="text-white">${escapeHtml(d.name || (window.cnxT?window.cnxT('js.s_ops.a526a58e','Thiết bị'):'Thiết bị'))}</b>
                            <span class="font-mono text-sky-300 ml-1.5">${escapeHtml(d.ip)}</span>
                            <span class="font-mono text-slate-400 ml-1">(${escapeHtml(d.mac || '')})</span>
                            ${qBadge}
                        </div>
                        <div class="flex items-center gap-1.5">
                            ${tier === 'blocked'
                                ? `<button type="button" onclick="Admin.setDeviceQos('${escapeJsAttr(d.ip)}', 'unblock', '${escapeJsAttr(d.mac || '')}')" class="px-2.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold" title="Gỡ Ban MAC cho thiết bị này kết nối lại WiFi">Mở chặn</button>`
                                : `<button type="button" onclick="Admin.toggleDeviceWhitelist('${escapeJsAttr(d.ip)}', '${escapeJsAttr(d.mac || '')}')" class="px-2 py-0.5 rounded ${d.whitelisted ? 'bg-sky-500 text-slate-950' : 'bg-sky-500/20 hover:bg-sky-500/35 text-sky-300'} font-bold" title="Ghim thiết bị nội bộ không giới hạn thời gian">${window.cnxT?window.cnxT('js.s_ops.387fa90a','Nội bộ ∞'):'Nội bộ ∞'}</button>
                                   <button type="button" onclick="Admin.setDeviceQos('${escapeJsAttr(d.ip)}', 'vip_high_speed', '${escapeJsAttr(d.mac || '')}')" class="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 font-bold" title="Cấp nhanh gói WiFi VIP tốc độ cao">${(tier === 'vip' || tier === 'vip_high_speed') ? 'Gia hạn VIP' : 'Cấp VIP'}</button>
                                   <button type="button" onclick="Admin.setDeviceQos('${escapeJsAttr(d.ip)}', 'kick', '${escapeJsAttr(d.mac || '')}')" class="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 font-bold" title="Đá rớt / hạ phiên mềm (không Ban cứng, khách vẫn nối lại được)">${window.cnxT?window.cnxT('js.s_ops.9313a4b9','Ngắt'):'Ngắt'}</button>
                                   <button type="button" onclick="if(confirm('Chặn (Ban) vĩnh viễn thiết bị ${escapeJsAttr(d.mac || d.ip)} khỏi WiFi quán?')) Admin.setDeviceQos('${escapeJsAttr(d.ip)}', 'ban', '${escapeJsAttr(d.mac || '')}')" class="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 font-bold" title="Chặn (Ban cứng MAC) — có thể Mở chặn lại bất cứ lúc nào">Chặn</button>`}
                        </div>
                    </div>`;
                    }).join('');
                }
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin.js', e) : console.debug('admin.js', e)); }
    },

    async testRouterQosConnection() {
        const resEl = document.getElementById('router-qos-test-result');
        const payload = {
            router_type: document.getElementById('rq-type')?.value || 'simulation',
            host: (document.getElementById('rq-host')?.value || '').trim(),
            port: Number(document.getElementById('rq-port')?.value || 22),
            username: (document.getElementById('rq-user')?.value || '').trim(),
            password: document.getElementById('rq-pass')?.value || ''
        };
        if (resEl) {
            resEl.classList.remove('hidden');
            resEl.className = 'text-[11px] font-mono p-2 rounded-lg bg-slate-950/90 border border-sky-500/30 text-sky-300';
            resEl.innerHTML = (window.cnxT?window.cnxT('js.s_ops.2f22c27e','<i class="fas fa-spinner fa-spin mr-1.5"></i>Đang kiểm tra kết nối tới Router...'):'<i class="fas fa-spinner fa-spin mr-1.5"></i>Đang kiểm tra kết nối tới Router...');
        }
        try {
            const res = await fetch('/api/network/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const rawText = await res.text();
            let data = {};
            try { data = JSON.parse(rawText); } catch (_) {
                data = {
                    status: 'error',
                    message: res.status === 404
                        ? 'Module WiFi/Router QoS (libmod_network_qos.dll) chưa được nạp trên máy chủ quán (HTTP 404).'
                        : `Máy chủ trả lỗi HTTP ${res.status}: ${rawText.slice(0, 140)}`
                };
            }
            const msg = data.message || (window.cnxT?window.cnxT('js.s_ops.a09faf13','Đã kiểm tra xong'):'Đã kiểm tra xong');
            if (resEl) {
                if (data.status === 'success') {
                    resEl.className = 'text-[11px] font-mono p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300';
                    resEl.innerHTML = `<i class="fas fa-circle-check mr-1.5"></i>${escapeHtml(msg)}`;
                } else if (data.status === 'warning') {
                    resEl.className = 'text-[11px] font-mono p-2 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300';
                    resEl.innerHTML = `<i class="fas fa-triangle-exclamation mr-1.5"></i>${escapeHtml(msg)}`;
                } else {
                    resEl.className = 'text-[11px] font-mono p-2 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300';
                    resEl.innerHTML = `<i class="fas fa-circle-xmark mr-1.5"></i>${escapeHtml(msg)}`;
                }
            }
            if (typeof this.showToast === 'function') {
                this.showToast(msg, data.status === 'success' ? 'success' : (data.status === 'warning' ? 'warning' : 'error'));
            }
        } catch (e) {
            const errTxt = (window.cnxT?window.cnxT('js.s_ops.121c2fe8','Lỗi kiểm tra kết nối Router: '):'Lỗi kiểm tra kết nối Router: ') + (e && e.message ? e.message : e);
            if (resEl) {
                resEl.className = 'text-[11px] font-mono p-2 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300';
                resEl.innerHTML = `<i class="fas fa-circle-xmark mr-1.5"></i>${escapeHtml(errTxt)}`;
            }
        }
    },

    async saveRouterQosConfig() {
        try {
            const payload = {
                router_type: document.getElementById('rq-type')?.value || 'simulation',
                host: (document.getElementById('rq-host')?.value || '').trim(),
                port: Number(document.getElementById('rq-port')?.value || 22),
                username: (document.getElementById('rq-user')?.value || '').trim(),
                password: document.getElementById('rq-pass')?.value || '',
                free_minutes: Math.max(1, Number(document.getElementById('rq-free-min')?.value || 10)),
                vip_minutes: Math.max(5, Number(document.getElementById('rq-vip-min')?.value || 180)),
                max_devices_per_order: Math.max(1, Number(document.getElementById('rq-max-dev')?.value || 2)),
                peak_windows: (document.getElementById('rq-peak-windows')?.value || '').trim(),
                throttle_after_70_pct: !!document.getElementById('rq-throttle70')?.checked
            };
            const res = await fetch('/api/network/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const rawText = await res.text();
            let data = {};
            try { data = JSON.parse(rawText); } catch (_) {
                data = {
                    status: 'error',
                    message: res.status === 404
                        ? 'Module WiFi/Router QoS (libmod_network_qos.dll) chưa được nạp hoặc bị chặn bản quyền (HTTP 404).'
                        : `Lỗi lưu cấu hình Router (HTTP ${res.status}): ${rawText.slice(0, 120)}`
                };
            }
            if (res.ok && data.status === 'success') {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_ops.1fb4a397','Đã lưu cấu hình WiFi Marketing!'):'Đã lưu cấu hình WiFi Marketing!'), 'success');
                this.loadRouterDevices();
            } else {
                const errMsg = data.message || `Lỗi lưu cấu hình Router (HTTP ${res.status})`;
                if (typeof this.showToast === 'function') this.showToast(errMsg, 'error');
                else alert(errMsg);
            }
        } catch (e) {
            const errMsg = (window.cnxT?window.cnxT('js.s_ops.30041d77','Lỗi lưu cấu hình Router'):'Lỗi lưu cấu hình Router') + (e && e.message ? ': ' + e.message : '');
            if (typeof this.showToast === 'function') this.showToast(errMsg, 'error');
            else alert(errMsg);
        }
    },

    async applyGuestLanIsolation() {
        const resEl = document.getElementById('router-iso-result');
        const payload = {
            guest_isolation_enabled: !!document.getElementById('rq-guest-iso')?.checked,
            pos_server_ip: (document.getElementById('rq-pos-ip')?.value || '').trim(),
            pos_server_port: Number(document.getElementById('rq-pos-port')?.value || 8501),
            guest_ssid_name: (document.getElementById('rq-guest-ssid')?.value || '').trim(),
            admin_ip_guard_enabled: !!document.getElementById('rq-admin-guard')?.checked
        };
        if (payload.admin_ip_guard_enabled && !confirm('Lưu ý: Khi bật Khóa cổng Admin Lớp 3, chỉ máy chủ (127.0.0.1) và các thiết bị đã ghim "Nội bộ ∞" mới mở được trang Admin/POS. Bạn đã ghim điện thoại chủ quán vào "Nội bộ ∞" chưa?')) {
            return;
        }
        if (resEl) {
            resEl.classList.remove('hidden');
            resEl.className = 'text-[11px] font-mono p-2 rounded-lg bg-slate-900 border border-sky-500/30 text-sky-300';
            resEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i>Đang áp dụng chính sách Cô Lập Mạng Khách lên Router...';
        }
        try {
            const res = await fetch('/api/network/isolation/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            const ok = res.ok && data.status === 'success';
            const msg = data.message || (ok ? 'Đã áp dụng Cô Lập Mạng Khách thành công!' : `Lỗi áp dụng (HTTP ${res.status})`);
            if (resEl) {
                resEl.className = ok
                    ? 'text-[11px] font-mono p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                    : 'text-[11px] font-mono p-2 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300';
                resEl.innerHTML = `<i class="fas ${ok ? 'fa-shield-check' : 'fa-circle-xmark'} mr-1.5"></i>${escapeHtml(msg)}`;
            }
            if (typeof this.showToast === 'function') this.showToast(msg, ok ? 'success' : 'error');
        } catch (e) {
            const errMsg = 'Lỗi kết nối khi áp dụng Cô Lập Mạng: ' + (e.message || e);
            if (resEl) {
                resEl.className = 'text-[11px] font-mono p-2 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300';
                resEl.textContent = errMsg;
            }
            if (typeof this.showToast === 'function') this.showToast(errMsg, 'error');
        }
    },

    async toggleDeviceWhitelist(ip, mac = '') {
        try {
            const res = await fetch('/api/network/whitelist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip, mac })
            });
            const data = await res.json().catch(() => ({}));
            this.showToast(data.message || (window.cnxT?window.cnxT('js.s_ops.9e52f2e4','Đã cập nhật Whitelist'):'Đã cập nhật Whitelist'), (res.ok && data.status === 'success') ? 'success' : 'error');
            this.loadRouterDevices();
        } catch (e) { this.showToast((window.cnxT?window.cnxT('js.s_ops.8a196ac6','Lỗi cập nhật Whitelist'):'Lỗi cập nhật Whitelist'), 'error'); }
    },

    async exportWifiLeadsCsv() {
        try {
            const token = localStorage.getItem('pos_token') || '';
            const res = await fetch('/api/wifi/leads', {
                headers: token ? { 'Authorization': 'Bearer ' + token } : {}
            });
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
                alert((window.cnxT?window.cnxT('js.s_ops.fe153421','Chưa có dữ liệu khách WiFi Marketing để xuất.'):'Chưa có dữ liệu khách WiFi Marketing để xuất.'));
                return;
            }
            const rows = [['ID', 'Ten Khach', 'SDT', 'IP', 'Loai', 'Ma Hoa Don', 'Thoi Gian']];
            json.data.forEach(r => rows.push([r.id, r.customer_name || '', r.phone || '', r.client_ip || '', r.unlock_type || '', r.order_code || '', r.created_at || '']));
            const csv = '\uFEFF' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `wifi_leads_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
        } catch (e) { alert((window.cnxT?window.cnxT('js.s_ops.df8d07c4','Không thể xuất CSV Leads'):'Không thể xuất CSV Leads')); }
    },

    async setDeviceQos(ip, qos, mac = '') {
        try {
            const res = await fetch('/api/network/qos/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip, mac, qos })
            });
            const data = await res.json().catch(() => ({}));
            const ok = res.ok && data.status === 'success';
            this.showToast(data.message || (ok ? `Đã cập nhật ${qos} cho ${ip}` : `Lỗi cập nhật QoS (HTTP ${res.status})`), ok ? 'success' : 'error');
            this.loadRouterDevices();
        } catch (e) { this.showToast((window.cnxT?window.cnxT('js.s_ops.4549106c','Lỗi cập nhật QoS'):'Lỗi cập nhật QoS') + ': ' + (e.message || e), 'error'); }
    },

    openBillingModal() {
        const m = document.getElementById('modal-store-billing');
        if (m) m.classList.remove('hidden');
        document.getElementById('billing-qr-result')?.classList.add('hidden');
        this.onBillingTypeChange();
    },

    closeBillingModal() {
        if (this._billingPollTimer) {
            clearInterval(this._billingPollTimer);
            this._billingPollTimer = null;
        }
        document.getElementById('modal-store-billing')?.classList.add('hidden');
    },

    onBillingTypeChange() {
        const t = document.getElementById('billing-type-select')?.value || 'renew_plan';
        const q = document.getElementById('billing-qty-select');
        if (!q) return;
        q.innerHTML = t === 'buy_ai_credits'
            ? `<option value="100">${window.cnxT?window.cnxT('js.s_ops.7b418b4e','+100 Credits (100.000đ)'):'+100 Credits (100.000đ)'}</option>
               <option value="300">${window.cnxT?window.cnxT('js.s_ops.bbf0b9c0','+300 Credits (300.000đ)'):'+300 Credits (300.000đ)'}</option>
               <option value="500">${window.cnxT?window.cnxT('js.s_ops.bfbfdac4','+500 Credits (450.000đ)'):'+500 Credits (450.000đ)'}</option>
               <option value="1000">${window.cnxT?window.cnxT('js.s_ops.f86197fb','+1.000 Credits (800.000đ)'):'+1.000 Credits (800.000đ)'}</option>`
            : `<option value="1">${window.cnxT?window.cnxT('js.s_ops.af156314','1 Tháng (299.000đ)'):'1 Tháng (299.000đ)'}</option>
               <option value="3">${window.cnxT?window.cnxT('js.s_ops.fef12ebb','3 Tháng (897.000đ)'):'3 Tháng (897.000đ)'}</option>
               <option value="6">${window.cnxT?window.cnxT('js.s_ops.4a6bfbb2','6 Tháng - Giảm 10% (1.614.600đ)'):'6 Tháng - Giảm 10% (1.614.600đ)'}</option>
               <option value="12">${window.cnxT?window.cnxT('js.s_ops.d3884a72','12 Tháng - Giảm 15% (3.049.800đ)'):'12 Tháng - Giảm 15% (3.049.800đ)'}</option>`;
    },

    async createStoreBillingOrder() {
        const billing_type = document.getElementById('billing-type-select')?.value || 'renew_plan';
        const quantity = Number(document.getElementById('billing-qty-select')?.value || 1);
        try {
            const res = await fetch('api/license_client?action=create_billing_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ billing_type, quantity })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_ops.cd497d7e','Không tạo được mã thanh toán'):'Không tạo được mã thanh toán'));
            document.getElementById('billing-qr-img').src = data.vietqr_url;
            document.getElementById('billing-qr-amount').textContent = this.formatMoney(data.amount_vnd) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            document.getElementById('billing-qr-note').textContent = data.bank_info?.note || data.order_code;
            const stEl = document.getElementById('billing-qr-status');
            if (stEl) {
                stEl.textContent = `${window.cnxT?window.cnxT('js.s_ops.09f4c0c5','⏳ Đang chờ xác nhận thanh toán ('):'⏳ Đang chờ xác nhận thanh toán ('}${data.order_code})...`;
                stEl.className = 'text-xs font-bold text-sky-300 p-2 rounded-lg bg-sky-500/10 border border-sky-500/30';
            }
            document.getElementById('billing-qr-result')?.classList.remove('hidden');
            if (this._billingPollTimer) clearInterval(this._billingPollTimer);
            this._billingPollInFlight = false;
            this._billingPollTimer = setInterval(async () => {
                if (this._billingPollInFlight) return;
                this._billingPollInFlight = true;
                try { await this.pollStoreBillingOrder(data.order_code); } finally { this._billingPollInFlight = false; }
            }, 3500);
        } catch (e) {
            alert(e.message || (window.cnxT?window.cnxT('js.s_ops.8ee77ea9','Lỗi tạo đơn VietQR'):'Lỗi tạo đơn VietQR'));
        }
    },

    async pollStoreBillingOrder(orderCode) {
        if (!orderCode) return;
        try {
            const res = await fetch(`api/license_client?action=check_billing_order&order_code=${encodeURIComponent(orderCode)}`);
            const data = await res.json();
            if (data.success && data.order && data.order.status === 'paid') {
                clearInterval(this._billingPollTimer);
                this._billingPollTimer = null;
                const stEl = document.getElementById('billing-qr-status');
                if (stEl) {
                    stEl.textContent = (window.cnxT?window.cnxT('js.s_ops.74a84d0a','✅ Thanh toán thành công! Đã tự động gia hạn / cộng AI Credit.'):'✅ Thanh toán thành công! Đã tự động gia hạn / cộng AI Credit.');
                    stEl.className = 'text-xs font-bold text-emerald-300 p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30';
                }
                if (typeof this.loadSettings === 'function') this.loadSettings();
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin.js', e) : console.debug('admin.js', e)); }
    },

    async loadKpi() {
        const monthInput = document.getElementById('kpi-month-input');
        if (monthInput && !monthInput.value) {
            const d = new Date();
            monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        const month = monthInput ? monthInput.value : '';
        try {
            const res = await fetch(`api/operations.php?action=get_kpi_dashboard&month=${encodeURIComponent(month)}`);
            const data = await res.json();
            if (!data.success) return;

            const activeSla = data.active_sla || {};
            const slaBadge = document.getElementById('kpi-active-sla-badge');
            if (slaBadge) {
                slaBadge.innerHTML = `<i class="fas fa-clock mr-1"></i> ${activeSla.label || (window.cnxT?window.cnxT('js.s_ops.ed15a935','Mặc định'):'Mặc định')}: Bếp <b>${activeSla.kitchen_sla_minutes || 10}p</b> · PV <b>${activeSla.waiter_sla_minutes || 3}p</b>`;
                slaBadge.className = activeSla.is_peak
                    ? 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30';
            }

            const revSum = data.review_summary || {};
            const avgBadge = document.getElementById('kpi-avg-rating-badge');
            if (avgBadge) {
                avgBadge.innerHTML = `⭐ ${Number(revSum.avg_rating || 0).toFixed(1)} / 5 (${revSum.total_reviews || 0} ${window.cnxT?window.cnxT('js.s_ops.1eed058a','đánh giá)'):'đánh giá)'}`;
            }

            const s = data.settings || {};
            const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
            setVal('cfg-default-kitchen-sla', s.default_kitchen_sla ?? 10);
            setVal('cfg-default-waiter-sla', s.default_waiter_sla ?? 3);
            setVal('cfg-kpi-base', s.kpi_base_score ?? 100);
            setVal('cfg-kitchen-ontime', s.kpi_kitchen_ontime_pts ?? 2);
            setVal('cfg-kitchen-rush-pen', s.kpi_kitchen_rush_penalty ?? 5);
            setVal('cfg-waiter-ontime', s.kpi_waiter_ontime_pts ?? 2);
            setVal('cfg-waiter-remind-pen', s.kpi_waiter_remind_penalty ?? 3);
            setVal('cfg-star-5', s.kpi_star_5_pts ?? 5);
            setVal('cfg-star-4', s.kpi_star_4_pts ?? 2);
            setVal('cfg-star-3', s.kpi_star_3_pts ?? 0);
            setVal('cfg-star-2', s.kpi_star_2_pts ?? -3);
            setVal('cfg-star-1', s.kpi_star_1_pts ?? -5);

            const rulesNote = document.getElementById('kpi-rules-note');
            if (rulesNote) {
                rulesNote.innerHTML = `Quy tắc hiện tại: Nền <b>${s.kpi_base_score ?? 100}đ</b> ${window.cnxT?window.cnxT('js.s_ops.0fe03e14','· Bếp đúng hạn'):'· Bếp đúng hạn'} <b class="text-emerald-300">+${s.kpi_kitchen_ontime_pts ?? 2}</b> ${window.cnxT?window.cnxT('js.s_ops.cc8fed6e','· Bị hối'):'· Bị hối'} <b class="text-rose-300">-${s.kpi_kitchen_rush_penalty ?? 5}</b> ${window.cnxT?window.cnxT('js.s_ops.27c269fb','· PV đúng hạn'):'· PV đúng hạn'} <b class="text-emerald-300">+${s.kpi_waiter_ontime_pts ?? 2}</b> ${window.cnxT?window.cnxT('js.s_ops.0bf05f35','· Bị Báo lại'):'· Bị Báo lại'} <b class="text-rose-300">-${s.kpi_waiter_remind_penalty ?? 3}</b> ${window.cnxT?window.cnxT('js.s_ops.0b4b133a','· Khách đánh giá 5⭐'):'· Khách đánh giá 5⭐'} <b class="text-amber-300">+${s.kpi_star_5_pts ?? 5}</b> / 1⭐ <b class="text-rose-300">${s.kpi_star_1_pts ?? -5}</b>.`;
            }

            // Render SLA Time Slots
            const slotsEl = document.getElementById('kpi-sla-slots-list');
            if (slotsEl) {
                const slots = data.sla_slots || [];
                slotsEl.innerHTML = slots.length === 0
                    ? '<div class="text-[11px] text-slate-500 italic">Chưa có khung giờ riêng (đang dùng mặc định thấp điểm).</div>'
                    : slots.map(sl => `
                        <div class="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/70 border border-white/10 text-xs">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${sl.slot_type === 'peak' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'}">${sl.slot_type === 'peak' ? 'Cao điểm' : (window.cnxT?window.cnxT('ui.admin_html.option_1bb55c8a','Thấp điểm'):'Thấp điểm')}</span>
                                <b class="text-white">${escapeHtml(sl.name)}</b>
                                <span class="font-mono text-amber-300">${escapeHtml(sl.start_time)} - ${escapeHtml(sl.end_time)}</span>
                                <span class="text-slate-400">${window.cnxT?window.cnxT('js.s_ops.ed71c54e','Bếp:'):'Bếp:'} <b class="text-white">${Number(sl.kitchen_sla_minutes)}p</b> · PV: <b class="text-white">${Number(sl.waiter_sla_minutes)}p</b></span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" onclick="Admin.toggleSlaSlot(${Number(sl.id)}, '${escapeJsAttr(sl.name)}', '${escapeJsAttr(sl.slot_type)}', '${escapeJsAttr(sl.start_time)}', '${escapeJsAttr(sl.end_time)}', ${Number(sl.kitchen_sla_minutes)}, ${Number(sl.waiter_sla_minutes)}, ${sl.is_active ? 0 : 1})" class="px-2 py-0.5 rounded text-[10px] font-bold ${sl.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}">${sl.is_active ? 'Đang bật' : (window.cnxT?window.cnxT('js.s_ops.5a3f0b40','Đang tắt'):'Đang tắt')}</button>
                                <button type="button" onclick="Admin.deleteSlaSlot(${sl.id})" class="text-rose-400 hover:text-rose-300 px-1.5 py-0.5" title="Xóa khung giờ"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('');
            }

            // Render Staff KPI Table
            const tbody = document.getElementById('kpi-tbody');
            if (tbody) {
                const staff = data.staff_kpi || [];
                const roleLabel = { admin: (window.cnxT?window.cnxT('js.s_ops.29d2b4bd','Chủ quán'):'Chủ quán'), cashier: (window.cnxT?window.cnxT('ui.ord_html.b_6951ffd8','Thu ngân'):'Thu ngân'), waiter: (window.cnxT?window.cnxT('ui.ord_html.b_c7307f33','Phục vụ'):'Phục vụ'), kitchen: (window.cnxT?window.cnxT('js.s_ops.d03ddd8e','Bếp / Pha chế'):'Bếp / Pha chế') };
                tbody.innerHTML = staff.map(st => {
                    const delta = Number(st.delta_points || 0);
                    const score = Number(st.kpi_score || 100);
                    const penCount = Number(st.rushed_count || 0) + Number(st.reminded_count || 0);
                    return `
                        <tr class="hover:bg-white/5">
                            <td class="py-2.5 px-3 font-bold text-white">${st.fullname} <span class="text-[10px] text-slate-400 font-normal">(@${st.username})</span></td>
                            <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">${roleLabel[st.role] || st.role}</span></td>
                            <td class="py-2.5 px-3 text-center font-mono text-sky-300">${st.orders_count || 0}</td>
                            <td class="py-2.5 px-3 text-center font-mono text-emerald-400 font-bold">${st.ontime_count || 0}</td>
                            <td class="py-2.5 px-3 text-center font-mono ${penCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}">${penCount}</td>
                            <td class="py-2.5 px-3 text-center font-mono text-amber-300">${st.review_count || 0}</td>
                            <td class="py-2.5 px-3 text-center font-mono font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${delta >= 0 ? '+' + delta : delta}</td>
                            <td class="py-2.5 px-3 text-right font-mono font-black text-sm ${score >= 100 ? 'text-emerald-400' : (score >= 80 ? 'text-amber-300' : 'text-rose-400')}">${score}</td>
                        </tr>
                    `;
                }).join('') || (window.cnxT?window.cnxT('js.s_ops.6696e1cb','<tr><td colspan="8" class="py-6 text-center text-slate-500">Chưa có dữ liệu nhân viên</td></tr>'):'<tr><td colspan="8" class="py-6 text-center text-slate-500">Chưa có dữ liệu nhân viên</td></tr>');
            }

            // Render KPI Logs
            const logsEl = document.getElementById('kpi-logs-tbody');
            if (logsEl) {
                const logs = data.recent_logs || [];
                logsEl.innerHTML = logs.length === 0
                    ? '<tr><td colspan="4" class="py-4 text-center text-slate-500">Chưa có biến động KPI trong kỳ này.</td></tr>'
                    : logs.map(l => {
                        const d = Number(l.points_delta || 0);
                        return `
                            <tr class="hover:bg-white/5">
                                <td class="py-1.5 px-2 font-semibold text-white">${l.user_name || (window.cnxT?window.cnxT('js.s_adm.fad65698','Hệ thống'):'Hệ thống')}</td>
                                <td class="py-1.5 px-2 text-slate-300">${l.note || l.event_type} <span class="font-mono text-[10px] text-sky-400">${l.order_code || ''}</span></td>
                                <td class="py-1.5 px-2 text-right font-mono font-bold ${d >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${d >= 0 ? '+' + d : d}</td>
                                <td class="py-1.5 px-2 text-right font-mono text-slate-400">${(l.created_at || '').substring(11, 16)}</td>
                            </tr>
                        `;
                    }).join('');
            }

            // Render Customer Reviews
            const revEl = document.getElementById('kpi-reviews-list');
            if (revEl) {
                const revs = data.recent_reviews || [];
                revEl.innerHTML = revs.length === 0
                    ? '<div class="py-4 text-center text-xs text-slate-500">Chưa có đánh giá sao từ khách hàng trong kỳ này.</div>'
                    : revs.map(r => `
                        <div class="p-2.5 rounded-lg bg-slate-900/70 border border-white/10 text-xs space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="text-amber-400 font-bold">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                                <span class="text-[10px] font-mono text-slate-400">${r.table_code || ''} • ${r.order_code || ''} • ${(r.created_at || '').substring(0, 16)}</span>
                            </div>
                            ${r.comment ? `<div class="text-slate-300 italic">"${r.comment}"</div>` : (window.cnxT?window.cnxT('js.s_ops.3bde4bad','<div class="text-[10px] text-slate-500">Không có nhận xét thêm</div>'):'<div class="text-[10px] text-slate-500">Không có nhận xét thêm</div>')}
                        </div>
                    `).join('');
            }
        } catch (err) {
            console.error('loadKpi error:', err);
        }
    },

    async saveKpiSlaSettings() {
        const g = (id, def) => Number(document.getElementById(id)?.value ?? def);
        try {
            const res = await fetch('api/operations.php?action=save_kpi_sla_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    default_kitchen_sla: g('cfg-default-kitchen-sla', 10),
                    default_waiter_sla: g('cfg-default-waiter-sla', 3),
                    kpi_base_score: g('cfg-kpi-base', 100),
                    kpi_kitchen_ontime_pts: g('cfg-kitchen-ontime', 2),
                    kpi_kitchen_rush_penalty: g('cfg-kitchen-rush-pen', 5),
                    kpi_waiter_ontime_pts: g('cfg-waiter-ontime', 2),
                    kpi_waiter_remind_penalty: g('cfg-waiter-remind-pen', 3),
                    kpi_star_5_pts: g('cfg-star-5', 5),
                    kpi_star_4_pts: g('cfg-star-4', 2),
                    kpi_star_3_pts: g('cfg-star-3', 0),
                    kpi_star_2_pts: g('cfg-star-2', -3),
                    kpi_star_1_pts: g('cfg-star-1', -5)
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_ops.ed945903','Lỗi lưu cấu hình'):'Lỗi lưu cấu hình'));
            this.showToast(data.message || (window.cnxT?window.cnxT('js.s_ops.739b89ff','Đã lưu cấu hình KPI & SLA!'):'Đã lưu cấu hình KPI & SLA!'), 'success');
            this.loadKpi();
        } catch (e) {
            alert(e.message || (window.cnxT?window.cnxT('js.s_ops.de622df0','Lỗi lưu cấu hình KPI'):'Lỗi lưu cấu hình KPI'));
        }
    },

    async addSlaSlot() {
        const name = (document.getElementById('sla-slot-name')?.value || '').trim();
        const slot_type = document.getElementById('sla-slot-type')?.value || 'peak';
        const start_time = document.getElementById('sla-slot-start')?.value || '';
        const end_time = document.getElementById('sla-slot-end')?.value || '';
        const kitchen_sla_minutes = Number(document.getElementById('sla-slot-kitchen')?.value || 15);
        const waiter_sla_minutes = Number(document.getElementById('sla-slot-waiter')?.value || 5);
        if (!name || !start_time || !end_time) {
            alert((window.cnxT?window.cnxT('js.s_ops.172efb2a','Vui lòng nhập Tên khung giờ, Giờ bắt đầu và Giờ kết thúc!'):'Vui lòng nhập Tên khung giờ, Giờ bắt đầu và Giờ kết thúc!'));
            return;
        }
        try {
            const res = await fetch('api/operations.php?action=save_sla_slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active: 1 })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_ops.335e2fc3','Lỗi thêm khung giờ'):'Lỗi thêm khung giờ'));
            document.getElementById('sla-slot-name').value = '';
            this.showToast((window.cnxT?window.cnxT('js.s_ops.da2a8bcb','Đã thêm khung giờ SLA!'):'Đã thêm khung giờ SLA!'), 'success');
            this.loadKpi();
        } catch (e) {
            alert(e.message || (window.cnxT?window.cnxT('js.s_ops.335e2fc3','Lỗi thêm khung giờ'):'Lỗi thêm khung giờ'));
        }
    },

    async toggleSlaSlot(id, name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active) {
        try {
            const res = await fetch('api/operations.php?action=save_sla_slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, slot_type, start_time, end_time, kitchen_sla_minutes, waiter_sla_minutes, is_active })
            });
            const data = await res.json();
            if (data.success) this.loadKpi();
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin.js', e) : console.debug('admin.js', e)); }
    },

    async deleteSlaSlot(id) {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_ops.685ec780','Xóa khung giờ SLA này?'):'Xóa khung giờ SLA này?')))) return;
        try {
            const res = await fetch('api/operations.php?action=delete_sla_slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) this.loadKpi();
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin.js', e) : console.debug('admin.js', e)); }
    },

    // 8.1 Realtime Staff
    async loadRealtimeStaff() {
        try {
            const res = await fetch('api/operations.php?action=get_realtime_staff');
            const data = await res.json();
            if (!data.success) return;

            // Server time
            const clockEl = document.getElementById('realtime-server-clock');
            if (clockEl) clockEl.innerText = data.server_time || '';

            // Summary counts
            const summary = data.summary || {};
            const cashierEl = document.getElementById('realtime-stat-cashier');
            const kitchenEl = document.getElementById('realtime-stat-kitchen');
            const waiterEl = document.getElementById('realtime-stat-waiter');
            const adminEl = document.getElementById('realtime-stat-admin');
            const badgeCountEl = document.getElementById('badge-online-count');

            if (cashierEl) cashierEl.innerText = summary.cashier || 0;
            if (kitchenEl) kitchenEl.innerText = summary.kitchen || 0;
            if (waiterEl) waiterEl.innerText = summary.waiter || 0;
            if (adminEl) adminEl.innerText = summary.admin || 0;
            if (badgeCountEl) badgeCountEl.innerText = summary.total_working || 0;

            const tbody = document.getElementById('realtime-staff-tbody');
            if (!tbody) return;

            if (!data.staff_list || data.staff_list.length === 0) {
                tbody.innerHTML = this.renderEmptyState(7, 'fa-id-badge', (window.cnxT?window.cnxT('js.s_ops.721759fb','Chưa có nhân viên trong ca làm việc'):'Chưa có nhân viên trong ca làm việc'), (window.cnxT?window.cnxT('js.s_ops.718da240','Khi nhân viên đăng nhập trên máy POS, Order hoặc Bếp, hệ thống sẽ tự động chấm công và hiển thị tại đây.'):'Khi nhân viên đăng nhập trên máy POS, Order hoặc Bếp, hệ thống sẽ tự động chấm công và hiển thị tại đây.'));
                return;
            }

            const roleBadges = {
                cashier: { label: (window.cnxT?window.cnxT('js.s_inv.7abc5668','Thu Ngân (ACC)'):'Thu Ngân (ACC)'), class: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                kitchen: { label: (window.cnxT?window.cnxT('js.s_ops.75a1234d','Tổ Bếp / Bar (KIT)'):'Tổ Bếp / Bar (KIT)'), class: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                waiter: { label: (window.cnxT?window.cnxT('js.s_ops.c555b794','Order Phục Vụ (STF)'):'Order Phục Vụ (STF)'), class: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
                admin: { label: (window.cnxT?window.cnxT('js.s_inv.33f5c5d9','Quản Trị (ADM)'):'Quản Trị (ADM)'), class: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
                customer: { label: (window.cnxT?window.cnxT('js.s_ops.0de2de34','Khách VIP (USR)'):'Khách VIP (USR)'), class: 'bg-slate-700 text-slate-300 border-white/10' }
            };

            const srcLbl = (src) => {
                if (src === 'hikvision_device') return '<span class="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold">Hikvision</span>';
                if (src === 'kiosk_pin') return '<span class="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[9px] font-bold">Kiosk PIN</span>';
                if (src === 'web_personal') return '<span class="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">Web App</span>';
                return '<span class="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-white/10 text-[9px]">Auto POS</span>';
            };
            if (typeof this.loadHikvisionDevices === 'function') this.loadHikvisionDevices();

            tbody.innerHTML = data.staff_list.map(st => {
                const rInfo = roleBadges[st.role] || { label: st.role, class: 'bg-slate-700 text-slate-300' };
                const isRecent = st.is_recently_active;
                const statusBadge = isRecent 
                    ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ${window.cnxT?window.cnxT('js.s_ops.fbe8e815','Đang làm việc'):'Đang làm việc'}</span>`
                    : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px]"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> ${window.cnxT?window.cnxT('js.s_ops.95261c94','Vắng mặt tạm thời'):'Vắng mặt tạm thời'}</span>`;

                return `
                    <tr class="hover:bg-white/5 transition-colors">
                        <td class="py-2.5 px-3">
                            <div class="flex items-center gap-2">
                                <div class="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-sky-400 text-xs">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div>
                                    <div class="font-bold text-slate-200 text-xs">${st.fullname} ${srcLbl(st.source || 'auto_login')}</div>
                                    <div class="text-[10px] font-mono text-slate-400">${st.user_code || st.username}</div>
                                </div>
                            </div>
                        </td>
                        <td class="py-2.5 px-3">
                            <span class="px-2 py-0.5 rounded-md border text-[10px] font-bold ${rInfo.class}">${rInfo.label}</span>
                        </td>
                        <td class="py-2.5 px-3 font-mono text-slate-300">
                            <i class="far fa-clock text-sky-400 mr-1 text-[10px]"></i>${st.check_in_display}
                        </td>
                        <td class="py-2.5 px-3">
                            <span class="px-2 py-0.5 rounded-md bg-slate-800 text-sky-300 font-bold font-mono text-xs border border-white/5">
                                ${st.elapsed_display}
                            </span>
                        </td>
                        <td class="py-2.5 px-3">
                            ${statusBadge}
                            ${st.is_overtime_approved ? `<div class="mt-1"><span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold" title="Đã duyệt tăng ca">OT x${Number(st.overtime_multiplier || 1.5).toFixed(1)}</span></div>` : ''}
                        </td>
                        <td class="py-2.5 px-3 text-[11px] text-slate-400">
                            <span class="truncate max-w-[140px] block" title="${escapeHtml(st.device_info || '')}">${escapeHtml(st.device_info || '')}</span>
                        </td>
                        <td class="py-2.5 px-3 text-right">
                            <div class="inline-flex items-center justify-end gap-1.5">
                                <button type="button" onclick="Admin.toggleOvertimeApproval(${Number(st.attendance_id || 0)}, ${!st.is_overtime_approved}, '${escapeJsAttr(st.fullname || '')}')" class="btn-glass text-[11px] py-1 px-2 ${st.is_overtime_approved ? 'bg-amber-500/30 hover:bg-amber-500/40 text-amber-200 border-amber-400/50' : 'bg-slate-800/80 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'} font-bold shadow-sm" title="${st.is_overtime_approved ? 'Tắt duyệt tăng ca cho ca này' : (window.cnxT?window.cnxT('js.s_ops.25a25a70','Duyệt tăng ca (OT) cho ca này'):'Duyệt tăng ca (OT) cho ca này')}">
                                    <i class="fas fa-bolt mr-1"></i>${st.is_overtime_approved ? 'Tắt OT' : (window.cnxT?window.cnxT('ui.adm_html.span_2824db8c','Duyệt OT'):'Duyệt OT')}
                                </button>
                                <button type="button" onclick="Admin.manualCheckout(${Number(st.attendance_id || 0)}, ${Number(st.user_id)}, '${escapeJsAttr(st.fullname || '')}')" class="btn-glass text-[11px] py-1 px-2.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/30 font-bold shadow-sm" title="Chốt ca kết thúc cho nhân viên nếu quên checkout">
                                    <i class="fas fa-right-from-bracket mr-1"></i> ${window.cnxT?window.cnxT('js.s_ops.619030e0','Chốt Ca'):'Chốt Ca'}
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('loadRealtimeStaff error:', e);
        }
    },

    async toggleOvertimeApproval(attId, approved, name) {
        const notify = (m, t = 'info') => (typeof this.showToast === 'function' ? this.showToast(m, t) : alert(m));
        if (!attId) {
            notify((window.cnxT?window.cnxT('js.s_ops.ac159fc5','Không tìm thấy mã bản ghi chấm công đang mở!'):'Không tìm thấy mã bản ghi chấm công đang mở!'), 'error');
            return;
        }
        let mult = 1.5;
        if (approved) {
            const input = await window.cnxPrompt(`Nhập hệ số tăng ca (OT) cho "${name || (window.cnxT?window.cnxT('js.s_ops.f39f5cbd','nhân viên'):'nhân viên')}" (VD: 1.5 ngày thường, 2.0 cuối tuần, 3.0 lễ):`, '1.5', { title: (window.cnxT?window.cnxT('js.s_ops.be07a671','Duyệt Tăng Ca (OT)'):'Duyệt Tăng Ca (OT)') });
            if (input === null) return;
            const parsed = parseFloat(String(input).replace(',', '.'));
            if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
                notify((window.cnxT?window.cnxT('js.s_ops.43a0b947','Hệ số OT không hợp lệ (từ 1.0 đến 5.0)'):'Hệ số OT không hợp lệ (từ 1.0 đến 5.0)'), 'error');
                return;
            }
            mult = parsed;
        } else {
            const ok = await window.cnxConfirm(`Hủy trạng thái duyệt tăng ca (OT) cho "${name || (window.cnxT?window.cnxT('js.s_ops.f39f5cbd','nhân viên'):'nhân viên')}"?`, { title: (window.cnxT?window.cnxT('js.s_ops.44c82ca8','Tắt Duyệt OT'):'Tắt Duyệt OT') });
            if (!ok) return;
        }
        try {
            const res = await fetch('api/operations.php?action=approve_overtime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attendance_id: attId, approved: !!approved, overtime_multiplier: mult })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || (window.cnxT?window.cnxT('js.s_ops.fcc710c4','Không thể cập nhật OT'):'Không thể cập nhật OT'));
            notify(approved ? `${window.cnxT?window.cnxT('js.s_ops.52f9ec64','Đã duyệt OT x'):'Đã duyệt OT x'}${mult.toFixed(1)} cho ${name}` : `${window.cnxT?window.cnxT('js.s_ops.9fa36e28','Đã tắt OT cho'):'Đã tắt OT cho'} ${name}`, 'success');
            if (typeof this.loadRealtimeStaff === 'function') await this.loadRealtimeStaff();
            if (typeof this.loadPayroll === 'function') await this.loadPayroll();
        } catch (e) {
            notify((window.cnxT?window.cnxT('js.s_ops.9eb2c4de','Lỗi cập nhật OT: '):'Lỗi cập nhật OT: ') + e.message, 'error');
        }
    },

    async manualCheckout(attId, userId, name) {
        if (!(await window.cnxConfirm(`Xác nhận chốt kết thúc ca làm việc cho nhân viên "${name}"?\nHệ thống sẽ tự động tính tổng số giờ làm và tiền lương ca đến thời điểm này.`))) {
            return;
        }
        try {
            const res = await fetch('api/operations.php?action=manual_checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attendance_id: attId, user_id: userId })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.loadRealtimeStaff();
                this.loadPayroll();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_ops.33f722d0','Lỗi khi chốt ca'):'Lỗi khi chốt ca'));
            }
        } catch (e) {
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        }
    },

    // 8.2 Inventory & Material Costs
    toggleLowStockFilter() {
        this._lowStockFilterOnly = !this._lowStockFilterOnly;
        const card = document.getElementById('inv-card-low-stock');
        if (card) {
            card.classList.toggle('ring-2', this._lowStockFilterOnly);
            card.classList.toggle('ring-rose-400/70', this._lowStockFilterOnly);
            card.classList.toggle('bg-rose-500/10', this._lowStockFilterOnly);
        }
        this.loadMaterials();
    },

    async loadMaterials() {
        try {
            const search = document.getElementById('inv-search-input')?.value.trim() || '';
            const cat = document.getElementById('inv-category-filter')?.value || 'all';

            const res = await fetch(`api/operations.php?action=get_materials&search=${encodeURIComponent(search)}&category=${encodeURIComponent(cat)}`);
            const data = await res.json();
            if (!data.success) return;

            this.materialsList = (data.materials || []).map(m => {
                const qty = Number(m.quantity || 0);
                const minQty = Number(m.min_quantity || 0);
                const cost = Number(m.cost_price || 0);
                return {
                    ...m,
                    is_low: m.is_low !== undefined ? Boolean(m.is_low) : (qty <= minQty),
                    stock_value: (m.stock_value !== undefined && m.stock_value !== null) ? Number(m.stock_value) : Math.round(qty * cost)
                };
            });

            // Update KPI
            const summary = data.summary || {};
            const totalItemsEl = document.getElementById('inv-stat-total-items');
            const totalValueEl = document.getElementById('inv-stat-total-value');
            const lowStockEl = document.getElementById('inv-stat-low-stock');
            const lowNamesEl = document.getElementById('inv-stat-low-stock-names');

            const lowItems = this.materialsList.filter(m => m.is_low);
            if (totalItemsEl) totalItemsEl.innerText = summary.total_items ?? this.materialsList.length;
            if (totalValueEl) totalValueEl.innerText = this.formatMoney(summary.total_stock_value || 0) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            if (lowStockEl) lowStockEl.innerText = summary.low_stock_count ?? lowItems.length;
            if (lowNamesEl) {
                if (lowItems.length === 0) {
                    lowNamesEl.innerText = (window.cnxT?window.cnxT('ui.adm_html.span_8c6d7871','Tồn kho an toàn'):'Tồn kho an toàn');
                    lowNamesEl.className = 'text-[10px] text-emerald-300 mt-1 block truncate';
                } else {
                    const preview = lowItems.slice(0, 2).map(x => `${x.name} (${x.quantity}/${x.min_quantity} ${x.unit})`).join(', ');
                    const extra = lowItems.length > 2 ? ` +${lowItems.length - 2} ${window.cnxT?window.cnxT('js.s_ops.5e8511dc','món'):'món'}` : '';
                    lowNamesEl.innerText = preview + extra;
                    lowNamesEl.title = lowItems.map(x => `${x.name}${window.cnxT?window.cnxT('js.s_ops.9c401ff9',': còn'):': còn'} ${x.quantity} ${x.unit} ${window.cnxT?window.cnxT('js.s_ops.dec03127','(định mức'):'(định mức'} ${x.min_quantity})`).join('\n');
                    lowNamesEl.className = 'text-[10px] text-rose-300 mt-1 block truncate';
                }
            }

            // Load month expense for materials
            this.loadMonthMaterialExpense();

            // Populate category filter if needed
            const catFilter = document.getElementById('inv-category-filter');
            if (catFilter && catFilter.options.length <= 1 && data.categories) {
                data.categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.innerText = c;
                    catFilter.appendChild(opt);
                });
            }

            // Render table
            const tbody = document.getElementById('inv-materials-tbody');
            if (!tbody) return;

            const displayList = this._lowStockFilterOnly ? lowItems : this.materialsList;
            if (displayList.length === 0) {
                tbody.innerHTML = this.renderEmptyState(10, 'fa-boxes-stacked', (window.cnxT?window.cnxT('js.s_ops.7402bd3f','Kho nguyên vật liệu trống'):'Kho nguyên vật liệu trống'), this._lowStockFilterOnly ? 'Không có nguyên liệu nào dưới định mức tối thiểu.' : (window.cnxT?window.cnxT('js.s_ops.651b18a2','Chưa có nguyên vật liệu nào trong kho phù hợp với bộ lọc tìm kiếm.'):'Chưa có nguyên vật liệu nào trong kho phù hợp với bộ lọc tìm kiếm.'));
                return;
            }

            tbody.innerHTML = displayList.map(m => {
                const isLow = m.is_low;
                const stockBadge = isLow 
                    ? `<span class="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 font-mono text-xs inline-flex items-center justify-center gap-1 mx-auto"><i class="fas fa-triangle-exclamation text-[10px]"></i> ${m.quantity} ${m.unit}</span>`
                    : `<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 font-mono text-xs inline-block mx-auto">${m.quantity} ${m.unit}</span>`;

                return `
                    <tr class="hover:bg-white/5 transition-colors ${isLow ? 'bg-rose-500/5' : ''}">
                        <td class="py-2.5 px-3 font-mono font-bold text-amber-400 text-center">${m.code}</td>
                        <td class="py-2.5 px-3 text-left">
                            <div class="font-bold text-slate-100 text-xs">${m.name}</div>
                            ${m.note ? `<div class="text-[10px] text-slate-400 truncate max-w-xs">${m.note}</div>` : ''}
                        </td>
                        <td class="py-2.5 px-3 text-center">
                            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold border border-white/5 inline-block">${m.category}</span>
                        </td>
                        <td class="py-2.5 px-3 text-slate-300 font-medium text-center">${m.unit}</td>
                        <td class="py-2.5 px-3 text-center">${stockBadge}</td>
                        <td class="py-2.5 px-3 font-mono text-slate-400 text-xs text-center">${m.min_quantity} ${m.unit}</td>
                        <td class="py-2.5 px-3 font-mono text-slate-300 text-right">${Admin.formatMoney(m.cost_price)} đ</td>
                        <td class="py-2.5 px-3 font-mono font-bold text-emerald-400 text-right">${Admin.formatMoney(m.stock_value)} đ</td>
                        <td class="py-2.5 px-3 text-[11px] text-slate-400 text-center">${escapeHtml(m.supplier || (window.cnxT?window.cnxT('js.m_sa.febea634','Chưa có'):'Chưa có'))}</td>
                        <td class="py-2.5 px-3 text-right">
                            <div class="flex items-center justify-end gap-1">
                                <button type="button" onclick="Admin.openStockTransactionModal('import', ${Number(m.id)})" class="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 text-xs" title="Nhập kho nhanh cho món này">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button type="button" onclick="Admin.editMaterial(${Number(m.id)})" class="p-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border border-sky-500/30 text-xs" title="Sửa thông tin">
                                    <i class="fas fa-pen"></i>
                                </button>
                                <button type="button" onclick="Admin.deleteMaterial(${Number(m.id)}, '${escapeJsAttr(m.name || '')}')" class="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 text-xs" title="Xóa">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('loadMaterials error:', e);
        }
    },

    async loadMonthMaterialExpense() {
        try {
            const res = await fetch('api/operations.php?action=get_transactions&period=month&type=import');
            const data = await res.json();
            if (data.success) {
                const el = document.getElementById('inv-stat-month-expense');
                if (el) el.innerText = this.formatMoney(data.total_expense) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin.js', e) : console.debug('admin.js', e)); }
    },

    openMaterialModal(mat = null) {
        document.getElementById('modal-mat-id').value = mat ? mat.id : '';
        document.getElementById('modal-mat-code').value = mat ? mat.code : '';
        document.getElementById('modal-mat-name').value = mat ? mat.name : '';
        document.getElementById('modal-mat-category').value = mat ? mat.category : (window.cnxT?window.cnxT('js.s_ops.5f3fefb6','Cà phê & Trà'):'Cà phê & Trà');
        document.getElementById('modal-mat-unit').value = mat ? mat.unit : 'kg';
        document.getElementById('modal-mat-qty').value = mat ? mat.quantity : 0;
        document.getElementById('modal-mat-qty').disabled = mat ? true : false;
        document.getElementById('modal-mat-minqty').value = mat ? mat.min_quantity : 5;
        document.getElementById('modal-mat-cost').value = mat ? mat.cost_price : 0;
        document.getElementById('modal-mat-supplier').value = mat ? (mat.supplier || '') : '';
        document.getElementById('modal-mat-note').value = mat ? (mat.note || '') : '';

        const title = document.getElementById('modal-material-title');
        if (title) title.innerHTML = mat ? '<i class="fas fa-pen"></i> Sửa Nguyên Vật Liệu' : (window.cnxT?window.cnxT('js.s_ops.481df2e6','<i class="fas fa-boxes-stacked"></i> Thêm Nguyên Vật Liệu Mới'):'<i class="fas fa-boxes-stacked"></i> Thêm Nguyên Vật Liệu Mới');

        document.getElementById('modal-material').classList.add('open');
    },

    editMaterial(id) {
        const mat = this.materialsList.find(m => m.id == id);
        if (mat) this.openMaterialModal(mat);
    },

    closeMaterialModal() {
        document.getElementById('modal-material').classList.remove('open');
    },

    async submitMaterial(e) {
        e.preventDefault();
        const id = document.getElementById('modal-mat-id').value;
        const payload = {
            id: id ? parseInt(id) : 0,
            code: document.getElementById('modal-mat-code').value.trim(),
            name: document.getElementById('modal-mat-name').value.trim(),
            category: document.getElementById('modal-mat-category').value.trim(),
            unit: document.getElementById('modal-mat-unit').value.trim(),
            quantity: parseFloat(document.getElementById('modal-mat-qty').value) || 0,
            min_quantity: parseFloat(document.getElementById('modal-mat-minqty').value) || 0,
            cost_price: parseFloat(document.getElementById('modal-mat-cost').value) || 0,
            supplier: document.getElementById('modal-mat-supplier').value.trim(),
            note: document.getElementById('modal-mat-note').value.trim()
        };

        try {
            const res = await fetch('api/operations.php?action=save_material', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.closeMaterialModal();
                this.loadMaterials();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_ops.9028ffa0','Lỗi khi lưu nguyên vật liệu'):'Lỗi khi lưu nguyên vật liệu'));
            }
        } catch (err) {
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        }
    },

    async deleteMaterial(id, name) {
        if (!(await window.cnxConfirm(`Bạn có chắc muốn xóa nguyên vật liệu "${name}" khỏi danh mục quản lý?`))) return;
        try {
            const res = await fetch('api/operations.php?action=delete_material', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                this.loadMaterials();
            } else {
                this.showToast ? this.showToast(data.message || (window.cnxT?window.cnxT('js.s_ops.2c2a7630','Lỗi khi xóa'):'Lỗi khi xóa'), 'error') : console.error(data.message);
            }
        } catch (e) {
            this.showToast ? this.showToast((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'), 'error') : console.error(e);
        }
    },

    // =========================================================
    // RECEIPT TEMPLATE STUDIO & PRINTER CONFIG (PAY-01 / PAY-05)
    // =========================================================
    async initReceiptStudioSettings() {
        try {
            const res = await fetch('/api/printer/list', {
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('pos_token') || '') }
            });
            const data = await res.json();
            if (!data.success) return;

            const sel = document.getElementById('cfg-printer-name');
            if (sel) {
                const printers = data.printers || [];
                const curName = (data.config && data.config.printer_name) || '';
                sel.innerHTML = (window.cnxT?window.cnxT('js.s_ops.4c3d4156','<option value="">-- Chọn máy in Windows --</option>'):'<option value="">-- Chọn máy in Windows --</option>') +
                    printers.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
                if (curName) sel.value = curName;
            }
            const cfg = data.config || {};
            const setV = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = String(v); };
            setV('cfg-printer-type', cfg.printer_type || 'windows');
            setV('cfg-printer-ip', cfg.printer_ip || '');
            setV('cfg-printer-port', cfg.printer_port || 9100);
            setV('cfg-printer-paper-width', cfg.paper_width || '80mm');

            const tpl = window.ReceiptTemplate ? window.ReceiptTemplate.normalizeConfig(data.receipt_template) : (data.receipt_template || {});
            this._applyReceiptStudioControls(tpl);
            this.previewReceiptStudio();
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_ops_kpi.js', e) : console.debug(e)); }
    },

    _applyReceiptStudioControls(tpl) {
        const setV = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = String(v); };
        const setC = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
        setV('tpl-paper-size', tpl.paper_size || '80mm');
        setV('tpl-lang-mode', tpl.receipt_lang_mode || 'auto');
        setV('tpl-line-height', tpl.line_height ?? 1.35);
        setV('tpl-item-gap', tpl.item_gap_px ?? 6);
        setV('tpl-section-gap', tpl.section_gap_px ?? 8);
        setV('tpl-pad-x', tpl.pad_x_px ?? 8);
        setV('tpl-pad-y', tpl.pad_y_px ?? 10);
        setV('tpl-font-header', tpl.font_header_px ?? 15);
        setV('tpl-font-body', tpl.font_body_px ?? 12);
        setV('tpl-font-total', tpl.font_total_px ?? 14);
        setV('tpl-feed-lines', tpl.feed_lines ?? 4);
        setV('tpl-custom-header', tpl.custom_header || '');
        setV('tpl-custom-footer', tpl.custom_footer || '');
        setC('tpl-show-logo', tpl.show_logo !== false);
        setC('tpl-show-address', tpl.show_store_address !== false);
        setC('tpl-show-phone', tpl.show_store_phone !== false);
        setC('tpl-show-table-cashier', tpl.show_table_cashier !== false);
        setC('tpl-show-item-note', tpl.show_item_note !== false);
        setC('tpl-show-toppings', tpl.show_toppings !== false);
        setC('tpl-show-discount-vat', tpl.show_discount_vat !== false);
        setC('tpl-show-wifi', tpl.show_wifi !== false);
        setC('tpl-show-footer', tpl.show_footer_note !== false);
    },

    _collectReceiptStudioConfig() {
        const num = (id, def) => {
            const v = parseFloat(document.getElementById(id)?.value);
            return Number.isFinite(v) ? v : def;
        };
        const chk = (id, def = true) => {
            const el = document.getElementById(id);
            return el ? !!el.checked : def;
        };
        const raw = {
            paper_size: document.getElementById('tpl-paper-size')?.value || '80mm',
            receipt_lang_mode: document.getElementById('tpl-lang-mode')?.value || 'auto',
            line_height: num('tpl-line-height', 1.35),
            item_gap_px: Math.round(num('tpl-item-gap', 6)),
            section_gap_px: Math.round(num('tpl-section-gap', 8)),
            pad_x_px: Math.round(num('tpl-pad-x', 8)),
            pad_y_px: Math.round(num('tpl-pad-y', 10)),
            font_header_px: Math.round(num('tpl-font-header', 15)),
            font_body_px: Math.round(num('tpl-font-body', 12)),
            font_total_px: Math.round(num('tpl-font-total', 14)),
            feed_lines: Math.round(num('tpl-feed-lines', 4)),
            custom_header: document.getElementById('tpl-custom-header')?.value || '',
            custom_footer: document.getElementById('tpl-custom-footer')?.value || '',
            show_logo: chk('tpl-show-logo', true),
            show_store_address: chk('tpl-show-address', true),
            show_store_phone: chk('tpl-show-phone', true),
            show_table_cashier: chk('tpl-show-table-cashier', true),
            show_item_note: chk('tpl-show-item-note', true),
            show_toppings: chk('tpl-show-toppings', true),
            show_discount_vat: chk('tpl-show-discount-vat', true),
            show_wifi: chk('tpl-show-wifi', true),
            show_footer_note: chk('tpl-show-footer', true)
        };
        return window.ReceiptTemplate ? window.ReceiptTemplate.normalizeConfig(raw) : raw;
    },

    previewReceiptStudio() {
        const box = document.getElementById('receipt-studio-preview');
        if (!box || !window.ReceiptTemplate) return;
        const tpl = this._collectReceiptStudioConfig();
        const hiddenInp = document.getElementById('cfg-receipt-tpl-json');
        if (hiddenInp) hiddenInp.value = JSON.stringify(tpl);

        const lblLH = document.getElementById('lbl-tpl-lh');
        if (lblLH) lblLH.textContent = Number(tpl.line_height).toFixed(2);
        const lblGap = document.getElementById('lbl-tpl-gap');
        if (lblGap) lblGap.textContent = `${tpl.item_gap_px}px`;
        const lblSec = document.getElementById('lbl-tpl-sec');
        if (lblSec) lblSec.textContent = `${tpl.section_gap_px}px`;

        const sampleOrder = {
            order_code: 'HD-PREVIEW-01',
            table_code: 'B02',
            user_name: 'ThuNgan',
            created_at: new Date().toLocaleString('vi-VN'),
            subtotal: 125000,
            discount_amount: 10000,
            vat_percent: 8,
            vat_amount: 9200,
            total_amount: 124200,
            payment_method: 'cash',
            cash_received: 200000,
            change_amount: 75800
        };
        const sampleItems = [
            { product_name: (window.cnxT?window.cnxT('js.s_ops.1bb593f6','Cà Phê Muối Kem Béo'):'Cà Phê Muối Kem Béo'), quantity: 2, price: 45000, subtotal: 90000, toppings: [{ name: 'Kem cheese' }], note: (window.cnxT?window.cnxT('js.s_ops.493cdd77','Ít đá'):'Ít đá') },
            { product_name: (window.cnxT?window.cnxT('ui.customer_html.h4_484eff89','Trà Đào Cam Sả'):'Trà Đào Cam Sả'), quantity: 1, price: 35000, subtotal: 35000, note: '' }
        ];
        box.innerHTML = window.ReceiptTemplate.renderHtml(sampleOrder, sampleItems, window.CN_STORE_BRAND || {}, { template: tpl });
    },

    async testPrinterSettings() {
        const tpl = this._collectReceiptStudioConfig();
        try {
            const res = await fetch('/api/printer/print-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('pos_token') || '')
                },
                body: JSON.stringify({
                    is_reprint: true,
                    order: { order_code: 'TEST-PRINT', table_code: 'ADMIN', subtotal: 10000, total_amount: 10000, payment_method: 'banking' },
                    items: [{ product_name: (window.cnxT?window.cnxT('js.s_ops.63b45f79','In thử mẫu hóa đơn ESC/POS'):'In thử mẫu hóa đơn ESC/POS'), quantity: 1, price: 10000, subtotal: 10000 }],
                    printer_type: document.getElementById('cfg-printer-type')?.value || 'windows',
                    printer_name: document.getElementById('cfg-printer-name')?.value || '',
                    printer_ip: document.getElementById('cfg-printer-ip')?.value || '',
                    printer_port: parseInt(document.getElementById('cfg-printer-port')?.value || '9100', 10)
                })
            });
            const data = await res.json();
            if (typeof this.showToast === 'function') this.showToast(data.message || (window.cnxT?window.cnxT('js.s_ops.5f664a85','Hoàn tất test in'):'Hoàn tất test in'), data.success ? 'success' : 'error');
        } catch (e) {
            if (typeof this.showToast === 'function') this.showToast((window.cnxT?window.cnxT('js.s_ops.8be7bb05','Lỗi test máy in: '):'Lỗi test máy in: ') + e.message, 'error');
        }
    },

    // =========================================================
    // HIKVISION DS-K1T343MX ISAPI DEVICE MANAGEMENT (HR-08)
    // =========================================================
    async loadHikvisionDevices() {
        const tbody = document.getElementById('hik-devices-tbody');
        if (!tbody) return;
        try {
            const res = await fetch('/api/attendance/hikvision/devices', {
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('pos_token') || '') }
            });
            const data = await res.json();
            const list = data.data || [];
            if (!list.length) {
                tbody.innerHTML = (window.cnxT?window.cnxT('js.s_ops.404c8b15','<tr><td colspan="6" class="py-4 text-center text-xs text-slate-400">Chưa khai báo máy chấm công Hikvision DS-K1T343MX nào.</td></tr>'):'<tr><td colspan="6" class="py-4 text-center text-xs text-slate-400">Chưa khai báo máy chấm công Hikvision DS-K1T343MX nào.</td></tr>');
                return;
            }
            tbody.innerHTML = list.map(d => `
                <tr class="hover:bg-white/5 text-xs border-b border-white/5">
                    <td class="py-2 px-3 font-bold text-white">${escapeHtml(d.name)} <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(d.model || 'DS-K1T343MX')}</div></td>
                    <td class="py-2 px-3 font-mono text-sky-300">${escapeHtml(d.ip_address)}:${Number(d.port || 80)}</td>
                    <td class="py-2 px-3 font-mono text-[11px] text-slate-300">${escapeHtml(d.username || 'admin')}</td>
                    <td class="py-2 px-3 text-[11px]">
                        ${d.is_active ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">Đang bật</span>' : (window.cnxT?window.cnxT('js.s_ops.b8b49711','<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Tắt</span>'):'<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Tắt</span>')}
                        ${d.last_error ? `<div class="text-[10px] text-rose-400 mt-0.5">${escapeHtml(d.last_error)}</div>` : ''}
                    </td>
                    <td class="py-2 px-3 text-[10px] font-mono text-slate-400">Poll: ${escapeHtml(d.last_poll_at || '—')}<br>Sync: ${escapeHtml(d.last_sync_at || '—')}</td>
                    <td class="py-2 px-3 text-right whitespace-nowrap">
                        <div class="inline-flex gap-1">
                            <button type="button" onclick="Admin.testHikvisionDevice(${Number(d.id)})" class="btn-glass text-[10px] py-1 px-2 text-sky-300">Test</button>
                            <button type="button" onclick="Admin.syncHikvisionUsers(${Number(d.id)})" class="btn-glass text-[10px] py-1 px-2 text-emerald-300">Sync NV</button>
                            <button type="button" onclick="Admin.pollHikvisionDevice(${Number(d.id)})" class="btn-glass text-[10px] py-1 px-2 text-amber-300">${window.cnxT?window.cnxT('js.s_ops.f543b653','Kéo Log'):'Kéo Log'}</button>
                            <button type="button" onclick="Admin.deleteHikvisionDevice(${Number(d.id)})" class="btn-glass text-[10px] py-1 px-2 text-rose-300"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_ops_kpi.js', e) : console.debug(e)); }
    },

    async saveHikvisionDevice() {
        const payload = {
            name: document.getElementById('hik-dev-name')?.value.trim() || (window.cnxT?window.cnxT('ui.admin_html.ph_6c3e86bd','Hikvision Cửa Chính'):'Hikvision Cửa Chính'),
            ip_address: document.getElementById('hik-dev-ip')?.value.trim() || '',
            port: parseInt(document.getElementById('hik-dev-port')?.value || '80', 10) || 80,
            username: document.getElementById('hik-dev-user')?.value.trim() || 'admin',
            password: document.getElementById('hik-dev-pass')?.value || '',
            model: document.getElementById('hik-dev-model')?.value.trim() || 'DS-K1T343MX',
            is_active: 1
        };
        try {
            const res = await fetch('/api/attendance/hikvision/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('pos_token') || '') },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (typeof this.showToast === 'function') this.showToast(data.message || (window.cnxT?window.cnxT('js.s_ops.a9969094','Đã lưu thiết bị'):'Đã lưu thiết bị'), data.success ? 'success' : 'error');
            if (data.success) this.loadHikvisionDevices();
        } catch (e) { if (typeof this.showToast === 'function') this.showToast((window.cnxT?window.cnxT('js.s_ops.b69ae662','Lỗi kết nối'):'Lỗi kết nối'), 'error'); }
    },

    async _callHikAction(path, devId) {
        try {
            const res = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('pos_token') || '') },
                body: JSON.stringify({ device_id: devId })
            });
            const data = await res.json();
            if (typeof this.showToast === 'function') this.showToast(data.message || (window.cnxT?window.cnxT('js.s_ops.e3eceb0c','Hoàn tất'):'Hoàn tất'), data.success ? 'success' : 'error');
            this.loadHikvisionDevices();
        } catch (e) { if (typeof this.showToast === 'function') this.showToast((window.cnxT?window.cnxT('js.s_ops.b9878a33','Lỗi gọi ISAPI Hikvision'):'Lỗi gọi ISAPI Hikvision'), 'error'); }
    },
    testHikvisionDevice(id) { return this._callHikAction('/api/attendance/hikvision/test', id); },
    syncHikvisionUsers(id) { return this._callHikAction('/api/attendance/hikvision/sync-users', id); },
    pollHikvisionDevice(id) { return this._callHikAction('/api/attendance/hikvision/poll', id); },
    async deleteHikvisionDevice(id) {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_ops.c71e44df','Xóa thiết bị Hikvision này khỏi danh sách?'):'Xóa thiết bị Hikvision này khỏi danh sách?')))) return;
        await fetch('/api/attendance/hikvision/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('pos_token') || '') },
            body: JSON.stringify({ op: 'delete', id })
        });
        this.loadHikvisionDevices();
    }
});
