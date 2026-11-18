#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>

#include <atomic>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <string>
#include <thread>
#include <vector>

namespace fs = std::filesystem;

namespace {

bool runHiddenProcess(const std::wstring& cmdLine, const std::wstring& workDir = L"") {
    STARTUPINFOW si{};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    PROCESS_INFORMATION pi{};
    std::wstring cmd = cmdLine;
    BOOL ok = CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, FALSE,
                             CREATE_NO_WINDOW, nullptr,
                             workDir.empty() ? nullptr : workDir.c_str(), &si, &pi);
    if (!ok) return false;
    WaitForSingleObject(pi.hProcess, 300000);
    DWORD exitCode = 1;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    return exitCode == 0;
}

void createDesktopShortcut(const fs::path& targetExe, const fs::path& workDir) {
    wchar_t desktopBuf[MAX_PATH] = {0};
    if (FAILED(SHGetFolderPathW(nullptr, CSIDL_DESKTOPDIRECTORY, nullptr, 0, desktopBuf))) return;
    fs::path lnkPath = fs::path(desktopBuf) / L"CyberNexus Control Center.lnk";
    fs::path favIco = workDir / L"web" / L"favicon.ico";

    if (FAILED(CoInitialize(nullptr))) return;
    IShellLinkW* psl = nullptr;
    if (SUCCEEDED(CoCreateInstance(CLSID_ShellLink, nullptr, CLSCTX_INPROC_SERVER, IID_IShellLinkW, reinterpret_cast<void**>(&psl)))) {
        psl->SetPath(targetExe.wstring().c_str());
        psl->SetWorkingDirectory(workDir.wstring().c_str());
        psl->SetDescription(L"CyberNexus OS Control Center");
        if (fs::exists(favIco)) {
            psl->SetIconLocation(favIco.wstring().c_str(), 0);
        } else {
            psl->SetIconLocation(targetExe.wstring().c_str(), 0);
        }
        IPersistFile* ppf = nullptr;
        if (SUCCEEDED(psl->QueryInterface(IID_IPersistFile, reinterpret_cast<void**>(&ppf)))) {
            ppf->Save(lnkPath.wstring().c_str(), TRUE);
            ppf->Release();
        }
        psl->Release();
    }
    CoUninitialize();
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, nullptr, nullptr);
}

fs::path pickInstallFolder(HWND owner, const fs::path& initial) {
    BROWSEINFOW bi{};
    bi.hwndOwner = owner;
    bi.lpszTitle = L"Chọn thư mục cài đặt CyberNexus OS POS:";
    bi.ulFlags = BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE;
    PIDLIST_ABSOLUTE pidl = SHBrowseForFolderW(&bi);
    if (!pidl) return initial;
    wchar_t pathBuf[MAX_PATH] = {0};
    fs::path out = initial;
    if (SHGetPathFromIDListW(pidl, pathBuf)) {
        fs::path chosen(pathBuf);
        std::wstring fname = chosen.filename().wstring();
        if (fname == L"CyberNexus_POS" || fname == L"cybernexus_pos") {
            out = chosen;
        } else {
            out = chosen / L"CyberNexus_POS";
        }
    }
    CoTaskMemFree(pidl);
    return out;
}

} // namespace

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    wchar_t selfBuf[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, selfBuf, MAX_PATH);
    fs::path selfPath(selfBuf);

    std::ifstream ifs(selfPath, std::ios::binary | std::ios::ate);
    if (!ifs) {
        MessageBoxW(nullptr, L"Không thể đọc tệp cài đặt!", L"CyberNexus Setup", MB_ICONERROR);
        return 1;
    }
    std::streamoff totalSize = ifs.tellg();
    if (totalSize < 16) {
        MessageBoxW(nullptr, L"Tệp cài đặt chưa được đóng gói dữ liệu!", L"CyberNexus Setup", MB_ICONERROR);
        return 1;
    }

    ifs.seekg(totalSize - 16);
    uint64_t zipSize = 0;
    char magic[8] = {0};
    ifs.read(reinterpret_cast<char*>(&zipSize), sizeof(zipSize));
    ifs.read(magic, 8);
    if (std::memcmp(magic, "CNXSETUP", 8) != 0 || zipSize == 0 || static_cast<std::streamoff>(zipSize + 16) > totalSize) {
        MessageBoxW(nullptr, L"Dữ liệu gói cài đặt không hợp lệ hoặc bị hỏng!", L"CyberNexus Setup", MB_ICONERROR);
        return 1;
    }

    fs::path installDir = (GetDriveTypeW(L"D:\\") == DRIVE_FIXED) ? L"D:\\CyberNexus_POS" : L"C:\\CyberNexus_POS";
    std::wstring prompt =
        L"Cài đặt CyberNexus OS v2.3?\n\n"
        L"Thư mục mặc định: " + installDir.wstring() + L"\n"
        L"• Tự động mở Windows Firewall cổng dịch vụ\n"
        L"• Tạo biểu tượng ngoài Desktop\n"
        L"• Khởi chạy CyberNexus Control Center ngay sau khi cài\n\n"
        L"Bấm YES để cài ngay, NO để chọn thư mục khác, CANCEL để hủy.";

    int choice = MessageBoxW(nullptr, prompt.c_str(), L"CyberNexus OS POS Setup", MB_YESNOCANCEL | MB_ICONQUESTION);
    if (choice == IDCANCEL) return 0;
    if (choice == IDNO) {
        installDir = pickInstallFolder(nullptr, installDir);
    }

    wchar_t tempBuf[MAX_PATH] = {0};
    GetTempPathW(MAX_PATH, tempBuf);
    fs::path tempZip = fs::path(tempBuf) / L"cybernexus_setup_pkg.zip";

    // Create native Win32 Progress Window
    INITCOMMONCONTROLSEX icex{sizeof(icex), ICC_PROGRESS_CLASS};
    InitCommonControlsEx(&icex);
    HWND hProgWnd = CreateWindowExW(
        WS_EX_TOPMOST, L"#32770", L"CyberNexus OS v2.3 — Đang Cài Đặt",
        WS_POPUP | WS_CAPTION | WS_VISIBLE,
        (GetSystemMetrics(SM_CXSCREEN) - 460) / 2,
        (GetSystemMetrics(SM_CYSCREEN) - 150) / 2,
        460, 150, nullptr, nullptr, nullptr, nullptr
    );
    HWND hLbl = CreateWindowExW(0, L"STATIC", L"Đang chuẩn bị gói cài đặt...",
        WS_CHILD | WS_VISIBLE, 20, 22, 410, 24, hProgWnd, nullptr, nullptr, nullptr);
    HWND hBar = CreateWindowExW(0, PROGRESS_CLASSW, nullptr,
        WS_CHILD | WS_VISIBLE | PBS_SMOOTH, 20, 56, 410, 24, hProgWnd, nullptr, nullptr, nullptr);
    HFONT hFont = static_cast<HFONT>(GetStockObject(DEFAULT_GUI_FONT));
    SendMessageW(hLbl, WM_SETFONT, reinterpret_cast<WPARAM>(hFont), TRUE);
    SendMessageW(hBar, PBM_SETRANGE, 0, MAKELPARAM(0, 100));

    auto setProg = [&](int pct, const wchar_t* text) {
        SetWindowTextW(hLbl, text);
        SendMessageW(hBar, PBM_SETPOS, pct, 0);
        MSG m{};
        while (PeekMessageW(&m, nullptr, 0, 0, PM_REMOVE)) {
            TranslateMessage(&m);
            DispatchMessageW(&m);
        }
    };

    setProg(10, L"Đang trích xuất dữ liệu bộ cài...");
    ifs.seekg(totalSize - 16 - static_cast<std::streamoff>(zipSize));
    std::ofstream ofs(tempZip, std::ios::binary);
    if (!ofs) {
        DestroyWindow(hProgWnd);
        MessageBoxW(nullptr, L"Không thể ghi file tạm để giải nén!", L"CyberNexus Setup", MB_ICONERROR);
        return 1;
    }
    std::vector<char> buf(65536);
    uint64_t remaining = zipSize;
    uint64_t written = 0;
    while (remaining > 0) {
        std::streamsize chunk = static_cast<std::streamsize>((remaining < buf.size()) ? remaining : buf.size());
        ifs.read(buf.data(), chunk);
        ofs.write(buf.data(), chunk);
        remaining -= static_cast<uint64_t>(chunk);
        written += static_cast<uint64_t>(chunk);
        if ((written % (1024 * 1024)) < 65536) {
            int pct = 10 + static_cast<int>((written * 25) / zipSize);
            setProg(pct, L"Đang trích xuất dữ liệu bộ cài...");
        }
    }
    ofs.close();
    ifs.close();

    std::error_code ec;
    fs::create_directories(installDir, ec);
    auto psEscape = [](const std::wstring& s) {
        std::wstring out;
        for (wchar_t c : s) {
            if (c == L'\'') out += L"''";
            else out.push_back(c);
        }
        return out;
    };
    // Stop any running CyberNexus services in target folder before overwriting
    runHiddenProcess(L"taskkill /F /IM CyberNexus_Control_Center.exe /IM cybernexus_slave.exe /IM cybernexus_master.exe");

    fs::path errLog = fs::path(tempBuf) / L"cnx_setup_err.log";
    fs::remove(errLog, ec);
    std::wstring psCmd = L"powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \""
        L"$ErrorActionPreference='Stop'; "
        L"try { Expand-Archive -LiteralPath '" + psEscape(tempZip.wstring()) +
        L"' -DestinationPath '" + psEscape(installDir.wstring()) + L"' -Force } "
        L"catch { $_.Exception.Message | Out-File -FilePath '" + psEscape(errLog.wstring()) + L"' -Encoding utf8; exit 1 }\"";

    std::atomic<bool> extractDone{false};
    std::atomic<bool> extracted{false};
    std::thread extThread([&]() {
        extracted = runHiddenProcess(psCmd);
        extractDone = true;
    });

    int simPct = 36;
    while (!extractDone) {
        setProg(simPct, (L"Đang giải nén vào " + installDir.wstring() + L" ...").c_str());
        if (simPct < 88) simPct++;
        Sleep(250);
    }
    extThread.join();
    fs::remove(tempZip, ec);

    bool hasMainExe = fs::exists(installDir / L"CyberNexus_Control_Center.exe") ||
                      fs::exists(installDir / L"cybernexus_slave.exe") ||
                      fs::exists(installDir / L"cybernexus_master.exe");
    if (!extracted || !hasMainExe) {
        DestroyWindow(hProgWnd);
        std::wstring msg = L"Giải nén bộ cài thất bại vào:\n" + installDir.wstring();
        if (fs::exists(errLog)) {
            std::ifstream efs(errLog);
            std::string eStr((std::istreambuf_iterator<char>(efs)), std::istreambuf_iterator<char>());
            if (!eStr.empty()) {
                int wlen = MultiByteToWideChar(CP_UTF8, 0, eStr.c_str(), -1, nullptr, 0);
                if (wlen > 0) {
                    std::wstring wErr(wlen, L'\0');
                    MultiByteToWideChar(CP_UTF8, 0, eStr.c_str(), -1, wErr.data(), wlen);
                    msg += L"\n\nChi tiết: " + wErr;
                }
            }
        }
        MessageBoxW(nullptr, msg.c_str(), L"CyberNexus Setup", MB_ICONERROR);
        return 1;
    }

    setProg(92, L"Đang mở Windows Firewall & tạo Shortcut Desktop...");
    if (fs::exists(installDir / L"cybernexus_master.exe")) {
        runHiddenProcess(L"netsh advfirewall firewall delete rule name=\"CyberNexus Master 8500\"");
        runHiddenProcess(L"netsh advfirewall firewall add rule name=\"CyberNexus Master 8500\" dir=in action=allow protocol=TCP localport=8500");
    }
    if (fs::exists(installDir / L"cybernexus_slave.exe")) {
        runHiddenProcess(L"netsh advfirewall firewall delete rule name=\"CyberNexus POS 8501\"");
        runHiddenProcess(L"netsh advfirewall firewall add rule name=\"CyberNexus POS 8501\" dir=in action=allow protocol=TCP localport=8501");
    }

    fs::path controlExe = installDir / L"CyberNexus_Control_Center.exe";
    if (!fs::exists(controlExe)) controlExe = installDir / L"cybernexus_slave.exe";
    createDesktopShortcut(controlExe, installDir);

    setProg(100, L"Hoàn tất! Đang khởi chạy CyberNexus Control Center...");
    Sleep(350);
    DestroyWindow(hProgWnd);

    ShellExecuteW(nullptr, L"open", controlExe.wstring().c_str(), nullptr, installDir.wstring().c_str(), SW_SHOWNORMAL);
    MessageBoxW(nullptr, (L"Đã cài đặt thành công CyberNexus OS POS tại:\n" + installDir.wstring()).c_str(),
                L"CyberNexus OS POS Setup", MB_ICONINFORMATION);
    return 0;
}

#endif
