cmake_minimum_required(VERSION 3.15)
project(CYBERNEXUS_OS LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)

# Include Directories for Host Core
include_directories(core/include)

# 1. Build Host Core Executable
file(GLOB_RECURSE CORE_SRCS
    core/src/*.cpp
    core/src/*.c
)

add_executable(cybernexus_host ${CORE_SRCS})

if(WIN32)
    target_link_libraries(cybernexus_host PRIVATE ws2_32 crypt32 wsock32)
endif()

if(MSVC)
    target_compile_options(cybernexus_host PRIVATE /O2 /EHsc /utf-8 /wd4996)
else()
    target_compile_options(cybernexus_host PRIVATE -Wall -O3)
endif()

# 2. Build Sub-Modules
add_subdirectory(modules/mod_pos_core)
add_subdirectory(modules/mod_network_qos)
add_subdirectory(modules/mod_media_stream)
