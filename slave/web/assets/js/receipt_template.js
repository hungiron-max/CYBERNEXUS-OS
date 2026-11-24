/**
 * CyberNexus OS — Unified Receipt Template Engine (PAY-01 / PAY-05)
 * Shared by POS (pos.js / pos_shift_reports.js) and Admin (admin.js / Settings Live Preview).
 */
(function (global) {
    'use strict';

    const DEFAULT_CFG = {
        paper_size: '80mm',
        receipt_lang_mode: 'auto', // 'auto' | 'vi' | 'en' | 'bilingual_vi_en' | 'bilingual_vi_zh'
        line_height: 1.35,
        item_gap_px: 6,
        section_gap_px: 8,
        pad_x_px: 8,
        pad_y_px: 10,
        font_header_px: 15,
        font_body_px: 12,
        font_total_px: 14,
        show_logo: true,
        show_store_address: true,
        show_store_phone: true,
        show_table_cashier: true,
        show_item_note: true,
        show_toppings: true,
        show_discount_vat: true,
        show_wifi: true,
        show_qr_payment: false,
        show_footer_note: true,
        feed_lines: 4,
        custom_header: '',
        custom_footer: ''
    };

    const RECEIPT_LABELS = {
        vi: {
            watermark_temp: 'PHIẾU TẠM TÍNH — CHƯA THANH TOÁN',
            watermark_reprint: '[BẢN IN LẠI / REPRINT]',
            order_no: 'Số HĐ',
            table: 'Bàn',
            time: 'Giờ',
            cashier: 'Thu ngân',
            card_ref: 'Ref Thẻ',
            no_items: '(Chưa có món)',
            subtotal: 'Tạm tính',
            discount: 'Giảm giá',
            vat: 'VAT',
            total: 'TỔNG CỘNG',
            payment: 'Thanh toán',
            cash_received: 'Tiền khách đưa',
            change: 'Tiền thối lại',
            pm_cash: 'Tiền mặt',
            pm_banking: 'Chuyển khoản QR',
            pm_transfer: 'Chuyển khoản',
            pm_qr: 'VietQR',
            pm_card: 'Thẻ / SmartPOS',
            pm_split: 'Thanh toán kết hợp (Split)',
            footer: 'Cảm ơn Quý khách & Hẹn gặp lại!'
        },
        en: {
            watermark_temp: 'PROFORMA BILL — UNPAID',
            watermark_reprint: '[REPRINT RECEIPT]',
            order_no: 'Order #',
            table: 'Table',
            time: 'Time',
            cashier: 'Cashier',
            card_ref: 'Card Ref',
            no_items: '(No items)',
            subtotal: 'Subtotal',
            discount: 'Discount',
            vat: 'VAT',
            total: 'GRAND TOTAL',
            payment: 'Payment',
            cash_received: 'Cash Received',
            change: 'Change',
            pm_cash: 'Cash',
            pm_banking: 'VietQR Transfer',
            pm_transfer: 'Bank Transfer',
            pm_qr: 'VietQR',
            pm_card: 'Card / SmartPOS',
            pm_split: 'Split Payment',
            footer: 'Thank you & See you again!'
        },
        zh: {
            watermark_temp: '暂计单 — 未付款',
            watermark_reprint: '[补印账单 / REPRINT]',
            order_no: '单号',
            table: '桌号',
            time: '时间',
            cashier: '收银员',
            card_ref: '刷卡流水',
            no_items: '(暂无菜品)',
            subtotal: '小计',
            discount: '折扣优惠',
            vat: '增值税',
            total: '合计总额',
            payment: '支付方式',
            cash_received: '实收现金',
            change: '找零',
            pm_cash: '现金',
            pm_banking: '扫码转账',
            pm_transfer: '银行转账',
            pm_qr: 'VietQR',
            pm_card: '刷卡 / POS',
            pm_split: '组合支付',
            footer: '谢谢光临，欢迎再来！'
        }
    };

    function getLabel(cfg, key) {
        const mode = String((cfg && cfg.receipt_lang_mode) || 'auto');
        if (mode === 'bilingual_vi_en') {
            const v = RECEIPT_LABELS.vi[key] || key;
            const e = RECEIPT_LABELS.en[key] || '';
            return (e && e !== v) ? `${v} / ${e}` : v;
        }
        if (mode === 'bilingual_vi_zh') {
            const v = RECEIPT_LABELS.vi[key] || key;
            const z = RECEIPT_LABELS.zh[key] || '';
            return (z && z !== v) ? `${v} / ${z}` : v;
        }
        let lang = mode;
        if (lang === 'auto') {
            lang = (global.CyberI18n && typeof global.CyberI18n.getLang === 'function')
                ? global.CyberI18n.getLang()
                : 'vi';
        }
        if (global.cnxT && typeof global.cnxT === 'function' && lang !== 'vi') {
            const dict = RECEIPT_LABELS[lang] || RECEIPT_LABELS.en || RECEIPT_LABELS.vi;
            return global.cnxT('receipt.' + key, null, dict[key] || RECEIPT_LABELS.vi[key] || key);
        }
        const dict = RECEIPT_LABELS[lang] || RECEIPT_LABELS.vi;
        return dict[key] || RECEIPT_LABELS.vi[key] || key;
    }

    function esc(s) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(String(s ?? ''));
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fmtMoney(v) {
        return Number(v || 0).toLocaleString('vi-VN');
    }

    function normalizeConfig(raw) {
        let parsed = raw;
        if (typeof raw === 'string' && raw.trim()) {
            try { parsed = JSON.parse(raw); } catch (e) { parsed = {}; }
        }
        if (!parsed || typeof parsed !== 'object') parsed = {};
        const validModes = ['auto', 'vi', 'en', 'bilingual_vi_en', 'bilingual_vi_zh'];
        const rawMode = String(parsed.receipt_lang_mode || 'auto');
        const cfg = Object.assign({}, DEFAULT_CFG, parsed);
        cfg.paper_size = cfg.paper_size === '58mm' ? '58mm' : '80mm';
        cfg.receipt_lang_mode = validModes.includes(rawMode) ? rawMode : 'auto';
        cfg.line_height = Math.min(2.2, Math.max(1.0, Number(cfg.line_height) || 1.35));
        cfg.item_gap_px = Math.min(20, Math.max(0, parseInt(cfg.item_gap_px, 10) || 6));
        cfg.section_gap_px = Math.min(24, Math.max(2, parseInt(cfg.section_gap_px, 10) || 8));
        cfg.pad_x_px = Math.min(20, Math.max(0, parseInt(cfg.pad_x_px, 10) || 8));
        cfg.pad_y_px = Math.min(24, Math.max(0, parseInt(cfg.pad_y_px, 10) || 10));
        cfg.font_header_px = Math.min(24, Math.max(11, parseInt(cfg.font_header_px, 10) || 15));
        cfg.font_body_px = Math.min(18, Math.max(9, parseInt(cfg.font_body_px, 10) || 12));
        cfg.font_total_px = Math.min(22, Math.max(11, parseInt(cfg.font_total_px, 10) || 14));
        cfg.feed_lines = Math.min(10, Math.max(1, parseInt(cfg.feed_lines, 10) || 4));
        return cfg;
    }

    function getConfig(storeSettings) {
        const s = storeSettings || {};
        if (s.receipt_tpl_json) return normalizeConfig(s.receipt_tpl_json);
        if (global.CN_STORE_BRAND && global.CN_STORE_BRAND.receipt_tpl_json) {
            return normalizeConfig(global.CN_STORE_BRAND.receipt_tpl_json);
        }
        return normalizeConfig({});
    }

    function renderHtml(order, items, storeSettings, options = {}) {
        const o = order || {};
        const list = Array.isArray(items) ? items : [];
        const brand = global.CN_STORE_BRAND || {};
        const st = Object.assign({}, storeSettings || {});
        const cfg = normalizeConfig(options.template || st.receipt_tpl_json || getConfig(st));
        const isTemp = !!options.isTemp;
        const isReprint = !!options.isReprint;

        const storeName = st.name || st.store_name || brand.store_name || 'CyberNexus POS';
        const hotline = st.hotline || st.store_hotline || brand.store_hotline || '';
        const address = st.address || st.store_address || brand.store_address || '';
        const wifi = st.wifi || st.store_wifi || brand.store_wifi || '';
        const logoUrl = st.store_logo || brand.store_logo || '';
        const footerNote = cfg.custom_footer || st.footer_note || st.print_footer_note || getLabel(cfg, 'footer');
        const headerNote = cfg.custom_header || st.header_note || st.print_header_note || '';

        const paperW = cfg.paper_size === '58mm' ? '48mm' : '72mm';
        const secStyle = `margin-bottom:${cfg.section_gap_px}px;`;
        const dashStyle = `border-top:1px dashed #334155;margin:${cfg.section_gap_px}px 0;`;

        const payMap = {
            cash: getLabel(cfg, 'pm_cash'),
            banking: getLabel(cfg, 'pm_banking'),
            transfer: getLabel(cfg, 'pm_transfer'),
            qr: getLabel(cfg, 'pm_qr'),
            card: getLabel(cfg, 'pm_card'),
            split: getLabel(cfg, 'pm_split')
        };
        const payLabel = payMap[o.payment_method] || (o.payment_method || getLabel(cfg, 'pm_cash'));

        let watermarkBanner = '';
        if (isTemp) {
            watermarkBanner = `<div style="text-align:center;font-weight:900;font-size:13px;border:1.5px solid #000;padding:3px 6px;margin:4px 0;">${esc(getLabel(cfg, 'watermark_temp'))}</div>`;
        } else if (isReprint) {
            watermarkBanner = `<div style="text-align:center;font-weight:800;font-size:11px;border:1px dashed #000;padding:2px 6px;margin:4px 0;">${esc(getLabel(cfg, 'watermark_reprint'))}</div>`;
        }

        const itemsHtml = list.map((it, idx) => {
            let tops = [];
            try {
                tops = it.toppings_json ? (typeof it.toppings_json === 'string' ? JSON.parse(it.toppings_json) : it.toppings_json) : (it.toppings || []);
            } catch (e) { tops = []; }
            const topStr = (cfg.show_toppings && Array.isArray(tops) && tops.length)
                ? `<div style="font-size:${Math.max(9, cfg.font_body_px - 2)}px;padding-left:10px;color:#334155;">+ ${tops.map(t => esc(t.name || '')).filter(Boolean).join(', ')}</div>`
                : '';
            const noteStr = (cfg.show_item_note && it.note)
                ? `<div style="font-size:${Math.max(9, cfg.font_body_px - 2)}px;padding-left:10px;font-style:italic;color:#475569;">(${esc(it.note)})</div>`
                : '';
            const qty = Number(it.quantity || 1);
            const price = Number(it.price || 0);
            const sub = Number(it.subtotal || (qty * price));
            let dishName = it.product_name || it.name || 'Món';
            if (typeof global.cnxDbText === 'function' && it.i18n_json) {
                if (cfg.receipt_lang_mode === 'en') {
                    dishName = global.cnxDbText(it, 'name', dishName, 'en');
                } else if (cfg.receipt_lang_mode === 'bilingual_vi_en') {
                    const enName = global.cnxDbText(it, 'name', '', 'en');
                    if (enName && enName !== dishName) dishName = `${dishName} / ${enName}`;
                }
            }
            return `
                <div style="margin-bottom:${cfg.item_gap_px}px;">
                    <div style="display:flex;justify-content:space-between;font-weight:700;gap:6px;">
                        <span>${idx + 1}. ${esc(dishName)}</span>
                        <span style="white-space:nowrap;">${fmtMoney(sub)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:${Math.max(9, cfg.font_body_px - 1)}px;color:#334155;padding-left:10px;">
                        <span>${qty} x ${fmtMoney(price)}đ</span>
                    </div>
                    ${topStr}${noteStr}
                </div>
            `;
        }).join('');

        const subAmt = Number(o.subtotal || o.total_amount || 0);
        const discAmt = Number(o.discount_amount || 0);
        const vatAmt = Number(o.vat_amount || 0);
        const totAmt = Number(o.total_amount || 0);
        const paidCash = Number(o.cash_received || 0);
        const changeCash = Number(o.change_amount || Math.max(0, paidCash - totAmt));
        const timeStr = o.created_at || new Date().toLocaleString('vi-VN');

        let feedHtml = '';
        for (let i = 0; i < cfg.feed_lines; i++) feedHtml += '<div style="height:10px;"></div>';

        return `
            <div class="cnx-receipt-paper" style="width:${paperW};max-width:100%;margin:0 auto;padding:${cfg.pad_y_px}px ${cfg.pad_x_px}px;font-family:'Courier New',Consolas,var(--cn-font-i18n,monospace);font-size:${cfg.font_body_px}px;line-height:${cfg.line_height};color:#0f172a;background:#ffffff;box-sizing:border-box;">
                <div style="text-align:center;${secStyle}">
                    ${(cfg.show_logo && logoUrl) ? `<img src="${esc(logoUrl)}" alt="Logo" style="max-height:42px;max-width:120px;margin:0 auto 4px;display:block;filter:grayscale(100%) contrast(1.2);" />` : ''}
                    <div style="font-size:${cfg.font_header_px}px;font-weight:900;letter-spacing:0.3px;">${esc(String(storeName).toUpperCase())}</div>
                    ${(cfg.show_store_address && address) ? `<div style="font-size:${Math.max(9, cfg.font_body_px - 2)}px;color:#334155;">${esc(address)}</div>` : ''}
                    ${(cfg.show_store_phone && hotline) ? `<div style="font-size:${Math.max(9, cfg.font_body_px - 2)}px;color:#334155;">Hotline: ${esc(hotline)}</div>` : ''}
                    ${headerNote ? `<div style="font-size:${Math.max(9, cfg.font_body_px - 2)}px;margin-top:2px;">${esc(headerNote)}</div>` : ''}
                    ${watermarkBanner}
                </div>
                <div style="${dashStyle}"></div>
                ${cfg.show_table_cashier ? `
                <div style="font-size:${Math.max(9, cfg.font_body_px - 1)}px;${secStyle}">
                    <div><b>${esc(getLabel(cfg, 'order_no'))}:</b> ${esc(o.order_code || o.id || '---')} ${o.table_code ? `• <b>${esc(getLabel(cfg, 'table'))}:</b> ${esc(o.table_code)}` : ''}</div>
                    <div><b>${esc(getLabel(cfg, 'time'))}:</b> ${esc(timeStr)}</div>
                    ${(o.user_name || o.cashier_name) ? `<div><b>${esc(getLabel(cfg, 'cashier'))}:</b> ${esc(o.user_name || o.cashier_name)}</div>` : ''}
                    ${o.card_tx_ref ? `<div><b>${esc(getLabel(cfg, 'card_ref'))}:</b> ${esc(o.card_tx_ref)}</div>` : ''}
                </div>
                <div style="${dashStyle}"></div>
                ` : ''}
                <div style="${secStyle}">
                    ${itemsHtml || `<div style="text-align:center;color:#64748b;">${esc(getLabel(cfg, 'no_items'))}</div>`}
                </div>
                <div style="${dashStyle}"></div>
                <div style="${secStyle}">
                    <div style="display:flex;justify-content:space-between;">
                        <span>${esc(getLabel(cfg, 'subtotal'))}:</span><span>${fmtMoney(subAmt)} đ</span>
                    </div>
                    ${(cfg.show_discount_vat && discAmt > 0) ? `<div style="display:flex;justify-content:space-between;"><span>${esc(getLabel(cfg, 'discount'))}:</span><span>-${fmtMoney(discAmt)} đ</span></div>` : ''}
                    ${(cfg.show_discount_vat && vatAmt > 0) ? `<div style="display:flex;justify-content:space-between;"><span>${(totAmt <= Math.max(0, subAmt - discAmt) + 1) ? ('Đã gồm ' + esc(getLabel(cfg, 'vat'))) : esc(getLabel(cfg, 'vat'))} (${Number(o.vat_percent || 0)}%):</span><span>${fmtMoney(vatAmt)} đ</span></div>` : ''}
                    <div style="display:flex;justify-content:space-between;font-size:${cfg.font_total_px}px;font-weight:900;margin-top:3px;padding-top:3px;border-top:1px solid #0f172a;">
                        <span>${esc(getLabel(cfg, 'total'))}:</span><span>${fmtMoney(totAmt)} đ</span>
                    </div>
                    ${!isTemp ? `<div style="display:flex;justify-content:space-between;font-size:${Math.max(9, cfg.font_body_px - 1)}px;margin-top:2px;"><span>${esc(getLabel(cfg, 'payment'))}:</span><span>${esc(payLabel)}</span></div>` : ''}
                    ${(!isTemp && paidCash > 0 && o.payment_method === 'cash') ? `
                        <div style="display:flex;justify-content:space-between;font-size:${Math.max(9, cfg.font_body_px - 1)}px;"><span>${esc(getLabel(cfg, 'cash_received'))}:</span><span>${fmtMoney(paidCash)} đ</span></div>
                        <div style="display:flex;justify-content:space-between;font-size:${Math.max(9, cfg.font_body_px - 1)}px;"><span>${esc(getLabel(cfg, 'change'))}:</span><span>${fmtMoney(changeCash)} đ</span></div>
                    ` : ''}
                </div>
                <div style="${dashStyle}"></div>
                <div style="text-align:center;font-size:${Math.max(9, cfg.font_body_px - 1)}px;">
                    ${(cfg.show_wifi && wifi) ? `<div style="margin-bottom:3px;">WiFi: ${esc(wifi)}</div>` : ''}
                    ${cfg.show_footer_note ? `<div style="font-style:italic;">${esc(footerNote)}</div>` : ''}
                    ${feedHtml}
                </div>
            </div>
        `;
    }

    function printHtmlInIframe(receiptHtml, paperSize) {
        const frame = document.createElement('iframe');
        frame.style.position = 'fixed';
        frame.style.right = '-9999px';
        frame.style.bottom = '-9999px';
        frame.style.width = paperSize === '58mm' ? '58mm' : '80mm';
        frame.style.height = '0';
        document.body.appendChild(frame);
        const doc = frame.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{margin:0;size:${paperSize === '58mm' ? '58mm' : '80mm'} auto;}body{margin:0;padding:0;background:#fff;}</style></head><body>${receiptHtml}</body></html>`);
        doc.close();
        setTimeout(() => {
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
            } finally {
                setTimeout(() => frame.remove(), 1200);
            }
        }, 120);
    }

    async function printViaBridgeOrBrowser(order, items, storeSettings, options = {}) {
        const html = renderHtml(order, items, storeSettings, options);
        const cfg = getConfig(storeSettings);
        const orderId = Number(order && order.id ? order.id : 0);
        if (orderId > 0 && !options.browserOnly) {
            try {
                const token = localStorage.getItem('pos_token') || '';
                const res = await fetch('/api/printer/print-receipt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
                    },
                    body: JSON.stringify({
                        order_id: orderId,
                        payment_method: order.payment_method || 'cash',
                        is_temp: !!options.isTemp,
                        is_reprint: !!options.isReprint
                    })
                });
                const j = await res.json().catch(() => null);
                if (res.ok && j && j.success) {
                    return { ok: true, mode: 'escpos', drawer_opened: !!j.drawer_opened, message: j.message };
                }
            } catch (e) { (global.CyberSecurity ? global.CyberSecurity.logSilentError('receipt_template.js', e) : null); }
        }
        printHtmlInIframe(html, cfg.paper_size);
        return { ok: true, mode: 'browser', drawer_opened: false };
    }

    async function openNoSaleDrawerModal() {
        const pinFn = typeof global.cnxPrompt === 'function' ? global.cnxPrompt : null;
        if (!pinFn) return;
        const reason = await pinFn('Nhập lý do mở két tiền ngoài hóa đơn (No-Sale, ghi Audit Log):', 'Đổi tiền lẻ đầu ca', { title: 'Mở Két Tiền Khẩn Cấp (No-Sale)' });
        if (!reason) return;
        const pin = await pinFn('Nhập mã PIN Chủ quán (Admin) để xác thực mở két tiền:', '', { title: 'Xác Thực PIN Chủ Quán', inputType: 'password' });
        if (pin === null) return;
        try {
            const token = localStorage.getItem('pos_token') || '';
            const res = await fetch('/api/printer/open-drawer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': 'Bearer ' + token } : {})
                },
                body: JSON.stringify({ reason, manager_pin: pin })
            });
            const data = await res.json();
            if (typeof global.POS !== 'undefined' && typeof global.POS.showToast === 'function') {
                global.POS.showToast(data.message || (data.success ? 'Đã mở két tiền' : 'Lỗi mở két'), data.success ? 'success' : 'error');
            }
        } catch (e) {
            if (typeof global.POS !== 'undefined' && typeof global.POS.showToast === 'function') {
                global.POS.showToast('Lỗi kết nối máy chủ in ấn', 'error');
            }
        }
    }

    global.ReceiptTemplate = {
        DEFAULT_CFG,
        normalizeConfig,
        getConfig,
        renderHtml,
        printHtmlInIframe,
        printViaBridgeOrBrowser,
        openNoSaleDrawerModal
    };
})(window);
