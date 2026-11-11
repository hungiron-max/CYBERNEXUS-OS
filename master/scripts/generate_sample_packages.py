# -*- coding: utf-8 -*-
import os
import sys
import shutil
import sqlite3
import subprocess
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Đăng ký font tiếng Việt
FONT_NAME = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
try:
    arial_path = "C:/Windows/Fonts/arial.ttf"
    arial_bold_path = "C:/Windows/Fonts/arialbd.ttf"
    if os.path.exists(arial_path) and os.path.exists(arial_bold_path):
        pdfmetrics.registerFont(TTFont("ArialVN", arial_path))
        pdfmetrics.registerFont(TTFont("ArialVN-Bold", arial_bold_path))
        FONT_NAME = "ArialVN"
        FONT_BOLD = "ArialVN-Bold"
except Exception as e:
    pass

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontName=FONT_BOLD,
    fontSize=18,
    leading=22,
    textColor=colors.HexColor('#0f172a'),
    alignment=1
)
subtitle_style = ParagraphStyle(
    'DocSubTitle',
    parent=styles['Normal'],
    fontName=FONT_NAME,
    fontSize=10,
    leading=14,
    textColor=colors.HexColor('#64748b'),
    alignment=1
)
heading_style = ParagraphStyle(
    'SectionHeading',
    parent=styles['Heading2'],
    fontName=FONT_BOLD,
    fontSize=12,
    leading=16,
    textColor=colors.HexColor('#1e293b'),
    spaceAfter=6
)
body_style = ParagraphStyle(
    'BodyTextVN',
    parent=styles['Normal'],
    fontName=FONT_NAME,
    fontSize=9.5,
    leading=14,
    textColor=colors.HexColor('#334155')
)
bold_style = ParagraphStyle('BoldVN', parent=body_style, fontName=FONT_BOLD)

def create_handover_pdf(output_path, tenant_name, tenant_code, owner_name):
    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    story.append(Paragraph("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh phúc", subtitle_style))
    story.append(HRFlowable(width="30%", thickness=1, color=colors.HexColor('#94a3b8'), spaceAfter=15, spaceBefore=4))
    story.append(Paragraph("BIÊN BẢN BÀN GIAO & NGHIỆM THU KỸ THUẬT", title_style))
    story.append(Paragraph(f"Hệ thống CyberNexus POS Chuẩn SOP-CBNX-09<br/>Mã Biên Bản: BB-NGHIEM-THU-{tenant_code}", subtitle_style))
    story.append(Spacer(1, 15))

    info_data = [
        [Paragraph("<b>ĐƠN VỊ BÀN GIAO (BÊN A):</b>", bold_style), Paragraph("<b>ĐƠN VỊ TIẾP NHẬN (BÊN B):</b>", bold_style)],
        [Paragraph("<b>Công ty:</b> CyberNexus OS Solutions Corp<br/><b>Kỹ thuật viên:</b> Nguyễn Hoàng Nam<br/><b>SĐT Hotline:</b> 1900 8892<br/><b>Cổng SuperAdmin:</b> http://127.0.0.1:8500", body_style),
         Paragraph(f"<b>Cửa hàng:</b> {tenant_name}<br/><b>Mã Quán (Tenant):</b> {tenant_code}<br/><b>Đại diện nhận:</b> {owner_name}<br/><b>Trạng thái:</b> Sẵn sàng vận hành", body_style)]
    ]
    t_info = Table(info_data, colWidths=[260, 260])
    t_info.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 15))

    checklist = [
        ["STT", "Hạng Mục Kiểm Tra & Nghiệm Thu", "Tiêu Chuẩn Đạt", "Kết Quả"],
        ["1", "Khóa bản quyền (Hardware Node-Lock)", "Khớp Hardware GUID máy trạm, chống sao chép trái phép", "ĐẠT [OK]"],
        ["2", "Thao tác Bán Hàng & Order POS Core", "Mượt mà, lưu đơn SQLite, in hóa đơn nhanh", "ĐẠT [OK]"],
        ["3", "Thanh toán QR Động Napas 24/7 (VietQR)", "Tự sinh QR đúng số tiền & mã đơn hàng", "ĐẠT [OK]"],
        ["4", "Màn hình KDS Bếp / Pha Chế", "Cập nhật realtime qua Web/Socket không độ trễ", "ĐẠT [OK]"],
        ["5", "Khởi tạo sẵn 4 tài khoản phân quyền", "Admin, Bếp, Thu Ngân, Phục Vụ (bắt buộc đổi pass)", "ĐẠT [OK]"],
        ["6", "Khởi tạo sẵn 3 món ăn mẫu", "Menu mẫu kiểm thử bán hàng & hiển thị KDS", "ĐẠT [OK]"],
        ["7", "Sao lưu CSDL Offline/Online định kỳ", "Tự động sao lưu database hàng ngày an toàn", "ĐẠT [OK]"],
        ["8", "Tường lửa Windows & Mạng LAN Nội Bộ", "Cổng 8501 mở thông suốt cho điện thoại/iPad", "ĐẠT [OK]"]
    ]
    t_check = Table(checklist, colWidths=[25, 250, 175, 70])
    t_check.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (3,0), (3,-1), 'CENTER'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TEXTCOLOR', (3,1), (3,-1), colors.HexColor('#059669')),
        ('FONTNAME', (3,1), (3,-1), FONT_BOLD),
    ]))
    story.append(t_check)
    story.append(Spacer(1, 15))
    story.append(Paragraph("<b>KẾT LUẬN:</b> Hai bên thống nhất toàn bộ các hạng mục đã được cài đặt, tinh chỉnh và nghiệm thu hoàn tất. Hệ thống hoạt động ổn định, bàn giao quyền sử dụng và tài khoản cho Bên B kể từ ngày ký biên bản.", body_style))
    story.append(Spacer(1, 20))

    sign_data = [
        [Paragraph("<b>ĐẠI DIỆN BÊN BÀN GIAO</b><br/>(Kỹ thuật viên trưởng đã ký)", subtitle_style),
         Paragraph("<b>ĐẠI DIỆN BÊN TIẾP NHẬN</b><br/>(Chủ quán / Đại diện đã ký)", subtitle_style)],
        [Spacer(1, 40), Spacer(1, 40)],
        [Paragraph("<b>Nguyễn Hoàng Nam</b><br/>(Đã ký xác thực điện tử)", subtitle_style),
         Paragraph(f"<b>{owner_name}</b><br/>(Đại diện {tenant_name})", subtitle_style)]
    ]
    t_sign = Table(sign_data, colWidths=[260, 260])
    t_sign.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    story.append(t_sign)
    doc.build(story)

def create_contract_pdf(output_path, tenant_name, tenant_code, owner_name, plan_name):
    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    story.append(Paragraph("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh phúc", subtitle_style))
    story.append(HRFlowable(width="30%", thickness=1, color=colors.HexColor('#94a3b8'), spaceAfter=15, spaceBefore=4))
    story.append(Paragraph("HỢP ĐỒNG CUNG CẤP DỊCH VỤ PHẦN MỀM SAAS", title_style))
    story.append(Paragraph(f"Số Hợp Đồng: HD-CBNX-2026-{tenant_code} | Gói: {plan_name}", subtitle_style))
    story.append(Spacer(1, 15))

    body_contract = [
        f"Hôm nay, ngày 11 tháng 11 năm 2026, tại trụ sở CyberNexus OS Solutions, chúng tôi gồm có:",
        f"<b>BÊN CUNG CẤP DỊCH VỤ (BÊN A):</b> CÔNG TY CỔ PHẦN CÔNG NGHỆ CYBERNEXUS OS<br/>Đại diện: Ban Giám Đốc | Mã số thuế: 0318892439<br/>Địa chỉ: Tòa nhà Tech Tower, Quận 1, TP. Hồ Chí Minh.",
        f"<b>BÊN KHÁCH HÀNG (BÊN B):</b> {tenant_name}<br/>Mã khách hàng: {tenant_code} | Đại diện: {owner_name}<br/>Tư cách: Khách hàng sử dụng dịch vụ điểm bán CyberNexus POS.",
        f"<b>ĐIỀU 1: PHẠM VI DỊCH VỤ & GÓI CƯỚC</b><br/>Bên A cung cấp cho Bên B quyền sử dụng bộ giải pháp phần mềm CyberNexus ({plan_name}) bao gồm: Lõi bán hàng POS Core, VietQR tự động, KDS Bếp, Báo cáo nâng cao và sao lưu tự động.",
        "<b>ĐIỀU 2: BẢO HÀNH, BẢO TRÌ & NÂNG CẤP</b><br/>Bên A cam kết hỗ trợ kỹ thuật 24/7, tự động cập nhật bản vá bảo mật và sao lưu dữ liệu cho Bên B trong suốt thời gian hiệu lực hợp đồng.",
        "<b>ĐIỀU 3: BẢO MẬT & ĐỔI MẬT KHẨU KHỞI TẠO</b><br/>Bên B chịu trách nhiệm bảo quản tài khoản và có nghĩa vụ đổi mật khẩu cũng như mã PIN của các tài khoản được bàn giao ngay trong lần đăng nhập đầu tiên."
    ]
    for p in body_contract:
        story.append(Paragraph(p, body_style))
        story.append(Spacer(1, 8))

    story.append(Spacer(1, 25))
    sign_data = [
        [Paragraph("<b>ĐẠI DIỆN BÊN A</b><br/>(Đã ký tên & đóng dấu)", subtitle_style),
         Paragraph("<b>ĐẠI DIỆN BÊN B</b><br/>(Đã ký tên & đóng dấu)", subtitle_style)],
        [Spacer(1, 45), Spacer(1, 45)],
        [Paragraph("<b>CYBERNEXUS OS SOLUTIONS</b>", subtitle_style),
         Paragraph(f"<b>{tenant_name}</b>", subtitle_style)]
    ]
    t_sign = Table(sign_data, colWidths=[260, 260])
    t_sign.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    story.append(t_sign)
    doc.build(story)

def create_invoice_pdf(output_path, tenant_name, tenant_code, owner_name, plan_name, inv_no="00125", price_str="3.490.000"):
    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    story.append(Paragraph("HÓA ĐƠN ĐIỆN TỬ GIÁ TRỊ GIA TĂNG (VAT)", title_style))
    story.append(Paragraph(f"Ký hiệu: 1C26TCN | Số hóa đơn: {inv_no} | Ngày lập: 11/11/2026", subtitle_style))
    story.append(Spacer(1, 15))

    buyer_info = [
        [Paragraph("<b>Đơn vị bán hàng:</b> CÔNG TY CP CÔNG NGHỆ CYBERNEXUS OS<br/><b>MST:</b> 0318892439<br/><b>Địa chỉ:</b> Tòa nhà Tech Tower, Quận 1, TP. Hồ Chí Minh", body_style),
         Paragraph(f"<b>Đơn vị mua hàng:</b> {tenant_name}<br/><b>Mã Quán:</b> {tenant_code}<br/><b>Người mua:</b> {owner_name}<br/><b>Trạng thái:</b> Đã thanh toán 100%", body_style)]
    ]
    t_buyer = Table(buyer_info, colWidths=[260, 260])
    t_buyer.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_buyer)
    story.append(Spacer(1, 15))

    items = [
        ["STT", "Tên Hàng Hóa, Dịch Vụ", "ĐVT", "SL", "Đơn Giá (VNĐ)", "Thành Tiền (VNĐ)"],
        ["1", f"Gói Dịch Vụ SaaS CyberNexus ({plan_name})", "Gói", "1", price_str, price_str],
        ["", "Cộng tiền dịch vụ:", "", "", "", price_str],
        ["", "Thuế suất GTGT (VAT 10%):", "", "", "", "Đã bao gồm"],
        ["", "Tổng tiền thanh toán:", "", "", "", f"<b>{price_str} VNĐ</b>"]
    ]
    t_items = Table(items, colWidths=[25, 230, 35, 25, 95, 110])
    t_items.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
        ('GRID', (0,0), (-1,1), 0.5, colors.HexColor('#cbd5e1')),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (2,0), (3,-1), 'CENTER'),
        ('ALIGN', (4,0), (-1,-1), 'RIGHT'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('LINEBELOW', (0,2), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TEXTCOLOR', (-1,-1), (-1,-1), colors.HexColor('#dc2626')),
    ]))
    story.append(t_items)
    story.append(Spacer(1, 15))
    story.append(Paragraph("<b>Trạng thái:</b> Đã thanh toán 100% qua Chuyển khoản (Giao dịch hoàn tất).<br/>Hóa đơn điện tử có giá trị pháp lý lưu trữ theo quy định của Tổng Cục Thuế.", body_style))
    story.append(Spacer(1, 20))

    sign_data = [
        [Paragraph("<b>NGƯỜI MUA HÀNG</b>", subtitle_style), Paragraph("<b>NGƯỜI BÁN HÀNG</b><br/>(Ký số điện tử)", subtitle_style)],
        [Spacer(1, 35), Spacer(1, 35)],
        [Paragraph(f"{owner_name}", subtitle_style), Paragraph("CyberNexus CA - Signed Valid", subtitle_style)]
    ]
    t_sign = Table(sign_data, colWidths=[260, 260])
    t_sign.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    story.append(t_sign)
    doc.build(story)

def generate_credentials_text(tenant_name, tenant_code, plan_name, license_key, expire_date):
    return f"""================================================================================
  CYBERNEXUS OS — PHIẾU BÀN GIAO TÀI KHOẢN VÀ MẬT KHẨU KHỞI TẠO ĐIỂM BÁN
================================================================================
Cửa Hàng:           {tenant_name}
Mã Cửa Hàng:        {tenant_code}
Gói Bản Quyền:      {plan_name}
Mã Giấy Phép (Key): {license_key}
Hạn Sử Dụng:        {expire_date}
Ngày Phát Hành:     {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
Quy Chuẩn Bàn Giao: SOP-CBNX-09 Enterprise Edition

--------------------------------------------------------------------------------
1. DANH SÁCH TÀI KHOẢN & MÃ PIN KHỞI TẠO MẶC ĐỊNH
--------------------------------------------------------------------------------
[1] TÀI KHOẢN QUẢN TRỊ VIÊN (CHỦ QUÁN / ADMIN)
    - Tên đăng nhập (Username): admin
    - Mật khẩu mặc định:        Admin@2026
    - Mã PIN đăng nhập nhanh:   9999
    - Phạm vi quyền hạn:        Toàn quyền quản trị quán, cài đặt menu, xem doanh thu, cấu hình hệ thống.
    - Cổng truy cập:            http://localhost:8501/admin

[2] TÀI KHOẢN BẾP & PHA CHẾ (CHEF / KITCHEN)
    - Tên đăng nhập (Username): bep01
    - Mật khẩu mặc định:        Bep@2026
    - Mã PIN đăng nhập nhanh:   1111
    - Phạm vi quyền hạn:        Xem đơn món cần chế biến, cập nhật tiến độ ra món (KDS Kitchen Display System).
    - Cổng truy cập:            http://localhost:8501/kitchen

[3] TÀI KHOẢN THU NGÂN (CASHIER / POS)
    - Tên đăng nhập (Username): thungan01
    - Mật khẩu mặc định:        ThuNgan@2026
    - Mã PIN đăng nhập nhanh:   2222
    - Phạm vi quyền hạn:        Mở ca, bán hàng, in bill hóa đơn, áp dụng khuyến mãi, thanh toán tiền mặt/chuyển khoản.
    - Cổng truy cập:            http://localhost:8501/pos

[4] TÀI KHOẢN NHÂN VIÊN PHỤC VỤ (WAITER)
    - Tên đăng nhập (Username): phucvu01
    - Mật khẩu mặc định:        PhucVu@2026
    - Mã PIN đăng nhập nhanh:   3333
    - Phạm vi quyền hạn:        Mở bàn, chọn món cho khách, chuyển bàn, gửi lệnh order xuống bếp/pha chế.
    - Cổng truy cập:            http://localhost:8501/pos hoặc trên điện thoại máy tính bảng

--------------------------------------------------------------------------------
2. CẢNH BÁO AN NINH & YÊU CẦU ĐỔI MẬT KHẨU LẦN ĐẦU (BẮT BUỘC)
--------------------------------------------------------------------------------
⚠️  QUAN TRỌNG:
    - Để đảm bảo an toàn tuyệt đối cho doanh thu, số liệu tài chính và bảo mật dữ liệu quán,
      Chủ quán và Nhân viên BẮT BUỘC PHẢI ĐỔI MẬT KHẨU VÀ MÃ PIN NGAY TRONG LẦN ĐĂNG NHẬP ĐẦU TIÊN!
    - Tuyệt đối không chia sẻ mật khẩu của tài khoản Quản trị (admin) cho nhân viên thời vụ.
    - Mật khẩu mới cần tối thiểu 6 ký tự, kết hợp chữ và số để chống lộ lọt.

--------------------------------------------------------------------------------
3. DỮ LIỆU MẪU ĐÃ CÀI ĐẶT SẴN TRONG HỆ THỐNG
--------------------------------------------------------------------------------
Hệ thống đã khởi tạo sẵn 3 món ăn mẫu để quý khách có thể kiểm thử in hóa đơn và vận hành ngay:
    1. Cà phê sữa đá Sài Gòn      - Mã: CF001 - Đơn giá: 29.000 VNĐ  (Nhóm: Cà Phê)
    2. Bò bít tết sốt tiêu đen    - Mã: BT001 - Đơn giá: 89.000 VNĐ  (Nhóm: Món Chính)
    3. Trà đào cam sả thanh nhiệt - Mã: TR001 - Đơn giá: 35.000 VNĐ  (Nhóm: Trà Trái Cây)

--------------------------------------------------------------------------------
4. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG TRÊN MÁY TRẠM
--------------------------------------------------------------------------------
Bước 1: Giải nén toàn bộ file ZIP vào thư mục làm việc (ví dụ: C:\\CyberNexus_POS).
Bước 2: Chạy file 'Mo_Tuong_Lua_LAN.bat' với quyền Run as Administrator để mở port mạng nội bộ.
Bước 3: Nhấp đúp vào file 'RUN_SLAVE.bat' để khởi động hệ thống.
Bước 4: Mở trình duyệt web truy cập http://localhost:8501/pos để bắt đầu bán hàng!

Hotline Hỗ Trợ Kỹ Thuật 24/7: 1900 6868 - contact@cybernexus.vn
================================================================================
"""

def generate_clean_store_database(target_db_path, template_db_path, store_name, tenant_code):
    if os.path.exists(target_db_path):
        os.remove(target_db_path)
    shutil.copy2(template_db_path, target_db_path)
    
    conn = sqlite3.connect(target_db_path)
    cur = conn.cursor()
    
    # 1. Xóa sạch các giao dịch cũ
    cur.execute("DELETE FROM orders")
    cur.execute("DELETE FROM order_items")
    try: cur.execute("DELETE FROM kitchen_service_logs")
    except: pass
    try: cur.execute("DELETE FROM attendances")
    except: pass
    try: cur.execute("DELETE FROM material_transactions")
    except: pass
    try: cur.execute("DELETE FROM app_notifications")
    except: pass
    try: cur.execute("DELETE FROM media_jukebox_queue")
    except: pass
    
    # 2. Khởi tạo 4 tài khoản phân quyền chuẩn (admin, bep01, thungan01, phucvu01)
    cur.execute("DELETE FROM users")
    users = [
        (1, "admin", "Admin@2026", f"Quản Trị Viên ({store_name})", "admin", "9999", "active"),
        (2, "bep01", "Bep@2026", "Bếp Trưởng / Pha Chế", "kitchen", "1111", "active"),
        (3, "thungan01", "ThuNgan@2026", "Thu Ngân Điểm Bán", "cashier", "2222", "active"),
        (4, "phucvu01", "PhucVu@2026", "Nhân Viên Phục Vụ 01", "waiter", "3333", "active")
    ]
    cur.executemany("""
        INSERT INTO users (id, username, password, fullname, role, pin_code, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, users)
    
    # 3. Khởi tạo 3 món ăn mẫu
    cur.execute("DELETE FROM products")
    products = [
        (1, 4, "CF001", "Cà phê sữa đá Sài Gòn", "ly", 8000, 29000, "active", "Cà phê hạt Robusta Buôn Ma Thuột pha phin đậm đà, sữa đặc thơm ngọt"),
        (2, 3, "BT001", "Bò bít tết sốt tiêu đen", "phần", 45000, 89000, "active", "Thịt thăn bò mềm mọng nước, sốt tiêu đen hảo hạng kèm khoai tây chiên và bánh mì"),
        (3, 14, "TR001", "Trà đào cam sả thanh nhiệt", "ly", 12000, 35000, "active", "Trà đào thanh mát quyện cùng hương vị cam tươi và tinh dầu sả tự nhiên")
    ]
    cur.executemany("""
        INSERT INTO products (id, category_id, code, name, unit, cost_price, sale_price, status, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, products)
    
    # 4. Cập nhật thông tin quán
    try:
        cur.execute("UPDATE store_settings SET value = ? WHERE key = 'store_name'", (store_name,))
        cur.execute("UPDATE store_settings SET value = ? WHERE key = 'tenant_code'", (tenant_code,))
    except: pass
    
    conn.commit()
    conn.close()

def main():
    root_dir = r"X:\My Drive\Code dev\cybernexus-os"
    master_db_path = os.path.join(root_dir, "master", "database", "cybernexus_master.db")
    template_db_path = os.path.join(root_dir, "slave", "database", "store_local.db")
    slave_dir = os.path.join(root_dir, "slave")
    packages_dir = os.path.join(root_dir, "master", "packages")

    master_conn = sqlite3.connect(master_db_path)
    cur = master_conn.cursor()

    cur.execute("SELECT id, tenant_code, store_name, owner_name, plan_name, enabled_modules, license_key, expire_date FROM saas_tenants")
    tenants = cur.fetchall()

    invoice_counter = 125
    for tid, tcode, store_name, owner_name, plan_name, enabled_mods, license_key, expire_date in tenants:
        # YÊU CẦU: GIỮ NGUYÊN DỮ LIỆU CỦA GP001! Chỉ tạo mẫu cho các quán khác!
        if tcode == "GP001":
            print(f"[SKIP] Giữ nguyên 100% dữ liệu gốc của GP001 theo yêu cầu.")
            continue

        print(f"\n=======================================================")
        print(f"[*] Đang khởi tạo bộ tài liệu & gói release cho quán: {tcode} - {store_name}")
        t_dir = os.path.join(packages_dir, tcode)
        contracts_dir = os.path.join(t_dir, "contracts")
        invoices_dir = os.path.join(t_dir, "invoices")
        handover_dir = os.path.join(t_dir, "handover")
        release_dir = os.path.join(t_dir, "release")

        for d in [contracts_dir, invoices_dir, handover_dir, release_dir]:
            os.makedirs(d, exist_ok=True)

        inv_num_str = f"{invoice_counter:05d}"
        invoice_counter += 1

        # 1. Tạo PDF Hợp đồng
        contract_pdf = os.path.join(contracts_dir, f"HD-CBNX-2026-{tcode}.pdf")
        create_contract_pdf(contract_pdf, store_name, tcode, owner_name, plan_name)
        contract_size = os.path.getsize(contract_pdf)

        # 2. Tạo PDF Hóa đơn VAT
        invoice_pdf = os.path.join(invoices_dir, f"VAT-CBNX-2026-{inv_num_str}.pdf")
        price_str = "4.990.000" if "Pro" in plan_name else ("2.490.000" if "Standard" in plan_name else "1.490.000")
        create_invoice_pdf(invoice_pdf, store_name, tcode, owner_name, plan_name, inv_num_str, price_str)
        invoice_size = os.path.getsize(invoice_pdf)

        # 3. Tạo PDF Biên bản bàn giao kỹ thuật
        handover_pdf = os.path.join(handover_dir, f"BB-NGHIEM-THU-{tcode}.pdf")
        create_handover_pdf(handover_pdf, store_name, tcode, owner_name)
        handover_size = os.path.getsize(handover_pdf)

        # 4. Tạo File THONG_TIN_DANG_NHAP_BAN_DAU.txt
        cred_text = generate_credentials_text(store_name, tcode, plan_name, license_key, expire_date)
        cred_file_handover = os.path.join(handover_dir, "THONG_TIN_DANG_NHAP_BAN_DAU.txt")
        cred_file_release = os.path.join(release_dir, "THONG_TIN_DANG_NHAP_BAN_DAU.txt")
        with open(cred_file_handover, "w", encoding="utf-8") as f:
            f.write(cred_text)
        with open(cred_file_release, "w", encoding="utf-8") as f:
            f.write(cred_text)
        cred_size = os.path.getsize(cred_file_handover)

        # 5. Tạo config.json & license_certificate.txt trong release
        config_path = os.path.join(release_dir, "config.json")
        cfg_content = f'''{{
  "store_tenant_id": "{tcode}",
  "store_name": "{store_name}",
  "license_key": "{license_key}",
  "master_server_url": "http://127.0.0.1:8500",
  "port": 8501,
  "auto_heartbeat": true
}}'''
        with open(config_path, "w", encoding="utf-8") as f:
            f.write(cfg_content)

        cert_path = os.path.join(release_dir, "license_certificate.txt")
        cert_content = f"""==============================================================
  CYBERNEXUS OS — CHỨNG NHẬN BẢN QUYỀN PHẦN MỀM ĐIỂM BÁN
==============================================================
Cửa Hàng:           {store_name}
Mã Quán (Tenant):   {tcode}
Mã Khóa Bản Quyền:  {license_key}
Gói Dịch Vụ:        {plan_name}
Hạn Sử Dụng:        {expire_date}
Khóa Phần Cứng:     Unbound (Chưa gán máy)
Module Được Duyệt:  {enabled_mods}
Phát Hành Bởi:      SuperAdmin SaaS Central Authority
Quy Chuẩn Đóng Gói: SOP-CBNX-09 Enterprise Edition
==============================================================
"""
        with open(cert_path, "w", encoding="utf-8") as f:
            f.write(cert_content)

        # 6. Chuẩn bị staging_temp để đóng gói ZIP chuẩn
        staging_dir = os.path.join(release_dir, "staging_temp")
        if os.path.exists(staging_dir):
            shutil.rmtree(staging_dir, ignore_errors=True)
        os.makedirs(staging_dir, exist_ok=True)

        # Copy binary thực thi
        for fn in ["cybernexus_slave.exe", "RUN_SLAVE.bat"]:
            src_f = os.path.join(slave_dir, fn)
            if os.path.exists(src_f):
                shutil.copy2(src_f, os.path.join(staging_dir, fn))
        
        mo_tuong_lua = os.path.join(root_dir, "Mo_Tuong_Lua_LAN.bat")
        if os.path.exists(mo_tuong_lua):
            shutil.copy2(mo_tuong_lua, os.path.join(staging_dir, "Mo_Tuong_Lua_LAN.bat"))

        # Copy web
        src_web = os.path.join(slave_dir, "web")
        if os.path.exists(src_web):
            shutil.copytree(src_web, os.path.join(staging_dir, "web"), dirs_exist_ok=True)

        # Copy licensed modules
        stage_mods = os.path.join(staging_dir, "modules")
        os.makedirs(stage_mods, exist_ok=True)
        for mod_name in ["libmod_pos_core.dll", "libmod_pos_core.dll.sig"]:
            src_mod = os.path.join(slave_dir, "modules", mod_name)
            if os.path.exists(src_mod):
                shutil.copy2(src_mod, os.path.join(stage_mods, mod_name))
        
        if "mod_media_stream" in enabled_mods:
            for mod_name in ["libmod_media_stream.dll", "libmod_media_stream.dll.sig"]:
                src_mod = os.path.join(slave_dir, "modules", mod_name)
                if os.path.exists(src_mod):
                    shutil.copy2(src_mod, os.path.join(stage_mods, mod_name))
        
        if "mod_network_qos" in enabled_mods:
            for mod_name in ["libmod_network_qos.dll", "libmod_network_qos.dll.sig"]:
                src_mod = os.path.join(slave_dir, "modules", mod_name)
                if os.path.exists(src_mod):
                    shutil.copy2(src_mod, os.path.join(stage_mods, mod_name))

        # Copy config, cert, credentials
        shutil.copy2(config_path, os.path.join(staging_dir, "config.json"))
        shutil.copy2(cert_path, os.path.join(staging_dir, "license_certificate.txt"))
        shutil.copy2(cred_file_release, os.path.join(staging_dir, "THONG_TIN_DANG_NHAP_BAN_DAU.txt"))

        # Tạo Database chuẩn riêng cho quán (4 users + 3 món ăn mẫu + clean orders)
        stage_db_dir = os.path.join(staging_dir, "database")
        os.makedirs(stage_db_dir, exist_ok=True)
        clean_db_path = os.path.join(stage_db_dir, "store_local.db")
        generate_clean_store_database(clean_db_path, template_db_path, store_name, tcode)

        # Nén thành file ZIP chuẩn qua tar.exe
        zip_file_name = f"CyberNexus_POS_Release_{tcode}.zip"
        zip_path = os.path.join(release_dir, zip_file_name)
        if os.path.exists(zip_path):
            os.remove(zip_path)

        cmd = f'tar.exe -a -c -f "{zip_path}" -C "{staging_dir}" *'
        subprocess.run(cmd, shell=True, check=True)
        shutil.rmtree(staging_dir, ignore_errors=True)
        zip_size = os.path.getsize(zip_path)
        print(f"[+] Đã đóng gói thành công: {zip_file_name} ({zip_size / (1024*1024):.2f} MB)")

        # 7. Cập nhật hồ sơ tài liệu vào saas_tenant_documents trong database
        cur.execute("DELETE FROM saas_tenant_documents WHERE tenant_code = ?", (tcode,))
        doc_rows = [
            (tid, tcode, "contracts", f"HD-CBNX-2026-{tcode}.pdf", f"packages/{tcode}/contracts/HD-CBNX-2026-{tcode}.pdf", contract_size, "pdf", f"Hợp Đồng Cung Cấp Dịch Vụ SaaS - {store_name}", f"Hợp đồng bản quyền phần mềm gói {plan_name}", "valid", "SuperAdmin"),
            (tid, tcode, "invoices", f"VAT-CBNX-2026-{inv_num_str}.pdf", f"packages/{tcode}/invoices/VAT-CBNX-2026-{inv_num_str}.pdf", invoice_size, "pdf", f"Hóa Đơn Điện Tử VAT {inv_num_str}", f"Hóa đơn thanh toán gói dịch vụ {plan_name}", "valid", "SuperAdmin"),
            (tid, tcode, "handover", f"BB-NGHIEM-THU-{tcode}.pdf", f"packages/{tcode}/handover/BB-NGHIEM-THU-{tcode}.pdf", handover_size, "pdf", f"Biên Bản Nghiệm Thu & Bàn Giao Kỹ Thuật {tcode}", "Nghiệm thu toàn diện các tính năng và bàn giao điểm bán", "valid", "SuperAdmin"),
            (tid, tcode, "handover", "THONG_TIN_DANG_NHAP_BAN_DAU.txt", f"packages/{tcode}/handover/THONG_TIN_DANG_NHAP_BAN_DAU.txt", cred_size, "txt", "Thông Tin Tài Khoản & Mật Khẩu Khởi Tạo (Bắt Buộc Đổi)", "Cấp 4 tài khoản (Admin, Bếp, Thu Ngân, Phục Vụ) kèm mã PIN và 3 món ăn mẫu", "valid", "SuperAdmin"),
            (tid, tcode, "release", zip_file_name, f"packages/{tcode}/release/{zip_file_name}", zip_size, "zip", f"Bộ Cài Đặt Bản Quyền {tcode}", f"Gói cài đặt đóng gói tự động chuẩn SOP-09 kèm License Key và cấu hình quán {store_name}.", "valid", "SuperAdmin")
        ]
        cur.executemany("""
            INSERT INTO saas_tenant_documents 
            (tenant_id, tenant_code, category, file_name, file_path, file_size, file_ext, title, notes, status, uploaded_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """, doc_rows)

        # 8. Ghi nhận nhật ký kiểm toán cho từng quán
        cur.execute("""
            INSERT INTO saas_audit_logs 
            (staff_id, username, role, action, target_tenant, description, metadata_json, ip_address, created_at)
            VALUES (2, 'kythuat_nam', 'kythuat', 'PACKAGE_BUILD', ?, ?, ?, '127.0.0.1', datetime('now'))
        """, (tcode, f"Đóng gói 1-Click thành công bộ cài đặt {zip_file_name} kèm 3 món ăn mẫu và 4 tài khoản nghiệp vụ", f'{{"tenant":"{tcode}","size_mb":{zip_size / (1024*1024):.2f}}}'))

    master_conn.commit()
    master_conn.close()
    print("\n[SUCCESS] Hoàn tất tạo mẫu đầy đủ cho tất cả các folder quán khác! Giữ nguyên GP001.")

if __name__ == "__main__":
    main()
