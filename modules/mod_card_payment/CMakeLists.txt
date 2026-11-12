cmake_minimum_required(VERSION 3.15)
project(mod_card_payment LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(../../shared/include)

add_library(mod_card_payment SHARED 
    mod_card_payment.cpp 
    ../../shared/src/sqlite3.c
)

if(WIN32)
    target_link_libraries(mod_card_payment PRIVATE ws2_32 crypt32)
endif()

add_custom_command(TARGET mod_card_payment POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_card_payment> ${CMAKE_SOURCE_DIR}/slave/modules/
    COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:mod_card_payment>/../../release/modules/
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mod_card_payment> $<TARGET_FILE_DIR:mod_card_payment>/../../release/modules/
)
