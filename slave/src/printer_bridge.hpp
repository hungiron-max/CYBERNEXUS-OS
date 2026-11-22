#pragma once

#include "httplib.h"
#include "nlohmann/json.hpp"
#include <algorithm>
#include <cstdint>
#include <sstream>
#include <string>
#include <vector>

#ifdef _WIN32
#include <winspool.h>
#endif

namespace SaleApp::Hardware {

using json = nlohmann::json;

class PrinterBridge {
public:
    static bool shouldOpenCashDrawer(const std::string& paymentMethod,
                                     bool isTemp,
                                     bool isReprint,
                                     double splitCashAmount = 0.0) {
        if (isTemp || isReprint) return false;
        if (paymentMethod == "cash") return true;
        if (paymentMethod == "split" && splitCashAmount > 0.5) return true;
        return false;
    }

    static std::string buildCashDrawerPulse() {
        // Standard ESC/POS kick drawer pin 2: ESC p 0 25 250
        return std::string("\x1B\x70\x00\x19\xFA", 5);
    }

    static std::string foldVietnameseAscii(const std::string& s) {
        static const std::pair<const char*, const char*> kMap[] = {
            {"à","a"},{"á","a"},{"ạ","a"},{"ả","a"},{"ã","a"},{"â","a"},{"ầ","a"},{"ấ","a"},{"ậ","a"},{"ẩ","a"},{"ẫ","a"},{"ă","a"},{"ằ","a"},{"ắ","a"},{"ặ","a"},{"ẳ","a"},{"ẵ","a"},
            {"À","A"},{"Á","A"},{"Ạ","A"},{"Ả","A"},{"Ã","A"},{"Â","A"},{"Ầ","A"},{"Ấ","A"},{"Ậ","A"},{"Ẩ","A"},{"Ẫ","A"},{"Ă","A"},{"Ằ","A"},{"Ắ","A"},{"Ặ","A"},{"Ẳ","A"},{"Ẵ","A"},
            {"è","e"},{"é","e"},{"ẹ","e"},{"ẻ","e"},{"ẽ","e"},{"ê","e"},{"ề","e"},{"ế","e"},{"ệ","e"},{"ể","e"},{"ễ","e"},
            {"È","E"},{"É","E"},{"Ẹ","E"},{"Ẻ","E"},{"Ẽ","E"},{"Ê","E"},{"Ề","E"},{"Ế","E"},{"Ệ","E"},{"Ể","E"},{"Ễ","E"},
            {"ì","i"},{"í","i"},{"ị","i"},{"ỉ","i"},{"ĩ","i"},{"Ì","I"},{"Í","I"},{"Ị","I"},{"Ỉ","I"},{"Ĩ","I"},
            {"ò","o"},{"ó","o"},{"ọ","o"},{"ỏ","o"},{"õ","o"},{"ô","o"},{"ồ","o"},{"ố","o"},{"ộ","o"},{"ổ","o"},{"ỗ","o"},{"ơ","o"},{"ờ","o"},{"ớ","o"},{"ợ","o"},{"ở","o"},{"ỡ","o"},
            {"Ò","O"},{"Ó","O"},{"Ọ","O"},{"Ỏ","O"},{"Õ","O"},{"Ô","O"},{"Ồ","O"},{"Ố","O"},{"Ộ","O"},{"Ổ","O"},{"Ỗ","O"},{"Ơ","O"},{"Ờ","O"},{"Ớ","O"},{"Ợ","O"},{"Ở","O"},{"Ỡ","O"},
            {"ù","u"},{"ú","u"},{"ụ","u"},{"ủ","u"},{"ũ","u"},{"ư","u"},{"ừ","u"},{"ứ","u"},{"ự","u"},{"ử","u"},{"ữ","u"},
            {"Ù","U"},{"Ú","U"},{"Ụ","U"},{"Ủ","U"},{"Ũ","U"},{"Ư","U"},{"Ừ","U"},{"Ứ","U"},{"Ự","U"},{"Ử","U"},{"Ữ","U"},
            {"ỳ","y"},{"ý","y"},{"ỵ","y"},{"ỷ","y"},{"ỹ","y"},{"Ỳ","Y"},{"Ý","Y"},{"Ỵ","Y"},{"Ỷ","Y"},{"Ỹ","Y"},
            {"đ","d"},{"Đ","D"}
        };
        std::string out = s;
        for (const auto& kv : kMap) {
            size_t pos = 0;
            std::string k = kv.first;
            while ((pos = out.find(k, pos)) != std::string::npos) {
                out.replace(pos, k.size(), kv.second);
                pos += 1;
            }
        }
        return out;
    }

    static std::string fmtVnd(double v) {
        int64_t val = static_cast<int64_t>(v + 0.5);
        std::string raw = std::to_string(std::abs(val));
        std::string res;
        int cnt = 0;
        for (int i = static_cast<int>(raw.size()) - 1; i >= 0; --i) {
            if (cnt > 0 && cnt % 3 == 0) res.push_back('.');
            res.push_back(raw[i]);
            cnt++;
        }
        if (val < 0) res.push_back('-');
        std::reverse(res.begin(), res.end());
        return res;
    }

    static std::string buildReceiptEscPos(const json& order,
                                          const json& items,
                                          const json& store,
                                          const json& tplCfg,
                                          bool openDrawer,
                                          const std::string& watermark = "") {
        int widthChars = (tplCfg.value("paper_size", "80mm") == "58mm") ? 32 : 46;
        int feedLines = std::max(1, std::min(10, tplCfg.value("feed_lines", 4)));
        double lineH = tplCfg.value("line_height", 1.35);
        int escLineSpacing = std::max(24, std::min(80, static_cast<int>(lineH * 30.0)));

        std::string esc;
        esc += std::string("\x1B\x40", 2);                                    // Initialize printer
        esc += std::string("\x1B\x33") + static_cast<char>(escLineSpacing);   // ESC 3 n: line spacing
        std::string sep(widthChars, '-');

        auto appendCenter = [&](const std::string& line) {
            esc += std::string("\x1B\x61\x01", 3) + foldVietnameseAscii(line) + "\n";
        };
        auto appendLeft = [&](const std::string& line) {
            esc += std::string("\x1B\x61\x00", 3) + foldVietnameseAscii(line) + "\n";
        };

        std::string storeName = store.is_object() ? store.value("name", "CyberNexus POS") : "CyberNexus POS";
        std::string addr = store.is_object() ? store.value("address", "") : "";
        std::string phone = store.is_object() ? store.value("hotline", "") : "";

        esc += std::string("\x1B\x45\x01", 3); // Bold on
        appendCenter(storeName);
        esc += std::string("\x1B\x45\x00", 3);
        if (!addr.empty() && tplCfg.value("show_address", true)) appendCenter(addr);
        if (!phone.empty() && tplCfg.value("show_hotline", true)) appendCenter("Tel: " + phone);
        appendCenter(sep);

        if (!watermark.empty()) {
            esc += std::string("\x1B\x45\x01", 3);
            appendCenter(watermark);
            esc += std::string("\x1B\x45\x00", 3);
        }
        std::string langMode = tplCfg.value("receipt_lang_mode", "auto");
        bool isEn = (langMode == "en");
        bool isBiEn = (langMode == "bilingual_vi_en");
        bool isBiZh = (langMode == "bilingual_vi_zh");
        auto lbl = [&](const std::string& vi, const std::string& en, const std::string& zh = "") -> std::string {
            if (isEn) return en;
            if (isBiEn) return vi + " / " + en;
            if (isBiZh && !zh.empty()) return vi + " / " + zh;
            return vi;
        };
        std::string oCode = order.is_object() ? order.value("order_code", "") : "";
        std::string tCode = order.is_object() ? order.value("table_code", "") : "";
        appendCenter(lbl("HD", "No") + ": " + oCode + " | " + lbl("Ban", "Table") + ": " + tCode);
        appendLeft(sep);

        if (items.is_array()) {
            for (size_t i = 0; i < items.size(); ++i) {
                const auto& it = items[i];
                std::string name = it.value("product_name", it.value("name", "Mon"));
                std::string nameEn = it.value("product_name_en", "");
                if (isEn && !nameEn.empty()) name = nameEn;
                else if (isBiEn && !nameEn.empty() && nameEn != name) name = name + " (" + nameEn + ")";
                int qty = it.value("quantity", 1);
                double sub = it.value("subtotal", it.value("price", 0.0) * qty);
                appendLeft(std::to_string(i + 1) + ". " + name + " x" + std::to_string(qty) + " = " + fmtVnd(sub) + "d");
            }
        }
        appendLeft(sep);

        double total = order.is_object() ? order.value("total_amount", 0.0) : 0.0;
        std::string pm = order.is_object() ? order.value("payment_method", "cash") : "cash";
        esc += std::string("\x1B\x45\x01", 3);
        appendLeft(lbl("TONG CONG", "TOTAL", "TOTAL") + ": " + fmtVnd(total) + " d");
        esc += std::string("\x1B\x45\x00", 3);
        appendLeft(lbl("Hinh thuc", "Payment", "Payment") + ": " + pm);
        if (pm == "cash" && order.is_object()) {
            appendLeft(lbl("Khach dua", "Cash") + ": " + fmtVnd(order.value("cash_received", total)) + " d | " + lbl("Thoi", "Change") + ": " + fmtVnd(order.value("change_amount", 0.0)) + " d");
        }
        appendCenter(sep);
        std::string defaultFooter = isEn ? "Thank you & See you again!" : (isBiEn ? "Cam on quy khach! / Thank you!" : "Cam on quy khach!");
        std::string footer = tplCfg.value("footer_note", store.is_object() ? store.value("footer_note", defaultFooter) : defaultFooter);
        if (!footer.empty() && tplCfg.value("show_footer_note", true)) appendCenter(footer);

        for (int i = 0; i < feedLines; ++i) esc += "\n";
        esc += std::string("\x1D\x56\x42\x00", 4); // Partial cut
        if (openDrawer) {
            esc += buildCashDrawerPulse();
        }
        return esc;
    }

    static std::vector<std::string> listWindowsPrinters() {
        std::vector<std::string> list;
#ifdef _WIN32
        DWORD needed = 0, returned = 0;
        EnumPrintersA(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, nullptr, 2, nullptr, 0, &needed, &returned);
        if (needed > 0) {
            std::vector<uint8_t> buf(needed);
            if (EnumPrintersA(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, nullptr, 2, buf.data(), needed, &needed, &returned)) {
                auto* info = reinterpret_cast<PRINTER_INFO_2A*>(buf.data());
                for (DWORD i = 0; i < returned; ++i) {
                    if (info[i].pPrinterName && *info[i].pPrinterName) {
                        list.emplace_back(info[i].pPrinterName);
                    }
                }
            }
        }
#endif
        return list;
    }

    static bool sendRawWindowsSpooler(const std::string& printerName, const std::string& bytes, std::string& errOut) {
#ifdef _WIN32
        if (printerName.empty()) {
            errOut = "Chưa chọn tên máy in Windows!";
            return false;
        }
        HANDLE hPrinter = nullptr;
        if (!OpenPrinterA(const_cast<LPSTR>(printerName.c_str()), &hPrinter, nullptr) || !hPrinter) {
            errOut = "Không mở được máy in '" + printerName + "' (Win32 Error " + std::to_string(GetLastError()) + ")";
            return false;
        }
        DOC_INFO_1A docInfo{};
        docInfo.pDocName = const_cast<LPSTR>("CyberNexus ESC/POS Receipt");
        docInfo.pOutputFile = nullptr;
        docInfo.pDatatype = const_cast<LPSTR>("RAW");

        if (StartDocPrinterA(hPrinter, 1, reinterpret_cast<LPBYTE>(&docInfo)) == 0) {
            errOut = "StartDocPrinter thất bại (" + std::to_string(GetLastError()) + ")";
            ClosePrinter(hPrinter);
            return false;
        }
        if (!StartPagePrinter(hPrinter)) {
            errOut = "StartPagePrinter thất bại (" + std::to_string(GetLastError()) + ")";
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            return false;
        }
        DWORD written = 0;
        BOOL ok = WritePrinter(hPrinter, const_cast<char*>(bytes.data()), static_cast<DWORD>(bytes.size()), &written);
        if (!ok || written == 0) {
            errOut = "WritePrinter thất bại (" + std::to_string(GetLastError()) + ")";
        }
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return ok && written > 0;
#else
        (void)printerName; (void)bytes;
        errOut = "Windows Spooler chỉ hỗ trợ trên Windows";
        return false;
#endif
    }

    static bool sendRawLanTcp(const std::string& ip, int port, const std::string& bytes, std::string& errOut) {
        if (ip.empty() || port <= 0) {
            errOut = "Thiếu IP hoặc Port máy in LAN (mặc định 9100)!";
            return false;
        }
#ifdef _WIN32
        WSADATA wsa{};
        WSAStartup(MAKEWORD(2, 2), &wsa);
        SOCKET sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (sock == INVALID_SOCKET) {
            errOut = "Không thể khởi tạo TCP socket tới máy in!";
            return false;
        }
        DWORD tv = 3000;
        setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&tv), sizeof(tv));
        setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&tv), sizeof(tv));

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port = htons(static_cast<u_short>(port));
        addr.sin_addr.s_addr = inet_addr(ip.c_str());
        if (connect(sock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) {
            errOut = "Không kết nối được máy in LAN " + ip + ":" + std::to_string(port);
            closesocket(sock);
            return false;
        }
        size_t sentTotal = 0;
        while (sentTotal < bytes.size()) {
            int n = send(sock, bytes.data() + sentTotal, static_cast<int>(bytes.size() - sentTotal), 0);
            if (n <= 0) {
                errOut = "Gửi dữ liệu ESC/POS qua LAN thất bại";
                closesocket(sock);
                return false;
            }
            sentTotal += static_cast<size_t>(n);
        }
        closesocket(sock);
        return true;
#else
        (void)bytes;
        errOut = "LAN TCP printer socket stub";
        return false;
#endif
    }
};

} // namespace SaleApp::Hardware
