cmake_minimum_required(VERSION 3.15)
project(CYBERNEXUS_OS LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)

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
    core/src/license.cpp
    master/src/master_handlers.cpp
    master/src/main_master.cpp
)

add_executable(cybernexus_master ${MASTER_SRCS})
target_compile_definitions(cybernexus_master PRIVATE CYBERNEXUS_ROLE_MASTER=1)

if(WIN32)
    target_link_libraries(cybernexus_master PRIVATE ws2_32 crypt32 wsock32)
endif()

# ========================================================
# 2. TARGET SLAVE: cybernexus_slave.exe
# Dành cho máy trạm POS / KDS tại quán (Edge Node)
# Hoàn toàn KHÔNG chứa mã nguồn Super Admin
# ========================================================
set(SLAVE_SRCS
    ${SHARED_SRCS}
    slave/src/slave_license.cpp
    slave/src/slave_handlers.cpp
    slave/src/main_slave.cpp
)

add_executable(cybernexus_slave ${SLAVE_SRCS})
target_compile_definitions(cybernexus_slave PRIVATE CYBERNEXUS_ROLE_SLAVE=1)

if(WIN32)
    target_link_libraries(cybernexus_slave PRIVATE ws2_32 crypt32 wsock32)
endif()

# ========================================================
# 3. Dynamic Sub-Modules
# ========================================================
add_subdirectory(modules/mod_pos_core)
add_subdirectory(modules/mod_network_qos)
add_subdirectory(modules/mod_media_stream)
