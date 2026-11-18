#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>

#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <string>
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
    WaitForSingleObject(pi.hProcess, 120000);
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

    if (FAILED(CoInitialize(nullptr))) return;
    IShellLinkW* psl = nullptr;
    if (SUCCEEDED(CoCreateInstance(CLSID_ShellLink, nullptr, CLSCTX_INPROC_SERVER, IID_IShellLinkW, reinterpret_cast<void**>(&psl)))) {
        psl->SetPath(targetExe.wstring().c_str());
        psl->SetWorkingDirectory(workDir.wstring().c_str());
        psl->SetDescription(L"CyberNexus OS POS Control Center");
        IPersistFile* ppf = nullptr;
        if (SUCCEEDED(psl->QueryInterface(IID_IPersistFile, reinterpret_cast<void**>(&ppf)))) {
            ppf->Save(lnkPath.wstring().c_str(), TRUE);
            ppf->Release();
        }
        psl->Release();
    }
    CoUninitialize();
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
        out = fs::path(pathBuf) / L"CyberNexus_POS";
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

    ifs.seekg(totalSize - 16 - static_cast<std::streamoff>(zipSize));
    std::ofstream ofs(tempZip, std::ios::binary);
    if (!ofs) {
        MessageBoxW(nullptr, L"Không thể ghi file tạm để giải nén!", L"CyberNexus Setup", MB_ICONERROR);
        return 1;
    }
    std::vector<char> buf(65536);
    uint64_t remaining = zipSize;
    while (remaining > 0) {
        std::streamsize chunk = static_cast<std::streamsize>((remaining < buf.size()) ? remaining : buf.size());
        ifs.read(buf.data(), chunk);
        ofs.write(buf.data(), chunk);
        remaining -= static_cast<uint64_t>(chunk);
    }
    ofs.close();
    ifs.close();

    std::error_code ec;
    fs::create_directories(installDir, ec);
    std::wstring tarCmd = L"tar.exe -xf \"" + tempZip.wstring() + L"\" -C \"" + installDir.wstring() + L"\"";
    bool extracted = runHiddenProcess(tarCmd);
    fs::remove(tempZip, ec);

    if (!extracted) {
        MessageBoxW(nullptr, L"Giải nén bộ cài thất bại. Vui lòng thử chạy quyền Administrator.", L"CyberNexus Setup", MB_ICONERROR);
        return 1;
    }

    // Open Windows Firewall for Master (8500) and/or Store POS (8501)
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

    ShellExecuteW(nullptr, L"open", controlExe.wstring().c_str(), nullptr, installDir.wstring().c_str(), SW_SHOWNORMAL);
    MessageBoxW(nullptr, (L"Đã cài đặt thành công CyberNexus OS POS tại:\n" + installDir.wstring()).c_str(),
                L"CyberNexus OS POS Setup", MB_ICONINFORMATION);
    return 0;
}

#endif
