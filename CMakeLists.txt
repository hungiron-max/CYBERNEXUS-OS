cmake_minimum_required(VERSION 3.15)
project(CYBERNEXUS_OS LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if(NOT WIN32)
    find_package(Threads REQUIRED)
endif()

# Include Directories
include_directories(
    shared/include
    master/src
    slave/src
)

# Common Compiler Options
if(MSVC)
    add_compile_options(/O2 /EHsc /utf-8 /wd4996)
else()
    add_compile_options(-Wall -O3)
    if(MINGW)
        add_link_options(-static -static-libgcc -static-libstdc++)
    endif()
endif()

# Shared Common Sources
set(SHARED_SRCS
    shared/src/sqlite3.c
    shared/src/pos_bcrypt.c
    shared/src/db.cpp
    shared/src/auth.cpp
    shared/src/body_parser.cpp
    shared/src/PluginManager.cpp
)

# ========================================================
# 1. TARGET MASTER: cybernexus_master.exe
# Dành riêng cho SuperAdmin & Máy chủ Cloud SaaS trung tâm
# ========================================================
set(MASTER_SRCS
    ${SHARED_SRCS}
    master/src/master_license.cpp
    master/src/master_handlers.cpp
    master/src/main_master.cpp
)

add_executable(cybernexus_master ${MASTER_SRCS})
target_compile_definitions(cybernexus_master PRIVATE CYBERNEXUS_ROLE_MASTER=1)

if(WIN32)
    target_link_libraries(cybernexus_master PRIVATE ws2_32 crypt32 wsock32 iphlpapi winhttp)
    if(MINGW)
        target_link_options(cybernexus_master PRIVATE -static -static-libgcc -static-libstdc++)
    endif()
else()
    target_link_libraries(cybernexus_master PRIVATE Threads::Threads ${CMAKE_DL_LIBS})
endif()

# ========================================================
# 2. TARGET SLAVE: cybernexus_slave.exe
# Dành cho máy trạm POS / KDS tại quán (Edge Node)
# Hoàn toàn KHÔNG chứa mã nguồn Super Admin
# ========================================================
set(SLAVE_SRCS
    ${SHARED_SRCS}
    slave/src/slave_license.cpp
    slave/src/slave_license_handlers.cpp
    slave/src/slave_handlers.cpp
    slave/src/main_slave.cpp
)

add_executable(cybernexus_slave ${SLAVE_SRCS})
target_compile_definitions(cybernexus_slave PRIVATE CYBERNEXUS_ROLE_SLAVE=1)

if(WIN32)
    target_link_libraries(cybernexus_slave PRIVATE ws2_32 crypt32 wsock32 iphlpapi winhttp)
    if(MINGW)
        target_link_options(cybernexus_slave PRIVATE -static -static-libgcc -static-libstdc++)
    endif()
else()
    target_link_libraries(cybernexus_slave PRIVATE Threads::Threads ${CMAKE_DL_LIBS})
endif()

# ========================================================
# 3. Dynamic Sub-Modules
# ========================================================
add_subdirectory(modules/mod_pos_core)
add_subdirectory(modules/mod_network_qos)
add_subdirectory(modules/mod_media_stream)
add_subdirectory(modules/mod_card_payment)
add_subdirectory(modules/mod_finance_admin)

# ========================================================
# 4. TARGET CONTROL CENTER: CyberNexus_Control_Center.exe (Windows GUI)
# ========================================================
if(WIN32)
    add_executable(CyberNexus_Control_Center WIN32
        shared/src/sqlite3.c
        shared/src/pos_bcrypt.c
        shared/src/db.cpp
        shared/src/auth.cpp
        launcher/CyberNexusControlCenter.cpp
    )
    target_link_libraries(CyberNexus_Control_Center PRIVATE ws2_32 crypt32 wsock32 iphlpapi shell32 psapi)
    if(MINGW)
        target_link_options(CyberNexus_Control_Center PRIVATE -municode -mwindows -static -static-libgcc -static-libstdc++)
    endif()

    add_executable(CyberNexus_Setup_Stub WIN32
        launcher/CyberNexusSetupStub.cpp
    )
    target_link_libraries(CyberNexus_Setup_Stub PRIVATE shell32 ole32 uuid)
    if(MINGW)
        target_link_options(CyberNexus_Setup_Stub PRIVATE -municode -mwindows -static -static-libgcc -static-libstdc++)
    endif()

    add_executable(CyberNexus_Vault_Admin WIN32
        shared/src/sqlite3.c
        shared/src/pos_bcrypt.c
        shared/src/db.cpp
        shared/src/auth.cpp
        launcher/CyberNexusVaultAdmin.cpp
    )
    target_link_libraries(CyberNexus_Vault_Admin PRIVATE ws2_32 crypt32 wsock32 shell32)
    if(MINGW)
        target_link_options(CyberNexus_Vault_Admin PRIVATE -municode -mwindows -static -static-libgcc -static-libstdc++)
    endif()
endif()
