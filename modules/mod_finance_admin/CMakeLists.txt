cmake_minimum_required(VERSION 3.15)
project(mod_finance_admin LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(../../shared/include)

add_library(mod_finance_admin SHARED mod_finance_admin.cpp)

if(WIN32)
    target_link_libraries(mod_finance_admin PRIVATE ws2_32 crypt32)
endif()

add_custom_command(TARGET mod_finance_admin POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_finance_admin> ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:mod_finance_admin>/../../release/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_finance_admin> $<TARGET_FILE_DIR:mod_finance_admin>/../../release/modules/
)
