/**
 * Admin Module: Smart Inventory & AI OCR
 * Extracted from admin.js for modular maintainability
 */
Object.assign(Admin, {
    // ========================================================
    // 8.3.1 SMART INVENTORY GOODS RECEIPT (3 METHODS & AI OCR)
    // ========================================================
    importState: {
        method: 'manual',
        images: [], // Danh sách ảnh hóa đơn: [{ id, name, sizeStr, base64 }]
        cameraStream: null,
        invoiceImageUrl: ''
    },

    resetSmartImportForm() {
        // Reset state
        this.importState.images = [];
        this.importState.invoiceImageUrl = '';

        // Reset ảnh preview & file input
        this.removeAllInvoiceImages();
        const fileInput = document.getElementById('invoice-file-input');
        if (fileInput) fileInput.value = '';
        const folderInput = document.getElementById('invoice-folder-input');
        if (folderInput) folderInput.value = '';

        // Reset các trường thông tin phiếu
        const textInputs = [
            'manual-import-supplier', 'manual-import-invoice-no', 'manual-import-note',
            'review-supplier-input', 'review-invoice-no-input'
        ];
        textInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Xóa hoàn toàn các hàng dữ liệu cũ trong bảng kết quả review
        const reviewTbody = document.getElementById('review-items-tbody');
        if (reviewTbody) {
            reviewTbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-400 text-xs"><div class="flex flex-col items-center justify-center gap-2"><i class="fas fa-file-invoice text-3xl text-slate-600"></i><span>${window.cnxT?window.cnxT('js.s_inv.66a8022c','Chưa có dữ liệu. Vui lòng tải ảnh hóa đơn / viết tay hoặc bấm'):'Chưa có dữ liệu. Vui lòng tải ảnh hóa đơn / viết tay hoặc bấm'} <b>"+ Bổ sung dòng"</b> ${window.cnxT?window.cnxT('js.s_inv.9fdeb438','để nhập.'):'để nhập.'}</span></div></td></tr>`;
        }

        // Ẩn badge AI
        const badge = document.getElementById('review-ai-badge');
        if (badge) badge.classList.add('hidden');

        // Reset bảng nhập thủ công về 1 dòng trống
        const manualTbody = document.getElementById('manual-import-tbody');
        if (manualTbody) {
            manualTbody.innerHTML = '';
            this.addManualImportRow();
        }

        // Reset bộ đếm số lượng & tổng chi phí
        const countEl = document.getElementById('import-footer-item-count');
        const costEl = document.getElementById('import-footer-total-cost');
        if (countEl) countEl.innerText = '0';
        if (costEl) costEl.innerText = (window.cnxT?window.cnxT('ui.sa_html.div_e995e897','0 đ'):'0 đ');
    },

    openSmartImportModal(initialMethod = 'manual') {
        const modal = document.getElementById('modal-smart-import');
        if (!modal) return;
        modal.classList.add('open');

        // Reset toàn bộ form và dữ liệu nhập kho cũ
        this.resetSmartImportForm();

        // Initialize drag & drop once
        this.initInvoiceDropzone();

        const keyInput = document.getElementById('import-gemini-api-key');
        if (keyInput && !keyInput.value) {
            keyInput.value = '';
        }

        // Switch to chosen method
        this.switchImportMethod(initialMethod);
    },

    closeSmartImportModal() {
        this.stopCamera();
        const modal = document.getElementById('modal-smart-import');
        if (modal) modal.classList.remove('open');
    },

    switchImportMethod(method) {
        this.importState.method = method;

        // Stop camera if leaving camera tab
        if (method !== 'camera') {
            this.stopCamera();
        }

        // Update tab buttons
        const tabs = ['manual', 'upload', 'camera'];
        tabs.forEach(t => {
            const btn = document.getElementById(`tab-btn-import-${t}`);
            const pane = document.getElementById(`import-pane-${t}`);
            if (t === method) {
                if (btn) {
                    btn.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/40', 'shadow-sm');
                    btn.classList.remove('text-slate-400', 'border-transparent');
                }
                if (pane) pane.classList.remove('hidden');
            } else {
                if (btn) {
                    btn.classList.remove('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/40', 'shadow-sm');
                    btn.classList.add('text-slate-400', 'border-transparent');
                }
                if (pane) pane.classList.add('hidden');
            }
        });

        // If manual tab: ensure at least 1 row exists
        if (method === 'manual') {
            const tbody = document.getElementById('manual-import-tbody');
            if (tbody && tbody.children.length === 0) {
                this.addManualImportRow();
            }
            this.calcManualImportTotal();
        } else {
            this.calcReviewTotals();
        }
    },

    // --- Phương thức 1: Nhập thủ công ---
    addManualImportRow() {
        const tbody = document.getElementById('manual-import-tbody');
        if (!tbody) return;

        const optionsHtml = this.materialsList.map(m => 
            `<option value="${m.id}" data-name="${m.name}" data-code="${m.code}" data-unit="${m.unit}" data-price="${m.cost_price}" data-sup="${m.supplier || ''}">${m.code} - ${m.name}</option>`
        ).join('');

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition-colors border-b border-white/5';
        tr.innerHTML = `
            <td class="py-2 px-3">
                <select class="liquid-input py-1 text-xs w-full manual-row-mat" onchange="Admin.onManualRowMatChange(this)">
                    ${optionsHtml}
                </select>
            </td>
            <td class="py-2 px-3">
                <input type="number" step="0.1" value="1" placeholder="Số lượng" class="liquid-input py-1 text-xs w-full font-mono font-bold text-sky-400 manual-row-qty" oninput="Admin.calcManualImportTotal()" />
            </td>
            <td class="py-2 px-3">
                <span class="manual-row-unit text-slate-300 font-bold text-xs">${this.materialsList[0]?.unit || 'kg'}</span>
            </td>
            <td class="py-2 px-3">
                <input type="number" step="1000" value="${this.materialsList[0]?.cost_price || 0}" placeholder="Đơn giá" class="liquid-input py-1 text-xs w-full font-mono text-emerald-400 manual-row-price" oninput="Admin.calcManualImportTotal()" />
            </td>
            <td class="py-2 px-3 text-right">
                <span class="manual-row-total text-emerald-300 font-mono font-bold text-xs">${window.cnxT?window.cnxT('ui.sa_html.div_e995e897','0 đ'):'0 đ'}</span>
            </td>
            <td class="py-2 px-2 text-center">
                <button type="button" onclick="Admin.removeManualImportRow(this)" class="p-1 text-rose-400 hover:text-rose-300 text-xs" title="Xóa dòng">
                    <i class="fas fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);

        const sel = tr.querySelector('.manual-row-mat');
        if (sel) this.onManualRowMatChange(sel);
    },

    onManualRowMatChange(selectElem) {
        const opt = selectElem.selectedOptions[0];
        if (!opt) return;
        const tr = selectElem.closest('tr');
        if (!tr) return;

        const unit = opt.dataset.unit || 'kg';
        const price = parseFloat(opt.dataset.price || 0);

        const unitElem = tr.querySelector('.manual-row-unit');
        if (unitElem) unitElem.innerText = unit;

        const priceInput = tr.querySelector('.manual-row-price');
        if (priceInput && (!priceInput.value || parseFloat(priceInput.value) <= 0)) {
            priceInput.value = price;
        }

        this.calcManualImportTotal();
    },

    removeManualImportRow(btn) {
        const tr = btn.closest('tr');
        if (tr) tr.remove();
        this.calcManualImportTotal();
    },

    calcManualImportTotal() {
        if (this.importState.method !== 'manual') return;

        const tbody = document.getElementById('manual-import-tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        let totalCost = 0;
        let count = 0;

        rows.forEach(tr => {
            const qty = parseFloat(tr.querySelector('.manual-row-qty')?.value || 0);
            const price = parseFloat(tr.querySelector('.manual-row-price')?.value || 0);
            const lineTotal = Math.round(qty * price);
            totalCost += lineTotal;
            if (qty > 0) count++;

            const totalSpan = tr.querySelector('.manual-row-total');
            if (totalSpan) totalSpan.innerText = this.formatMoney(lineTotal) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
        });

        const countElem = document.getElementById('import-footer-item-count');
        const costElem = document.getElementById('import-footer-total-cost');
        if (countElem) countElem.innerText = count;
        if (costElem) costElem.innerText = this.formatMoney(totalCost) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
        this.updateImportPaymentSummary();
    },

    updateImportPaymentSummary() {
        const totalText = document.getElementById('import-footer-total-cost')?.innerText || '0';
        const total = parseFloat(totalText.replace(/[^\d]/g, '')) || 0;
        ['manual', 'review'].forEach(prefix => {
            const amountInput = document.getElementById(`${prefix}-import-paid`);
            const summary = document.getElementById(`${prefix}-import-payment-summary`);
            if (!amountInput || !summary) return;
            const paid = Math.max(0, parseFloat(amountInput.value) || 0);
            const remaining = Math.max(0, total - paid);
            const status = paid <= 0 ? 'Chưa thanh toán' : (remaining <= 0 ? 'Đã thanh toán đủ' : (window.cnxT?window.cnxT('js.s_inv.78d924cc','Đã tạm ứng / thanh toán một phần'):'Đã tạm ứng / thanh toán một phần'));
            summary.innerText = `${status} ${window.cnxT?window.cnxT('js.s_inv.9c28608a','· Còn'):'· Còn'} ${this.formatMoney(remaining)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
            summary.className = `mt-1 ${remaining > 0 ? 'text-amber-300' : 'text-emerald-300'}`;
        });
    },

    // --- Phương thức 2: Tải lên hóa đơn & Drag and Drop ---
    initInvoiceDropzone() {
        const dropzone = document.getElementById('invoice-dropzone');
        if (!dropzone || dropzone.dataset.initialized) return;
        dropzone.dataset.initialized = 'true';

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('border-emerald-400', 'bg-emerald-500/10');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('border-emerald-400', 'bg-emerald-500/10');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                this.handleSelectedInvoiceFile(files[0]);
            }
        });
    },

    // Chọn một hoặc nhiều ảnh hóa đơn
    onInvoiceFilesSelected(e) {
        const files = e.target.files;
        if (files && files.length > 0) {
            this.handleMultipleInvoiceFiles(Array.from(files));
        }
        e.target.value = '';
    },

    handleMultipleInvoiceFiles(fileList) {
        // Lọc file hình ảnh
        const imageFiles = fileList.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name));
        if (imageFiles.length === 0) {
            alert((window.cnxT?window.cnxT('js.s_inv.f2ea245b','Không tìm thấy file hình ảnh (JPG, PNG, WEBP) nào!'):'Không tìm thấy file hình ảnh (JPG, PNG, WEBP) nào!'));
            return;
        }

        let loadedCount = 0;
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = ev.target.result;
                this.importState.images.push({
                    id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    name: file.name,
                    sizeStr: (file.size / 1024).toFixed(1) + ' KB',
                    base64: base64
                });
                loadedCount++;
                if (loadedCount === imageFiles.length) {
                    this.renderImageGallery();
                }
            };
            reader.readAsDataURL(file);
        });
    },

    // Hiển thị danh sách Medium Icon Gallery (Cố định 85x85px, có nút Xóa từng ảnh & Xóa hết)
    renderImageGallery() {
        const galleryPanel = document.getElementById('import-image-gallery-panel');
        const dropzone = document.getElementById('invoice-dropzone');
        const container = document.getElementById('gallery-items-container');
        const countBadge = document.getElementById('gallery-count-badge');
        const scanLabel = document.getElementById('btn-ai-scan-label');

        const total = this.importState.images.length;
        if (total === 0) {
            if (galleryPanel) galleryPanel.classList.add('hidden');
            if (dropzone) dropzone.classList.remove('hidden');
            return;
        }

        if (dropzone) dropzone.classList.add('hidden');
        if (galleryPanel) galleryPanel.classList.remove('hidden');

        if (countBadge) countBadge.innerText = `${total} ${window.cnxT?window.cnxT('js.s_inv.b377231d','ảnh'):'ảnh'}`;
        if (scanLabel) scanLabel.innerText = total > 1 ? `${window.cnxT?window.cnxT('js.s_inv.174ab0c1','PHÂN TÍCH'):'PHÂN TÍCH'} ${total} ${window.cnxT?window.cnxT('js.s_inv.76ca674b','ẢNH BẰNG AI'):'ẢNH BẰNG AI'}` : `${window.cnxT?window.cnxT('js.s_inv.b435cc8d','PHÂN TÍCH BẰNG AI'):'PHÂN TÍCH BẰNG AI'}`;

        if (container) {
            container.innerHTML = this.importState.images.map((img, idx) => `
                <div class="relative group shrink-0 flex flex-col items-center bg-slate-950/70 p-1.5 rounded-xl border border-white/10 hover:border-purple-400/60 transition-all w-[96px] shadow-md">
                    <!-- Nút xóa ảnh góc trên [×] màu đỏ rõ ràng -->
                    <button type="button" onclick="Admin.removeInvoiceImage(${idx})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-xs font-black shadow-lg z-10 transition-transform hover:scale-110" title="Xóa bỏ ảnh này">
                        &times;
                    </button>
                    <!-- Ảnh Medium Icon: 85x85px cố định chuẩn mực -->
                    <img src="${img.base64}" style="width: 85px; height: 85px; min-width: 85px; min-height: 85px; object-fit: cover;" class="rounded-lg border border-white/10 bg-slate-900 shadow-sm" alt="${img.name}" />
                    <!-- Tên file & nút xoay trên 1 dòng -->
                    <div class="w-full mt-1 flex items-center justify-between gap-1 text-[10px]">
                        <span class="truncate text-slate-300 font-medium" title="${img.name}">${img.name}</span>
                        <button type="button" onclick="Admin.rotateInvoiceImage(${idx})" class="text-sky-400 hover:text-sky-300 p-0.5" title="Xoay 90°">
                            <i class="fas fa-rotate-right text-[10px]"></i>
                        </button>
                    </div>
                    <span class="text-[9px] text-slate-500 truncate w-full">${img.sizeStr}</span>
                </div>
            `).join('');
        }
    },

    // Xóa từng ảnh khỏi danh sách
    removeInvoiceImage(idx) {
        if (idx >= 0 && idx < this.importState.images.length) {
            this.importState.images.splice(idx, 1);
            this.renderImageGallery();
        }
    },

    // Xóa tất cả ảnh
    removeAllInvoiceImages() {
        this.importState.images = [];
        this.renderImageGallery();
    },

    // Xoay 90 độ ảnh thứ idx
    rotateInvoiceImage(idx) {
        const item = this.importState.images[idx];
        if (!item) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.height;
            canvas.height = img.width;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((90 * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            item.base64 = canvas.toDataURL('image/jpeg', 0.92);
            this.renderImageGallery();
        };
        img.src = item.base64;
    },

    loadSampleInvoiceDemo() {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 700;
        const ctx = canvas.getContext('2d');

        // Vẽ mẫu hóa đơn
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, 600, 700);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText((window.cnxT?window.cnxT('js.s_inv.4dc4ae5b','ĐẠI LÝ NGUYÊN LIỆU CÀ PHÊ BUÔN MA THUỘT'):'ĐẠI LÝ NGUYÊN LIỆU CÀ PHÊ BUÔN MA THUỘT'), 300, 45);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#475569';
        ctx.fillText((window.cnxT?window.cnxT('js.s_inv.5be31a9d','Đ/c: 45 Lê Duẩn, TP. Buôn Ma Thuột - ĐT: 0918.608.073'):'Đ/c: 45 Lê Duẩn, TP. Buôn Ma Thuột - ĐT: 0918.608.073'), 300, 75);
        ctx.fillText((window.cnxT?window.cnxT('js.s_inv.f9c93008','PHIẾU XUẤT KHO / HÓA ĐƠN MUA HÀNG'):'PHIẾU XUẤT KHO / HÓA ĐƠN MUA HÀNG'), 300, 105);

        ctx.textAlign = 'left';
        ctx.fillText((window.cnxT?window.cnxT('js.s_inv.20d06946','Ngày: '):'Ngày: ') + new Date().toLocaleDateString('vi-VN'), 40, 140);
        ctx.fillText((window.cnxT?window.cnxT('js.s_inv.2c9b9b92','Khách hàng: GÓC PHỐ COFFEE & TEA'):'Khách hàng: GÓC PHỐ COFFEE & TEA'), 40, 165);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(40, 180); ctx.lineTo(560, 180); ctx.stroke();

        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#0f172a';
        ctx.fillText((window.cnxT?window.cnxT('ui.admin_html.th_2164d6e4','Tên Mặt Hàng'):'Tên Mặt Hàng'), 45, 205);
        ctx.fillText('SL', 290, 205);
        ctx.fillText((window.cnxT?window.cnxT('ui.admin_html.th_b2fbcdc4','ĐVT'):'ĐVT'), 345, 205);
        ctx.fillText((window.cnxT?window.cnxT('ui.admin_html.th_5ed4e580','Đơn Giá'):'Đơn Giá'), 415, 205);
        ctx.fillText((window.cnxT?window.cnxT('js.s_inv.c5e89351','T.Tiền'):'T.Tiền'), 495, 205);

        ctx.beginPath();
        ctx.moveTo(40, 218); ctx.lineTo(560, 218); ctx.stroke();

        const items = [
            [(window.cnxT?window.cnxT('js.s_inv.d8c62d0d','1. Cà phê hạt Robusta Đắk Lắk'):'1. Cà phê hạt Robusta Đắk Lắk'), '20', 'kg', '140.000', '2.800.000'],
            [(window.cnxT?window.cnxT('js.s_inv.f344721e','2. Sữa đặc Ngôi Sao Phương Nam'):'2. Sữa đặc Ngôi Sao Phương Nam'), '24', (window.cnxT?window.cnxT('js.s_inv.7abae759','hộp'):'hộp'), '22.000', '528.000'],
            [(window.cnxT?window.cnxT('js.s_inv.7fc836de','3. Sữa tươi thanh trùng TH'):'3. Sữa tươi thanh trùng TH'), '12', (window.cnxT?window.cnxT('js.s_inv.8892fce0','lít'):'lít'), '32.000', '384.000'],
            [(window.cnxT?window.cnxT('js.s_inv.e73f1d60','4. Trà Oolong nướng Đài Loan'):'4. Trà Oolong nướng Đài Loan'), '5', (window.cnxT?window.cnxT('js.s_inv.bac89c60','gói'):'gói'), '85.000', '425.000'],
            [(window.cnxT?window.cnxT('js.s_inv.24a8af1f','5. Đường phèn hạt Quảng Ngãi'):'5. Đường phèn hạt Quảng Ngãi'), '10', 'kg', '28.000', '280.000']
        ];

        ctx.font = '13px Arial';
        let y = 245;
        items.forEach(it => {
            ctx.fillText(it[0], 45, y);
            ctx.fillText(it[1], 295, y);
            ctx.fillText(it[2], 345, y);
            ctx.fillText(it[3], 410, y);
            ctx.fillText(it[4], 490, y);
            y += 32;
        });

        ctx.beginPath();
        ctx.moveTo(40, y); ctx.lineTo(560, y); ctx.stroke();

        ctx.font = 'bold 15px Arial';
        ctx.fillText((window.cnxT?window.cnxT('js.s_inv.50681859','TỔNG CỘNG TIỀN THANH TOÁN:'):'TỔNG CỘNG TIỀN THANH TOÁN:'), 160, y + 35);
        ctx.fillText((window.cnxT?window.cnxT('js.s_inv.2a8927b8','4.417.000 VNĐ'):'4.417.000 VNĐ'), 430, y + 35);

        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        this.importState.images.push({
            id: 'sample_' + Date.now(),
            name: 'sample_invoice_coffee_supply.jpg',
            sizeStr: '85.4 KB',
            base64: base64,
            isSampleDemo: true
        });
        this.renderImageGallery();
    },

    // --- Phương thức 3: Chụp ảnh qua Camera / Webcam ---
    async startCamera() {
        try {
            const video = document.getElementById('camera-stream-video');
            const placeholder = document.getElementById('camera-placeholder');
            const guide = document.getElementById('camera-guide-overlay');
            const btnStart = document.getElementById('btn-start-camera');
            const btnSnap = document.getElementById('btn-snap-camera');
            const btnStop = document.getElementById('btn-stop-camera');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            this.importState.cameraStream = stream;

            if (video) {
                video.srcObject = stream;
                video.classList.remove('hidden');
            }
            if (placeholder) placeholder.classList.add('hidden');
            if (guide) guide.classList.remove('hidden');

            if (btnStart) btnStart.classList.add('hidden');
            if (btnSnap) btnSnap.classList.remove('hidden');
            if (btnStop) btnStop.classList.remove('hidden');
        } catch (err) {
            console.error('Camera error:', err);
            alert((window.cnxT?window.cnxT('js.s_inv.710280ef','Không thể mở camera. Vui lòng kiểm tra quyền truy cập webcam trong trình duyệt: '):'Không thể mở camera. Vui lòng kiểm tra quyền truy cập webcam trong trình duyệt: ') + err.message);
        }
    },

    takeCameraSnapshot() {
        const video = document.getElementById('camera-stream-video');
        if (!video || !this.importState.cameraStream) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        this.importState.currentImageBase64 = base64;
        this.importState.imageFileName = 'camera_capture_' + Date.now() + '.jpg';
        this.importState.isSampleDemo = false;

        this.stopCamera();

        const previewPanel = document.getElementById('import-image-preview-panel');
        const previewImg = document.getElementById('import-preview-img');
        const previewName = document.getElementById('import-preview-name');
        const previewMeta = document.getElementById('import-preview-meta');

        if (previewImg) previewImg.src = base64;
        if (previewName) previewName.innerText = this.importState.imageFileName;
        if (previewMeta) previewMeta.innerText = (window.cnxT?window.cnxT('js.s_inv.01d90aea','Ảnh chụp camera • Sẵn sàng quét AI'):'Ảnh chụp camera • Sẵn sàng quét AI');
        if (previewPanel) previewPanel.classList.remove('hidden');
    },

    stopCamera() {
        if (this.importState.cameraStream) {
            this.importState.cameraStream.getTracks().forEach(t => t.stop());
            this.importState.cameraStream = null;
        }
        const video = document.getElementById('camera-stream-video');
        const placeholder = document.getElementById('camera-placeholder');
        const guide = document.getElementById('camera-guide-overlay');
        const btnStart = document.getElementById('btn-start-camera');
        const btnSnap = document.getElementById('btn-snap-camera');
        const btnStop = document.getElementById('btn-stop-camera');

        if (video) video.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
        if (guide) guide.classList.add('hidden');

        if (btnStart) btnStart.classList.remove('hidden');
        if (btnSnap) btnSnap.classList.add('hidden');
        if (btnStop) btnStop.classList.add('hidden');
    },

    // --- KÍCH HOẠT PHÂN TÍCH AI & OCR (HỖ TRỢ NHIỀU ẢNH / FOLDER) ---
    async runAiInvoiceScan() {
        if (!this.isModuleAllowed('ai_invoice_ocr')) {
            alert((window.cnxT?window.cnxT('js.s_inv.67ca0165','Module [ai_invoice_ocr] chưa được cấp phép hoặc đã bị Master tắt/khóa!'):'Module [ai_invoice_ocr] chưa được cấp phép hoặc đã bị Master tắt/khóa!'));
            return;
        }
        const total = this.importState.images.length;
        if (total === 0) {
            alert((window.cnxT?window.cnxT('js.s_inv.4a115d23','Vui lòng chọn hoặc kéo thả ít nhất 1 ảnh hóa đơn / giấy viết tay!'):'Vui lòng chọn hoặc kéo thả ít nhất 1 ảnh hóa đơn / giấy viết tay!'));
            return;
        }

        const statusBox = document.getElementById('import-ai-scanning-status');
        const statusText = document.getElementById('ai-scan-status-text');
        const btnScan = document.getElementById('btn-trigger-ai-scan');
        const keyInput = document.getElementById('import-gemini-api-key');
        const apiKey = keyInput?.value.trim() || '';

        if (statusBox) statusBox.classList.remove('hidden');
        if (btnScan) btnScan.disabled = true;

        let allExtractedItems = [];
        let detectedSupplier = '';
        let detectedInvoiceNo = '';
        let lastEngine = 'Google Gemini 3.5 Flash (AI)';
        let successCount = 0;

        try {
            for (let i = 0; i < total; i++) {
                const imgItem = this.importState.images[i];
                if (statusText) {
                    statusText.innerText = total > 1 
                        ? `${window.cnxT?window.cnxT('js.s_inv.22559fbf','AI đang phân tích hóa đơn ('):'AI đang phân tích hóa đơn ('}${i + 1}/${total}): ${imgItem.name}...` 
                        : (window.cnxT?window.cnxT('js.s_inv.0694db5e','Trí tuệ nhân tạo đang phân tích hình ảnh và bóc tách dữ liệu...'):'Trí tuệ nhân tạo đang phân tích hình ảnh và bóc tách dữ liệu...');
                }

                const optimizedB64 = imgItem.isSampleDemo
                    ? imgItem.base64
                    : await this.preprocessInvoiceImageForOcr(imgItem.base64, 1600);

                const res = await fetch('api/operations.php?action=ai_parse_invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_base64: optimizedB64,
                        gemini_api_key: apiKey,
                        is_sample_demo: !!imgItem.isSampleDemo
                    })
                });

                const data = await res.json();
                if (data.success) {
                    successCount++;
                    if (data.items && data.items.length > 0) {
                        allExtractedItems = allExtractedItems.concat(data.items);
                    }
                    if (!detectedSupplier && data.supplier) detectedSupplier = data.supplier;
                    if (!detectedInvoiceNo && data.invoice_no) detectedInvoiceNo = data.invoice_no;
                    if (data.ai_engine) lastEngine = data.ai_engine;
                    if (!this.importState.invoiceImageUrl && data.invoice_image_url) {
                        this.importState.invoiceImageUrl = data.invoice_image_url;
                    }
                } else {
                    console.warn(`${window.cnxT?window.cnxT('js.s_inv.638c4f44','Lỗi bóc tách ảnh'):'Lỗi bóc tách ảnh'} ${imgItem.name}:`, data.message);
                }
            }

            if (successCount === 0) {
                alert((window.cnxT?window.cnxT('js.s_inv.188e3bd1','Không thể phân tích được ảnh nào bằng AI. Vui lòng kiểm tra lại ảnh hoặc nhập thủ công.'):'Không thể phân tích được ảnh nào bằng AI. Vui lòng kiểm tra lại ảnh hoặc nhập thủ công.'));
                return;
            }

            const supInput = document.getElementById('review-supplier-input');
            const noInput = document.getElementById('review-invoice-no-input');
            if (supInput && detectedSupplier) supInput.value = detectedSupplier;
            if (noInput && detectedInvoiceNo) noInput.value = detectedInvoiceNo;

            const badge = document.getElementById('review-ai-badge');
            if (badge) {
                badge.innerText = `${lastEngine} • ${total} ${window.cnxT?window.cnxT('js.s_inv.0b1b9400','hóa đơn'):'hóa đơn'}`;
                badge.classList.remove('hidden');
            }

            this.renderReviewRows(allExtractedItems);
            document.getElementById('import-review-section')?.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            console.error('runAiInvoiceScan error:', err);
            alert((window.cnxT?window.cnxT('js.s_inv.b750dc60','Lỗi kết nối khi quét AI: '):'Lỗi kết nối khi quét AI: ') + err.message);
        } finally {
            if (statusBox) statusBox.classList.add('hidden');
            if (btnScan) btnScan.disabled = false;
        }
    },

    preprocessInvoiceImageForOcr(dataUrl, maxDim = 1600) {
        return new Promise((resolve) => {
            if (!dataUrl || typeof dataUrl !== 'string') return resolve(dataUrl);
            const img = new Image();
            img.onload = () => {
                try {
                    const w = img.naturalWidth || img.width;
                    const h = img.naturalHeight || img.height;
                    const scale = Math.min(1, maxDim / Math.max(w, h));
                    const tw = Math.max(1, Math.round(w * scale));
                    const th = Math.max(1, Math.round(h * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = tw;
                    canvas.height = th;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        if ('filter' in ctx) ctx.filter = 'contrast(1.12) brightness(1.03)';
                        ctx.drawImage(img, 0, 0, tw, th);
                        resolve(canvas.toDataURL('image/jpeg', 0.88));
                        return;
                    }
                } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_inventory.js', e) : console.debug('admin_inventory.js', e)); }
                resolve(dataUrl);
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    },

    renderReviewRows(items) {
        const tbody = document.getElementById('review-items-tbody');
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">Không trích xuất được mặt hàng nào. Vui lòng bấm "+ Bổ sung dòng" để nhập bổ sung.</td></tr>`;
            this.calcReviewTotals();
            return;
        }

        tbody.innerHTML = items.map((it, idx) => {
            const isNew = !!it.is_new;
            const matOptions = this.materialsList.map(m => 
                `<option value="${m.id}" data-unit="${m.unit}" ${(!isNew && it.material_id == m.id) ? 'selected' : ''}>${m.code} - ${m.name}</option>`
            ).join('');

            const selectOptions = `
                <option value="__NEW__" ${isNew ? 'selected' : ''} class="text-amber-300 font-bold">✨ [Tạo Mới Kho] ${it.raw_name}</option>
                ${matOptions}
            `;

            return `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5 review-row" data-is-new="${isNew ? '1' : '0'}" data-raw-name="${it.raw_name}">
                    <td class="py-3 px-3 min-w-[320px]">
                        <select class="liquid-input py-1.5 px-2.5 text-xs w-full review-mat-select font-semibold ${isNew ? 'text-amber-300' : 'text-sky-300'}" onchange="Admin.onReviewMatChanged(this)">
                            ${selectOptions}
                        </select>
                        <div class="mt-1.5 flex items-center gap-1.5">
                            ${isNew 
                                ? '<span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold whitespace-nowrap"><i class="fas fa-sparkles text-[9px] mr-1"></i>Mặt hàng mới</span>' 
                                : (window.cnxT?window.cnxT('js.s_inv.b5929ec9','<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold whitespace-nowrap"><i class="fas fa-check text-[9px] mr-1"></i>Đã khớp mã kho: <b>'):'<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold whitespace-nowrap"><i class="fas fa-check text-[9px] mr-1"></i>Đã khớp mã kho: <b>') + (it.material_code || '') + '</b></span>'}
                        </div>
                    </td>
                    <td class="py-3 px-3 min-w-[200px]">
                        <input type="text" value="${it.raw_name || ''}" placeholder="Tên trên HĐ" class="liquid-input py-1.5 px-2.5 text-xs w-full text-slate-200 font-medium review-raw-name" />
                    </td>
                    <td class="py-3 px-2 min-w-[110px]">
                        <input type="number" step="any" min="0" value="${it.quantity || 1}" class="liquid-input py-1.5 px-2 text-sm w-full font-mono font-bold text-sky-400 text-center review-qty" oninput="Admin.onReviewQtyChanged(this)" />
                    </td>
                    <td class="py-3 px-2 min-w-[80px]">
                        <input type="text" value="${it.unit || 'kg'}" class="liquid-input py-1.5 px-2 text-xs w-full font-bold text-slate-200 text-center review-unit" />
                    </td>
                    <td class="py-3 px-2 min-w-[150px]">
                        <input type="number" step="any" min="0" value="${Math.round((Number(it.unit_price || 0) > 0) ? it.unit_price : ((Number(it.quantity || 0) > 0 && Number(it.total_cost || 0) > 0) ? (Number(it.total_cost) / Number(it.quantity)) : 0))}" class="liquid-input py-1.5 px-2.5 text-xs w-full font-mono font-bold ${it.price_warning ? 'text-amber-300 border-amber-400/50' : 'text-emerald-400'} text-right review-price" oninput="Admin.onReviewPriceChanged(this)" title="Đơn giá mua" />
                        ${it.price_warning ? `<div class="mt-1 text-[10px] text-amber-300 font-semibold text-right whitespace-nowrap" title="Đơn giá chênh lệch bất thường so với giá vốn cũ"><i class="fas fa-triangle-exclamation mr-1"></i>Lệch giá cũ (${Math.round(it.prev_cost_price || 0).toLocaleString('vi-VN')}đ)</div>` : ''}
                    </td>
                    <td class="py-3 px-2 min-w-[170px]">
                        <input type="number" step="any" min="0" value="${Math.round(it.total_cost || 0)}" class="liquid-input py-1.5 px-2.5 text-xs w-full font-mono font-black text-emerald-300 text-right review-line-total-input" oninput="Admin.onReviewTotalChanged(this)" title="Nhập thành tiền → Tự động tính đơn giá = Thành tiền ÷ Số lượng" />
                    </td>
                    <td class="py-3 px-2 text-center w-[48px]">
                        <button type="button" onclick="Admin.removeReviewRow(this)" class="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg text-xs transition-colors" title="Xóa dòng này">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this.calcReviewTotals();
    },

    addReviewRow() {
        const tbody = document.getElementById('review-items-tbody');
        if (!tbody) return;

        // Xóa placeholder nếu bảng đang rỗng
        if (tbody.querySelector('td[colspan]')) {
            tbody.innerHTML = '';
        }

        const optionsHtml = this.materialsList.map(m => 
            `<option value="${m.id}" data-unit="${m.unit}">${m.code} - ${m.name}</option>`
        ).join('');

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition-colors border-b border-white/5 review-row';
        tr.dataset.isNew = '0';
        tr.innerHTML = `
            <td class="py-3 px-3 min-w-[320px]">
                <select class="liquid-input py-1.5 px-2.5 text-xs w-full review-mat-select font-semibold text-sky-300" onchange="Admin.onReviewMatChanged(this)">
                    <option value="__NEW__" class="text-amber-300 font-bold">${window.cnxT?window.cnxT('js.s_inv.56ea954b','✨ [Tạo Mới Kho]'):'✨ [Tạo Mới Kho]'}</option>
                    ${optionsHtml}
                </select>
                <div class="mt-1.5 flex items-center gap-1.5">
                    <span class="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold whitespace-nowrap"><i class="fas fa-hand-pointer text-[9px] mr-1"></i>${window.cnxT?window.cnxT('js.s_inv.41ecc29e','Thủ công'):'Thủ công'}</span>
                </div>
            </td>
            <td class="py-3 px-3 min-w-[200px]">
                <input type="text" placeholder="Tên hàng ghi trên HĐ" class="liquid-input py-1.5 px-2.5 text-xs w-full text-slate-200 font-medium review-raw-name" />
            </td>
            <td class="py-3 px-2 min-w-[110px]">
                <input type="number" step="any" min="0" value="1" class="liquid-input py-1.5 px-2 text-sm w-full font-mono font-bold text-sky-400 text-center review-qty" oninput="Admin.onReviewQtyChanged(this)" />
            </td>
            <td class="py-3 px-2 min-w-[80px]">
                <input type="text" value="${this.materialsList[0]?.unit || 'kg'}" class="liquid-input py-1.5 px-2 text-xs w-full font-bold text-slate-200 text-center review-unit" />
            </td>
            <td class="py-3 px-2 min-w-[150px]">
                <input type="number" step="any" min="0" value="${Math.round(this.materialsList[0]?.cost_price || 0)}" class="liquid-input py-1.5 px-2.5 text-xs w-full font-mono font-bold text-emerald-400 text-right review-price" oninput="Admin.onReviewPriceChanged(this)" title="Đơn giá mua" />
            </td>
            <td class="py-3 px-2 min-w-[170px]">
                <input type="number" step="any" min="0" value="${Math.round(this.materialsList[0]?.cost_price || 0)}" class="liquid-input py-1.5 px-2.5 text-xs w-full font-mono font-black text-emerald-300 text-right review-line-total-input" oninput="Admin.onReviewTotalChanged(this)" title="Nhập thành tiền → Tự tính đơn giá = Thành tiền ÷ Số lượng" />
            </td>
            <td class="py-3 px-2 text-center w-[48px]">
                <button type="button" onclick="Admin.removeReviewRow(this)" class="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg text-xs transition-colors" title="Xóa dòng này">
                    <i class="fas fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
        this.calcReviewTotals();
    },

    onReviewMatChanged(selectElem) {
        const tr = selectElem.closest('tr');
        if (!tr) return;
        const val = selectElem.value;
        const isNew = (val === '__NEW__');
        tr.dataset.isNew = isNew ? '1' : '0';

        if (isNew) {
            selectElem.className = 'liquid-input py-1 text-xs w-full review-mat-select font-semibold text-amber-300';
        } else {
            selectElem.className = 'liquid-input py-1 text-xs w-full review-mat-select font-semibold text-sky-300';
            const opt = selectElem.selectedOptions[0];
            const unit = opt?.dataset.unit;
            if (unit) {
                const unitInput = tr.querySelector('.review-unit');
                if (unitInput) unitInput.value = unit;
            }
        }
        this.calcReviewTotals();
    },

    // Đổi số lượng: nếu đã có Thành tiền → Đơn giá = Thành tiền ÷ Số lượng; ngược lại Thành tiền = SL × Đơn giá
    onReviewQtyChanged(input) {
        const tr = input.closest('tr');
        if (!tr) return;
        const qty = parseFloat(input.value || 0);
        const priceInput = tr.querySelector('.review-price');
        const totalInput = tr.querySelector('.review-line-total-input');
        const total = parseFloat(totalInput?.value || 0);
        if (qty > 0 && total > 0) {
            if (priceInput) priceInput.value = Math.round(total / qty);
        } else if (totalInput) {
            totalInput.value = Math.round(qty * parseFloat(priceInput?.value || 0));
        }
        this.calcReviewTotals();
    },

    // Đổi đơn giá: Thành tiền = SL × Đơn giá
    onReviewPriceChanged(input) {
        const tr = input.closest('tr');
        if (!tr) return;
        const qty = parseFloat(tr.querySelector('.review-qty')?.value || 0);
        const totalInput = tr.querySelector('.review-line-total-input');
        if (totalInput) totalInput.value = Math.round(qty * parseFloat(input.value || 0));
        this.calcReviewTotals();
    },

    // Đổi thành tiền: Đơn giá = Thành tiền ÷ Số lượng
    onReviewTotalChanged(input) {
        const tr = input.closest('tr');
        if (!tr) return;
        const qty = parseFloat(tr.querySelector('.review-qty')?.value || 0);
        const priceInput = tr.querySelector('.review-price');
        const total = parseFloat(input.value || 0);
        if (qty > 0 && priceInput) priceInput.value = Math.round(total / qty);
        this.calcReviewTotals();
    },

    removeReviewRow(btn) {
        const tr = btn.closest('tr');
        if (tr) tr.remove();
        this.calcReviewTotals();
    },

    calcReviewTotals() {
        if (this.importState.method === 'manual') return;

        const rows = document.querySelectorAll('#review-items-tbody tr.review-row');
        let totalCost = 0;
        let count = 0;

        rows.forEach(tr => {
            const qty = parseFloat(tr.querySelector('.review-qty')?.value || 0);
            const price = parseFloat(tr.querySelector('.review-price')?.value || 0);
            const totalInput = tr.querySelector('.review-line-total-input');
            // Ưu tiên thành tiền ghi trên hóa đơn (nếu có), nếu không thì = SL × Đơn giá
            let lineTotal = totalInput ? parseFloat(totalInput.value || 0) : Math.round(qty * price);
            if (!(lineTotal > 0)) lineTotal = Math.round(qty * price);
            totalCost += lineTotal;
            if (qty > 0) count++;

            const totalSpan = tr.querySelector('.review-line-total');
            if (totalSpan) totalSpan.innerText = this.formatMoney(lineTotal) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
        });

        const countElem = document.getElementById('import-footer-item-count');
        const costElem = document.getElementById('import-footer-total-cost');
        if (countElem) countElem.innerText = count;
        if (costElem) costElem.innerText = this.formatMoney(totalCost) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
        this.updateImportPaymentSummary();
    },

    // --- XÁC NHẬN NHẬP KHO HÀNG LOẠT ---
    async commitSmartImport() {
        const method = this.importState.method;
        let supplier = '';
        let invoiceNo = '';
        let note = '';
        let items = [];
        let paidAmount = 0;
        let paymentMethod = 'cash';
        let dueDate = '';

        if (method === 'manual') {
            supplier = document.getElementById('manual-import-supplier')?.value.trim() || '';
            invoiceNo = document.getElementById('manual-import-invoice-no')?.value.trim() || '';
            note = document.getElementById('manual-import-note')?.value.trim() || (window.cnxT?window.cnxT('js.s_inv.f4db53f2','Nhập kho thủ công'):'Nhập kho thủ công');
            paidAmount = parseFloat(document.getElementById('manual-import-paid')?.value || 0) || 0;
            paymentMethod = document.getElementById('manual-import-payment-method')?.value || 'cash';
            dueDate = document.getElementById('manual-import-due-date')?.value || '';

            const rows = document.querySelectorAll('#manual-import-tbody tr');
            rows.forEach(tr => {
                const sel = tr.querySelector('.manual-row-mat');
                const matId = parseInt(sel?.value || 0);
                const opt = sel?.selectedOptions[0];
                const name = opt?.dataset.name || '';
                const code = opt?.dataset.code || '';
                const qty = parseFloat(tr.querySelector('.manual-row-qty')?.value || 0);
                const unit = tr.querySelector('.manual-row-unit')?.innerText || 'kg';
                const price = parseFloat(tr.querySelector('.manual-row-price')?.value || 0);

                if (matId > 0 && qty > 0) {
                    items.push({
                        material_id: matId,
                        is_new: false,
                        name: name,
                        code: code,
                        unit: unit,
                        quantity: qty,
                        unit_price: price
                    });
                }
            });
        } else {
            supplier = document.getElementById('review-supplier-input')?.value.trim() || '';
            invoiceNo = document.getElementById('review-invoice-no-input')?.value.trim() || '';
            note = (window.cnxT?window.cnxT('js.s_inv.24b77eb9','Nhập kho bằng AI OCR chứng từ'):'Nhập kho bằng AI OCR chứng từ');
            paidAmount = parseFloat(document.getElementById('review-import-paid')?.value || 0) || 0;
            paymentMethod = document.getElementById('review-import-payment-method')?.value || 'cash';
            dueDate = document.getElementById('review-import-due-date')?.value || '';

            const rows = document.querySelectorAll('#review-items-tbody tr.review-row');
            rows.forEach(tr => {
                const sel = tr.querySelector('.review-mat-select');
                const val = sel?.value;
                const isNew = (val === '__NEW__');
                const rawName = tr.querySelector('.review-raw-name')?.value.trim() || '';
                const qty = parseFloat(tr.querySelector('.review-qty')?.value || 0);
                const unit = tr.querySelector('.review-unit')?.value.trim() || 'kg';
                const lineTotalVal = parseFloat(tr.querySelector('.review-line-total-input')?.value || 0);
                // Đơn giá chính xác (không làm tròn) = Thành tiền ÷ Số lượng để tổng tiền khớp 100% hóa đơn
                const price = (qty > 0 && lineTotalVal > 0) ? (lineTotalVal / qty) : parseFloat(tr.querySelector('.review-price')?.value || 0);

                if (qty > 0 && (rawName || !isNew)) {
                    if (isNew) {
                        items.push({
                            material_id: null,
                            is_new: true,
                            name: rawName,
                            category: (window.cnxT?window.cnxT('js.s_inv.bc5e272d','Nguyên liệu'):'Nguyên liệu'),
                            unit: unit,
                            quantity: qty,
                            unit_price: price
                        });
                    } else {
                        const matId = parseInt(val);
                        const mat = this.materialsList.find(m => m.id == matId);
                        items.push({
                            material_id: matId,
                            is_new: false,
                            name: mat ? mat.name : rawName,
                            code: mat ? mat.code : '',
                            unit: unit,
                            quantity: qty,
                            unit_price: price
                        });
                    }
                }
            });
        }

        if (items.length === 0) {
            alert((window.cnxT?window.cnxT('js.s_inv.15706762','Không có mặt hàng hợp lệ để nhập kho! Vui lòng kiểm tra lại số lượng (> 0).'):'Không có mặt hàng hợp lệ để nhập kho! Vui lòng kiểm tra lại số lượng (> 0).'));
            return;
        }

        const confirmMsg = `${window.cnxT?window.cnxT('js.s_inv.798e86bc','Xác nhận nhập'):'Xác nhận nhập'} ${items.length} ${window.cnxT?window.cnxT('js.s_inv.6363e032','mặt hàng vào kho với tổng chi phí'):'mặt hàng vào kho với tổng chi phí'} ${document.getElementById('import-footer-total-cost')?.innerText || ''}?`;
        if (!(await window.cnxConfirm(confirmMsg))) return;

        const btnSubmit = document.getElementById('btn-submit-smart-import');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = (window.cnxT?window.cnxT('js.s_inv.a93bfd78','<i class="fas fa-spinner fa-spin"></i> Đang xử lý...'):'<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');
        }

        try {
            const res = await fetch('api/operations.php?action=batch_import_materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplier: supplier,
                    invoice_no: invoiceNo,
                    invoice_image: this.importState.invoiceImageUrl,
                    note: note,
                    paid_amount: paidAmount,
                    payment_method: paymentMethod,
                    due_date: dueDate,
                    items: items
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.resetSmartImportForm();
                this.closeSmartImportModal();
                this.loadMaterials();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_inv.ba9c830f','Lỗi khi nhập kho!'):'Lỗi khi nhập kho!'));
            }
        } catch (err) {
            console.error('commitSmartImport error:', err);
            alert((window.cnxT?window.cnxT('js.s_inv.8a701429','Lỗi kết nối khi nhập kho: '):'Lỗi kết nối khi nhập kho: ') + err.message);
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = (window.cnxT?window.cnxT('js.s_inv.6a3af6d6','<i class="fas fa-check-double"></i> <span>XÁC NHẬN NHẬP KHO & LƯU CHI PHÍ</span>'):'<i class="fas fa-check-double"></i> <span>XÁC NHẬN NHẬP KHO & LƯU CHI PHÍ</span>');
            }
        }
    },

    // 8.3 Stock Transactions (Nhập kho / Xuất kho / Chi phí)
    async openStockTransactionModal(type = 'import', matId = null) {
        if (!Array.isArray(this.materialsList) || this.materialsList.length === 0) {
            try {
                const res = await fetch('api/operations.php?action=get_materials&category=all');
                const data = await res.json();
                if (data && data.success) this.materialsList = data.materials || [];
            } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_inventory.js', e) : console.debug('admin_inventory.js', e)); }
        }
        const transTypeInput = document.getElementById('modal-trans-type');
        if (transTypeInput) transTypeInput.value = type;

        const title = document.getElementById('modal-stock-trans-title');
        const actionLabel = document.getElementById('modal-trans-action-label');
        const priceContainer = document.getElementById('modal-trans-price-container');
        const totalBox = document.getElementById('modal-trans-total-box');
        const submitBtn = document.getElementById('btn-submit-stock-trans');

        if (type === 'import') {
            if (title) title.innerHTML = (window.cnxT?window.cnxT('js.s_inv.6722e086','<i class="fas fa-file-invoice-dollar text-emerald-400"></i> Lập Phiếu Nhập Kho (Chi Phí Mua Hàng)'):'<i class="fas fa-file-invoice-dollar text-emerald-400"></i> Lập Phiếu Nhập Kho (Chi Phí Mua Hàng)');
            if (actionLabel) actionLabel.innerText = (window.cnxT?window.cnxT('ui.adm_html.span_d8dabf1c','nhập'):'nhập');
            if (priceContainer) priceContainer.classList.remove('hidden');
            if (totalBox) totalBox.classList.remove('hidden');
            if (submitBtn) submitBtn.className = 'btn-glass-success text-xs py-2 px-5 font-bold flex items-center gap-1.5';
        } else {
            if (title) title.innerHTML = (window.cnxT?window.cnxT('js.s_inv.b680676b','<i class="fas fa-dolly text-rose-400"></i> Lập Phiếu Xuất Kho Sử Dụng'):'<i class="fas fa-dolly text-rose-400"></i> Lập Phiếu Xuất Kho Sử Dụng');
            if (actionLabel) actionLabel.innerText = (window.cnxT?window.cnxT('js.s_inv.a2c36890','xuất'):'xuất');
            if (priceContainer) priceContainer.classList.add('hidden');
            if (totalBox) totalBox.classList.add('hidden');
            if (submitBtn) submitBtn.className = 'btn-glass-danger text-xs py-2 px-5 font-bold flex items-center gap-1.5';
        }

        // Populate materials select
        const sel = document.getElementById('modal-trans-mat-id');
        if (sel) {
            sel.innerHTML = this.materialsList.map(m => 
                `<option value="${m.id}" data-unit="${m.unit}" data-stock="${m.quantity}" data-price="${m.cost_price}" data-sup="${m.supplier || ''}" ${matId == m.id ? 'selected' : ''}>${m.code} - ${m.name} ${window.cnxT?window.cnxT('js.s_inv.024d3b2f','(Tồn:'):'(Tồn:'} ${m.quantity} ${m.unit})</option>`
            ).join('');
        }

        document.getElementById('modal-trans-qty').value = '';
        document.getElementById('modal-trans-note').value = '';
        this.onStockMatSelected();

        document.getElementById('modal-stock-trans').classList.add('open');
    },

    onStockMatSelected() {
        const sel = document.getElementById('modal-trans-mat-id');
        const opt = sel?.selectedOptions[0];
        if (!opt) return;

        const unit = opt.dataset.unit || 'kg';
        const stock = opt.dataset.stock || '0';
        const price = opt.dataset.price || '0';
        const sup = opt.dataset.sup || '';

        const stockEl = document.getElementById('modal-trans-current-stock');
        const unitEl = document.getElementById('modal-trans-unit-label');
        const priceEl = document.getElementById('modal-trans-price');
        const supEl = document.getElementById('modal-trans-supplier');

        if (stockEl) stockEl.innerText = `${stock} ${unit}`;
        if (unitEl) unitEl.innerText = unit;
        if (priceEl && !priceEl.value) priceEl.value = price;
        if (supEl && !supEl.value) supEl.value = sup;

        this.calcTransTotal();
    },

    calcTransTotal() {
        const qty = parseFloat(document.getElementById('modal-trans-qty')?.value) || 0;
        const price = parseFloat(document.getElementById('modal-trans-price')?.value) || 0;
        const total = Math.round(qty * price);
        const totalEl = document.getElementById('modal-trans-total-cost');
        if (totalEl) totalEl.innerText = this.formatMoney(total);
    },

    closeStockTransactionModal() {
        document.getElementById('modal-stock-trans').classList.remove('open');
    },

    async submitStockTransaction(e) {
        e.preventDefault();
        const matId = parseInt(document.getElementById('modal-trans-mat-id').value);
        const type = document.getElementById('modal-trans-type').value;
        const qty = parseFloat(document.getElementById('modal-trans-qty').value);
        const price = parseFloat(document.getElementById('modal-trans-price').value) || 0;
        const sup = document.getElementById('modal-trans-supplier').value.trim();
        const note = document.getElementById('modal-trans-note').value.trim();

        if (isNaN(qty) || qty <= 0) {
            alert((window.cnxT?window.cnxT('js.s_inv.6a599b6b','Vui lòng nhập số lượng hợp lệ (> 0)!'):'Vui lòng nhập số lượng hợp lệ (> 0)!'));
            return;
        }

        try {
            const res = await fetch('api/operations.php?action=create_material_transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    material_id: matId,
                    trans_type: type,
                    quantity: qty,
                    unit_price: price,
                    supplier: sup,
                    note: note
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.closeStockTransactionModal();
                this.loadMaterials();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_inv.a5d215b5','Lỗi khi lưu phiếu kho'):'Lỗi khi lưu phiếu kho'));
            }
        } catch (err) {
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        }
    },

    // 8.3B Supplier & Debt Management
    supplierFinanceState: { suppliers: [], invoices: [], payments: [] },

    _escInvHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    openSupplierFinanceModal() {
        document.getElementById('modal-supplier-finance')?.classList.add('open');
        this.loadSupplierFinance();
    },

    closeSupplierFinanceModal() {
        document.getElementById('modal-supplier-finance')?.classList.remove('open');
    },

    async loadSupplierFinance() {
        try {
            const res = await fetch('api/operations.php?action=get_supplier_finance');
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_inv.a07fc1c7','Không thể tải dữ liệu nhà cung cấp.'):'Không thể tải dữ liệu nhà cung cấp.'));
            this.supplierFinanceState = {
                suppliers: data.suppliers || [],
                invoices: data.invoices || [],
                payments: data.payments || []
            };
            const summary = data.summary || {};
            document.getElementById('supplier-total-purchases').innerText = this.formatMoney(summary.total_purchases || 0) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            document.getElementById('supplier-total-paid').innerText = this.formatMoney(summary.total_paid || 0) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');
            document.getElementById('supplier-total-outstanding').innerText = this.formatMoney(summary.total_outstanding || 0) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');

            const supplierBody = document.getElementById('supplier-list-tbody');
            supplierBody.innerHTML = this.supplierFinanceState.suppliers.length
                ? this.supplierFinanceState.suppliers.map(s => `
                    <tr class="hover:bg-white/5">
                        <td class="p-2 font-semibold text-slate-100">${this._escInvHtml(s.name)}</td>
                        <td class="p-2 text-slate-300">${this._escInvHtml(s.contact_name || '-')}</td>
                        <td class="p-2 text-slate-300">${this._escInvHtml(s.phone || '-')}<br><span class="text-slate-500">${this._escInvHtml(s.email || '')}</span></td>
                        <td class="p-2 text-right font-mono ${Number(s.outstanding_balance) > 0 ? 'text-rose-300' : 'text-emerald-300'}">${this.formatMoney(s.outstanding_balance || 0)} đ</td>
                        <td class="p-2 text-right"><button type="button" class="text-sky-300 hover:text-sky-100" onclick="Admin.editSupplier(${Number(s.id)})">${window.cnxT?window.cnxT('js.s_inv.3d5c572b','Sửa'):'Sửa'}</button></td>
                    </tr>`).join('')
                : (window.cnxT?window.cnxT('js.s_inv.dbd42e8a','<tr><td colspan="5" class="p-4 text-center text-slate-500">Chưa có nhà cung cấp.</td></tr>'):'<tr><td colspan="5" class="p-4 text-center text-slate-500">Chưa có nhà cung cấp.</td></tr>');

            const invoiceBody = document.getElementById('supplier-invoices-tbody');
            const statusLabels = { unpaid: (window.cnxT?window.cnxT('js.s_inv.9d5347dd','Chưa thanh toán'):'Chưa thanh toán'), partial: (window.cnxT?window.cnxT('js.s_inv.463943fd','Tạm ứng / một phần'):'Tạm ứng / một phần'), paid: (window.cnxT?window.cnxT('ui.pos_html.option_405bdd67','Đã thanh toán'):'Đã thanh toán') };
            invoiceBody.innerHTML = this.supplierFinanceState.invoices.length
                ? this.supplierFinanceState.invoices.map(i => `
                    <tr class="hover:bg-white/5">
                        <td class="p-2 whitespace-nowrap text-slate-300">${this._escInvHtml(i.created_at || '')}<br><span class="font-mono text-sky-300">${this._escInvHtml(i.invoice_code || '')}</span></td>
                        <td class="p-2">${this._escInvHtml(i.supplier_display_name || (window.cnxT?window.cnxT('js.s_inv.9e72a33a','Không rõ'):'Không rõ'))}<br><span class="text-slate-500">${this._escInvHtml(i.invoice_no || (window.cnxT?window.cnxT('js.s_inv.1d29ad68','Không có số HĐ'):'Không có số HĐ'))}</span></td>
                        <td class="p-2 text-right font-mono">${this.formatMoney(i.total_amount || 0)} đ</td>
                        <td class="p-2 text-right font-mono text-emerald-300">${this.formatMoney(i.paid_amount || 0)} đ</td>
                        <td class="p-2 text-right font-mono ${Number(i.remaining_amount) > 0 ? 'text-rose-300' : 'text-slate-400'}">${this.formatMoney(i.remaining_amount || 0)} đ</td>
                        <td class="p-2 text-center whitespace-nowrap">${this._escInvHtml(i.due_date || '-')}</td>
                        <td class="p-2 text-center"><span class="px-2 py-1 rounded-full ${i.payment_status === 'paid' ? 'bg-emerald-500/15 text-emerald-300' : (i.payment_status === 'partial' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300')}">${statusLabels[i.payment_status] || i.payment_status}</span></td>
                        <td class="p-2 text-right">${Number(i.remaining_amount) > 0 ? `<button type="button" class="btn-glass-success py-1 px-2 text-[10px]" onclick="Admin.openSupplierPayment(${Number(i.id)})">${window.cnxT?window.cnxT('js.s_inv.654855f6','Thanh toán'):'Thanh toán'}</button>` : ''}</td>
                    </tr>`).join('')
                : (window.cnxT?window.cnxT('js.s_inv.38f257ab','<tr><td colspan="8" class="p-4 text-center text-slate-500">Chưa có hóa đơn nhập kho.</td></tr>'):'<tr><td colspan="8" class="p-4 text-center text-slate-500">Chưa có hóa đơn nhập kho.</td></tr>');

            const paymentsList = document.getElementById('supplier-payments-list');
            paymentsList.innerHTML = this.supplierFinanceState.payments.length
                ? this.supplierFinanceState.payments.map(p => `
                    <div class="flex flex-wrap justify-between gap-2 p-2 rounded-lg bg-slate-900/60 border border-white/5">
                        <span class="text-slate-300">${this._escInvHtml(p.paid_at || '')} · ${this._escInvHtml(p.supplier_name || '')} · ${this._escInvHtml(p.invoice_code || '')} · ${this._escInvHtml(p.payment_method || 'cash')}${p.reference ? ` · ${this._escInvHtml(p.reference)}` : ''}${p.paid_by_name ? ` · ${this._escInvHtml(p.paid_by_name)}` : ''}</span>
                        <b class="text-emerald-300 font-mono">${this.formatMoney(p.amount || 0)} đ</b>
                    </div>`).join('')
                : (window.cnxT?window.cnxT('js.s_inv.f169dde6','<div class="p-3 text-center text-slate-500">Chưa có giao dịch thanh toán.</div>'):'<div class="p-3 text-center text-slate-500">Chưa có giao dịch thanh toán.</div>');
        } catch (error) {
            console.error('loadSupplierFinance error:', error);
            alert(error.message || (window.cnxT?window.cnxT('js.s_inv.be124c7c','Lỗi tải dữ liệu công nợ nhà cung cấp.'):'Lỗi tải dữ liệu công nợ nhà cung cấp.'));
        }
    },

    resetSupplierForm() {
        document.getElementById('form-supplier')?.reset();
        document.getElementById('supplier-form-id').value = '';
        document.getElementById('supplier-form-submit').innerText = (window.cnxT?window.cnxT('ui.admin_html.button_93d06faf','Thêm nhà cung cấp'):'Thêm nhà cung cấp');
    },

    editSupplier(id) {
        const supplier = this.supplierFinanceState.suppliers.find(item => Number(item.id) === Number(id));
        if (!supplier) return;
        document.getElementById('supplier-form-id').value = supplier.id;
        document.getElementById('supplier-form-name').value = supplier.name || '';
        document.getElementById('supplier-form-contact').value = supplier.contact_name || '';
        document.getElementById('supplier-form-phone').value = supplier.phone || '';
        document.getElementById('supplier-form-email').value = supplier.email || '';
        document.getElementById('supplier-form-address').value = supplier.address || '';
        document.getElementById('supplier-form-note').value = supplier.note || '';
        document.getElementById('supplier-form-submit').innerText = (window.cnxT?window.cnxT('js.s_inv.237a16ad','Lưu thay đổi'):'Lưu thay đổi');
        document.getElementById('supplier-form-name').focus();
    },

    async submitSupplier(event) {
        event.preventDefault();
        const payload = {
            id: Number(document.getElementById('supplier-form-id').value || 0),
            name: document.getElementById('supplier-form-name').value.trim(),
            contact_name: document.getElementById('supplier-form-contact').value.trim(),
            phone: document.getElementById('supplier-form-phone').value.trim(),
            email: document.getElementById('supplier-form-email').value.trim(),
            address: document.getElementById('supplier-form-address').value.trim(),
            note: document.getElementById('supplier-form-note').value.trim()
        };
        try {
            const res = await fetch('api/operations.php?action=save_supplier', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_inv.d4b263e2','Không thể lưu nhà cung cấp.'):'Không thể lưu nhà cung cấp.'));
            this.resetSupplierForm();
            await this.loadSupplierFinance();
        } catch (error) {
            alert(error.message || (window.cnxT?window.cnxT('js.s_inv.8b0d9b4a','Lỗi kết nối máy chủ.'):'Lỗi kết nối máy chủ.'));
        }
    },

    openSupplierPayment(invoiceId) {
        const invoice = this.supplierFinanceState.invoices.find(item => Number(item.id) === Number(invoiceId));
        if (!invoice) return;
        const balance = Number(invoice.remaining_amount) || 0;
        document.getElementById('supplier-payment-invoice-id').value = invoice.id;
        document.getElementById('supplier-payment-amount').value = '';
        document.getElementById('supplier-payment-amount').max = balance;
        document.getElementById('supplier-payment-reference').value = '';
        document.getElementById('supplier-payment-note').value = '';
        document.getElementById('supplier-payment-invoice-label').innerText =
            `${invoice.supplier_display_name || (window.cnxT?window.cnxT('ui.admin_html.th_3d6795ec','Nhà cung cấp'):'Nhà cung cấp')} · ${invoice.invoice_code} ${window.cnxT?window.cnxT('js.s_inv.ebd19a9f','· Còn nợ'):'· Còn nợ'} ${this.formatMoney(balance)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
        document.getElementById('modal-supplier-payment').classList.add('open');
    },

    closeSupplierPaymentModal() {
        document.getElementById('modal-supplier-payment')?.classList.remove('open');
    },

    async submitSupplierPayment(event) {
        event.preventDefault();
        const payload = {
            invoice_id: Number(document.getElementById('supplier-payment-invoice-id').value),
            amount: Number(document.getElementById('supplier-payment-amount').value),
            payment_method: document.getElementById('supplier-payment-method').value,
            reference: document.getElementById('supplier-payment-reference').value.trim(),
            note: document.getElementById('supplier-payment-note').value.trim()
        };
        try {
            const res = await fetch('api/operations.php?action=record_supplier_payment', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_inv.e74deb16','Không thể ghi nhận thanh toán.'):'Không thể ghi nhận thanh toán.'));
            this.closeSupplierPaymentModal();
            await this.loadSupplierFinance();
        } catch (error) {
            alert(error.message || (window.cnxT?window.cnxT('js.s_inv.8b0d9b4a','Lỗi kết nối máy chủ.'):'Lỗi kết nối máy chủ.'));
        }
    },

    // 8.4 Material History & Expenses
    openMaterialHistoryModal() {
        document.getElementById('modal-material-history').classList.add('open');
        this.loadMaterialHistory();
    },

    closeMaterialHistoryModal() {
        document.getElementById('modal-material-history').classList.remove('open');
    },

    async loadMaterialHistory() {
        const period = document.getElementById('hist-period-select')?.value || 'month';
        const type = document.getElementById('hist-type-select')?.value || 'all';

        try {
            const res = await fetch(`api/operations.php?action=get_transactions&period=${period}&type=${type}`);
            const data = await res.json();
            if (!data.success) return;

            const totalDisplay = document.getElementById('hist-total-cost-display');
            if (totalDisplay) totalDisplay.innerText = this.formatMoney(data.total_expense) + (window.cnxT?window.cnxT('js.m_sa.fce50cf4',' đ'):' đ');

            const tbody = document.getElementById('hist-transactions-tbody');
            if (!tbody) return;

            if (!data.transactions || data.transactions.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-400">${window.cnxT?window.cnxT('js.s_inv.3f51c6f1','Không có phiếu nhập/xuất kho nào trong kỳ này.'):'Không có phiếu nhập/xuất kho nào trong kỳ này.'}</td></tr>`;
                return;
            }

            const typeBadges = {
                import: (window.cnxT?window.cnxT('js.s_inv.12ecee0f','<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">Nhập kho</span>'):'<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">Nhập kho</span>'),
                export: (window.cnxT?window.cnxT('js.s_inv.4ea99f4c','<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">Xuất kho</span>'):'<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">Xuất kho</span>'),
                adjustment: (window.cnxT?window.cnxT('js.s_inv.b67f154f','<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold text-[10px]">Cân chỉnh</span>'):'<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold text-[10px]">Cân chỉnh</span>'),
                sale_deduct: '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">Trừ bán hàng</span>',
                sale_restore: '<span class="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold text-[10px]">Hoàn kho hủy</span>',
                loss: '<span class="px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-[10px]">Xuất hủy / Hao hụt</span>',
                waste: '<span class="px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-[10px]">Hao hụt</span>'
            };

            tbody.innerHTML = data.transactions.map(t => `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">${window.formatDateDDMMYY(t.created_at, true)}</td>
                    <td class="py-3 px-3 font-mono text-sky-300 font-bold whitespace-nowrap">${this._escInvHtml(t.trans_code)}</td>
                    <td class="py-3 px-3 whitespace-nowrap text-center">${typeBadges[t.trans_type] || this._escInvHtml(t.trans_type)}</td>
                    <td class="py-3 px-3 font-bold text-slate-200 min-w-[200px]">${this._escInvHtml(t.material_name)}</td>
                    <td class="py-3 px-3 font-mono font-bold text-slate-100 whitespace-nowrap text-center">${this._escInvHtml(t.quantity)} ${this._escInvHtml(t.unit)}</td>
                    <td class="py-3 px-3 font-mono text-slate-300 whitespace-nowrap text-right">${t.trans_type === 'import' ? Admin.formatMoney(t.unit_price) + ' đ' : '-'}</td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">${t.trans_type === 'import' ? Admin.formatMoney(t.total_cost) + ' đ' : '-'}</td>
                    <td class="py-3 px-3 text-slate-300 text-xs min-w-[150px]">${this._escInvHtml(t.supplier || '-')}</td>
                    <td class="py-3 px-3 text-slate-400 text-xs whitespace-nowrap">${this._escInvHtml(t.user_name || 'Admin')}</td>
                </tr>
            `).join('');
        } catch (e) {
            console.error('loadMaterialHistory error:', e);
        }
    },

    // 8.5 Payroll & Timekeeping
    _hrNotify(msg, type = 'info') {
        if (typeof this.showToast === 'function') {
            this.showToast(msg, type);
        } else {
            alert(msg);
        }
    },

    _payrollFilterParams() {
        const month = document.getElementById('payroll-month-input')?.value || '';
        const uid = document.getElementById('att-filter-user')?.value || '0';
        const q = (document.getElementById('att-filter-q')?.value || '').trim();
        const fromDate = document.getElementById('att-filter-from')?.value || '';
        const toDate = document.getElementById('att-filter-to')?.value || '';
        const statusFilter = document.getElementById('att-filter-status')?.value || '';

        const params = new URLSearchParams();
        if (month) params.set('month', month);
        if (uid && uid !== '0') params.set('user_id', uid);
        if (q) params.set('search', q);
        if (fromDate) params.set('from_date', fromDate);
        if (toDate) params.set('to_date', toDate);
        if (statusFilter) params.set('status', statusFilter);
        return params;
    },

    async loadPayroll(page = 1) {
        const monthInput = document.getElementById('payroll-month-input');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${y}-${m}`;
        }

        try {
            this.loadShiftSettings();
            const params = this._payrollFilterParams();
            params.set('page', String(Math.max(1, page || 1)));
            params.set('page_size', '50');

            const res = await fetch(`api/operations.php?action=get_payroll&${params.toString()}`);
            const data = await res.json();
            if (!data.success) return;

            this._payrollCycle = data.cycle || null;
            this._payrollMonth = data.month || monthInput?.value || '';
            this._payrollSummaryList = data.payroll_summary || [];
            this._allAttendanceRecords = data.attendance_records || [];
            this._attTotalRecords = Number(data.total_records ?? this._allAttendanceRecords.length);
            this._attPage = Number(data.page || page || 1);
            this._attPageSize = Number(data.page_size || 50);

            // KPI
            const totalHoursEl = document.getElementById('payroll-total-hours');
            const totalOtEl = document.getElementById('payroll-total-ot');
            const totalSalaryEl = document.getElementById('payroll-total-salary');
            if (totalHoursEl) totalHoursEl.innerText = `${data.total_company_hours || 0} h`;
            if (totalOtEl) totalOtEl.innerText = `${data.total_company_ot_hours || 0} h`;
            if (totalSalaryEl) totalSalaryEl.innerText = `${this.formatMoney(data.total_company_salary)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;

            this.renderPayrollCycleBar(this._payrollCycle, this._payrollMonth);
            this.renderPayrollSummaryTable();
            this.populateAttendanceUserFilter();
            this.renderAttendanceRecords();
        } catch (e) {
            console.error('loadPayroll error:', e);
        }
    },

    renderPayrollCycleBar(cycle, month) {
        const badge = document.getElementById('payroll-cycle-badge');
        const meta = document.getElementById('payroll-cycle-meta');
        const btnSave = document.getElementById('btn-payroll-save-cycle');
        const btnLock = document.getElementById('btn-payroll-lock-cycle');
        const btnUnlock = document.getElementById('btn-payroll-unlock-cycle');
        const btnPaid = document.getElementById('btn-payroll-mark-paid');

        const status = cycle?.status || '';
        const setVisible = (el, show) => { if (el) el.classList.toggle('hidden', !show); };

        if (!cycle) {
            if (badge) {
                badge.className = 'px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-white/10 font-bold text-[11px]';
                badge.textContent = (window.cnxT?window.cnxT('js.s_inv.8f684999','Chưa chốt nháp'):'Chưa chốt nháp');
            }
            if (meta) meta.textContent = `${window.cnxT?window.cnxT('js.s_inv.907445f1','Bảng lương tháng'):'Bảng lương tháng'} ${month || ''} đang tính trực tiếp (live). Bấm "Chốt / Cập Nhật Nháp" để lưu snapshot.`;
            setVisible(btnSave, true);
            setVisible(btnLock, false);
            setVisible(btnUnlock, false);
            setVisible(btnPaid, false);
            return;
        }

        if (status === 'paid') {
            if (badge) {
                badge.className = 'px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[11px]';
                badge.textContent = (window.cnxT?window.cnxT('js.s_inv.8ead190a','✅ Đã Chi Trả Lương'):'✅ Đã Chi Trả Lương');
            }
            if (meta) meta.textContent = `${window.cnxT?window.cnxT('js.s_inv.678f3e09','Chi bởi'):'Chi bởi'} ${cycle.paid_by || 'Admin'} ${window.cnxT?window.cnxT('js.s_inv.420f547b','lúc'):'lúc'} ${cycle.paid_at || ''} ${window.cnxT?window.cnxT('js.s_inv.2c4a75bd','• Tổng chi:'):'• Tổng chi:'} ${this.formatMoney(cycle.total_net)} ${window.cnxT?window.cnxT('js.s_adm.b4be420b','đ ('):'đ ('}${cycle.total_staff || 0} NV)`;
            setVisible(btnSave, false);
            setVisible(btnLock, false);
            setVisible(btnUnlock, false);
            setVisible(btnPaid, false);
        } else if (status === 'locked') {
            if (badge) {
                badge.className = 'px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[11px]';
                badge.textContent = (window.cnxT?window.cnxT('js.s_inv.ff452ebd','🔒 Đã Khóa Sổ Công & Lương'):'🔒 Đã Khóa Sổ Công & Lương');
            }
            if (meta) meta.textContent = `${window.cnxT?window.cnxT('js.s_inv.da81fd4f','Khóa bởi'):'Khóa bởi'} ${cycle.locked_by || 'Admin'} ${window.cnxT?window.cnxT('js.s_inv.420f547b','lúc'):'lúc'} ${cycle.locked_at || ''} ${window.cnxT?window.cnxT('js.s_inv.95ea513f','• Tổng thực lĩnh:'):'• Tổng thực lĩnh:'} ${this.formatMoney(cycle.total_net)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}`;
            setVisible(btnSave, false);
            setVisible(btnLock, false);
            setVisible(btnUnlock, true);
            setVisible(btnPaid, true);
        } else {
            if (badge) {
                badge.className = 'px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-[11px]';
                badge.textContent = (window.cnxT?window.cnxT('js.s_inv.d946046b','📝 Đang Nháp (Có thể chỉnh sửa)'):'📝 Đang Nháp (Có thể chỉnh sửa)');
            }
            if (meta) meta.textContent = `${window.cnxT?window.cnxT('js.s_inv.d61e3372','Cập nhật lúc'):'Cập nhật lúc'} ${cycle.updated_at || ''} ${window.cnxT?window.cnxT('js.s_inv.fd6ef22d','• Tổng thực lĩnh nháp:'):'• Tổng thực lĩnh nháp:'} ${this.formatMoney(cycle.total_net)} ${window.cnxT?window.cnxT('js.s_adm.b4be420b','đ ('):'đ ('}${cycle.total_staff || 0} NV)`;
            setVisible(btnSave, true);
            setVisible(btnLock, true);
            setVisible(btnUnlock, false);
            setVisible(btnPaid, true);
        }
    },

    renderPayrollSummaryTable() {
        const sumTbody = document.getElementById('payroll-summary-tbody');
        if (!sumTbody) return;
        const list = this._payrollSummaryList || [];
        if (list.length === 0) {
            sumTbody.innerHTML = this.renderEmptyState(9, 'fa-money-bill-wave', (window.cnxT?window.cnxT('js.s_inv.681503d1','Chưa có bảng lương'):'Chưa có bảng lương'), (window.cnxT?window.cnxT('js.s_inv.de24c99a','Không có dữ liệu tổng hợp lương trong tháng đã chọn.'):'Không có dữ liệu tổng hợp lương trong tháng đã chọn.'));
            return;
        }

        const roleLabels = {
            admin: (window.cnxT?window.cnxT('js.s_inv.33f5c5d9','Quản Trị (ADM)'):'Quản Trị (ADM)'),
            cashier: (window.cnxT?window.cnxT('js.s_inv.7abc5668','Thu Ngân (ACC)'):'Thu Ngân (ACC)'),
            waiter: (window.cnxT?window.cnxT('js.s_inv.231922c7','Phục Vụ (STF)'):'Phục Vụ (STF)'),
            kitchen: (window.cnxT?window.cnxT('js.s_inv.ba2be31d','Tổ Bếp (KIT)'):'Tổ Bếp (KIT)'),
            customer: (window.cnxT?window.cnxT('js.s_inv.0e4664df','Khách Hàng'):'Khách Hàng')
        };
        const isLocked = this._payrollCycle && this._payrollCycle.status && this._payrollCycle.status !== 'draft';

        sumTbody.innerHTML = list.map(ps => {
            const adjBonus = Number(ps.kpi_bonus || 0) + Number(ps.allowance || 0);
            const adjDed = Number(ps.advance_deduction || 0) + Number(ps.penalty || 0);
            const hasOt = Number(ps.overtime_hours || 0) > 0 || Number(ps.overtime_pay || 0) > 0;
            const inactiveBadge = (ps.user_status && ps.user_status !== 'active')
                ? '<span class="ml-1 px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[9px] font-semibold">Đã nghỉ</span>'
                : '';
            const paidBadge = ps.is_paid
                ? '<span class="block text-[10px] text-emerald-300 font-semibold mt-0.5">✓ Đã chi lương</span>'
                : '';

            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-2.5 px-3 font-mono font-bold text-sky-400">${this._escInvHtml(ps.user_code || `NV${ps.user_id}`)}</td>
                    <td class="py-2.5 px-3 font-bold text-slate-100">${this._escInvHtml(ps.fullname)}${inactiveBadge}</td>
                    <td class="py-2.5 px-3 text-slate-300 text-xs">${this._escInvHtml(roleLabels[ps.role] || ps.role)}</td>
                    <td class="py-2.5 px-3 font-mono font-bold text-amber-400">${Admin.formatMoney(ps.hourly_rate)} đ/h</td>
                    <td class="py-2.5 px-3 font-mono text-slate-300">
                        <div>${ps.total_shifts} ca • <b class="text-sky-300">${ps.total_hours}h</b></div>
                        ${hasOt ? `<div class="text-[10px] text-amber-300">Thường: ${ps.regular_hours || 0}h | OT: ${ps.overtime_hours || 0}h</div>` : ''}
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono text-slate-200">
                        <div>${Admin.formatMoney(ps.base_pay ?? ps.total_salary)} đ</div>
                        ${hasOt ? `<div class="text-[10px] text-amber-300">+${Admin.formatMoney(ps.overtime_pay || 0)}đ OT</div>` : ''}
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono text-[11px]">
                        <div class="text-emerald-300">+${Admin.formatMoney(adjBonus)}đ <span class="text-slate-500">(${ps.kpi_score || 0}đ KPI)</span></div>
                        ${adjDed > 0 ? `<div class="text-rose-300">-${Admin.formatMoney(adjDed)}đ</div>` : (window.cnxT?window.cnxT('js.s_inv.57233144','<div class="text-slate-500">-0đ</div>'):'<div class="text-slate-500">-0đ</div>')}
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                        ${Admin.formatMoney(ps.net_pay ?? ps.total_salary)} ${window.cnxT?window.cnxT('ui.adm_html.span_e53c1767','đ'):'đ'}
                        ${paidBadge}
                    </td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap">
                        <div class="inline-flex items-center gap-1">
                            <button type="button" onclick="Admin.openSalaryModal(${ps.user_id})" class="btn-glass text-[11px] py-1 px-2 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/30 font-bold" title="Cập nhật mức lương / giờ">
                                <i class="fas fa-coins"></i>
                            </button>
                            <button type="button" ${isLocked ? 'disabled' : ''} onclick="Admin.openPayrollAdjustModal(${ps.user_id})" class="btn-glass text-[11px] py-1 px-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border-indigo-500/30 font-bold ${isLocked ? 'opacity-40 cursor-not-allowed' : ''}" title="${isLocked ? 'Kỳ lương đã khóa sổ' : (window.cnxT?window.cnxT('js.s_inv.30a1022d','Điều chỉnh KPI / Phụ cấp / Ứng / Phạt'):'Điều chỉnh KPI / Phụ cấp / Ứng / Phạt')}">
                                <i class="fas fa-sliders"></i>
                            </button>
                            <button type="button" onclick="Admin.printPayslip(${ps.user_id})" class="btn-glass text-[11px] py-1 px-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border-emerald-500/30 font-bold" title="In phiếu lương cá nhân">
                                <i class="fas fa-print"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    _splitStaffNameAndDept(rawName, roleHint) {
        const raw = String(rawName || '').trim();
        let name = raw;
        let dept = '';

        const parenMatch = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        if (parenMatch) {
            name = parenMatch[1].trim();
            dept = parenMatch[2].trim();
        }

        if (!dept) {
            const low = raw.toLowerCase();
            if (low.includes('pha chế') || low.includes('bếp')) dept = (window.cnxT?window.cnxT('js.s_inv.8b05b68f','Tổ Pha Chế & Bếp'):'Tổ Pha Chế & Bếp');
            else if (low.includes('thu ngân')) dept = (window.cnxT?window.cnxT('ui.admin_html.th_532cc479','Thu Ngân'):'Thu Ngân');
            else if (low.includes('chạy bàn') || low.includes('phục vụ')) dept = (window.cnxT?window.cnxT('ui.adm_html.span_2b11c9eb','Phục Vụ'):'Phục Vụ');
            else if (roleHint) {
                const roleDeptMap = {
                    admin: (window.cnxT?window.cnxT('ui.admin_html.button_5b258876','Quản Lý'):'Quản Lý'),
                    cashier: (window.cnxT?window.cnxT('ui.admin_html.th_532cc479','Thu Ngân'):'Thu Ngân'),
                    waiter: (window.cnxT?window.cnxT('ui.adm_html.span_2b11c9eb','Phục Vụ'):'Phục Vụ'),
                    kitchen: (window.cnxT?window.cnxT('js.s_inv.8b05b68f','Tổ Pha Chế & Bếp'):'Tổ Pha Chế & Bếp')
                };
                dept = roleDeptMap[roleHint] || roleHint;
            } else {
                dept = (window.cnxT?window.cnxT('ui.admin_html.button_d1f387b6','Vận Hành'):'Vận Hành');
            }
        }
        return { name: name || raw || (window.cnxT?window.cnxT('ui.admin_html.th_7a567e8e','Nhân viên'):'Nhân viên'), dept };
    },

    populateAttendanceUserFilter() {
        const sel = document.getElementById('att-filter-user');
        if (!sel) return;
        const curVal = sel.value;

        const staffMap = new Map();
        (this._payrollSummaryList || []).forEach(ps => {
            if (ps.user_id) {
                const { name } = this._splitStaffNameAndDept(ps.fullname, ps.role);
                staffMap.set(String(ps.user_id), name || ps.fullname);
            }
        });
        (this._allAttendanceRecords || []).forEach(r => {
            if (r.user_id && !staffMap.has(String(r.user_id))) {
                const { name } = this._splitStaffNameAndDept(r.user_name, r.user_role || r.role || '');
                staffMap.set(String(r.user_id), name || r.user_name);
            }
        });

        const sorted = Array.from(staffMap.entries()).sort((a, b) => a[1].localeCompare(b[1], 'vi'));
        sel.innerHTML = (window.cnxT?window.cnxT('js.s_inv.198f352e','<option value="0">Tất cả nhân viên</option>'):'<option value="0">Tất cả nhân viên</option>') +
            sorted.map(([uid, n]) => `<option value="${uid}">${this._escInvHtml(n)}</option>`).join('');
        if (curVal && (curVal === '0' || staffMap.has(curVal))) {
            sel.value = curVal;
        }

        // Also refresh user select inside #modal-edit-attendance if present
        const modalSel = document.getElementById('att-edit-user');
        if (modalSel) {
            const mCur = modalSel.value;
            modalSel.innerHTML = sorted.map(([uid, n]) => `<option value="${uid}">${this._escInvHtml(n)}</option>`).join('');
            if (mCur && staffMap.has(mCur)) modalSel.value = mCur;
        }
    },

    async loadAttendancePage(page = 1) {
        const recTbody = document.getElementById('payroll-records-tbody');
        if (!recTbody) return;
        try {
            const params = this._payrollFilterParams();
            params.set('page', String(Math.max(1, page || 1)));
            params.set('page_size', '50');
            const res = await fetch(`api/operations.php?action=get_payroll&${params.toString()}`);
            const data = await res.json();
            if (!data.success) return;

            this._allAttendanceRecords = data.attendance_records || [];
            this._attTotalRecords = Number(data.total_records ?? this._allAttendanceRecords.length);
            this._attPage = Number(data.page || page || 1);
            this._attPageSize = Number(data.page_size || 50);
            if (data.cycle !== undefined) this._payrollCycle = data.cycle;
            this.renderAttendanceRecords();
        } catch (e) {
            console.error('loadAttendancePage error:', e);
        }
    },

    renderAttendanceRecords(overrideRows = null) {
        const recTbody = document.getElementById('payroll-records-tbody');
        if (!recTbody) return;
        const pageRows = Array.isArray(overrideRows) ? overrideRows : (Array.isArray(this._allAttendanceRecords) ? this._allAttendanceRecords : []);
        const totalRecords = Array.isArray(overrideRows) ? overrideRows.length : Number(this._attTotalRecords ?? pageRows.length);
        const pageSize = Math.max(1, Number(this._attPageSize || 50));
        const curPage = Math.max(1, Number(this._attPage || 1));
        const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

        const userRoleMap = {};
        (this._payrollSummaryList || []).forEach(ps => {
            if (ps.user_id) userRoleMap[String(ps.user_id)] = ps.role || '';
        });

        const sumEl = document.getElementById('att-summary');
        if (sumEl) {
            const pageHrs = pageRows.reduce((s, r) => s + Number(r.work_hours || 0), 0);
            const pagePay = pageRows.reduce((s, r) => s + Number(r.total_pay || 0), 0);
            sumEl.innerHTML = `${totalRecords} ${window.cnxT?window.cnxT('js.s_inv.5aa5604e','lượt (hiển thị'):'lượt (hiển thị'} ${pageRows.length}) • <b class="text-sky-300 font-mono">${pageHrs.toFixed(2)}h</b> • <b class="text-emerald-300 font-mono">${this.formatMoney(pagePay)} đ</b>`;
        }

        const pdfBtn = document.getElementById('att-export-btn');
        if (pdfBtn) {
            pdfBtn.disabled = totalRecords === 0;
            pdfBtn.style.opacity = totalRecords === 0 ? '.4' : '1';
        }

        const pagerEl = document.getElementById('att-pager');
        if (pagerEl) {
            pagerEl.style.display = (!overrideRows && totalRecords > pageSize) ? 'flex' : 'none';
            const infoEl = document.getElementById('att-page-info');
            if (infoEl) infoEl.textContent = `Trang ${curPage}/${totalPages} (${totalRecords} ${window.cnxT?window.cnxT('js.s_inv.3b584e11','lượt)'):'lượt)'}`;
            const prevBtn = document.getElementById('att-prev');
            const nextBtn = document.getElementById('att-next');
            if (prevBtn) prevBtn.disabled = curPage <= 1;
            if (nextBtn) nextBtn.disabled = curPage >= totalPages;
        }

        if (pageRows.length === 0) {
            recTbody.innerHTML = this.renderEmptyState(10, 'fa-calendar-check', (window.cnxT?window.cnxT('js.s_inv.71862045','Không có lượt chấm công'):'Không có lượt chấm công'), (window.cnxT?window.cnxT('js.s_inv.919e8c19','Không có lượt chấm công nào phù hợp bộ lọc.'):'Không có lượt chấm công nào phù hợp bộ lọc.'));
            return;
        }

        const deptBadgeCls = (d) => {
            const dl = d.toLowerCase();
            if (dl.includes('bếp') || dl.includes('pha chế')) return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
            if (dl.includes('thu ngân')) return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
            if (dl.includes('phục vụ') || dl.includes('chạy bàn')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
            if (dl.includes('quản lý') || dl.includes('quản trị')) return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
            return 'bg-slate-800 text-slate-300 border-white/10';
        };
        const isLocked = this._payrollCycle && this._payrollCycle.status && this._payrollCycle.status !== 'draft';

        const sourceMeta = (src) => {
            if (src === 'hikvision_device') return { lbl: (window.cnxT?window.cnxT('js.s_inv.6b4ac51f','Máy Hikvision'):'Máy Hikvision'), cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', icon: 'fa-id-card-clip' };
            if (src === 'kiosk_pin') return { lbl: 'Kiosk PIN', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30', icon: 'fa-tablet-screen-button' };
            if (src === 'web_personal') return { lbl: 'Web App', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: 'fa-globe' };
            return { lbl: 'Auto POS', cls: 'bg-slate-800 text-slate-400 border-white/10', icon: 'fa-desktop' };
        };

        recTbody.innerHTML = pageRows.map(r => {
            const isWorking = r.status === 'working';
            const inTime = r.check_in_time ? (r.check_in_time.split(' ')[1] || r.check_in_time) : '';
            const outTime = r.check_out_time ? (r.check_out_time.split(' ')[1] || r.check_out_time) : (isWorking ? '---' : '');
            const roleHint = userRoleMap[String(r.user_id)] || r.user_role || r.role || '';
            const { name, dept } = this._splitStaffNameAndDept(r.user_name, roleHint);
            const dateFmt = typeof window.formatDateDDMMYY === 'function' ? window.formatDateDDMMYY(r.work_date, false) : r.work_date;
            const hasOt = Number(r.is_overtime_approved || 0) === 1 || Number(r.overtime_hours || 0) > 0;
            const otBadge = hasOt
                ? `<div class="text-[10px] text-amber-300 font-semibold">OT ${Number(r.overtime_hours || 0).toFixed(2)}h (x${Number(r.overtime_multiplier || 1.5).toFixed(1)})</div>`
                : '';
            const sMeta = sourceMeta(r.source || 'auto_login');
            const srcBadge = `<span class="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.2 rounded border text-[9px] font-bold ${sMeta.cls}"><i class="fas ${sMeta.icon}"></i>${sMeta.lbl}</span>`;
            const photoBtn = r.photo_path
                ? `<button type="button" onclick="Admin.viewAttendancePhoto('${escapeJsAttr(r.photo_path)}', '${escapeJsAttr(name)}')" class="ml-1 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px]" title="Xem ảnh xác thực chấm công"><i class="fas fa-camera"></i></button>`
                : '';

            return `
                <tr class="hover:bg-white/5 transition-colors" title="${this._escInvHtml(r.note || '')}">
                    <td class="py-2 px-3 font-mono text-slate-300 text-center">${this._escInvHtml(dateFmt)}</td>
                    <td class="py-2 px-3 font-bold text-slate-200 text-left">
                        <div>${this._escInvHtml(name)}${photoBtn}</div>
                        <div class="flex items-center gap-1">${srcBadge}${r.device_name ? `<span class="text-[9px] text-slate-400 truncate max-w-[110px]">${this._escInvHtml(r.device_name)}</span>` : ''}</div>
                    </td>
                    <td class="py-2 px-3 text-center"><span class="px-2 py-0.5 rounded-md border text-[10px] font-semibold inline-block ${deptBadgeCls(dept)}">${this._escInvHtml(dept)}</span></td>
                    <td class="py-2 px-3 font-mono text-sky-400 text-center"><i class="fas fa-arrow-right-to-bracket text-[10px] mr-1"></i>${this._escInvHtml(inTime)}</td>
                    <td class="py-2 px-3 font-mono text-amber-300 text-center">${outTime && outTime !== '---' ? `<i class="fas fa-arrow-right-from-bracket text-[10px] mr-1"></i>${this._escInvHtml(outTime)}` : '---'}</td>
                    <td class="py-2 px-3 font-mono font-bold text-slate-100 text-center">
                        <div>${r.work_hours || 0} h</div>
                        ${otBadge}
                    </td>
                    <td class="py-2 px-3 font-mono text-slate-400 text-right">${Admin.formatMoney(r.hourly_rate)} đ</td>
                    <td class="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                        <div>${Admin.formatMoney(r.total_pay)} đ</div>
                        ${Number(r.overtime_pay || 0) > 0 ? `<div class="text-[10px] text-amber-300">+${Admin.formatMoney(r.overtime_pay)}đ OT</div>` : ''}
                    </td>
                    <td class="py-2 px-3 text-center">
                        ${isWorking
                            ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold inline-block">🟢 Đang trong ca</span>'
                            : (window.cnxT?window.cnxT('js.s_inv.c4ee1b36','<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5 text-[10px] inline-block">Đã tan ca</span>'):'<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5 text-[10px] inline-block">Đã tan ca</span>')}
                    </td>
                    <td class="py-2 px-3 text-right whitespace-nowrap">
                        <div class="inline-flex items-center gap-1">
                            <button type="button" ${isLocked ? 'disabled' : ''} onclick="Admin.openAttendanceModal(${r.id})" class="btn-glass text-[10px] py-1 px-2 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/30 font-bold ${isLocked ? 'opacity-40 cursor-not-allowed' : ''}" title="${isLocked ? 'Kỳ lương đã khóa' : (window.cnxT?window.cnxT('js.s_inv.4de42aa7','Sửa giờ công / OT'):'Sửa giờ công / OT')}">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button type="button" ${isLocked ? 'disabled' : ''} onclick="Admin.deleteAttendanceRecord(${r.id})" class="btn-glass text-[10px] py-1 px-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/30 font-bold ${isLocked ? 'opacity-40 cursor-not-allowed' : ''}" title="${isLocked ? 'Kỳ lương đã khóa' : (window.cnxT?window.cnxT('js.s_inv.1a9ee788','Xóa lượt công'):'Xóa lượt công')}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    applyAttendanceFilter() {
        this._attPage = 1;
        this.loadAttendancePage(1);
    },

    resetAttendanceFilter() {
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        setVal('att-filter-user', '0');
        setVal('att-filter-q', '');
        setVal('att-filter-from', '');
        setVal('att-filter-to', '');
        setVal('att-filter-status', '');
        this._attPage = 1;
        this.loadAttendancePage(1);
    },

    attendancePage(delta) {
        const next = Math.max(1, (this._attPage || 1) + delta);
        this.loadAttendancePage(next);
    },

    async exportAttendancePdf() {
        try {
            const params = this._payrollFilterParams();
            params.set('limit', 'all');
            const res = await fetch(`api/operations.php?action=get_payroll&${params.toString()}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || (window.cnxT?window.cnxT('js.s_inv.1ed26ab3','Không thể tải dữ liệu xuất PDF'):'Không thể tải dữ liệu xuất PDF'));
            const fullRows = data.attendance_records || [];
            this.renderAttendanceRecords(fullRows);
            setTimeout(() => {
                window.print();
                setTimeout(() => this.renderAttendanceRecords(), 300);
            }, 60);
        } catch (e) {
            window.print();
        }
    },

    openAttendanceModal(attId) {
        const modal = document.getElementById('modal-edit-attendance');
        if (!modal) return;
        this.populateAttendanceUserFilter();

        const titleEl = document.getElementById('att-edit-modal-title');
        const idEl = document.getElementById('att-edit-id');
        const userEl = document.getElementById('att-edit-user');
        const dateEl = document.getElementById('att-edit-date');
        const inEl = document.getElementById('att-edit-in');
        const outEl = document.getElementById('att-edit-out');
        const rateEl = document.getElementById('att-edit-rate');
        const otAppEl = document.getElementById('att-edit-ot-approved');
        const otMultEl = document.getElementById('att-edit-ot-mult');
        const reasonEl = document.getElementById('att-edit-reason');

        if (!attId || attId <= 0) {
            if (titleEl) titleEl.innerHTML = (window.cnxT?window.cnxT('js.s_inv.3cbeb156','<i class="fas fa-plus-circle"></i> Thêm Công Bổ Sung Thủ Công'):'<i class="fas fa-plus-circle"></i> Thêm Công Bổ Sung Thủ Công');
            if (idEl) idEl.value = '0';
            if (userEl) userEl.disabled = false;
            const today = new Date().toISOString().slice(0, 10);
            if (dateEl) dateEl.value = today;
            if (inEl) inEl.value = '08:00:00';
            if (outEl) outEl.value = '17:00:00';
            if (rateEl) rateEl.value = '';
            if (otAppEl) otAppEl.checked = false;
            if (otMultEl) otMultEl.value = '1.5';
            if (reasonEl) reasonEl.value = '';
        } else {
            const rec = (this._allAttendanceRecords || []).find(x => Number(x.id) === Number(attId));
            if (!rec) {
                this._hrNotify((window.cnxT?window.cnxT('js.s_inv.fc6a543b','Không tìm thấy bản ghi công trong danh sách hiện tại.'):'Không tìm thấy bản ghi công trong danh sách hiện tại.'), 'error');
                return;
            }
            if (titleEl) titleEl.innerHTML = `<i class="fas fa-pen-to-square"></i> Sửa Lượt Chấm Công #${rec.id}`;
            if (idEl) idEl.value = String(rec.id);
            if (userEl) {
                userEl.value = String(rec.user_id || '');
                userEl.disabled = true;
            }
            if (dateEl) dateEl.value = String(rec.work_date || '').slice(0, 10);
            if (inEl) inEl.value = rec.check_in_time || '';
            if (outEl) outEl.value = rec.check_out_time || '';
            if (rateEl) rateEl.value = rec.hourly_rate || 25000;
            if (otAppEl) otAppEl.checked = Number(rec.is_overtime_approved || 0) === 1;
            if (otMultEl) otMultEl.value = rec.overtime_multiplier && Number(rec.overtime_multiplier) > 1 ? rec.overtime_multiplier : 1.5;
            if (reasonEl) reasonEl.value = rec.note || '';
        }
        modal.classList.add('open');
    },

    closeAttendanceModal() {
        document.getElementById('modal-edit-attendance')?.classList.remove('open');
    },

    _normalizeAttTs(dateStr, valStr) {
        const s = String(valStr || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
            return s.length === 16 ? `${s}:00` : s;
        }
        if (/^\d{2}:\d{2}$/.test(s)) return `${dateStr} ${s}:00`;
        if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return `${dateStr} ${s}`;
        return s;
    },

    async saveAttendanceRecord(e) {
        e.preventDefault();
        const attId = parseInt(document.getElementById('att-edit-id')?.value || '0', 10);
        const userId = parseInt(document.getElementById('att-edit-user')?.value || '0', 10);
        const workDate = document.getElementById('att-edit-date')?.value || '';
        const checkIn = this._normalizeAttTs(workDate, document.getElementById('att-edit-in')?.value);
        const checkOut = this._normalizeAttTs(workDate, document.getElementById('att-edit-out')?.value);
        const rate = parseFloat(document.getElementById('att-edit-rate')?.value || '0') || 0;
        const isOtApproved = !!document.getElementById('att-edit-ot-approved')?.checked;
        const otMult = parseFloat(document.getElementById('att-edit-ot-mult')?.value || '1.5') || 1.5;
        const reason = document.getElementById('att-edit-reason')?.value.trim() || '';

        if (!reason) {
            this._hrNotify((window.cnxT?window.cnxT('js.s_inv.364ab302','Vui lòng nhập lý do sửa/bổ sung công!'):'Vui lòng nhập lý do sửa/bổ sung công!'), 'error');
            return;
        }
        try {
            const res = await fetch('api/operations.php?action=save_attendance_record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: attId,
                    user_id: userId,
                    work_date: workDate,
                    check_in_time: checkIn,
                    check_out_time: checkOut,
                    hourly_rate: rate,
                    is_overtime_approved: isOtApproved,
                    overtime_multiplier: otMult,
                    edit_reason: reason
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || data.message || (window.cnxT?window.cnxT('js.s_inv.3d1f4a36','Lỗi lưu chấm công'):'Lỗi lưu chấm công'));
            this._hrNotify(data.message || (window.cnxT?window.cnxT('js.s_inv.a2968ea9','Đã lưu chấm công!'):'Đã lưu chấm công!'), 'success');
            this.closeAttendanceModal();
            await this.loadPayroll(this._attPage || 1);
            if (typeof this.loadRealtimeStaff === 'function') this.loadRealtimeStaff();
        } catch (err) {
            this._hrNotify(err.message, 'error');
        }
    },

    async deleteAttendanceRecord(attId) {
        const reason = await window.cnxPrompt(`${window.cnxT?window.cnxT('js.s_inv.81ff52ee','Nhập lý do xóa lượt chấm công #'):'Nhập lý do xóa lượt chấm công #'}${attId} ${window.cnxT?window.cnxT('js.s_inv.fd492375','(bắt buộc ghi Audit Log):'):'(bắt buộc ghi Audit Log):'}`, '', { title: (window.cnxT?window.cnxT('js.s_inv.ee743b20','Xác Nhận Xóa Công'):'Xác Nhận Xóa Công') });
        if (reason === null) return;
        if (!String(reason).trim()) {
            this._hrNotify((window.cnxT?window.cnxT('js.s_inv.136c6f75','Phải nhập lý do xóa lượt chấm công!'):'Phải nhập lý do xóa lượt chấm công!'), 'error');
            return;
        }
        try {
            const res = await fetch('api/operations.php?action=delete_attendance_record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: attId, edit_reason: String(reason).trim() })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || data.message || (window.cnxT?window.cnxT('js.s_inv.5b93e250','Lỗi xóa công'):'Lỗi xóa công'));
            this._hrNotify(data.message || (window.cnxT?window.cnxT('js.s_inv.dc08df05','Đã xóa lượt chấm công'):'Đã xóa lượt chấm công'), 'success');
            await this.loadPayroll(this._attPage || 1);
        } catch (err) {
            this._hrNotify(err.message, 'error');
        }
    },

    async savePayrollCycle() {
        const month = document.getElementById('payroll-month-input')?.value || this._payrollMonth || '';
        if (!month) return;
        try {
            const res = await fetch('api/operations.php?action=save_payroll_cycle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || data.message || (window.cnxT?window.cnxT('js.s_inv.22465a14','Lỗi chốt nháp kỳ lương'):'Lỗi chốt nháp kỳ lương'));
            this._hrNotify(data.message || `${window.cnxT?window.cnxT('js.s_inv.330f8868','Đã lưu snapshot kỳ lương'):'Đã lưu snapshot kỳ lương'} ${month}`, 'success');
            await this.loadPayroll(this._attPage || 1);
        } catch (err) {
            this._hrNotify(err.message, 'error');
        }
    },

    async lockPayrollCycle() {
        const month = document.getElementById('payroll-month-input')?.value || this._payrollMonth || '';
        if (!month) return;
        const ok = await window.cnxConfirm(`${window.cnxT?window.cnxT('js.s_inv.bc80e4f2','Khóa sổ kỳ lương tháng'):'Khóa sổ kỳ lương tháng'} ${month}${window.cnxT?window.cnxT('js.s_inv.12fcbb6f','? Sau khi khóa sẽ không thể sửa/xóa công tháng này trừ khi mở khóa.'):'? Sau khi khóa sẽ không thể sửa/xóa công tháng này trừ khi mở khóa.'}`, { title: (window.cnxT?window.cnxT('ui.admin_html.button_06fef539','Khóa Sổ Kỳ Lương'):'Khóa Sổ Kỳ Lương') });
        if (!ok) return;
        try {
            const res = await fetch('api/operations.php?action=lock_payroll_cycle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || data.message || (window.cnxT?window.cnxT('js.s_inv.71467cdd','Lỗi khóa sổ'):'Lỗi khóa sổ'));
            this._hrNotify(data.message || (window.cnxT?window.cnxT('js.s_inv.81a93221','Đã khóa sổ kỳ lương!'):'Đã khóa sổ kỳ lương!'), 'success');
            await this.loadPayroll(this._attPage || 1);
        } catch (err) {
            this._hrNotify(err.message, 'error');
        }
    },

    async unlockPayrollCycle() {
        const month = document.getElementById('payroll-month-input')?.value || this._payrollMonth || '';
        if (!month) return;
        try {
            const res = await fetch('api/operations.php?action=unlock_payroll_cycle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || data.message || (window.cnxT?window.cnxT('js.m_sa.f05de904','Lỗi mở khóa'):'Lỗi mở khóa'));
            this._hrNotify(data.message || (window.cnxT?window.cnxT('js.s_inv.7ae65b2f','Đã mở khóa kỳ lương về Nháp!'):'Đã mở khóa kỳ lương về Nháp!'), 'success');
            await this.loadPayroll(this._attPage || 1);
        } catch (err) {
            this._hrNotify(err.message, 'error');
        }
    },

    async markPayrollPaid() {
        const month = document.getElementById('payroll-month-input')?.value || this._payrollMonth || '';
        if (!month) return;
        const methodInput = await window.cnxPrompt(`${window.cnxT?window.cnxT('js.s_inv.4a7b7194','Xác nhận chi trả lương tháng'):'Xác nhận chi trả lương tháng'} ${month} và ghi Sổ Quỹ?\nNhập phương thức chi ('banking' hoặc 'cash'):`, 'banking', { title: (window.cnxT?window.cnxT('ui.admin_html.button_fe9bd656','Xác Nhận Chi Lương'):'Xác Nhận Chi Lương') });
        if (methodInput === null) return;
        const paidMethod = String(methodInput).trim().toLowerCase() === 'cash' ? 'cash' : 'banking';
        try {
            const res = await fetch('api/operations.php?action=mark_payroll_paid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month, paid_method: paidMethod })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || data.message || (window.cnxT?window.cnxT('js.s_inv.422dead2','Lỗi chi lương'):'Lỗi chi lương'));
            this._hrNotify(data.message || (window.cnxT?window.cnxT('js.s_inv.9eb691fe','Đã xác nhận chi lương & ghi sổ quỹ!'):'Đã xác nhận chi lương & ghi sổ quỹ!'), 'success');
            await this.loadPayroll(this._attPage || 1);
            if (typeof this.loadFinance === 'function') this.loadFinance();
        } catch (err) {
            this._hrNotify(err.message, 'error');
        }
    },

    openPayrollAdjustModal(userId) {
        const ps = (this._payrollSummaryList || []).find(x => Number(x.user_id) === Number(userId));
        if (!ps) return;
        const month = document.getElementById('payroll-month-input')?.value || this._payrollMonth || '';
        document.getElementById('padj-month').value = month;
        document.getElementById('padj-user-id').value = ps.user_id;
        document.getElementById('padj-staff-name').innerText = `${ps.fullname} (${ps.user_code || `NV${ps.user_id}`})`;
        document.getElementById('padj-base-info').innerText = `${window.cnxT?window.cnxT('js.s_inv.faeed745','Lương cơ bản:'):'Lương cơ bản:'} ${this.formatMoney(ps.base_pay ?? ps.total_salary)}${window.cnxT?window.cnxT('js.s_inv.02ee661f','đ | OT:'):'đ | OT:'} ${this.formatMoney(ps.overtime_pay || 0)}${window.cnxT?window.cnxT('js.s_inv.81f3b29e','đ | Điểm KPI tháng:'):'đ | Điểm KPI tháng:'} ${ps.kpi_score || 0}`;
        document.getElementById('padj-kpi-bonus').value = Math.round(ps.kpi_bonus || 0);
        document.getElementById('padj-allowance').value = Math.round(ps.allowance || 0);
        document.getElementById('padj-advance').value = Math.round(ps.advance_deduction || 0);
        document.getElementById('padj-penalty').value = Math.round(ps.penalty || 0);
        document.getElementById('padj-note').value = ps.note || '';
        document.getElementById('modal-payroll-adjust')?.classList.add('open');
    },

    closePayrollAdjustModal() {
        document.getElementById('modal-payroll-adjust')?.classList.remove('open');
    },

    async savePayrollAdjust(e) {
        e.preventDefault();
        const month = document.getElementById('padj-month')?.value || this._payrollMonth || '';
        const userId = parseInt(document.getElementById('padj-user-id')?.value || '0', 10);
        const kpiBonus = parseFloat(document.getElementById('padj-kpi-bonus')?.value || '0') || 0;
        const allowance = parseFloat(document.getElementById('padj-allowance')?.value || '0') || 0;
        const advDed = parseFloat(document.getElementById('padj-advance')?.value || '0') || 0;
        const penalty = parseFloat(document.getElementById('padj-penalty')?.value || '0') || 0;
        const note = document.getElementById('padj-note')?.value.trim() || '';

        try {
            const res = await fetch('api/operations.php?action=save_payroll_cycle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month,
                    user_id: userId,
                    kpi_bonus: kpiBonus,
                    allowance,
                    advance_deduction: advDed,
                    penalty,
                    note
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || data.message || (window.cnxT?window.cnxT('js.s_inv.2e34b016','Lỗi lưu điều chỉnh lương'):'Lỗi lưu điều chỉnh lương'));
            this._hrNotify((window.cnxT?window.cnxT('js.s_inv.51126723','Đã lưu khoản điều chỉnh & tính lại thực lĩnh!'):'Đã lưu khoản điều chỉnh & tính lại thực lĩnh!'), 'success');
            this.closePayrollAdjustModal();
            await this.loadPayroll(this._attPage || 1);
        } catch (err) {
            this._hrNotify(err.message, 'error');
        }
    },

    printPayslip(userId) {
        const ps = (this._payrollSummaryList || []).find(x => Number(x.user_id) === Number(userId));
        if (!ps) return;
        const month = this._payrollMonth || document.getElementById('payroll-month-input')?.value || '';
        const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu Lương ${month} - ${this._escInvHtml(ps.fullname)}</title>
        <style>body{font-family:Arial,sans-serif;max-width:460px;margin:20px auto;color:#111;font-size:13px}h2{margin:0 0 4px;text-align:center}.sub{text-align:center;color:#555;margin-bottom:14px;font-size:12px}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{padding:6px 4px;border-bottom:1px dashed #ccc}th{text-align:left;color:#444}.r{text-align:right;font-family:monospace;font-weight:bold}.tot td{border-top:2px solid #111;border-bottom:2px solid #111;font-size:15px}.sig{display:flex;justify-content:space-between;margin-top:28px;text-align:center;font-size:12px}@media print{button{display:none}}</style></head>
        <body><h2>${window.cnxT?window.cnxT('js.s_inv.c239ae56','PHIẾU LƯƠNG NHÂN VIÊN'):'PHIẾU LƯƠNG NHÂN VIÊN'}</h2><div class="sub">${window.cnxT?window.cnxT('js.s_inv.08fb8593','Kỳ lương:'):'Kỳ lương:'} <b>${this._escInvHtml(month)}</b> • Mã NV: ${this._escInvHtml(ps.user_code || `NV${ps.user_id}`)}</div>
        <div><b>${window.cnxT?window.cnxT('js.s_inv.3bae4c92','Họ và tên:'):'Họ và tên:'}</b> ${this._escInvHtml(ps.fullname)}<br><b>${window.cnxT?window.cnxT('js.s_inv.66e1d2ea','Vai trò:'):'Vai trò:'}</b> ${this._escInvHtml(ps.role)} • <b>${window.cnxT?window.cnxT('js.s_inv.3bad4d69','Lương/giờ:'):'Lương/giờ:'}</b> ${this.formatMoney(ps.hourly_rate)} đ</div>
        <table>
            <tr><th>${window.cnxT?window.cnxT('js.s_inv.5a984ef6','Tổng ca / Giờ thường'):'Tổng ca / Giờ thường'}</th><td class="r">${ps.total_shifts} ca (${ps.regular_hours ?? ps.total_hours} h)</td></tr>
            <tr><th>${window.cnxT?window.cnxT('js.s_inv.af92105f','Giờ Tăng Ca (OT)'):'Giờ Tăng Ca (OT)'}</th><td class="r">${ps.overtime_hours || 0} h</td></tr>
            <tr><th>${window.cnxT?window.cnxT('js.s_inv.713d0a3a','Lương cơ bản theo giờ'):'Lương cơ bản theo giờ'}</th><td class="r">${this.formatMoney(ps.base_pay ?? ps.total_salary)} đ</td></tr>
            <tr><th>${window.cnxT?window.cnxT('js.s_inv.fceebde8','Lương Tăng Ca &amp; Đêm'):'Lương Tăng Ca &amp; Đêm'}</th><td class="r">+${this.formatMoney(ps.overtime_pay || 0)} đ</td></tr>
            <tr><th>Thưởng KPI (${ps.kpi_score || 0} điểm)</th><td class="r">+${this.formatMoney(ps.kpi_bonus || 0)} đ</td></tr>
            <tr><th>${window.cnxT?window.cnxT('js.s_inv.3b74ab9a','Phụ cấp khác'):'Phụ cấp khác'}</th><td class="r">+${this.formatMoney(ps.allowance || 0)} đ</td></tr>
            <tr><th>${window.cnxT?window.cnxT('js.s_inv.c4222c17','Khấu trừ tạm ứng'):'Khấu trừ tạm ứng'}</th><td class="r">-${this.formatMoney(ps.advance_deduction || 0)} đ</td></tr>
            <tr><th>${window.cnxT?window.cnxT('js.s_inv.0d4535cc','Tiền phạt / Bồi thường'):'Tiền phạt / Bồi thường'}</th><td class="r">-${this.formatMoney(ps.penalty || 0)} đ</td></tr>
            <tr class="tot"><th>${window.cnxT?window.cnxT('js.s_inv.59290963','THỰC LĨNH'):'THỰC LĨNH'}</th><td class="r">${this.formatMoney(ps.net_pay ?? ps.total_salary)} đ</td></tr>
        </table>
        ${ps.note ? `<div><b>${window.cnxT?window.cnxT('ui.admin_html.label_1b4e6aad','Ghi chú:'):'Ghi chú:'}</b> ${this._escInvHtml(ps.note)}</div>` : ''}
        <div class="sig"><div><b>${window.cnxT?window.cnxT('js.s_inv.df092124','Người lập biểu'):'Người lập biểu'}</b><br><br><br>..................</div><div><b>${window.cnxT?window.cnxT('js.s_inv.07dbb4b4','Nhân viên ký nhận'):'Nhân viên ký nhận'}</b><br><br><br>${this._escInvHtml(ps.fullname)}</div></div>
        <div style="text-align:center;margin-top:16px"><button onclick="window.print()">${window.cnxT?window.cnxT('js.s_inv.17bc64f5','In Phiếu Lương'):'In Phiếu Lương'}</button></div></body></html>`;
        const w = window.open('', '_blank', 'width=540,height=720');
        if (w) {
            w.document.open();
            w.document.write(html);
            w.document.close();
            setTimeout(() => w.print(), 200);
        } else {
            this._hrNotify((window.cnxT?window.cnxT('js.s_inv.b0308352','Trình duyệt đã chặn popup in phiếu lương!'):'Trình duyệt đã chặn popup in phiếu lương!'), 'error');
        }
    },

    openSalaryModal(userId, fullname = '', role = '', currentRate = 0) {
        const ps = (this._payrollSummaryList || []).find(x => Number(x.user_id) === Number(userId));
        document.getElementById('salary-user-id').value = userId;
        document.getElementById('salary-user-fullname').innerText = fullname || ps?.fullname || `NV #${userId}`;
        document.getElementById('salary-user-role').innerText = `${window.cnxT?window.cnxT('js.s_inv.66e1d2ea','Vai trò:'):'Vai trò:'} ${role || ps?.role || ''}`;
        document.getElementById('salary-hourly-rate').value = currentRate || ps?.hourly_rate || 25000;
        document.getElementById('modal-edit-salary').classList.add('open');
    },

    closeSalaryModal() {
        document.getElementById('modal-edit-salary').classList.remove('open');
    },

    async submitSalaryUpdate(e) {
        e.preventDefault();
        const userId = parseInt(document.getElementById('salary-user-id').value);
        const rate = parseFloat(document.getElementById('salary-hourly-rate').value);

        if (isNaN(rate) || rate < 0) {
            alert((window.cnxT?window.cnxT('js.s_inv.f3442699','Vui lòng nhập mức lương hợp lệ!'):'Vui lòng nhập mức lương hợp lệ!'));
            return;
        }

        try {
            const res = await fetch('api/operations.php?action=update_hourly_rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, hourly_rate: rate })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.closeSalaryModal();
                this.loadPayroll();
                this.loadRealtimeStaff();
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_inv.5b07538d','Lỗi khi cập nhật lương'):'Lỗi khi cập nhật lương'));
            }
        } catch (err) {
            alert((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'));
        }
    },

    // 8.6 Shift Configuration & Auto-closing
    async loadShiftSettings() {
        try {
            const res = await fetch('api/operations.php?action=get_shift_settings');
            const data = await res.json();
            if (!data.success || !data.data) return;

            const cfg = data.data;
            const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; };
            const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

            setVal('cfg-shift1-name', cfg.shift1_name);
            setVal('cfg-shift1-start', cfg.shift1_start);
            setVal('cfg-shift1-end', cfg.shift1_end);
            setVal('cfg-shift2-name', cfg.shift2_name);
            setVal('cfg-shift2-start', cfg.shift2_start);
            setVal('cfg-shift2-end', cfg.shift2_end);
            setVal('cfg-shift-grace', cfg.shift_grace_minutes);
            setChk('cfg-shift-autoclose-toggle', cfg.shift_autoclose_enabled);

            setVal('cfg-shift-disconnect', cfg.shift_disconnect_timeout_minutes ?? 30);
            setVal('cfg-standard-daily-hours', cfg.standard_daily_hours ?? 8);
            setVal('cfg-ot-weekday', cfg.ot_weekday_rate ?? 1.5);
            setVal('cfg-ot-weekend', cfg.ot_weekend_rate ?? 2.0);
            setVal('cfg-ot-holiday', cfg.ot_holiday_rate ?? 3.0);
            setVal('cfg-night-bonus-pct', Math.round((Number(cfg.night_shift_bonus_pct ?? 0.3)) * 100));
            setVal('cfg-kpi-point-vnd', cfg.kpi_point_value_vnd ?? 5000);
            setChk('cfg-overtime-enabled', cfg.overtime_enabled ?? 1);
            setChk('cfg-allow-overnight', cfg.allow_overnight_shift ?? 0);
            setChk('cfg-pos-blind-handover', cfg.pos_blind_handover ?? 0);
        } catch (e) {
            console.error('loadShiftSettings error:', e);
        }
    },

    async saveShiftSettings() {
        const numVal = (id, def) => {
            const v = parseFloat(document.getElementById(id)?.value);
            return Number.isFinite(v) ? v : def;
        };
        const payload = {
            shift1_name: document.getElementById('cfg-shift1-name')?.value.trim() || (window.cnxT?window.cnxT('ui.adm_html.span_f23b920d','Ca 1 (Ca Sáng)'):'Ca 1 (Ca Sáng)'),
            shift1_start: document.getElementById('cfg-shift1-start')?.value || '06:30',
            shift1_end: document.getElementById('cfg-shift1-end')?.value || '12:30',
            shift2_name: document.getElementById('cfg-shift2-name')?.value.trim() || (window.cnxT?window.cnxT('ui.adm_html.span_66cb1f1f','Ca 2 (Ca Chiều / Tối)'):'Ca 2 (Ca Chiều / Tối)'),
            shift2_start: document.getElementById('cfg-shift2-start')?.value || '12:30',
            shift2_end: document.getElementById('cfg-shift2-end')?.value || '22:30',
            shift_grace_minutes: Math.max(0, Math.round(numVal('cfg-shift-grace', 15))),
            shift_autoclose_enabled: document.getElementById('cfg-shift-autoclose-toggle')?.checked ? 1 : 0,
            shift_disconnect_timeout_minutes: Math.max(5, Math.round(numVal('cfg-shift-disconnect', 30))),
            overtime_enabled: document.getElementById('cfg-overtime-enabled')?.checked ? 1 : 0,
            ot_weekday_rate: Math.max(1.0, numVal('cfg-ot-weekday', 1.5)),
            ot_weekend_rate: Math.max(1.0, numVal('cfg-ot-weekend', 2.0)),
            ot_holiday_rate: Math.max(1.0, numVal('cfg-ot-holiday', 3.0)),
            night_shift_bonus_pct: Math.max(0, numVal('cfg-night-bonus-pct', 30) / 100.0),
            standard_daily_hours: Math.max(1.0, numVal('cfg-standard-daily-hours', 8.0)),
            allow_overnight_shift: document.getElementById('cfg-allow-overnight')?.checked ? 1 : 0,
            pos_blind_handover: document.getElementById('cfg-pos-blind-handover')?.checked ? 1 : 0,
            kpi_point_value_vnd: Math.max(0, numVal('cfg-kpi-point-vnd', 5000))
        };

        try {
            const res = await fetch('api/operations.php?action=save_shift_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                this._hrNotify(data.message || (window.cnxT?window.cnxT('js.s_inv.19649a9a','Đã lưu cấu hình ca & OT!'):'Đã lưu cấu hình ca & OT!'), 'success');
                this.loadRealtimeStaff();
                this.loadPayroll();
            } else {
                this._hrNotify ? this._hrNotify(data.message || (window.cnxT?window.cnxT('js.s_inv.e4884f4a','Lỗi khi lưu khung giờ'):'Lỗi khi lưu khung giờ'), 'error') : console.error(data.message);
            }
        } catch (err) {
            this._hrNotify ? this._hrNotify((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'), 'error') : console.error(err);
        }
    },

    viewAttendancePhoto(photoPath, staffName) {
        if (!photoPath) return;
        let modal = document.getElementById('att-photo-preview-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'att-photo-preview-modal';
            modal.className = 'liquid-modal-overlay';
            modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
            document.body.appendChild(modal);
        }
        const safeSrc = escapeHtml(photoPath);
        const safeName = escapeHtml(staffName || (window.cnxT?window.cnxT('ui.admin_html.th_7a567e8e','Nhân viên'):'Nhân viên'));
        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-4 w-[420px] max-w-[95vw] text-white border border-sky-500/40 space-y-3">
                <div class="flex items-center justify-between border-b border-white/10 pb-2">
                    <div class="text-xs font-bold text-sky-300"><i class="fas fa-camera mr-1"></i> Ảnh Chấm Công: ${safeName}</div>
                    <button type="button" onclick="document.getElementById('att-photo-preview-modal').classList.remove('open')" class="text-slate-400 hover:text-white text-xl">&times;</button>
                </div>
                <img src="${safeSrc}" alt="Attendance Photo" class="w-full max-h-80 object-contain rounded-xl bg-black/50 border border-white/10" />
            </div>
        `;
        modal.classList.add('open');
    }
});
