#pragma once

#include <string>
#include <unordered_map>
#include "httplib.h"
#include "nlohmann/json.hpp"

namespace SaleApp::Backend {

using json = nlohmann::json;

class BodyParser {
public:
    // Parse an HTTP request body safely into a JSON object.
    // Never throws an exception; returns empty json::object() on invalid input.
    static json parseBody(const httplib::Request& req);

    // URL-decode a string (e.g. "ca+phe%20sua" -> "ca phe sua")
    static std::string urlDecode(const std::string& in);

    // Parse form-urlencoded string into key-value map
    static std::unordered_map<std::string, std::string> parseFormUrlEncoded(const std::string& body);

    // Universal parameter getter:
    // Checks JSON body first, then Request form/query params, returns defaultValue if missing.
    static std::string getParam(
        const httplib::Request& req,
        const json& body,
        const std::string& key,
        const std::string& defaultValue = ""
    );

    // Check if a parameter exists in either JSON body or query/form params
    static bool hasParam(
        const httplib::Request& req,
        const json& body,
        const std::string& key
    );

    // Extract the API action (e.g. "login", "check", "list") from query or body
    static std::string getAction(
        const httplib::Request& req,
        const json& body
    );
};

} // namespace SaleApp::Backend

