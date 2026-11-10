#include "body_parser.hpp"
#include <sstream>
#include <iomanip>
#include <cctype>

namespace SaleApp::Backend {

std::string BodyParser::urlDecode(const std::string& in) {
    std::string out;
    out.reserve(in.size());
    for (size_t i = 0; i < in.size(); ++i) {
        if (in[i] == '%') {
            if (i + 2 < in.size()) {
                int value = 0;
                std::istringstream is(in.substr(i + 1, 2));
                if (is >> std::hex >> value) {
                    out += static_cast<char>(value);
                    i += 2;
                } else {
                    out += in[i];
                }
            } else {
                out += in[i];
            }
        } else if (in[i] == '+') {
            out += ' ';
        } else {
            out += in[i];
        }
    }
    return out;
}

std::unordered_map<std::string, std::string> BodyParser::parseFormUrlEncoded(const std::string& body) {
    std::unordered_map<std::string, std::string> result;
    if (body.empty()) return result;

    std::istringstream stream(body);
    std::string pair;
    while (std::getline(stream, pair, '&')) {
        if (pair.empty()) continue;
        size_t eqPos = pair.find('=');
        if (eqPos != std::string::npos) {
            std::string key = urlDecode(pair.substr(0, eqPos));
            std::string val = urlDecode(pair.substr(eqPos + 1));
            result[key] = val;
        } else {
            result[urlDecode(pair)] = "";
        }
    }
    return result;
}

json BodyParser::parseBody(const httplib::Request& req) {
    if (req.body.empty()) {
        return json::object();
    }

    // 1. Try parsing directly as JSON
    try {
        return json::parse(req.body);
    } catch (...) {
        // Not a standard JSON body, fallback to Form-Urlencoded
    }

    // 2. If content-type or structure looks like form-urlencoded
    auto formMap = parseFormUrlEncoded(req.body);
    if (!formMap.empty()) {
        json j = json::object();
        for (const auto& [k, v] : formMap) {
            j[k] = v;
        }
        return j;
    }

    return json::object();
}

std::string BodyParser::getParam(
    const httplib::Request& req,
    const json& body,
    const std::string& key,
    const std::string& defaultValue
) {
    // 1. Check in parsed JSON body
    if (body.is_object() && body.contains(key)) {
        const auto& val = body[key];
        if (val.is_string()) {
            return val.get<std::string>();
        } else if (val.is_number_integer()) {
            return std::to_string(val.get<int64_t>());
        } else if (val.is_number_float()) {
            return std::to_string(val.get<double>());
        } else if (val.is_boolean()) {
            return val.get<bool>() ? "1" : "0";
        }
    }

    // 2. Check in query string or form parameter
    if (req.has_param(key)) {
        return req.get_param_value(key);
    }

    return defaultValue;
}

bool BodyParser::hasParam(
    const httplib::Request& req,
    const json& body,
    const std::string& key
) {
    if (body.is_object() && body.contains(key)) {
        return true;
    }
    return req.has_param(key);
}

std::string BodyParser::getAction(
    const httplib::Request& req,
    const json& body
) {
    return getParam(req, body, "action", "");
}

} // namespace SaleApp::Backend

