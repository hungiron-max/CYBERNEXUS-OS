Full Deploy Package

rem -------------------------------------------------
rem 2. Define where the final package will be placed
rem -------------------------------------------------
set "PACKAGE_ROOT=%PROJECT_ROOT%\saleapp_full_package"

rem -------------------------------------------------
rem 3. Clean previous package if any
rem -------------------------------------------------
if exist "%PACKAGE_ROOT%" (
    echo Removing old package folder …
    rmdir /S /Q "%PACKAGE_ROOT%"
)
mkdir "%PACKAGE_ROOT%"
mkdir "%PACKAGE_ROOT%\backend"
mkdir "%PACKAGE_ROOT%\frontend"
mkdir "%PACKAGE_ROOT%\database"
rem Copy portable PHP folder into the package
if exist "%PROJECT_ROOT%\php" (
    xcopy "%PROJECT_ROOT%\php" "%PACKAGE_ROOT%\php" /E /I /Y
) else (
    echo WARNING: PHP folder not found at %PROJECT_ROOT%\php – please place a portable PHP distribution there.
)

rem -------------------------------------------------
rem 4. Build backend if executable is missing
rem -------------------------------------------------
if not exist "%PROJECT_ROOT%\backend-cpp\release\saleapp_backend_server.exe" (
    echo Backend executable not found – building now …
    pushd "%PROJECT_ROOT%\backend-cpp"
    if not exist build mkdir build
    cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
    if errorlevel 1 (echo CMake failed & popd & exit /b 1)
    pushd build
    ninja
    if errorlevel 1 (echo Build failed & popd & popd & exit /b 1)
    popd
    popd
)

rem -------------------------------------------------
rem 5. Copy backend artefacts
rem -------------------------------------------------
copy /Y "%PROJECT_ROOT%\backend-cpp\release\saleapp_backend_server.exe" "%PACKAGE_ROOT%\backend\"
copy /Y "%PROJECT_ROOT%\backend-cpp\release\setup_mock_db.bat" "%PACKAGE_ROOT%\backend\"
copy /Y "%PROJECT_ROOT%\backend-cpp\release\mock_data.sql" "%PACKAGE_ROOT%\backend\"

rem -------------------------------------------------
rem 6. Ensure mock SQLite DB exists in a sibling database folder
rem -------------------------------------------------
pushd "%PACKAGE_ROOT%\backend"
if not exist pos_database.sqlite (
    echo Creating mock SQLite database …
    call setup_mock_db.bat
    if errorlevel 1 (echo DB creation failed & popd & exit /b 1)
)
