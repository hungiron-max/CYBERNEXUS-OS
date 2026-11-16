(function() {
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('pos_user') || 'null');
    } catch(e) {}

    if (!user || user.role !== 'admin') {
        alert('Truy cập bị từ chối! Vui lòng đăng nhập tài khoản Quản Trị (Chủ Quán) để vào trang quản trị.');
        window.location.replace('login.html?redirect=admin.html');
        return;
    }
    window.currentUser = user;
    window.SALEAPP_TABLE_QR_ENABLED = true;
})();

// Dừng / Tắt Máy Chủ C++ (Graceful Shutdown)
async function handleAdminShutdownHost() {
    if (!confirm('XÁC NHẬN TẮT MÁY CHỦ C++?\n\nToàn bộ kết nối POS, Bếp và Khách sẽ tạm dừng.\nDữ liệu hóa đơn và doanh thu sẽ được tự động lưu an toàn.')) return;
    try {
        const token = localStorage.getItem('pos_token') || '';
        await fetch('/api/system/control', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ action: 'stop', pin: '9999' })
        });
        alert('Máy chủ C++ đã dừng an toàn thành công!\nBạn có thể đóng trình duyệt.');
    } catch(e) {
        alert('Máy chủ đã ngắt kết nối và tắt hoàn toàn!');
    }
}

// Xử lý đăng xuất Chủ Quán -> Quay về login.html
async function handleAdminLogout() {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất tài khoản Chủ Quán?')) return;
    if (window.JukeboxEngine) {
        window.JukeboxEngine.stopAndLogout();
    }
    try {
        await fetch('api/auth.php?action=logout');
    } catch(e) {}
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
    document.cookie = "pos_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "PHPSESSID=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.replace('login.html?logout=1');
}

// Master list of Vietnamese banks supported by VietQR / NAPAS 247
const VIETQR_BANKS = [
    { code: 'MB', bin: '970422', name: 'MBBank', full: 'Ngân hàng TMCP Quân Đội', popular: true },
    { code: 'VCB', bin: '970436', name: 'Vietcombank', full: 'Ngân hàng TMCP Ngoại Thương Việt Nam', popular: true },
    { code: 'TCB', bin: '970407', name: 'Techcombank', full: 'Ngân hàng TMCP Kỹ Thương Việt Nam', popular: true },
    { code: 'ICB', bin: '970415', name: 'VietinBank', full: 'Ngân hàng TMCP Công Thương Việt Nam', popular: true },
    { code: 'BIDV', bin: '970418', name: 'BIDV', full: 'Ngân hàng TMCP Đầu Tư và Phát Triển Việt Nam', popular: true },
    { code: 'ACB', bin: '970416', name: 'ACB', full: 'Ngân hàng TMCP Á Châu', popular: true },
    { code: 'VPB', bin: '970454', name: 'VPBank', full: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', popular: true },
    { code: 'TPB', bin: '970458', name: 'TPBank', full: 'Ngân hàng TMCP Tiên Phong', popular: true },
    { code: 'STB', bin: '970403', name: 'Sacombank', full: 'Ngân hàng TMCP Sài Gòn Thương Tín', popular: true },
    { code: 'VBA', bin: '970405', name: 'Agribank', full: 'Ngân hàng Nông Nghiệp và PTNT Việt Nam', popular: true },
    { code: 'HDB', bin: '970437', name: 'HDBank', full: 'Ngân hàng TMCP Phát Triển TP.HCM' },
    { code: 'VIB', bin: '970441', name: 'VIB', full: 'Ngân hàng TMCP Quốc Tế Việt Nam' },
    { code: 'MSB', bin: '970426', name: 'MSB', full: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
    { code: 'SHB', bin: '970443', name: 'SHB', full: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
    { code: 'OCB', bin: '970448', name: 'OCB', full: 'Ngân hàng TMCP Phương Đông' },
    { code: 'LPB', bin: '970449', name: 'LPBank', full: 'Ngân hàng TMCP Lộc Phát Việt Nam' },
    { code: 'SEAB', bin: '970440', name: 'SeABank', full: 'Ngân hàng TMCP Đông Nam Á' },
    { code: 'NAB', bin: '970428', name: 'Nam A Bank', full: 'Ngân hàng TMCP Nam Á' },
    { code: 'BVB', bin: '970455', name: 'BVBank', full: 'Ngân hàng TMCP Bản Việt' },
    { code: 'TIMO', bin: '970454', name: 'Timo', full: 'Ngân hàng số Timo (BVBank)' },
    { code: 'CAKE', bin: '970468', name: 'Cake', full: 'Ngân hàng số Cake by VPBank' },
    { code: 'EIB', bin: '970431', name: 'Eximbank', full: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam' },
    { code: 'PVCB', bin: '970412', name: 'PVcomBank', full: 'Ngân hàng TMCP Đại Chúng Việt Nam' },
    { code: 'SHBVN', bin: '970424', name: 'Shinhan Bank', full: 'Ngân hàng TNHH MTV Shinhan Việt Nam' },
    { code: 'WOO', bin: '970457', name: 'Woori Bank', full: 'Ngân hàng TNHH MTV Woori Việt Nam' },
    { code: 'KLB', bin: '970452', name: 'Kienlongbank', full: 'Ngân hàng TMCP Kiên Long' },
    { code: 'BAB', bin: '970409', name: 'Bac A Bank', full: 'Ngân hàng TMCP Bắc Á' },
    { code: 'SGB', bin: '970400', name: 'Saigonbank', full: 'Ngân hàng TMCP Sài Gòn Công Thương' },
    { code: 'BVBANK', bin: '970438', name: 'BaoVietBank', full: 'Ngân hàng TMCP Bảo Việt' },
    { code: 'NCB', bin: '970419', name: 'NCB', full: 'Ngân hàng TMCP Quốc Dân' },
    { code: 'VRB', bin: '970421', name: 'VRB', full: 'Ngân hàng Liên Doanh Việt - Nga' },
    { code: 'VAB', bin: '970427', name: 'VietABank', full: 'Ngân hàng TMCP Việt Á' },
    { code: 'VCCB', bin: '970455', name: 'Viet Capital Bank', full: 'Ngân hàng TMCP Bản Việt' }
];

let adminAdSlides = [];
let advertisingSlidesDirty = false;
const adSlideLabels = {
    store: 'Thông tin quán',
    KM1: 'KM1 · Ưu đãi',
    KM2: 'KM2 · Bán chạy',
    KM3: 'KM3 · Món mới',
    QC1: 'QC1 · Video quán',
    QC2: 'QC2 · Khám phá quán'
};

function updateAdMediaPreview(path, type = null) {
    const img = document.getElementById('ad-media-thumb-img');
    const vid = document.getElementById('ad-media-thumb-video');
    if (!img || !vid) return;

    const isVideo = type === 'video' || /\.(mp4|webm)$/i.test(path || '');
    if (isVideo) {
        img.classList.add('hidden');
        vid.classList.remove('hidden');
        vid.src = path;
        vid.load();
    } else {
        vid.classList.add('hidden');
        img.classList.remove('hidden');
        img.src = path || 'assets/images/dishes/dish_1793448692_5cbbfa81.jpg';
    }
}

function applySlidePreset(presetType) {
    const presets = {
        cafe: {
            label: 'KM1',
            title: 'Hương Vị Cà Phê Pha Phin Truyền Thống',
            description: 'Đậm đà hương vị cà phê mộc nguyên chất, khởi đầu ngày mới tràn đầy sảng khoái và năng lượng.',
            media_path: 'assets/images/dishes/dish_1793448692_5cbbfa81.jpg',
            media_type: 'image',
            duration: 6
        },
        banhmi: {
            label: 'KM2',
            title: 'Bánh Mì Chảo Thơm Giòn Nóng Hổi',
            description: 'Pate béo ngậy, xúc xích và trứng ốp la lòng đào sốt sánh mịn đậm vị khó cưỡng.',
            media_path: 'assets/images/dishes/dish_1793438761_26c1602f.jpg',
            media_type: 'image',
            duration: 6
        },
        bittet: {
            label: 'KM3',
            title: 'Bò Bít Tết Sốt Tiêu Đen Thượng Hạng',
            description: 'Thịt bò tươi mềm mọng nước, sốt tiêu cay nồng thơm lừng kèm khoai tây chiên giòn tan.',
            media_path: 'assets/images/dishes/dish_1793448377_d168bdbb.jpg',
            media_type: 'image',
            duration: 6
        },
        video: {
            label: 'QC1',
            title: 'Không Gian Thư Giãn & Hương Vị Nguyên Bản',
            description: 'Khám phá quy trình pha chế kỳ công và không gian thoáng đãng tại Góc Phố.',
            media_path: 'uploads/advertisements/65bfba6b4181d0e350ebcc94e7bcd240.mp4',
            media_type: 'video',
            duration: 0
        }
    };

    const p = presets[presetType];
    if (!p) return;

    const labelSelect = document.getElementById('ad-slide-label-select');
    if (labelSelect) labelSelect.value = p.label;
    const labelInput = document.getElementById('ad-slide-label');
    if (labelInput) labelInput.value = p.label;

    const titleInput = document.getElementById('ad-slide-title');
    if (titleInput) titleInput.value = p.title;

    const descInput = document.getElementById('ad-slide-description');
    if (descInput) descInput.value = p.description;

    const urlInput = document.getElementById('ad-media-url');
    if (urlInput) urlInput.value = p.media_path;

    const durationSelect = document.getElementById('ad-slide-duration');
    if (durationSelect) durationSelect.value = String(p.duration);

    updateAdMediaPreview(p.media_path, p.media_type);
    adManagerAlert(`Đã chọn mẫu: ${p.title}. Bấm “Thêm Vào Trình Chiếu” để bổ sung.`, true);
}

function orderAdvertisingSlides(slides) {
    // Giữ nguyên thứ tự do người dùng sắp xếp tự do bằng nút Lên / Xuống
    return Array.isArray(slides) ? [...slides] : [];
}

function adManagerAlert(message, success = true) {
    const alertBox = document.getElementById('ad-manager-alert');
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = `relative rounded-lg p-2.5 text-[11px] font-semibold border ${success ? 'border-emerald-400/30 bg-emerald-950/50 text-emerald-200' : 'border-rose-400/30 bg-rose-950/50 text-rose-200'}`;
    alertBox.classList.remove('hidden');
    setTimeout(() => { alertBox.classList.add('hidden'); }, 5000);
}

function setAdvertisingSlidesDirty(dirty) {
    advertisingSlidesDirty = dirty;
}

let editingSlideIndex = -1;

function renderAdvertisingSlides() {
    adminAdSlides = orderAdvertisingSlides(adminAdSlides);
    const list = document.getElementById('ad-slide-list');
    const count = document.getElementById('ad-slide-count');
    const badge = document.getElementById('ad-slide-count-badge');
    if (count) count.textContent = `${adminAdSlides.length}/12 slide`;
    if (badge) badge.textContent = `${adminAdSlides.length} / 12 Slide`;
    if (!list) return;

    list.replaceChildren();

    if (!adminAdSlides.length) {
        const empty = document.createElement('div');
        empty.className = 'rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-center text-[11px] text-slate-400';
        empty.innerHTML = '<i class="fas fa-photo-film mb-2 block text-xl text-fuchsia-300/70"></i>Chưa có slide nào. Hãy chọn mẫu ở trên hoặc tải ảnh lên để bắt đầu.';
        list.appendChild(empty);
        return;
    }

    adminAdSlides.forEach((slide, index) => {
        const isVideo = slide.media_type === 'video' || /\.(mp4|webm)$/i.test(slide.media_path || '');
        const isEditing = editingSlideIndex === index;
        const card = document.createElement('article');
        card.className = `ad-slide-item flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all shadow-sm cursor-pointer ${isEditing ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-amber-950/50' : 'border-white/10 bg-slate-900/80 hover:border-fuchsia-500/40 hover:bg-slate-900'}`;
        card.dataset.index = String(index);
        card.onclick = (e) => {
            if (e.target.closest('button')) return;
            editAdvertisingSlide(index);
        };

        // Thumbnail
        const thumb = document.createElement('div');
        thumb.className = 'relative w-20 h-14 shrink-0 rounded-lg overflow-hidden border border-white/10 bg-slate-950';
        if (isVideo) {
            thumb.innerHTML = `
                <video src="${slide.media_path}" muted playsinline class="w-full h-full object-cover"></video>
                <span class="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs"><i class="fas fa-play"></i></span>
            `;
        } else {
            thumb.innerHTML = `<img src="${slide.media_path}" alt="" class="w-full h-full object-cover" onerror="this.src='assets/images/dishes/default_dish.jpg';" />`;
        }

        // Middle Info
        const info = document.createElement('div');
        info.className = 'min-w-0 flex-1 space-y-1';

        const metaRow = document.createElement('div');
        metaRow.className = 'flex items-center gap-1.5 flex-wrap';

        const badgeEl = document.createElement('span');
        const labelText = adSlideLabels[slide.label] || slide.label || (isVideo ? 'Video' : 'Ảnh');
        badgeEl.className = `px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isVideo ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : (slide.label === 'KM2' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30')}`;
        badgeEl.textContent = labelText;

        const durationPill = document.createElement('span');
        durationPill.className = 'text-[9px] text-slate-400 font-mono';
        durationPill.textContent = isVideo ? '⏱ Hết video' : `⏱ ${slide.duration || 6}s`;

        metaRow.append(badgeEl, durationPill);

        if (isEditing) {
            const editingBadge = document.createElement('span');
            editingBadge.className = 'px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-amber-400 text-slate-950';
            editingBadge.textContent = 'ĐANG SỬA';
            metaRow.append(editingBadge);
        }

        let cleanTitle = String(slide.title || '').trim();
        if (/^[a-f0-9_\-\.]{12,}$/i.test(cleanTitle)) {
            cleanTitle = isVideo ? 'Video Trải Nghiệm Không Gian Quán' : 'Món Ngon Đặc Sản Góc Phố';
        }

        const titleEl = document.createElement('h5');
        titleEl.className = `text-xs font-bold truncate ${isEditing ? 'text-amber-200' : 'text-white'}`;
        titleEl.textContent = cleanTitle || 'Slide không tên';

        const descEl = document.createElement('p');
        descEl.className = 'text-[10px] text-slate-400 truncate';
        descEl.textContent = slide.description || 'Chưa có mô tả';

        info.append(metaRow, titleEl, descEl);

        // Actions: Edit, Preview, Up, Down, Delete
        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-1 shrink-0';

        // NÚT CHỈNH SỬA (EDIT)
        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.title = 'Chỉnh sửa slide này';
        btnEdit.innerHTML = '<i class="fas fa-pen-to-square text-[10px] pointer-events-none"></i>';
        btnEdit.className = `h-7 w-7 rounded-lg border flex items-center justify-center transition-all ${isEditing ? 'border-amber-400 bg-amber-400 text-slate-950 font-bold' : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/30 hover:text-white'}`;
        btnEdit.onclick = (e) => {
            e.stopPropagation();
            if (isEditing) {
                cancelEditAdvertisingSlide();
            } else {
                editAdvertisingSlide(index);
            }
        };

        const btnPrev = document.createElement('button');
        btnPrev.type = 'button';
        btnPrev.title = 'Xem trước toàn bộ slide bắt đầu từ slide này';
        btnPrev.innerHTML = '<i class="fas fa-eye text-[10px] pointer-events-none"></i>';
        btnPrev.className = 'h-7 w-7 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/30 hover:text-white flex items-center justify-center transition-all';
        btnPrev.onclick = (e) => {
            e.stopPropagation();
            previewSingleSlide(index);
        };

        const btnUp = document.createElement('button');
        btnUp.type = 'button';
        btnUp.title = 'Di chuyển lên';
        btnUp.innerHTML = '<i class="fas fa-arrow-up text-[10px] pointer-events-none"></i>';
        btnUp.className = 'h-7 w-7 rounded-lg border border-white/10 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all disabled:opacity-30';
        btnUp.disabled = index === 0;
        btnUp.onclick = (e) => {
            e.stopPropagation();
            moveAdvertisingSlide(index, -1);
        };

        const btnDown = document.createElement('button');
        btnDown.type = 'button';
        btnDown.title = 'Di chuyển xuống';
        btnDown.innerHTML = '<i class="fas fa-arrow-down text-[10px] pointer-events-none"></i>';
        btnDown.className = 'h-7 w-7 rounded-lg border border-white/10 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all disabled:opacity-30';
        btnDown.disabled = index === adminAdSlides.length - 1;
        btnDown.onclick = (e) => {
            e.stopPropagation();
            moveAdvertisingSlide(index, 1);
        };

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.title = 'Xóa slide';
        btnDel.innerHTML = '<i class="fas fa-trash-can text-[10px] pointer-events-none"></i>';
        btnDel.className = 'h-7 w-7 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/30 hover:text-rose-100 flex items-center justify-center transition-all';
        btnDel.onclick = (e) => {
            e.stopPropagation();
            removeAdvertisingSlide(index);
        };

        actions.append(btnEdit, btnPrev, btnUp, btnDown, btnDel);

        card.append(thumb, info, actions);
        list.appendChild(card);
    });
}

function editAdvertisingSlide(index) {
    const slide = adminAdSlides[index];
    if (!slide) return;
    editingSlideIndex = index;

    const isVideo = slide.media_type === 'video' || /\.(mp4|webm)$/i.test(slide.media_path || '');

    // Đổ dữ liệu slide vào Form soạn thảo
    const urlInput = document.getElementById('ad-media-url');
    if (urlInput) urlInput.value = slide.media_path;
    updateAdMediaPreview(slide.media_path, isVideo ? 'video' : 'image');

    const labelSelect = document.getElementById('ad-slide-label-select');
    if (labelSelect) labelSelect.value = slide.label || (isVideo ? 'QC1' : 'KM1');
    const labelInput = document.getElementById('ad-slide-label');
    if (labelInput) labelInput.value = slide.label || (isVideo ? 'QC1' : 'KM1');

    const durationSelect = document.getElementById('ad-slide-duration');
    if (durationSelect) durationSelect.value = isVideo ? '0' : String(slide.duration || 6);

    let cleanTitle = String(slide.title || '').trim();
    if (/^[a-f0-9_\-\.]{12,}$/i.test(cleanTitle)) {
        cleanTitle = isVideo ? 'Video Trải Nghiệm Không Gian Quán' : 'Món Ngon Đặc Sản Góc Phố';
    }
    const titleInput = document.getElementById('ad-slide-title');
    if (titleInput) titleInput.value = cleanTitle;

    const descInput = document.getElementById('ad-slide-description');
    if (descInput) descInput.value = slide.description || '';

    // Đổi tiêu đề Form và Nút Lưu thành Chế độ Chỉnh sửa
    const heading = document.getElementById('ad-form-heading');
    if (heading) heading.textContent = `Chỉnh Sửa Slide #${index + 1}`;
    const icon = document.getElementById('ad-form-icon');
    if (icon) icon.className = 'fas fa-pen-to-square text-amber-400';

    const addBtn = document.getElementById('ad-slide-add-button');
    if (addBtn) {
        addBtn.className = 'rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 py-2 px-3 text-xs font-black text-white shadow-lg shadow-amber-950/40 transition hover:brightness-110 flex items-center justify-center gap-1.5';
        addBtn.innerHTML = '<i class="fas fa-floppy-disk"></i><span>Cập Nhật Slide</span>';
    }

    const cancelBtn = document.getElementById('ad-slide-cancel-edit-btn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    renderAdvertisingSlides();
    document.getElementById('ad-slide-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    adManagerAlert(`Đang chỉnh sửa slide #${index + 1}. Hãy sửa nội dung rồi bấm "Cập Nhật Slide".`, true);
}

function cancelEditAdvertisingSlide() {
    editingSlideIndex = -1;
    const heading = document.getElementById('ad-form-heading');
    if (heading) heading.textContent = 'Thêm Slide Mới';
    const icon = document.getElementById('ad-form-icon');
    if (icon) icon.className = 'fas fa-plus-circle text-fuchsia-400';

    const addBtn = document.getElementById('ad-slide-add-button');
    if (addBtn) {
        addBtn.className = 'rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 py-2 px-3 text-xs font-black text-white shadow-lg shadow-fuchsia-950/40 transition hover:brightness-110 flex items-center justify-center gap-1.5';
        addBtn.innerHTML = '<i class="fas fa-plus"></i><span>Thêm Vào Deck</span>';
    }

    const cancelBtn = document.getElementById('ad-slide-cancel-edit-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');

    renderAdvertisingSlides();
}

function moveAdvertisingSlide(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= adminAdSlides.length) return;
    const movedSlide = adminAdSlides[index];
    adminAdSlides[index] = adminAdSlides[target];
    adminAdSlides[target] = movedSlide;
    if (editingSlideIndex === index) editingSlideIndex = target;
    else if (editingSlideIndex === target) editingSlideIndex = index;
    renderAdvertisingSlides();
    setAdvertisingSlidesDirty(true);
    adManagerAlert(`Đã di chuyển slide lên vị trí #${target + 1}. Bấm “Lưu & Xuất Bản Ngay” để áp dụng.`, true);
}

function removeAdvertisingSlide(index) {
    if (editingSlideIndex === index) cancelEditAdvertisingSlide();
    else if (editingSlideIndex > index) editingSlideIndex--;
    adminAdSlides.splice(index, 1);
    renderAdvertisingSlides();
    setAdvertisingSlidesDirty(true);
    adManagerAlert('Đã xóa slide khỏi danh sách. Hãy bấm “Lưu & Xuất Bản Ngay”.', true);
}

document.getElementById('ad-media-file')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);
    const labelSelect = document.getElementById('ad-slide-label-select');
    if (labelSelect) labelSelect.value = isVideo ? 'QC1' : 'KM1';
    const labelInput = document.getElementById('ad-slide-label');
    if (labelInput) labelInput.value = isVideo ? 'QC1' : 'KM1';

    const titleInput = document.getElementById('ad-slide-title');
    if (titleInput) {
        const currentVal = titleInput.value.trim();
        // Tuyệt đối không lấy tên file (nhất là mã hash) để nhét vào tiêu đề!
        // Chỉ gợi ý tiêu đề có ý nghĩa nếu ô tiêu đề đang trống hoặc dính mã hash
        if (!currentVal || /^[a-f0-9_\-\.]{12,}$/i.test(currentVal)) {
            titleInput.value = isVideo ? 'Video Trải Nghiệm Góc Phố' : 'Món Ngon Đặc Sản Góc Phố';
        }
    }

    // Preview local file
    const reader = new FileReader();
    reader.onload = e => updateAdMediaPreview(e.target.result, isVideo ? 'video' : 'image');
    reader.readAsDataURL(file);
});

async function uploadAndAddAdSlide() {
    const fileInput = document.getElementById('ad-media-file');
    const file = fileInput?.files?.[0];
    const urlInput = document.getElementById('ad-media-url');
    const directPath = urlInput?.value.trim() || '';

    if (editingSlideIndex < 0 && adminAdSlides.length >= 12) {
        return adManagerAlert('Đã đạt giới hạn tối đa 12 slide.', false);
    }
    if (!file && !directPath) {
        return adManagerAlert('Vui lòng chọn ảnh/video hoặc dán URL media.', false);
    }

    const isVideo = file 
        ? Boolean(file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name))
        : /\.(mp4|webm)$/i.test(directPath);

    const titleInput = document.getElementById('ad-slide-title');
    let title = titleInput?.value.trim() || '';
    if (!title || /^[a-f0-9_\-\.]{12,}$/i.test(title)) {
        title = isVideo ? 'Video Trải Nghiệm Không Gian Quán' : 'Món Ngon Đặc Sản Góc Phố';
    }

    const labelInput = document.getElementById('ad-slide-label');
    const label = labelInput?.value.trim() || (isVideo ? 'QC1' : 'KM1');
    const desc = document.getElementById('ad-slide-description')?.value.trim() || '';
    const duration = isVideo ? 0 : (Number(document.getElementById('ad-slide-duration')?.value) || 6);

    const button = document.getElementById('ad-slide-add-button');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Đang xử lý media...';

    try {
        let mediaPath = directPath;
        let mediaType = isVideo ? 'video' : 'image';

        if (file) {
            const formData = new FormData();
            formData.append('media', file);
            const response = await fetch('api/advertising?action=upload_media', { method: 'POST', body: formData });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Không thể tải media lên.');
            mediaPath = data.media.path;
            mediaType = data.media.type;
        }

        // NẾU ĐANG Ở CHẾ ĐỘ SỬA: CẬP NHẬT SLIDE HIỆN TẠI
        if (editingSlideIndex >= 0 && editingSlideIndex < adminAdSlides.length) {
            adminAdSlides[editingSlideIndex] = {
                ...adminAdSlides[editingSlideIndex],
                label,
                title,
                description: desc,
                media_path: mediaPath,
                media_type: mediaType,
                duration,
                enabled: true
            };
            const updatedIdx = editingSlideIndex;
            cancelEditAdvertisingSlide();
            renderAdvertisingSlides();
            setAdvertisingSlidesDirty(true);
            if (fileInput) fileInput.value = '';
            adManagerAlert(`Đã cập nhật slide #${updatedIdx + 1}! Bấm “Lưu & Xuất Bản Ngay” để cập nhật cho khách.`, true);
            openCarouselFullPreview(updatedIdx);
            return;
        }

        // NẾU Ở CHẾ ĐỘ THÊM MỚI: THÊM VÀO DECK
        adminAdSlides.push({
            label,
            title,
            description: desc,
            media_path: mediaPath,
            media_type: mediaType,
            duration,
            enabled: true
        });

        renderAdvertisingSlides();
        setAdvertisingSlidesDirty(true);
        if (fileInput) fileInput.value = '';
        adManagerAlert('Đã thêm slide vào danh sách! Bấm “Lưu & Xuất Bản Ngay” để cập nhật cho khách.', true);
        openCarouselFullPreview(adminAdSlides.length - 1);
    } catch (error) {
        adManagerAlert(error.message || 'Không thể tải media lên.', false);
    } finally {
        button.disabled = false;
        if (editingSlideIndex >= 0) {
            button.innerHTML = '<i class="fas fa-floppy-disk"></i><span>Cập Nhật Slide</span>';
        } else {
            button.innerHTML = '<i class="fas fa-plus"></i><span>Thêm Vào Deck</span>';
        }
    }
}

async function saveAdvertisingSlides() {
    const button = document.querySelector('button[onclick="saveAdvertisingSlides()"]');
    if (button) button.disabled = true;
    try {
        const response = await fetch('api/advertising?action=save_slides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slides: adminAdSlides })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Không thể lưu trình chiếu.');
        adminAdSlides = data.slides || adminAdSlides;
        renderAdvertisingSlides();
        setAdvertisingSlidesDirty(false);
        adManagerAlert('Đã lưu & xuất bản trình chiếu thành công lên màn hình khách hàng!', true);
    } catch (error) {
        adManagerAlert(error.message || 'Lỗi lưu trình chiếu.', false);
    } finally {
        if (button) button.disabled = false;
    }
}

async function loadAdminAdSlides() {
    try {
        const response = await fetch('api/advertising');
        const data = await response.json();
        if (data.success && Array.isArray(data.slides)) {
            adminAdSlides = data.slides;
            renderAdvertisingSlides();
        }
    } catch (e) {
        console.log('Error loading slides:', e);
    }
}
loadAdminAdSlides();

renderAdvertisingSlides();
setAdvertisingSlidesDirty(false);

// ==========================================
// AD CAROUSEL / SLIDE LIVE PREVIEW FUNCTIONS (FULL SIMULATOR)
// ==========================================
let previewSlidesList = [];
let previewCurrentIndex = 0;
let previewTimer = null;
let previewPaused = false;
let previewSoundEnabled = false;

function closeAdPreviewModal() {
    const modal = document.getElementById('ad-preview-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    if (previewTimer) clearTimeout(previewTimer);
    const content = document.getElementById('ad-preview-slide-content');
    if (content) {
        const vid = content.querySelector('video');
        if (vid) vid.pause();
    }
}

function initPreviewCustomerQr() {
    const container = document.getElementById('preview-customer-qr-canvas');
    if (!container) return;
    container.innerHTML = '';
    const base = (typeof getAdminBaseUrl === 'function') ? getAdminBaseUrl() : (function() {
        const cached = localStorage.getItem('server_lan_base_url');
        if (cached) return cached.endsWith('/') ? cached : (cached + '/');
        return window.location.origin + '/';
    })();
    const url = base + 'customer.html';
    if (typeof QRCode !== 'undefined') {
        try {
            new QRCode(container, {
                text: url,
                width: 120,
                height: 120,
                colorDark: "#0b0f19",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch(e) {
            console.error("QR preview error:", e);
        }
    }
}

function formatPreviewSlideLabel(rawLabel, isVid) {
    const s = String(rawLabel || '').trim();
    if (s === 'KM1') return { text: 'ƯU ĐÃI ĐẶC BIỆT · KM1', icon: 'fa-sparkles', badge: 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' };
    if (s === 'KM2') return { text: 'MÓN BÁN CHẠY NHẤT · KM2', icon: 'fa-fire', badge: 'border-rose-300/40 bg-gradient-to-r from-rose-500/25 to-orange-500/25 text-rose-200' };
    if (s === 'KM3') return { text: 'MÓN MỚI TUẦN NÀY · KM3', icon: 'fa-star', badge: 'border-emerald-300/40 bg-gradient-to-r from-emerald-500/25 to-teal-500/25 text-emerald-200' };
    if (s === 'QC1') return { text: 'VIDEO TRẢI NGHIỆM · QC1', icon: 'fa-play', badge: 'border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-sky-200' };
    if (s === 'QC2') return { text: 'KHÁM PHÁ GÓC PHỐ · QC2', icon: 'fa-compass', badge: 'border-purple-300/40 bg-gradient-to-r from-purple-500/25 to-fuchsia-500/25 text-purple-200' };
    if (/^KM/i.test(s)) return { text: `ƯU ĐÃI · ${s}`, icon: 'fa-sparkles', badge: 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' };
    if (/^QC/i.test(s)) return { text: `QUẢNG CÁO · ${s}`, icon: 'fa-video', badge: 'border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-sky-200' };
    return { text: s ? s.toUpperCase() : (isVid ? 'VIDEO TRẢI NGHIỆM' : 'ƯU ĐÃI ĐẶC BIỆT'), icon: isVid ? 'fa-play' : 'fa-sparkles', badge: 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' };
}

function renderPreviewCurrentSlide() {
    const content = document.getElementById('ad-preview-slide-content');
    const dots = document.getElementById('ad-preview-dots');
    if (!content || !previewSlidesList.length) return;

    const slide = previewSlidesList[previewCurrentIndex];
    const isVideo = slide.media_type === 'video' || /\.(mp4|webm)$/i.test(slide.media_path || '');
    const meta = formatPreviewSlideLabel(slide.label, isVideo);

    // Xóa sạch tên file hash nếu còn sót lại ở title
    let cleanTitle = String(slide.title || '').trim();
    if (!cleanTitle || /^[a-f0-9_\-\.]{12,}$/i.test(cleanTitle)) {
        cleanTitle = isVideo ? 'Video Trải Nghiệm Không Gian Quán' : 'Món Ngon Đặc Sản Góc Phố';
    }

    if (isVideo) {
        content.innerHTML = `
            <div class="preview-slide-fade absolute inset-0 h-full w-full overflow-hidden">
                <video class="absolute inset-0 h-full w-full object-cover" src="${slide.media_path}" autoplay muted playsinline preload="auto"></video>
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent pointer-events-none"></div>
                <div class="relative z-10 flex h-full min-h-[280px] sm:min-h-[320px] flex-col items-start justify-end px-5 pb-5 sm:px-8 sm:pb-6 max-w-xl">
                    <span class="inline-flex items-center gap-1.5 rounded-full border ${meta.badge} bg-slate-950/80 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider backdrop-blur-md shadow-lg">
                        <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                        <i class="fas ${meta.icon} text-[9px]"></i> ${meta.text}
                    </span>
                    <h3 class="mt-2 text-base sm:text-xl font-black leading-snug slide-title-rainbow">${cleanTitle}</h3>
                    <p class="mt-1 text-xs text-slate-200/95 leading-relaxed max-w-sm line-clamp-2 slide-desc-crisp">${slide.description || ''}</p>
                    <div class="flex flex-wrap items-center gap-1.5 pt-2 text-[9px] font-semibold">
                        <span class="px-2 py-0.5 rounded-md bg-slate-950/80 text-emerald-300 border border-emerald-500/40 backdrop-blur-md flex items-center gap-1 shadow-md">
                            <i class="fas fa-play text-[8px]"></i> Đang phát clip quán
                        </span>
                        <span class="px-2 py-0.5 rounded-md bg-slate-950/80 text-sky-300 border border-sky-500/40 backdrop-blur-md flex items-center gap-1 shadow-md">
                            <i class="fas fa-qrcode text-[8px]"></i> VietQR
                        </span>
                    </div>
                </div>
                <button type="button" onclick="togglePreviewVideoSound()" class="absolute top-3 right-3 z-30 h-7 w-7 rounded-full border border-white/20 bg-slate-950/70 text-xs text-white backdrop-blur flex items-center justify-center hover:bg-white/20 shadow-md" title="Bật/Tắt âm thanh">
                    <i id="preview-video-sound-icon" class="fas fa-${previewSoundEnabled ? 'volume-high' : 'volume-xmark'}"></i>
                </button>
            </div>
        `;
        const vid = content.querySelector('video');
        if (vid) {
            vid.muted = !previewSoundEnabled;
            vid.currentTime = 0;
            vid.play().catch(e => {
                console.warn('Video preview autoplay with sound blocked, trying muted:', e);
                vid.muted = true;
                vid.play().catch(err => console.error('Video preview play failed:', err));
            });
            vid.onended = () => {
                if (!previewPaused && previewSlidesList.length > 1) {
                    previewAdCarouselNext();
                }
            };
            vid.onerror = (e) => {
                console.warn('Video preview source error:', e);
                if (!previewPaused && previewSlidesList.length > 1) {
                    setTimeout(previewAdCarouselNext, 2500);
                }
            };
        }
    } else {
        content.innerHTML = `
            <div class="preview-slide-fade absolute inset-0 h-full w-full overflow-hidden">
                <img class="absolute inset-0 h-full w-full object-cover object-center" src="${slide.media_path}" alt="${cleanTitle}" onerror="this.src='assets/images/dishes/default_dish.jpg';" />
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent pointer-events-none"></div>
                <div class="relative z-10 flex h-full min-h-[280px] sm:min-h-[320px] flex-col items-start justify-end px-5 pb-5 sm:px-8 sm:pb-6 max-w-xl">
                    <span class="inline-flex items-center gap-1.5 rounded-full border ${meta.badge} bg-slate-950/80 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider backdrop-blur-md shadow-lg">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        <i class="fas ${meta.icon} text-[9px]"></i> ${meta.text}
                    </span>
                    <h2 class="mt-2 text-base sm:text-xl font-black leading-snug tracking-tight slide-title-rainbow">${cleanTitle}</h2>
                    <div class="mt-1 h-0.5 w-10 rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-transparent"></div>
                    <p class="mt-1 max-w-sm text-xs text-slate-200/95 leading-relaxed line-clamp-2 slide-desc-crisp">${slide.description || ''}</p>
                    <div class="flex flex-wrap items-center gap-1.5 pt-2 text-[9px] font-semibold">
                        <span class="px-2 py-0.5 rounded-md bg-slate-950/80 text-emerald-300 border border-emerald-500/40 backdrop-blur-md flex items-center gap-1 shadow-md">
                            <i class="fas fa-check-circle text-[8px]"></i> Phục vụ nhanh
                        </span>
                        <span class="px-2 py-0.5 rounded-md bg-slate-950/80 text-sky-300 border border-sky-500/40 backdrop-blur-md flex items-center gap-1 shadow-md">
                            <i class="fas fa-qrcode text-[8px]"></i> VietQR
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    if (dots) {
        dots.innerHTML = '';
        previewSlidesList.forEach((_, dIdx) => {
            const d = document.createElement('button');
            d.type = 'button';
            d.className = `h-1.5 rounded-full transition-all ${dIdx === previewCurrentIndex ? 'w-6 bg-white shadow' : 'w-2 bg-white/40'}`;
            d.onclick = () => {
                previewCurrentIndex = dIdx;
                renderPreviewCurrentSlide();
                schedulePreviewNext();
            };
            dots.appendChild(d);
        });
    }
}

function togglePreviewVideoSound() {
    previewSoundEnabled = !previewSoundEnabled;
    const icon = document.getElementById('preview-video-sound-icon');
    if (icon) icon.className = `fas fa-${previewSoundEnabled ? 'volume-high' : 'volume-xmark'}`;
    const vid = document.querySelector('#ad-preview-slide-content video');
    if (vid) vid.muted = !previewSoundEnabled;
}

function schedulePreviewNext() {
    if (previewTimer) clearTimeout(previewTimer);
    if (previewPaused || previewSlidesList.length <= 1) return;

    const slide = previewSlidesList[previewCurrentIndex];
    const isVideo = slide.media_type === 'video' || /\.(mp4|webm)$/i.test(slide.media_path || '');
    if (isVideo) return; // Video tự chuyển slide khi kết thúc thông qua sự kiện 'ended'

    const duration = Number(slide.duration) || 6;
    previewTimer = setTimeout(() => {
        previewAdCarouselNext();
    }, duration * 1000);
}

function previewAdCarouselNext() {
    if (!previewSlidesList.length) return;
    previewCurrentIndex = (previewCurrentIndex + 1) % previewSlidesList.length;
    renderPreviewCurrentSlide();
    schedulePreviewNext();
}

function previewAdCarouselPrev() {
    if (!previewSlidesList.length) return;
    previewCurrentIndex = (previewCurrentIndex - 1 + previewSlidesList.length) % previewSlidesList.length;
    renderPreviewCurrentSlide();
    schedulePreviewNext();
}

function toggleAdPreviewPlayback() {
    previewPaused = !previewPaused;
    const btn = document.getElementById('ad-preview-toggle-btn');
    if (btn) btn.innerHTML = `<i class="fas fa-${previewPaused ? 'play' : 'pause'}"></i>`;
    if (previewPaused) {
        if (previewTimer) clearTimeout(previewTimer);
        const vid = document.querySelector('#ad-preview-slide-content video');
        if (vid) vid.pause();
    } else {
        const vid = document.querySelector('#ad-preview-slide-content video');
        if (vid) vid.play().catch(() => {});
        schedulePreviewNext();
    }
}

function openCarouselFullPreview(startIndex = 0) {
    if (!adminAdSlides.length) {
        alert('Chưa có slide nào trong danh sách. Hãy thêm ít nhất 1 slide để xem trước.');
        return;
    }
    previewSlidesList = [...adminAdSlides];
    previewCurrentIndex = Math.min(startIndex, previewSlidesList.length - 1);
    previewPaused = false;
    const btn = document.getElementById('ad-preview-toggle-btn');
    if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
    const tag = document.getElementById('ad-preview-mode-tag');
    if (tag) tag.textContent = `Toàn bộ trình chiếu (${previewSlidesList.length} slide - Tự động phát)`;
    const modal = document.getElementById('ad-preview-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    initPreviewCustomerQr();
    renderPreviewCurrentSlide();
    schedulePreviewNext();
}

function previewSingleSlide(index) {
    // Xem toàn bộ slide bắt đầu từ slide này để người dùng thấy mạch trình chiếu liên tục
    openCarouselFullPreview(index);
}

function previewCurrentDraftSlide() {
    let title = document.getElementById('ad-slide-title')?.value.trim() || '';
    const description = document.getElementById('ad-slide-description')?.value.trim() || '';
    const label = document.getElementById('ad-slide-label-select')?.value || document.getElementById('ad-slide-label')?.value || 'KM1';
    const duration = Number(document.getElementById('ad-slide-duration')?.value) || 6;
    const mediaUrl = document.getElementById('ad-media-url')?.value.trim() || 'assets/images/dishes/dish_1793448692_5cbbfa81.jpg';
    const isVideo = /\.(mp4|webm)$/i.test(mediaUrl);

    // Loại bỏ tên file / mã hash vô nghĩa nếu còn trong input
    if (!title || /^[a-f0-9_\-\.]{12,}$/i.test(title)) {
        title = isVideo ? 'Video Trải Nghiệm Không Gian Quán' : 'Món Ngon Đặc Sản Góc Phố';
    }

    const draftSlide = {
        title,
        description,
        label,
        duration: isVideo ? 0 : duration,
        media_path: mediaUrl,
        media_type: isVideo ? 'video' : 'image',
        enabled: true
    };

    // Ghép slide đang soạn vào TOÀN BỘ danh sách slide để người dùng xem mạch trình chiếu hoàn chỉnh
    const otherSlides = adminAdSlides.filter(s => s.media_path !== mediaUrl);
    previewSlidesList = [draftSlide, ...otherSlides];
    previewCurrentIndex = 0;
    previewPaused = false;

    const btn = document.getElementById('ad-preview-toggle-btn');
    if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';

    const tag = document.getElementById('ad-preview-mode-tag');
    if (tag) tag.textContent = `Xem toàn bộ slide (${previewSlidesList.length} slide - Bản mới ở đầu)`;
    const modal = document.getElementById('ad-preview-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    initPreviewCustomerQr();
    renderPreviewCurrentSlide();
    schedulePreviewNext();
}

async function aiGenerateAdvertisingSlide(btn) {
    const titleInput = document.getElementById('ad-slide-title');
    const descInput = document.getElementById('ad-slide-description');
    const topic = prompt('Nhập chủ đề / món cần AI thiết kế Slide (hoặc để trống để dùng tiêu đề hiện tại):', titleInput ? titleInput.value.trim() : '');
    if (topic === null) return;
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo...'; }
    try {
        const res = await fetch('api/advertising.php?action=ai_generate_slide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topic.trim() || (titleInput ? titleInput.value.trim() : 'Khuyến mãi đồ uống đặc biệt') })
        });
        const data = await res.json();
        if (data.success && data.media_path) {
            if (titleInput && data.title) titleInput.value = data.title;
            if (descInput && data.description) descInput.value = data.description;
            const mediaInput = document.getElementById('ad-slide-media-url');
            if (mediaInput) mediaInput.value = data.media_path;
            if (typeof setAdSlidePreviewMedia === 'function') {
                setAdSlidePreviewMedia(data.media_path, 'image');
            }
            alert(data.message || 'AI đã tạo nội dung và ảnh slide thành công! Bấm "Thêm Deck" hoặc "Xem Trước".');
        } else {
            alert(data.message || 'Không thể tạo slide bằng AI!');
        }
    } catch (e) {
        alert('Lỗi kết nối AI: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
}

function renderBanks(list) {
    const container = document.getElementById('bank-list-container');
    if (!container) return;
    if (!list || list.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Không tìm thấy ngân hàng nào khớp với từ khóa tìm kiếm.</div>';
        return;
    }

    container.innerHTML = list.map(b => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-white/5 hover:border-sky-500/30 transition-all cursor-pointer group" onclick="selectBank('${b.code}')">
            <div class="flex items-center gap-3">
                <div class="w-12 h-9 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center font-bold text-sky-400 text-xs font-mono group-hover:border-sky-400">
                    ${b.code}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-xs text-white group-hover:text-sky-300">${b.name}</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-300 font-mono">BIN: ${b.bin}</span>
                        ${b.popular ? '<span class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-semibold">Phổ biến</span>' : ''}
                    </div>
                    <div class="text-[11px] text-slate-400 mt-0.5">${b.full}</div>
                </div>
            </div>
            <button type="button" class="btn-glass text-[11px] py-1 px-3 bg-sky-600/30 hover:bg-sky-500 text-sky-200 group-hover:text-white border-sky-400/30 font-semibold flex items-center gap-1">
                <i class="fas fa-check"></i>
                <span>Chọn</span>
            </button>
        </div>
    `).join('');
}

function openBankPickerModal() {
    renderBanks(VIETQR_BANKS);
    const input = document.getElementById('bank-search-input');
    if (input) input.value = '';
    const modal = document.getElementById('bank-picker-modal');
    if (modal) modal.classList.add('open');
}

function closeBankPickerModal() {
    const modal = document.getElementById('bank-picker-modal');
    if (modal) modal.classList.remove('open');
}

function filterBankList(keyword) {
    const kw = (keyword || '').toLowerCase().trim();
    if (!kw) {
        renderBanks(VIETQR_BANKS);
        return;
    }
    const filtered = VIETQR_BANKS.filter(b => 
        b.code.toLowerCase().includes(kw) ||
        b.name.toLowerCase().includes(kw) ||
        b.full.toLowerCase().includes(kw) ||
        b.bin.includes(kw)
    );
    renderBanks(filtered);
}

function selectBank(bankCode) {
    const input = document.getElementById('setting-bank-id');
    if (input) {
        input.value = bankCode;
        input.focus();
        // Add quick visual pulse
        input.classList.add('ring-2', 'ring-emerald-400');
        setTimeout(() => input.classList.remove('ring-2', 'ring-emerald-400'), 1000);
    }
    closeBankPickerModal();
}

function renderDetectedAdapters(adapters, currentServerIp) {
    const list = document.getElementById('detected-lan-adapters-list');
    if (!list) return;
    if (!adapters || adapters.length === 0) {
        list.innerHTML = `<div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">Không phát hiện card mạng LAN đang kết nối. Vui lòng kiểm tra Wi-Fi / Cáp mạng.</div>`;
        return;
    }

    list.innerHTML = adapters.map(a => {
        const isCurrent = (a.ip === currentServerIp);
        return `
            <div class="p-2 sm:p-2.5 rounded-xl ${isCurrent ? 'bg-emerald-950/40 border-emerald-500/40 shadow-sm' : 'bg-slate-950/60 border-white/10'} border flex items-center justify-between gap-2 transition-all">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full ${a.isVirtual ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'} shrink-0"></span>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-mono font-black text-xs ${isCurrent ? 'text-emerald-300' : 'text-white'}">${a.ip}</span>
                            <span class="text-[10px] px-1.5 py-0.5 rounded ${a.isVirtual ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'} font-semibold truncate">${a.adapter}</span>
                            ${a.isVirtual ? '<span class="text-[9px] text-slate-500">(Card mạng ảo / Virtual)</span>' : '<span class="text-[9px] text-emerald-400 font-bold"><i class="fas fa-check-circle text-[9px] mr-0.5"></i>Khuyên Dùng Cho Quán</span>'}
                        </div>
                        ${a.description ? `<div class="text-[10px] text-slate-400 truncate max-w-md">${a.description}</div>` : ''}
                    </div>
                </div>
                <button type="button" onclick="selectServerIp('${a.ip}')" class="px-2.5 py-1 rounded-lg ${isCurrent ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'} text-[11px] shrink-0 transition-all cursor-pointer">
                    ${isCurrent ? '<i class="fas fa-check mr-1 text-emerald-400"></i>Đang Dùng' : 'Dùng IP Này'}
                </button>
            </div>
        `;
    }).join('');
}

function selectServerIp(ip) {
    const input = document.getElementById('setting-server-ip');
    if (input) {
        input.value = ip;
        updateLiveServerBaseUrl();
        input.classList.add('ring-2', 'ring-emerald-400');
        setTimeout(() => input.classList.remove('ring-2', 'ring-emerald-400'), 1000);
    }
}

function updateLiveServerBaseUrl() {
    const ipInput = document.getElementById('setting-server-ip');
    const portInput = document.getElementById('setting-server-port');
    const urlEl = document.getElementById('setting-live-server-url');
    const linkEl = document.getElementById('setting-live-server-link');
    const ip = (ipInput && ipInput.value.trim()) ? ipInput.value.trim() : 'localhost';
    const port = (portInput && portInput.value.trim()) ? portInput.value.trim() : '8501';
    const baseUrl = `http://${ip}:${port}/`;
    if (urlEl) urlEl.textContent = baseUrl;
    if (linkEl) linkEl.href = baseUrl + 'customer.html';
    localStorage.setItem('server_lan_base_url', baseUrl);
}

function copyLiveServerUrl() {
    const urlEl = document.getElementById('setting-live-server-url');
    if (urlEl && navigator.clipboard) {
        navigator.clipboard.writeText(urlEl.textContent.trim());
        alert('Đã sao chép Base URL máy chủ:\n' + urlEl.textContent.trim());
    }
}

async function detectServerNetwork() {
    await loadStoreSettings();
}

async function loadStoreSettings() {
    try {
        const res = await fetch('api/settings.php');
        const json = await res.json();
        if (!json.success || !json.data) return;
        const d = json.data;

        const form = document.getElementById('settings-form');
        if (form) {
            for (const [k, v] of Object.entries(d)) {
                const input = form.querySelector(`[name="${k}"]`);
                if (input && typeof v === 'string') {
                    input.value = v;
                }
            }
        }

        // Render detected LAN adapters
        renderDetectedAdapters(d.detected_ips || [], d.server_ip || d.primary_lan_ip);

        // Update server IP & Port inputs if empty
        const ipInput = document.getElementById('setting-server-ip');
        if (ipInput && (!ipInput.value || ipInput.value === 'localhost')) {
            ipInput.value = d.server_ip || d.primary_lan_ip || '10.0.126.159';
        }
        const portInput = document.getElementById('setting-server-port');
        if (portInput && !portInput.value) {
            portInput.value = d.server_port || '8501';
        }

        // Update live base URL banner
        updateLiveServerBaseUrl();

        if (d.server_base_url) {
            localStorage.setItem('server_lan_base_url', d.server_base_url);
        }

        const qBadge = document.getElementById('slave-ai-quota-badge');
        if (qBadge && d.ai_quota) {
            const q = d.ai_quota;
            if (q.unlimited) {
                qBadge.textContent = '• Quota: Không giới hạn';
                qBadge.className = 'text-[11px] font-mono text-purple-300';
            } else {
                const rem = Number(q.remaining_total ?? 0);
                const mq = Number(q.monthly_quota ?? 0);
                const bonus = Number(q.bonus_credits ?? 0);
                qBadge.textContent = `• Còn ${rem} credit (${q.monthly_used || 0}/${mq} tháng${bonus > 0 ? ` + ${bonus} bonus` : ''})`;
                qBadge.className = rem <= 0 ? 'text-[11px] font-mono text-rose-300 font-semibold' : 'text-[11px] font-mono text-emerald-300';
            }
        }
    } catch (e) {
        console.error('Error loading store settings:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadStoreSettings();
});

async function saveStoreSettings(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById('btn-save-settings') || form.querySelector('button[type="submit"]');
    const alertBox = document.getElementById('settings-alert');

    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i><span>Đang lưu cấu hình...</span>';
    }

    if (alertBox) {
        alertBox.className = 'hidden';
        alertBox.innerHTML = '';
    }

    const formData = new FormData(form);
    const payload = {};
    formData.forEach((value, key) => { payload[key] = value; });

    try {
        const res = await fetch('api/settings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            updateLiveServerBaseUrl();
            loadStoreSettings();
            // Sau khi lưu thành công: Xóa trắng ô nhập API key ngay lập tức và ẩn hoàn toàn
            const keyInput = document.getElementById('setting-gemini-api-key');
            if (keyInput) {
                if (keyInput.value.trim().length > 0) {
                    const cfgBox = document.getElementById('gemini-status-configured');
                    const uncfgBox = document.getElementById('gemini-status-unconfigured');
                    if (cfgBox) cfgBox.classList.remove('hidden');
                    if (uncfgBox) uncfgBox.classList.add('hidden');
                }
                keyInput.value = '';
            }
            const inputBox = document.getElementById('gemini-key-input-box');
            if (inputBox) inputBox.classList.add('hidden');
            const btnToggle = document.getElementById('btn-toggle-gemini-edit');
            if (btnToggle) btnToggle.classList.remove('hidden');

            if (alertBox) {
                alertBox.className = 'p-3 rounded-xl text-xs font-semibold flex items-center justify-between bg-emerald-950/80 border border-emerald-500/40 text-emerald-200';
                alertBox.innerHTML = `
                    <div class="flex items-center gap-2">
                        <i class="fas fa-circle-check text-emerald-400 text-sm"></i>
                        <span>${data.message || 'Lưu cài đặt hệ thống & VietQR thành công!'}</span>
                    </div>
                    <span class="text-[10px] text-emerald-300 opacity-80">Đã cập nhật cơ sở dữ liệu & file config.php</span>
                `;
            }
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-check mr-1.5"></i><span>Đã Lưu!</span>';
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                }, 2000);
            }
        } else {
            if (alertBox) {
                alertBox.className = 'p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-950/80 border border-rose-500/40 text-rose-200';
                alertBox.innerHTML = `<i class="fas fa-circle-xmark text-rose-400 text-sm"></i><span>${data.message || 'Lỗi lưu cấu hình'}</span>`;
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    } catch (err) {
        console.error('Settings error:', err);
        if (alertBox) {
            alertBox.className = 'p-3 rounded-xl text-xs font-semibold flex items-center gap-2 bg-rose-950/80 border border-rose-500/40 text-rose-200';
            alertBox.innerHTML = `<i class="fas fa-circle-xmark text-rose-400 text-sm"></i><span>Lỗi kết nối máy chủ: ${err.message}</span>`;
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    }
}
