cmake_minimum_required(VERSION 3.15)
project(mod_media_stream LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(../../shared/include)

add_library(mod_media_stream SHARED mod_media_stream.cpp)

if(WIN32)
    target_link_libraries(mod_media_stream PRIVATE ws2_32 crypt32)
endif()

add_custom_command(TARGET mod_media_stream POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_media_stream> ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:mod_media_stream>/../../release/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_media_stream> $<TARGET_FILE_DIR:mod_media_stream>/../../release/modules/
)
