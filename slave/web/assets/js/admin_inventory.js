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
            reviewTbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-400 text-xs"><div class="flex flex-col items-center justify-center gap-2"><i class="fas fa-file-invoice text-3xl text-slate-600"></i><span>Chưa có dữ liệu. Vui lòng tải ảnh hóa đơn / viết tay hoặc bấm <b>"+ Bổ sung dòng"</b> để nhập.</span></div></td></tr>`;
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
        if (costEl) costEl.innerText = '0 đ';
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
            keyInput.value = localStorage.getItem('pos_gemini_api_key') || '';
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
                <span class="manual-row-total text-emerald-300 font-mono font-bold text-xs">0 đ</span>
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
            if (totalSpan) totalSpan.innerText = this.formatMoney(lineTotal) + ' đ';
        });

        const countElem = document.getElementById('import-footer-item-count');
        const costElem = document.getElementById('import-footer-total-cost');
        if (countElem) countElem.innerText = count;
        if (costElem) costElem.innerText = this.formatMoney(totalCost) + ' đ';
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
            alert('Không tìm thấy file hình ảnh (JPG, PNG, WEBP) nào!');
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

        if (countBadge) countBadge.innerText = `${total} ảnh`;
        if (scanLabel) scanLabel.innerText = total > 1 ? `PHÂN TÍCH ${total} ẢNH BẰNG AI` : `PHÂN TÍCH BẰNG AI`;

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
        ctx.fillText('ĐẠI LÝ NGUYÊN LIỆU CÀ PHÊ BUÔN MA THUỘT', 300, 45);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#475569';
        ctx.fillText('Đ/c: 45 Lê Duẩn, TP. Buôn Ma Thuột - ĐT: 0918.608.073', 300, 75);
        ctx.fillText('PHIẾU XUẤT KHO / HÓA ĐƠN MUA HÀNG', 300, 105);

        ctx.textAlign = 'left';
        ctx.fillText('Ngày: ' + new Date().toLocaleDateString('vi-VN'), 40, 140);
        ctx.fillText('Khách hàng: GÓC PHỐ COFFEE & TEA', 40, 165);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(40, 180); ctx.lineTo(560, 180); ctx.stroke();

        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('Tên Mặt Hàng', 45, 205);
        ctx.fillText('SL', 290, 205);
        ctx.fillText('ĐVT', 345, 205);
        ctx.fillText('Đơn Giá', 415, 205);
        ctx.fillText('T.Tiền', 495, 205);

        ctx.beginPath();
        ctx.moveTo(40, 218); ctx.lineTo(560, 218); ctx.stroke();

        const items = [
            ['1. Cà phê hạt Robusta Đắk Lắk', '20', 'kg', '140.000', '2.800.000'],
            ['2. Sữa đặc Ngôi Sao Phương Nam', '24', 'hộp', '22.000', '528.000'],
            ['3. Sữa tươi thanh trùng TH', '12', 'lít', '32.000', '384.000'],
            ['4. Trà Oolong nướng Đài Loan', '5', 'gói', '85.000', '425.000'],
            ['5. Đường phèn hạt Quảng Ngãi', '10', 'kg', '28.000', '280.000']
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
        ctx.fillText('TỔNG CỘNG TIỀN THANH TOÁN:', 160, y + 35);
        ctx.fillText('4.417.000 VNĐ', 430, y + 35);

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
            alert('Không thể mở camera. Vui lòng kiểm tra quyền truy cập webcam trong trình duyệt: ' + err.message);
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
        if (previewMeta) previewMeta.innerText = 'Ảnh chụp camera • Sẵn sàng quét AI';
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
            alert('Module [ai_invoice_ocr] chưa được cấp phép hoặc đã bị Master tắt/khóa!');
            return;
        }
        const total = this.importState.images.length;
        if (total === 0) {
            alert('Vui lòng chọn hoặc kéo thả ít nhất 1 ảnh hóa đơn / giấy viết tay!');
            return;
        }

        const statusBox = document.getElementById('import-ai-scanning-status');
        const statusText = document.getElementById('ai-scan-status-text');
        const btnScan = document.getElementById('btn-trigger-ai-scan');
        const keyInput = document.getElementById('import-gemini-api-key');
        const apiKey = keyInput?.value.trim() || localStorage.getItem('pos_gemini_api_key') || '';
        if (apiKey) {
            localStorage.setItem('pos_gemini_api_key', apiKey);
        }

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
                        ? `AI đang phân tích hóa đơn (${i + 1}/${total}): ${imgItem.name}...` 
                        : 'Trí tuệ nhân tạo đang phân tích hình ảnh và bóc tách dữ liệu...';
                }

                const res = await fetch('api/operations.php?action=ai_parse_invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_base64: imgItem.base64,
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
                    console.warn(`Lỗi bóc tách ảnh ${imgItem.name}:`, data.message);
                }
            }

            if (successCount === 0) {
                alert('Không thể phân tích được ảnh nào bằng AI. Vui lòng kiểm tra lại ảnh hoặc nhập thủ công.');
                return;
            }

            const supInput = document.getElementById('review-supplier-input');
            const noInput = document.getElementById('review-invoice-no-input');
            if (supInput && detectedSupplier) supInput.value = detectedSupplier;
            if (noInput && detectedInvoiceNo) noInput.value = detectedInvoiceNo;

            const badge = document.getElementById('review-ai-badge');
            if (badge) {
                badge.innerText = `${lastEngine} • ${total} hóa đơn`;
                badge.classList.remove('hidden');
            }

            this.renderReviewRows(allExtractedItems);
            document.getElementById('import-review-section')?.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            console.error('runAiInvoiceScan error:', err);
            alert('Lỗi kết nối khi quét AI: ' + err.message);
        } finally {
            if (statusBox) statusBox.classList.add('hidden');
            if (btnScan) btnScan.disabled = false;
        }
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
                                : '<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold whitespace-nowrap"><i class="fas fa-check text-[9px] mr-1"></i>Đã khớp mã kho: <b>' + (it.material_code || '') + '</b></span>'}
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
                        <input type="number" step="any" min="0" value="${Math.round(it.unit_price || 0)}" class="liquid-input py-1.5 px-2.5 text-xs w-full font-mono font-bold text-emerald-400 text-right review-price" oninput="Admin.onReviewPriceChanged(this)" title="Đơn giá mua" />
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
                    <option value="__NEW__" class="text-amber-300 font-bold">✨ [Tạo Mới Kho]</option>
                    ${optionsHtml}
                </select>
                <div class="mt-1.5 flex items-center gap-1.5">
                    <span class="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold whitespace-nowrap"><i class="fas fa-hand-pointer text-[9px] mr-1"></i>Thủ công</span>
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
            if (totalSpan) totalSpan.innerText = this.formatMoney(lineTotal) + ' đ';
        });

        const countElem = document.getElementById('import-footer-item-count');
        const costElem = document.getElementById('import-footer-total-cost');
        if (countElem) countElem.innerText = count;
        if (costElem) costElem.innerText = this.formatMoney(totalCost) + ' đ';
    },

    // --- XÁC NHẬN NHẬP KHO HÀNG LOẠT ---
    async commitSmartImport() {
        const method = this.importState.method;
        let supplier = '';
        let invoiceNo = '';
        let note = '';
        let items = [];

        if (method === 'manual') {
            supplier = document.getElementById('manual-import-supplier')?.value.trim() || '';
            invoiceNo = document.getElementById('manual-import-invoice-no')?.value.trim() || '';
            note = document.getElementById('manual-import-note')?.value.trim() || 'Nhập kho thủ công';

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
            note = 'Nhập kho bằng AI OCR chứng từ';

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
                            category: 'Nguyên liệu',
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
            alert('Không có mặt hàng hợp lệ để nhập kho! Vui lòng kiểm tra lại số lượng (> 0).');
            return;
        }

        const confirmMsg = `Xác nhận nhập ${items.length} mặt hàng vào kho với tổng chi phí ${document.getElementById('import-footer-total-cost')?.innerText || ''}?`;
        if (!confirm(confirmMsg)) return;

        const btnSubmit = document.getElementById('btn-submit-smart-import');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
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
                alert(data.message || 'Lỗi khi nhập kho!');
            }
        } catch (err) {
            console.error('commitSmartImport error:', err);
            alert('Lỗi kết nối khi nhập kho: ' + err.message);
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="fas fa-check-double"></i> <span>XÁC NHẬN NHẬP KHO & LƯU CHI PHÍ</span>';
            }
        }
    },

    // 8.3 Stock Transactions (Nhập kho / Xuất kho / Chi phí)
    openStockTransactionModal(type = 'import', matId = null) {
        const transTypeInput = document.getElementById('modal-trans-type');
        if (transTypeInput) transTypeInput.value = type;

        const title = document.getElementById('modal-stock-trans-title');
        const actionLabel = document.getElementById('modal-trans-action-label');
        const priceContainer = document.getElementById('modal-trans-price-container');
        const totalBox = document.getElementById('modal-trans-total-box');
        const submitBtn = document.getElementById('btn-submit-stock-trans');

        if (type === 'import') {
            if (title) title.innerHTML = '<i class="fas fa-file-invoice-dollar text-emerald-400"></i> Lập Phiếu Nhập Kho (Chi Phí Mua Hàng)';
            if (actionLabel) actionLabel.innerText = 'nhập';
            if (priceContainer) priceContainer.classList.remove('hidden');
            if (totalBox) totalBox.classList.remove('hidden');
            if (submitBtn) submitBtn.className = 'btn-glass-success text-xs py-2 px-5 font-bold flex items-center gap-1.5';
        } else {
            if (title) title.innerHTML = '<i class="fas fa-dolly text-rose-400"></i> Lập Phiếu Xuất Kho Sử Dụng';
            if (actionLabel) actionLabel.innerText = 'xuất';
            if (priceContainer) priceContainer.classList.add('hidden');
            if (totalBox) totalBox.classList.add('hidden');
            if (submitBtn) submitBtn.className = 'btn-glass-danger text-xs py-2 px-5 font-bold flex items-center gap-1.5';
        }

        // Populate materials select
        const sel = document.getElementById('modal-trans-mat-id');
        if (sel) {
            sel.innerHTML = this.materialsList.map(m => 
                `<option value="${m.id}" data-unit="${m.unit}" data-stock="${m.quantity}" data-price="${m.cost_price}" data-sup="${m.supplier || ''}" ${matId == m.id ? 'selected' : ''}>${m.code} - ${m.name} (Tồn: ${m.quantity} ${m.unit})</option>`
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
            alert('Vui lòng nhập số lượng hợp lệ (> 0)!');
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
                alert(data.message || 'Lỗi khi lưu phiếu kho');
            }
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
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
            if (totalDisplay) totalDisplay.innerText = this.formatMoney(data.total_expense) + ' đ';

            const tbody = document.getElementById('hist-transactions-tbody');
            if (!tbody) return;

            if (!data.transactions || data.transactions.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-400">Không có phiếu nhập/xuất kho nào trong kỳ này.</td></tr>`;
                return;
            }

            const typeBadges = {
                import: '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">Nhập kho</span>',
                export: '<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">Xuất kho</span>',
                adjustment: '<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold text-[10px]">Cân chỉnh</span>'
            };

            tbody.innerHTML = data.transactions.map(t => `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">${window.formatDateDDMMYY(t.created_at, true)}</td>
                    <td class="py-3 px-3 font-mono text-sky-300 font-bold whitespace-nowrap">${t.trans_code}</td>
                    <td class="py-3 px-3 whitespace-nowrap text-center">${typeBadges[t.trans_type] || t.trans_type}</td>
                    <td class="py-3 px-3 font-bold text-slate-200 min-w-[200px]">${t.material_name}</td>
                    <td class="py-3 px-3 font-mono font-bold text-slate-100 whitespace-nowrap text-center">${t.quantity} ${t.unit}</td>
                    <td class="py-3 px-3 font-mono text-slate-300 whitespace-nowrap text-right">${t.trans_type === 'import' ? Admin.formatMoney(t.unit_price) + ' đ' : '-'}</td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">${t.trans_type === 'import' ? Admin.formatMoney(t.total_cost) + ' đ' : '-'}</td>
                    <td class="py-3 px-3 text-slate-300 text-xs min-w-[150px]">${t.supplier || '-'}</td>
                    <td class="py-3 px-3 text-slate-400 text-xs whitespace-nowrap">${t.user_name || 'Admin'}</td>
                </tr>
            `).join('');
        } catch (e) {
            console.error('loadMaterialHistory error:', e);
        }
    },

    // 8.5 Payroll & Timekeeping
    async loadPayroll() {
        const monthInput = document.getElementById('payroll-month-input');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${y}-${m}`;
        }
        const month = monthInput?.value || '';

        try {
            this.loadShiftSettings();
            const res = await fetch(`api/operations.php?action=get_payroll&month=${month}`);
            const data = await res.json();
            if (!data.success) return;

            // KPI
            const totalHoursEl = document.getElementById('payroll-total-hours');
            const totalSalaryEl = document.getElementById('payroll-total-salary');
            if (totalHoursEl) totalHoursEl.innerText = `${data.total_company_hours || 0} h`;
            if (totalSalaryEl) totalSalaryEl.innerText = `${this.formatMoney(data.total_company_salary)} đ`;

            // Render Payroll Summary
            const sumTbody = document.getElementById('payroll-summary-tbody');
            if (sumTbody) {
                const list = data.payroll_summary || [];
                if (list.length === 0) {
                    sumTbody.innerHTML = this.renderEmptyState(8, 'fa-money-bill-wave', 'Chưa có bảng lương', 'Không có dữ liệu tổng hợp lương trong tháng đã chọn.');
                } else {
                    const roleLabels = {
                        admin: 'Quản Trị (ADM)',
                        cashier: 'Thu Ngân (ACC)',
                        waiter: 'Phục Vụ (STF)',
                        kitchen: 'Tổ Bếp (KIT)',
                        customer: 'Khách Hàng'
                    };

                    sumTbody.innerHTML = list.map(ps => `
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="py-2.5 px-3 font-mono font-bold text-sky-400">${ps.user_code || `NV${ps.user_id}`}</td>
                            <td class="py-2.5 px-3 font-bold text-slate-100">${ps.fullname}</td>
                            <td class="py-2.5 px-3 text-slate-300 text-xs">${roleLabels[ps.role] || ps.role}</td>
                            <td class="py-2.5 px-3 font-mono font-bold text-amber-400">${Admin.formatMoney(ps.hourly_rate)} đ/h</td>
                            <td class="py-2.5 px-3 font-mono text-slate-300">${ps.total_shifts} ca</td>
                            <td class="py-2.5 px-3 font-mono font-bold text-sky-300">${ps.total_hours} h</td>
                            <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-400 text-sm">${Admin.formatMoney(ps.total_salary)} đ</td>
                            <td class="py-2.5 px-3 text-right">
                                <button type="button" onclick="Admin.openSalaryModal(${ps.user_id}, '${ps.fullname}', '${ps.role}', ${ps.hourly_rate})" class="btn-glass text-[11px] py-1 px-2.5 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/30 font-bold" title="Cập nhật mức lương / giờ">
                                    <i class="fas fa-coins mr-1"></i> Sửa Lương
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }

            // Render Detailed Attendance Log
            const recTbody = document.getElementById('payroll-records-tbody');
            if (recTbody) {
                const records = data.attendance_records || [];
                if (records.length === 0) {
                    recTbody.innerHTML = this.renderEmptyState(8, 'fa-calendar-check', 'Không có lượt chấm công', `Không có lượt chấm công nào trong tháng ${month}.`);
                    return;
                }

                recTbody.innerHTML = records.map(r => {
                    const isWorking = r.status === 'working';
                    const inTime = r.check_in_time ? r.check_in_time.split(' ')[1] : '';
                    const outTime = r.check_out_time ? r.check_out_time.split(' ')[1] : (isWorking ? '---' : '');

                    return `
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="py-2 px-3 font-mono text-slate-300">${window.formatDateDDMMYY(r.work_date, false)}</td>
                            <td class="py-2 px-3 font-bold text-slate-200">${r.user_name}</td>
                            <td class="py-2 px-3 font-mono text-sky-400"><i class="fas fa-arrow-right-to-bracket text-[10px] mr-1"></i>${inTime}</td>
                            <td class="py-2 px-3 font-mono text-amber-300">${outTime ? `<i class="fas fa-arrow-right-from-bracket text-[10px] mr-1"></i>${outTime}` : '---'}</td>
                            <td class="py-2 px-3 font-mono font-bold text-slate-100">${r.work_hours || 0} h</td>
                            <td class="py-2 px-3 font-mono text-slate-400">${Admin.formatMoney(r.hourly_rate)} đ</td>
                            <td class="py-2 px-3 text-right font-mono font-bold text-emerald-400">${Admin.formatMoney(r.total_pay)} đ</td>
                            <td class="py-2 px-3 text-center">
                                ${isWorking 
                                    ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">🟢 Đang trong ca</span>'
                                    : '<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5 text-[10px]">Đã tan ca</span>'}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (e) {
            console.error('loadPayroll error:', e);
        }
    },

    openSalaryModal(userId, fullname, role, currentRate) {
        document.getElementById('salary-user-id').value = userId;
        document.getElementById('salary-user-fullname').innerText = fullname;
        document.getElementById('salary-user-role').innerText = `Vai trò: ${role}`;
        document.getElementById('salary-hourly-rate').value = currentRate || 25000;
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
            alert('Vui lòng nhập mức lương hợp lệ!');
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
                alert(data.message || 'Lỗi khi cập nhật lương');
            }
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
        }
    },

    // 8.6 Shift Configuration & Auto-closing
    async loadShiftSettings() {
        try {
            const res = await fetch('api/operations.php?action=get_shift_settings');
            const data = await res.json();
            if (!data.success || !data.data) return;

            const cfg = data.data;
            const s1Name = document.getElementById('cfg-shift1-name');
            const s1Start = document.getElementById('cfg-shift1-start');
            const s1End = document.getElementById('cfg-shift1-end');
            const s2Name = document.getElementById('cfg-shift2-name');
            const s2Start = document.getElementById('cfg-shift2-start');
            const s2End = document.getElementById('cfg-shift2-end');
            const grace = document.getElementById('cfg-shift-grace');
            const toggle = document.getElementById('cfg-shift-autoclose-toggle');

            if (s1Name && cfg.shift1_name) s1Name.value = cfg.shift1_name;
            if (s1Start && cfg.shift1_start) s1Start.value = cfg.shift1_start;
            if (s1End && cfg.shift1_end) s1End.value = cfg.shift1_end;
            if (s2Name && cfg.shift2_name) s2Name.value = cfg.shift2_name;
            if (s2Start && cfg.shift2_start) s2Start.value = cfg.shift2_start;
            if (s2End && cfg.shift2_end) s2End.value = cfg.shift2_end;
            if (grace && cfg.shift_grace_minutes !== undefined) grace.value = cfg.shift_grace_minutes;
            if (toggle) toggle.checked = !!cfg.shift_autoclose_enabled;
        } catch (e) {
            console.error('loadShiftSettings error:', e);
        }
    },

    async saveShiftSettings() {
        const payload = {
            shift1_name: document.getElementById('cfg-shift1-name')?.value.trim() || 'Ca 1 (Ca Sáng)',
            shift1_start: document.getElementById('cfg-shift1-start')?.value || '06:30',
            shift1_end: document.getElementById('cfg-shift1-end')?.value || '12:30',
            shift2_name: document.getElementById('cfg-shift2-name')?.value.trim() || 'Ca 2 (Ca Chiều / Tối)',
            shift2_start: document.getElementById('cfg-shift2-start')?.value || '12:30',
            shift2_end: document.getElementById('cfg-shift2-end')?.value || '22:30',
            shift_grace_minutes: parseInt(document.getElementById('cfg-shift-grace')?.value || 15),
            shift_autoclose_enabled: document.getElementById('cfg-shift-autoclose-toggle')?.checked ? 1 : 0
        };

        try {
            const res = await fetch('api/operations.php?action=save_shift_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                this.loadRealtimeStaff();
                this.loadPayroll();
            } else {
                alert(data.message || 'Lỗi khi lưu khung giờ');
            }
        } catch (err) {
            alert('Lỗi kết nối máy chủ');
        }
    }
});
