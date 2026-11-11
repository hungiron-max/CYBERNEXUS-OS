# -*- coding: utf-8 -*-
"""
Script tạo tài liệu mẫu chuẩn PDF (Hợp đồng, Hóa đơn VAT, Biên bản nghiệm thu)
dành cho kho packages của CyberNexus OS SuperAdmin.
"""
import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Đăng ký font tiếng Việt từ Windows Fonts (Arial, Times New Roman, Segoe UI)
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
    alignment=1 # Center
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

bold_style = ParagraphStyle(
    'BoldVN',
    parent=body_style,
    fontName=FONT_BOLD
)

def create_handover_pdf(output_path, tenant_name="GÓC PHỐ COFFEE & TEA", tenant_code="GP001"):
    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []

    # Tiêu đề
    story.append(Paragraph("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh phúc", subtitle_style))
    story.append(HRFlowable(width="30%", thickness=1, color=colors.HexColor('#94a3b8'), spaceAfter=15, spaceBefore=4))
    
    story.append(Paragraph("BIÊN BẢN BÀN GIAO & NGHIỆM THU KỸ THUẬT", title_style))
    story.append(Paragraph(f"Hệ thống CyberNexus POS & Media Server Chuẩn SOP-CBNX-09<br/>Mã Biên Bản: BB-NGHIEM-THU-{tenant_code}", subtitle_style))
    story.append(Spacer(1, 15))

    # Thông tin các bên
    info_data = [
        [Paragraph("<b>ĐƠN VỊ BÀN GIAO (BÊN A):</b>", bold_style), Paragraph("<b>ĐƠN VỊ TIẾP NHẬN (BÊN B):</b>", bold_style)],
        [Paragraph("<b>Công ty:</b> CyberNexus OS Solutions Corp<br/><b>Kỹ thuật viên:</b> Nguyễn Hoàng Nam<br/><b>SĐT Hotline:</b> 1900 8892<br/><b>Cổng SuperAdmin:</b> http://127.0.0.1:8500", body_style),
         Paragraph(f"<b>Cửa hàng:</b> {tenant_name}<br/><b>Mã Quán (Tenant):</b> {tenant_code}<br/><b>Đại diện nhận:</b> Nguyễn Minh Quân (Chủ quán)<br/><b>Địa chỉ:</b> 123 Đường Số 5, P. Linh Trung, Thủ Đức", body_style)]
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

    # Bảng 10 Hạng Mục Nghiệm Thu
    story.append(Paragraph("KẾT QUẢ ĐỐI SOÁT 10 HẠNG MỤC KỸ THUẬT (SOP-09):", heading_style))
    
    checklist = [
        ["STT", "Hạng Mục Kiểm Tra & Nghiệm Thu", "Tiêu Chuẩn Đạt", "Kết Quả"],
        ["1", "Khóa bản quyền (Hardware Node-Lock)", "Khớp Hardware GUID máy trạm, chống sao chép trái phép", "ĐẠT [OK]"],
        ["2", "Thao tác Bán Hàng & Order POS Core", "Mượt mà, lưu đơn SQLite, in hóa đơn nhanh", "ĐẠT [OK]"],
        ["3", "Thanh toán QR Động Napas 24/7 (VietQR)", "Tự sinh QR đúng số tiền & mã đơn hàng", "ĐẠT [OK]"],
        ["4", "Màn hình KDS Bếp / Pha Chế", "Cập nhật realtime qua Web/Socket không độ trễ", "ĐẠT [OK]"],
        ["5", "Máy chủ Stream Phim/Nhạc Nội Bộ (Media)", "Stream mượt mà, không giật lag qua cổng 8082", "ĐẠT [OK]"],
        ["6", "Equalizer Âm Thanh Chuyên Nghiệp 10-Band", "Hiệu chỉnh chuẩn cho hệ thống Loa âm trần quán", "ĐẠT [OK]"],
        ["7", "QR Jukebox Thông Minh Cho Khách Chọn Bài", "Quét QR điện thoại, chọn bài đẩy vào Queue thành công", "ĐẠT [OK]"],
        ["8", "Kiểm soát Lưu Lượng Băng Thông (QoS Router)", "Ưu tiên POS/Game 99%, giới hạn cào IDM tải lậu", "ĐẠT [OK]"],
        ["9", "Sao lưu CSDL Offline/Online định kỳ", "Tự động sao lưu database hàng ngày an toàn", "ĐẠT [OK]"],
        ["10", "Tường lửa Windows & Mạng LAN Nội Bộ", "Cổng 8500/8501/8082 mở thông suốt cho điện thoại/iPad", "ĐẠT [OK]"]
    ]

    t_check = Table(checklist, colWidths=[25, 260, 165, 70])
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

    # Kết luận & Ký tên
    story.append(Paragraph("<b>KẾT LUẬN:</b> Hai bên thống nhất toàn bộ 10 hạng mục đã được cài đặt, tinh chỉnh và nghiệm thu hoàn tất. Hệ thống hoạt động ổn định, bàn giao quyền sử dụng và tài khoản cho Bên B kể từ ngày ký biên bản.", body_style))
    story.append(Spacer(1, 20))

    sign_data = [
        [Paragraph("<b>ĐẠI DIỆN BÊN BÀN GIAO</b><br/>(Kỹ thuật viên trưởng đã ký)", subtitle_style),
         Paragraph("<b>ĐẠI DIỆN BÊN TIẾP NHẬN</b><br/>(Chủ quán / Đại diện đã ký)", subtitle_style)],
        [Spacer(1, 40), Spacer(1, 40)],
        [Paragraph("<b>Nguyễn Hoàng Nam</b><br/>(Đã xác thực chữ ký điện tử)", subtitle_style),
         Paragraph(f"<b>Nguyễn Minh Quân</b><br/>(Đại diện {tenant_name})", subtitle_style)]
    ]
    t_sign = Table(sign_data, colWidths=[260, 260])
    t_sign.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    story.append(t_sign)

    doc.build(story)
    print(f"Đã tạo thành công PDF: {output_path}")

def create_contract_pdf(output_path, tenant_name="GÓC PHỐ COFFEE & TEA", tenant_code="GP001"):
    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []

    story.append(Paragraph("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh phúc", subtitle_style))
    story.append(HRFlowable(width="30%", thickness=1, color=colors.HexColor('#94a3b8'), spaceAfter=15, spaceBefore=4))
    
    story.append(Paragraph("HỢP ĐỒNG CUNG CẤP DỊCH VỤ SAAS & MEDIA SERVER", title_style))
    story.append(Paragraph(f"Số Hợp Đồng: HD-CBNX-2026-{tenant_code} | Chu kỳ: 12 Tháng", subtitle_style))
    story.append(Spacer(1, 15))

    body_contract = [
        f"Hôm nay, ngày 10 tháng 11 năm 2026, tại trụ sở CyberNexus OS Solutions, chúng tôi gồm có:",
        f"<b>BÊN CUNG CẤP DỊCH VỤ (BÊN A):</b> CÔNG TY CỔ PHẦN CÔNG NGHỆ CYBERNEXUS OS<br/>Đại diện: Ban Giám Đốc | Mã số thuế: 0318892439<br/>Địa chỉ: Tòa nhà Tech Tower, Quận 1, TP. Hồ Chí Minh.",
        f"<b>BÊN KHÁCH HÀNG (BÊN B):</b> {tenant_name}<br/>Mã khách hàng: {tenant_code} | Đại diện: Ông Nguyễn Minh Quân<br/>Địa chỉ kinh doanh: 123 Đường Số 5, P. Linh Trung, TP. Thủ Đức, TP.HCM.",
        "<b>ĐIỀU 1: PHẠM VI DỊCH VỤ & GÓI CƯỚC</b><br/>Bên A cung cấp cho Bên B quyền sử dụng bộ giải pháp phần mềm CyberNexus Enterprise Edition bao gồm: Lõi bán hàng POS Core, VietQR tự động, KDS Bếp, Media Stream Server nội bộ, 10-Band Audio Equalizer và Module Điều tiết băng thông Router QoS.",
        "<b>ĐIỀU 2: THỜI HẠN VÀ GIÁ TRỊ HỢP ĐỒNG</b><br/>- Thời hạn bản quyền: 12 Tháng (Hiệu lực từ 10/11/2026 đến 10/11/2027).<br/>- Tổng giá trị hợp đồng: <b>5.988.000 VNĐ</b> (Năm triệu chín trăm tám mươi tám nghìn đồng).<br/>- Phương thức thanh toán: Chuyển khoản ngân hàng 100% khi kích hoạt.",
        "<b>ĐIỀU 3: BẢO HÀNH, BẢO TRÌ & NÂNG CẤP</b><br/>Bên A cam kết hỗ trợ kỹ thuật 24/7, tự động cập nhật bản vá bảo mật và sao lưu dữ liệu đám mây định kỳ cho Bên B trong suốt thời gian hiệu lực hợp đồng.",
        "Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để thực hiện."
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
    print(f"Đã tạo thành công PDF: {output_path}")

def create_invoice_pdf(output_path, tenant_name="GÓC PHỐ COFFEE & TEA", tenant_code="GP001"):
    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []

    story.append(Paragraph("HÓA ĐƠN ĐIỆN TỬ GIÁ TRỊ GIA TĂNG (VAT)", title_style))
    story.append(Paragraph("Ký hiệu: 1C26TCN | Số hóa đơn: 00124 | Ngày lập: 10/11/2026", subtitle_style))
    story.append(Spacer(1, 15))

    buyer_info = [
        [Paragraph("<b>Đơn vị bán hàng:</b> CÔNG TY CP CÔNG NGHỆ CYBERNEXUS OS<br/><b>MST:</b> 0318892439<br/><b>Địa chỉ:</b> Tòa nhà Tech Tower, Quận 1, TP. Hồ Chí Minh", body_style),
         Paragraph(f"<b>Đơn vị mua hàng:</b> {tenant_name}<br/><b>Mã Quán:</b> {tenant_code}<br/><b>Người mua:</b> Nguyễn Minh Quân<br/><b>Địa chỉ:</b> 123 Đường Số 5, Linh Trung, Thủ Đức", body_style)]
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
        ["1", "Gói Dịch Vụ SaaS CyberNexus Enterprise (12 Tháng)", "Gói", "1", "3.490.000", "3.490.000"],
        ["2", "Bản quyền Module Media Stream Server & EQ Âm Thanh", "Module", "1", "1.490.000", "1.490.000"],
        ["3", "Bản quyền Module Network QoS & Router Traffic Control", "Module", "1", "1.008.000", "1.008.000"],
        ["", "Cộng tiền dịch vụ:", "", "", "", "5.988.000"],
        ["", "Thuế suất GTGT (VAT 10%):", "", "", "", "Đã bao gồm"],
        ["", "Tổng tiền thanh toán:", "", "", "", "<b>5.988.000 VNĐ</b>"]
    ]
    t_items = Table(items, colWidths=[25, 230, 35, 25, 95, 110])
    t_items.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
        ('GRID', (0,0), (-1,3), 0.5, colors.HexColor('#cbd5e1')),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (2,0), (3,-1), 'CENTER'),
        ('ALIGN', (4,0), (-1,-1), 'RIGHT'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('LINEBELOW', (0,4), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TEXTCOLOR', (-1,-1), (-1,-1), colors.HexColor('#dc2626')),
    ]))
    story.append(t_items)
    story.append(Spacer(1, 15))

    story.append(Paragraph("<b>Trạng thái:</b> Đã thanh toán 100% qua Chuyển khoản OCB (Giao dịch hoàn tất).<br/>Hóa đơn điện tử có giá trị pháp lý lưu trữ theo quy định của Tổng Cục Thuế.", body_style))
    story.append(Spacer(1, 20))

    sign_data = [
        [Paragraph("<b>NGƯỜI MUA HÀNG</b>", subtitle_style), Paragraph("<b>NGƯỜI BÁN HÀNG</b><br/>(Ký số điện tử)", subtitle_style)],
        [Spacer(1, 35), Spacer(1, 35)],
        [Paragraph("Nguyễn Minh Quân", subtitle_style), Paragraph("CyberNexus CA - Signed Valid", subtitle_style)]
    ]
    t_sign = Table(sign_data, colWidths=[260, 260])
    t_sign.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    story.append(t_sign)

    doc.build(story)
    print(f"Đã tạo thành công PDF: {output_path}")

if __name__ == "__main__":
    base_dir = r"X:\My Drive\Code dev\cybernexus-os\master\packages\GP001"
    os.makedirs(os.path.join(base_dir, "handover"), exist_ok=True)
    os.makedirs(os.path.join(base_dir, "contracts"), exist_ok=True)
    os.makedirs(os.path.join(base_dir, "invoices"), exist_ok=True)

    create_handover_pdf(os.path.join(base_dir, "handover", "BB-NGHIEM-THU-GP001.pdf"))
    create_contract_pdf(os.path.join(base_dir, "contracts", "HD-CBNX-2026-GP001.pdf"))
    create_invoice_pdf(os.path.join(base_dir, "invoices", "VAT-CBNX-2026-00124.pdf"))
