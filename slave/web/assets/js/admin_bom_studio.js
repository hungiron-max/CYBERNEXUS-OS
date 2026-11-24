/**
 * CyberNexus F&B BOM Studio, Dynamic UOM Conversion & Waste/Stocktake Module (INV-01)
 * - Centralized BOM Matrix with auto COGS & Gross Margin %
 * - Clone recipe between menu items (e.g. Size M -> Size L with scale factor)
 * - Dynamic UOM import (e.g., Chai 1.5L = 1500ml, Chai 1L = 1000ml -> base_unit ml) with Moving Average Cost
 * - Waste/Spoilage (Hết hạn / Hỏng / Pha lỗi) & Quick Stocktake (Kiểm kê hao hụt đá/nguyên liệu)
 */
(function (window) {
    'use strict';

    const COST_CLASS_LABELS = {
        direct_bom: { label: 'Nguyên liệu pha chế (COGS)', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
        packaging_consumable: { label: 'Bao bì & Tiêu hao (Ly/Đá)', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
        operating_supply: { label: 'Vật tư vận hành (OPEX)', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
    };

    const BomStudio = {
        matrix: [],
        materials: [],
        selectedProductId: 0,
        filterMode: 'all',
        searchKw: '',

        fmt(n) {
            return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));
        },

        esc(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        },

        async openBomStudio(preselectProductId = 0) {
            let modal = document.getElementById('cn-bom-studio-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'cn-bom-studio-modal';
                modal.className = 'fixed inset-0 z-[9995] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3';
                modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                document.body.appendChild(modal);
            }
            modal.innerHTML = `
                <div class="w-full max-w-6xl h-[88vh] rounded-2xl bg-slate-900/95 border border-emerald-500/35 shadow-2xl flex flex-col overflow-hidden">
                    <div class="px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/50">
                        <div class="flex items-center gap-2.5">
                            <div class="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center">
                                <i class="fas fa-flask"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-black text-white uppercase tracking-wide">Bảng Thiết Lập Định Mức Nguyên Liệu &amp; Giá Vốn (BOM Studio)</h3>
                                <p class="text-[11px] text-slate-400">Quản lý công thức theo đơn vị gốc (ml / g / cái), tự tính COGS bình quân &amp; biên lãi gộp từng món</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="Admin.openSmartUomImportModal()" class="btn-glass text-xs py-1.5 px-3 bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 border-sky-500/30 font-bold">
                                <i class="fas fa-scale-balanced mr-1"></i> Nhập Quy Đổi (1.5L/1L → ml)
                            </button>
                            <button type="button" onclick="Admin.openWasteStocktakeModal(0, 'waste')" class="btn-glass text-xs py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border-rose-500/30 font-bold">
                                <i class="fas fa-trash-can-arrow-up mr-1"></i> Xuất Hủy / Kiểm Kê
                            </button>
                            <button type="button" onclick="document.getElementById('cn-bom-studio-modal')?.remove()" class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
                        <div class="lg:col-span-6 border-r border-white/10 flex flex-col min-h-0 p-3 space-y-2.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <div class="relative flex-1 min-w-[160px]">
                                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                                    <input type="text" id="bom-search-input" oninput="Admin._bomStudio.onSearch(this.value)" placeholder="Tìm tên món hoặc danh mục..." class="liquid-input w-full pl-8 pr-3 py-1.5 text-xs" />
                                </div>
                                <div class="flex items-center gap-1 text-[11px]">
                                    <button type="button" onclick="Admin._bomStudio.setFilter('all')" data-bom-f="all" class="bom-f-btn px-2.5 py-1 rounded-lg bg-sky-500/25 text-sky-300 border border-sky-500/40 font-bold">Tất cả</button>
                                    <button type="button" onclick="Admin._bomStudio.setFilter('missing')" data-bom-f="missing" class="bom-f-btn px-2.5 py-1 rounded-lg text-slate-400 hover:text-white border border-white/10">Chưa gắn</button>
                                    <button type="button" onclick="Admin._bomStudio.setFilter('low_margin')" data-bom-f="low_margin" class="bom-f-btn px-2.5 py-1 rounded-lg text-slate-400 hover:text-white border border-white/10">Lãi &lt; 45%</button>
                                </div>
                            </div>
                            <div class="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60">
                                <table class="w-full text-xs text-left">
                                    <thead class="sticky top-0 bg-slate-900/95 text-[10px] uppercase text-slate-400 border-b border-white/10">
                                        <tr>
                                            <th class="py-2 px-3">Món bán</th>
                                            <th class="py-2 px-2 text-right">Giá bán</th>
                                            <th class="py-2 px-2 text-right">Giá vốn BOM</th>
                                            <th class="py-2 px-2 text-right">Lãi gộp</th>
                                            <th class="py-2 px-2 text-center">NL</th>
                                        </tr>
                                    </thead>
                                    <tbody id="bom-matrix-tbody" class="divide-y divide-white/5">
                                        <tr><td colspan="5" class="py-8 text-center text-slate-400">Đang tải danh sách định mức...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="lg:col-span-6 flex flex-col min-h-0 p-4 space-y-3 overflow-y-auto" id="bom-editor-pane">
                            <div class="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs text-center py-10">
                                <i class="fas fa-hand-pointer text-2xl mb-2 text-slate-600"></i>
                                Chọn 1 món bên trái để xem/chỉnh sửa định mức nguyên liệu &amp; giá vốn chi tiết.
                            </div>
                        </div>
                    </div>
                </div>
            `;

            await this.reloadData();
            if (preselectProductId > 0) {
                this.selectProduct(preselectProductId);
            } else if (this.matrix.length > 0) {
                this.selectProduct(this.matrix[0].id);
            }
        },

        async reloadData() {
            const [mRes, matRes] = await Promise.all([
                fetch('api/operations.php?action=get_bom_matrix').then(r => r.json()).catch(() => ({})),
                fetch('api/operations.php?action=materials').then(r => r.json()).catch(() => ({}))
            ]);
            this.matrix = (mRes && mRes.success && Array.isArray(mRes.data)) ? mRes.data : [];
            const rawMats = matRes?.materials || matRes?.data;
            this.materials = (matRes && matRes.success && Array.isArray(rawMats)) ? rawMats : [];
            this.renderMatrix();
        },

        onSearch(v) {
            this.searchKw = String(v || '').toLowerCase().trim();
            this.renderMatrix();
        },

        setFilter(mode) {
            this.filterMode = mode;
            document.querySelectorAll('.bom-f-btn').forEach(b => {
                const on = b.dataset.bomF === mode;
                b.className = on
                    ? 'bom-f-btn px-2.5 py-1 rounded-lg bg-sky-500/25 text-sky-300 border border-sky-500/40 font-bold'
                    : 'bom-f-btn px-2.5 py-1 rounded-lg text-slate-400 hover:text-white border border-white/10';
            });
            this.renderMatrix();
        },

        renderMatrix() {
            const tbody = document.getElementById('bom-matrix-tbody');
            if (!tbody) return;
            const list = this.matrix.filter(p => {
                if (this.searchKw && !(p.name.toLowerCase().includes(this.searchKw) || (p.category_name || '').toLowerCase().includes(this.searchKw))) return false;
                if (this.filterMode === 'missing') return (p.recipe_count || 0) === 0;
                if (this.filterMode === 'low_margin') return (p.recipe_count || 0) > 0 && p.margin_pct >= 0 && p.margin_pct < 45;
                return true;
            });
            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-500">Không có món nào khớp bộ lọc.</td></tr>';
                return;
            }
            tbody.innerHTML = list.map(p => {
                const sel = p.id === this.selectedProductId;
                const hasBom = (p.recipe_count || 0) > 0;
                const marginCls = !hasBom ? 'text-slate-500' : (p.margin_pct < 45 ? 'text-rose-400 font-bold' : (p.margin_pct < 60 ? 'text-amber-300 font-bold' : 'text-emerald-400 font-bold'));
                return `
                    <tr onclick="Admin._bomStudio.selectProduct(${p.id})" class="cursor-pointer transition ${sel ? 'bg-emerald-500/15 border-l-2 border-emerald-400' : 'hover:bg-white/[0.04]'}">
                        <td class="py-2 px-3">
                            <div class="font-bold text-white">${this.esc(p.name)}</div>
                            <div class="text-[10px] text-slate-400">${this.esc(p.category_name)}</div>
                        </td>
                        <td class="py-2 px-2 text-right font-mono text-slate-200">${this.fmt(p.price)}đ</td>
                        <td class="py-2 px-2 text-right font-mono ${hasBom ? 'text-sky-300' : 'text-slate-500'}">${hasBom ? this.fmt(p.bom_cost) + 'đ' : '—'}</td>
                        <td class="py-2 px-2 text-right font-mono ${marginCls}">${hasBom ? p.margin_pct + '%' : 'Chưa gắn'}</td>
                        <td class="py-2 px-2 text-center"><span class="px-1.5 py-0.5 rounded text-[10px] font-mono ${hasBom ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}">${p.recipe_count || 0}</span></td>
                    </tr>
                `;
            }).join('');
        },

        selectProduct(prodId) {
            this.selectedProductId = prodId;
            this.renderMatrix();
            const prod = this.matrix.find(x => x.id === prodId);
            const pane = document.getElementById('bom-editor-pane');
            if (!prod || !pane) return;

            const cloneOpts = this.matrix
                .filter(x => x.id !== prodId && (x.recipe_count || 0) > 0)
                .map(x => `<option value="${x.id}">${this.esc(x.name)} (${x.recipe_count} NL)</option>`)
                .join('');

            pane.innerHTML = `
                <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div>
                        <h4 class="text-sm font-black text-white">${this.esc(prod.name)}</h4>
                        <div class="text-[11px] text-slate-400">Giá bán: <b class="text-emerald-300 font-mono">${this.fmt(prod.price)}đ</b> • Danh mục: ${this.esc(prod.category_name)}</div>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <select id="bom-clone-from" class="liquid-input py-1 px-2 text-[11px] max-w-[170px]">
                            <option value="0">Nhân bản từ món...</option>
                            ${cloneOpts}
                        </select>
                        <input id="bom-clone-scale" type="number" step="0.1" min="0.2" max="5" value="1.0" title="Hệ số nhân (vd: 1.3 cho size L)" class="liquid-input py-1 px-1.5 text-[11px] w-14 font-mono text-center" />
                        <button type="button" onclick="Admin._bomStudio.cloneFromSelected()" class="btn-glass py-1 px-2 text-[11px] text-amber-300 border-amber-500/30">Copy</button>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="p-2 rounded-xl bg-slate-950/70 border border-white/10">
                        <div class="text-[10px] text-slate-400">Giá vốn BOM</div>
                        <div id="bom-live-cost" class="text-sm font-black font-mono text-sky-300">0 đ</div>
                    </div>
                    <div class="p-2 rounded-xl bg-slate-950/70 border border-white/10">
                        <div class="text-[10px] text-slate-400">Lãi gộp / món</div>
                        <div id="bom-live-margin" class="text-sm font-black font-mono text-emerald-300">0 đ</div>
                    </div>
                    <div class="p-2 rounded-xl bg-slate-950/70 border border-white/10">
                        <div class="text-[10px] text-slate-400">Biên lợi nhuận</div>
                        <div id="bom-live-pct" class="text-sm font-black font-mono text-amber-300">0%</div>
                    </div>
                </div>

                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-300">Danh sách nguyên liệu cấu thành (theo đơn vị gốc ml/g/cái):</span>
                    <button type="button" onclick="Admin._bomStudio.addEditorRow()" class="btn-glass py-1 px-2.5 text-xs text-emerald-300 border-emerald-500/30 font-bold"><i class="fas fa-plus mr-1"></i> Thêm nguyên liệu</button>
                </div>

                <div id="bom-editor-rows" class="space-y-2 flex-1 overflow-y-auto pr-1"></div>

                <div class="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                    <span class="text-[10px] text-slate-400">Lưu ý: Chỉ liệt kê nhóm Nguyên liệu pha chế &amp; Bao bì (Vật tư vệ sinh OPEX không gắn vào BOM).</span>
                    <button type="button" onclick="Admin._bomStudio.saveCurrentBom()" class="btn-glass-success py-2 px-5 text-xs font-bold"><i class="fas fa-save mr-1"></i> Lưu Định Mức</button>
                </div>
            `;

            const recipes = Array.isArray(prod.recipes) ? prod.recipes : [];
            if (recipes.length === 0) {
                this.addEditorRow();
            } else {
                recipes.forEach(r => this.addEditorRow(r.material_id, r.quantity_per_unit));
            }
            this.recalcLiveCost();
        },

        addEditorRow(matId = 0, qty = '') {
            const box = document.getElementById('bom-editor-rows');
            if (!box) return;
            const bomMats = this.materials.filter(m => (m.cost_class || 'direct_bom') !== 'operating_supply');
            const opts = bomMats.map(m => `<option value="${m.id}" data-cost="${m.cost_price || 0}" data-unit="${this.esc(m.unit)}" ${Number(m.id) === Number(matId) ? 'selected' : ''}>${this.esc(m.name)} (${this.esc(m.unit)} • ${this.fmt(m.cost_price)}đ/${this.esc(m.unit)})</option>`).join('');
            const row = document.createElement('div');
            row.className = 'bom-ed-row flex items-center gap-2 p-2 rounded-xl bg-slate-950/70 border border-white/10';
            row.innerHTML = `
                <select onchange="Admin._bomStudio.recalcLiveCost()" class="bom-ed-mat liquid-input py-1 px-2 text-xs flex-1">
                    <option value="0">-- Chọn nguyên liệu --</option>
                    ${opts}
                </select>
                <input type="number" step="0.1" min="0" value="${qty}" oninput="Admin._bomStudio.recalcLiveCost()" placeholder="SL" class="bom-ed-qty liquid-input py-1 px-2 text-xs w-24 font-mono text-right" />
                <span class="bom-ed-cost text-[11px] font-mono text-sky-300 w-20 text-right shrink-0">0đ</span>
                <button type="button" onclick="this.parentElement.remove(); Admin._bomStudio.recalcLiveCost();" class="text-rose-400 hover:text-rose-300 px-1.5"><i class="fas fa-times"></i></button>
            `;
            box.appendChild(row);
            this.recalcLiveCost();
        },

        recalcLiveCost() {
            const prod = this.matrix.find(x => x.id === this.selectedProductId);
            const price = Number(prod?.price || 0);
            let totalCost = 0;
            document.querySelectorAll('#bom-editor-rows .bom-ed-row').forEach(r => {
                const sel = r.querySelector('.bom-ed-mat');
                const opt = sel && sel.selectedOptions ? sel.selectedOptions[0] : null;
                const unitCost = Number(opt?.dataset?.cost || 0);
                const qty = Number(r.querySelector('.bom-ed-qty')?.value || 0);
                const lineCost = Math.max(0, unitCost * qty);
                totalCost += lineCost;
                const cEl = r.querySelector('.bom-ed-cost');
                if (cEl) cEl.textContent = this.fmt(lineCost) + 'đ';
            });
            const margin = price - totalCost;
            const pct = price > 0 ? ((margin / price) * 100).toFixed(1) : '0.0';
            const lc = document.getElementById('bom-live-cost');
            const lm = document.getElementById('bom-live-margin');
            const lp = document.getElementById('bom-live-pct');
            if (lc) lc.textContent = this.fmt(totalCost) + ' đ';
            if (lm) lm.textContent = this.fmt(margin) + ' đ';
            if (lp) {
                lp.textContent = pct + '%';
                lp.className = 'text-sm font-black font-mono ' + (Number(pct) < 45 ? 'text-rose-400' : (Number(pct) < 60 ? 'text-amber-300' : 'text-emerald-300'));
            }
        },

        async saveCurrentBom() {
            if (!this.selectedProductId) return;
            const items = [];
            document.querySelectorAll('#bom-editor-rows .bom-ed-row').forEach(r => {
                const material_id = parseInt(r.querySelector('.bom-ed-mat')?.value || '0', 10) || 0;
                const quantity_per_unit = parseFloat(r.querySelector('.bom-ed-qty')?.value || '0') || 0;
                if (material_id > 0 && quantity_per_unit > 0) items.push({ material_id, quantity_per_unit });
            });
            const res = await fetch('api/operations.php?action=save_recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: this.selectedProductId, items })
            }).then(r => r.json()).catch(e => ({ success: false, message: e.message }));
            if (res && res.success) {
                if (window.Admin?.showToast) Admin.showToast(res.message || 'Đã lưu định mức!', 'success');
                await this.reloadData();
                this.selectProduct(this.selectedProductId);
            } else {
                alert(res?.message || 'Lỗi lưu định mức!');
            }
        },

        async cloneFromSelected() {
            const fromId = parseInt(document.getElementById('bom-clone-from')?.value || '0', 10);
            const scale = parseFloat(document.getElementById('bom-clone-scale')?.value || '1') || 1;
            if (!fromId || !this.selectedProductId) return;
            const res = await fetch('api/operations.php?action=clone_recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from_product_id: fromId, to_product_id: this.selectedProductId, scale })
            }).then(r => r.json()).catch(e => ({ success: false, message: e.message }));
            if (res && res.success) {
                if (window.Admin?.showToast) Admin.showToast(res.message || 'Đã nhân bản công thức!', 'success');
                await this.reloadData();
                this.selectProduct(this.selectedProductId);
            } else {
                alert(res?.message || 'Lỗi nhân bản công thức!');
            }
        },

        async openSmartUomImportModal(preMatId = 0) {
            if (this.materials.length === 0) await this.reloadData();
            let modal = document.getElementById('cn-uom-import-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'cn-uom-import-modal';
                modal.className = 'fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
                modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                document.body.appendChild(modal);
            }
            const opts = this.materials.map(m => `<option value="${m.id}" data-unit="${this.esc(m.unit)}" data-stock="${m.quantity || 0}" data-cost="${m.cost_price || 0}" ${Number(m.id) === Number(preMatId) ? 'selected' : ''}>${this.esc(m.name)} (Tồn: ${m.quantity || 0} ${this.esc(m.unit)})</option>`).join('');
            modal.innerHTML = `
                <div class="liquid-glass rounded-2xl border border-sky-500/35 w-full max-w-md p-5 space-y-3 bg-slate-900/95 text-xs">
                    <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
                        <h4 class="font-bold text-sm text-sky-300"><i class="fas fa-scale-balanced mr-1.5"></i>Nhập Kho Quy Đổi Đơn Vị Linh Hoạt</h4>
                        <button type="button" onclick="document.getElementById('cn-uom-import-modal')?.remove()" class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                    </div>
                    <div>
                        <label class="text-slate-300 block mb-1">Nguyên vật liệu</label>
                        <select id="uom-mat-id" onchange="Admin._bomStudio.updateUomPreview()" class="liquid-input w-full py-1.5 px-2.5">${opts}</select>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <label class="text-slate-300 block mb-1">Quy cách nhập</label>
                            <input id="uom-unit-name" type="text" value="Chai 1.5L" placeholder="Chai 1L / Thùng..." class="liquid-input w-full py-1.5 px-2" />
                        </div>
                        <div>
                            <label class="text-slate-300 block mb-1">Số lượng mua</label>
                            <input id="uom-buy-qty" type="number" step="0.5" min="0.1" value="1" oninput="Admin._bomStudio.updateUomPreview()" class="liquid-input w-full py-1.5 px-2 font-mono" />
                        </div>
                        <div>
                            <label class="text-slate-300 block mb-1">Hệ số ra ĐV gốc</label>
                            <input id="uom-factor" type="number" step="1" min="1" value="1500" oninput="Admin._bomStudio.updateUomPreview()" class="liquid-input w-full py-1.5 px-2 font-mono text-amber-300" />
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-1">
                        <button type="button" onclick="document.getElementById('uom-unit-name').value='Chai 1.5L';document.getElementById('uom-factor').value='1500';Admin._bomStudio.updateUomPreview()" class="btn-glass px-2 py-0.5 text-[10px]">Chai 1.5L (1500ml)</button>
                        <button type="button" onclick="document.getElementById('uom-unit-name').value='Chai 1L';document.getElementById('uom-factor').value='1000';Admin._bomStudio.updateUomPreview()" class="btn-glass px-2 py-0.5 text-[10px]">Chai 1L (1000ml)</button>
                        <button type="button" onclick="document.getElementById('uom-unit-name').value='Chai 750ml';document.getElementById('uom-factor').value='750';Admin._bomStudio.updateUomPreview()" class="btn-glass px-2 py-0.5 text-[10px]">Chai 750ml</button>
                        <button type="button" onclick="document.getElementById('uom-unit-name').value='Gói 1kg';document.getElementById('uom-factor').value='1000';Admin._bomStudio.updateUomPreview()" class="btn-glass px-2 py-0.5 text-[10px]">Gói 1kg (1000g)</button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-slate-300 block mb-1">Giá mua / 1 quy cách (VNĐ)</label>
                            <input id="uom-unit-price" type="number" step="1000" min="0" value="180000" oninput="Admin._bomStudio.updateUomPreview()" class="liquid-input w-full py-1.5 px-2 font-mono text-emerald-300" />
                        </div>
                        <div>
                            <label class="text-slate-300 block mb-1">Hạn sử dụng lô (tùy chọn)</label>
                            <input id="uom-expiry" type="date" class="liquid-input w-full py-1.5 px-2 font-mono" />
                        </div>
                    </div>
                    <div id="uom-preview-box" class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-200 font-mono"></div>
                    <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
                        <button type="button" onclick="document.getElementById('cn-uom-import-modal')?.remove()" class="btn-glass py-1.5 px-3">Hủy</button>
                        <button type="button" onclick="Admin._bomStudio.submitSmartUomImport()" class="btn-glass-primary py-1.5 px-4 font-bold">Xác Nhận Nhập Kho</button>
                    </div>
                </div>
            `;
            this.updateUomPreview();
        },

        updateUomPreview() {
            const sel = document.getElementById('uom-mat-id');
            const opt = sel && sel.selectedOptions ? sel.selectedOptions[0] : null;
            const baseUnit = opt?.dataset?.unit || 'ml';
            const buyQty = Number(document.getElementById('uom-buy-qty')?.value || 0);
            const factor = Number(document.getElementById('uom-factor')?.value || 1);
            const pricePerBuy = Number(document.getElementById('uom-unit-price')?.value || 0);
            const totalBase = buyQty * factor;
            const totalCost = buyQty * pricePerBuy;
            const pricePerBase = totalBase > 0 ? (totalCost / totalBase) : 0;
            const box = document.getElementById('uom-preview-box');
            if (box) {
                box.innerHTML = `Cộng kho: <b>+${this.fmt(totalBase)} ${this.esc(baseUnit)}</b> • Tổng tiền: <b>${this.fmt(totalCost)} đ</b> • Giá gốc: <b>${pricePerBase.toFixed(1)} đ/${this.esc(baseUnit)}</b> (tự tính Bình quân gia quyền)`;
            }
        },

        async submitSmartUomImport() {
            const matId = parseInt(document.getElementById('uom-mat-id')?.value || '0', 10);
            const payload = {
                material_id: matId,
                trans_type: 'import',
                purchase_unit: document.getElementById('uom-unit-name')?.value || '',
                purchase_qty: parseFloat(document.getElementById('uom-buy-qty')?.value || '0') || 0,
                conversion_factor: parseFloat(document.getElementById('uom-factor')?.value || '1') || 1,
                unit_price: parseFloat(document.getElementById('uom-unit-price')?.value || '0') || 0,
                expiry_date: document.getElementById('uom-expiry')?.value || '',
                note: 'Nhập quy đổi ' + (document.getElementById('uom-unit-name')?.value || '')
            };
            const res = await fetch('api/operations.php?action=create_material_transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json()).catch(e => ({ success: false, message: e.message }));
            if (res && res.success) {
                document.getElementById('cn-uom-import-modal')?.remove();
                if (window.Admin?.showToast) Admin.showToast(res.message || 'Đã nhập kho quy đổi thành công!', 'success');
                if (typeof window.Admin?.loadMaterials === 'function') Admin.loadMaterials();
                if (document.getElementById('cn-bom-studio-modal')) await this.reloadData();
            } else {
                alert(res?.message || 'Lỗi nhập kho!');
            }
        },

        async openWasteStocktakeModal(preMatId = 0, mode = 'waste') {
            if (this.materials.length === 0) await this.reloadData();
            let modal = document.getElementById('cn-waste-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'cn-waste-modal';
                modal.className = 'fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
                modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                document.body.appendChild(modal);
            }
            const opts = this.materials.map(m => `<option value="${m.id}" ${Number(m.id) === Number(preMatId) ? 'selected' : ''}>${this.esc(m.name)} (Tồn: ${m.quantity || 0} ${this.esc(m.unit)})</option>`).join('');
            modal.innerHTML = `
                <div class="liquid-glass rounded-2xl border border-rose-500/35 w-full max-w-md p-5 space-y-3 bg-slate-900/95 text-xs">
                    <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
                        <h4 class="font-bold text-sm text-rose-300"><i class="fas fa-trash-can-arrow-up mr-1.5"></i>Xuất Hủy (Hết Hạn) &amp; Kiểm Kê Hao Hụt</h4>
                        <button type="button" onclick="document.getElementById('cn-waste-modal')?.remove()" class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-slate-300 block mb-1">Loại phiếu</label>
                            <select id="ws-type" class="liquid-input w-full py-1.5 px-2">
                                <option value="waste" ${mode === 'waste' ? 'selected' : ''}>Xuất Hủy / Hết Hạn (Trừ kho)</option>
                                <option value="stocktake" ${mode === 'stocktake' ? 'selected' : ''}>Kiểm Kê Nhanh (Cập nhật tồn thực tế)</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-slate-300 block mb-1">Số lượng (theo ĐV gốc)</label>
                            <input id="ws-qty" type="number" step="0.1" min="0" value="1" class="liquid-input w-full py-1.5 px-2 font-mono" />
                        </div>
                    </div>
                    <div>
                        <label class="text-slate-300 block mb-1">Nguyên vật liệu</label>
                        <select id="ws-mat-id" class="liquid-input w-full py-1.5 px-2">${opts}</select>
                    </div>
                    <div>
                        <label class="text-slate-300 block mb-1">Lý do hao hụt / hủy hàng</label>
                        <select id="ws-reason" class="liquid-input w-full py-1.5 px-2">
                            <option value="Quá hạn sử dụng (Bánh mì / Sữa tươi)">Quá hạn sử dụng (Bánh mì / Sữa tươi)</option>
                            <option value="Hao hụt tự nhiên (Nước đá tan / Bay hơi)">Hao hụt tự nhiên (Nước đá tan / Bay hơi)</option>
                            <option value="Pha chế lỗi / Đổ vỡ">Pha chế lỗi / Đổ vỡ</option>
                            <option value="Kiểm kê chênh lệch cuối ngày">Kiểm kê chênh lệch cuối ngày</option>
                        </select>
                    </div>
                    <div class="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2">
                        Giá trị hao hụt sẽ tự động ghi nhận vào dòng <b>"Hao hụt &amp; Hủy hàng"</b> trên Báo cáo Tài chính (tách bạch khỏi giá vốn bán hàng COGS).
                    </div>
                    <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
                        <button type="button" onclick="document.getElementById('cn-waste-modal')?.remove()" class="btn-glass py-1.5 px-3">Hủy</button>
                        <button type="button" onclick="Admin._bomStudio.submitWasteStocktake()" class="btn-glass py-1.5 px-4 bg-rose-500/25 text-rose-200 border-rose-500/40 font-bold">Xác Nhận Ghi Nhận</button>
                    </div>
                </div>
            `;
        },

        async submitWasteStocktake() {
            const payload = {
                material_id: parseInt(document.getElementById('ws-mat-id')?.value || '0', 10),
                trans_type: document.getElementById('ws-type')?.value || 'waste',
                quantity: parseFloat(document.getElementById('ws-qty')?.value || '0') || 0,
                waste_reason: document.getElementById('ws-reason')?.value || '',
                note: document.getElementById('ws-reason')?.value || ''
            };
            const res = await fetch('api/operations.php?action=create_material_transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json()).catch(e => ({ success: false, message: e.message }));
            if (res && res.success) {
                document.getElementById('cn-waste-modal')?.remove();
                if (window.Admin?.showToast) Admin.showToast(res.message || 'Đã ghi nhận phiếu hao hụt!', 'success');
                if (typeof window.Admin?.loadMaterials === 'function') Admin.loadMaterials();
            } else {
                alert(res?.message || 'Lỗi ghi nhận!');
            }
        }
    };

    const targetAdmin = (typeof Admin !== 'undefined' && Admin) ? Admin : window.Admin;
    if (targetAdmin) {
        targetAdmin._bomStudio = BomStudio;
        targetAdmin.openBomStudio = (pid) => BomStudio.openBomStudio(pid);
        targetAdmin.openSmartUomImportModal = (mid) => BomStudio.openSmartUomImportModal(mid);
        targetAdmin.openWasteStocktakeModal = (mid, mode) => BomStudio.openWasteStocktakeModal(mid, mode);
        targetAdmin.COST_CLASS_LABELS = COST_CLASS_LABELS;
    } else {
        window.CyberBomStudio = BomStudio;
    }
})(window);
