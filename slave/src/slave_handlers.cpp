#include "handlers.hpp"
#include "db.hpp"
#include "auth.hpp"
#include "body_parser.hpp"
#include "license.hpp"
#include "pos_bcrypt.h"
#include "ConfigManager.hpp"
#include "PluginManager.hpp"
#include <iostream>
#include <sstream>
#include <iomanip>
#include <ctime>
#include <fstream>
#include <filesystem>
#ifdef _WIN32
#include <iphlpapi.h>
#pragma comment(lib, "iphlpapi.lib")
#endif

namespace SaleApp::Backend {

void ApiHandlers::sendJson(httplib::Response& res, const json& data, int statusCode) {
    res.status = statusCode;
    res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.set_header("Pragma", "no-cache");
    res.set_header("Expires", "0");
    res.set_content(data.dump(), "application/json; charset=utf-8");
}

void ApiHandlers::sendError(httplib::Response& res, const std::string& message, int statusCode) {
    json err = {
        {"success", false},
        {"message", message}
    };
    sendJson(res, err, statusCode);
}

json ApiHandlers::parseBody(const httplib::Request& req) {
    return BodyParser::parseBody(req);
}

static std::string getCurrentTimestamp() {
    std::time_t now = std::time(nullptr);
    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", std::localtime(&now));
    return std::string(buf);
}

static std::string getCurrentDate() {
    std::time_t now = std::time(nullptr);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d", std::localtime(&now));
    return std::string(buf);
}

static std::string getAction(const httplib::Request& req, const json& body) {
    return BodyParser::getAction(req, body);
}

static double getDouble(const json& j, const std::string& key, double def = 0.0) {
    if (!j.is_object() || !j.contains(key) || j[key].is_null()) return def;
    const auto& v = j[key];
    if (v.is_number()) return v.get<double>();
    if (v.is_string()) {
        try { return std::stod(v.get<std::string>()); } catch (...) {}
    }
    return def;
}

static int64_t getInt(const json& j, const std::string& key, int64_t def = 0) {
    if (!j.is_object() || !j.contains(key) || j[key].is_null()) return def;
    const auto& v = j[key];
    if (v.is_number()) return v.get<int64_t>();
    if (v.is_string()) {
        try { return std::stoll(v.get<std::string>()); } catch (...) {}
    }
    return def;
}

static std::string getString(const json& j, const std::string& key, const std::string& def = "") {
    if (!j.is_object() || !j.contains(key) || j[key].is_null()) return def;
    const auto& v = j[key];
    if (v.is_string()) return v.get<std::string>();
    if (v.is_number_integer()) return std::to_string(v.get<int64_t>());
    if (v.is_number_float()) return std::to_string(v.get<double>());
    if (v.is_boolean()) return v.get<bool>() ? "1" : "0";
    return def;
}

// Lấy thông tin cấu hình quán từ bảng store_settings (hỗ trợ in hóa đơn & VietQR)
static json getStoreInfo(Database& db) {
    auto getVal = [&](const std::string& key, const std::string& def) -> std::string {
        auto r = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = :k LIMIT 1", {{":k", key}});
        if (r.is_null()) return def;
        return r.value("setting_value", def);
    };

    return {
        {"name", getVal("store_name", "GÓC PHỐ COFFEE & TEA")},
        {"hotline", getVal("store_hotline", "0932.885.131")},
        {"address", getVal("store_address", "123 Đường Số 5, P. Linh Trung, TP. Thủ Đức, TP.HCM")},
        {"wifi", getVal("store_wifi", "GocPho_Guest / pass: 88888888")},
        {"header_note", getVal("print_header_note", "Hân hạnh được phục vụ Quý khách!")},
        {"footer_note", getVal("print_footer_note", "Pass Wifi: 88888888 - Hẹn gặp lại quý khách!")},
        {"bank_id", getVal("bank_id", "OCB")},
        {"bank_account_no", getVal("bank_account_no", "0918608073")},
        {"bank_account_name", getVal("bank_account_name", "NGUYEN CHI HUNG")}
    };
}

// Đồng bộ trạng thái 3 yếu tố của hóa đơn: Bếp xong + Bưng ra + Thanh toán -> Hoàn thành & Dọn bàn
static void syncOrderStatus(Database& db, int64_t orderId) {
    if (orderId <= 0) return;
    auto order = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
    if (order.is_null()) return;

    std::string status = order.value("status", "pending");
    if (status == "cancelled") return;

    std::string payStatus = order.value("payment_status", "unpaid");
    bool isPaid = (payStatus == "paid" || (!order["paid_at"].is_null() && !order["paid_at"].get<std::string>().empty()));
    std::string kStatus = order.value("kitchen_status", "pending");
    bool isCooked = (kStatus == "ready" || kStatus == "served" || (!order["kitchen_ready_at"].is_null() && !order["kitchen_ready_at"].get<std::string>().empty()));
    bool isServed = (kStatus == "served" || (!order["served_at"].is_null() && !order["served_at"].get<std::string>().empty()));

    if (isCooked && isServed && isPaid) {
        db.execute(R"(
            UPDATE orders 
            SET status = 'completed', completed_at = COALESCE(completed_at, datetime('now'))
            WHERE id = :id
        )", {{":id", orderId}});

        // Release table
        if (!order["table_id"].is_null()) {
            int64_t tableId = order["table_id"].get<int64_t>();
            db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :tid AND active_order_id = :oid",
                       {{":tid", tableId}, {":oid", orderId}});
        }
    } else {
        db.execute("UPDATE orders SET status = 'pending', completed_at = NULL WHERE id = :id", {{":id", orderId}});
        if (!order["table_id"].is_null()) {
            int64_t tableId = order["table_id"].get<int64_t>();
            db.execute("UPDATE tables_areas SET status = 'occupied', active_order_id = :oid WHERE id = :tid",
                       {{":oid", orderId}, {":tid", tableId}});
        }
    }
}

// ==========================================
// 1. AUTH HANDLER (GIAI ĐOẠN 1 HOÀN CHỈNH)
// ==========================================
struct PendingQrLogin {
    std::string token;
    std::chrono::system_clock::time_point createdAt;
    bool approved = false;
    SessionUser user;
};
static std::mutex s_qrLoginMutex;
static std::unordered_map<std::string, PendingQrLogin> s_pendingQrLogins;

void ApiHandlers::handleAuth(const httplib::Request& req, httplib::Response& res) {
    json body = parseBody(req);
    std::string action = getAction(req, body);
    auto& auth = AuthService::instance();
    auto& db = Database::instance();

    // 1.1 Action: check (hoặc mặc định GET không truyền action)
    if (action.empty() || action == "check") {
        auto userOpt = auth.authenticate(req);

        // Đọc cấu hình thông tin quán
        auto storeRow = db.queryRow("SELECT * FROM store_settings WHERE id = 1 LIMIT 1");
        std::string storeName = storeRow.is_null() ? "Góc Phố Coffee & Tea" : storeRow.value("store_name", "Góc Phố Coffee & Tea");
        std::string hotline = storeRow.is_null() ? "0903100001" : storeRow.value("hotline", "");
        std::string address = storeRow.is_null() ? "" : storeRow.value("address", "");

        json systemObj = {
            {"app_name", "SaleApp POS C++ Edition"},
            {"version", "v2.5-cpp-native"},
            {"db_driver", "sqlite-native"},
            {"store_name", storeName},
            {"hotline", hotline},
            {"address", address}
        };

        if (userOpt.has_value()) {
            const auto& u = userOpt.value();
            json resp = {
                {"success", true},
                {"authenticated", true},
                {"user", {
                    {"id", u.id},
                    {"user_code", u.user_code},
                    {"username", u.username},
                    {"fullname", u.fullname},
                    {"role", u.role},
                    {"is_super_admin", u.is_super_admin}
                }},
                {"system", systemObj}
            };
            sendJson(res, resp);
        } else {
            json resp = {
                {"success", true},
                {"authenticated", false},
                {"system", systemObj}
            };
            sendJson(res, resp);
        }
        return;
    }

    // 1.2 Action: login (bằng username hoặc user_code + mật khẩu Bcrypt)
    if (action == "login") {
        std::string username = BodyParser::getParam(req, body, "username");
        if (username.empty()) username = BodyParser::getParam(req, body, "user_code");
        std::string password = BodyParser::getParam(req, body, "password");

        if (username.empty() || password.empty()) {
            sendJson(res, {{"success", false}, {"message", "Vui lòng nhập tên đăng nhập và mật khẩu!"}}, 400);
            return;
        }

        auto result = auth.login(username, password);
        if (result.value("success", false)) {
            std::string token = result.value("token", "");
            res.set_header("Set-Cookie", AuthService::formatCookie("pos_token", token));
            res.set_header("Set-Cookie", AuthService::formatCookie("PHPSESSID", token));
            sendJson(res, result);
        } else {
            sendJson(res, result, 401);
        }
        return;
    }

    // 1.3 Action: pin_login (hoặc login_pin cho thu ngân / nhân viên phục vụ)
    if (action == "pin_login" || action == "login_pin") {
        std::string pin = BodyParser::getParam(req, body, "pin_code");
        if (pin.empty()) pin = BodyParser::getParam(req, body, "pin");

        if (pin.empty()) {
            sendJson(res, {{"success", false}, {"message", "Vui lòng nhập mã PIN 4 số!"}}, 400);
            return;
        }

        auto result = auth.loginPin(pin);
        if (result.value("success", false)) {
            std::string token = result.value("token", "");
            res.set_header("Set-Cookie", AuthService::formatCookie("pos_token", token));
            res.set_header("Set-Cookie", AuthService::formatCookie("PHPSESSID", token));
            sendJson(res, result);
        } else {
            sendJson(res, result, 401);
        }
        return;
    }

    // 1.4 Action: heartbeat (duy trì trạng thái online & tính giờ làm việc)
    if (action == "heartbeat") {
        auto userOpt = auth.authenticate(req);
        if (!userOpt.has_value()) {
            sendJson(res, {{"success", false}, {"authenticated", false}, {"message", "Chưa đăng nhập hoặc phiên đã hết hạn!"}}, 401);
            return;
        }

        std::string token = auth.extractToken(req);
        auth.touchSession(token);

        db.execute(
            "UPDATE users SET is_online = 1, last_active_at = datetime('now') WHERE id = :id",
            {{":id", userOpt->id}}
        );

        sendJson(res, {
            {"success", true},
            {"online", true},
            {"timestamp", getCurrentTimestamp()},
            {"user_id", userOpt->id}
        });
        return;
    }

    // 1.5 Action: logout (hủy phiên & xóa cookie)
    if (action == "logout") {
        std::string token = auth.extractToken(req);
        auth.destroySession(token);

        res.set_header("Set-Cookie", AuthService::formatClearCookie("pos_token"));
        res.set_header("Set-Cookie", AuthService::formatClearCookie("PHPSESSID"));
        res.set_header("Set-Cookie", AuthService::formatClearCookie("pos_remember"));

        sendJson(res, {{"success", true}, {"message", "Đã đăng xuất thành công!"}});
        return;
    }

    // 1.6 Action: create_owner_qr (Khởi tạo mã QR đăng nhập cho Chủ Quán)
    if (action == "create_owner_qr") {
        auto now = std::chrono::system_clock::now();
        int64_t ts = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
        std::string raw = std::to_string(ts) + "-" + std::to_string(std::rand());
        std::string qrToken = "OWNER-QR-" + AuthService::sha256(raw).substr(0, 16);

        {
            std::lock_guard<std::mutex> lock(s_qrLoginMutex);
            // Dọn dẹp token quá hạn (> 3 phút)
            for (auto it = s_pendingQrLogins.begin(); it != s_pendingQrLogins.end(); ) {
                auto diff = std::chrono::duration_cast<std::chrono::seconds>(now - it->second.createdAt).count();
                if (diff > 180) it = s_pendingQrLogins.erase(it);
                else ++it;
            }
            s_pendingQrLogins[qrToken] = {qrToken, now, false, {}};
        }

        sendJson(res, {
            {"success", true},
            {"qr_token", qrToken},
            {"expires_in", 120},
            {"message", "Đã tạo mã QR đăng nhập Chủ Quán"}
        });
        return;
    }

    // 1.7 Action: check_owner_qr (Kiểm tra xem Chủ Quán đã duyệt trên App/Điện thoại chưa)
    if (action == "check_owner_qr") {
        std::string qrToken = BodyParser::getParam(req, body, "qr_token");
        if (qrToken.empty()) {
            sendError(res, "Thiếu tham số qr_token", 400);
            return;
        }

        std::lock_guard<std::mutex> lock(s_qrLoginMutex);
        auto it = s_pendingQrLogins.find(qrToken);
        if (it == s_pendingQrLogins.end()) {
            sendJson(res, {{"success", false}, {"expired", true}, {"message", "Mã QR không tồn tại hoặc đã hết hạn"}}, 404);
            return;
        }

        auto now = std::chrono::system_clock::now();
        auto diff = std::chrono::duration_cast<std::chrono::seconds>(now - it->second.createdAt).count();
        if (diff > 120) {
            s_pendingQrLogins.erase(it);
            sendJson(res, {{"success", false}, {"expired", true}, {"message", "Mã QR đã hết hạn, vui lòng lấy mã mới"}}, 410);
            return;
        }

        if (it->second.approved) {
            // Đã được duyệt thành công bởi Chủ Quán
            SessionUser u = it->second.user;
            s_pendingQrLogins.erase(it);

            std::string sessionToken = auth.createSession(u);
            res.set_header("Set-Cookie", AuthService::formatCookie("pos_token", sessionToken));
            res.set_header("Set-Cookie", AuthService::formatCookie("PHPSESSID", sessionToken));

            sendJson(res, {
                {"success", true},
                {"approved", true},
                {"token", sessionToken},
                {"user", {
                    {"id", u.id},
                    {"username", u.username},
                    {"fullname", u.fullname},
                    {"role", u.role},
                    {"is_super_admin", u.is_super_admin}
                }},
                {"message", "Xác thực Chủ Quán thành công!"}
            });
            return;
        }

        sendJson(res, {
            {"success", true},
            {"approved", false},
            {"remaining_seconds", 120 - diff},
            {"message", "Đang chờ Chủ Quán phê duyệt từ App"}
        });
        return;
    }

    // 1.8 Action: approve_owner_qr (Chủ Quán bấm phê duyệt trên App / Điện thoại hoặc nhập PIN bảo mật)
    if (action == "approve_owner_qr") {
        std::string qrToken = BodyParser::getParam(req, body, "qr_token");
        std::string pin = BodyParser::getParam(req, body, "pin");

        // Xác thực Chủ Quán: hoặc qua Session hiện tại (đã login trên App/Mobile), hoặc qua PIN 9999
        bool isAuthorized = false;
        SessionUser approvedUser;

        auto callerOpt = auth.authenticate(req);
        if (callerOpt.has_value() && (callerOpt->role == "admin" || callerOpt->is_super_admin)) {
            isAuthorized = true;
            approvedUser = *callerOpt;
        } else if (pin == "9999") {
            auto ownerRow = db.queryRow("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
            if (!ownerRow.is_null()) {
                approvedUser.id = ownerRow.value("id", 1);
                approvedUser.username = ownerRow.value("username", "admin");
                approvedUser.fullname = ownerRow.value("fullname", "Chủ Quán");
                approvedUser.role = "admin";
                approvedUser.is_super_admin = true;
                isAuthorized = true;
            } else {
                approvedUser.id = 1;
                approvedUser.username = "admin";
                approvedUser.fullname = "Chủ Quán";
                approvedUser.role = "admin";
                approvedUser.is_super_admin = true;
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            sendError(res, "Chỉ Chủ Quán (Mã PIN 9999 hoặc App Quản Trị) mới có quyền duyệt!", 403);
            return;
        }

        std::lock_guard<std::mutex> lock(s_qrLoginMutex);
        auto it = s_pendingQrLogins.find(qrToken);
        if (it == s_pendingQrLogins.end()) {
            sendError(res, "Mã QR đã hết hạn hoặc không tồn tại", 404);
            return;
        }

        it->second.approved = true;
        it->second.user = approvedUser;

        sendJson(res, {
            {"success", true},
            {"message", "Đã phê duyệt đăng nhập Chủ Quán thành công!"}
        });
        return;
    }

    sendError(res, "Hành động (Action) không hợp lệ: " + action, 400);
}

// ==========================================
// 2. CATEGORIES HANDLER (GIAI ĐOẠN 2 - BƯỚC 2.1)
// ==========================================
void ApiHandlers::handleCategories(const httplib::Request& req, httplib::Response& res) {
    auto& db = Database::instance();
    json body = parseBody(req);
    std::string action = getAction(req, body);

    // 1. GET: List all categories with product_count
    if (req.method == "GET" && action.empty()) {
        std::string sql = R"(
            SELECT c.*, COUNT(p.id) as product_count 
            FROM categories c 
            LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
            WHERE c.status = 'active'
            GROUP BY c.id 
            ORDER BY c.sort_order ASC, c.id ASC
        )";
        json list = db.query(sql);
        sendJson(res, {{"success", true}, {"data", list}});
        return;
    }

    // Check auth for write actions (Admin required)
    auto userOpt = AuthService::instance().authenticate(req);
    if (!userOpt.has_value() || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
        sendJson(res, {{"success", false}, {"message", "Bạn không có quyền thực hiện thao tác này (yêu cầu Admin)!"}}, 403);
        return;
    }

    // 2. POST: Add Category
    if (action.empty() || action == "add") {
        std::string name = BodyParser::getParam(req, body, "name");
        std::string icon = BodyParser::getParam(req, body, "icon", "coffee");
        int sortOrder = 0;
        try {
            std::string soStr = BodyParser::getParam(req, body, "sort_order", "0");
            sortOrder = std::stoi(soStr);
        } catch (...) {}

        if (name.empty()) {
            sendJson(res, {{"success", false}, {"message", "Tên nhóm hàng không được để trống!"}}, 400);
            return;
        }

        int64_t id = db.execute(
            "INSERT INTO categories (name, icon, sort_order, status) VALUES (:name, :icon, :sort_order, 'active')",
            {{":name", name}, {":icon", icon}, {":sort_order", sortOrder}}
        );

        sendJson(res, {{"success", true}, {"message", "Thêm nhóm hàng thành công!"}, {"id", id}});
        return;
    }

    // 3. POST / PUT: Update Category
    if (action == "update") {
        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        std::string name = BodyParser::getParam(req, body, "name");
        std::string icon = BodyParser::getParam(req, body, "icon", "coffee");
        int sortOrder = 0;
        try { sortOrder = std::stoi(BodyParser::getParam(req, body, "sort_order", "0")); } catch (...) {}

        if (id <= 0 || name.empty()) {
            sendJson(res, {{"success", false}, {"message", "Dữ liệu cập nhật nhóm hàng không hợp lệ!"}}, 400);
            return;
        }

        db.execute(
            "UPDATE categories SET name = :name, icon = :icon, sort_order = :sort_order WHERE id = :id",
            {{":name", name}, {":icon", icon}, {":sort_order", sortOrder}, {":id", id}}
        );

        sendJson(res, {{"success", true}, {"message", "Cập nhật nhóm hàng thành công!"}});
        return;
    }

    // 4. POST / DELETE: Delete Category
    if (action == "delete") {
        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        if (id <= 0) {
            sendJson(res, {{"success", false}, {"message", "Mã nhóm hàng không hợp lệ!"}}, 400);
            return;
        }

        // Check if there are active products
        auto checkVal = db.queryScalar(
            "SELECT COUNT(*) FROM products WHERE category_id = :id AND status = 'active'",
            {{":id", id}}
        );
        int64_t activeCount = checkVal.is_number() ? checkVal.get<int64_t>() : 0;
        if (activeCount > 0) {
            sendJson(res, {{"success", false}, {"message", "Không thể xóa nhóm hàng đang có món ăn/sản phẩm!"}}, 400);
            return;
        }

        db.execute("DELETE FROM categories WHERE id = :id", {{":id", id}});
        sendJson(res, {{"success", true}, {"message", "Đã xóa nhóm hàng!"}});
        return;
    }

    sendJson(res, {{"success", false}, {"message", "Yêu cầu không hợp lệ!"}}, 400);
}

// ==========================================
// 3. PRODUCTS HANDLER (GIAI ĐOẠN 2 - BƯỚC 2.2 & 2.3)
// ==========================================
void ApiHandlers::handleProducts(const httplib::Request& req, httplib::Response& res) {
    auto& db = Database::instance();
    json body = parseBody(req);
    std::string action = getAction(req, body);

    // 1. GET: Fetch Products with filters (Bước 2.2)
    if (req.method == "GET" && action.empty()) {
        std::string sql = R"(
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE 1=1
        )";
        std::vector<std::pair<std::string, json>> params;

        if (BodyParser::hasParam(req, body, "category_id")) {
            try {
                int catId = std::stoi(BodyParser::getParam(req, body, "category_id"));
                if (catId > 0) {
                    sql += " AND p.category_id = :category_id";
                    params.push_back({":category_id", catId});
                }
            } catch (...) {}
        }

        std::string search = BodyParser::getParam(req, body, "q");
        if (search.empty()) search = BodyParser::getParam(req, body, "search");
        if (!search.empty()) {
            sql += " AND (p.name LIKE :search OR p.code LIKE :search)";
            params.push_back({":search", "%" + search + "%"});
        }

        if (BodyParser::hasParam(req, body, "is_topping")) {
            try {
                int isTop = std::stoi(BodyParser::getParam(req, body, "is_topping"));
                sql += " AND p.is_topping = :is_topping";
                params.push_back({":is_topping", isTop});
            } catch (...) {}
        }

        std::string status = BodyParser::getParam(req, body, "status");
        if (!status.empty()) {
            sql += " AND p.status = :status";
            params.push_back({":status", status});
        }

        sql += " ORDER BY p.id ASC";

        json products = db.query(sql, params);

        // Security: Giấu cost_price nếu người gọi không phải Admin
        auto userOpt = AuthService::instance().authenticate(req);
        bool isAdmin = userOpt.has_value() && (userOpt->role == "admin" || userOpt->is_super_admin);
        if (!isAdmin) {
            for (auto& item : products) {
                if (item.contains("cost_price")) {
                    item.erase("cost_price");
                }
            }
        }

        sendJson(res, {{"success", true}, {"data", products}});
        return;
    }

    // Step 2.3: Toggle Status (active <-> locked) - Cho phép Admin, Bếp và Thu ngân
    if (action == "toggle_status" || action == "toggle_lock") {
        auto userOpt = AuthService::instance().authenticate(req);
        std::string uName = userOpt.has_value() ? userOpt->fullname : "Nhân viên";
        std::string uRole = userOpt.has_value() ? userOpt->role : "kitchen";
        int64_t uId = userOpt.has_value() ? userOpt->id : 1;

        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        if (id <= 0) {
            sendJson(res, {{"success", false}, {"message", "Mã mặt hàng không hợp lệ!"}}, 400);
            return;
        }

        auto prodRow = db.queryRow("SELECT * FROM products WHERE id = :id", {{":id", id}});
        if (prodRow.is_null()) {
            sendJson(res, {{"success", false}, {"message", "Mặt hàng không tồn tại!"}}, 404);
            return;
        }

        std::string prodName = prodRow.value("name", "");
        std::string prodCode = prodRow.value("code", "");
        std::string curStatus = prodRow.value("status", "active");

        std::string forceStatus = BodyParser::getParam(req, body, "status");
        std::string newStatus;
        if (forceStatus == "active" || forceStatus == "locked") {
            newStatus = forceStatus;
        } else {
            newStatus = (curStatus == "active") ? "locked" : "active";
        }

        db.execute("UPDATE products SET status = :st WHERE id = :id", {{":st", newStatus}, {":id", id}});

        bool isLocked = (newStatus == "locked");
        std::string notifTitle = isLocked ? ("TẠM KHÓA MÓN: " + prodName) : ("MỞ BÁN LẠI: " + prodName);
        std::string notifMsg = isLocked 
            ? ("Món '" + prodName + "' (" + prodCode + ") đã bị TẠM KHÓA trên thực đơn (Báo hết hàng bởi " + uName + ").")
            : ("Món '" + prodName + "' (" + prodCode + ") đã được MỞ BÁN LẠI trên thực đơn bởi " + uName + ".");

        // Thông báo chuông cho nhân viên quầy và phục vụ
        db.execute(R"(
            INSERT INTO app_notifications (type, order_id, table_code, title, message, is_read_waiter, is_read_cashier, created_at)
            VALUES (:type, 0, 'THỰC ĐƠN', :title, :message, 0, 0, datetime('now'))
        )", {
            {":type", isLocked ? "product_locked" : "product_unlocked"},
            {":title", notifTitle},
            {":message", notifMsg}
        });

        // Ghi nhật ký bếp (kitchen_service_logs)
        db.execute(R"(
            INSERT INTO kitchen_service_logs (order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, note, created_at)
            VALUES (0, 'MENU', 'THỰC ĐƠN', :action, :label, :uid, :uname, :urole, :note, datetime('now'))
        )", {
            {":action", isLocked ? "lock_product" : "unlock_product"},
            {":label", isLocked ? "Tạm khóa món (Hết hàng)" : "Mở bán lại món"},
            {":uid", uId},
            {":uname", uName},
            {":urole", uRole},
            {":note", notifMsg}
        });

        // Ghi nhật ký Kiểm toán nội bộ (audit_logs)
        try {
            db.execute(R"(
                INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                VALUES (:acode, :albl, 'INFO', 0, :pcode, 'THỰC ĐƠN', 0, :rsn, :uid, :uname, :urole, :dtl, :cat)
            )", {
                {":acode", isLocked ? "LOCK_PRODUCT_86" : "UNLOCK_PRODUCT_86"},
                {":albl", isLocked ? ("Báo hết món (86): " + prodName) : ("Mở bán lại món: " + prodName)},
                {":pcode", prodCode},
                {":rsn", isLocked ? "Bếp/Quầy báo tạm hết nguyên liệu" : "Bếp/Quầy mở bán trở lại"},
                {":uid", uId},
                {":uname", uName},
                {":urole", uRole},
                {":dtl", notifMsg},
                {":cat", getCurrentTimestamp()}
            });
        } catch (...) {}

        sendJson(res, {
            {"success", true},
            {"message", isLocked ? ("Đã tạm khóa món '" + prodName + "' (Báo hết hàng)!") : ("Đã mở bán lại món '" + prodName + "'!")},
            {"product_id", id},
            {"product_name", prodName},
            {"status", newStatus}
        });
        return;
    }

    // Check Admin cho CRUD món ăn
    auto userOpt = AuthService::instance().authenticate(req);
    if (!userOpt.has_value() || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
        sendJson(res, {{"success", false}, {"message", "Bạn không có quyền thực hiện thao tác này (yêu cầu Admin)!"}}, 403);
        return;
    }

    // 2. POST: Add Product
    if (action.empty() || action == "add") {
        std::string code = BodyParser::getParam(req, body, "code");
        std::string name = BodyParser::getParam(req, body, "name");
        int64_t category_id = 1;
        try { category_id = std::stoll(BodyParser::getParam(req, body, "category_id", "1")); } catch (...) {}
        double sale_price = 0.0;
        try {
            std::string pStr = BodyParser::getParam(req, body, "sale_price");
            if (pStr.empty()) pStr = BodyParser::getParam(req, body, "price", "0");
            sale_price = std::stod(pStr);
        } catch (...) {}
        double cost_price = 0.0;
        try { cost_price = std::stod(BodyParser::getParam(req, body, "cost_price", "0")); } catch (...) {}
        std::string unit = BodyParser::getParam(req, body, "unit", "ly");
        int is_topping = 0;
        try { is_topping = std::stoi(BodyParser::getParam(req, body, "is_topping", "0")); } catch (...) {}
        std::string image = BodyParser::getParam(req, body, "image");
        if (image.empty()) image = BodyParser::getParam(req, body, "image_url");
        std::string description = BodyParser::getParam(req, body, "description");

        if (name.empty()) {
            sendJson(res, {{"success", false}, {"message", "Tên món không được để trống!"}}, 400);
            return;
        }

        if (code.empty()) {
            auto countVal = db.queryScalar("SELECT COUNT(*) FROM products");
            int count = (countVal.is_number() ? countVal.get<int>() : 0) + 1;
            std::stringstream ss;
            ss << "SP" << std::setw(3) << std::setfill('0') << count;
            code = ss.str();
        }

        int64_t id = db.execute(R"(
            INSERT INTO products (code, name, category_id, sale_price, cost_price, unit, is_topping, image, description, status)
            VALUES (:code, :name, :cid, :price, :cost, :unit, :is_top, :img, :desc, 'active')
        )", {
            {":code", code}, {":name", name}, {":cid", category_id},
            {":price", sale_price}, {":cost", cost_price}, {":unit", unit},
            {":is_top", is_topping}, {":img", image}, {":desc", description}
        });

        sendJson(res, {{"success", true}, {"message", "Thêm món thành công!"}, {"id", id}});
        return;
    }

    // 3. POST: Update Product
    if (action == "update") {
        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        std::string name = BodyParser::getParam(req, body, "name");
        int64_t category_id = 1;
        try { category_id = std::stoll(BodyParser::getParam(req, body, "category_id", "1")); } catch (...) {}
        double sale_price = 0.0;
        try {
            std::string pStr = BodyParser::getParam(req, body, "sale_price");
            if (pStr.empty()) pStr = BodyParser::getParam(req, body, "price", "0");
            sale_price = std::stod(pStr);
        } catch (...) {}
        double cost_price = 0.0;
        try { cost_price = std::stod(BodyParser::getParam(req, body, "cost_price", "0")); } catch (...) {}
        std::string unit = BodyParser::getParam(req, body, "unit", "ly");
        std::string image = BodyParser::getParam(req, body, "image");
        if (image.empty()) image = BodyParser::getParam(req, body, "image_url");
        std::string description = BodyParser::getParam(req, body, "description");

        if (id <= 0 || name.empty()) {
            sendJson(res, {{"success", false}, {"message", "Dữ liệu cập nhật món không hợp lệ!"}}, 400);
            return;
        }

        db.execute(R"(
            UPDATE products 
            SET name = :name, category_id = :cid, sale_price = :price, cost_price = :cost, 
                unit = :unit, image = :img, description = :desc
            WHERE id = :id
        )", {
            {":id", id}, {":name", name}, {":cid", category_id},
            {":price", sale_price}, {":cost", cost_price}, {":unit", unit},
            {":img", image}, {":desc", description}
        });

        sendJson(res, {{"success", true}, {"message", "Cập nhật món thành công!"}});
        return;
    }

    // 4. POST: Delete Product
    if (action == "delete") {
        int64_t id = 0;
        try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
        if (id <= 0) {
            sendJson(res, {{"success", false}, {"message", "Mã mặt hàng không hợp lệ!"}}, 400);
            return;
        }
        db.execute("UPDATE products SET status = 'deleted' WHERE id = :id", {{":id", id}});
        sendJson(res, {{"success", true}, {"message", "Đã xóa món ăn!"}});
        return;
    }

    sendJson(res, {{"success", false}, {"message", "Yêu cầu không hợp lệ!"}}, 400);
}

// ==========================================
// 4. TABLES & AREAS HANDLER (GIAI ĐOẠN 2 - BƯỚC 2.4)
// ==========================================
void ApiHandlers::handleTables(const httplib::Request& req, httplib::Response& res) {
    auto& db = Database::instance();
    json body = parseBody(req);
    std::string action = getAction(req, body);

    // 1. GET: Fetch all tables with real-time active order info (Bước 2.4)
    if (req.method == "GET" && action.empty()) {
        // 1a. Auto-complete any order that meets all 3 factors (Cooking, Serving, Payment)
        db.execute(R"(
            UPDATE orders 
            SET status = 'completed', 
                completed_at = COALESCE(completed_at, paid_at, served_at, datetime('now'))
            WHERE status = 'pending' 
              AND (payment_status = 'paid' OR paid_at IS NOT NULL) 
              AND (kitchen_status = 'served' OR served_at IS NOT NULL)
        )");

        // 1b. Auto-free tables that have no active pending order
        db.execute(R"(
            UPDATE tables_areas 
            SET status = 'free', active_order_id = NULL 
            WHERE id NOT IN (SELECT table_id FROM orders WHERE status = 'pending' AND table_id IS NOT NULL)
        )");

        // 1c. Fetch tables list
        std::string sql = R"(
            SELECT 
                t.id,
                t.code,
                t.name,
                t.area_type,
                CASE WHEN o.id IS NOT NULL THEN 'occupied' ELSE 'free' END as status,
                o.id as active_order_id,
                COALESCE(o.guest_count, t.guest_count, 1) as guest_count,
                t.sort_order,
                t.created_at,
                o.id as order_id,
                o.order_code,
                o.customer_name,
                CASE WHEN o.kitchen_status = 'awaiting_waiter' THEN 1 ELSE 0 END as customer_order_pending,
                o.total_amount,
                o.subtotal,
                o.kitchen_status,
                o.kitchen_ready_at,
                o.served_at,
                o.payment_status,
                o.paid_at,
                o.created_at as order_created_at,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count,
                (SELECT COUNT(*) FROM orders pending_orders WHERE pending_orders.table_id = t.id AND pending_orders.status = 'pending') as open_order_count
            FROM tables_areas t
            LEFT JOIN orders o ON o.id = COALESCE(
                (SELECT active_order.id FROM orders active_order WHERE active_order.id = t.active_order_id AND active_order.status = 'pending' LIMIT 1),
                (SELECT MAX(pending_order.id) FROM orders pending_order WHERE pending_order.table_id = t.id AND pending_order.status = 'pending')
            )
            ORDER BY t.sort_order ASC, t.id ASC
        )";

        json tables = db.query(sql);

        // Group by area_type: 'MANG_VE' and 'TAI_QUAN'
        json grouped = {
            {"MANG_VE", json::array()},
            {"TAI_QUAN", json::array()}
        };

        for (const auto& t : tables) {
            std::string area = t.value("area_type", "TAI_QUAN");
            if (!grouped.contains(area)) {
                grouped[area] = json::array();
            }
            grouped[area].push_back(t);
        }

        sendJson(res, {
            {"success", true},
            {"data", tables},
            {"grouped", grouped},
            {"qr_error", nullptr}
        });
        return;
    }

    // 2. POST: Switch Table (Chuyển bàn)
    if (action == "switch_table") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value()) {
            sendJson(res, {{"success", false}, {"message", "Chưa đăng nhập!"}}, 401);
            return;
        }

        int64_t fromTableId = 0, toTableId = 0;
        try { fromTableId = std::stoll(BodyParser::getParam(req, body, "from_table_id", "0")); } catch (...) {}
        try { toTableId = std::stoll(BodyParser::getParam(req, body, "to_table_id", "0")); } catch (...) {}

        if (fromTableId <= 0) {
            std::string fromCode = BodyParser::getParam(req, body, "from_table");
            if (!fromCode.empty()) {
                auto r = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", fromCode}});
                if (!r.is_null()) fromTableId = r.value("id", 0LL);
            }
        }
        if (toTableId <= 0) {
            std::string toCode = BodyParser::getParam(req, body, "to_table");
            if (!toCode.empty()) {
                auto r = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", toCode}});
                if (!r.is_null()) toTableId = r.value("id", 0LL);
            }
        }

        if (fromTableId <= 0 || toTableId <= 0 || fromTableId == toTableId) {
            sendJson(res, {{"success", false}, {"message", "Bàn nguồn và bàn đích không hợp lệ!"}}, 400);
            return;
        }

        auto fromTable = db.queryRow("SELECT * FROM tables_areas WHERE id = :id", {{":id", fromTableId}});
        if (fromTable.is_null() || fromTable.value("active_order_id", 0LL) <= 0) {
            sendJson(res, {{"success", false}, {"message", "Bàn nguồn không có hóa đơn đang mở!"}}, 400);
            return;
        }

        auto toTable = db.queryRow("SELECT * FROM tables_areas WHERE id = :id", {{":id", toTableId}});
        if (toTable.is_null()) {
            sendJson(res, {{"success", false}, {"message", "Bàn đích không tồn tại!"}}, 400);
            return;
        }

        if (toTable.value("status", "free") == "occupied" && toTable.value("active_order_id", 0LL) > 0) {
            sendJson(res, {{"success", false}, {"message", "Bàn đích đang có khách! Hãy dùng chức năng Gộp bàn."}}, 400);
            return;
        }

        int64_t orderId = fromTable.value("active_order_id", 0LL);
        std::string fromCode = fromTable.value("code", "");
        std::string toCode = toTable.value("code", "");

        db.beginTransaction();
        db.execute("UPDATE orders SET table_id = :table_id, table_code = :table_code WHERE id = :order_id", {
            {":table_id", toTableId},
            {":table_code", toCode},
            {":order_id", orderId}
        });
        db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id", {{":id", fromTableId}});
        db.execute("UPDATE tables_areas SET status = 'occupied', active_order_id = :order_id WHERE id = :id", {
            {":order_id", orderId},
            {":id", toTableId}
        });
        db.commit();

        sendJson(res, {{"success", true}, {"message", "Đã chuyển từ " + fromCode + " sang " + toCode + " thành công!"}});
        return;
    }

    // 3. POST: Merge Table (Gộp bàn)
    if (action == "merge_table") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value()) {
            sendJson(res, {{"success", false}, {"message", "Chưa đăng nhập!"}}, 401);
            return;
        }

        int64_t fromTableId = 0, toTableId = 0;
        try { fromTableId = std::stoll(BodyParser::getParam(req, body, "from_table_id", "0")); } catch (...) {}
        try { toTableId = std::stoll(BodyParser::getParam(req, body, "to_table_id", "0")); } catch (...) {}

        if (fromTableId <= 0) {
            std::string sourceCode = BodyParser::getParam(req, body, "source_table");
            if (!sourceCode.empty()) {
                auto r = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", sourceCode}});
                if (!r.is_null()) fromTableId = r.value("id", 0LL);
            }
        }
        if (toTableId <= 0) {
            std::string targetCode = BodyParser::getParam(req, body, "target_table");
            if (!targetCode.empty()) {
                auto r = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", targetCode}});
                if (!r.is_null()) toTableId = r.value("id", 0LL);
            }
        }

        if (fromTableId <= 0 || toTableId <= 0 || fromTableId == toTableId) {
            sendJson(res, {{"success", false}, {"message", "Bàn ghép và bàn nhận không hợp lệ!"}}, 400);
            return;
        }

        auto fromTable = db.queryRow("SELECT * FROM tables_areas WHERE id = :id", {{":id", fromTableId}});
        auto toTable = db.queryRow("SELECT * FROM tables_areas WHERE id = :id", {{":id", toTableId}});

        if (fromTable.is_null() || fromTable.value("active_order_id", 0LL) <= 0 ||
            toTable.is_null() || toTable.value("active_order_id", 0LL) <= 0) {
            sendJson(res, {{"success", false}, {"message", "Cả 2 bàn đều phải có hóa đơn đang mở để thực hiện gộp!"}}, 400);
            return;
        }

        int64_t fromOrderId = fromTable.value("active_order_id", 0LL);
        int64_t toOrderId = toTable.value("active_order_id", 0LL);
        std::string fromCode = fromTable.value("code", "");
        std::string toCode = toTable.value("code", "");

        db.beginTransaction();
        db.execute("UPDATE order_items SET order_id = :to_id WHERE order_id = :from_id", {
            {":to_id", toOrderId},
            {":from_id", fromOrderId}
        });

        auto sumVal = db.queryScalar("SELECT COALESCE(SUM(subtotal), 0) FROM order_items WHERE order_id = :id", {{":id", toOrderId}});
        double newSubtotal = sumVal.is_number() ? sumVal.get<double>() : 0.0;

        db.execute("UPDATE orders SET subtotal = :tot, total_amount = :tot WHERE id = :id", {
            {":tot", newSubtotal},
            {":id", toOrderId}
        });

        db.execute("UPDATE orders SET status = 'cancelled', note = :note WHERE id = :id", {
            {":note", "Đã gộp vào hóa đơn bàn " + toCode},
            {":id", fromOrderId}
        });

        db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id", {{":id", fromTableId}});
        db.commit();

        sendJson(res, {{"success", true}, {"message", "Đã gộp " + fromCode + " vào " + toCode + " thành công!"}});
        return;
    }

    // 4. Admin CRUD for tables
    if (action == "add_table" || action == "update_table" || action == "delete_table" || action == "batch_add_tables") {
        auto userOpt = AuthService::instance().authenticate(req);
        if (!userOpt.has_value() || (userOpt->role != "admin" && !userOpt->is_super_admin)) {
            sendJson(res, {{"success", false}, {"message", "Bạn không có quyền thực hiện thao tác này (yêu cầu Admin)!"}}, 403);
            return;
        }

        if (action == "add_table") {
            std::string code = BodyParser::getParam(req, body, "code");
            std::string name = BodyParser::getParam(req, body, "name");
            std::string areaType = BodyParser::getParam(req, body, "area_type", "TAI_QUAN");
            int sortOrder = 0;
            try { sortOrder = std::stoi(BodyParser::getParam(req, body, "sort_order", "0")); } catch (...) {}

            if (code.empty() || name.empty()) {
                sendJson(res, {{"success", false}, {"message", "Mã bàn và tên bàn không được để trống!"}}, 400);
                return;
            }

            int64_t id = db.execute(R"(
                INSERT INTO tables_areas (code, name, area_type, sort_order, status)
                VALUES (:code, :name, :area_type, :sort_order, 'free')
            )", {
                {":code", code}, {":name", name}, {":area_type", areaType}, {":sort_order", sortOrder}
            });

            sendJson(res, {{"success", true}, {"message", "Thêm bàn thành công!"}, {"table_id", id}});
            return;
        }

        if (action == "batch_add_tables") {
            std::string prefix = BodyParser::getParam(req, body, "prefix", "B");
            std::string areaType = BodyParser::getParam(req, body, "area_type", "TAI_QUAN");
            int fromNum = 1, toNum = 10, guestCount = 4;
            try { fromNum = std::stoi(BodyParser::getParam(req, body, "from_num", "1")); } catch (...) {}
            try { toNum = std::stoi(BodyParser::getParam(req, body, "to_num", "10")); } catch (...) {}
            try { guestCount = std::stoi(BodyParser::getParam(req, body, "guest_count", "4")); } catch (...) {}
            if (fromNum < 1) fromNum = 1;
            if (toNum < fromNum) toNum = fromNum;
            if (toNum - fromNum > 100) toNum = fromNum + 100; // safety limit

            db.beginTransaction();
            int created = 0;
            for (int i = fromNum; i <= toNum; ++i) {
                std::string numStr = (i < 10 ? "0" : "") + std::to_string(i);
                std::string code = prefix + numStr;
                std::string name = (areaType == "MANG_VE" ? "Mang Về " : "Bàn ") + numStr;
                auto check = db.queryRow("SELECT id FROM tables_areas WHERE code = :c", {{":c", code}});
                if (check.is_null()) {
                    db.execute(R"(
                        INSERT INTO tables_areas (code, name, area_type, guest_count, sort_order, status)
                        VALUES (:code, :name, :area_type, :guest_count, :sort_order, 'free')
                    )", {
                        {":code", code}, {":name", name}, {":area_type", areaType},
                        {":guest_count", guestCount}, {":sort_order", i}
                    });
                    created++;
                }
            }
            db.commit();

            sendJson(res, {{"success", true}, {"message", "Đã tạo thành công " + std::to_string(created) + " bàn mới!"}, {"created_count", created}});
            return;
        }

        if (action == "update_table") {
            int64_t id = 0;
            try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
            std::string code = BodyParser::getParam(req, body, "code");
            std::string name = BodyParser::getParam(req, body, "name");
            std::string areaType = BodyParser::getParam(req, body, "area_type", "TAI_QUAN");
            int sortOrder = 0;
            try { sortOrder = std::stoi(BodyParser::getParam(req, body, "sort_order", "0")); } catch (...) {}

            if (id <= 0 || code.empty() || name.empty()) {
                sendJson(res, {{"success", false}, {"message", "Dữ liệu cập nhật bàn không hợp lệ!"}}, 400);
                return;
            }

            db.execute(R"(
                UPDATE tables_areas 
                SET code = :code, name = :name, area_type = :area_type, sort_order = :sort_order 
                WHERE id = :id
            )", {
                {":code", code}, {":name", name}, {":area_type", areaType}, {":sort_order", sortOrder}, {":id", id}
            });

            sendJson(res, {{"success", true}, {"message", "Cập nhật bàn thành công!"}});
            return;
        }

        if (action == "delete_table") {
            int64_t id = 0;
            try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}
            db.execute("DELETE FROM tables_areas WHERE id = :id AND status = 'free'", {{":id", id}});
            sendJson(res, {{"success", true}, {"message", "Đã xóa bàn thành công!"}});
            return;
        }
    }

    sendJson(res, {{"success", false}, {"message", "Hành động không hợp lệ!"}}, 400);
}

// ==========================================
// 5. ORDERS & CHECKOUT HANDLER (GIAI ĐOẠN 3 - BƯỚC 3.1 ĐẾN 3.5)
// ==========================================
void ApiHandlers::handleOrders(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);

        // VietQR (Bước 3.4) - Hỗ trợ cả GET và POST
        if (action == "vietqr") {
            int64_t orderId = 0, tableId = 0;
            try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
            try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}
            double amount = 0.0;
            try { amount = std::stod(BodyParser::getParam(req, body, "amount", "0")); } catch (...) {}
            std::string orderCode = BodyParser::getParam(req, body, "order_code");

            if (orderId > 0) {
                auto ord = db.queryRow("SELECT total_amount, order_code FROM orders WHERE id = :id", {{":id", orderId}});
                if (!ord.is_null()) {
                    amount = getDouble(ord, "total_amount", 0.0);
                    orderCode = getString(ord, "order_code", "");
                }
            } else if (tableId > 0) {
                auto tbl = db.queryRow("SELECT active_order_id, code FROM tables_areas WHERE id = :id", {{":id", tableId}});
                if (!tbl.is_null() && getInt(tbl, "active_order_id", 0) > 0) {
                    auto ord = db.queryRow("SELECT total_amount, order_code FROM orders WHERE id = :id", {{":id", tbl["active_order_id"]}});
                    if (!ord.is_null()) {
                        amount = getDouble(ord, "total_amount", 0.0);
                        orderCode = getString(ord, "order_code", "");
                    }
                }
                if (orderCode.empty() && !tbl.is_null()) {
                    orderCode = getString(tbl, "code", "");
                }
            }

            if (orderCode.empty()) {
                orderCode = "POS-" + getCurrentTimestamp().substr(11, 2) + getCurrentTimestamp().substr(14, 2) + getCurrentTimestamp().substr(17, 2);
            }

            json store = getStoreInfo(db);
            std::string bankId = store.value("bank_id", "OCB");
            std::string accNo = store.value("bank_account_no", "0918608073");
            std::string accName = store.value("bank_account_name", "NGUYEN CHI HUNG");
            std::string transferNote = "TT " + orderCode;

            std::stringstream ss;
            ss << "https://img.vietqr.io/image/" << bankId << "-" << accNo << "-compact2.png?amount="
               << static_cast<int64_t>(amount) << "&addInfo=" << transferNote
               << "&accountName=" << accName;

            sendJson(res, {
                {"success", true},
                {"vietqr_url", ss.str()},
                {"bank_id", bankId},
                {"account_no", accNo},
                {"account_name", accName},
                {"amount", amount},
                {"note", transferNote}
            });
            return;
        }

        // ------------------------------------------
        // A. GET REQUESTS
        // ------------------------------------------
        if (req.method == "GET") {
            // Step 3.2: Kitchen Tickets (Đơn chế biến màn hình Bếp KDS)
            if (action == "kitchen_tickets") {
                std::string filterStatus = BodyParser::getParam(req, body, "status", "active");
                std::string todayDate = getCurrentDate();

                // Auto-complete any order that meets all 3 factors
                db.execute(R"(
                    UPDATE orders 
                    SET status = 'completed', 
                        completed_at = COALESCE(completed_at, paid_at, served_at, datetime('now'))
                    WHERE status = 'pending' 
                      AND (payment_status = 'paid' OR paid_at IS NOT NULL) 
                      AND (kitchen_status = 'served' OR served_at IS NOT NULL)
                )");

                std::string sql;
                if (filterStatus == "history") {
                    sql = R"(
                        SELECT o.*, t.name as table_name, t.area_type
                        FROM orders o
                        LEFT JOIN tables_areas t ON o.table_id = t.id
                        WHERE DATE(o.created_at) = ')" + todayDate + R"('
                          AND (o.status = 'completed' OR o.kitchen_status = 'archived')
                        ORDER BY o.id DESC LIMIT 100
                    )";
                } else {
                    sql = R"(
                        SELECT o.*, t.name as table_name, t.area_type
                        FROM orders o
                        LEFT JOIN tables_areas t ON o.table_id = t.id
                        WHERE o.status != 'cancelled'
                          AND COALESCE(o.kitchen_status, 'pending') != 'awaiting_waiter'
                    )";

                    if (filterStatus == "active") {
                        sql += " AND o.status = 'pending' AND (o.kitchen_status = 'pending' OR o.kitchen_status = 'ready' OR o.kitchen_status IS NULL)";
                    } else if (filterStatus == "served") {
                        sql += " AND o.status = 'pending' AND o.kitchen_status = 'served'";
                    } else {
                        sql += " AND o.status = 'pending'";
                    }

                    sql += R"(
                        ORDER BY 
                        CASE 
                            WHEN o.kitchen_status = 'ready' THEN 1
                            WHEN o.kitchen_status = 'pending' OR o.kitchen_status IS NULL THEN 2
                            WHEN o.kitchen_status = 'served' THEN 3
                            ELSE 4
                        END, o.id ASC
                    )";
                }

                json orders = db.query(sql);
                for (auto& o : orders) {
                    int64_t oid = getInt(o, "id", 0);
                    json items = db.query("SELECT * FROM order_items WHERE order_id = :oid ORDER BY id ASC", {{":oid", oid}});
                    for (auto& it : items) {
                        if (it.contains("toppings_json") && !it["toppings_json"].is_null() && it["toppings_json"].is_string()) {
                            try {
                                it["toppings"] = json::parse(it["toppings_json"].get<std::string>());
                            } catch (...) {
                                it["toppings"] = json::array();
                            }
                        } else {
                            it["toppings"] = json::array();
                        }
                    }
                    o["items"] = items;
                }

                auto cActive = db.queryScalar("SELECT COUNT(*) FROM orders WHERE status = 'pending' AND (kitchen_status = 'pending' OR kitchen_status = 'ready' OR kitchen_status IS NULL)");
                auto cServed = db.queryScalar("SELECT COUNT(*) FROM orders WHERE status = 'pending' AND kitchen_status = 'served'");
                auto cHistory = db.queryScalar("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = '" + todayDate + "' AND (status = 'completed' OR kitchen_status = 'archived')");
                auto cAll = db.queryScalar("SELECT COUNT(*) FROM orders WHERE status = 'pending' AND COALESCE(kitchen_status, 'pending') != 'awaiting_waiter'");

                json counts = {
                    {"active", cActive.is_number() ? cActive.get<int>() : 0},
                    {"served", cServed.is_number() ? cServed.get<int>() : 0},
                    {"history", cHistory.is_number() ? cHistory.get<int>() : 0},
                    {"all", cAll.is_number() ? cAll.get<int>() : 0}
                };

                sendJson(res, {{"success", true}, {"data", orders}, {"counts", counts}});
                return;
            }

            // Customer Order Status (Trang khách tra cứu đơn hàng)
            if (action == "customer_status") {
                std::string token = BodyParser::getParam(req, body, "token", BodyParser::getParam(req, body, "code", ""));
                if (token.empty() && req.has_param("token")) token = req.get_param_value("token");
                auto ord = db.queryRow("SELECT * FROM orders WHERE order_code = :c OR id = :c LIMIT 1", {{":c", token}});
                if (ord.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy đơn hàng!"}}, 404);
                    return;
                }
                sendJson(res, {
                    {"success", true},
                    {"order", ord}
                });
                return;
            }

            // Online & Takeaway Orders (Màn hình xử lý Đơn Online / Mang Về)
            if (action == "online_orders") {
                std::string filterStatus = BodyParser::getParam(req, body, "status", "active");
                std::string todayDate = getCurrentDate();

                std::string sql = R"(
                    SELECT o.*, t.name as table_name, t.area_type
                    FROM orders o
                    LEFT JOIN tables_areas t ON o.table_id = t.id
                    WHERE (t.area_type = 'takeaway' OR o.table_code LIKE 'MV%' OR o.table_id IS NULL OR o.table_code = 'ONLINE' OR o.order_code LIKE 'ONL%')
                      AND o.status != 'cancelled'
                )";

                if (filterStatus == "active") {
                    sql += " AND o.status = 'pending'";
                } else {
                    sql += " AND (DATE(o.created_at) = '" + todayDate + "' OR o.status = 'pending')";
                }
                sql += " ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.id DESC LIMIT 100";

                json orders = db.query(sql);
                for (auto& o : orders) {
                    int64_t oid = getInt(o, "id", 0);
                    json items = db.query("SELECT * FROM order_items WHERE order_id = :oid ORDER BY id ASC", {{":oid", oid}});
                    std::string summary;
                    for (size_t i = 0; i < items.size(); ++i) {
                        if (i > 0) summary += ", ";
                        summary += std::to_string(getInt(items[i], "quantity", 1)) + "x " + getString(items[i], "product_name", "Món");
                    }
                    o["items"] = items;
                    o["items_summary"] = summary.empty() ? "Chưa có chi tiết món" : summary;

                    std::string cname = getString(o, "customer_name", "");
                    std::string cphone = getString(o, "customer_phone", "");
                    if (cphone.empty()) {
                        size_t lp = cname.find('(');
                        size_t rp = cname.find(')', lp == std::string::npos ? 0 : lp);
                        if (lp != std::string::npos && rp != std::string::npos && rp > lp + 1) {
                            cphone = cname.substr(lp + 1, rp - lp - 1);
                        }
                    }
                    o["customer_phone"] = cphone;
                }

                sendJson(res, {{"success", true}, {"data", orders}});
                return;
            }

            // History
            if (action == "history") {
                std::string today = getCurrentDate();
                std::string sql = "SELECT * FROM orders WHERE DATE(created_at) = '" + today + "' ORDER BY id DESC LIMIT 100";
                sendJson(res, {{"success", true}, {"data", db.query(sql)}});
                return;
            }

            // Step 3.5: Detail / Reprint Bill (In hóa đơn K80/K58)
            if (action.empty() || action == "detail" || action == "reprint") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", BodyParser::getParam(req, body, "id", "0"))); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}

                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }

                if (orderId <= 0) {
                    std::string sql = "SELECT * FROM orders ORDER BY id DESC LIMIT 50";
                    sendJson(res, {{"success", true}, {"data", db.query(sql)}});
                    return;
                }

                auto order = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                if (order.is_null()) {
                    sendError(res, "Không tìm thấy hóa đơn!", 404);
                    return;
                }

                json items = db.query("SELECT * FROM order_items WHERE order_id = :id ORDER BY id ASC", {{":id", orderId}});
                for (auto& it : items) {
                    if (it.contains("toppings_json") && !it["toppings_json"].is_null() && it["toppings_json"].is_string()) {
                        try {
                            it["toppings"] = json::parse(it["toppings_json"].get<std::string>());
                        } catch (...) {
                            it["toppings"] = json::array();
                        }
                    } else {
                        it["toppings"] = json::array();
                    }
                }

                sendJson(res, {
                    {"success", true},
                    {"order", order},
                    {"items", items},
                    {"store", getStoreInfo(db)}
                });
                return;
            }
        }

        // ------------------------------------------
        // B. POST REQUESTS
        // ------------------------------------------
        if (req.method == "POST") {
            // Step 3.1: Save / Update Draft Order (Tạo đơn bán / cập nhật giỏ hàng / đặt hàng online)
            if (action == "save_order" || action == "save" || action == "customer_order") {
                int64_t tableId = 0;
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}
                std::string tableCode = BodyParser::getParam(req, body, "table_code", "MANG VỀ");
                std::string customerName = BodyParser::getParam(req, body, "customer_name", "Khách vãng lai");
                std::string customerPhone = BodyParser::getParam(req, body, "customer_phone");
                if (!customerPhone.empty() && customerName.find(customerPhone) == std::string::npos) {
                    if (customerName.empty() || customerName == "Khách vãng lai") {
                        customerName = "Khách online (" + customerPhone + ")";
                    } else {
                        customerName += " (" + customerPhone + ")";
                    }
                }
                int guestCount = 1;
                try { guestCount = std::max(1, std::stoi(BodyParser::getParam(req, body, "guest_count", "1"))); } catch (...) {}

                double discountValue = 0.0;
                try { discountValue = std::stod(BodyParser::getParam(req, body, "discount_value", "0")); } catch (...) {}
                std::string discountType = BodyParser::getParam(req, body, "discount_type", "amount");
                if (discountType != "percent") discountType = "amount";

                double vatPercent = 0.0;
                try { vatPercent = std::stod(BodyParser::getParam(req, body, "vat_percent", "0")); } catch (...) {}
                std::string note = BodyParser::getParam(req, body, "note");

                json items = json::array();
                if (body.contains("items") && body["items"].is_array()) {
                    items = body["items"];
                }

                if (items.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Giỏ hàng không có sản phẩm nào!"}}, 400);
                    return;
                }

                // Auto fill item info if missing (e.g. from customer_order)
                for (auto& item : items) {
                    int64_t pid = getInt(item, "id", getInt(item, "product_id", 0));
                    if (pid > 0 && (getDouble(item, "price", 0.0) <= 0 || getString(item, "name", "").empty())) {
                        auto pRow = db.queryRow("SELECT id, code, name, sale_price as price, unit FROM products WHERE id = :id", {{":id", pid}});
                        if (!pRow.is_null()) {
                            if (getString(item, "code", "").empty()) item["code"] = getString(pRow, "code", "");
                            if (getString(item, "name", "").empty()) item["name"] = getString(pRow, "name", "");
                            if (getDouble(item, "price", 0.0) <= 0) item["price"] = getDouble(pRow, "price", 0.0);
                            if (getString(item, "unit", "").empty()) item["unit"] = getString(pRow, "unit", "phần");
                        }
                    }
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t userId = userOpt.has_value() ? userOpt->id : 1;
                std::string userName = userOpt.has_value() ? userOpt->fullname : "Thu ngân";
                std::string userRole = userOpt.has_value() ? userOpt->role : "cashier";

                bool isAppendMode = false;
                if (body.contains("append")) {
                    if (body["append"].is_boolean()) isAppendMode = body["append"].get<bool>();
                    else if (body["append"].is_number()) isAppendMode = (body["append"].get<int>() != 0);
                }
                if (BodyParser::getParam(req, body, "mode") == "append") isAppendMode = true;

                // Find existing active order on table
                int64_t orderId = 0;
                if (tableId > 0) {
                    auto tCheck = db.queryRow("SELECT active_order_id, code FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tCheck.is_null()) {
                        orderId = getInt(tCheck, "active_order_id", 0);
                        tableCode = getString(tCheck, "code", tableCode);
                    }
                }

                // Calculate subtotal from items
                double subtotal = 0.0;
                for (const auto& item : items) {
                    int64_t qty = std::max<int64_t>(1, getInt(item, "quantity", 1));
                    double price = getDouble(item, "price", 0.0);
                    subtotal += (qty * price);
                }

                double discountAmount = 0.0;
                if (discountType == "percent") {
                    discountAmount = (subtotal * std::min(100.0, std::max(0.0, discountValue))) / 100.0;
                } else {
                    discountAmount = std::min(subtotal, std::max(0.0, discountValue));
                }

                double afterDiscount = std::max(0.0, subtotal - discountAmount);
                double vatAmount = (afterDiscount * std::max(0.0, vatPercent)) / 100.0;
                double totalAmount = afterDiscount + vatAmount;

                std::string nowStr = getCurrentTimestamp();
                std::string orderCode;

                db.beginTransaction();
                if (orderId > 0) {
                    auto existingOrder = db.queryRow("SELECT * FROM orders WHERE id = :id AND status = 'pending'", {{":id", orderId}});
                    if (existingOrder.is_null()) {
                        db.rollback();
                        sendJson(res, {{"success", false}, {"message", "Hóa đơn không tồn tại hoặc đã thanh toán trước đó!"}}, 400);
                        return;
                    }

                    orderCode = getString(existingOrder, "order_code", "");

                    if (isAppendMode) {
                        double oldSub = getDouble(existingOrder, "subtotal", 0.0);
                        double newSub = oldSub + subtotal;
                        double discVal = getDouble(existingOrder, "discount_value", 0.0);
                        std::string discT = getString(existingOrder, "discount_type", "amount");
                        double newDiscAmt = getDouble(existingOrder, "discount_amount", 0.0);
                        if (discT == "percent" && discVal > 0) {
                            newDiscAmt = (newSub * std::min(100.0, discVal)) / 100.0;
                        }
                        double vatPct = getDouble(existingOrder, "vat_percent", 0.0);
                        double newVatAmt = std::max(0.0, newSub - newDiscAmt) * (vatPct / 100.0);
                        double newTot = std::max(0.0, newSub - newDiscAmt) + newVatAmt;

                        db.execute(R"(
                            UPDATE orders SET
                                subtotal = :sub, discount_amount = :disc, vat_amount = :vat,
                                total_amount = :tot, kitchen_status = 'pending', kitchen_ready_at = NULL,
                                prep_time_minutes = 0
                            WHERE id = :id AND status = 'pending'
                        )", {
                            {":sub", newSub}, {":disc", newDiscAmt}, {":vat", newVatAmt},
                            {":tot", newTot}, {":id", orderId}
                        });
                        totalAmount = newTot;
                    } else {
                        // Replace mode
                        db.execute(R"(
                            UPDATE orders SET
                                customer_name = :cname, guest_count = :gc, subtotal = :sub,
                                discount_type = :dt, discount_value = :dv, discount_amount = :da,
                                vat_percent = :vp, vat_amount = :va, total_amount = :tot,
                                user_id = :uid, user_name = :uname, note = :note,
                                kitchen_status = 'pending'
                            WHERE id = :id AND status = 'pending'
                        )", {
                            {":cname", customerName}, {":gc", guestCount}, {":sub", subtotal},
                            {":dt", discountType}, {":dv", discountValue}, {":da", discountAmount},
                            {":vp", vatPercent}, {":va", vatAmount}, {":tot", totalAmount},
                            {":uid", userId}, {":uname", userName}, {":note", note}, {":id", orderId}
                        });

                        db.execute("DELETE FROM order_items WHERE order_id = :id", {{":id", orderId}});
                    }
                } else {
                    // New Order
                    std::string today = getCurrentDate();
                    std::string dateCompact = today.substr(2, 2) + today.substr(5, 2) + today.substr(8, 2);
                    std::string prefix = "HD" + dateCompact + "-";
                    auto maxVal = db.queryScalar("SELECT MAX(order_code) FROM orders WHERE order_code LIKE '" + prefix + "%'");
                    int64_t nextSeq = 1;
                    if (!maxVal.is_null() && maxVal.is_string()) {
                        std::string maxCode = maxVal.get<std::string>();
                        auto dashPos = maxCode.rfind('-');
                        if (dashPos != std::string::npos && dashPos + 1 < maxCode.length()) {
                            try {
                                nextSeq = std::stoll(maxCode.substr(dashPos + 1)) + 1;
                            } catch (...) {
                                nextSeq = 1;
                            }
                        }
                    }
                    while (true) {
                        std::stringstream ss;
                        ss << prefix << std::setw(4) << std::setfill('0') << nextSeq;
                        orderCode = ss.str();
                        auto existRow = db.queryScalar("SELECT id FROM orders WHERE order_code = '" + orderCode + "'");
                        if (existRow.is_null()) break;
                        nextSeq++;
                    }

                    orderId = db.execute(R"(
                        INSERT INTO orders (
                            order_code, table_id, table_code, customer_name, guest_count,
                            subtotal, discount_type, discount_value, discount_amount, vat_percent, vat_amount,
                            total_amount, status, payment_status, kitchen_status, user_id, user_name, note, created_at
                        ) VALUES (
                            :code, :tid, :tcode, :cname, :gc,
                            :sub, :dt, :dv, :da, :vp, :va,
                            :tot, 'pending', 'unpaid', 'pending', :uid, :uname, :note, :created
                        )
                    )", {
                        {":code", orderCode}, {":tid", tableId > 0 ? json(tableId) : json(nullptr)},
                        {":tcode", tableCode}, {":cname", customerName}, {":gc", guestCount},
                        {":sub", subtotal}, {":dt", discountType}, {":dv", discountValue}, {":da", discountAmount},
                        {":vp", vatPercent}, {":va", vatAmount}, {":tot", totalAmount},
                        {":uid", userId}, {":uname", userName}, {":note", note}, {":created", nowStr}
                    });

                    if (orderId <= 0) {
                        sendError(res, "Lỗi tạo hóa đơn (không thể lưu vào CSDL)!", 500);
                        return;
                    }

                    if (tableId > 0) {
                        db.execute("UPDATE tables_areas SET status = 'occupied', active_order_id = :oid, guest_count = :gc WHERE id = :id", {
                            {":oid", orderId}, {":gc", guestCount}, {":id", tableId}
                        });
                    }
                }

                // Insert order items
                for (const auto& item : items) {
                    int64_t pid = getInt(item, "id", getInt(item, "product_id", 0));
                    std::string pCode = getString(item, "code", getString(item, "product_code", ""));
                    std::string pName = getString(item, "name", getString(item, "product_name", ""));
                    std::string pUnit = getString(item, "unit", "ly");
                    int64_t qty = std::max<int64_t>(1, getInt(item, "quantity", 1));
                    double price = getDouble(item, "price", 0.0);
                    double lineTotal = qty * price;
                    std::string itemNote = getString(item, "note", "");
                    std::string tops = item.contains("toppings") ? item["toppings"].dump() : "";

                    db.execute(R"(
                        INSERT INTO order_items (
                            order_id, product_id, product_code, product_name, unit,
                            quantity, price, subtotal, note, toppings_json
                        ) VALUES (
                            :oid, :pid, :pcode, :pname, :unit,
                            :qty, :price, :sub, :note, :tops
                        )
                    )", {
                        {":oid", orderId}, {":pid", pid}, {":pcode", pCode}, {":pname", pName}, {":unit", pUnit},
                        {":qty", qty}, {":price", price}, {":sub", lineTotal}, {":note", itemNote}, {":tops", tops}
                    });
                }

                // Kitchen Service Log
                std::string logAction = isAppendMode ? "add_items" : "order_created";
                std::string logLabel = isAppendMode ? "Gọi thêm món" : "Nhận order món";
                std::string logNote = "Order bàn " + tableCode + " (" + std::to_string(items.size()) + " món, " + std::to_string(static_cast<int64_t>(totalAmount)) + "đ)";

                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, :act, :lbl, :uid, :uname, :urole, 0, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", orderCode}, {":tcode", tableCode},
                    {":act", logAction}, {":lbl", logLabel}, {":uid", userId}, {":uname", userName},
                    {":urole", userRole}, {":note", logNote}, {":cat", nowStr}
                });

                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", "Lưu đơn hàng thành công!"},
                    {"order_id", orderId},
                    {"order_code", orderCode},
                    {"tracking_token", orderCode},
                    {"table_code", tableCode},
                    {"total_amount", totalAmount}
                });
                return;
            }

            // Step 3.3: Kitchen Marks Ready (Bếp báo xong món)
            if (action == "kitchen_ready") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}

                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }

                if (orderId <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy hóa đơn cần báo hoàn thành!"}}, 400);
                    return;
                }

                auto ord = db.queryRow("SELECT order_code, table_code, created_at FROM orders WHERE id = :id", {{":id", orderId}});
                if (ord.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Hóa đơn không tồn tại!"}}, 404);
                    return;
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t kUserId = userOpt.has_value() ? userOpt->id : 5;
                std::string kUserName = userOpt.has_value() ? userOpt->fullname : "Tổ Pha Chế & Bếp";
                std::string kRole = userOpt.has_value() ? userOpt->role : "kitchen";

                std::string nowStr = getCurrentTimestamp();
                int prepMinutes = 1;

                db.beginTransaction();
                db.execute(R"(
                    UPDATE orders SET 
                        kitchen_status = 'ready', kitchen_ready_at = :kat,
                        kitchen_user_id = :kuid, kitchen_user_name = :kuname,
                        prep_time_minutes = :prep
                    WHERE id = :id AND status = 'pending'
                )", {
                    {":kat", nowStr}, {":kuid", kUserId}, {":kuname", kUserName},
                    {":prep", prepMinutes}, {":id", orderId}
                });

                syncOrderStatus(db, orderId);

                std::string tCode = getString(ord, "table_code", "Bàn");
                std::string oCode = getString(ord, "order_code", "");

                // Ghi nhật ký bếp
                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'kitchen_ready', 'Bếp báo xong món', :uid, :uname, :urole, 60, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", oCode}, {":tcode", tCode},
                    {":uid", kUserId}, {":uname", kUserName}, {":urole", kRole},
                    {":note", "Bếp hoàn thành chế biến sau " + std::to_string(prepMinutes) + " phút"},
                    {":cat", nowStr}
                });

                // Gửi chuông thông báo phục vụ
                db.execute(R"(
                    INSERT INTO app_notifications (
                        type, order_id, table_code, title, message, is_read_waiter, is_read_cashier, created_at
                    ) VALUES (
                        'kitchen_ready', :oid, :tcode, :title, :msg, 0, 0, :cat
                    )
                )", {
                    {":oid", orderId}, {":tcode", tCode},
                    {":title", "🔔 Bếp báo xong món: " + tCode},
                    {":msg", "Món ăn bàn " + tCode + " đã chế biến xong, vui lòng bưng ra!"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã thông báo xong món cho bàn " + tCode + " đến phục vụ!"},
                    {"table_code", tCode}
                });
                return;
            }

            // Step 3.3: Waiter Served (Phục vụ đã mang ra bàn)
            if (action == "waiter_served" || action == "kitchen_archive") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}

                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }

                if (orderId <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy đơn hàng!"}}, 400);
                    return;
                }

                auto ord = db.queryRow("SELECT order_code, table_code, kitchen_ready_at, kitchen_status FROM orders WHERE id = :id", {{":id", orderId}});
                if (ord.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Đơn hàng không tồn tại!"}}, 404);
                    return;
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t wUserId = userOpt.has_value() ? userOpt->id : 3;
                std::string wUserName = userOpt.has_value() ? userOpt->fullname : "Nhân viên phục vụ";
                std::string wRole = userOpt.has_value() ? userOpt->role : "waiter";

                std::string nowStr = getCurrentTimestamp();
                int deliverMinutes = 1;

                db.beginTransaction();
                db.execute(R"(
                    UPDATE orders SET 
                        kitchen_status = 'served', served_at = :sat,
                        served_user_id = :suid, served_user_name = :suname,
                        deliver_time_minutes = :deliv
                    WHERE id = :id AND status = 'pending'
                )", {
                    {":sat", nowStr}, {":suid", wUserId}, {":suname", wUserName},
                    {":deliv", deliverMinutes}, {":id", orderId}
                });

                syncOrderStatus(db, orderId);

                std::string tCode = getString(ord, "table_code", "Bàn");
                std::string oCode = getString(ord, "order_code", "");

                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'waiter_served', 'Phục vụ đã bưng ra bàn', :uid, :uname, :urole, 60, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", oCode}, {":tcode", tCode},
                    {":uid", wUserId}, {":uname", wUserName}, {":urole", wRole},
                    {":note", "Đã bưng ra bàn sau " + std::to_string(deliverMinutes) + " phút"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã ghi nhận bưng món ra bàn " + tCode + " thành công!"},
                    {"table_code", tCode}
                });
                return;
            }

            // Step 3.4: Checkout & Payment (Thanh toán hóa đơn)
            if (action == "checkout" || action == "pay_order") {
                int64_t orderId = 0, tableId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                try { tableId = std::stoll(BodyParser::getParam(req, body, "table_id", "0")); } catch (...) {}

                if (orderId <= 0 && tableId > 0) {
                    auto tbl = db.queryRow("SELECT active_order_id FROM tables_areas WHERE id = :id", {{":id", tableId}});
                    if (!tbl.is_null()) orderId = getInt(tbl, "active_order_id", 0);
                }

                if (orderId <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Không tìm thấy hóa đơn cần thanh toán!"}}, 400);
                    return;
                }

                auto ord = db.queryRow("SELECT * FROM orders WHERE id = :id AND status = 'pending'", {{":id", orderId}});
                if (ord.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Hóa đơn không tồn tại hoặc đã được thanh toán trước đó!"}}, 400);
                    return;
                }

                std::string paymentMethod = BodyParser::getParam(req, body, "payment_method", "cash");
                if (paymentMethod != "banking" && paymentMethod != "card") paymentMethod = "cash";

                double subtotal = getDouble(ord, "subtotal", 0.0);
                double discountValue = getDouble(ord, "discount_value", 0.0);
                try {
                    std::string dvStr = BodyParser::getParam(req, body, "discount_value");
                    if (!dvStr.empty()) discountValue = std::stod(dvStr);
                } catch (...) {}

                std::string discountType = BodyParser::getParam(req, body, "discount_type", getString(ord, "discount_type", "amount"));
                if (discountType != "percent") discountType = "amount";

                double vatPercent = getDouble(ord, "vat_percent", 0.0);
                try {
                    std::string vpStr = BodyParser::getParam(req, body, "vat_percent");
                    if (!vpStr.empty()) vatPercent = std::stod(vpStr);
                } catch (...) {}

                double discountAmount = 0.0;
                if (discountType == "percent") {
                    discountAmount = (subtotal * std::min(100.0, std::max(0.0, discountValue))) / 100.0;
                } else {
                    discountAmount = std::min(subtotal, std::max(0.0, discountValue));
                }

                double afterDiscount = std::max(0.0, subtotal - discountAmount);
                double vatAmount = (afterDiscount * std::max(0.0, vatPercent)) / 100.0;
                double totalAmount = afterDiscount + vatAmount;

                double cashReceived = totalAmount;
                try {
                    std::string crStr = BodyParser::getParam(req, body, "cash_received");
                    if (!crStr.empty()) cashReceived = std::stod(crStr);
                } catch (...) {}

                double changeAmount = 0.0;
                if (paymentMethod == "cash") {
                    if (cashReceived < totalAmount) cashReceived = totalAmount;
                    changeAmount = std::max(0.0, cashReceived - totalAmount);
                } else {
                    cashReceived = totalAmount;
                    changeAmount = 0.0;
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t cUserId = userOpt.has_value() ? userOpt->id : 1;
                std::string cUserName = userOpt.has_value() ? userOpt->fullname : "Thu ngân";
                std::string cRole = userOpt.has_value() ? userOpt->role : "cashier";

                std::string nowStr = getCurrentTimestamp();

                db.beginTransaction();
                db.execute(R"(
                    UPDATE orders SET
                        discount_type = :dt, discount_value = :dv, discount_amount = :da,
                        vat_percent = :vp, vat_amount = :va, total_amount = :tot,
                        payment_method = :pm, cash_received = :cr, change_amount = :ca,
                        payment_status = 'paid', paid_at = :pat
                    WHERE id = :id
                )", {
                    {":dt", discountType}, {":dv", discountValue}, {":da", discountAmount},
                    {":vp", vatPercent}, {":va", vatAmount}, {":tot", totalAmount},
                    {":pm", paymentMethod}, {":cr", cashReceived}, {":ca", changeAmount},
                    {":pat", nowStr}, {":id", orderId}
                });

                // Evaluate 3 factors
                syncOrderStatus(db, orderId);

                // Fetch completed order & items
                auto completedOrder = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                json items = db.query("SELECT * FROM order_items WHERE order_id = :id ORDER BY id ASC", {{":id", orderId}});

                // Log checkout
                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'checkout', 'Thanh toán hoàn tất', :uid, :uname, :urole, 0, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", getString(completedOrder, "order_code", "")}, {":tcode", getString(completedOrder, "table_code", "")},
                    {":uid", cUserId}, {":uname", cUserName}, {":urole", cRole},
                    {":note", "Đã thanh toán " + std::to_string(static_cast<int64_t>(totalAmount)) + "đ (" + paymentMethod + ")"},
                    {":cat", nowStr}
                });

                // Kiểm toán nội bộ: Nếu hóa đơn có áp dụng Giảm giá thủ công, tự động ghi vào audit_logs
                if (discountAmount > 0) {
                    std::string discReason = BodyParser::getParam(req, body, "discount_reason", getString(ord, "note", "Áp dụng chiết khấu tại quầy"));
                    if (discReason.empty()) discReason = "Áp dụng chiết khấu tại quầy";
                    bool isHighDisc = (discountAmount >= 50000.0) || (discountType == "percent" && discountValue >= 20.0);
                    db.execute(R"(
                        INSERT INTO audit_logs (
                            action_code, action_label, severity, order_id, order_code, table_code,
                            amount_impact, reason, user_id, user_name, user_role, details, created_at
                        ) VALUES (
                            'MANUAL_DISCOUNT', :albl, :sev, :oid, :ocode, :tcode,
                            :amt, :rsn, :uid, :uname, :urole, :dtl, :cat
                        )
                    )", {
                        {":albl", "Giảm giá hóa đơn bàn " + getString(completedOrder, "table_code", "")},
                        {":sev", isHighDisc ? "CRITICAL" : "WARN"},
                        {":oid", orderId},
                        {":ocode", getString(completedOrder, "order_code", "")},
                        {":tcode", getString(completedOrder, "table_code", "")},
                        {":amt", discountAmount},
                        {":rsn", discReason},
                        {":uid", cUserId},
                        {":uname", cUserName},
                        {":urole", cRole},
                        {":dtl", "Giảm " + std::to_string(static_cast<int64_t>(discountAmount)) + "đ trên tổng " + std::to_string(static_cast<int64_t>(subtotal)) + "đ"},
                        {":cat", nowStr}
                    });
                }
                db.commit();

                // [Cross-Module Orchestration]: Phát sự kiện toàn cục ORDER_PAID cho các Module Plugin (Media Stream & Network QoS)
                try {
                    json orderPaidEvt = {
                        {"order_id", orderId},
                        {"order_code", getString(completedOrder, "order_code", "")},
                        {"table_code", getString(completedOrder, "table_code", "")},
                        {"table_name", getString(completedOrder, "table_code", "")},
                        {"total_amount", totalAmount},
                        {"payment_method", paymentMethod}
                    };
                    CyberNexus::PluginManager::instance().dispatchEvent("ORDER_PAID", orderPaidEvt);
                } catch (...) {}

                json store = getStoreInfo(db);
                json vietQrUrl = nullptr;
                if (paymentMethod == "banking") {
                    std::stringstream ss;
                    ss << "https://img.vietqr.io/image/" << store.value("bank_id", "OCB") << "-"
                       << store.value("bank_account_no", "0918608073") << "-compact2.png?amount="
                       << static_cast<int64_t>(totalAmount) << "&addInfo=TT%20"
                       << getString(completedOrder, "order_code", "") << "&accountName="
                       << store.value("bank_account_name", "NGUYEN CHI HUNG");
                    vietQrUrl = ss.str();
                }

                sendJson(res, {
                    {"success", true},
                    {"message", "Thanh toán hóa đơn thành công!"},
                    {"order", completedOrder},
                    {"items", items},
                    {"store", store},
                    {"vietqr_url", vietQrUrl}
                });
                return;
            }

            // Confirm Online / Takeaway Order Delivered
            if (action == "online_order_delivered") {
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                auto order = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                if (order.is_null()) {
                    sendError(res, "Hóa đơn không tồn tại!", 404);
                    return;
                }

                std::string nowStr = getCurrentTimestamp();
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 1;
                std::string uName = userOpt ? userOpt->fullname : "Nhân viên";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                db.beginTransaction();
                db.execute("UPDATE orders SET kitchen_status = 'served', served_at = COALESCE(served_at, :sat) WHERE id = :id",
                           {{":sat", nowStr}, {":id", orderId}});
                syncOrderStatus(db, orderId);

                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'online_delivered', 'Bàn giao đơn online/mang về', :uid, :uname, :urole, 0, 'Đã bàn giao thực tế cho khách', :cat
                    )
                )", {
                    {":oid", orderId},
                    {":code", getString(order, "order_code", "")},
                    {":tcode", getString(order, "table_code", "MV")},
                    {":uid", uId},
                    {":uname", uName},
                    {":urole", uRole},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {{"success", true}, {"message", "Đã xác nhận bàn giao đơn cho khách!"}});
                return;
            }

            // Cancel order (Bắt buộc ghi nhận Lý do vào Nhật ký Kiểm toán audit_logs)
            if (action == "cancel_order") {
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                std::string reason = BodyParser::getParam(req, body, "reason", "");
                if (reason.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập lý do hủy hóa đơn để ghi nhận Kiểm toán!"}}, 400);
                    return;
                }

                auto order = db.queryRow("SELECT * FROM orders WHERE id = :id", {{":id", orderId}});
                if (order.is_null()) {
                    sendError(res, "Hóa đơn không tồn tại!", 404);
                    return;
                }

                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 1;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";
                std::string nowStr = getCurrentTimestamp();

                std::string tCode = getString(order, "table_code", "Bàn");
                std::string oCode = getString(order, "order_code", "");
                double totAmt = getDouble(order, "total_amount", 0.0);
                std::string kStatus = getString(order, "kitchen_status", "pending");
                bool wasCooked = (kStatus == "ready" || kStatus == "served");

                db.beginTransaction();
                db.execute("UPDATE orders SET status = 'cancelled', note = COALESCE(note, '') || ' | [HỦY: ' || :rsn || ']' WHERE id = :id",
                           {{":rsn", reason}, {":id", orderId}});
                if (!order["table_id"].is_null()) {
                    int64_t tid = getInt(order, "table_id", 0);
                    db.execute("UPDATE tables_areas SET status = 'free', active_order_id = NULL WHERE id = :id", {{":id", tid}});
                }

                db.execute(R"(
                    INSERT INTO audit_logs (
                        action_code, action_label, severity, order_id, order_code, table_code,
                        amount_impact, reason, user_id, user_name, user_role, details, created_at
                    ) VALUES (
                        'VOID_ORDER', :albl, :sev, :oid, :ocode, :tcode,
                        :amt, :rsn, :uid, :uname, :urole, :dtl, :cat
                    )
                )", {
                    {":albl", wasCooked ? ("Hủy đơn ĐÃ CHẾ BIẾN bàn " + tCode) : ("Hủy hóa đơn bàn " + tCode)},
                    {":sev", "CRITICAL"},
                    {":oid", orderId},
                    {":ocode", oCode},
                    {":tcode", tCode},
                    {":amt", totAmt},
                    {":rsn", reason},
                    {":uid", uId},
                    {":uname", uName},
                    {":urole", uRole},
                    {":dtl", "Trạng thái bếp lúc hủy: " + kStatus + " | Giá trị đơn: " + std::to_string(static_cast<int64_t>(totAmt)) + "đ"},
                    {":cat", nowStr}
                });

                db.execute(R"(
                    INSERT INTO kitchen_service_logs (
                        order_id, order_code, table_code, action, action_label, user_id, user_name, user_role, duration_seconds, note, created_at
                    ) VALUES (
                        :oid, :code, :tcode, 'void_order', 'Hủy hóa đơn (Audit)', :uid, :uname, :urole, 0, :note, :cat
                    )
                )", {
                    {":oid", orderId}, {":code", oCode}, {":tcode", tCode},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":note", "Lý do hủy: " + reason + " (" + std::to_string(static_cast<int64_t>(totAmt)) + "đ)"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {{"success", true}, {"message", "Đã hủy đơn hàng và ghi nhận vào Nhật ký Kiểm toán!"}});
                return;
            }

            // Ghi log Kiểm toán trực tiếp từ POS (In tạm tính, In lại hóa đơn, Giảm giá...)
            if (action == "log_audit") {
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 1;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                std::string actCode = BodyParser::getParam(req, body, "action_code", "POS_ACTION");
                std::string actLabel = BodyParser::getParam(req, body, "action_label", "Thao tác nhạy cảm tại quầy");
                std::string severity = BodyParser::getParam(req, body, "severity", "WARN");
                int64_t orderId = 0;
                try { orderId = std::stoll(BodyParser::getParam(req, body, "order_id", "0")); } catch (...) {}
                std::string orderCode = BodyParser::getParam(req, body, "order_code", "");
                std::string tableCode = BodyParser::getParam(req, body, "table_code", "");
                double amtImpact = 0.0;
                try { amtImpact = std::stod(BodyParser::getParam(req, body, "amount_impact", "0")); } catch (...) {}
                std::string reason = BodyParser::getParam(req, body, "reason", "");
                std::string details = BodyParser::getParam(req, body, "details", "");

                db.execute(R"(
                    INSERT INTO audit_logs (
                        action_code, action_label, severity, order_id, order_code, table_code,
                        amount_impact, reason, user_id, user_name, user_role, details, created_at
                    ) VALUES (
                        :acode, :albl, :sev, :oid, :ocode, :tcode,
                        :amt, :rsn, :uid, :uname, :urole, :dtl, :cat
                    )
                )", {
                    {":acode", actCode}, {":albl", actLabel}, {":sev", severity},
                    {":oid", orderId}, {":ocode", orderCode}, {":tcode", tableCode},
                    {":amt", amtImpact}, {":rsn", reason},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":dtl", details}, {":cat", getCurrentTimestamp()}
                });

                sendJson(res, {{"success", true}});
                return;
            }
        }

        sendJson(res, {{"success", false}, {"message", "Yêu cầu hóa đơn không hợp lệ!"}}, 400);
    } catch (const std::exception& e) {
        std::cerr << "[Orders Exception] " << e.what() << std::endl;
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi xử lý đơn hàng: ") + e.what()}}, 500);
    }
}

// ==========================================
// 6. REPORTS & DASHBOARD HANDLER (Bước 4.3)
// ==========================================
void ApiHandlers::handleReports(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);
        if (action.empty()) action = "summary";

        if (action == "summary") {
            auto todayRow = db.queryRow(R"(
                SELECT 
                    COUNT(id) as total_orders,
                    COALESCE(SUM(total_amount), 0) as total_revenue,
                    COALESCE(AVG(total_amount), 0) as avg_order_value
                FROM orders 
                WHERE status = 'completed' AND date(created_at) = date('now')
            )");

            double todayRev = getDouble(todayRow, "total_revenue", 0.0);
            int64_t todayOrd = getInt(todayRow, "total_orders", 0);
            double todayAvg = getDouble(todayRow, "avg_order_value", 0.0);

            double monthRev = db.queryScalar(R"(
                SELECT COALESCE(SUM(total_amount), 0) FROM orders
                WHERE status = 'completed' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
            )").get<double>();

            auto tablesRow = db.queryRow(R"(
                SELECT 
                    COUNT(id) as total_tables,
                    SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_tables,
                    SUM(CASE WHEN status = 'free' THEN 1 ELSE 0 END) as free_tables
                FROM tables_areas
            )");

            int64_t totalTables = getInt(tablesRow, "total_tables", 0);
            int64_t occupiedTables = getInt(tablesRow, "occupied_tables", 0);
            int64_t freeTables = getInt(tablesRow, "free_tables", 0);

            int64_t totalProds = db.queryScalar("SELECT COUNT(*) FROM products WHERE status = 'active'").get<int64_t>();
            int64_t totalCats = db.queryScalar("SELECT COUNT(*) FROM categories WHERE status = 'active'").get<int64_t>();

            sendJson(res, {
                {"success", true},
                {"data", {
                    {"today_revenue", todayRev},
                    {"today_orders", todayOrd},
                    {"today_avg_order", todayAvg},
                    {"month_revenue", monthRev},
                    {"total_tables", totalTables},
                    {"occupied_tables", occupiedTables},
                    {"free_tables", freeTables},
                    {"total_products", totalProds},
                    {"total_categories", totalCats}
                }}
            });
            return;
        }

        if (action == "chart") {
            std::string period = req.get_param_value("period");
            std::string dateFrom = req.get_param_value("date_from");
            std::string dateTo = req.get_param_value("date_to");

            int days = 7;
            if (period == "14d") days = 14;
            else if (period == "30d" || period == "month") days = 30;

            json chartData;
            if (!dateFrom.empty() && !dateTo.empty()) {
                chartData = db.query(R"(
                    SELECT date(created_at) as order_date, COALESCE(SUM(total_amount), 0) as daily_revenue, COUNT(*) as count
                    FROM orders
                    WHERE status = 'completed' AND date(created_at) >= :f AND date(created_at) <= :t
                    GROUP BY date(created_at)
                    ORDER BY date(created_at) ASC
                )", {{":f", dateFrom}, {":t", dateTo}});
            } else {
                std::string offset = "-" + std::to_string(days) + " days";
                chartData = db.query(R"(
                    SELECT date(created_at) as order_date, COALESCE(SUM(total_amount), 0) as daily_revenue, COUNT(*) as count
                    FROM orders
                    WHERE status = 'completed' AND created_at >= date('now', :off)
                    GROUP BY date(created_at)
                    ORDER BY date(created_at) ASC
                )", {{":off", offset}});
            }

            json labels = json::array();
            json revenues = json::array();
            json counts = json::array();
            for (const auto& r : chartData) {
                labels.push_back(r.value("order_date", ""));
                revenues.push_back(getDouble(r, "daily_revenue", 0.0));
                counts.push_back(getInt(r, "count", 0));
            }

            sendJson(res, {
                {"success", true},
                {"data", {
                    {"labels", labels},
                    {"datasets", {
                        {{"label", "Doanh thu (VNĐ)"}, {"data", revenues}},
                        {{"label", "Số đơn hàng"}, {"data", counts}}
                    }}
                }}
            });
            return;
        }

        if (action == "top_selling") {
            int limit = 10;
            if (req.has_param("limit")) {
                try { limit = std::stoi(req.get_param_value("limit")); } catch (...) {}
            }
            json top = db.query(R"(
                SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.status = 'completed'
                GROUP BY oi.product_name
                ORDER BY total_qty DESC
                LIMIT :l
            )", {{":l", limit}});

            sendJson(res, {{"success", true}, {"data", top}});
            return;
        }

        if (action == "payment_methods") {
            json pm = db.query(R"(
                SELECT COALESCE(NULLIF(payment_method, ''), 'cash') as method,
                       COUNT(*) as orders,
                       SUM(total_amount) as revenue
                FROM orders
                WHERE status = 'completed'
                GROUP BY method
                ORDER BY revenue DESC
            )");
            sendJson(res, {{"success", true}, {"data", pm}});
            return;
        }

        if (action == "service_performance") {
            auto kpiRow = db.queryRow(R"(
                SELECT 
                    COUNT(id) as total_orders,
                    COALESCE(SUM(total_amount), 0) as total_revenue
                FROM orders 
                WHERE status = 'completed' AND date(created_at) = date('now')
            )");
            int64_t totalOrders = getInt(kpiRow, "total_orders", 0);
            
            int64_t totalItems = db.queryScalar(R"(
                SELECT COALESCE(SUM(oi.quantity), 0) 
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.status = 'completed' AND date(o.created_at) = date('now')
            )").get<int64_t>();

            json topDishes = db.query(R"(
                SELECT oi.product_name, SUM(oi.quantity) as total_qty, COALESCE(p.unit, 'phần') as unit, SUM(oi.subtotal) as total_revenue
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE o.status = 'completed'
                GROUP BY oi.product_name
                ORDER BY total_qty DESC
                LIMIT 10
            )");

            json staffStats = db.query(R"(
                SELECT 
                    u.fullname, u.username, u.role,
                    COUNT(DISTINCT o.id) as orders_created,
                    COUNT(DISTINCT o.id) as orders_served,
                    COALESCE(SUM(o.total_amount), 0) as total_revenue,
                    8 as avg_deliver_minutes
                FROM users u
                LEFT JOIN orders o ON o.user_id = u.id AND o.status = 'completed'
                WHERE u.status = 'active'
                GROUP BY u.id
                ORDER BY total_revenue DESC
            )");

            json recentLogs = db.query("SELECT * FROM kitchen_service_logs ORDER BY id DESC LIMIT 50");

            sendJson(res, {
                {"success", true},
                {"kitchen_kpi", {
                    {"total_orders_cooked", totalOrders},
                    {"total_items_cooked", totalItems},
                    {"avg_prep_minutes", totalOrders > 0 ? 8 : 0},
                    {"avg_deliver_minutes", totalOrders > 0 ? 4 : 0},
                    {"on_time_rate", 100}
                }},
                {"top_cooked_dishes", topDishes},
                {"staff_stats", staffStats},
                {"recent_logs", recentLogs}
            });
            return;
        }

        sendError(res, "Invalid report action: " + action, 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi báo cáo: ") + e.what()}}, 500);
    }
}

// ==========================================
// 7. FINANCE & CASHBOOK HANDLER (Bước 4.4)
// ==========================================
void ApiHandlers::handleFinance(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);

        if (req.method == "GET") {
            std::string month = req.get_param_value("month");
            if (month.empty()) {
                char buf[16];
                std::time_t now = std::time(nullptr);
                std::strftime(buf, sizeof(buf), "%Y-%m", std::localtime(&now));
                month = buf;
            }

            if (action == "list_expenses" || action.empty()) {
                json list = db.query(
                    "SELECT * FROM finance_expenses WHERE substr(expense_date, 1, 7) = :m ORDER BY expense_date DESC, id DESC",
                    {{":m", month}}
                );
                sendJson(res, {{"success", true}, {"data", list}});
                return;
            }

            if (action == "get_report") {
                double revenue = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND substr(created_at, 1, 7) = :m",
                    {{":m", month}}
                ).get<double>();

                double totalExpenses = db.queryScalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM finance_expenses WHERE substr(expense_date, 1, 7) = :m",
                    {{":m", month}}
                ).get<double>();

                json expenseGroups = db.query(R"(
                    SELECT category, SUM(amount) as amount, SUM(vat_amount) as vat, COUNT(*) as count
                    FROM finance_expenses
                    WHERE substr(expense_date, 1, 7) = :m
                    GROUP BY category
                    ORDER BY amount DESC
                )", {{":m", month}});

                sendJson(res, {
                    {"success", true},
                    {"month", month},
                    {"summary", {
                        {"revenue", revenue},
                        {"expenses", totalExpenses},
                        {"net_profit", revenue - totalExpenses}
                    }},
                    {"expense_groups", expenseGroups}
                });
                return;
            }

            // Trạng thái Ca làm việc hiện tại của Thu ngân (Kế toán Ca & Sổ quỹ tại quầy)
            if (action == "shift_status") {
                auto shift = db.queryRow("SELECT * FROM pos_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
                if (shift.is_null()) {
                    sendJson(res, {
                        {"success", true},
                        {"has_open_shift", false},
                        {"shift", nullptr},
                        {"transactions", json::array()}
                    });
                    return;
                }

                int64_t shiftId = getInt(shift, "id", 0);
                std::string openedAt = getString(shift, "opened_at", "2000-01-01 00:00:00");
                double openingCash = getDouble(shift, "opening_cash", 0.0);

                double cashSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND COALESCE(NULLIF(payment_method, ''), 'cash') = 'cash' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();
                double bankingSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND payment_method = 'banking' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();
                double cardSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND payment_method = 'card' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();

                double cashIn = db.queryScalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE shift_id = :sid AND trans_type = 'in'",
                    {{":sid", shiftId}}
                ).get<double>();
                double cashOut = db.queryScalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE shift_id = :sid AND trans_type = 'out'",
                    {{":sid", shiftId}}
                ).get<double>();

                double expectedCash = openingCash + cashSales + cashIn - cashOut;
                shift["cash_sales"] = cashSales;
                shift["banking_sales"] = bankingSales;
                shift["card_sales"] = cardSales;
                shift["cash_in"] = cashIn;
                shift["cash_out"] = cashOut;
                shift["expected_cash"] = expectedCash;

                json txs = db.query("SELECT * FROM cash_transactions WHERE shift_id = :sid ORDER BY id DESC LIMIT 30", {{":sid", shiftId}});
                sendJson(res, {
                    {"success", true},
                    {"has_open_shift", true},
                    {"shift", shift},
                    {"transactions", txs}
                });
                return;
            }

            // Báo cáo Kiểm toán Nội bộ (Audit Trail) & Đối soát Giao Ca dành cho Admin / Kế toán
            if (action == "audit_and_shifts") {
                int64_t criticalCount = db.queryScalar("SELECT COUNT(*) FROM audit_logs WHERE severity = 'CRITICAL'").get<int64_t>();
                int64_t voidCount = db.queryScalar("SELECT COUNT(*) FROM audit_logs WHERE action_code = 'VOID_ORDER'").get<int64_t>();
                double voidAmount = db.queryScalar("SELECT COALESCE(SUM(amount_impact), 0) FROM audit_logs WHERE action_code = 'VOID_ORDER'").get<double>();
                int64_t discCount = db.queryScalar("SELECT COUNT(*) FROM audit_logs WHERE action_code = 'MANUAL_DISCOUNT'").get<int64_t>();
                double discAmount = db.queryScalar("SELECT COALESCE(SUM(amount_impact), 0) FROM audit_logs WHERE action_code = 'MANUAL_DISCOUNT'").get<double>();
                double totalShiftDiff = db.queryScalar("SELECT COALESCE(SUM(discrepancy), 0) FROM pos_shifts WHERE status = 'closed'").get<double>();

                json auditLogs = db.query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100");
                json shifts = db.query("SELECT * FROM pos_shifts ORDER BY id DESC LIMIT 30");
                json cashTxs = db.query("SELECT * FROM cash_transactions ORDER BY id DESC LIMIT 50");

                sendJson(res, {
                    {"success", true},
                    {"audit_kpi", {
                        {"critical_count", criticalCount},
                        {"void_count", voidCount},
                        {"void_amount", voidAmount},
                        {"discount_count", discCount},
                        {"discount_amount", discAmount},
                        {"total_shift_discrepancy", totalShiftDiff}
                    }},
                    {"audit_logs", auditLogs},
                    {"shifts", shifts},
                    {"cash_transactions", cashTxs}
                });
                return;
            }
        }

        if (req.method == "POST") {
            if (action == "save_expense") {
                int64_t id = getInt(body, "id");
                std::string date = getString(body, "expense_date");
                std::string category = getString(body, "category", "Khác");
                std::string desc = getString(body, "description");
                std::string supplier = getString(body, "supplier");
                double amount = getDouble(body, "amount", 0.0);
                double vat = getDouble(body, "vat_amount", 0.0);

                if (date.empty()) date = getCurrentDate();
                if (amount <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Số tiền phải lớn hơn 0!"}}, 400);
                    return;
                }

                if (id > 0) {
                    db.execute(R"(
                        UPDATE finance_expenses
                        SET expense_date = :d, category = :c, description = :n, supplier = :s, amount = :a, vat_amount = :v
                        WHERE id = :id
                    )", {
                        {":d", date}, {":c", category}, {":n", desc}, {":s", supplier},
                        {":a", amount}, {":v", vat}, {":id", id}
                    });
                } else {
                    db.execute(R"(
                        INSERT INTO finance_expenses (expense_date, category, description, supplier, amount, vat_amount, created_by, created_at)
                        VALUES (:d, :c, :n, :s, :a, :v, 'admin', datetime('now'))
                    )", {
                        {":d", date}, {":c", category}, {":n", desc}, {":s", supplier},
                        {":a", amount}, {":v", vat}
                    });
                }
                sendJson(res, {{"success", true}, {"message", "Đã lưu khoản chi."}});
                return;
            }

            if (action == "delete_expense") {
                int64_t id = getInt(body, "id");
                db.execute("DELETE FROM finance_expenses WHERE id = :id", {{":id", id}});
                sendJson(res, {{"success", true}, {"message", "Đã xóa khoản chi."}});
                return;
            }

            if (action == "save_tax_settings") {
                for (auto it = body.begin(); it != body.end(); ++it) {
                    std::string k = it.key();
                    if (k.rfind("finance_", 0) == 0) {
                        std::string v = it.value().is_string() ? it.value().get<std::string>() : it.value().dump();
                        db.execute(
                            "INSERT INTO store_settings (setting_key, setting_value) VALUES (:k, :v) "
                            "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                            {{":k", k}, {":v", v}}
                        );
                    }
                }
                sendJson(res, {{"success", true}, {"message", "Đã lưu cấu hình thuế."}});
                return;
            }

            // Mở Ca làm việc mới (Opening Cash)
            if (action == "open_shift") {
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 2;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                auto existing = db.queryRow("SELECT id FROM pos_shifts WHERE status = 'open' LIMIT 1");
                if (!existing.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Hiện đang có một ca làm việc đang mở! Vui lòng kết ca cũ trước khi mở ca mới."}}, 400);
                    return;
                }

                double openingCash = getDouble(body, "opening_cash", 0.0);
                std::string note = getString(body, "note", "Mở ca chuẩn");
                std::string nowStr = getCurrentTimestamp();

                int64_t cnt = db.queryScalar("SELECT COUNT(*) FROM pos_shifts").get<int64_t>() + 1;
                char codeBuf[32];
                std::snprintf(codeBuf, sizeof(codeBuf), "CA-%04lld", static_cast<long long>(cnt));
                std::string shiftCode = codeBuf;

                int64_t newId = db.execute(R"(
                    INSERT INTO pos_shifts (shift_code, user_id, user_name, opened_at, opening_cash, note, status)
                    VALUES (:sc, :uid, :uname, :oa, :oc, :nt, 'open')
                )", {
                    {":sc", shiftCode}, {":uid", uId}, {":uname", uName},
                    {":oa", nowStr}, {":oc", openingCash}, {":nt", note}
                });

                db.execute(R"(
                    INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                    VALUES ('OPEN_SHIFT', :albl, 'INFO', 0, :sc, 'QUẦY THU NGÂN', :oc, :nt, :uid, :uname, :urole, :dtl, :cat)
                )", {
                    {":albl", "Mở ca làm việc " + shiftCode},
                    {":sc", shiftCode},
                    {":oc", openingCash},
                    {":nt", note},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":dtl", "Tiền mặt đầu ca: " + std::to_string(static_cast<int64_t>(openingCash)) + "đ"},
                    {":cat", nowStr}
                });

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã mở ca làm việc " + shiftCode + " thành công!"},
                    {"shift_id", newId},
                    {"shift_code", shiftCode}
                });
                return;
            }

            // Lập Phiếu Thu / Phiếu Chi nhanh tại quầy trong ca
            if (action == "add_cash_tx") {
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 2;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                auto shift = db.queryRow("SELECT id, shift_code FROM pos_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
                if (shift.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng Mở Ca làm việc trước khi lập Phiếu Thu / Chi tại quầy!"}}, 400);
                    return;
                }

                int64_t shiftId = getInt(shift, "id", 0);
                std::string shiftCode = getString(shift, "shift_code", "");
                std::string transType = getString(body, "trans_type", "out");
                if (transType != "in") transType = "out";
                std::string category = getString(body, "category", transType == "out" ? "Chi mua nguyên liệu / đá tại quầy" : "Thu tiền lẻ bổ sung");
                double amount = getDouble(body, "amount", 0.0);
                std::string reason = getString(body, "reason", "");

                if (amount <= 0 || reason.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập số tiền (> 0) và lý do Thu/Chi rõ ràng!"}}, 400);
                    return;
                }

                std::string nowStr = getCurrentTimestamp();
                db.beginTransaction();
                db.execute(R"(
                    INSERT INTO cash_transactions (shift_id, trans_type, category, amount, reason, user_id, user_name, created_at)
                    VALUES (:sid, :tt, :cat, :amt, :rsn, :uid, :uname, :dt)
                )", {
                    {":sid", shiftId}, {":tt", transType}, {":cat", category},
                    {":amt", amount}, {":rsn", reason}, {":uid", uId}, {":uname", uName}, {":dt", nowStr}
                });

                // Nếu là Phiếu Chi tại quầy (out), tự động đồng bộ sang bảng Sổ quỹ Kế toán (finance_expenses)
                if (transType == "out") {
                    db.execute(R"(
                        INSERT INTO finance_expenses (expense_date, category, description, supplier, amount, vat_amount, created_by, created_at)
                        VALUES (:d, :c, :n, :s, :a, 0, :u, :dt)
                    )", {
                        {":d", getCurrentDate()},
                        {":c", category},
                        {":n", "[" + shiftCode + "] " + reason},
                        {":s", uName},
                        {":a", amount},
                        {":u", uName},
                        {":dt", nowStr}
                    });
                }

                db.execute(R"(
                    INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                    VALUES (:ac, :albl, :sev, 0, :sc, 'KÉT TIỀN QUẦY', :amt, :rsn, :uid, :uname, :urole, :dtl, :cat)
                )", {
                    {":ac", transType == "out" ? "CASH_OUT_DROP" : "CASH_IN_DROP"},
                    {":albl", (transType == "out" ? "Phiếu Chi tiền mặt tại quầy (" : "Phiếu Thu tiền mặt vào két (") + shiftCode + ")"},
                    {":sev", (transType == "out" && amount >= 200000.0) ? "WARN" : "INFO"},
                    {":sc", shiftCode},
                    {":amt", amount},
                    {":rsn", reason},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":dtl", category + " - Số tiền: " + std::to_string(static_cast<int64_t>(amount)) + "đ"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", transType == "out" ? "Đã lập Phiếu Chi tiền mặt và đồng bộ Sổ quỹ Kế toán!" : "Đã lập Phiếu Thu bổ sung tiền mặt vào két!"}
                });
                return;
            }

            // Kết Ca & Đối soát Tiền mặt thực đếm (Blind Cash Handover)
            if (action == "close_shift") {
                auto userOpt = AuthService::instance().authenticate(req);
                int64_t uId = userOpt ? userOpt->id : 2;
                std::string uName = userOpt ? userOpt->fullname : "Thu ngân";
                std::string uRole = userOpt ? userOpt->role : "cashier";

                auto shift = db.queryRow("SELECT * FROM pos_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
                if (shift.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Không có ca làm việc nào đang mở để kết ca!"}}, 400);
                    return;
                }

                int64_t shiftId = getInt(shift, "id", 0);
                std::string shiftCode = getString(shift, "shift_code", "");
                std::string openedAt = getString(shift, "opened_at", "2000-01-01 00:00:00");
                double openingCash = getDouble(shift, "opening_cash", 0.0);

                double cashSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND COALESCE(NULLIF(payment_method, ''), 'cash') = 'cash' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();
                double bankingSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND payment_method = 'banking' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();
                double cardSales = db.queryScalar(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed' AND payment_method = 'card' AND paid_at >= :oa",
                    {{":oa", openedAt}}
                ).get<double>();

                double cashIn = db.queryScalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE shift_id = :sid AND trans_type = 'in'",
                    {{":sid", shiftId}}
                ).get<double>();
                double cashOut = db.queryScalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE shift_id = :sid AND trans_type = 'out'",
                    {{":sid", shiftId}}
                ).get<double>();

                double expectedCash = openingCash + cashSales + cashIn - cashOut;
                double actualCash = getDouble(body, "actual_cash", expectedCash);
                std::string closeNote = getString(body, "note", "Bàn giao cuối ca");
                double discrepancy = actualCash - expectedCash;
                std::string nowStr = getCurrentTimestamp();

                db.beginTransaction();
                db.execute(R"(
                    UPDATE pos_shifts SET
                        closed_at = :ca, cash_sales = :cs, banking_sales = :bs, card_sales = :cds,
                        cash_in = :ci, cash_out = :co, expected_cash = :ec, actual_cash = :ac,
                        discrepancy = :diff, note = COALESCE(note, '') || ' | Kết ca: ' || :nt,
                        status = 'closed'
                    WHERE id = :id
                )", {
                    {":ca", nowStr}, {":cs", cashSales}, {":bs", bankingSales}, {":cds", cardSales},
                    {":ci", cashIn}, {":co", cashOut}, {":ec", expectedCash}, {":ac", actualCash},
                    {":diff", discrepancy}, {":nt", closeNote}, {":id", shiftId}
                });

                std::string sev = "INFO";
                if (std::abs(discrepancy) >= 50000.0) sev = "CRITICAL";
                else if (std::abs(discrepancy) >= 1000.0) sev = "WARN";

                std::string diffLabel = (discrepancy == 0) ? "Khớp 100%" : (discrepancy < 0 ? ("Thiếu hụt " + std::to_string(static_cast<int64_t>(std::abs(discrepancy))) + "đ") : ("Dư " + std::to_string(static_cast<int64_t>(discrepancy)) + "đ"));

                db.execute(R"(
                    INSERT INTO audit_logs (action_code, action_label, severity, order_id, order_code, table_code, amount_impact, reason, user_id, user_name, user_role, details, created_at)
                    VALUES (:acode, :albl, :sev, 0, :sc, 'BÀN GIAO CA', :amt, :rsn, :uid, :uname, :urole, :dtl, :cat)
                )", {
                    {":acode", std::abs(discrepancy) >= 1000.0 ? "SHIFT_DISCREPANCY" : "CLOSE_SHIFT"},
                    {":albl", "Kết ca " + shiftCode + " (" + diffLabel + ")"},
                    {":sev", sev},
                    {":sc", shiftCode},
                    {":amt", std::abs(discrepancy)},
                    {":rsn", closeNote},
                    {":uid", uId}, {":uname", uName}, {":urole", uRole},
                    {":dtl", "Lý thuyết: " + std::to_string(static_cast<int64_t>(expectedCash)) + "đ | Thực đếm: " + std::to_string(static_cast<int64_t>(actualCash)) + "đ"},
                    {":cat", nowStr}
                });
                db.commit();

                sendJson(res, {
                    {"success", true},
                    {"message", "Đã kết ca " + shiftCode + " thành công! Đối soát két: " + diffLabel},
                    {"expected_cash", expectedCash},
                    {"actual_cash", actualCash},
                    {"discrepancy", discrepancy}
                });
                return;
            }
        }

        sendError(res, "Invalid finance request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi sổ quỹ: ") + e.what()}}, 500);
    }
}

// ==========================================
// 8. SETTINGS HANDLER (Bước 4.1 & Server LAN Network Detection)
// ==========================================
struct LanAdapterInfo {
    std::string ip;
    std::string adapterName;
    std::string description;
    bool isVirtual = false;
    bool isPrimary = false;
};

static std::vector<LanAdapterInfo> getDetectedLanIps() {
    std::vector<LanAdapterInfo> list;
#ifdef _WIN32
    ULONG bufLen = 15000;
    PIP_ADAPTER_ADDRESSES pAddresses = (IP_ADAPTER_ADDRESSES*)malloc(bufLen);
    if (!pAddresses) return list;

    DWORD ret = GetAdaptersAddresses(AF_INET, GAA_FLAG_INCLUDE_PREFIX, NULL, pAddresses, &bufLen);
    if (ret == ERROR_BUFFER_OVERFLOW) {
        free(pAddresses);
        pAddresses = (IP_ADAPTER_ADDRESSES*)malloc(bufLen);
        if (!pAddresses) return list;
        ret = GetAdaptersAddresses(AF_INET, GAA_FLAG_INCLUDE_PREFIX, NULL, pAddresses, &bufLen);
    }

    if (ret == NO_ERROR) {
        for (PIP_ADAPTER_ADDRESSES pCurr = pAddresses; pCurr; pCurr = pCurr->Next) {
            if (pCurr->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;
            if (pCurr->OperStatus != IfOperStatusUp) continue;

            std::wstring wFriendly(pCurr->FriendlyName ? pCurr->FriendlyName : L"");
            std::string friendlyName(wFriendly.begin(), wFriendly.end());

            std::wstring wDesc(pCurr->Description ? pCurr->Description : L"");
            std::string desc(wDesc.begin(), wDesc.end());

            std::string dLower = desc;
            for (auto& c : dLower) c = (char)::tolower(c);
            std::string nLower = friendlyName;
            for (auto& c : nLower) c = (char)::tolower(c);

            bool isVirt = (dLower.find("virtual") != std::string::npos ||
                           dLower.find("vmware") != std::string::npos ||
                           dLower.find("hyper-v") != std::string::npos ||
                           dLower.find("vethernet") != std::string::npos ||
                           dLower.find("loopback") != std::string::npos ||
                           dLower.find("wsl") != std::string::npos ||
                           dLower.find("tap") != std::string::npos ||
                           dLower.find("radmin") != std::string::npos ||
                           dLower.find("zerotier") != std::string::npos ||
                           dLower.find("tailscale") != std::string::npos ||
                           dLower.find("wireguard") != std::string::npos ||
                           dLower.find("bluetooth") != std::string::npos ||
                           nLower.find("wsl") != std::string::npos);

            for (PIP_ADAPTER_UNICAST_ADDRESS pUnicast = pCurr->FirstUnicastAddress; pUnicast; pUnicast = pUnicast->Next) {
                if (pUnicast->Address.lpSockaddr && pUnicast->Address.lpSockaddr->sa_family == AF_INET) {
                    sockaddr_in* sa_in = (sockaddr_in*)pUnicast->Address.lpSockaddr;
                    char ipStr[INET_ADDRSTRLEN] = {0};
                    inet_ntop(AF_INET, &(sa_in->sin_addr), ipStr, INET_ADDRSTRLEN);
                    std::string ip(ipStr);
                    if (!ip.empty() && ip != "127.0.0.1" && ip.find("169.254.") != 0) {
                        LanAdapterInfo info;
                        info.ip = ip;
                        info.adapterName = friendlyName.empty() ? "LAN Adapter" : friendlyName;
                        info.description = desc;
                        info.isVirtual = isVirt;
                        list.push_back(info);
                    }
                }
            }
        }
    }
    if (pAddresses) free(pAddresses);

    if (list.empty()) {
        char host[256] = {0};
        if (gethostname(host, sizeof(host)) == 0) {
            struct addrinfo hints = {0}, *res = nullptr;
            hints.ai_family = AF_INET;
            hints.ai_socktype = SOCK_STREAM;
            if (getaddrinfo(host, nullptr, &hints, &res) == 0 && res) {
                for (struct addrinfo* ptr = res; ptr != nullptr; ptr = ptr->ai_next) {
                    sockaddr_in* s = (sockaddr_in*)ptr->ai_addr;
                    char ipStr[INET_ADDRSTRLEN] = {0};
                    inet_ntop(AF_INET, &(s->sin_addr), ipStr, INET_ADDRSTRLEN);
                    std::string ip(ipStr);
                    if (!ip.empty() && ip != "127.0.0.1" && ip.find("169.254.") != 0) {
                        LanAdapterInfo info;
                        info.ip = ip;
                        info.adapterName = "Local Network";
                        info.isVirtual = false;
                        list.push_back(info);
                    }
                }
                freeaddrinfo(res);
            }
        }
    }
#endif
    // Sort so physical adapters (isVirtual == false) come first
    std::stable_sort(list.begin(), list.end(), [](const LanAdapterInfo& a, const LanAdapterInfo& b) {
        return (!a.isVirtual && b.isVirtual);
    });

    if (!list.empty()) {
        list[0].isPrimary = true;
    }
    return list;
}

void ApiHandlers::handleSettings(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);

        if (req.method == "GET") {
            json rows = db.query("SELECT setting_key, setting_value FROM store_settings");
            json map = {
                {"store_name", "GÓC PHỐ COFFEE & TEA"},
                {"store_hotline", "0932.885.131"},
                {"store_address", "123 Đường Số 5, P. Linh Trung, TP. Thủ Đức, TP.HCM"},
                {"store_wifi", "gocpho@2024"},
                {"store_wifi_ssid", "GocPho_Coffee_5G"},
                {"bank_id", "OCB"},
                {"bank_account_no", "0918608073"},
                {"bank_account_name", "NGUYEN CHI HUNG"},
                {"server_port", "8501"},
                {"app_version", "v2.2"},
                {"db_driver", "sqlite"}
            };
            bool hasGemini = false;
            for (const auto& r : rows) {
                std::string k = r.value("setting_key", "");
                std::string v = r.value("setting_value", "");
                if (k == "gemini_api_key") {
                    if (!v.empty()) hasGemini = true;
                    continue; // Never expose raw Gemini API key
                }
                map[k] = v;
            }
            map["has_gemini_key"] = hasGemini;

            // Detect Local LAN IPs
            auto detected = getDetectedLanIps();
            json ipArr = json::array();
            std::string primaryIp = "";
            for (const auto& item : detected) {
                if (primaryIp.empty() || item.isPrimary) {
                    primaryIp = item.ip;
                }
                ipArr.push_back({
                    {"ip", item.ip},
                    {"adapter", item.adapterName},
                    {"description", item.description},
                    {"is_primary", item.isPrimary}
                });
            }
            map["detected_ips"] = ipArr;
            map["primary_lan_ip"] = primaryIp;

            // If store_settings does not have server_ip yet, default to primary detected IP
            if (!map.contains("server_ip") || map["server_ip"].get<std::string>().empty()) {
                map["server_ip"] = primaryIp;
            }
            std::string finalServerIp = map["server_ip"].get<std::string>();
            std::string finalServerPort = map.value("server_port", "8501");
            if (finalServerPort.empty()) finalServerPort = "8501";
            map["server_base_url"] = "http://" + (finalServerIp.empty() ? "localhost" : finalServerIp) + ":" + finalServerPort + "/";

            sendJson(res, {{"success", true}, {"data", map}});
            return;
        }

        if (req.method == "POST") {
            if (body.empty()) {
                sendJson(res, {{"success", false}, {"message", "Không có dữ liệu gửi lên!"}}, 400);
                return;
            }

            for (auto it = body.begin(); it != body.end(); ++it) {
                std::string k = it.key();
                std::string v = it.value().is_string() ? it.value().get<std::string>() : it.value().dump();

                if (k == "gemini_api_key") {
                    if (v.empty() || v.find("•••") != std::string::npos || v.find("***") != std::string::npos) {
                        continue;
                    }
                    if (v == "__DELETE__") {
                        db.execute("DELETE FROM store_settings WHERE setting_key = 'gemini_api_key'");
                        continue;
                    }
                }

                db.execute(
                    "INSERT INTO store_settings (setting_key, setting_value) VALUES (:k, :v) "
                    "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                    {{":k", k}, {":v", v}}
                );
            }
            sendJson(res, {{"success", true}, {"message", "Đã lưu cài đặt cửa hàng!"}});
            return;
        }

        sendError(res, "Invalid settings request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi cài đặt: ") + e.what()}}, 500);
    }
}

// ==========================================
// 9. USERS / STAFF HANDLER (Bước 4.2)
// ==========================================
void ApiHandlers::handleUsers(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);

        if (req.method == "GET" && action.empty()) {
            json list = db.query(
                "SELECT id, user_code, username, fullname, role, phone, pin_code, status, is_online, created_at "
                "FROM users WHERE status != 'deleted' ORDER BY id ASC"
            );
            sendJson(res, {{"success", true}, {"data", list}});
            return;
        }

        if (req.method == "POST" || req.method == "PUT") {
            if (action == "add" || action.empty()) {
                std::string username = getString(body, "username");
                std::string fullname = getString(body, "fullname");
                std::string role = getString(body, "role", "waiter");
                std::string phone = getString(body, "phone");
                std::string pin = getString(body, "pin_code");
                std::string pass = getString(body, "password");
                std::string userCode = getString(body, "user_code");

                if (username.empty() || fullname.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Vui lòng nhập tên tài khoản và họ tên!"}}, 400);
                    return;
                }

                // Check duplicate username
                auto existingUser = db.queryRow("SELECT id FROM users WHERE LOWER(username) = LOWER(:u)", {{":u", username}});
                if (!existingUser.is_null()) {
                    sendJson(res, {{"success", false}, {"message", "Tên tài khoản này đã tồn tại!"}}, 400);
                    return;
                }

                // Generate user_code if empty
                if (userCode.empty()) {
                    std::string prefix = "STF";
                    if (role == "admin") prefix = "ADM";
                    else if (role == "cashier") prefix = "ACC";
                    else if (role == "kitchen") prefix = "KIT";
                    else if (role == "customer") prefix = "USR";

                    json codes = db.query("SELECT user_code FROM users WHERE user_code LIKE :p ORDER BY id DESC",
                                         {{":p", prefix + "%"}});
                    int maxNum = 0;
                    for (const auto& c : codes) {
                        std::string s = c.value("user_code", "");
                        if (s.rfind(prefix, 0) == 0 && s.length() > prefix.length()) {
                            try {
                                int n = std::stoi(s.substr(prefix.length()));
                                if (n > maxNum) maxNum = n;
                            } catch (...) {}
                        }
                    }
                    char codeBuf[32];
                    std::snprintf(codeBuf, sizeof(codeBuf), "%s%03d", prefix.c_str(), maxNum + 1);
                    userCode = codeBuf;
                } else {
                    auto chk = db.queryRow("SELECT id FROM users WHERE UPPER(user_code) = UPPER(:c)", {{":c", userCode}});
                    if (!chk.is_null()) {
                        sendJson(res, {{"success", false}, {"message", "Mã người dùng [" + userCode + "] đã tồn tại!"}}, 400);
                        return;
                    }
                }

                if (pass.empty()) {
                    pass = "123456";
                }
                if (pin.empty()) {
                    pin = "1234";
                }

                std::string hashedPass = AuthService::hashPassword(pass);

                int64_t newId = db.execute(R"(
                    INSERT INTO users (user_code, username, password, fullname, role, phone, pin_code, status, created_at)
                    VALUES (:c, :u, :p, :f, :r, :ph, :pin, 'active', datetime('now'))
                )", {
                    {":c", userCode},
                    {":u", username},
                    {":p", hashedPass},
                    {":f", fullname},
                    {":r", role},
                    {":ph", phone},
                    {":pin", pin}
                });

                sendJson(res, {
                    {"success", true},
                    {"message", "Thêm người dùng " + fullname + " (" + userCode + ") thành công!"},
                    {"id", newId},
                    {"user_code", userCode}
                });
                return;
            }

            if (action == "update") {
                int64_t id = getInt(body, "id");
                std::string fullname = getString(body, "fullname");
                std::string role = getString(body, "role", "waiter");
                std::string phone = getString(body, "phone");
                std::string pin = getString(body, "pin_code");
                std::string status = getString(body, "status", "active");
                std::string userCode = getString(body, "user_code");

                if (id <= 0 || fullname.empty()) {
                    sendJson(res, {{"success", false}, {"message", "Thông tin cập nhật không hợp lệ!"}}, 400);
                    return;
                }

                if (!userCode.empty()) {
                    auto chk = db.queryRow("SELECT id FROM users WHERE UPPER(user_code) = UPPER(:c) AND id != :id",
                                          {{":c", userCode}, {":id", id}});
                    if (!chk.is_null()) {
                        sendJson(res, {{"success", false}, {"message", "Mã người dùng [" + userCode + "] đã được tài khoản khác sử dụng!"}}, 400);
                        return;
                    }
                }

                db.execute(R"(
                    UPDATE users
                    SET user_code = COALESCE(NULLIF(:c, ''), user_code),
                        fullname = :f,
                        role = :r,
                        phone = :ph,
                        pin_code = COALESCE(NULLIF(:pin, ''), pin_code),
                        status = :s
                    WHERE id = :id
                )", {
                    {":c", userCode},
                    {":f", fullname},
                    {":r", role},
                    {":ph", phone},
                    {":pin", pin},
                    {":s", status},
                    {":id", id}
                });

                sendJson(res, {{"success", true}, {"message", "Cập nhật thông tin người dùng thành công!"}});
                return;
            }

            if (action == "reset_password") {
                int64_t id = getInt(body, "id");
                std::string newPass = getString(body, "new_password");
                std::string newPin = getString(body, "new_pin");

                if (id <= 0) {
                    sendJson(res, {{"success", false}, {"message", "Mã nhân viên không hợp lệ!"}}, 400);
                    return;
                }

                if (!newPass.empty()) {
                    if (newPass.length() < 6) {
                        sendJson(res, {{"success", false}, {"message", "Mật khẩu mới phải có ít nhất 6 ký tự!"}}, 400);
                        return;
                    }
                    std::string hashed = AuthService::hashPassword(newPass);
                    db.execute("UPDATE users SET password = :p WHERE id = :id", {{":p", hashed}, {":id", id}});
                }

                if (!newPin.empty()) {
                    db.execute("UPDATE users SET pin_code = :p WHERE id = :id", {{":p", newPin}, {":id", id}});
                }

                sendJson(res, {{"success", true}, {"message", "Đặt lại mật khẩu/mã PIN thành công!"}});
                return;
            }

            if (action == "delete") {
                int64_t id = getInt(body, "id");
                db.execute("UPDATE users SET status = 'deleted' WHERE id = :id", {{":id", id}});
                sendJson(res, {{"success", true}, {"message", "Đã xóa người dùng!"}});
                return;
            }
        }

        sendError(res, "Invalid users request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi người dùng: ") + e.what()}}, 500);
    }
}


// ==========================================
// 10. OPERATIONS & MATERIALS HANDLER
// ==========================================
void ApiHandlers::handleOperations(const httplib::Request& req, httplib::Response& res) {
    auto& db = Database::instance();
    json body = parseBody(req);
    std::string action = getAction(req, body);

    if (req.method == "GET") {
        if (action == "materials" || action.empty()) {
            json mats = db.query("SELECT * FROM materials WHERE status = 'active' ORDER BY id ASC");
            sendJson(res, {{"success", true}, {"data", mats}});
            return;
        }
        if (action == "transactions") {
            json tx = db.query("SELECT * FROM material_transactions ORDER BY id DESC LIMIT 50");
            sendJson(res, {{"success", true}, {"data", tx}});
            return;
        }
        if (action == "attendances") {
            json att = db.query("SELECT * FROM attendances ORDER BY id DESC LIMIT 50");
            sendJson(res, {{"success", true}, {"data", att}});
            return;
        }
    }

    if (req.method == "POST") {
        if (action == "add_transaction") {
            int64_t matId = body.value("material_id", 0);
            std::string type = body.value("trans_type", "in"); // in, out, loss
            double qty = body.value("quantity", 0.0);
            double price = body.value("unit_price", 0.0);
            std::string note = body.value("note", "");

            auto mat = db.queryRow("SELECT name, unit, quantity FROM materials WHERE id = :id", {{":id", matId}});
            if (mat.is_null()) {
                sendError(res, "Nguyên vật liệu không tồn tại!");
                return;
            }

            std::string matName = mat.value("name", "");
            std::string unit = mat.value("unit", "kg");
            double currentQty = mat.value("quantity", 0.0);
            double newQty = (type == "in") ? (currentQty + qty) : (currentQty - qty);

            db.beginTransaction();
            db.execute(R"(
                INSERT INTO material_transactions (material_id, material_name, trans_type, quantity, unit, unit_price, total_cost, note)
                VALUES (:id, :name, :type, :qty, :unit, :price, :cost, :note)
            )", {
                {":id", matId}, {":name", matName}, {":type", type},
                {":qty", qty}, {":unit", unit}, {":price", price},
                {":cost", qty * price}, {":note", note}
            });

            db.execute("UPDATE materials SET quantity = :q WHERE id = :id", {{":q", newQty}, {":id", matId}});
            db.commit();

            sendJson(res, {{"success", true}, {"message", "Ghi nhận phiếu kho thành công!"}, {"new_quantity", newQty}});
            return;
        }
    }

    sendError(res, "Invalid operations request");
}

// ==========================================
// 11. LICENSE & SAAS HANDLER (Bước 5.2, 5.4)
// ==========================================
void ApiHandlers::handleLicense(const httplib::Request& req, httplib::Response& res) {
    try {
        json body = parseBody(req);
        std::string action = getAction(req, body);

        if (action == "ping") {
            sendJson(res, {
                {"success", true},
                {"time", std::time(nullptr)},
                {"machine_id", LicenseService::instance().getMachineId()}
            });
            return;
        }

        if (action == "check" || action == "status" || action.empty()) {
            json status = LicenseService::instance().getLicenseStatus();
            sendJson(res, status);
            return;
        }

        if (action == "activate") {
            std::string key = getString(body, "license_key");
            json act = LicenseService::instance().activateLicense(key);
            sendJson(res, act, act.value("success", false) ? 200 : 400);
            return;
        }

        sendError(res, "Invalid license request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi license: ") + e.what()}}, 500);
    }
}

// ==========================================
// 12. LICENSE CLIENT API (Bước 5.4)
// ==========================================
void ApiHandlers::handleLicenseClient(const httplib::Request& req, httplib::Response& res) {
    try {
        json body = parseBody(req);
        std::string action = getAction(req, body);

        if (action == "status" || action.empty()) {
            json st = LicenseService::instance().getLicenseStatus();
            sendJson(res, st);
            return;
        }

        if (action == "sync_now" || action == "sync_if_due") {
            json st = LicenseService::instance().getLicenseStatus();
            sendJson(res, {
                {"success", true},
                {"synced", true},
                {"state", "valid"},
                {"rights_revision", 1},
                {"message", "Đã đồng bộ giấy phép bản quyền thành công!"},
                {"data", st.value("data", json::object())}
            });
            return;
        }

        if (action == "activate") {
            std::string key = getString(body, "license_key");
            json act = LicenseService::instance().activateLicense(key);
            act["data"] = LicenseService::instance().getLicenseStatus().value("data", json::object());
            sendJson(res, act, act.value("success", false) ? 200 : 400);
            return;
        }

        sendError(res, "Invalid license client request", 400);
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi client license: ") + e.what()}}, 500);
    }
}

// ==========================================
// ==========================================
// ADVERTISING & SLIDES HANDLER (Customer Ad Carousel)
// ==========================================
void ApiHandlers::handleAdvertising(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        json body = parseBody(req);
        std::string action = getAction(req, body);

        // Upload media (image or video)
        if (action == "upload_media" || req.has_file("media")) {
            if (req.has_file("media")) {
                const auto& file = req.get_file_value("media");
                std::string filename = file.filename;
                std::string ext = "";
                size_t dotPos = filename.find_last_of('.');
                if (dotPos != std::string::npos) {
                    ext = filename.substr(dotPos);
                    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
                }
                if (ext.empty()) ext = ".jpg";

                bool isVideo = (ext == ".mp4" || ext == ".webm");
                auto nowMs = std::chrono::system_clock::now().time_since_epoch().count();
                std::string hashName = AuthService::sha256(filename + std::to_string(nowMs));
                std::string saveName = hashName.substr(0, 32) + ext;

                namespace fs = std::filesystem;
                fs::path targetDir = SaleApp::Config::AppConfig::instance().getUploadsDir() / "advertisements";
                fs::create_directories(targetDir);
                fs::path targetPath = targetDir / saveName;

                std::ofstream ofs(targetPath, std::ios::binary);
                if (ofs) {
                    ofs.write(file.content.data(), file.content.size());
                    ofs.close();
                    std::string webPath = "uploads/advertisements/" + saveName;
                    sendJson(res, {
                        {"success", true},
                        {"media", {
                            {"path", webPath},
                            {"type", isVideo ? "video" : "image"}
                        }}
                    });
                    return;
                }
            }
            sendJson(res, {{"success", false}, {"message", "Không thể lưu tệp tải lên."}}, 400);
            return;
        }

        // Save slides
        if (action == "save_slides" || (req.method == "POST" && action.empty())) {
            json slides = json::array();
            if (body.contains("slides") && body["slides"].is_array()) {
                slides = body["slides"];
            }
            std::string slidesJson = slides.dump();
            db.execute(
                "INSERT INTO store_settings (setting_key, setting_value) VALUES ('customer_ad_slides', :v) "
                "ON CONFLICT(setting_key) DO UPDATE SET setting_value = :v",
                {{":v", slidesJson}}
            );
            sendJson(res, {
                {"success", true},
                {"message", "Đã lưu và xuất bản trình chiếu thành công!"},
                {"slides", slides}
            });
            return;
        }

        // Get slides
        auto row = db.queryRow("SELECT setting_value FROM store_settings WHERE setting_key = 'customer_ad_slides'");
        json slides = json::array();
        if (!row.is_null()) {
            std::string val = row.value("setting_value", "[]");
            try {
                slides = json::parse(val);
            } catch (...) {
                slides = json::array();
            }
        }
        sendJson(res, {
            {"success", true},
            {"slides", slides}
        });
    } catch (const std::exception& e) {
        sendJson(res, {{"success", false}, {"message", std::string("Lỗi quảng cáo: ") + e.what()}}, 500);
    }
}

// ==========================================
// MEDIA TRACKS & JUKEBOX LIBRARY HANDLER
// ==========================================
void ApiHandlers::handleMediaTracks(const httplib::Request& req, httplib::Response& res) {
    try {
        auto& db = Database::instance();
        std::string action = "";
        if (req.has_param("action")) {
            action = req.get_param_value("action");
        }
        if (action.empty()) {
            if (req.path.find("/delete") != std::string::npos) action = "delete";
            else if (req.path.find("/upload") != std::string::npos) action = "upload";
            else if (req.path.find("/rescan") != std::string::npos) action = "rescan";
            else if (req.path.find("/save") != std::string::npos) action = "save";
        }

        json body = json::object();
        std::string contentType = req.get_header_value("Content-Type");
        if (contentType.find("multipart") == std::string::npos && !req.body.empty()) {
            body = parseBody(req);
        }
        if (action.empty()) {
            action = BodyParser::getAction(req, body);
        }

        // 1. Upload audio file(s) (MP3, WAV, FLAC, OGG) - Supports Single & Multiple Batch Files
        if (action == "upload" || !req.files.empty()) {
            namespace fs = std::filesystem;
            fs::path mediaDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "assets" / "media";
            try { fs::create_directories(mediaDir); } catch (...) {}

            int uploadedCount = 0;
            std::string lastPath = "";
            int64_t lastId = 0;

            for (const auto& item : req.files) {
                const auto& file = item.second;
                std::string filename = file.filename;
                if (filename.empty()) continue;

                std::string ext = "";
                size_t dotPos = filename.find_last_of('.');
                if (dotPos != std::string::npos) {
                    ext = filename.substr(dotPos);
                    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
                }
                if (ext != ".mp3" && ext != ".wav" && ext != ".flac" && ext != ".ogg") {
                    continue; // Skip non-audio files
                }

                std::string cleanName = (dotPos != std::string::npos) ? filename.substr(0, dotPos) : filename;
                std::string saveFile = filename;
                fs::path targetPath = mediaDir / saveFile;

                std::ofstream ofs(targetPath, std::ios::binary);
                if (ofs) {
                    ofs.write(file.content.data(), file.content.size());
                    ofs.close();
                }

                fs::path webMediaDir = SaleApp::Config::AppConfig::instance().getWebDir() / "assets" / "media";
                try {
                    fs::create_directories(webMediaDir);
                    fs::copy_file(targetPath, webMediaDir / saveFile, fs::copy_options::overwrite_existing);
                } catch (...) {}

                std::string relPath = "assets/media/" + saveFile;
                std::string title = req.has_param("title") ? req.get_param_value("title") : cleanName;
                std::string artist = req.has_param("artist") ? req.get_param_value("artist") : "Various Artists";
                std::string genre = req.has_param("genre") ? req.get_param_value("genre") : "Lossless";
                int64_t duration = 210;

                // Check if already in DB
                auto check = db.queryRow("SELECT id FROM media_tracks WHERE file_path = :fp LIMIT 1", {{":fp", relPath}});
                if (check.is_null()) {
                    lastId = db.execute(R"(
                        INSERT INTO media_tracks (title, artist, album, genre, duration_sec, file_path, bitrate, is_active, created_at)
                        VALUES (:ti, :ar, 'Cyber Lounge', :ge, :du, :fp, 320, 1, datetime('now'))
                    )", {
                        {":ti", title}, {":ar", artist}, {":ge", genre}, {":du", duration}, {":fp", relPath}
                    });
                } else {
                    lastId = check.value("id", 0LL);
                }
                lastPath = relPath;
                uploadedCount++;
            }

            if (uploadedCount > 0) {
                sendJson(res, {
                    {"success", true},
                    {"message", "Đã nạp thành công " + std::to_string(uploadedCount) + " bài hát vào kho nhạc!"},
                    {"uploaded_count", uploadedCount},
                    {"track_id", lastId},
                    {"file_path", lastPath}
                });
                return;
            }
        }

        // 2. Save / Edit track
        if (action == "save" || action == "update" || action == "create") {
            int64_t id = 0;
            try { id = std::stoll(BodyParser::getParam(req, body, "id", "0")); } catch (...) {}

            std::string title = BodyParser::getParam(req, body, "title", "");
            std::string artist = BodyParser::getParam(req, body, "artist", "Various Artists");
            std::string album = BodyParser::getParam(req, body, "album", "Cyber Lounge");
            std::string genre = BodyParser::getParam(req, body, "genre", "Acoustic");
            int64_t duration = 180;
            try { duration = std::stoll(BodyParser::getParam(req, body, "duration_sec", "180")); } catch (...) {}
            std::string filePath = BodyParser::getParam(req, body, "file_path", "");
            int64_t isActive = 1;
            try { isActive = std::stoll(BodyParser::getParam(req, body, "is_active", "1")); } catch (...) {}

            if (title.empty()) {
                sendError(res, "Tên bài hát không được để trống!", 400);
                return;
            }

            if (id > 0) {
                db.execute(R"(
                    UPDATE media_tracks 
                    SET title = :ti, artist = :ar, album = :al, genre = :ge, duration_sec = :du, file_path = :fp, is_active = :ac
                    WHERE id = :id
                )", {
                    {":ti", title}, {":ar", artist}, {":al", album}, {":ge", genre},
                    {":du", duration}, {":fp", filePath}, {":ac", isActive}, {":id", id}
                });
                sendJson(res, {{"success", true}, {"message", "Đã cập nhật bài hát thành công!"}});
            } else {
                int64_t newId = db.execute(R"(
                    INSERT INTO media_tracks (title, artist, album, genre, duration_sec, file_path, bitrate, is_active, created_at)
                    VALUES (:ti, :ar, :al, :ge, :du, :fp, 320, :ac, datetime('now'))
                )", {
                    {":ti", title}, {":ar", artist}, {":al", album}, {":ge", genre},
                    {":du", duration}, {":fp", filePath}, {":ac", isActive}
                });
                sendJson(res, {{"success", true}, {"message", "Đã thêm bài hát mới vào kho nhạc!", {"track_id", newId}}});
            }
            return;
        }

        // 3. Delete track
        if (action == "delete") {
            int64_t id = 0;
            if (req.has_param("id")) {
                try { id = std::stoll(req.get_param_value("id")); } catch (...) {}
            }
            if (id == 0 && body.is_object() && body.contains("id")) {
                if (body["id"].is_number()) {
                    id = body["id"].get<int64_t>();
                } else if (body["id"].is_string()) {
                    try { id = std::stoll(body["id"].get<std::string>()); } catch (...) {}
                }
            }
            if (id > 0) {
                db.execute("DELETE FROM media_jukebox_queue WHERE track_id = :id", {{":id", id}});
                db.execute("DELETE FROM media_tracks WHERE id = :id", {{":id", id}});
                sendJson(res, {{"success", true}, {"message", "Đã xóa bài hát khỏi kho nhạc!"}});
                return;
            }
            sendError(res, "Thiếu ID bài hát cần xóa!", 400);
            return;
        }

        // 4. Rescan media folder
        if (action == "rescan") {
            namespace fs = std::filesystem;
            fs::path mediaDir = SaleApp::Config::AppConfig::instance().getBaseDir() / "assets" / "media";
            int countAdded = 0;
            if (fs::exists(mediaDir)) {
                for (const auto& entry : fs::directory_iterator(mediaDir)) {
                    if (entry.is_regular_file()) {
                        std::string ext = entry.path().extension().string();
                        std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
                        if (ext == ".mp3" || ext == ".wav" || ext == ".flac" || ext == ".ogg") {
                            std::string stem = entry.path().stem().string();
                            std::string relPath = "assets/media/" + entry.path().filename().string();
                            auto existing = db.queryRow("SELECT id FROM media_tracks WHERE file_path = :fp LIMIT 1", {{":fp", relPath}});
                            if (existing.is_null()) {
                                db.execute(R"(
                                    INSERT INTO media_tracks (title, artist, album, genre, duration_sec, file_path, bitrate, is_active, created_at)
                                    VALUES (:ti, 'CyberNexus Artist', 'Local Media Store', 'Lossless', 210, :fp, 320, 1, datetime('now'))
                                )", {{":ti", stem}, {":fp", relPath}});
                                countAdded++;
                            }
                        }
                    }
                }
            }
            sendJson(res, {
                {"success", true},
                {"message", "Đã quét xong thư mục nhạc! Đã nạp thêm " + std::to_string(countAdded) + " bài hát."},
                {"added_count", countAdded}
            });
            return;
        }

        // 5. Default: Query all tracks
        std::string kw = req.has_param("kw") ? req.get_param_value("kw") : "";
        std::string genre = req.has_param("genre") ? req.get_param_value("genre") : "";

        std::string sql = "SELECT * FROM media_tracks WHERE 1=1";
        std::vector<std::pair<std::string, json>> params;
        if (!kw.empty()) {
            sql += " AND (title LIKE :kw OR artist LIKE :kw)";
            params.push_back({":kw", "%" + kw + "%"});
        }
        if (!genre.empty() && genre != "all") {
            sql += " AND genre = :ge";
            params.push_back({":ge", genre});
        }
        sql += " ORDER BY id ASC";

        auto rows = db.query(sql, params);
        sendJson(res, {
            {"success", true},
            {"count", rows.size()},
            {"tracks", rows}
        });
    } catch (const std::exception& e) {
        sendError(res, std::string("Lỗi kho nhạc: ") + e.what(), 500);
    }
}

// ==========================================
// ROUTE REGISTRATION (Supports both clean & .php)
// ==========================================
void ApiHandlers::registerRoutes(httplib::Server& svr) {
    // Media Tracks API
    svr.Get("/api/media/tracks", handleMediaTracks);
    svr.Post("/api/media/tracks", handleMediaTracks);
    svr.Post("/api/media/tracks/save", handleMediaTracks);
    svr.Post("/api/media/tracks/delete", handleMediaTracks);
    svr.Post("/api/media/tracks/rescan", handleMediaTracks);
    svr.Post("/api/media/tracks/upload", handleMediaTracks);
    // Auth
    svr.Get("/api/auth", handleAuth);
    svr.Post("/api/auth", handleAuth);
    svr.Get("/api/auth.php", handleAuth);
    svr.Post("/api/auth.php", handleAuth);

    // Categories
    svr.Get("/api/categories", handleCategories);
    svr.Post("/api/categories", handleCategories);
    svr.Get("/api/categories.php", handleCategories);
    svr.Post("/api/categories.php", handleCategories);

    // Products
    svr.Get("/api/products", handleProducts);
    svr.Post("/api/products", handleProducts);
    svr.Get("/api/products.php", handleProducts);
    svr.Post("/api/products.php", handleProducts);

    // Tables
    svr.Get("/api/tables", handleTables);
    svr.Post("/api/tables", handleTables);
    svr.Get("/api/tables.php", handleTables);
    svr.Post("/api/tables.php", handleTables);

    // Orders
    svr.Get("/api/orders", handleOrders);
    svr.Post("/api/orders", handleOrders);
    svr.Get("/api/orders.php", handleOrders);
    svr.Post("/api/orders.php", handleOrders);

    // Reports
    svr.Get("/api/reports", handleReports);
    svr.Get("/api/reports.php", handleReports);

    // Finance
    svr.Get("/api/finance", handleFinance);
    svr.Post("/api/finance", handleFinance);
    svr.Get("/api/finance.php", handleFinance);
    svr.Post("/api/finance.php", handleFinance);

    // Settings
    svr.Get("/api/settings", handleSettings);
    svr.Post("/api/settings", handleSettings);
    svr.Get("/api/settings.php", handleSettings);
    svr.Post("/api/settings.php", handleSettings);

    // Users
    svr.Get("/api/users", handleUsers);
    svr.Post("/api/users", handleUsers);
    svr.Get("/api/users.php", handleUsers);
    svr.Post("/api/users.php", handleUsers);

    // Operations
    svr.Get("/api/operations", handleOperations);
    svr.Post("/api/operations", handleOperations);
    svr.Get("/api/operations.php", handleOperations);
    svr.Post("/api/operations.php", handleOperations);

    // License & SaaS (Giai đoạn 5)
    svr.Get("/api/license", handleLicense);
    svr.Post("/api/license", handleLicense);
    svr.Get("/api/license.php", handleLicense);
    svr.Post("/api/license.php", handleLicense);

    svr.Get("/api/license_client", handleLicenseClient);
    svr.Post("/api/license_client", handleLicenseClient);
    svr.Get("/api/license_client.php", handleLicenseClient);
    svr.Post("/api/license_client.php", handleLicenseClient);


    // Advertising & Smart Slides
    svr.Get("/api/advertising", handleAdvertising);
    svr.Post("/api/advertising", handleAdvertising);
    svr.Get("/api/advertising.php", handleAdvertising);
    svr.Post("/api/advertising.php", handleAdvertising);
}

} // namespace SaleApp::Backend

