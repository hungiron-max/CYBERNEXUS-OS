window.QA_ARCH_CODEBASE = {
 "generated": "26/11/2026 14:48",
 "arch": {
  "overview": {
   "version": "v2.5.0",
   "ota": "v2026.11.26.01",
   "summary": "CyberNexus OS là hệ sinh thái quản trị không gian số F&B theo kiến trúc Vi hạt nhân C++17 (Offline-First tại quán + điều hành tập trung từ Master SaaS), hợp nhất POS/KDS/Chấm công + WiFi Marketing & Router QoS + Media Server & Smart Jukebox.",
   "pillars": [
    {
     "title": "Host Core Master (:8500)",
     "desc": "cybernexus_master.exe — Điều hành chuỗi quán, cấp phép 18 modules ECDSA P-256, SOP-09 đóng gói 1-Click, Đại lý 4 hạng & Ví ký quỹ, Master AI Vault Zero-Exposure, Self-Billing VietQR và Kho bản vá OTA."
    },
    {
     "title": "Host Core Slave (:8501)",
     "desc": "cybernexus_slave.exe — Chạy 100% Offline trên SQLite 3 WAL (42 bảng), phục vụ 10 màn hình Web (POS, Admin 11 tab, KDS, Order, QR Khách, Online, Chấm công HR-11, WiFi, I18N Studio) mà không chứa mã SuperAdmin."
    },
    {
     "title": "3 Plugin DLL Động (.sig v2)",
     "desc": "Nạp qua IModulePlugin + PluginManager sau khi kiểm chứng chữ ký ECDSA-P256-SHA256: libmod_media_stream.dll, libmod_network_qos.dll, libmod_card_payment.dll (đã gỡ 2 DLL thừa mod_pos_core & mod_finance_admin ở ARCH-01)."
    },
    {
     "title": "4 Ứng Dụng Desktop Windows GUI",
     "desc": "CyberNexus_Control_Center.exe (Master & Slave Tray App — không cửa sổ CMD đen), CyberNexus_Setup_Stub.exe (Cài đặt 1-Click SOP-09), CyberNexus_Vault_Admin.exe (Cứu hộ nội bộ)."
    }
   ],
   "event_bus": [
    {
     "event": "ORDER_PAID",
     "pub": "Slave Host Core (slave_handlers.cpp)",
     "sub": "libmod_network_qos.dll",
     "desc": "Hóa đơn hợp lệ có thể dùng mã hóa đơn mở khóa phiên WiFi VIP dài hạn trên wifi.html."
    },
    {
     "event": "ORDER_CREATED / RUSH",
     "pub": "Slave Host Core",
     "sub": "KDS & Order UI + Audio Ducking",
     "desc": "Bắn cảnh báo đơn mới/hối bếp, tự hạ nhạc nền Jukebox khi bật Auto Audio Ducking."
    },
    {
     "event": "SONG_REQUESTED / VOTE",
     "pub": "Customer QR / POS / Admin",
     "sub": "libmod_media_stream.dll",
     "desc": "Kiểm tra cooldown chống spam theo bàn, cập nhật hàng đợi ưu tiên & phát đồng bộ qua Leader Election."
    },
    {
     "event": "SYSTEM_UPDATE / RESET_PIN",
     "pub": "Master Tunnel (master_tunnel.h)",
     "sub": "Slave Tunnel & Control Center",
     "desc": "Đẩy bản vá OTA theo phiên bản chỉ định hoặc lệnh tạo lại file DEFAULT_OWNER_PIN.txt từ xa."
    },
    {
     "event": "IPS_ABNORMAL_TRAFFIC",
     "pub": "Slave Host Core (Smart IPS / POS Block Spammer)",
     "sub": "libmod_network_qos.dll",
     "desc": "Tự động đá rớt (kick-sta bậc 2) hoặc Ban MAC (block-sta bậc 3) trên UniFi khi phát hiện HTTP Flood, WAF Probe hoặc chặn Spammer QR."
    }
   ]
  },
  "security": {
   "algo": "ECDSA P-256 + SHA-256 (Windows CNG — shared/include/license_crypto.hpp)",
   "points": [
    {
     "name": "Ký số Plugin DLL v2 (--sign-dll)",
     "detail": "Chạy cybernexus_master.exe --sign-dll <file.dll> để tính SHA-256 và ký bằng khóa bí mật ECDSA P-256, sinh tệp .dll.sig v2 (algorithm, key_fingerprint, sha256, ecdsa_sig, version: 2). Slave từ chối nạp mọi DLL sai dù chỉ 1 byte."
    },
    {
     "name": "Khóa Phần Cứng (Hardware Node-Lock)",
     "detail": "Ràng buộc License Key (CBNX-XXXX-XXXX-XXXX-XXXX) với Machine ID phần cứng máy quán. Khi quán đổi máy tính, kỹ thuật bấm Reset Hardware Lock trên Master rồi kích hoạt lại."
    },
    {
     "name": "Chống Sửa Tay local_license_cache (ARCH-04)",
     "detail": "Chữ ký ECDSA bảo vệ đồng thời 6 trường cốt lõi (license_key, machine_id, expire_date, subscription_status, enabled_modules, blocked_modules). Sửa tay SQLite lập tức kích hoạt lỗi 403 LICENSE_SIGNATURE_TAMPERED."
    },
    {
     "name": "Chống Lùi Đồng Hồ & Ân Hạn Offline",
     "detail": "Theo dõi mốc thời gian đơn điệu (last_seen_monotonic) chống lùi ngày hệ thống; cho phép quán bán hàng liên tục khi mất mạng WAN trong số ngày ân hạn (Grace Days) do Master cấu hình."
    },
    {
     "name": "Toàn Vẹn Mã Web (web_integrity.json)",
     "detail": "Mỗi file HTML/JS/CSS trong web/ có mã băm SHA-256 trong web_integrity.json; Control Center và /api/system/integrity phát hiện ngay mọi file bị sửa/thiếu trái phép."
    },
    {
     "name": "Chống Brute-Force & Spam QR (SEC-16)",
     "detail": "Khóa tạm HTTP 429 khi nhập sai mật khẩu/PIN liên tiếp (login_attempts); chặn IP/SĐT spam đơn QR vào qr_blacklist; chống gửi trùng đơn bằng idempotency_key."
    }
   ]
  },
  "business_ai": {
   "pillars": [
    {
     "name": "18 Modules Bản Quyền Linh Hoạt",
     "detail": "Bật/tắt hoặc Chặn (BLOCK) độc lập từng tính năng theo quán trên Master (pos_core, kitchen_kds, waiter_mobile, qr_table_order, online_orders, advertising_promotions, promo_voucher_engine, finance_reports, inventory_recipes, staff_shifts, staff_kpi, mod_media_stream, mod_network_qos, mod_card_payment, ai_dish_studio, cloud_sync_backup...)."
    },
    {
     "name": "Kênh Đại Lý 4 Hạng & Ví Ký Quỹ",
     "detail": "Đồng (15%), Bạc (25%), Vàng (40%), Kim Cương (55%). Nạp tiền vào ví ký quỹ (saas_reseller_wallet_logs), cấp License Key tự động tính giá sau chiết khấu và trừ ví nguyên tử."
    },
    {
     "name": "Self-Billing VietQR 24/7",
     "detail": "Chủ quán tự gia hạn gói hoặc mua thêm AI Credit ngay trên Slave Admin (modal-store-billing) qua mã VietQR SVG động; Webhook ngân hàng tự đối soát hoặc Kế toán duyệt tay."
    },
    {
     "name": "Master AI Vault (Zero-Exposure Proxy)",
     "detail": "API Key Google Gemini chỉ lưu duy nhất trên Master (master_ai_keys), tuyệt đối không gửi xuống máy quán. Hỗ trợ đa key xoay vòng ưu tiên và tính phí theo AI Credit (chỉ trừ khi gọi thành công): OCR hóa đơn = 1cr, Tạo ảnh món = 2cr, Tạo slide quảng cáo = 3cr."
    }
   ],
   "ai_real": [
    "AI Copilot Dashboard (Admin Slave): Hỏi đáp doanh thu, món bán chạy, gợi ý nhập kho & kiểm tra bất thường.",
    "AI OCR Nhập Kho 3 Cách (modal-smart-import): Chụp Camera hoặc tải ảnh hóa đơn giấy để Gemini bóc tách mặt hàng/số lượng/đơn giá (1 credit).",
    "AI Tạo Ảnh Món Ăn 4:3 + Smart Menu Studio (0 AI Token tìm ảnh thật + 2 credit nếu tạo ảnh AI).",
    "AI Tạo Slide / Banner Quảng Cáo (Admin › Cài Đặt › Studio Quảng Cáo — 3 credit).",
    "AI Dịch Đa Ngôn Ngữ Tự Động trong I18N Studio (/api/i18n/ai-translate — hỗ trợ ~4.800 chuỗi VI/EN)."
   ],
   "ai_future": [
    "Bot Zalo tự động gửi báo cáo doanh thu (hiện đã hỗ trợ Telegram Bot).",
    "AI phân tích lưu lượng Router chống torrent/DDoS tự động (mod_ai_netshield).",
    "AI lọc ca từ bài hát tự động theo thời gian thực khi khách yêu cầu Jukebox."
   ]
  },
  "media_dsp": {
   "features_v25": [
    "Streaming nội bộ Offline 100% chuẩn HTTP Range 206 Partial Content + bảo mật HMAC-SHA256 Ticket chống cào trộm kho nhạc.",
    "10-Band DSP Mastering Equalizer (31Hz, 62Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) + Preamp + 15 Preset + đồ thị sóng âm động + Auto Audio Ducking.",
    "Nhập nhạc từ YouTube, Nghe thử, Tải về lưu Offline vĩnh viễn trên ổ cứng và nút Cập nhật yt-dlp trực tiếp ngay trên web (admin_media_dsp.js).",
    "Audio Engine đa tab (jukebox-engine.js) dùng BroadcastChannel + Leader Election chống phát chồng 2 loa khi mở nhiều tab, tự dừng sạch khi đăng xuất.",
    "POS Mini Jukebox (pos-jukebox.js) tích hợp ngay trên thanh tiêu đề màn hình Thu ngân + Lịch phát nhạc tự động theo khung giờ + Tự phân loại thể loại (auto_classify).",
    "Khách quét QR bàn (customer.html) xem bài đang phát, yêu cầu bài, bình chọn (Vote) kèm luật chống spam Cooldown theo bàn."
   ],
   "eq_bands": [
    [
     "31 Hz",
     "Sub-Bass Sâu",
     "Độ rung trầm uy lực cho nhạc EDM, Gaming tối"
    ],
    [
     "62 Hz",
     "Bass Trầm",
     "Lực nảy trống kick drum"
    ],
    [
     "125 Hz",
     "Upper Bass",
     "Độ dày đàn bass, sự ấm cúng"
    ],
    [
     "250 Hz",
     "Low-Mid",
     "Độ ấm giọng nam & guitar thùng"
    ],
    [
     "500 Hz",
     "Mid Trung Tâm",
     "Sự tự nhiên giọng hát Vocal, piano"
    ],
    [
     "1 kHz",
     "High-Mid",
     "Độ nổi lời bài hát trong quán đông"
    ],
    [
     "2 kHz",
     "Upper-Mid",
     "Độ sắc nét nhạc cụ (tránh đẩy quá gây chói)"
    ],
    [
     "4 kHz",
     "Presence",
     "Độ mở sân khấu âm thanh"
    ],
    [
     "8 kHz",
     "Treble Sáng",
     "Tiếng hi-hat, cymbal bay bổng"
    ],
    [
     "16 kHz",
     "Air / Siêu Tép",
     "Độ tơi xốp, thoáng đãng không gian"
    ]
   ]
  },
  "sop09": {
   "steps": [
    {
     "step": "1. Tạo Quán & Hồ Sơ Pháp Lý (Sales)",
     "detail": "Trên Master (/super_admin.html) tạo Tenant mới (Mã quán, MST/CCCD, gói cước, logo) → tự sinh License Key CBNX + PIN 6 số mặc định. Xuất hợp đồng tự điền biến từ tab Biểu Mẫu & Hợp Đồng và upload bản ký vào modal SOP-09."
    },
    {
     "step": "2. Xác Nhận Thương Mại (Finance / Sales)",
     "detail": "Kế toán bấm Xác nhận đã thu tiền (hoặc Sales bật Dùng thử 7 ngày, hoặc SuperAdmin cấp Workflow Override) để mở khóa nút Đóng gói."
    },
    {
     "step": "3. Đóng Gói 1-Click (Tech)",
     "detail": "Trong modal SOP-09 bấm Tạo Gói Cài Đặt → Master tự build bộ cài CyberNexus_POS_Setup_<CODE>.exe (dùng CyberNexus_Setup_Stub.exe) nhúng sẵn License Key, URL Master, 3/3 DLL đã ký .sig v2, web_integrity.json và DEFAULT_OWNER_PIN.txt."
    },
    {
     "step": "4. Cài Đặt & Kích Hoạt Tại Quán",
     "detail": "Chạy file Setup .EXE (tự dừng bản cũ, tự mở Firewall 8501, tạo Shortcut & chạy CyberNexus_Control_Center.exe không hiện CMD đen). Đăng nhập lần đầu bằng PIN trong DEFAULT_OWNER_PIN.txt → bắt buộc đổi PIN 6 số mới → Kết nối Master WAN & Kích hoạt License."
    },
    {
     "step": "5. Nghiệm Thu Chuẩn v2.5.0 (Control Center)",
     "detail": "Bấm \"Kiểm tra Port & Code\" trên Control Center xác nhận 4 tiêu chí xanh: Port 8501 OK · 3/3 DLL .sig ECDSA v2 hợp lệ (libmod_card_payment, libmod_media_stream, libmod_network_qos) · Web SHA-256 0 file lỗi · SQLite OK."
    },
    {
     "step": "6. Bảo Trì, Reset PIN & Cứu Hộ",
     "detail": "Chủ quán quên PIN → đối chiếu email → Master bấm Reset PIN 6 số → Control Center hiện chấm xanh mở lại file PIN. Khôi phục khẩn cấp nội bộ dùng CyberNexus_Vault_Admin.exe (bảo vệ bằng vault_admin.key)."
    }
   ],
   "troubleshoot": [
    [
     "Machine ID không khớp / LICENSE_SIGNATURE_TAMPERED",
     "Quán đổi máy/cài lại Windows hoặc sửa tay SQLite",
     "Master bấm Reset Hardware Lock → Slave kích hoạt lại"
    ],
    [
     "Đụng Port 8500 / 8501 khi khởi chạy",
     "Tiến trình cũ treo hoặc ứng dụng khác chiếm cổng",
     "Control Center → Kiểm tra Port & Code → Giải phóng Port → Khởi chạy"
    ],
    [
     "Quét QR bàn ra localhost",
     "Chưa chọn card mạng IP LAN vật lý",
     "Slave Admin › Cài Đặt › Quán & Slide → chọn IP LAN thật → Lưu & in lại QR"
    ],
    [
     "Báo lỗi sai chữ ký .sig hoặc Web SHA-256",
     "Sửa nhầm file web hoặc thiếu file .dll.sig",
     "Bấm Kiểm tra Update trên Control Center để đồng bộ bản chuẩn"
    ],
    [
     "Quán ngoài mạng báo Offline",
     "Chưa mở Port 8500 WAN / CGNAT / DNS có bản ghi IPv6 AAAA",
     "Mở Port Forward 8500 TCP, kiểm IP Public thật, xóa bản ghi DNS AAAA"
    ],
    [
     "CSDL SQLite malformed / locked",
     "Cúp điện đột ngột hoặc 2 tiến trình cùng mở DB",
     "Dừng trên Control Center → kiểm tra quick_check → khôi phục backup / Vault Admin"
    ]
   ]
  },
  "restore_points": [
   {
    "ver": "v2.5.0",
    "ota": "2026.11.22.04",
    "tag": "v2.5.0",
    "branch": "restore/v2.5",
    "current": true,
    "notes": "Hoàn thiện 90/90 QA: Kiến trúc Offline-First + 3 DLL ký ECDSA P-256 CNG v2 (ARCH-01/SEC-10), Chống sửa tay local_license_cache 6 trường, I18N Studio đa ngôn ngữ (~4.800 chuỗi + AI Dịch), Bảng ca Real-Time HR-11 + Hikvision, Thanh toán/Két tiền/Chống spam QR, Sổ tay Slave & Master tương tác."
   },
   {
    "ver": "v2.3b",
    "ota": "2026.11.20.5",
    "tag": "v2.3b",
    "branch": "restore/v2.3b",
    "current": false,
    "notes": "OTA 6 bước an toàn trên Control Center (Active Orders Guard, SHA-256, Auto-Rollback), ẩn triệt để module chưa cấp phép, đồng bộ thương hiệu 1 nguồn store_brand.js, gói Setup 1-Click."
   },
   {
    "ver": "v2.0.0",
    "ota": "2026.11.16.21",
    "tag": "v2.0.0",
    "branch": "restore/v2.0",
    "current": false,
    "notes": "Kiến trúc DLL + .sig v1, giao diện WiFi Marketing Mobile-First (wifi_portal.css), giới hạn hàng đợi Jukebox 5 bài & chống vote trùng IP."
   },
   {
    "ver": "v1.3.0",
    "ota": "2026.11.16.20",
    "tag": "v1.3.0",
    "branch": "restore/v1.3",
    "current": false,
    "notes": "Bảo mật Auth cho /api/settings, bỏ PIN hardcode 9999, bật CSP & Security Headers, tách admin.js thành các module riêng."
   },
   {
    "ver": "v1.2.0",
    "ota": "2026.11.16.19",
    "tag": "v1.2.0",
    "branch": "restore/v1.2",
    "current": false,
    "notes": "Tách CSS/JS, WiFi Marketing cơ bản, Router QoS MikroTik/EdgeRouter, AI Copilot, Lịch phát nhạc theo giờ, SLA/KPI & đánh giá Sao."
   }
  ],
  "hybrid_network": {
   "title": "Kiến Trúc Mạng Hybrid Dual-Plane (EdgeRouter X + UniFi OS Server + CyberNexus POS)",
   "ota": "v2026.11.23.12",
   "summary": "Mô hình phân vai chuẩn doanh nghiệp cho quán F&B: EdgeRouter X đảm nhiệm tầng định tuyến L3/L4, Firewall chính xác từng Port, Smart Queue (FQ-CoDel) và Safe WiFi DNS; UniFi OS Server + UniFi AP đảm nhiệm tầng sóng L2, L2 Client Isolation và điều khiển phiên từng thiết bị theo MAC; CyberNexus POS Slave (libmod_network_qos.dll) là trung tâm điều phối 1 chạm, hợp nhất danh sách LAN/WiFi, giám sát NOC và kích hoạt Smart IPS 3 bậc.",
   "devices": [
    {
     "name": "1. Router EdgeRouter X (Gateway L3/L4)",
     "layer": "Lớp Mạng L3 / L4 (WAN & LAN Gateway)",
     "ip_port": "172.16.0.1 • SSH :22",
     "role": "Cổng An Ninh Tổng, Định Tuyến VLAN & Điều Phối Băng Thông WAN",
     "functions": [
      "Quản lý đường truyền Internet (hỗ trợ Dual-WAN Failover tự chuyển mạch < 5s khi rớt mạng chính).",
      "Phân tách 2 phân mạng độc lập: VLAN 10 (Nội bộ / POS / Máy in / Camera) và VLAN 20 (WiFi Khách).",
      "Thực thi Firewall L3/L4 (GUEST_IN / GUEST_LOCAL) chính xác tới từng Port: CHỈ mở duy nhất TCP <POS_IP>:8501 cho khách gọi món QR; KHÓA CHẾT RDP :3389, SMB :445, UniFi :11443 ngay trên máy chủ POS và DROP toàn bộ RFC1918 (10/8, 172.16/12, 192.168/16).",
      "Smart Queue (FQ-CoDel): Dành ưu tiên băng thông tối cao (25–30%) cho Máy chủ POS, thanh toán VietQR và Master Tunnel — giờ cao điểm 50 khách xem video vẫn tính tiền < 50ms.",
      "Lọc nội dung DNS (Safe WiFi: Cloudflare 1.1.1.2 / 1.1.1.3 Family / AdGuard) + chống treo bảng NAT (Connection Limit 150 phiên/khách).",
      "Cấp phát IP (DHCP Server) và đồng bộ danh sách thiết bị LAN dây (máy in, camera, PC) về CyberNexus."
     ]
    },
    {
     "name": "2. UniFi OS Server (Bộ Não Quản Trị WiFi)",
     "layer": "Lớp Điều Khiển WiFi (Management Plane)",
     "ip_port": "172.16.38.119 • HTTPS API :11443",
     "role": "Điều Khiển Phiên Khách Theo MAC & Thu Thập Telemetry Sóng",
     "functions": [
      "Cung cấp REST API (/api/auth/login, /proxy/network/api/s/default/*) có Session Cookie Cache 15 phút trên CyberNexus (chấm dứt triệt để HTTP 429).",
      "Thực thi lệnh tức thì theo từng địa chỉ MAC: Cấp VIP (authorize-guest 180 phút), Ghim Nội bộ ∞ (525600 phút = 1 năm không giới hạn), Ngắt mềm (unauthorize-guest + kick-sta, không Ban), Chặn cứng / Mở chặn (block-sta / unblock-sta).",
      "Đẩy chính sách Guest Access (Restricted Subnets RFC1918 + Allowed Exception <POS_IP>/32) và bật L2 Client Isolation xuống toàn bộ UniFi AP.",
      "Đồng bộ danh sách thiết bị đang bị Ban (/rest/user blocked=true) bền vững kể cả sau khi khởi động lại Slave.",
      "Cung cấp dữ liệu giám sát NOC (/stat/device, /stat/sta): số khách bám từng AP, băng tần 2.4G/5G, cường độ tín hiệu RSSI và dung lượng tiêu thụ (MB) của từng thiết bị."
     ]
    },
    {
     "name": "3. Cục Phát WiFi UniFi Access Points (AP)",
     "layer": "Lớp Truy Cập Vô Tuyến L2 (Access Plane)",
     "ip_port": "PoE LAN • 2.4GHz / 5GHz",
     "role": "Phát Sóng 2 SSID Tách Biệt & Cô Lập Tầng L2 Giữa Các Máy Khách",
     "functions": [
      "Phát song song 2 SSID độc lập: SSID Nội bộ (gắn VLAN 10 cho nhân viên/POS) và SSID Khách (gắn VLAN 20, VD: Goc_pho).",
      "Thực thi L2 Client Isolation: 2 điện thoại khách ngồi cùng bàn không thể ping, quét mạng (Fing) hay tấn công ARP Spoofing lẫn nhau.",
      "Chấp hành lệnh đá rớt (kick-sta) hoặc chặn MAC (block-sta) ngay tại tầng sóng radio trong < 1 giây."
     ]
    },
    {
     "name": "4. Máy Chủ POS CyberNexus Slave",
     "layer": "Lớp Ứng Dụng & Điều Phối Trung Tâm (Orchestration Plane)",
     "ip_port": "172.16.38.119 • HTTP :8501",
     "role": "Nhạc Trưởng Hybrid 1 Chạm, Smart IPS 3 Bậc & Bảo Vệ Cổng Nội Bộ Lớp 3",
     "functions": [
      "Chế độ Hybrid (libmod_network_qos.dll): Cấu hình & kiểm tra song song cả EdgeRouter X + UniFi OS Server, hợp nhất danh sách thiết bị WiFi + LAN dây kèm dung lượng MB & loại sóng.",
      "Điều phối 1 chạm: Bấm 'Áp dụng lên Router' đồng thời đẩy L2 Isolation (UniFi) + Firewall GUEST_IN / Safe WiFi DNS / FQ-CoDel (EdgeRouter X).",
      "Smart IPS & Auto-Ban 3 bậc (main_slave.cpp): Phát hiện HTTP Flood (>80 req/10s), WAF Probe (/.env, /wp-admin, SQLi) & Payload Flood (>2MB) -> Bậc 1 (429) -> Bậc 2 (Cách ly 15p + kick-sta) -> Bậc 3 (Tự động block-sta trên UniFi + ghi security_incidents).",
      "Admin IP Guard Lớp 3: Khi bật, mọi IP khách gõ tay /admin.html, /index.html, /kitchen.html tự chuyển hướng về /customer.html (chỉ mở trang QR Gọi Món & WiFi Portal).",
      "Chống phá Jukebox & Spam API: Bỏ X-Forwarded-For, ép is_priority=0, cooldown 60s, max 3 bài/khách, max 2 lượt WiFi Free/ngày, chỉ nhận hóa đơn VIP trong ngày."
     ]
    },
    {
     "name": "5. Thiết Bị Nội Bộ Quán (Nội bộ ∞ / VLAN 10)",
     "layer": "Vùng Tin Cậy (Trusted Zone)",
     "ip_port": "VLAN 10 • Whitelist MAC + IP",
     "role": "Vận Hành Quán — Miễn Trừ 100% Giới Hạn & Được Bảo Vệ Tuyệt Đối",
     "functions": [
      "Bao gồm: Máy chủ POS, máy in hóa đơn nhiệt LAN (:9100), màn hình Bếp KDS, điện thoại Chủ quán & Nhân viên, Camera CCTV, Máy chấm công Hikvision.",
      "Lưu định danh theo cả MAC & IP (whitelist_macs + whitelist_ips): đổi IP DHCP vẫn giữ nguyên quyền Nội bộ ∞ không giới hạn thời lượng/băng thông.",
      "Miễn trừ tuyệt đối khỏi Smart IPS, Khóa cổng Admin Lớp 3 và bộ đếm thời gian WiFi."
     ]
    },
    {
     "name": "6. Thiết Bị Khách Hàng (VLAN 20 — WiFi Khách)",
     "layer": "Vùng Không Tin Cậy (Untrusted Guest Zone)",
     "ip_port": "VLAN 20 • Chỉ mở TCP POS:8501 + Internet",
     "role": "Trải Nghiệm Mượt Mà (QR Order + WiFi VIP) Trong Khung An Toàn Tuyệt Đối",
     "functions": [
      "Mù 100% với toàn bộ thiết bị LAN (máy in, camera, router, máy chấm công, điện thoại khách khác).",
      "Chỉ được chạm đúng Máy Chủ POS cổng 8501 cho /customer.html (Gọi món QR, Jukebox công bằng) và /wifi.html (Dùng thử Free tối đa 2 lượt/ngày hoặc nhập mã hóa đơn trong ngày mở WiFi VIP 180 phút).",
      "Lưu lượng Internet đi qua Safe WiFi DNS (chặn mã độc/lừa đảo/web đen) và nằm dưới trần băng thông FQ-CoDel để không bao giờ làm chậm POS."
     ]
    }
   ],
   "vlans": [
    {
     "id": "VLAN 10 (Nội bộ / POS)",
     "subnet": "172.16.10.0/24 (hoặc LAN chính 172.16.38.0/24)",
     "ssid": "Goc_pho_NB (ẩn hoặc mật khẩu riêng)",
     "policy": "Toàn quyền nội bộ • Ưu tiên băng thông POS/VietQR (Priority 1) • Miễn trừ IPS & Khóa Admin"
    },
    {
     "id": "VLAN 20 (WiFi Khách)",
     "subnet": "172.16.20.0/24",
     "ssid": "Goc_pho (Bật L2 Client Isolation)",
     "policy": "ACCEPT duy nhất TCP <POS_IP>:8501 + DNS/DHCP • DROP toàn bộ RFC1918 & cổng 3389/445/11443/22 • DNS sạch 1.1.1.3 • Giới hạn trần 70% WAN"
    }
   ],
   "flows": [
    {
     "name": "Luồng 1 — Cô Lập Zero-Trust 3 Lớp (1 chạm)",
     "steps": "Admin bấm 'Áp dụng lên Router' -> UniFi bật L2 Isolation + chặn RFC1918 (chỉ mở POS/32) -> EdgeRouter X nạp GUEST_IN chỉ mở TCP POS:8501 (khóa 3389/445/11443) -> Slave bật Admin IP Guard Lớp 3 (khách chỉ vào /customer.html & /wifi.html)."
    },
    {
     "name": "Luồng 2 — Thanh Toán Hóa Đơn -> Tự Động Mở WiFi VIP & Ưu Tiên Jukebox",
     "steps": "Thu ngân bấm thanh toán trên POS -> Slave phát sự kiện ORDER_PAID -> mod_network_qos gọi UniFi authorize-guest 180p (hoặc khách nhập mã hóa đơn trong ngày tại /wifi.html) & mod_media_stream tự bật is_priority=1 cho bài hát của bàn đó."
    },
    {
     "name": "Luồng 3 — Smart IPS 3 Bậc Tự Động Phòng Thủ",
     "steps": "Khách flood >80 req/10s hoặc dò /.env, SQLi -> Bậc 1 trả HTTP 429 -> Bậc 2 cách ly IP 15p + đẩy kick-sta lên UniFi -> Bậc 3 tự động block-sta trên UniFi + ghi bảng security_incidents (chủ quán thấy ngay để Mở chặn 1 chạm nếu cần)."
    },
    {
     "name": "Luồng 4 — Bảo Vệ Giờ Cao Điểm & Giám Sát NOC",
     "steps": "EdgeRouter X chạy Smart Queue FQ-CoDel giữ 25-30% băng thông ưu tiên cho POS/VietQR; CyberNexus đọc /stat/device (UniFi APs) + uptime (EdgeRouter X) + dung lượng MB từng khách ngay trên màn hình Admin › WiFi Marketing."
    }
   ]
  }
 },
 "codebase": {
  "stats": {
   "files": 135,
   "total_lines": 95431,
   "folders": 8,
   "targets": 9
  },
  "folderTree": [
   {
    "path": "CMakeLists.txt",
    "scope": "Build Root",
    "desc": "Cấu hình biên dịch toàn dự án: 2 Host Core (Master/Slave), 3 Plugin DLL và 4 Windows Launcher GUI.",
    "rule": "Tách biệt tuyệt đối target Master & Slave"
   },
   {
    "path": "shared/",
    "scope": "Lõi dùng chung",
    "desc": "25 tệp C/C++ nền tảng: SQLite3 WAL (db.cpp), Xác thực bcrypt/token (auth.cpp), ECDSA P-256 CNG (license_crypto.hpp), PluginManager, ConfigManager, httplib, Gemini Client.",
    "rule": "Dùng chung cho Master, Slave & Launcher"
   },
   {
    "path": "master/src/ & master/web/",
    "scope": "Master SaaS (:8500)",
    "desc": "Máy chủ Cloud Super Admin: quản lý cửa hàng, cấp phép 18 modules, SOP-09 đóng gói 1-Click, Đại lý & Ví ký quỹ, Master AI Vault, Self-Billing, OTA Archive, Theme & I18N Studio.",
    "rule": "KHÔNG đóng gói xuống máy quán"
   },
   {
    "path": "slave/src/ & slave/web/",
    "scope": "Slave Edge (:8501)",
    "desc": "Máy chủ tại quán (chạy 100% Offline): 10 màn hình Web (POS, Admin 11 tab, KDS, Order, Customer QR, Online, Attendance HR-11, Login, WiFi, I18N Studio) + 30 module JS + SQLite 42 bảng.",
    "rule": "KHÔNG chứa mã nguồn SuperAdmin"
   },
   {
    "path": "modules/",
    "scope": "3 Plugin DLL động",
    "desc": "3 thư viện động có chữ ký ECDSA .sig v2: libmod_media_stream.dll (Jukebox/DSP/YouTube), libmod_network_qos.dll (WiFi/Router), libmod_card_payment.dll (SmartPOS ECR). (mod_pos_core & mod_finance_admin đã tắt từ ARCH-01).",
    "rule": "Bắt buộc có chữ ký .dll.sig v2 mới được nạp"
   },
   {
    "path": "launcher/",
    "scope": "4 Ứng dụng Windows GUI",
    "desc": "CyberNexus_Control_Center.exe (Slave & Master Tray App), CyberNexus_Setup_Stub.exe (Bộ cài 1-Click SOP-09), CyberNexus_Vault_Admin.exe (Cứu hộ mật khẩu nội bộ).",
    "rule": "Không dùng cửa sổ CMD đen hay file .bat"
   },
   {
    "path": "tools/ & scripts/",
    "scope": "Công cụ & Đóng gói",
    "desc": "Script ký module, tạo web_integrity.json, đóng gói bản vá OTA và đồng bộ từ điển i18n.",
    "rule": "Chạy khi build & phát hành"
   },
   {
    "path": "tests/ & .github/workflows/",
    "scope": "Kiểm thử & CI/CD",
    "desc": "verify_regression_v1.py (chữ ký .sig + node --check + OTA), test_api_e2e.py (chạy Slave thật test toàn luồng) và 3 workflow GitHub Actions (Windows MSVC + Linux GCC + Release).",
    "rule": "Tự động chạy khi push lên main"
   },
   {
    "path": "docs/",
    "scope": "Tài liệu sống (4 công cụ)",
    "desc": "13_BANG_THEO_DOI_KHUYET_TAT.html (5 Tab trọn gói), 19_SO_TAY_VAN_HANH_SLAVE.html, 20_SO_TAY_VAN_HANH_MASTER.html, 16_QUAN_TRI_NGON_NGU_I18N_STUDIO.html.",
    "rule": "100% đồng bộ từ mã nguồn thật v2.5.0"
   }
  ],
  "cmakeTargets": [
   {
    "target": "cybernexus_master.exe",
    "type": "Host Core (Master)",
    "sources": "shared/* + master/src/{main_master,master_handlers,master_license}.cpp",
    "libs": "ws2_32, crypt32, iphlpapi, winhttp, bcrypt",
    "role": "Máy chủ Super Admin SaaS (:8500) + CLI --sign-dll"
   },
   {
    "target": "cybernexus_slave.exe",
    "type": "Host Core (Slave)",
    "sources": "shared/* + slave/src/{main_slave,slave_handlers,slave_dot6_handlers,slave_license,slave_license_handlers}.cpp",
    "libs": "ws2_32, crypt32, iphlpapi, winhttp, bcrypt, winspool",
    "role": "Máy chủ POS/KDS/Admin tại quán (:8501), chạy Offline 100%"
   },
   {
    "target": "libmod_media_stream.dll",
    "type": "Plugin DLL #1",
    "sources": "modules/mod_media_stream/{mod_media_stream,yt_audio_helper}.cpp",
    "libs": "Ký ECDSA .sig v2",
    "role": "Media Server HTTP Range 206, 10-Band EQ, Jukebox & YouTube Offline"
   },
   {
    "target": "libmod_network_qos.dll",
    "type": "Plugin DLL #2",
    "sources": "modules/mod_network_qos/mod_network_qos.cpp",
    "libs": "Ký ECDSA .sig v2",
    "role": "WiFi Marketing Captive Portal & Router QoS (EdgeRouter/MikroTik)"
   },
   {
    "target": "libmod_card_payment.dll",
    "type": "Plugin DLL #3",
    "sources": "modules/mod_card_payment/mod_card_payment.cpp",
    "libs": "Ký ECDSA .sig v2",
    "role": "Cổng cà thẻ SmartPOS (ECR), handshake & kết toán lô"
   },
   {
    "target": "CyberNexus_Control_Center.exe",
    "type": "Windows GUI (Slave)",
    "sources": "launcher/CyberNexusControlCenter.cpp + shared/{db,auth,sqlite3}",
    "libs": "shell32, psapi, crypt32",
    "role": "Khay hệ thống điều khiển Slave, kiểm tra Port/Code/DLL & OTA 6 bước"
   },
   {
    "target": "CyberNexus_Control_Center.exe (Master)",
    "type": "Windows GUI (Master)",
    "sources": "launcher/CyberNexusControlCenter.cpp + master_app.rc",
    "libs": "shell32, psapi, crypt32",
    "role": "Khay hệ thống điều khiển Master (:8500)"
   },
   {
    "target": "CyberNexus_Setup_Stub.exe",
    "type": "Installer Stub",
    "sources": "launcher/CyberNexusSetupStub.cpp",
    "libs": "shell32, ole32, comctl32, gdi32",
    "role": "Bộ cài 1-Click tự giải nén SOP-09, tự mở Firewall & tạo Shortcut"
   },
   {
    "target": "CyberNexus_Vault_Admin.exe",
    "type": "Internal Rescue Tool",
    "sources": "launcher/CyberNexusVaultAdmin.cpp + shared/{db,auth}",
    "libs": "crypt32, shell32",
    "role": "Cứu hộ mật khẩu SuperAdmin, xem PIN quán & khôi phục DB (nội bộ)"
   }
  ],
  "layerLinks": [
   {
    "from": "Trình duyệt Quán (10 HTML)",
    "to": "30 Module JS (slave/web/assets/js)",
    "proto": "DOM / LocalStorage / WebAudio / BroadcastChannel",
    "detail": "index.html → pos.js + pos-jukebox.js; admin.html → admin.js + admin_media_dsp.js + admin_finance_ecr.js + admin_inventory.js + admin_ops_kpi.js; attendance.html → attendance_kiosk.js."
   },
   {
    "from": "30 Module JS (Slave)",
    "to": "Slave Host Core (:8501)",
    "proto": "REST JSON HTTP (78 routes / 154 actions)",
    "detail": "Gọi slave_handlers.cpp, slave_dot6_handlers.cpp, slave_license_handlers.cpp; xác thực Bearer Token / Cookie phiên."
   },
   {
    "from": "Slave Host Core (:8501)",
    "to": "3 Plugin DLL (slave/modules/*.dll)",
    "proto": "C-Linkage IModulePlugin + Event Bus",
    "detail": "PluginManager.cpp kiểm tra chữ ký ECDSA .dll.sig v2 rồi gọi LoadLibrary() và registerHttpRoutes() gắn trực tiếp các route /api/media/*, /api/wifi/*, /api/card/*."
   },
   {
    "from": "Slave Host Core (:8501)",
    "to": "store_local.db (SQLite 3 WAL)",
    "proto": "db.cpp (Thread-safe Mutex + Prepared Stmt)",
    "detail": "42 bảng SQLite lưu cục bộ 100% offline: orders, pos_shifts, attendances, materials, media_tracks, local_license_cache, audit_logs..."
   },
   {
    "from": "Slave (:8501) ↔ Master (:8500)",
    "to": "Kênh WAN Reverse Long-Polling",
    "proto": "HTTP/HTTPS Long-Polling + ECDSA P-256",
    "detail": "POST /api/license/verify (cấp quyền 18 modules), /api/license/poll + /ack (nhận lệnh OTA, Reset PIN, thông báo), /api/ai/proxy (Zero-Exposure AI), /api/billing/* (Self-Billing VietQR), /api/updates/* (tải patch OTA), /api/slave/backup (sao lưu DB)."
   },
   {
    "from": "Super Admin Web (3 HTML)",
    "to": "Master Host Core (:8500) → cybernexus_master.db",
    "proto": "REST JSON (42 routes / 79 actions) → 38 bảng SQLite",
    "detail": "super_admin.html → super_admin.js + super_admin_ext.js; theme_studio.html; i18n_studio.html → master_handlers.cpp → saas_tenants, saas_resellers, master_ai_keys, saas_invoices, saas_audit_logs."
   }
  ],
  "files": [
   {
    "path": "CMakeLists.txt",
    "folder": "(root)",
    "lang": "CMake",
    "lines": 155,
    "bytes": 5445,
    "role": "Cấu hình build CMake trung tâm: biên dịch 2 Host Core (Master/Slave), 3 Plugin DLL động và 4 ứng dụng Windows Launcher/Admin.",
    "symbols": [
     "cybernexus_master",
     "cybernexus_slave",
     "CyberNexus_Control_Center",
     "CyberNexus_Control_Center_Master",
     "CyberNexus_Setup_Stub",
     "CyberNexus_Vault_Admin"
    ],
    "deps": [
     "modules/mod_pos_core",
     "modules/mod_network_qos",
     "modules/mod_media_stream",
     "modules/mod_card_payment",
     "modules/mod_finance_admin"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "launcher/CyberNexusControlCenter.cpp",
    "folder": "launcher/",
    "lang": "C++",
    "lines": 1599,
    "bytes": 78401,
    "role": "Ứng dụng Desktop Windows GUI (System Tray): bật/tắt an toàn Master/Slave, kiểm tra Port/Code/DLL/SQLite, cập nhật OTA 6 bước, Live Console.",
    "symbols": [
     "array",
     "buildDllSigPayload",
     "copy",
     "copy_file",
     "create_directories",
     "directory_iterator",
     "exists",
     "find",
     "getline",
     "is_regular_file",
     "now",
     "parse"
    ],
    "deps": [
     "auth.hpp",
     "embedded_favicons.hpp",
     "httplib.h",
     "nlohmann/json.hpp",
     "pos_bcrypt.h",
     "sqlite3.h"
    ],
    "apis": [
     "/api/control/apply-update",
     "/api/control/auth-status",
     "/api/control/clear-logs",
     "/api/control/free-port",
     "/api/control/integrity",
     "/api/control/locales/",
     "/api/control/lock",
     "/api/control/login",
     "/api/control/open-kiosk",
     "/api/control/open-pin-file",
     "/api/control/ports",
     "/api/control/quit",
     "/api/control/restart",
     "/api/control/start",
     "/api/control/start-all"
    ],
    "tables": [
     "OTA",
     "SET",
     "app_notifications",
     "orders",
     "saas_settings",
     "store_settings",
     "users"
    ]
   },
   {
    "path": "launcher/CyberNexusSetupStub.cpp",
    "folder": "launcher/",
    "lang": "C++",
    "lines": 282,
    "bytes": 11674,
    "role": "Trình cài đặt 1-Click tự giải nén (Self-Extracting Setup Stub) dùng cho bộ cài SOP-09 bàn giao từng quán.",
    "symbols": [
     "create_directories",
     "exists",
     "memcmp",
     "path",
     "remove",
     "remove_all"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "launcher/CyberNexusVaultAdmin.cpp",
    "folder": "launcher/",
    "lang": "C++",
    "lines": 473,
    "bytes": 24154,
    "role": "Công cụ cứu hộ mật khẩu nội bộ bảo vệ bằng Master Recovery Key (reset SuperAdmin, xem PIN quán, cứu hộ DB).",
    "symbols": [
     "array",
     "decryptPinForLicense",
     "encryptPinForLicense",
     "exists",
     "generateRandomPin6",
     "getline",
     "hashPassword",
     "isValidPin6",
     "object",
     "parse",
     "path",
     "sha256"
    ],
    "deps": [
     "auth.hpp",
     "embedded_favicons.hpp",
     "httplib.h",
     "nlohmann/json.hpp",
     "pin_vault.hpp",
     "pos_bcrypt.h",
     "sqlite3.h"
    ],
    "apis": [
     "/api/vault/create-master-staff",
     "/api/vault/data",
     "/api/vault/quit",
     "/api/vault/reset-master",
     "/api/vault/reset-store-user",
     "/api/vault/status",
     "/api/vault/store-users",
     "/api/vault/tenant-pin",
     "/api/vault/unlock"
    ],
    "tables": [
     "SET",
     "saas_settings",
     "saas_staff_users",
     "saas_tenants",
     "users"
    ]
   },
   {
    "path": "launcher/icons/master_app.rc",
    "folder": "launcher/",
    "lang": "Windows RC",
    "lines": 1,
    "bytes": 33,
    "role": "Mã nguồn Windows RC thuộc phân hệ launcher/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "launcher/icons/store_app.rc",
    "folder": "launcher/",
    "lang": "Windows RC",
    "lines": 1,
    "bytes": 35,
    "role": "Mã nguồn Windows RC thuộc phân hệ launcher/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "launcher/icons/vault_app.rc",
    "folder": "launcher/",
    "lang": "Windows RC",
    "lines": 1,
    "bytes": 33,
    "role": "Mã nguồn Windows RC thuộc phân hệ launcher/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "master/src/main_master.cpp",
    "folder": "master/",
    "lang": "C++",
    "lines": 404,
    "bytes": 19528,
    "role": "Điểm khởi chạy Master Server (:8500), chế độ ký số DLL ngoại tuyến (--sign-dll ECDSA P-256), khởi tạo CSDL & route tĩnh.",
    "symbols": [
     "ThreadPool",
     "buildDllSigPayload",
     "create_directories",
     "exists",
     "file_size",
     "getPublicKeyFingerprint",
     "instance",
     "is_regular_file",
     "object",
     "parse",
     "path",
     "registerRoutes"
    ],
    "deps": [
     "ConfigManager.hpp",
     "auth.hpp",
     "db.hpp",
     "httplib.h",
     "license.hpp",
     "license_crypto.hpp",
     "master_handlers.hpp",
     "master_tunnel.h"
    ],
    "apis": [
     "/api/download_package",
     "/api/health"
    ],
    "tables": [
     "saas_pending_commands",
     "saas_reseller_wallet_logs",
     "saas_resellers",
     "saas_tenants"
    ]
   },
   {
    "path": "master/src/master_handlers.cpp",
    "folder": "master/",
    "lang": "C++",
    "lines": 5414,
    "bytes": 326833,
    "role": "Toàn bộ 33 HTTP route & 79 action quản trị Super Admin (Tenant, License, SOP-09, Đại lý, AI Vault, Billing, OTA, I18N, Backup).",
    "symbols": [
     "array",
     "buildCanonicalPayload",
     "buildCanonicalPayloadV2",
     "buildDishImagePrompt",
     "buildEmvCoPayload",
     "buildInvoiceOcrPromptAndSchema",
     "buildOfflineVietQrSvg",
     "copy",
     "copy_file",
     "create_directories",
     "current_path",
     "decryptPinForLicense"
    ],
    "deps": [
     "ConfigManager.hpp",
     "gemini_client.hpp",
     "license.hpp",
     "license_crypto.hpp",
     "master_handlers.hpp",
     "master_tunnel.h",
     "pin_vault.hpp",
     "pos_bcrypt.h",
     "rate_limiter.hpp",
     "sqlite3.h",
     "upload_guard.hpp",
     "vietqr_emvco.hpp"
    ],
    "apis": [
     "/api/admin/mysql_backup_config",
     "/api/admin/tenants/mysql_backup",
     "/api/ai/proxy",
     "/api/ai/quota",
     "/api/billing/confirm",
     "/api/billing/create_order",
     "/api/billing/orders",
     "/api/billing/status",
     "/api/billing/webhook",
     "/api/i18n/ai-translate",
     "/api/i18n/catalog",
     "/api/i18n/publish",
     "/api/i18n/save",
     "/api/license/ack",
     "/api/license/ping"
    ],
    "tables": [
     "SET",
     "Slave",
     "ai_usage_logs",
     "app_notifications",
     "attendances",
     "audit_logs",
     "card_transactions",
     "cash_transactions",
     "finance_expenses",
     "i18n_catalog",
     "kitchen_service_logs",
     "local_license_cache",
     "master_ai_key_history",
     "master_ai_keys",
     "master_settings"
    ]
   },
   {
    "path": "master/src/master_handlers.hpp",
    "folder": "master/",
    "lang": "C++ Header",
    "lines": 29,
    "bytes": 1010,
    "role": "Khai báo giao diện đăng ký các HTTP handler của Master Server.",
    "symbols": [
     "MasterHandlers"
    ],
    "deps": [
     "auth.hpp",
     "body_parser.hpp",
     "db.hpp",
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "master/src/master_license.cpp",
    "folder": "master/",
    "lang": "C++",
    "lines": 500,
    "bytes": 20459,
    "role": "Logic sinh/xác thực License Key CBNX, khóa phần cứng Machine ID và ký số chứng thư bản quyền phía Master.",
    "symbols": [
     "LicenseService",
     "activateLicense",
     "array",
     "computeRightsRevision",
     "difftime",
     "ensureTableExists",
     "find",
     "getCatalog",
     "getEnabledModules",
     "getHardwareFactors",
     "getLicenseStatus",
     "getMachineId"
    ],
    "deps": [
     "auth.hpp",
     "db.hpp",
     "license.hpp"
    ],
    "apis": [],
    "tables": [
     "saas_tenants"
    ]
   },
   {
    "path": "master/src/master_tunnel.h",
    "folder": "master/",
    "lang": "C/C++ Header",
    "lines": 373,
    "bytes": 13244,
    "role": "Bộ quản lý kênh WAN Reverse Long-Polling (StoreTunnelManager) đẩy lệnh OTA/Thông báo/Reset PIN xuống Slave.",
    "symbols": [
     "instance",
     "milliseconds",
     "move",
     "now",
     "object",
     "parse",
     "seconds",
     "to_string",
     "AckWaiter",
     "PingResult",
     "StoreTunnelManager",
     "StoreTunnelState"
    ],
    "deps": [
     "db.hpp",
     "nlohmann/json.hpp"
    ],
    "apis": [
     "/api/license/ack",
     "/api/license/poll"
    ],
    "tables": [
     "saas_pending_commands"
    ]
   },
   {
    "path": "master/web/assets/css/liquid-glass.css",
    "folder": "master/",
    "lang": "CSS",
    "lines": 1240,
    "bytes": 32590,
    "role": "Mã nguồn CSS thuộc phân hệ master/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": [
     "overriding"
    ]
   },
   {
    "path": "master/web/assets/css/super_admin.css",
    "folder": "master/",
    "lang": "CSS",
    "lines": 259,
    "bytes": 9422,
    "role": "Mã nguồn CSS thuộc phân hệ master/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "master/web/assets/css/theme.css",
    "folder": "master/",
    "lang": "CSS",
    "lines": 184,
    "bytes": 8685,
    "role": "Mã nguồn CSS thuộc phân hệ master/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "master/web/assets/js/i18n.js",
    "folder": "master/",
    "lang": "JavaScript",
    "lines": 485,
    "bytes": 21565,
    "role": "Module JavaScript giao diện Master (i18n.js).",
    "symbols": [
     "addEventListener",
     "apiMessage",
     "applyDom",
     "dbText",
     "deepGet",
     "detectInitialLang",
     "ensureLoaded",
     "findReverseTranslation",
     "forEach",
     "formatVars",
     "getElementDefaultText",
     "mergeDict"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "master/web/assets/js/image_processor.js",
    "folder": "master/",
    "lang": "JavaScript",
    "lines": 122,
    "bytes": 6934,
    "role": "Module JavaScript giao diện Master (image_processor.js).",
    "symbols": [
     "canvasToDataUrl",
     "decodeImage",
     "encodeCanvas",
     "fileFromBlob",
     "fileToDataUrl",
     "processCanvas",
     "processFile",
     "toBlob"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "master/web/assets/js/security_utils.js",
    "folder": "master/",
    "lang": "JavaScript",
    "lines": 95,
    "bytes": 2986,
    "role": "Module JavaScript giao diện Master (security_utils.js).",
    "symbols": [
     "escapeHtml",
     "escapeJsAttr",
     "logSilentError",
     "renderOfflineVietQr",
     "replace",
     "safeUrl"
    ],
    "deps": [],
    "apis": [
     "/api/payment/vietqr_svg"
    ],
    "tables": []
   },
   {
    "path": "master/web/assets/js/super_admin.js",
    "folder": "master/",
    "lang": "JavaScript",
    "lines": 4305,
    "bytes": 289610,
    "role": "Logic chính Super Admin: Dashboard, Cửa hàng, 18 Modules, Gia hạn, License, Gói cước, Thu phí, Cài đặt SaaS/VietQR.",
    "symbols": [
     "_escHtml",
     "activateGeminiKey",
     "activateOtaPatch",
     "activateTrial7d",
     "applyRoleViewEnforcement",
     "calculateExtendFee",
     "changePassword",
     "checkAllStoresOnline",
     "checkStoreOnline",
     "clearTenantLogo",
     "closeModal",
     "confirmSelfBillingOrder"
    ],
    "deps": [],
    "apis": [
     "/api/billing/confirm",
     "/api/billing/orders"
    ],
    "tables": [
     "navigation",
     "wallet"
    ]
   },
   {
    "path": "master/web/assets/js/super_admin_ext.js",
    "folder": "master/",
    "lang": "JavaScript",
    "lines": 1718,
    "bytes": 117101,
    "role": "Logic mở rộng Super Admin: Audit Trail, Đại lý & Ví ký quỹ, Master AI Vault, Kho bản vá OTA, Biểu mẫu Hợp đồng SOP-09.",
    "symbols": [
     "_escHtml",
     "activateGeminiKey",
     "activateOtaPatch",
     "activateTrial7d",
     "closeModal",
     "confirmTenantPayment",
     "copyResultKey",
     "deleteMasterGeminiKey",
     "deleteOtaPatch",
     "editReseller",
     "execTplCmd",
     "exportAuditCsv"
    ],
    "deps": [],
    "apis": [
     "/api/super_admin",
     "/api/updates/download"
    ],
    "tables": [
     "super_admin",
     "wallet"
    ]
   },
   {
    "path": "master/web/assets/js/super_admin_mysql_backup.js",
    "folder": "master/",
    "lang": "JavaScript",
    "lines": 170,
    "bytes": 14132,
    "role": "Giao diện Master điều khiển sao lưu & đồng bộ On-Demand SQLite -> MySQL theo từng quán (SYNC-01).",
    "symbols": [
     "esc",
     "openConsole",
     "saveConfig",
     "setLog",
     "syncStore",
     "testConfig",
     "toggleStore",
     "verifyStore"
    ],
    "deps": [],
    "apis": [
     "/api/admin/mysql_backup_config",
     "/api/admin/tenants/mysql_backup"
    ],
    "tables": []
   },
   {
    "path": "master/web/assets/js/theme.js",
    "folder": "master/",
    "lang": "JavaScript",
    "lines": 86,
    "bytes": 3783,
    "role": "Module JavaScript giao diện Master (theme.js).",
    "symbols": [
     "addEventListener",
     "apply",
     "createToggle",
     "forEach",
     "tTheme"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "master/web/i18n_studio.html",
    "folder": "master/",
    "lang": "HTML",
    "lines": 998,
    "bytes": 50797,
    "role": "Ứng dụng Quản trị Ngôn ngữ & AI Translation Studio phía Master.",
    "symbols": [
     "modal-body",
     "modal-save-btn",
     "modal-title"
    ],
    "deps": [
     "i18n_studio_data.js"
    ],
    "apis": [
     "/api/i18n/ai-translate",
     "/api/i18n/catalog",
     "/api/i18n/publish",
     "/api/i18n/save"
    ],
    "tables": []
   },
   {
    "path": "master/web/super_admin.html",
    "folder": "master/",
    "lang": "HTML",
    "lines": 2476,
    "bytes": 221000,
    "role": "Giao diện Trung Tâm Chỉ Huy Super Admin SaaS (10 tab quản trị, 5 vai trò bộ phận, 17 modal nghiệp vụ).",
    "symbols": [
     "modal-deposit-reseller-wallet",
     "modal-module-permissions",
     "modal-perm-code",
     "modal-perm-expire",
     "modal-perm-matrix-container",
     "modal-perm-plan",
     "modal-perm-store-name",
     "modal-print-invoice",
     "modal-push-update",
     "modal-quick-extend",
     "modal-reseller-form",
     "modal-reseller-issue-license",
     "modal-reseller-wallet-logs",
     "modal-staff-member",
     "modal-tenant-form"
    ],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/js/chart.min.js",
     "assets/vendor/fontawesome/css/all.min.css"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "master/web/theme_studio.html",
    "folder": "master/",
    "lang": "HTML",
    "lines": 460,
    "bytes": 30151,
    "role": "Ứng dụng Theme & Brand Studio tùy biến màu nhận diện Dual-Mode riêng cho từng quán.",
    "symbols": [],
    "deps": [
     "assets/vendor/fontawesome/css/all.min.css"
    ],
    "apis": [
     "/api/super_admin"
    ],
    "tables": []
   },
   {
    "path": "modules/mod_card_payment/CMakeLists.txt",
    "folder": "modules/",
    "lang": "CMake",
    "lines": 23,
    "bytes": 846,
    "role": "Tệp mã nguồn / cấu hình dự án.",
    "symbols": [
     "mod_card_payment"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "modules/mod_card_payment/mod_card_payment.cpp",
    "folder": "modules/",
    "lang": "C++",
    "lines": 1302,
    "bytes": 70299,
    "role": "Plugin DLL #3: Tích hợp máy cà thẻ SmartPOS (ECR), handshake, kết toán lô & quản lý phí thẻ.",
    "symbols": [
     "array",
     "getenv",
     "isdigit",
     "max",
     "min",
     "now",
     "object",
     "parse",
     "round",
     "snprintf",
     "stod",
     "strftime"
    ],
    "deps": [
     "IModulePlugin.hpp",
     "sqlite3.h"
    ],
    "apis": [
     "/api/card/charge",
     "/api/card/config",
     "/api/card/settle",
     "/api/card/status",
     "/api/card/test-connection",
     "/api/card/transactions",
     "/api/card/void"
    ],
    "tables": [
     "audit_logs",
     "card_terminal_catalog",
     "card_terminal_config",
     "card_transactions",
     "local_license_cache"
    ]
   },
   {
    "path": "modules/mod_finance_admin/CMakeLists.txt",
    "folder": "modules/",
    "lang": "CMake",
    "lines": 20,
    "bytes": 815,
    "role": "Thư mục DLL cũ đã tắt khỏi CMakeLists.txt (ARCH-01 — tính năng đã gộp vào Host Core).",
    "symbols": [
     "mod_finance_admin"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "modules/mod_finance_admin/mod_finance_admin.cpp",
    "folder": "modules/",
    "lang": "C++",
    "lines": 259,
    "bytes": 12473,
    "role": "Thư mục DLL cũ đã tắt khỏi CMakeLists.txt (ARCH-01 — tính năng đã gộp vào Host Core).",
    "symbols": [
     "array",
     "clamp",
     "max",
     "parse",
     "round",
     "string",
     "FinanceAdminPlugin"
    ],
    "deps": [
     "IModulePlugin.hpp"
    ],
    "apis": [
     "/api/finance/pnl-metrics",
     "/api/finance/summarize",
     "/api/hr/calculate-payroll",
     "/api/inventory/calc-receipt",
     "/api/security/mask-config"
    ],
    "tables": [
     "orders"
    ]
   },
   {
    "path": "modules/mod_media_stream/CMakeLists.txt",
    "folder": "modules/",
    "lang": "CMake",
    "lines": 24,
    "bytes": 876,
    "role": "Tệp mã nguồn / cấu hình dự án.",
    "symbols": [
     "mod_media_stream"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "modules/mod_media_stream/embedded_web_assets.hpp",
    "folder": "modules/",
    "lang": "C++ Header",
    "lines": 15,
    "bytes": 1312545,
    "role": "Mã nguồn C++ Header thuộc phân hệ modules/",
    "symbols": [
     "string"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "modules/mod_media_stream/mod_media_stream.cpp",
    "folder": "modules/",
    "lang": "C++",
    "lines": 891,
    "bytes": 50581,
    "role": "Plugin DLL #1: Streaming nhạc/video HTTP Range 206, HMAC-SHA256 Ticket, Jukebox Queue/Vote, 10-Band EQ & Lịch phát.",
    "symbols": [
     "array",
     "exists",
     "get_admin_media_dsp_js",
     "get_jukebox_engine_js",
     "get_pos_jukebox_js",
     "isspace",
     "max",
     "object",
     "parse",
     "snprintf",
     "stoi",
     "string"
    ],
    "deps": [
     "IModulePlugin.hpp",
     "sqlite3.h"
    ],
    "apis": [
     "/api/media/ducking",
     "/api/media/eq/apply",
     "/api/media/eq/presets",
     "/api/media/jukebox/bar_display",
     "/api/media/jukebox/remove",
     "/api/media/jukebox/request",
     "/api/media/jukebox/skip",
     "/api/media/jukebox/status",
     "/api/media/jukebox/vote",
     "/api/media/tracks"
    ],
    "tables": [
     "media_eq_presets",
     "media_jukebox_queue",
     "media_jukebox_votes",
     "media_time_schedules",
     "media_tracks",
     "signed",
     "store_settings",
     "tables_areas"
    ]
   },
   {
    "path": "modules/mod_media_stream/yt_audio_helper.cpp",
    "folder": "modules/",
    "lang": "C++",
    "lines": 1264,
    "bytes": 50338,
    "role": "Trợ lý tải/stream âm thanh YouTube Offline qua yt-dlp cho mod_media_stream.",
    "symbols": [
     "array",
     "copy_file",
     "create_directories",
     "current_path",
     "exists",
     "file_size",
     "hours",
     "is_regular_file",
     "min",
     "move",
     "now",
     "parse"
    ],
    "deps": [
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [
     "/api/media/stream-yt",
     "/api/media/youtube/add",
     "/api/media/youtube/download-offline",
     "/api/media/youtube/edit",
     "/api/media/youtube/job-status",
     "/api/media/youtube/preview",
     "/api/media/youtube/update-ytdlp"
    ],
    "tables": [
     "YouTube",
     "media_jukebox_queue",
     "media_tracks"
    ]
   },
   {
    "path": "modules/mod_network_qos/CMakeLists.txt",
    "folder": "modules/",
    "lang": "CMake",
    "lines": 20,
    "bytes": 797,
    "role": "Tệp mã nguồn / cấu hình dự án.",
    "symbols": [
     "mod_network_qos"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "modules/mod_network_qos/embedded_web_assets.hpp",
    "folder": "modules/",
    "lang": "C++ Header",
    "lines": 9,
    "bytes": 74531,
    "role": "Mã nguồn C++ Header thuộc phân hệ modules/",
    "symbols": [
     "string"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "modules/mod_network_qos/mod_network_qos.cpp",
    "folder": "modules/",
    "lang": "C++",
    "lines": 1658,
    "bytes": 87696,
    "role": "Plugin DLL #2: WiFi Marketing Portal, thu thập Leads và điều khiển Router QoS (EdgeRouter SSH / MikroTik).",
    "symbols": [
     "absolute",
     "array",
     "copy_file",
     "create_directories",
     "exists",
     "find",
     "get_wifi_portal_js",
     "getenv",
     "getline",
     "max",
     "now",
     "object"
    ],
    "deps": [
     "IModulePlugin.hpp"
    ],
    "apis": [
     "/api/auth/login",
     "/api/login",
     "/api/network/config",
     "/api/network/devices",
     "/api/network/isolation/apply",
     "/api/network/noc",
     "/api/network/qos/set",
     "/api/network/test-connection",
     "/api/network/whitelist",
     "/api/s/"
    ],
    "tables": [
     "signed"
    ]
   },
   {
    "path": "modules/mod_pos_core/CMakeLists.txt",
    "folder": "modules/",
    "lang": "CMake",
    "lines": 20,
    "bytes": 770,
    "role": "Thư mục DLL cũ đã tắt khỏi CMakeLists.txt (ARCH-01 — tính năng đã gộp vào Host Core).",
    "symbols": [
     "mod_pos_core"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "modules/mod_pos_core/mod_pos_core.cpp",
    "folder": "modules/",
    "lang": "C++",
    "lines": 159,
    "bytes": 7675,
    "role": "Thư mục DLL cũ đã tắt khỏi CMakeLists.txt (ARCH-01 — tính năng đã gộp vào Host Core).",
    "symbols": [
     "clamp",
     "max",
     "min",
     "parse",
     "round",
     "snprintf",
     "string",
     "to_string",
     "PosCorePlugin"
    ],
    "deps": [
     "IModulePlugin.hpp"
    ],
    "apis": [
     "/api/pos/calculate-cart",
     "/api/pos/orders/create",
     "/api/pos/tables",
     "/api/pos/vietqr-payload"
    ],
    "tables": [
     "orders"
    ]
   },
   {
    "path": "shared/include/ConfigManager.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 295,
    "bytes": 12280,
    "role": "Đọc config.json, tham số CLI (--port, --database, --web) và tự động phân giải đường dẫn chạy.",
    "symbols": [
     "canonical",
     "create_directories",
     "current_path",
     "exists",
     "getenv",
     "object",
     "parse",
     "path",
     "stoi",
     "AppConfig"
    ],
    "deps": [
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": [
     "build",
     "config",
     "exe"
    ]
   },
   {
    "path": "shared/include/IModulePlugin.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 86,
    "bytes": 3166,
    "role": "Giao diện chuẩn C++ (IModulePlugin, CoreContext, ModuleMetadata) cho mọi Plugin DLL động.",
    "symbols": [
     "CoreContext",
     "IModulePlugin",
     "ModuleMetadata"
    ],
    "deps": [
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/PluginManager.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 74,
    "bytes": 2468,
    "role": "Quản lý nạp/gỡ nóng DLL (LoadLibrary/dlopen), kiểm tra chữ ký .sig trước khi nạp vào RAM.",
    "symbols": [
     "LoadedPluginRecord",
     "PluginManager"
    ],
    "deps": [
     "IModulePlugin.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/auth.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 65,
    "bytes": 2133,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [
     "AuthService",
     "SessionUser"
    ],
    "deps": [
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": [
     "HTTP"
    ]
   },
   {
    "path": "shared/include/body_parser.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 48,
    "bytes": 1412,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [
     "object",
     "BodyParser"
    ],
    "deps": [
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": [
     "key",
     "query"
    ]
   },
   {
    "path": "shared/include/db.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 62,
    "bytes": 1717,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [
     "Database"
    ],
    "deps": [
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/embedded_favicons.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 3962,
    "bytes": 397559,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/gemini_client.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 856,
    "bytes": 37313,
    "role": "Client gọi Google Gemini API phục vụ AI Proxy, OCR hóa đơn, Tạo ảnh, Copilot & Dịch I18N.",
    "symbols": [
     "array",
     "find",
     "isdigit",
     "minutes",
     "now",
     "parse",
     "sort",
     "stable_sort",
     "stoi",
     "to_string",
     "CachedModels",
     "FoodImageCandidate"
    ],
    "deps": [],
    "apis": [
     "/api/whoami-v2"
    ],
    "tables": []
   },
   {
    "path": "shared/include/handlers.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 44,
    "bytes": 2221,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [
     "object",
     "ApiHandlers"
    ],
    "deps": [
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/license.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 70,
    "bytes": 2305,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [
     "LicenseService",
     "SaasModule"
    ],
    "deps": [
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/license_crypto.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 169,
    "bytes": 7241,
    "role": "Thư viện mật mã ECDSA P-256 SHA-256 (Windows CNG): ký & kiểm chứng chứng thư bản quyền và chữ ký .dll.sig v2.",
    "symbols": [
     "setfill",
     "setw",
     "sha256",
     "stoul",
     "to_string",
     "toupper"
    ],
    "deps": [
     "auth.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/pin_vault.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 84,
    "bytes": 3350,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [
     "all_of",
     "create_directories",
     "isdigit",
     "sha256",
     "snprintf",
     "sscanf",
     "to_string"
    ],
    "deps": [
     "auth.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/pos_bcrypt.h",
    "folder": "shared/",
    "lang": "C/C++ Header",
    "lines": 27,
    "bytes": 702,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/rate_limiter.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 215,
    "bytes": 8470,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [
     "all_of",
     "getline",
     "hours",
     "isdigit",
     "minutes",
     "now",
     "seconds",
     "stoi",
     "tolower",
     "transform",
     "FailState",
     "RateLimiter"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/upload_guard.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 288,
    "bytes": 12372,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [
     "create_directories",
     "isalnum",
     "tolower",
     "transform",
     "weakly_canonical",
     "UploadGuard",
     "UploadKind",
     "ValidatedUpload"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/include/vietqr_emvco.hpp",
    "folder": "shared/",
    "lang": "C++ Header",
    "lines": 165,
    "bytes": 6983,
    "role": "Header thư viện lõi dùng chung cho cả Master & Slave.",
    "symbols": [
     "all_of",
     "isalnum",
     "min",
     "snprintf",
     "string",
     "to_string",
     "toupper"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "EMVCo"
    ]
   },
   {
    "path": "shared/src/PluginManager.cpp",
    "folder": "shared/",
    "lang": "C++",
    "lines": 330,
    "bytes": 12864,
    "role": "Triển khai nạp DLL động, kiểm chứng chữ ký ECDSA .sig v2 và truyền CoreContext/Event Bus.",
    "symbols": [
     "array",
     "buildDllSigPayload",
     "create_directories",
     "directory_iterator",
     "dispatchEvent",
     "exists",
     "getModulesStatusMatrix",
     "instance",
     "is_directory",
     "loadPlugin",
     "now",
     "path"
    ],
    "deps": [
     "PluginManager.hpp",
     "license_crypto.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/src/auth.cpp",
    "folder": "shared/",
    "lang": "C++",
    "lines": 456,
    "bytes": 15368,
    "role": "Dịch vụ xác thực, băm mật khẩu bcrypt/SHA-256, sinh/xác thực token phiên và chống brute-force.",
    "symbols": [
     "AuthService",
     "activeSessionCount",
     "authenticate",
     "clearAllSessions",
     "createSession",
     "destroySession",
     "extractToken",
     "formatClearCookie",
     "formatCookie",
     "hasRole",
     "hashPassword",
     "instance"
    ],
    "deps": [
     "auth.hpp",
     "db.hpp",
     "pos_bcrypt.h"
    ],
    "apis": [],
    "tables": [
     "saas_settings",
     "user",
     "users"
    ]
   },
   {
    "path": "shared/src/body_parser.cpp",
    "folder": "shared/",
    "lang": "C++",
    "lines": 126,
    "bytes": 3332,
    "role": "Phân tích body HTTP (JSON, form-urlencoded, multipart/form-data upload file ảnh/nhạc/tài liệu).",
    "symbols": [
     "getAction",
     "getParam",
     "getline",
     "hasParam",
     "object",
     "parse",
     "parseBody",
     "parseFormUrlEncoded",
     "to_string",
     "urlDecode"
    ],
    "deps": [
     "body_parser.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/src/db.cpp",
    "folder": "shared/",
    "lang": "C++",
    "lines": 234,
    "bytes": 7579,
    "role": "Lớp bao SQLite3 (WAL mode, mutex thread-safe, prepared statements, query trả JSON).",
    "symbols": [
     "array",
     "beginTransaction",
     "bindParams",
     "close",
     "commit",
     "execute",
     "getLastError",
     "instance",
     "isOpen",
     "object",
     "open",
     "query"
    ],
    "deps": [
     "db.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "shared/src/pos_bcrypt.c",
    "folder": "shared/",
    "lang": "C",
    "lines": 628,
    "bytes": 23473,
    "role": "Tệp mã nguồn / cấu hình dự án.",
    "symbols": [
     "BlowfishContext"
    ],
    "deps": [
     "pos_bcrypt.h"
    ],
    "apis": [],
    "tables": [
     "raw"
    ]
   },
   {
    "path": "slave/src/hikvision_isapi.hpp",
    "folder": "slave/",
    "lang": "C++ Header",
    "lines": 365,
    "bytes": 15243,
    "role": "Tệp mã nguồn / cấu hình dự án.",
    "symbols": [
     "array",
     "extractAttr",
     "extractXmlTag",
     "makeCnonce",
     "md5Hex",
     "object",
     "parse",
     "setfill",
     "setw",
     "to_string",
     "transform",
     "IsapiClient"
    ],
    "deps": [
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": [
     "Hikvision"
    ]
   },
   {
    "path": "slave/src/main_slave.cpp",
    "folder": "slave/",
    "lang": "C++",
    "lines": 1288,
    "bytes": 72955,
    "role": "Điểm khởi chạy Slave Edge Server (:8501), kiểm tra toàn vẹn Web SHA-256, nạp 3 Plugin DLL, khởi chạy WAN Tunnel & Updater.",
    "symbols": [
     "array",
     "buildCanonicalPayload",
     "buildDllSigPayload",
     "create_directories",
     "directory_iterator",
     "exists",
     "formatClearCookie",
     "getenv",
     "getline",
     "instance",
     "isValidPin6",
     "json"
    ],
    "deps": [
     "ConfigManager.hpp",
     "PluginManager.hpp",
     "auth.hpp",
     "db.hpp",
     "httplib.h",
     "license.hpp",
     "pin_vault.hpp",
     "slave_handlers.hpp",
     "slave_net_info.h",
     "slave_tunnel.h",
     "slave_updater.h"
    ],
    "apis": [
     "/api/auth",
     "/api/card_payment/",
     "/api/categories",
     "/api/finance",
     "/api/health",
     "/api/license",
     "/api/license/ack",
     "/api/license/poll",
     "/api/media",
     "/api/media/",
     "/api/media/ducking",
     "/api/media/eq/apply",
     "/api/media/jukebox/remove",
     "/api/media/jukebox/skip",
     "/api/network/"
    ],
    "tables": [
     "SET",
     "audit_logs",
     "cash_transactions",
     "finance_expenses",
     "local_license_cache",
     "orders",
     "pos_shifts",
     "security_incidents",
     "sqlite_master",
     "store_settings",
     "users"
    ]
   },
   {
    "path": "slave/src/printer_bridge.hpp",
    "folder": "slave/",
    "lang": "C++ Header",
    "lines": 276,
    "bytes": 13052,
    "role": "Cầu nối in hóa đơn nhiệt ESC/POS qua TCP LAN / Windows Spooler và lệnh mở két tiền.",
    "symbols": [
     "abs",
     "max",
     "min",
     "reverse",
     "string",
     "to_string",
     "PrinterBridge"
    ],
    "deps": [
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/src/slave_dot6_handlers.cpp",
    "folder": "slave/",
    "lang": "C++",
    "lines": 2312,
    "bytes": 122813,
    "role": "Các API mở rộng Đợt 6–7: Bảng ca real-time HR-11 (/api/hr/*), Chấm công Hikvision, Chống spam QR, Thanh toán & In nhiệt.",
    "symbols": [
     "array",
     "bankIdToBin",
     "base64Decode",
     "buildCashDrawerPulse",
     "buildEmvCoPayload",
     "buildOfflineVietQrSvg",
     "buildReceiptEscPos",
     "create_directories",
     "ensureDot6Schema",
     "exists",
     "geminiGenerateContentText",
     "getOrCreateStoreSecret"
    ],
    "deps": [
     "ConfigManager.hpp",
     "auth.hpp",
     "body_parser.hpp",
     "gemini_client.hpp",
     "handlers.hpp",
     "hikvision_isapi.hpp",
     "license.hpp",
     "printer_bridge.hpp",
     "rate_limiter.hpp",
     "slave_dot6_handlers.hpp",
     "upload_guard.hpp",
     "vietqr_emvco.hpp"
    ],
    "apis": [
     "/api/attendance/hikvision/devices",
     "/api/attendance/hikvision/event",
     "/api/attendance/hikvision/poll",
     "/api/attendance/hikvision/sync-users",
     "/api/attendance/hikvision/test",
     "/api/hr/live-board",
     "/api/hr/shift-status",
     "/api/i18n/ai-translate",
     "/api/i18n/catalog",
     "/api/i18n/publish",
     "/api/i18n/save",
     "/api/payment/vietqr_payload",
     "/api/payment/vietqr_svg",
     "/api/printer/list",
     "/api/printer/open-drawer"
    ],
    "tables": [
     "SET",
     "attendance_devices",
     "attendance_raw_logs",
     "attendances",
     "audit_logs",
     "categories",
     "i18n_catalog",
     "local_license_cache",
     "order_items",
     "orders",
     "payment_transactions",
     "products",
     "promotions",
     "qr_blacklist",
     "shift_state_logs"
    ]
   },
   {
    "path": "slave/src/slave_dot6_handlers.hpp",
    "folder": "slave/",
    "lang": "C++ Header",
    "lines": 48,
    "bytes": 1840,
    "role": "Tệp mã nguồn / cấu hình dự án.",
    "symbols": [
     "Dot6Handlers"
    ],
    "deps": [
     "db.hpp",
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/src/slave_handlers.cpp",
    "folder": "slave/",
    "lang": "C++",
    "lines": 10999,
    "bytes": 609406,
    "role": "Các API nghiệp vụ cốt lõi Slave: Auth/Login/Owner QR, Đơn hàng, POS, Bàn, Thực đơn, Kho, Chấm công, Ca/Quỹ, Báo cáo, Cài đặt.",
    "symbols": [
     "abs",
     "all_of",
     "array",
     "bankIdToBin",
     "base64Decode",
     "buildDishImagePrompt",
     "buildEmvCoPayload",
     "buildInvoiceOcrPromptAndSchema",
     "copy_file",
     "create_directories",
     "directory_iterator",
     "encode_url"
    ],
    "deps": [
     "ConfigManager.hpp",
     "PluginManager.hpp",
     "auth.hpp",
     "body_parser.hpp",
     "db.hpp",
     "gemini_client.hpp",
     "handlers.hpp",
     "hikvision_isapi.hpp",
     "license.hpp",
     "pin_vault.hpp",
     "pos_bcrypt.h",
     "printer_bridge.hpp"
    ],
    "apis": [
     "/api/advertising",
     "/api/advertising.php",
     "/api/ai/copilot",
     "/api/ai/proxy",
     "/api/ai/quota",
     "/api/ai/test",
     "/api/auth",
     "/api/auth.php",
     "/api/categories",
     "/api/categories.php",
     "/api/cloud_backup",
     "/api/finance",
     "/api/finance.php",
     "/api/license",
     "/api/license.php"
    ],
    "tables": [
     "COGS",
     "Category",
     "Draft",
     "OPEX",
     "Product",
     "SET",
     "action",
     "ad_slides",
     "app_notifications",
     "attendances",
     "audit_logs",
     "cash_transactions",
     "categories",
     "customers",
     "dates"
    ]
   },
   {
    "path": "slave/src/slave_handlers.hpp",
    "folder": "slave/",
    "lang": "C++ Header",
    "lines": 42,
    "bytes": 1901,
    "role": "Tệp mã nguồn / cấu hình dự án.",
    "symbols": [
     "ApiHandlers"
    ],
    "deps": [
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/src/slave_license.cpp",
    "folder": "slave/",
    "lang": "C++",
    "lines": 1012,
    "bytes": 49170,
    "role": "Xác thực chữ ký ECDSA P-256 cục bộ, khóa Hardware ID, chống sửa bảng local_license_cache và chống lùi đồng hồ.",
    "symbols": [
     "LicenseService",
     "activateLicense",
     "array",
     "buildCanonicalPayload",
     "buildCanonicalPayloadV2",
     "computeRightsRevision",
     "difftime",
     "ensureTableExists",
     "find",
     "getCatalog",
     "getEnabledModules",
     "getHardwareFactors"
    ],
    "deps": [
     "ConfigManager.hpp",
     "auth.hpp",
     "db.hpp",
     "httplib.h",
     "license.hpp",
     "license_crypto.hpp"
    ],
    "apis": [
     "/api/license/verify"
    ],
    "tables": [
     "SET",
     "local",
     "local_license_cache",
     "store_settings"
    ]
   },
   {
    "path": "slave/src/slave_license_handlers.cpp",
    "folder": "slave/",
    "lang": "C++",
    "lines": 196,
    "bytes": 9155,
    "role": "API kích hoạt/đồng bộ bản quyền, kiểm soát bật/chặn 18 modules và Self-Billing VietQR phía Slave.",
    "symbols": [
     "encode_url",
     "getParam",
     "handleLicense",
     "handleLicenseClient",
     "instance",
     "now",
     "object",
     "parse",
     "string",
     "thread",
     "time"
    ],
    "deps": [
     "ConfigManager.hpp",
     "auth.hpp",
     "body_parser.hpp",
     "db.hpp",
     "handlers.hpp",
     "license.hpp"
    ],
    "apis": [
     "/api/billing/create_order"
    ],
    "tables": [
     "local_license_cache"
    ]
   },
   {
    "path": "slave/src/slave_net_info.h",
    "folder": "slave/",
    "lang": "C/C++ Header",
    "lines": 186,
    "bytes": 7419,
    "role": "Quét card mạng LAN/IP vật lý máy chủ quán phục vụ sinh mã QR bàn chính xác.",
    "symbols": [
     "instance",
     "parse",
     "stod",
     "time",
     "to_string",
     "SlaveNetInfoService",
     "StoreNetGeoInfo"
    ],
    "deps": [
     "db.hpp",
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": [
     "store_settings"
    ]
   },
   {
    "path": "slave/src/slave_tunnel.h",
    "folder": "slave/",
    "lang": "C/C++ Header",
    "lines": 120,
    "bytes": 3147,
    "role": "Client Reverse Long-Polling duy trì kết nối WAN tới Master nhận lệnh OTA, Reset PIN, thông báo tức thì.",
    "symbols": [
     "put_time",
     "time",
     "SlaveTunnelStatus"
    ],
    "deps": [
     "nlohmann/json.hpp"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/src/slave_updater.h",
    "folder": "slave/",
    "lang": "C/C++ Header",
    "lines": 463,
    "bytes": 22674,
    "role": "Cơ chế tải, kiểm chứng SHA-256, giải nén và cập nhật OTA an toàn cho Slave.",
    "symbols": [
     "array",
     "copy_file",
     "create_directories",
     "exists",
     "exit",
     "instance",
     "milliseconds",
     "parse",
     "recursive_directory_iterator",
     "relative",
     "remove_all",
     "sha256"
    ],
    "deps": [
     "ConfigManager.hpp",
     "auth.hpp",
     "db.hpp",
     "httplib.h",
     "nlohmann/json.hpp"
    ],
    "apis": [
     "/api/health",
     "/api/updates/download",
     "/api/updates/latest"
    ],
    "tables": [
     "OTA",
     "SET",
     "app_notifications",
     "orders",
     "store_settings"
    ]
   },
   {
    "path": "slave/web/admin.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 5362,
    "bytes": 508772,
    "role": "Màn hình Quản trị Chủ quán: 4 nhóm / 11 tab (Dashboard, Bàn, Hóa đơn, Mặt hàng, Nhóm, Kho/Công/Lương/KPI, Nhân sự, Hiệu suất, Kế toán, Media, Cài đặt).",
    "symbols": [
     "modal-cat-icon",
     "modal-cat-id",
     "modal-cat-name",
     "modal-cat-order",
     "modal-edit-attendance",
     "modal-edit-salary",
     "modal-fin-expense",
     "modal-fin-tax",
     "modal-kpi",
     "modal-mat-category",
     "modal-mat-code",
     "modal-mat-cost",
     "modal-mat-id",
     "modal-mat-minqty",
     "modal-mat-name"
    ],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/images/dishes/default_dish.jpg",
     "assets/images/dishes/dish_1793448692_5cbbfa81.jpg",
     "assets/js/chart.min.js",
     "assets/js/store_brand.js",
     "assets/vendor/fontawesome/css/all.min.css",
     "assets/vendor/qrcode.min.js"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/css/admin.css",
    "folder": "slave/",
    "lang": "CSS",
    "lines": 474,
    "bytes": 15933,
    "role": "Mã nguồn CSS thuộc phân hệ slave/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": [
     "liquid"
    ]
   },
   {
    "path": "slave/web/assets/css/customer.css",
    "folder": "slave/",
    "lang": "CSS",
    "lines": 156,
    "bytes": 4861,
    "role": "Mã nguồn CSS thuộc phân hệ slave/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/css/liquid-glass.css",
    "folder": "slave/",
    "lang": "CSS",
    "lines": 1313,
    "bytes": 34322,
    "role": "Mã nguồn CSS thuộc phân hệ slave/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": [
     "overriding"
    ]
   },
   {
    "path": "slave/web/assets/css/login.css",
    "folder": "slave/",
    "lang": "CSS",
    "lines": 218,
    "bytes": 5312,
    "role": "Mã nguồn CSS thuộc phân hệ slave/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/css/online_orders.css",
    "folder": "slave/",
    "lang": "CSS",
    "lines": 118,
    "bytes": 3859,
    "role": "Mã nguồn CSS thuộc phân hệ slave/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/css/theme.css",
    "folder": "slave/",
    "lang": "CSS",
    "lines": 184,
    "bytes": 8685,
    "role": "Mã nguồn CSS thuộc phân hệ slave/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/css/wifi_portal.css",
    "folder": "slave/",
    "lang": "CSS",
    "lines": 560,
    "bytes": 13637,
    "role": "Mã nguồn CSS thuộc phân hệ slave/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/admin.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 2787,
    "bytes": 149017,
    "role": "Bộ máy điều hướng 11 tab Quản trị Chủ quán, Dashboard, Bàn QR, Hóa đơn, Sản phẩm & Danh mục.",
    "symbols": [
     "addRecipeRow",
     "addTable",
     "adjustZoom",
     "aiGenerateDishImage",
     "analyzeMenuStyleDNA",
     "applySmartDishCandidate",
     "autoCenterFit",
     "autoCropAndSaveNow",
     "batchAiAssignImages",
     "bindNavigation",
     "clearOrderHistoryPreset",
     "close"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "Header",
     "Media",
     "Stats",
     "backend",
     "breadcrumb",
     "live"
    ]
   },
   {
    "path": "slave/web/assets/js/admin_bom_studio.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 517,
    "bytes": 36094,
    "role": "BOM Studio tập trung (INV-01): thiết lập định mức theo đơn vị gốc ml/g/cái, nhân bản công thức, nhập quy đổi 1.5L/1L -> ml, xuất hủy & kiểm kê hao hụt.",
    "symbols": [
     "addEditorRow",
     "cloneFromSelected",
     "esc",
     "fmt",
     "onSearch",
     "openBomStudio",
     "openSmartUomImportModal",
     "openWasteStocktakeModal",
     "recalcLiveCost",
     "reloadData",
     "renderMatrix",
     "saveCurrentBom"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/admin_finance_ecr.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 1626,
    "bytes": 123738,
    "role": "Kế toán ca, Audit chống thất thoát, P&L 3 tháng, Cấu hình VietQR, SmartPOS ECR, AI & Telegram.",
    "symbols": [
     "applySubviewLicenseLock",
     "applySystemUpdate",
     "deleteFinanceExpense",
     "deleteLocalGeminiKey",
     "deletePromotion",
     "dismissSystemUpdate",
     "enforceModuleLicenses",
     "exportFinanceCsv",
     "filterAuditLogs",
     "forEach",
     "handleAdminBadgeUpdateClick",
     "isModuleAllowed"
    ],
    "deps": [],
    "apis": [
     "/api/ai/test",
     "/api/card/config",
     "/api/card/settle",
     "/api/card/status",
     "/api/card/test-connection",
     "/api/card/void",
     "/api/system/updates"
    ],
    "tables": [
     "License",
     "admin"
    ]
   },
   {
    "path": "slave/web/assets/js/admin_inline_ext.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 1216,
    "bytes": 74243,
    "role": "Module JavaScript giao diện Slave (admin_inline_ext.js).",
    "symbols": [
     "adManagerAlert",
     "aiGenerateAdvertisingSlide",
     "applySlidePreset",
     "cancelEditAdvertisingSlide",
     "closeAdPreviewModal",
     "closeBankPickerModal",
     "copyLiveServerUrl",
     "detectServerNetwork",
     "editAdvertisingSlide",
     "filterBankList",
     "formatPreviewSlideLabel",
     "handleAdminLogout"
    ],
    "deps": [],
    "apis": [
     "/api/system/control"
    ],
    "tables": [
     "live",
     "server"
    ]
   },
   {
    "path": "slave/web/assets/js/admin_inventory.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 2231,
    "bytes": 137201,
    "role": "Quản lý kho nguyên vật liệu, Nhập kho thông minh 3 cách (Camera/OCR/Tay) & Công nợ nhà cung cấp.",
    "symbols": [
     "_escInvHtml",
     "_hrNotify",
     "_normalizeAttTs",
     "_payrollFilterParams",
     "_splitStaffNameAndDept",
     "addManualImportRow",
     "addReviewRow",
     "applyAttendanceFilter",
     "attendancePage",
     "calcManualImportTotal",
     "calcReviewTotals",
     "calcTransTotal"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "admin",
     "tab"
    ]
   },
   {
    "path": "slave/web/assets/js/admin_media_dsp.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 1796,
    "bytes": 100464,
    "role": "Studio Âm thanh 10-Band DSP Equalizer, Audio Ducking, Kho nhạc, YouTube Offline/yt-dlp & Lịch phát tự động.",
    "symbols": [
     "addMediaSchedule",
     "applyBatchGenre",
     "applyEqChanges",
     "autoClassifyMediaTracks",
     "clearUploadQueue",
     "closeConfirmDialog",
     "closeUploadMediaModal",
     "closeYoutubeImportModal",
     "deleteMediaSchedule",
     "deleteMediaTrack",
     "editYoutubeTrack",
     "filterMediaCatalog"
    ],
    "deps": [],
    "apis": [
     "/api/media/eq/apply",
     "/api/media/eq/presets",
     "/api/media/jukebox/remove",
     "/api/media/jukebox/request",
     "/api/media/jukebox/skip",
     "/api/media/jukebox/status",
     "/api/media/jukebox/vote",
     "/api/media/schedules",
     "/api/media/schedules/delete",
     "/api/media/schedules/save",
     "/api/media/schedules/toggle_master",
     "/api/media/tracks",
     "/api/media/tracks/auto_classify",
     "/api/media/tracks/rescan",
     "/api/media/tracks/upload"
    ],
    "tables": [
     "admin"
    ]
   },
   {
    "path": "slave/web/assets/js/admin_ops_kpi.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 2358,
    "bytes": 162149,
    "role": "Cấu hình SLA cao/thấp điểm, bảng điểm KPI, chấm công/lương & hiệu suất bếp-phục vụ.",
    "symbols": [
     "_applyReceiptStudioControls",
     "_callHikAction",
     "_collectReceiptStudioConfig",
     "addSlaSlot",
     "applyGuestLanIsolation",
     "askAiCopilot",
     "assign",
     "closeBillingModal",
     "closeCloudSyncModal",
     "closeMaterialModal",
     "createStoreBillingOrder",
     "deleteHikvisionDevice"
    ],
    "deps": [],
    "apis": [
     "/api/ai/copilot",
     "/api/attendance/hikvision/devices",
     "/api/attendance/hikvision/poll",
     "/api/attendance/hikvision/sync-users",
     "/api/attendance/hikvision/test",
     "/api/network/config",
     "/api/network/devices",
     "/api/network/isolation/apply",
     "/api/network/noc",
     "/api/network/qos/set",
     "/api/network/test-connection",
     "/api/network/whitelist",
     "/api/printer/list",
     "/api/printer/print-receipt",
     "/api/telegram/test"
    ],
    "tables": [
     "KPI",
     "admin",
     "sub"
    ]
   },
   {
    "path": "slave/web/assets/js/attendance_kiosk.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 454,
    "bytes": 28185,
    "role": "Logic Bảng ca real-time (polling 5s), chuyển trạng thái ca, Web Check-in/out & Kiosk PIN + Selfie.",
    "symbols": [
     "adminForceStatus",
     "appendPin",
     "authHeaders",
     "captureSelfieBase64",
     "clearPin",
     "init",
     "loadLiveBoard",
     "loadPersonalStatus",
     "personalLogin",
     "personalLogout",
     "promptDelivery",
     "promptEarlyLeave"
    ],
    "deps": [],
    "apis": [
     "/api/hr/live-board",
     "/api/hr/shift-status"
    ],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/cn_station_nav.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 240,
    "bytes": 11708,
    "role": "Module điều hướng chuyển trạm dùng chung cho toàn bộ 6 trang Slave (UI-04): 1 thứ tự cố định, lọc tự động theo role & license.",
    "symbols": [
     "autoMountAll",
     "ensureMobileNavControls",
     "getCurrentPath",
     "openMobileDrawer",
     "renderStationNav"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/customer_app.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 2047,
    "bytes": 116978,
    "role": "Module JavaScript giao diện Slave (customer_app.js).",
    "symbols": [
     "activateTableWifiVip",
     "addItem",
     "applyCatalogI18nDom",
     "applyCustomerPromo",
     "applyFilters",
     "bindSlides",
     "bounceCartButton",
     "callService",
     "changeQty",
     "checkOrderStatus",
     "close",
     "closeCart"
    ],
    "deps": [],
    "apis": [
     "/api/media/jukebox/request",
     "/api/media/jukebox/status",
     "/api/media/jukebox/vote",
     "/api/wifi/unlock",
     "/api/wifi/vip_status"
    ],
    "tables": [
     "API",
     "indicators",
     "verified"
    ]
   },
   {
    "path": "slave/web/assets/js/date_format_ddmmyy.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 162,
    "bytes": 6051,
    "role": "Module JavaScript giao diện Slave (date_format_ddmmyy.js).",
    "symbols": [
     "enhanceDateInput",
     "formatDateDDMMYY",
     "injectStyles",
     "scanAndEnhance",
     "syncAll",
     "syncInput"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/i18n.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 494,
    "bytes": 21966,
    "role": "Module JavaScript giao diện Slave (i18n.js).",
    "symbols": [
     "addEventListener",
     "apiMessage",
     "applyDom",
     "dbText",
     "deepGet",
     "detectInitialLang",
     "ensureLoaded",
     "findReverseTranslation",
     "forEach",
     "formatVars",
     "getElementDefaultText",
     "mergeDict"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/image_processor.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 122,
    "bytes": 6934,
    "role": "Module JavaScript giao diện Slave (image_processor.js).",
    "symbols": [
     "canvasToDataUrl",
     "decodeImage",
     "encodeCanvas",
     "fileFromBlob",
     "fileToDataUrl",
     "processCanvas",
     "processFile",
     "toBlob"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/jukebox-engine.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 784,
    "bytes": 32594,
    "role": "Audio Engine đa tab Web Audio API + BroadcastChannel + Leader Election chống phát chồng 2 loa.",
    "symbols": [
     "_applyStatus",
     "_autoResumePlayback",
     "_broadcast",
     "_claimLeadership",
     "_handleChannelMessage",
     "_injectMarqueeStyles",
     "_notifyListeners",
     "_resumeLocalAudio",
     "_setupAudioEvents",
     "_setupCrossTabChannel",
     "_setupLeaderElection",
     "_setupWebAudio"
    ],
    "deps": [],
    "apis": [
     "/api/media/eq/presets",
     "/api/media/jukebox/remove",
     "/api/media/jukebox/request",
     "/api/media/jukebox/skip",
     "/api/media/jukebox/status",
     "/api/media/jukebox/vote"
    ],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/kitchen_kds.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 920,
    "bytes": 60749,
    "role": "Module JavaScript giao diện Slave (kitchen_kds.js).",
    "symbols": [
     "archiveKitchenTicket",
     "closeKitchenActionModal",
     "closeLanQrModal",
     "closeLockedDishesModal",
     "copyCustomerUrl",
     "filterLockedDishesModal",
     "getCustomerMenuUrl",
     "handleLogout",
     "kitchenCancelOrder",
     "loadAllDishesForModal",
     "loadKitchenOrders",
     "markKitchenReady"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "counts",
     "settings"
    ]
   },
   {
    "path": "slave/web/assets/js/license_ping.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 142,
    "bytes": 10187,
    "role": "Module JavaScript giao diện Slave (license_ping.js).",
    "symbols": [
     "addEventListener",
     "ping",
     "renderGraceBanner",
     "renderLockModal",
     "runPing",
     "showChanged"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/online_orders.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 344,
    "bytes": 28648,
    "role": "Module JavaScript giao diện Slave (online_orders.js).",
    "symbols": [
     "approveCod",
     "cancelOrder",
     "closePayment",
     "confirmDelivery",
     "confirmPayment",
     "escape",
     "load",
     "money",
     "openPayment",
     "render",
     "selectPaymentMethod",
     "sendToKitchen"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "orders"
    ]
   },
   {
    "path": "slave/web/assets/js/online_orders_page.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 32,
    "bytes": 2399,
    "role": "Module JavaScript giao diện Slave (online_orders_page.js).",
    "symbols": [
     "handleOnlineLogout",
     "renderOnlineBackLinks"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/order_waiter.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 1513,
    "bytes": 86529,
    "role": "Module JavaScript giao diện Slave (order_waiter.js).",
    "symbols": [
     "ackKitchenCancellation",
     "ackWaiterAlert",
     "activateMobileAudio",
     "addEventListener",
     "addItemToCart",
     "addNoteToConfirmedItem",
     "addNoteToItem",
     "adjustGuestCount",
     "backToTablesView",
     "changeQty",
     "closeCartBottomSheet",
     "closeLanQrModal"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "error",
     "locked",
     "newCartItems",
     "settings"
    ]
   },
   {
    "path": "slave/web/assets/js/pos-jukebox.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 1281,
    "bytes": 85572,
    "role": "Jukebox Mini tích hợp ngay trên thanh tiêu đề & modal màn hình POS Thu ngân.",
    "symbols": [
     "_createModalDOM",
     "applyFlatEq",
     "applyPresetValues",
     "applyQuickTone",
     "applyScheduleGenre",
     "checkMediaLicense",
     "closeModal",
     "filterCatalog",
     "handleFileUpload",
     "init",
     "loadCatalog",
     "loadEqPresets"
    ],
    "deps": [],
    "apis": [
     "/api/media/eq/apply",
     "/api/media/eq/presets",
     "/api/media/schedules",
     "/api/media/tracks",
     "/api/media/tracks/rescan",
     "/api/media/tracks/upload"
    ],
    "tables": [
     "queue"
    ]
   },
   {
    "path": "slave/web/assets/js/pos.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 2715,
    "bytes": 169883,
    "role": "Bộ máy POS Thu ngân (giỏ hàng, tính tiền, thanh toán, chia/gộp bàn, giao ca, in bill 80mm).",
    "symbols": [
     "ackCancelAlert",
     "ackPosAlert",
     "addToCart",
     "applyDiscount",
     "applyPromoCodeInModal",
     "applyToppings",
     "bindEvents",
     "calcChange",
     "calcSplitSummary",
     "cancelOrder",
     "checkVietQrLicense",
     "closeVietQrModal"
    ],
    "deps": [],
    "apis": [
     "/api/card/charge",
     "/api/card/status"
    ],
    "tables": [
     "header"
    ]
   },
   {
    "path": "slave/web/assets/js/pos_shift_reports.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 1060,
    "bytes": 73225,
    "role": "Module JavaScript giao diện Slave (pos_shift_reports.js).",
    "symbols": [
     "clearReprintSearch",
     "closeReceiptModal",
     "closeReprintModal",
     "closeRevenueStatsModal",
     "forEach",
     "generateReceiptHtml",
     "handleReprintSearchKeyup",
     "loadReprintOrders",
     "loadRevenueStats",
     "map",
     "openReprintModal",
     "openRevenueStatsModal"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "pos"
    ]
   },
   {
    "path": "slave/web/assets/js/receipt_template.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 405,
    "bytes": 21128,
    "role": "Module JavaScript giao diện Slave (receipt_template.js).",
    "symbols": [
     "esc",
     "fmtMoney",
     "getConfig",
     "getLabel",
     "normalizeConfig",
     "openNoSaleDrawerModal",
     "printHtmlInIframe",
     "printViaBridgeOrBrowser",
     "renderHtml"
    ],
    "deps": [],
    "apis": [
     "/api/printer/open-drawer",
     "/api/printer/print-receipt"
    ],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/security_utils.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 225,
    "bytes": 8967,
    "role": "Module JavaScript giao diện Slave (security_utils.js).",
    "symbols": [
     "_open",
     "addEventListener",
     "enqueue",
     "escapeHtml",
     "escapeJsAttr",
     "flush",
     "list",
     "logSilentError",
     "renderOfflineVietQr",
     "replace",
     "safeUrl",
     "syncServerSession"
    ],
    "deps": [],
    "apis": [
     "/api/auth",
     "/api/payment/vietqr_svg"
    ],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/store_brand.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 279,
    "bytes": 16350,
    "role": "Module JavaScript giao diện Slave (store_brand.js).",
    "symbols": [
     "applyStoreBrand",
     "applyStoreTheme",
     "loadStoreBrand",
     "openCnxDialog",
     "showInPageNotice"
    ],
    "deps": [],
    "apis": [
     "/api/settings.php"
    ],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/theme.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 99,
    "bytes": 4219,
    "role": "Module JavaScript giao diện Slave (theme.js).",
    "symbols": [
     "addEventListener",
     "apply",
     "createToggle",
     "forEach",
     "tTheme"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/virtual-keyboard.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 131,
    "bytes": 6156,
    "role": "Module JavaScript giao diện Slave (virtual-keyboard.js).",
    "symbols": [
     "backspace",
     "bindEvents",
     "clear",
     "close",
     "confirm",
     "createNumpadModal",
     "init",
     "press"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/assets/js/wifi_portal.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 252,
    "bytes": 12368,
    "role": "Module JavaScript giao diện Slave (wifi_portal.js).",
    "symbols": [
     "_wtx",
     "addEventListener",
     "applyWifiTheme",
     "formatVipDuration",
     "initWifiTheme",
     "launchCelebrationConfetti",
     "loadPortalInfo",
     "preventInitialMobileKeyboard",
     "renderSlide",
     "renderSlideDots",
     "switchWifiTab",
     "toggleWifiTheme"
    ],
    "deps": [],
    "apis": [
     "/api/wifi/portal_info",
     "/api/wifi/unlock"
    ],
    "tables": []
   },
   {
    "path": "slave/web/attendance.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 201,
    "bytes": 16906,
    "role": "Cổng Chấm công & Theo dõi Ca Real-time (HR-11): 8 trạng thái trực, chấm công Web cá nhân, Kiosk PIN 6 số + Selfie.",
    "symbols": [],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/js/store_brand.js",
     "assets/vendor/fontawesome/css/all.min.css"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/customer-sw.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 23,
    "bytes": 771,
    "role": "Mã nguồn JavaScript thuộc phân hệ slave/",
    "symbols": [
     "addEventListener",
     "all",
     "forEach",
     "then"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/customer.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 758,
    "bytes": 67959,
    "role": "Màn hình Khách hàng quét QR: thực đơn điện tử, đặt món, VietQR động, theo dõi tiến độ, đánh giá sao, Jukebox chọn bài.",
    "symbols": [
     "tab-btn-juke-queue",
     "tab-btn-juke-tracks"
    ],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/css/liquid-glass.css",
     "assets/images/dishes/bm005_mi_goi_bo.jpg",
     "assets/images/dishes/bm008.jpg",
     "assets/images/dishes/bm009.jpg",
     "assets/images/dishes/bm010.jpg",
     "assets/images/dishes/bm011.jpg",
     "assets/images/dishes/bm012.jpg",
     "assets/images/dishes/cf003.jpg",
     "assets/images/dishes/dish_1793438761_26c1602f.jpg",
     "assets/images/dishes/dish_1793438866_74ff69e5.jpg",
     "assets/images/dishes/dish_1793439034_158d1f7c.jpg"
    ],
    "apis": [
     "/api/payment/vietqr_svg"
    ],
    "tables": []
   },
   {
    "path": "slave/web/i18n_studio.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 998,
    "bytes": 50797,
    "role": "Ứng dụng I18N Studio chỉnh sửa/dịch AI/xuất bản đa ngôn ngữ ngay tại Slave.",
    "symbols": [
     "modal-body",
     "modal-save-btn",
     "modal-title"
    ],
    "deps": [
     "i18n_studio_data.js"
    ],
    "apis": [
     "/api/i18n/ai-translate",
     "/api/i18n/catalog",
     "/api/i18n/publish",
     "/api/i18n/save"
    ],
    "tables": []
   },
   {
    "path": "slave/web/index.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 923,
    "bytes": 66140,
    "role": "Màn hình POS Thu ngân: bán hàng, tách/gộp bàn, thanh toán 3 yếu tố, giao ca/sổ quỹ, Jukebox mini.",
    "symbols": [],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/js/store_brand.js",
     "assets/js/virtual-keyboard.js",
     "assets/vendor/fontawesome/css/all.min.css",
     "assets/vendor/qrcode.min.js"
    ],
    "apis": [],
    "tables": [
     "settings",
     "sleep"
    ]
   },
   {
    "path": "slave/web/kitchen.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 292,
    "bytes": 20950,
    "role": "Màn hình Bếp & Pha chế (KDS): phiếu chế biến real-time, báo xong, báo hết món (86), nhắc phục vụ.",
    "symbols": [
     "modal-manage-locked-dishes",
     "tab-filter-active",
     "tab-filter-all",
     "tab-filter-history",
     "tab-filter-served"
    ],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/js/store_brand.js",
     "assets/vendor/fontawesome/css/all.min.css",
     "assets/vendor/qrcode.min.js"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/login.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 519,
    "bytes": 32141,
    "role": "Cổng Đăng nhập duy nhất (Tài khoản/Mật khẩu, PIN, Owner QR) & Host Control.",
    "symbols": [
     "tab-btn-pass",
     "tab-btn-pin",
     "tab-pane-pass",
     "tab-pane-pin"
    ],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/js/store_brand.js",
     "assets/vendor/fontawesome/css/all.min.css"
    ],
    "apis": [
     "/api/system/control"
    ],
    "tables": []
   },
   {
    "path": "slave/web/online_orders.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 232,
    "bytes": 17950,
    "role": "Màn hình Đơn Online / Mang về: cổng xác nhận thanh toán / COD trước khi chuyển Bếp.",
    "symbols": [],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/css/liquid-glass.css",
     "assets/js/store_brand.js",
     "assets/vendor/fontawesome/css/all.min.css"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/order.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 495,
    "bytes": 36308,
    "role": "Màn hình Order Phục vụ (Mobile/Tablet): gọi món tại bàn, duyệt đơn QR, hối bếp, xác nhận đã bưng.",
    "symbols": [],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/js/store_brand.js",
     "assets/sounds/dingdong.wav",
     "assets/vendor/fontawesome/css/all.min.css",
     "assets/vendor/qrcode.min.js"
    ],
    "apis": [],
    "tables": [
     "Confirmed"
    ]
   },
   {
    "path": "slave/web/sw.js",
    "folder": "slave/",
    "lang": "JavaScript",
    "lines": 23,
    "bytes": 771,
    "role": "Mã nguồn JavaScript thuộc phân hệ slave/",
    "symbols": [
     "addEventListener",
     "all",
     "forEach",
     "then"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "slave/web/wifi.html",
    "folder": "slave/",
    "lang": "HTML",
    "lines": 196,
    "bytes": 15094,
    "role": "Trang chào WiFi Marketing Captive Portal (tốc độ tối đa: Dùng thử giới hạn phiên & WiFi VIP theo mã hóa đơn).",
    "symbols": [
     "tab-free-min",
     "tab-wifi-free",
     "tab-wifi-vip"
    ],
    "deps": [
     "assets/css/app-tailwind.min.css",
     "assets/js/store_brand.js",
     "assets/vendor/fontawesome/css/all.min.css"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "tests/run_full_scenario_matrix.py",
    "folder": "tests/",
    "lang": "Python",
    "lines": 160,
    "bytes": 8170,
    "role": "Mã nguồn Python thuộc phân hệ tests/",
    "symbols": [
     "api",
     "record"
    ],
    "deps": [],
    "apis": [
     "/api/media/jukebox/bar_display",
     "/api/media/jukebox/status",
     "/api/payment/vietqr_svg",
     "/api/plugins/matrix",
     "/api/products.php",
     "/api/system/integrity"
    ],
    "tables": []
   },
   {
    "path": "tests/test_api_e2e.py",
    "folder": "tests/",
    "lang": "Python",
    "lines": 263,
    "bytes": 14193,
    "role": "Kiểm thử tích hợp End-to-End CI: khởi chạy cybernexus_slave thật trên DB sạch, test Login → Tables/SLA → Order → KDS → Review.",
    "symbols": [
     "find_slave_binary",
     "get_free_port",
     "http_req",
     "run_e2e"
    ],
    "deps": [
     "json",
     "os",
     "shutil",
     "socket",
     "sqlite3",
     "subprocess",
     "sys",
     "tempfile",
     "time",
     "urllib.error"
    ],
    "apis": [
     "/api/ai/copilot",
     "/api/network/devices",
     "/api/products",
     "/api/tables",
     "/api/wifi/portal_info",
     "/api/wifi/unlock"
    ],
    "tables": [
     "app_notifications",
     "categories",
     "kitchen_service_logs",
     "local_license_cache",
     "materials",
     "order_items",
     "orders",
     "products",
     "saas_settings",
     "store_settings",
     "tables_areas",
     "users"
    ]
   },
   {
    "path": "tests/verify_live_smoke.py",
    "folder": "tests/",
    "lang": "Python",
    "lines": 91,
    "bytes": 3903,
    "role": "Mã nguồn Python thuộc phân hệ tests/",
    "symbols": [
     "call",
     "check",
     "main",
     "make_client"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "pathlib"
    ]
   },
   {
    "path": "tests/verify_regression_v1.py",
    "folder": "tests/",
    "lang": "Python",
    "lines": 177,
    "bytes": 9371,
    "role": "Kiểm thử hồi quy CI: kiểm chứng chữ ký .sig, cú pháp toàn bộ JS/HTML bằng node --check và tính toàn vẹn gói OTA.",
    "symbols": [
     "check_frontend_integrity",
     "check_js_syntax",
     "check_module_sigs",
     "check_ota_package"
    ],
    "deps": [
     "hashlib",
     "json",
     "os",
     "re",
     "subprocess",
     "tempfile",
     "zipfile"
    ],
    "apis": [],
    "tables": [
     "collections"
    ]
   },
   {
    "path": "tools/build_customer_html.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 1317,
    "bytes": 82533,
    "role": "Script Python công cụ hỗ trợ đóng gói / ký số / bảo trì.",
    "symbols": [
     "format_money"
    ],
    "deps": [
     "html",
     "json",
     "sqlite3"
    ],
    "apis": [],
    "tables": [
     "API",
     "categories",
     "indicators",
     "products"
    ]
   },
   {
    "path": "tools/embed_dll_assets.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 51,
    "bytes": 1917,
    "role": "Mã nguồn Python thuộc phân hệ tools/",
    "symbols": [
     "main",
     "write_hpp"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "tools/generate_web_integrity.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 46,
    "bytes": 1697,
    "role": "Script Python công cụ hỗ trợ đóng gói / ký số / bảo trì.",
    "symbols": [
     "generate_for_web_dir"
    ],
    "deps": [
     "datetime",
     "hashlib",
     "json",
     "os"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "tools/mysql_backup_sync.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 368,
    "bytes": 13658,
    "role": "Worker Python trên Master thực hiện test kết nối, khởi tạo schema/user cô lập từng quán, đồng bộ SQLite -> MySQL và đối soát On-Demand (SYNC-01).",
    "symbols": [
     "cmd_import",
     "cmd_provision",
     "cmd_test",
     "cmd_verify",
     "main",
     "map_sqlite_type",
     "sanitize_ident",
     "sql_escape"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "information_schema",
     "pathlib",
     "sqlite_master"
    ]
   },
   {
    "path": "tools/qa_tracker_server.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 86,
    "bytes": 3396,
    "role": "Mã nguồn Python thuộc phân hệ tools/",
    "symbols": [],
    "deps": [],
    "apis": [
     "/api/refresh_arch"
    ],
    "tables": []
   },
   {
    "path": "tools/refresh_qa_arch_data.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 151,
    "bytes": 7179,
    "role": "Script tự động quét lại toàn bộ mã nguồn dự án và cập nhật chính xác số file/dòng code vào docs/qa_arch_codebase_data.js (DOC-14).",
    "symbols": [
     "collect_live_files",
     "extract_meta",
     "main"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "datetime",
     "pathlib",
     "qa_tracker_data"
    ]
   },
   {
    "path": "tools/release_ota.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 211,
    "bytes": 9363,
    "role": "Công cụ đóng gói OTA 1-Click chuẩn hóa: ký số ECDSA P-256 CNG, sinh web_integrity, auto cache-busting ?v=<ota>, tự cập nhật cây mã nguồn và cấm ghi đè version cũ.",
    "symbols": [
     "collect_files",
     "main",
     "sha256_file",
     "sign_dlls_ecdsa"
    ],
    "deps": [],
    "apis": [],
    "tables": [
     "SET",
     "datetime",
     "store_settings"
    ]
   },
   {
    "path": "tools/sign_module.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 40,
    "bytes": 1392,
    "role": "Script Python công cụ hỗ trợ đóng gói / ký số / bảo trì.",
    "symbols": [
     "sign_file"
    ],
    "deps": [
     "hashlib",
     "hmac",
     "json",
     "os",
     "sys",
     "time"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "tools/sign_modules.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 51,
    "bytes": 1541,
    "role": "Tiện ích kiểm tra & ký manifest module (tự bảo toàn chữ ký ECDSA v2 hợp lệ).",
    "symbols": [
     "sign_file"
    ],
    "deps": [
     "glob",
     "hashlib",
     "json",
     "os"
    ],
    "apis": [],
    "tables": []
   },
   {
    "path": "tools/tailwind/build_tailwind.py",
    "folder": "tools/",
    "lang": "Python",
    "lines": 32,
    "bytes": 1213,
    "role": "Mã nguồn Python thuộc phân hệ tools/",
    "symbols": [
     "build_all"
    ],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "tools/tailwind/input.css",
    "folder": "tools/",
    "lang": "CSS",
    "lines": 3,
    "bytes": 59,
    "role": "Mã nguồn CSS thuộc phân hệ tools/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "tools/tailwind/tailwind.master.config.js",
    "folder": "tools/",
    "lang": "JavaScript",
    "lines": 11,
    "bytes": 201,
    "role": "Mã nguồn JavaScript thuộc phân hệ tools/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   },
   {
    "path": "tools/tailwind/tailwind.slave.config.js",
    "folder": "tools/",
    "lang": "JavaScript",
    "lines": 11,
    "bytes": 199,
    "role": "Mã nguồn JavaScript thuộc phân hệ tools/",
    "symbols": [],
    "deps": [],
    "apis": [],
    "tables": []
   }
  ]
 }
};
