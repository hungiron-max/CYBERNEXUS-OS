import sqlite3
import json
import html

conn = sqlite3.connect('database/pos_database.sqlite')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Get products
cur.execute("SELECT id, category_id, code, name, sale_price, unit, image FROM products WHERE status = 'active' ORDER BY id ASC")
products = [dict(r) for r in cur.fetchall()]

# Get categories
cur.execute("SELECT id, name FROM categories ORDER BY sort_order ASC, id ASC")
categories = [dict(r) for r in cur.fetchall()]

# Count per category
cat_counts = {}
for p in products:
    cid = p['category_id']
    cat_counts[cid] = cat_counts.get(cid, 0) + 1

# Format money
def format_money(val):
    return f"{int(val):,}".replace(",", ".")

# Generate Category Pills
cat_pills_html = [
    f'<button type="button" onclick="CustomerOrdering.filterCategory(0)" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500 text-white shadow-md transition-all shrink-0">Tất Cả ({len(products)})</button>'
]
for cat in categories:
    cid = cat['id']
    cnt = cat_counts.get(cid, 0)
    if cnt > 0:
        cname = html.escape(cat['name'].upper())
        cat_pills_html.append(
            f'<button type="button" onclick="CustomerOrdering.filterCategory({cid})" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all shrink-0">{cname} ({cnt})</button>'
        )

# Generate Products Grid
product_cards_html = []
for p in products:
    pid = p['id']
    cid = p['category_id']
    pcode = html.escape(p['code'])
    pname = html.escape(p['name'])
    punit = html.escape(p['unit'] or 'món')
    pprice = int(p['sale_price'])
    pimg = p['image'] or 'assets/images/dishes/default_dish.jpg'

    card = f'''                    <div class="product-item liquid-card rounded-2xl p-3 flex flex-col justify-between group transition-all" data-product-id="{pid}" data-category-id="{cid}" data-product-name="{pname}" data-product-price="{pprice}">
                        <div class="space-y-2">
                            <!-- Product Image: 4:3 Aspect Ratio -->
                            <div class="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/10 group-hover:scale-[1.02] transition-all flex items-center justify-center">
                                <img src="{pimg}" alt="{pname}" class="w-full h-full object-cover object-center" onerror="this.onerror=null;this.src=\\'assets/images/dishes/default_dish.jpg\\';" loading="lazy" />
                                <div class="absolute top-1.5 left-1.5">
                                    <span class="text-[10px] font-mono text-sky-400 font-bold bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded border border-sky-500/30 shadow">{pcode}</span>
                                </div>
                            </div>
                            
                            <div>
                                <h4 class="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug">{pname}</h4>
                            </div>
                        </div>

                        <div class="pt-2 mt-2 border-t border-white/10">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs text-slate-400 font-medium">/ {punit}</span>
                                <span class="text-sm sm:text-base font-black font-mono text-emerald-400">{format_money(pprice)} đ</span>
                            </div>
                            <button type="button" onclick="CustomerOrdering.addItem({pid})" class="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 active:scale-95 transition-all">
                                <i class="fas fa-plus"></i> Thêm vào giỏ
                            </button>
                        </div>
                    </div>'''
    product_cards_html.append(card)

full_html = f'''<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>GÓC PHỐ COFFEE & TEA - Chào Mừng Quý Khách</title>
    <link rel="icon" href="favicon.ico">
    
    <!-- Local Precompiled Tailwind CSS (100% Offline, Instant Rendering) -->
    <link rel="stylesheet" href="assets/css/app-tailwind.min.css">
    <!-- Local FontAwesome 6 Icons (Offline) -->
    <link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">
    
    <!-- Liquid Glass Custom Styles -->
    <style>
        body {{
            background: radial-gradient(circle at 50% 10%, #1e1b4b 0%, #0f172a 50%, #020617 100%);
            min-height: 100vh;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }}

        .liquid-glass {{
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
        }}

        .liquid-card {{
            background: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }}
        .liquid-card:hover {{
            transform: translateY(-2px);
            border-color: rgba(56, 189, 248, 0.4);
            box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.15);
        }}

        .btn-glass {{
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            transition: all 0.2s;
        }}
        .btn-glass:hover {{
            background: rgba(255, 255, 255, 0.16);
            transform: translateY(-1px);
        }}

        .liquid-blob {{
            position: fixed;
            border-radius: 50%;
            filter: blur(90px);
            opacity: 0.18;
            pointer-events: none;
            z-index: 0;
        }}

        /* Slide & Carousel Styling - Cinematic Liquid Glass */
        .customer-ad-slide {{
            position: absolute;
            inset: 0;
            opacity: 0;
            pointer-events: none;
            transition: opacity .7s cubic-bezier(0.4, 0, 0.2, 1), transform .7s cubic-bezier(0.4, 0, 0.2, 1);
            transform: scale(1.02);
        }}
        .customer-ad-slide.is-active {{
            opacity: 1;
            pointer-events: auto;
            transform: scale(1);
        }}
        .customer-store-backdrop {{
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, rgba(4, 7, 20, 0.94) 0%, rgba(4, 7, 20, 0.72) 40%, rgba(4, 7, 20, 0.15) 75%, transparent 100%),
                        linear-gradient(0deg, rgba(4, 7, 20, 0.7) 0%, transparent 45%);
            pointer-events: none;
        }}
        .customer-store-glow {{
            position: absolute;
            width: 16rem;
            height: 16rem;
            border-radius: 9999px;
            filter: blur(55px);
            opacity: .35;
            pointer-events: none;
            z-index: 1;
            mix-blend-mode: screen;
        }}
        .customer-store-glow-gold {{
            left: -2rem;
            top: -2rem;
            background: radial-gradient(circle, rgba(251, 191, 36, 0.45) 0%, rgba(244, 63, 94, 0.2) 60%, transparent 80%);
        }}
        .customer-store-glow-accent {{
            right: 20%;
            bottom: -3rem;
            background: radial-gradient(circle, rgba(14, 165, 233, 0.35) 0%, rgba(139, 92, 246, 0.15) 60%, transparent 80%);
        }}
        .customer-ad-dot {{
            transition: all 0.25s ease;
        }}
        #customer-cart-open {{
            box-shadow: 0 10px 30px rgba(14, 165, 233, 0.35);
        }}
        #customer-cart-open:hover {{
            box-shadow: 0 14px 36px rgba(14, 165, 233, 0.5);
        }}
    </style>
</head>
<body class="antialiased flex flex-col min-h-screen relative overflow-x-hidden selection:bg-sky-500 selection:text-white">

    <!-- Ambient Glowing Blobs -->
    <div class="liquid-blob w-96 h-96 bg-purple-600 -top-20 -left-20"></div>
    <div class="liquid-blob w-96 h-96 bg-sky-600 top-1/3 -right-20"></div>
    <div class="liquid-blob w-96 h-96 bg-pink-600 bottom-10 left-1/4"></div>

    <!-- Header Navigation (Liquid Glass Aesthetic - 100% No-Wrap) -->
    <header class="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-white/10 px-3 py-2.5 sm:px-6">
        <div class="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <!-- Brand -->
            <div class="flex items-center gap-2.5 min-w-0 shrink-0">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white text-base shadow-lg shadow-indigo-500/25 shrink-0">
                    <i class="fas fa-mug-hot"></i>
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-2 whitespace-nowrap">
                        <h1 class="text-sm sm:text-base font-black tracking-wide text-white uppercase whitespace-nowrap">
                            GÓC PHỐ COFFEE & TEA
                        </h1>
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 whitespace-nowrap shrink-0 shadow-sm">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Khách Hàng
                        </span>
                    </div>
                    <p class="text-[11px] text-slate-400 whitespace-nowrap truncate max-w-[260px] sm:max-w-none mt-0.5">
                        Hệ Thống Phục Vụ Bán Hàng & Thực Đơn Điện Tử
                    </p>
                </div>
            </div>

            <!-- Wi-Fi & Contact Pill -->
            <div class="flex items-center gap-2 shrink-0 whitespace-nowrap">
                <div class="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 font-mono whitespace-nowrap shrink-0 shadow-sm">
                    <i class="fas fa-wifi text-sky-400"></i>
                    <span>Wi-Fi: <b class="text-white">GocPho_Guest</b> <span class="text-slate-500">·</span> pass: <b class="text-amber-300 font-bold">88888888</b></span>
                </div>

                <a href="tel:0903100001" class="btn-glass px-3 py-1.5 text-xs text-emerald-300 hover:text-white flex items-center gap-1.5 font-bold whitespace-nowrap shrink-0 border border-emerald-500/30 bg-emerald-500/10 shadow-sm" title="Gọi Hotline">
                    <i class="fas fa-phone-alt text-[10px]"></i>
                    <span class="hidden sm:inline">0903 100 001</span>
                </a>

                <div id="user-nav-zone" class="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                    <a href="index.html" class="btn-glass px-3 py-1.5 text-xs text-sky-300 hover:text-white font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 border border-sky-500/30 bg-sky-500/10 shadow-sm">
                        <i class="fas fa-sign-in-alt text-xs"></i>
                        <span>Đăng Nhập</span>
                    </a>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content Container -->
    <main class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 z-10">
        
        <!-- Hero Promotional Banner with Smart Carousel in Red Box -->
        <section class="liquid-glass rounded-3xl p-4 sm:p-6 border border-white/15 relative overflow-hidden shadow-2xl">
            <div class="absolute -right-12 -top-12 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <div class="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                <!-- Smart Hero Slider Container (VÙNG TRONG VIỀN ĐỎ: Video play hết clip, ảnh delay 6s/hình) -->
                <div id="customer-ad-carousel" class="lg:col-span-2 relative min-h-[300px] sm:min-h-[340px] rounded-2xl overflow-hidden border border-white/10 bg-slate-950/70 shadow-inner flex flex-col justify-between">
                    <!-- Slides Container -->
                    <div id="customer-ad-slides-container" class="relative flex-1">
                        <!-- Slide 0: Hình ảnh mở đầu (6s) -->
                        <article class="customer-ad-slide customer-store-slide is-active" data-ad-index="0" data-ad-duration="6">
                            <img class="absolute inset-0 h-full w-full object-cover object-center" src="assets/images/dishes/dish_1793447406_e3759f8d.jpg" alt="Góc Phố" />
                            <div class="customer-store-backdrop"></div>
                            <div class="customer-store-glow customer-store-glow-gold"></div>
                            <div class="customer-store-glow customer-store-glow-accent"></div>
                            <div class="relative z-10 flex h-full min-h-[300px] sm:min-h-[340px] flex-col items-start justify-center px-6 py-6 sm:px-9 sm:py-8 max-w-xl">
                                <span class="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-200 shadow-sm backdrop-blur-md">
                                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                    <i class="fas fa-sparkles text-amber-300 text-[9px]"></i> ƯU ĐÃI ĐẶC BIỆT · KM1
                                </span>
                                <h2 class="mt-2 text-base sm:text-xl lg:text-2xl font-black leading-snug tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                                    Thưởng Thức Hương Vị Đậm Đà Tại <span class="bg-gradient-to-r from-amber-300 via-rose-300 to-sky-300 bg-clip-text text-transparent">Góc Phố</span>
                                </h2>
                                <div class="mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-transparent"></div>
                                <p class="mt-2 max-w-md text-xs sm:text-[13px] text-slate-200/90 leading-relaxed line-clamp-2 drop-shadow-sm font-normal">
                                    Cà phê phin truyền thống thơm lừng, trà sữa béo ngậy cùng các món điểm tâm bánh mì chảo, bò bít tết hảo hạng.
                                </p>
                                <div class="flex flex-wrap items-center gap-1.5 pt-3 text-[10px] font-semibold">
                                    <span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                        <i class="fas fa-check-circle text-[9px]"></i> Giảm 10% VietQR
                                    </span>
                                    <span class="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                        <i class="fas fa-gift text-[9px]"></i> Tặng topping Flan
                                    </span>
                                </div>
                            </div>
                        </article>

                        <!-- Slide 1: Video Trải Nghiệm Quán (Play hết thời lượng video) -->
                        <article class="customer-ad-slide is-video" data-ad-index="1" data-ad-duration="0">
                            <video class="absolute inset-0 h-full w-full object-cover" src="uploads/advertisements/65bfba6b4181d0e350ebcc94e7bcd240.mp4" muted playsinline preload="auto"></video>
                            <div class="customer-store-backdrop"></div>
                            <div class="customer-store-glow customer-store-glow-accent"></div>
                            <div class="relative z-10 flex h-full min-h-[300px] sm:min-h-[340px] flex-col items-start justify-end px-6 pb-14 pt-6 sm:px-9 sm:pb-16 sm:pt-8 max-w-xl">
                                <span class="inline-flex items-center gap-1.5 rounded-full border border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-sky-200 backdrop-blur-md">
                                    <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                                    <i class="fas fa-play text-sky-300 text-[9px]"></i> VIDEO TRẢI NGHIỆM · QC1
                                </span>
                                <h3 class="mt-2 text-base sm:text-xl font-black text-white leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">Không Gian Thư Giãn & Hương Vị Nguyên Bản</h3>
                                <p class="mt-1.5 text-xs text-slate-200/90 leading-relaxed max-w-md line-clamp-2">Khám phá quy trình pha chế kỳ công và không gian thoáng đãng tại Góc Phố.</p>
                            </div>
                            <button type="button" onclick="CustomerAdCarousel.toggleSound()" class="customer-ad-sound absolute top-4 right-4 z-30 h-7 w-7 sm:h-8 sm:w-8 rounded-full border border-white/20 bg-slate-950/70 text-xs text-white backdrop-blur flex items-center justify-center hover:bg-white/20" title="Bật/Tắt tiếng">
                                <i class="fas fa-volume-xmark"></i>
                            </button>
                        </article>

                        <!-- Slide 2: Bánh mì giòn rụm (6s) -->
                        <article class="customer-ad-slide" data-ad-index="2" data-ad-duration="6">
                            <img class="absolute inset-0 h-full w-full object-cover object-center" src="assets/images/dishes/dish_1793438761_26c1602f.jpg" alt="Bánh mì chảo" />
                            <div class="customer-store-backdrop"></div>
                            <div class="customer-store-glow customer-store-glow-gold"></div>
                            <div class="relative z-10 flex h-full min-h-[300px] sm:min-h-[340px] flex-col items-start justify-center px-6 py-6 sm:px-9 sm:py-8 max-w-xl">
                                <span class="inline-flex items-center gap-1.5 rounded-full border border-rose-300/40 bg-gradient-to-r from-rose-500/25 to-orange-500/25 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-rose-200 backdrop-blur-md shadow-sm">
                                    <span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                                    <i class="fas fa-fire text-rose-300 text-[9px]"></i> MÓN BÁN CHẠY NHẤT · KM2
                                </span>
                                <h3 class="mt-2 text-base sm:text-xl lg:text-2xl font-black text-white leading-snug tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">Bánh Mì Chảo Thơm Giòn Nóng Hổi</h3>
                                <div class="mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-rose-400 to-amber-400"></div>
                                <p class="mt-2 max-w-md text-xs sm:text-[13px] text-slate-200/90 leading-relaxed line-clamp-2 drop-shadow-sm font-normal">Pate béo ngậy, xúc xích và trứng ốp la lòng đào sốt sánh mịn đậm vị khó cưỡng.</p>
                                <div class="flex flex-wrap items-center gap-1.5 pt-3 text-[10px] font-semibold">
                                    <span class="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                        <i class="fas fa-bread-slice text-[9px]"></i> Giòn rụm nóng hổi
                                    </span>
                                </div>
                            </div>
                        </article>
                    </div>

                    <!-- Slide Controls (Bottom Bar) -->
                    <div class="relative z-20 flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent">
                        <div id="customer-ad-dots" class="flex items-center gap-1.5">
                            <button type="button" class="customer-ad-dot h-1.5 w-7 rounded-full bg-white transition-all" onclick="CustomerAdCarousel.show(0)"></button>
                            <button type="button" class="customer-ad-dot h-1.5 w-2 rounded-full bg-white/45 transition-all" onclick="CustomerAdCarousel.show(1)"></button>
                            <button type="button" class="customer-ad-dot h-1.5 w-2 rounded-full bg-white/45 transition-all" onclick="CustomerAdCarousel.show(2)"></button>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button id="customer-ad-toggle" type="button" onclick="CustomerAdCarousel.togglePlayback()" title="Tạm dừng / Tiếp tục" class="h-7 w-7 rounded-full border border-white/20 bg-slate-950/60 text-xs text-white backdrop-blur hover:bg-white/20 flex items-center justify-center">
                                <i class="fas fa-pause"></i>
                            </button>
                            <button type="button" onclick="CustomerAdCarousel.prev()" title="Slide trước" class="h-7 w-7 rounded-full border border-white/20 bg-slate-950/60 text-xs text-white backdrop-blur hover:bg-white/20 flex items-center justify-center">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button type="button" onclick="CustomerAdCarousel.next()" title="Slide tiếp theo" class="h-7 w-7 rounded-full border border-white/20 bg-slate-950/60 text-xs text-white backdrop-blur hover:bg-white/20 flex items-center justify-center">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Fast Contact & Info Card (Right Column) -->
                <div class="p-5 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col justify-between text-center space-y-4">
                    <div class="space-y-2">
                        <div class="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
                            <i class="fas fa-store text-sky-400"></i> ĐỊA CHỈ QUÁN
                        </div>
                        <div class="text-xs text-slate-200 font-medium leading-relaxed">123 Đường Số 1, Phường Tân Phú, TP. HCM</div>
                        <div class="text-xs text-amber-400 font-mono pt-1">Giờ mở cửa: <b>06:00 - 22:30</b></div>
                    </div>

                    <div class="space-y-2 pt-2">
                        <button type="button" onclick="showQuickVietQr()" class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all">
                            <i class="fas fa-qrcode"></i> Mã Thanh Toán VietQR
                        </button>
                        <button type="button" onclick="CustomerOrdering.openCart()" class="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all">
                            <i class="fas fa-cart-shopping"></i> Xem Giỏ Hàng Đặt Món
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Digital Menu Section -->
        <section class="space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                            <i class="fas fa-book-open text-sky-400"></i> THỰC ĐƠN ĐIỆN TỬ
                        </h3>
                        <p class="text-xs text-slate-400">Khám phá các món nước & điểm tâm hấp dẫn tại quán</p>
                    </div>
                </div>

                <!-- Live Search Bar -->
                <div class="relative w-full sm:w-64">
                    <i class="fas fa-search absolute left-3 top-2.5 text-xs text-slate-400"></i>
                    <input id="menu-search" type="text" oninput="CustomerOrdering.filterSearch(this.value)" placeholder="Tìm món ăn, đồ uống..." class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400" />
                </div>
            </div>

            <!-- Category Filter Pills -->
            <div class="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none" id="category-filter-pills">
                {chr(10).join(cat_pills_html)}
            </div>

            <!-- Products Grid ({len(products)} món đầy đủ, nạp sẵn 100% tức thì) -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4" id="products-grid">
{chr(10).join(product_cards_html)}
            </div>
        </section>
    </main>

    <!-- Floating Cart Button (Góc Phải Nổi Bật) -->
    <button id="customer-cart-open" type="button" onclick="CustomerOrdering.openCart()" aria-label="Mở giỏ hàng" title="Giỏ hàng" class="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-sky-500 via-indigo-600 to-fuchsia-600 text-white shadow-2xl shadow-sky-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20">
        <i class="fas fa-cart-shopping text-xl"></i>
        <span id="customer-cart-count" class="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-[11px] font-black text-white shadow-md border-2 border-slate-950 hidden">0</span>
    </button>

    <!-- Customer Cart & Online Order Modal -->
    <div id="customer-cart-modal" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all">
        <div class="liquid-glass w-full max-w-lg rounded-3xl border border-white/15 p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-2.5">
                    <div class="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center text-lg">
                        <i class="fas fa-cart-shopping"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-black text-white" id="customer-cart-title">Giỏ Hàng & Đặt Món Online</h3>
                        <p class="text-xs text-slate-400" id="customer-cart-subtitle">Chọn món và gửi đơn hàng trực tiếp đến quán</p>
                    </div>
                </div>
                <button type="button" onclick="CustomerOrdering.closeCart()" class="text-slate-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10">&times;</button>
            </div>

            <!-- Checkout View -->
            <div id="customer-cart-checkout" class="flex-1 overflow-y-auto space-y-4 pt-3 scrollbar-thin">
                <!-- Items list -->
                <div id="customer-cart-items" class="space-y-2"></div>

                <!-- Summary -->
                <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-white/10 font-bold">
                    <span class="text-sm text-slate-300">Tổng cộng:</span>
                    <span id="customer-cart-total" class="text-lg font-black font-mono text-emerald-400">0 đ</span>
                </div>

                <!-- Customer Info Form -->
                <form id="customer-order-form" onsubmit="CustomerOrdering.submitOrder(event)" class="space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                            <label class="block text-xs font-semibold text-slate-300 mb-1">Tên của bạn <span class="text-rose-400">*</span></label>
                            <input id="customer-order-name" type="text" required class="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400" placeholder="Ví dụ: Anh Hùng, Chị Mai" />
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-300 mb-1">Số điện thoại <span class="text-rose-400">*</span></label>
                            <input id="customer-order-phone" type="tel" required class="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400" placeholder="09xx xxx xxx" />
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Địa chỉ giao hàng / Bàn số</label>
                        <input id="customer-order-address" type="text" class="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400" placeholder="Địa chỉ nhận món hoặc Số bàn nếu đang ngồi tại quán" />
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Ghi chú món ăn</label>
                        <textarea id="customer-order-note" rows="2" class="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400" placeholder="Ít đường, không đá, không cay, ghi chú đặc biệt..."></textarea>
                    </div>

                    <div id="customer-order-error" class="hidden p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300"></div>

                    <button id="customer-order-submit" type="submit" class="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-fuchsia-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 hover:brightness-110 active:scale-98 transition-all">
                        <i class="fas fa-paper-plane"></i> Gửi Đơn Đặt Hàng Đến Quán
                    </button>
                </form>
            </div>

            <!-- Success & Payment View -->
            <section id="customer-order-payment" class="hidden flex-1 overflow-y-auto space-y-4 pt-3 text-center scrollbar-thin">
                <div class="w-14 h-14 mx-auto rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20">
                    <i class="fas fa-check"></i>
                </div>
                <div>
                    <h4 class="text-lg font-black text-white">Quán Đã Nhận Đơn Hàng Thành Công!</h4>
                    <p class="text-xs text-slate-400 mt-0.5">Mã hóa đơn: <b id="customer-payment-order-code" class="text-sky-300 font-mono text-sm"></b></p>
                    <p id="customer-payment-total" class="text-2xl font-black font-mono text-emerald-400 mt-2">0 đ</p>
                </div>

                <!-- Dynamic VietQR section -->
                <div id="customer-vietqr-section" class="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
                    <p class="text-xs font-semibold text-sky-300 flex items-center justify-center gap-1.5">
                        <i class="fas fa-qrcode"></i> Quét mã VietQR để thanh toán nhanh
                    </p>
                    <div class="bg-white p-3 rounded-2xl inline-block shadow-xl mx-auto">
                        <img id="customer-payment-qr" src="" alt="VietQR" class="w-48 h-48 mx-auto object-contain" />
                    </div>
                    <div class="text-[11px] text-left p-3 rounded-xl bg-slate-950/80 border border-white/10 font-mono space-y-1 text-slate-300">
                        <div>Ngân hàng: <b class="text-white" id="customer-payment-bank">OCB</b></div>
                        <div>Số tài khoản: <b class="text-sky-400" id="customer-payment-account">0918608073</b></div>
                        <div>Chủ tài khoản: <b class="text-emerald-400" id="customer-payment-account-name">NGUYEN CHI HUNG</b></div>
                        <div>Nội dung: <b class="text-amber-300" id="customer-payment-note">THANH TOAN</b></div>
                    </div>
                </div>

                <p id="customer-payment-status" class="text-xs text-amber-300 font-semibold p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    Đơn hàng đã được chuyển vào màn hình Bếp / Pha Chế và Quản trị!
                </p>

                <div class="flex gap-2">
                    <button type="button" onclick="CustomerOrdering.checkOrderStatus()" class="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-sky-200">
                        <i class="fas fa-rotate mr-1"></i> Cập nhật trạng thái
                    </button>
                    <button type="button" onclick="CustomerOrdering.resetOrder()" class="flex-1 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white">
                        <i class="fas fa-plus mr-1"></i> Đặt đơn mới
                    </button>
                </div>
            </section>
        </div>
    </div>

    <!-- Quick VietQR Modal -->
    <div id="quick-vietqr-modal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 opacity-0 pointer-events-none transition-all duration-300">
        <div class="liquid-glass rounded-3xl p-6 w-96 max-w-[92vw] text-center border border-sky-500/30 space-y-4 shadow-2xl">
            <div class="flex justify-between items-center pb-2 border-b border-white/10">
                <h3 class="font-bold text-sm text-sky-400 flex items-center gap-2">
                    <i class="fas fa-qrcode"></i> Thanh Toán VietQR Quán
                </h3>
                <button type="button" class="text-slate-400 hover:text-white text-2xl" onclick="closeQuickVietQr()">&times;</button>
            </div>
            
            <p class="text-xs text-slate-300">Quét mã bằng ứng dụng Ngân hàng (MB, VCB, OCB, BIDV, Techcombank, MoMo,...):</p>
            
            <div class="bg-white p-3 rounded-2xl inline-block shadow-xl border border-slate-200">
                <img src="https://img.vietqr.io/image/OCB-0918608073-compact2.png?amount=0&addInfo=THANH%20TOAN&accountName=NGUYEN%20CHI%20HUNG" alt="VietQR" class="w-52 h-52 mx-auto object-contain" />
            </div>

            <div class="text-xs text-left p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-1 font-mono">
                <div>Ngân hàng: <b class="text-slate-200">OCB Bank</b></div>
                <div>Số tài khoản: <b class="text-sky-400">0918608073</b></div>
                <div>Chủ tài khoản: <b class="text-emerald-400">NGUYEN CHI HUNG</b></div>
            </div>

            <button type="button" class="btn-glass w-full py-2 text-xs font-bold text-slate-300" onclick="closeQuickVietQr()">
                Đóng
            </button>
        </div>
    </div>

    <!-- JavaScript Interactive Handlers -->
    <script>
        // ==========================================
        // 1. SMART HERO CAROUSEL CONTROLLER
        // (Video: phát hết thời lượng clip; Ảnh: delay 6s/hình)
        // ==========================================
        const CustomerAdCarousel = {{
            slides: [],
            index: 0,
            timer: null,
            paused: false,
            soundEnabled: false,

            async init() {{
                const container = document.getElementById('customer-ad-slides-container');
                if (!container) return;

                // Try fetching dynamic slides from API
                try {{
                    const res = await fetch('api/advertising');
                    const data = await res.json();
                    if (data.success && Array.isArray(data.slides) && data.slides.length > 0) {{
                        this.renderSlides(data.slides);
                    }}
                }} catch (e) {{
                    console.log('Using default pre-rendered slides:', e);
                }}

                this.bindSlides();
            }},

            renderSlides(slidesList) {{
                const container = document.getElementById('customer-ad-slides-container');
                const dotsContainer = document.getElementById('customer-ad-dots');
                if (!container || !slidesList.length) return;

                container.innerHTML = '';
                if (dotsContainer) dotsContainer.innerHTML = '';

                const formatLabel = (rawLabel, isVid) => {{
                    if (!rawLabel) return {{ text: isVid ? 'VIDEO TRẢI NGHIỆM' : 'ƯU ĐÃI ĐẶC BIỆT', icon: isVid ? 'fa-play' : 'fa-sparkles', badge: isVid ? 'border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-sky-200' : 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' }};
                    const s = String(rawLabel).trim();
                    if (s === 'KM1') return {{ text: 'ƯU ĐÃI ĐẶC BIỆT · KM1', icon: 'fa-sparkles', badge: 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' }};
                    if (s === 'KM2') return {{ text: 'MÓN BÁN CHẠY NHẤT · KM2', icon: 'fa-fire', badge: 'border-rose-300/40 bg-gradient-to-r from-rose-500/25 to-orange-500/25 text-rose-200' }};
                    if (s === 'KM3') return {{ text: 'MÓN MỚI TUẦN NÀY · KM3', icon: 'fa-star', badge: 'border-emerald-300/40 bg-gradient-to-r from-emerald-500/25 to-teal-500/25 text-emerald-200' }};
                    if (s === 'QC1') return {{ text: 'VIDEO TRẢI NGHIỆM · QC1', icon: 'fa-play', badge: 'border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-sky-200' }};
                    if (s === 'QC2') return {{ text: 'KHÁM PHÁ GÓC PHỐ · QC2', icon: 'fa-compass', badge: 'border-purple-300/40 bg-gradient-to-r from-purple-500/25 to-fuchsia-500/25 text-purple-200' }};
                    if (/^KM/i.test(s)) return {{ text: `ƯU ĐÃI · ${{s}}`, icon: 'fa-sparkles', badge: 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' }};
                    if (/^QC/i.test(s)) return {{ text: `QUẢNG CÁO · ${{s}}`, icon: 'fa-video', badge: 'border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-sky-200' }};
                    return {{ text: s.toUpperCase(), icon: isVid ? 'fa-play' : 'fa-sparkles', badge: 'border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-200' }};
                }};

                slidesList.forEach((slide, idx) => {{
                    const isVideo = slide.media_type === 'video';
                    const duration = isVideo ? 0 : (Number(slide.duration) || 6);
                    const isActive = idx === 0;
                    const meta = formatLabel(slide.label, isVideo);

                    const article = document.createElement('article');
                    article.className = `customer-ad-slide ${{isActive ? 'is-active' : ''}} ${{isVideo ? 'is-video' : ''}}`;
                    article.dataset.adIndex = String(idx);
                    article.dataset.adDuration = String(duration);

                    if (isVideo) {{
                        article.innerHTML = `
                            <video class="absolute inset-0 h-full w-full object-cover" src="${{slide.media_path}}" muted playsinline preload="auto"></video>
                            <div class="customer-store-backdrop"></div>
                            <div class="customer-store-glow customer-store-glow-accent"></div>
                            <div class="relative z-10 flex h-full min-h-[300px] sm:min-h-[340px] flex-col items-start justify-end px-6 pb-14 pt-6 sm:px-9 sm:pb-16 sm:pt-8 max-w-xl">
                                <span class="inline-flex items-center gap-1.5 rounded-full border ${{meta.badge}} px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm">
                                    <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                                    <i class="fas ${{meta.icon}} text-[9px]"></i> ${{meta.text}}
                                </span>
                                <h3 class="mt-2 text-base sm:text-xl font-black text-white leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">${{slide.title || 'Video Trải Nghiệm Góc Phố'}}</h3>
                                <p class="mt-1.5 text-xs text-slate-200/90 leading-relaxed max-w-md line-clamp-2">${{slide.description || ''}}</p>
                            </div>
                            <button type="button" onclick="CustomerAdCarousel.toggleSound()" class="customer-ad-sound absolute top-4 right-4 z-30 h-7 w-7 sm:h-8 sm:w-8 rounded-full border border-white/20 bg-slate-950/70 text-xs text-white backdrop-blur flex items-center justify-center hover:bg-white/20" title="Bật/Tắt tiếng">
                                <i class="fas fa-volume-xmark"></i>
                            </button>
                        `;
                    }} else {{
                        article.innerHTML = `
                            <img class="absolute inset-0 h-full w-full object-cover object-center" src="${{slide.media_path}}" alt="${{slide.title}}" />
                            <div class="customer-store-backdrop"></div>
                            <div class="customer-store-glow customer-store-glow-gold"></div>
                            <div class="customer-store-glow customer-store-glow-accent"></div>
                            <div class="relative z-10 flex h-full min-h-[300px] sm:min-h-[340px] flex-col items-start justify-center px-6 py-6 sm:px-9 sm:py-8 max-w-xl">
                                <span class="inline-flex items-center gap-1.5 rounded-full border ${{meta.badge}} px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm">
                                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                    <i class="fas ${{meta.icon}} text-[9px]"></i> ${{meta.text}}
                                </span>
                                <h2 class="mt-2 text-base sm:text-xl lg:text-2xl font-black leading-snug tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">${{slide.title}}</h2>
                                <div class="mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-transparent"></div>
                                <p class="mt-2 max-w-md text-xs sm:text-[13px] text-slate-200/90 leading-relaxed line-clamp-2 drop-shadow-sm font-normal">${{slide.description || ''}}</p>
                                <div class="flex flex-wrap items-center gap-1.5 pt-3 text-[10px] font-semibold">
                                    <span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                        <i class="fas fa-check-circle text-[9px]"></i> Món ngon phục vụ nhanh
                                    </span>
                                    <span class="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                                        <i class="fas fa-qrcode text-[9px]"></i> Thanh toán VietQR
                                    </span>
                                </div>
                            </div>
                        `;
                    }}
                    container.appendChild(article);

                    if (dotsContainer) {{
                        const dot = document.createElement('button');
                        dot.type = 'button';
                        dot.className = `customer-ad-dot h-1.5 rounded-full transition-all ${{isActive ? 'w-7 bg-white' : 'w-2 bg-white/45'}}`;
                        dot.onclick = () => CustomerAdCarousel.show(idx);
                        dotsContainer.appendChild(dot);
                    }}
                }});
            }},

            bindSlides() {{
                this.slides = Array.from(document.querySelectorAll('#customer-ad-slides-container .customer-ad-slide'));
                if (!this.slides.length) return;

                this.index = 0;
                this.slides.forEach((slide, sIdx) => {{
                    const video = slide.querySelector('video');
                    if (video) {{
                        video.loop = false;
                        // Video kết thúc -> tự động chuyển sang slide tiếp theo
                        video.addEventListener('ended', () => {{
                            if (!this.paused && this.index === sIdx) {{
                                this.next();
                            }}
                        }});
                        video.addEventListener('error', () => {{
                            console.warn('Video failed, advancing slide');
                            if (!this.paused && this.index === sIdx) {{
                                this.next();
                            }}
                        }});
                    }}
                }});

                this.show(0);
            }},

            show(idx) {{
                if (!this.slides.length) return;
                this.index = (idx + this.slides.length) % this.slides.length;

                this.slides.forEach((slide, sIdx) => {{
                    const active = sIdx === this.index;
                    slide.classList.toggle('is-active', active);
                    const video = slide.querySelector('video');
                    if (video) {{
                        if (active) {{
                            video.currentTime = 0;
                            video.muted = !this.soundEnabled;
                            video.play().catch(e => console.log('Autoplay muted:', e));
                        }} else {{
                            video.pause();
                        }}
                    }}
                }});

                // Update indicators
                document.querySelectorAll('.customer-ad-dot').forEach((dot, dIdx) => {{
                    const active = dIdx === this.index;
                    dot.className = `customer-ad-dot h-1.5 rounded-full transition-all ${{active ? 'w-7 bg-white' : 'w-2 bg-white/45'}}`;
                }});

                this.schedule();
            }},

            schedule() {{
                if (this.timer) clearTimeout(this.timer);
                if (this.paused || this.slides.length < 2) return;

                const currentSlide = this.slides[this.index];
                if (!currentSlide) return;

                // Nếu là video: chờ sự kiện ended, KHÔNG hẹn giờ lặp lại
                const video = currentSlide.querySelector('video');
                if (video) {{
                    return;
                }}

                // Nếu là hình ảnh: hẹn giờ theo duration (mặc định 6 giây)
                const duration = Number(currentSlide.dataset.adDuration) || 6;
                this.timer = setTimeout(() => {{
                    this.next();
                }}, duration * 1000);
            }},

            next() {{
                this.show(this.index + 1);
            }},

            prev() {{
                this.show(this.index - 1);
            }},

            togglePlayback() {{
                this.paused = !this.paused;
                const btn = document.getElementById('customer-ad-toggle');
                if (btn) {{
                    btn.innerHTML = `<i class="fas fa-${{this.paused ? 'play' : 'pause'}}"></i>`;
                }}
                if (this.paused) {{
                    if (this.timer) clearTimeout(this.timer);
                    const video = this.slides[this.index]?.querySelector('video');
                    if (video) video.pause();
                }} else {{
                    const video = this.slides[this.index]?.querySelector('video');
                    if (video) video.play().catch(() => {{}});
                    this.schedule();
                }}
            }},

            toggleSound() {{
                this.soundEnabled = !this.soundEnabled;
                const video = this.slides[this.index]?.querySelector('video');
                if (video) {{
                    video.muted = !this.soundEnabled;
                }}
                document.querySelectorAll('.customer-ad-sound i').forEach(icon => {{
                    icon.className = this.soundEnabled ? 'fas fa-volume-high' : 'fas fa-volume-xmark';
                }});
            }}
        }};

        // ==========================================
        // 2. CUSTOMER ORDERING & CART SYSTEM
        // (Tương tự customer.php trong sale-app)
        // ==========================================
        const CustomerOrdering = {{
            cart: {{}},
            activeCategory: 0,
            currentOrder: null,

            init() {{
                try {{
                    this.cart = JSON.parse(localStorage.getItem('cybernexus_customer_cart') || '{{}}') || {{}};
                }} catch (e) {{
                    this.cart = {{}};
                }}
                this.renderCart();
            }},

            saveCart() {{
                try {{
                    localStorage.setItem('cybernexus_customer_cart', JSON.stringify(this.cart));
                }} catch (e) {{}}
            }},

            getProductInfo(pid) {{
                const card = document.querySelector(`.product-item[data-product-id="${{pid}}"]`);
                if (!card) return null;
                return {{
                    id: Number(card.dataset.productId),
                    name: card.dataset.productName || '',
                    price: Number(card.dataset.productPrice) || 0
                }};
            }},

            addItem(pid) {{
                const p = this.getProductInfo(pid);
                if (!p) return;
                const cur = Number(this.cart[p.id]) || 0;
                this.cart[p.id] = cur + 1;
                this.saveCart();
                this.renderCart();
                this.bounceCartButton();
            }},

            changeQty(pid, delta) {{
                const cur = Number(this.cart[pid]) || 0;
                const next = cur + delta;
                if (next <= 0) {{
                    delete this.cart[pid];
                }} else {{
                    this.cart[pid] = next;
                }}
                this.saveCart();
                this.renderCart();
            }},

            removeItem(pid) {{
                delete this.cart[pid];
                this.saveCart();
                this.renderCart();
            }},

            renderCart() {{
                const count = Object.values(this.cart).reduce((sum, q) => sum + (Number(q) || 0), 0);
                const badge = document.getElementById('customer-cart-count');
                if (badge) {{
                    badge.textContent = String(count);
                    badge.classList.toggle('hidden', count === 0);
                }}

                const list = document.getElementById('customer-cart-items');
                const totalEl = document.getElementById('customer-cart-total');
                if (!list || !totalEl) return;

                list.innerHTML = '';
                let total = 0;
                const pids = Object.keys(this.cart);

                if (pids.length === 0) {{
                    list.innerHTML = '<div class="py-8 text-center text-xs text-slate-400"><i class="fas fa-shopping-basket text-2xl text-slate-600 mb-2 block"></i>Giỏ hàng đang trống. Hãy chọn món từ thực đơn!</div>';
                    totalEl.textContent = '0 đ';
                    return;
                }}

                pids.forEach(id => {{
                    const p = this.getProductInfo(id);
                    const qty = Number(this.cart[id]) || 0;
                    if (!p || qty <= 0) return;
                    const lineTotal = p.price * qty;
                    total += lineTotal;

                    const row = document.createElement('div');
                    row.className = 'flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/80 border border-white/5';
                    row.innerHTML = `
                        <div class="min-w-0 flex-1">
                            <h5 class="text-xs font-bold text-white truncate">${{p.name}}</h5>
                            <span class="text-[11px] text-slate-400 font-mono">${{this.formatMoney(p.price)}} đ / món</span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <button type="button" onclick="CustomerOrdering.changeQty(${{id}}, -1)" class="w-7 h-7 rounded-lg bg-white/10 hover:bg-rose-500/30 text-white flex items-center justify-center font-bold text-xs">−</button>
                            <span class="w-6 text-center text-xs font-mono font-bold text-white">${{qty}}</span>
                            <button type="button" onclick="CustomerOrdering.changeQty(${{id}}, 1)" class="w-7 h-7 rounded-lg bg-white/10 hover:bg-sky-500/30 text-white flex items-center justify-center font-bold text-xs">+</button>
                            <span class="text-xs font-bold font-mono text-emerald-400 ml-2 min-w-[65px] text-right">${{this.formatMoney(lineTotal)}} đ</span>
                            <button type="button" onclick="CustomerOrdering.removeItem(${{id}})" class="text-slate-500 hover:text-rose-400 ml-1 text-xs" title="Xóa món">&times;</button>
                        </div>
                    `;
                    list.appendChild(row);
                }});

                totalEl.textContent = `${{this.formatMoney(total)}} đ`;
            }},

            bounceCartButton() {{
                const btn = document.getElementById('customer-cart-open');
                if (btn) {{
                    btn.classList.add('scale-125');
                    setTimeout(() => btn.classList.remove('scale-125'), 200);
                }}
            }},

            openCart() {{
                const modal = document.getElementById('customer-cart-modal');
                if (modal) {{
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                }}
            }},

            closeCart() {{
                const modal = document.getElementById('customer-cart-modal');
                if (modal) {{
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }}
            }},

            async submitOrder(event) {{
                event.preventDefault();
                const pids = Object.keys(this.cart);
                if (!pids.length) {{
                    alert('Giỏ hàng đang trống! Vui lòng chọn món trước.');
                    return;
                }}

                const name = document.getElementById('customer-order-name')?.value.trim();
                const phone = document.getElementById('customer-order-phone')?.value.trim();
                const address = document.getElementById('customer-order-address')?.value.trim();
                const note = document.getElementById('customer-order-note')?.value.trim();
                const submitBtn = document.getElementById('customer-order-submit');
                const errorBox = document.getElementById('customer-order-error');

                if (errorBox) errorBox.classList.add('hidden');
                if (submitBtn) {{
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang gửi đơn...';
                }}

                const fullNote = [
                    address ? `Địa chỉ/Bàn: ${{address}}` : '',
                    note ? `Ghi chú: ${{note}}` : ''
                ].filter(Boolean).join(' | ');

                const items = pids.map(id => {{
                    const p = this.getProductInfo(id);
                    return {{
                        id: Number(id),
                        quantity: Number(this.cart[id]) || 1,
                        price: p ? p.price : 0,
                        name: p ? p.name : ''
                    }};
                }});

                try {{
                    const response = await fetch('api/orders?action=customer_order', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{
                            customer_name: name,
                            customer_phone: phone,
                            note: fullNote,
                            table_id: 0,
                            table_code: address ? `BÀN/GIAO (${{address}})` : 'ONLINE',
                            items: items
                        }})
                    }});

                    const data = await response.json();
                    if (!response.ok || !data.success) {{
                        throw new Error(data.message || 'Không thể tạo đơn hàng.');
                    }}

                    // Reset cart
                    this.cart = {{}};
                    this.saveCart();
                    this.renderCart();

                    this.currentOrder = data;
                    this.showPaymentScreen(data);
                }} catch (err) {{
                    if (errorBox) {{
                        errorBox.textContent = err.message || 'Lỗi gửi đơn.';
                        errorBox.classList.remove('hidden');
                    }} else {{
                        alert(err.message || 'Lỗi gửi đơn.');
                    }}
                }} finally {{
                    if (submitBtn) {{
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Gửi Đơn Đặt Hàng Đến Quán';
                    }}
                }}
            }},

            showPaymentScreen(order) {{
                const checkout = document.getElementById('customer-cart-checkout');
                const payment = document.getElementById('customer-order-payment');
                if (checkout) checkout.classList.add('hidden');
                if (payment) payment.classList.remove('hidden');

                document.getElementById('customer-payment-order-code').textContent = order.order_code;
                document.getElementById('customer-payment-total').textContent = `${{this.formatMoney(order.total_amount)}} đ`;

                const note = `THANH TOAN ${{order.order_code}}`;
                document.getElementById('customer-payment-note').textContent = note;

                const amount = Math.round(Number(order.total_amount));
                const bankId = 'OCB';
                const accountNo = '0918608073';
                const accountName = 'NGUYEN CHI HUNG';

                const qrUrl = `https://img.vietqr.io/image/${{bankId}}-${{accountNo}}-compact2.png?amount=${{amount}}&addInfo=${{encodeURIComponent(note)}}&accountName=${{encodeURIComponent(accountName)}}`;
                const qrImg = document.getElementById('customer-payment-qr');
                if (qrImg) qrImg.src = qrUrl;
            }},

            async checkOrderStatus() {{
                if (!this.currentOrder?.order_code) return;
                try {{
                    const res = await fetch(`api/orders?action=customer_status&token=${{encodeURIComponent(this.currentOrder.order_code)}}`);
                    const data = await res.json();
                    if (data.success && data.order) {{
                        const o = data.order;
                        const statusEl = document.getElementById('customer-payment-status');
                        if (statusEl) {{
                            if (o.status === 'completed') {{
                                statusEl.textContent = '🎉 Đơn hàng đã hoàn tất! Cảm ơn quý khách.';
                                statusEl.className = 'text-xs text-emerald-300 font-semibold p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30';
                            }} else if (o.kitchen_status === 'ready') {{
                                statusEl.textContent = '🍳 Món đã chuẩn bị xong, đang giao tới quý khách!';
                                statusEl.className = 'text-xs text-sky-300 font-semibold p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30';
                            }} else {{
                                statusEl.textContent = '⏳ Quán đã nhận đơn, bếp đang chế biến!';
                                statusEl.className = 'text-xs text-amber-300 font-semibold p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20';
                            }}
                        }}
                    }}
                }} catch (e) {{
                    console.log('Error checking order status:', e);
                }}
            }},

            resetOrder() {{
                this.currentOrder = null;
                const checkout = document.getElementById('customer-cart-checkout');
                const payment = document.getElementById('customer-order-payment');
                if (payment) payment.classList.add('hidden');
                if (checkout) checkout.classList.remove('hidden');
                this.closeCart();
            }},

            filterCategory(catId) {{
                this.activeCategory = Number(catId) || 0;
                document.querySelectorAll('.cat-pill').forEach((btn, idx) => {{
                    if ((catId === 0 && idx === 0) || btn.getAttribute('onclick')?.includes(`(${{catId}})`)) {{
                        btn.className = 'cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500 text-white shadow-md transition-all shrink-0';
                    }} else {{
                        btn.className = 'cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all shrink-0';
                    }}
                }});
                this.applyFilters();
            }},

            filterSearch(keyword) {{
                this.searchKeyword = (keyword || '').trim().toLocaleLowerCase('vi');
                this.applyFilters();
            }},

            applyFilters() {{
                const kw = this.searchKeyword || '';
                document.querySelectorAll('.product-item').forEach(el => {{
                    const itemCat = Number(el.dataset.categoryId);
                    const itemName = (el.dataset.productName || '').toLocaleLowerCase('vi');
                    const matchCat = (this.activeCategory === 0 || itemCat === this.activeCategory);
                    const matchSearch = (!kw || itemName.includes(kw));
                    el.style.display = (matchCat && matchSearch) ? 'flex' : 'none';
                }});
            }},

            formatMoney(val) {{
                return new Intl.NumberFormat('vi-VN').format(Math.round(Number(val) || 0));
            }}
        }};

        // Modal Controls
        function showQuickVietQr() {{
            const modal = document.getElementById('quick-vietqr-modal');
            if (modal) modal.classList.remove('opacity-0', 'pointer-events-none');
        }}

        function closeQuickVietQr() {{
            const modal = document.getElementById('quick-vietqr-modal');
            if (modal) modal.classList.add('opacity-0', 'pointer-events-none');
        }}

        async function handleLogout() {{
            if (!confirm('Đăng xuất khỏi tài khoản khách hàng?')) return;
            localStorage.removeItem('pos_user');
            try {{
                await fetch('api/auth.php?action=logout');
            }} catch(e) {{}}
            window.location.reload();
        }}

        // Initialization
        document.addEventListener('DOMContentLoaded', () => {{
            CustomerAdCarousel.init();
            CustomerOrdering.init();

            // Check logged in user
            const savedUser = localStorage.getItem('pos_user');
            if (savedUser) {{
                try {{
                    const u = JSON.parse(savedUser);
                    const zone = document.getElementById('user-nav-zone');
                    if (zone && u) {{
                        zone.innerHTML = `
                            <div class="flex items-center gap-1.5 pl-2 border-l border-white/10 shrink-0 whitespace-nowrap">
                                <span class="px-2.5 py-1 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-500/35 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                                    <i class="fas fa-user-circle text-sky-300"></i>
                                    <span class="max-w-[120px] truncate">${{u.fullname || u.username}}</span>
                                </span>
                                ${{u.role === 'admin' ? '<a href="admin.html" class="btn-glass px-2 py-1 text-xs text-indigo-300 hover:text-white shrink-0 border border-indigo-500/30" title="Trang Quản Trị"><i class="fas fa-chart-pie"></i></a>' : ''}}
                                <button type="button" onclick="handleLogout()" class="w-7 h-7 rounded-lg btn-glass bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 hover:text-white flex items-center justify-center p-0 border border-rose-500/30 transition-all shrink-0" title="Đăng xuất">
                                    <i class="fas fa-sign-out-alt text-xs"></i>
                                </button>
                            </div>
                        `;
                    }}
                }} catch(e) {{}}
            }}
        }});
    </script>
</body>
</html>
'''

with open('web/customer.html', 'w', encoding='utf-8') as f:
    f.write(full_html)

print("web/customer.html written successfully!")
