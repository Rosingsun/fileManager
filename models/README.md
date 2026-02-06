# 图片分类模型文件

本目录用于存放图片内容分类所需的 ONNX 模型文件。

## 模型要求

- **模型格式**: ONNX (.onnx)
- **模型类型**: 图像分类模型（推荐使用 MobileNetV2 或 ResNet）
- **输入尺寸**: 224x224 RGB 图像
- **输入格式**: Float32, shape: [1, 3, 224, 224], 值范围: [0, 1]
- **输出**: ImageNet 1000 类概率分布

## 推荐模型

### MobileNetV2 (推荐)
- **文件名**: `mobilenetv2-7.onnx`
- **大小**: 约 14 MB
- **下载地址**: 
  - ONNX Model Zoo: https://github.com/onnx/models/tree/main/vision/classification/mobilenet
  - 或使用以下命令转换 PyTorch 模型：
    ```bash
    # 需要安装 torch 和 onnx
    python -c "import torch; import torchvision.models as models; model = models.mobilenet_v2(pretrained=True); model.eval(); dummy_input = torch.randn(1, 3, 224, 224); torch.onnx.export(model, dummy_input, 'mobilenetv2-7.onnx', opset_version=7)"
    ```

### ResNet-50
- **文件名**: `resnet50.onnx`
- **大小**: 约 98 MB
- **下载地址**: ONNX Model Zoo

## 模型放置

将下载的模型文件放置在 `models/` 目录下，主进程会自动加载。

## 注意事项

1. 模型文件较大，首次使用时需要下载
2. 模型加载需要一定时间，请耐心等待
3. 如果模型文件不存在，分类功能将自动禁用，不会影响其他功能
4. 模型文件路径配置在 `electron/main/main.ts` 中的 `loadClassificationModel()` 函数

## 模型更新

如果需要更换模型，只需：
1. 将新模型文件放入 `models/` 目录
2. 修改 `electron/main/main.ts` 中的模型路径
3. 重启应用

## 类别映射

模型输出的 ImageNet 1000 类会自动映射到以下 7 个自定义类别：
- 动物 (animal)
- 车辆 (vehicle)
- 人物 (person)
- 风景 (landscape)
- 建筑 (architecture)
- 食物 (food)
- 其他 (other)

映射规则在 `electron/main/main.ts` 中的 `categoryMapping` 对象中定义。
