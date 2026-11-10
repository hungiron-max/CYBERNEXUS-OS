cmake_minimum_required(VERSION 3.15)
project(mod_network_qos LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(../../shared/include)

add_library(mod_network_qos SHARED mod_network_qos.cpp)

if(WIN32)
    target_link_libraries(mod_network_qos PRIVATE ws2_32 crypt32)
endif()

add_custom_command(TARGET mod_network_qos POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_network_qos> ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:mod_network_qos>/../../release/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_network_qos> $<TARGET_FILE_DIR:mod_network_qos>/../../release/modules/
)
