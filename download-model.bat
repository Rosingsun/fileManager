@echo off
echo 正在下载 MobileNetV2 ONNX 模型...
echo 这可能需要几分钟时间，请耐心等待...

REM 下载 MobileNetV2 模型 (约 14MB)
curl -L -o models/mobilenetv2-7.onnx https://github.com/onnx/models/raw/main/vision/classification/mobilenet/model/mobilenetv2-7.onnx

if %ERRORLEVEL% EQU 0 (
    echo 模型下载成功！
    echo 请重新启动应用以加载模型。
) else (
    echo 模型下载失败。
    echo 请手动下载模型文件：https://github.com/onnx/models/raw/main/vision/classification/mobilenet/model/mobilenetv2-7.onnx
    echo 并将文件保存为 models/mobilenetv2-7.onnx
)

pause
