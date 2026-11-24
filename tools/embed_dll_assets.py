#!/usr/bin/env python3
"""ARCH-08: Embed Add-on JS assets into C++ DLL headers so modules serve them via HTTP when licensed & .sig verified."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def write_hpp(out_path, assets):
    lines = [
        "#pragma once",
        "#include <string>",
        "",
        "namespace CyberNexusEmbeddedAssets {",
        ""
    ]
    for var_name, src_rel in assets:
        src_path = os.path.join(ROOT, src_rel)
        data = open(src_path, "rb").read()
        hex_bytes = ", ".join(f"0x{b:02x}" for b in data)
        lines.append(f"static const unsigned char {var_name}_bytes[] = {{ {hex_bytes} }};")
        lines.append(
            f"inline std::string get_{var_name}() {{ "
            f"return std::string(reinterpret_cast<const char*>({var_name}_bytes), sizeof({var_name}_bytes)); }}"
        )
        lines.append("")
    lines.append("} // namespace CyberNexusEmbeddedAssets")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"[EmbedAssets] Generated {os.path.relpath(out_path, ROOT)} ({len(assets)} assets)")


def main():
    write_hpp(
        os.path.join(ROOT, "modules", "mod_media_stream", "embedded_web_assets.hpp"),
        [
            ("admin_media_dsp_js", os.path.join("slave", "web", "assets", "js", "admin_media_dsp.js")),
            ("pos_jukebox_js", os.path.join("slave", "web", "assets", "js", "pos-jukebox.js")),
            ("jukebox_engine_js", os.path.join("slave", "web", "assets", "js", "jukebox-engine.js")),
        ],
    )
    write_hpp(
        os.path.join(ROOT, "modules", "mod_network_qos", "embedded_web_assets.hpp"),
        [
            ("wifi_portal_js", os.path.join("slave", "web", "assets", "js", "wifi_portal.js")),
        ],
    )


if __name__ == "__main__":
    main()
