cmake_minimum_required(VERSION 3.15)
project(mod_pos_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(../../shared/include)

add_library(mod_pos_core SHARED mod_pos_core.cpp)

if(WIN32)
    target_link_libraries(mod_pos_core PRIVATE ws2_32 crypt32)
endif()

add_custom_command(TARGET mod_pos_core POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_pos_core> ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:mod_pos_core>/../../release/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_pos_core> $<TARGET_FILE_DIR:mod_pos_core>/../../release/modules/
)
