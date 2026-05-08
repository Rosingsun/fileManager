# 分类评估用样例图（可选）

用于人工或脚本统计时，可按 **真实类别** 分子文件夹放置图片：

```
images/
  person/
  animal/
  landscape/
  urban/
  indoor/
  food/
  vehicle/
  document/
  other/
```

命名与 `ImageContentCategory` 一致。将图片放入对应目录后，可在应用内对该目录执行批量分类，再对照文件夹标签统计 Top-1 准确率。

仓库不附带大图；可自行拷贝若干张测试照片到上述子目录。
