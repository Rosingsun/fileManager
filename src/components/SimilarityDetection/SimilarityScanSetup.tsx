import React, { useState } from "react";

import {
  Form,
  Input,
  Switch,
  Slider,
  Collapse,
  InputNumber,
  Tooltip,
} from "antd";

import {
  FolderOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { TbBolt, TbEye, TbFolderOpen, TbLayersLinked, TbRadar, TbScan } from "../icons";
import { SimilarityButton } from "./SimilarityButton";

import type { SimilarityDetectionMode, SimilarityScanConfig } from "../../types";

import FormPreview from "../FormPreview/FormPreview";

import {
  DETECTION_MODE_OPTIONS,
  INCLUDE_SUBDIRECTORIES_HINT,
  THRESHOLD_PRESETS,
} from "./similarityShared";

interface SimilarityScanSetupProps {
  onStart: (config: SimilarityScanConfig) => void;
}

const ALGO_ICONS = {
  hash: TbBolt,
  phash: TbScan,
  both: TbLayersLinked,
} as const;

const SimilarityScanSetup: React.FC<SimilarityScanSetupProps> = ({
  onStart,
}) => {
  const [form] = Form.useForm();

  const [scanPath, setScanPath] = useState("");

  const [previewVisible, setPreviewVisible] = useState(false);

  const threshold = Form.useWatch("similarityThreshold", form) ?? 86;

  const detectionMode: SimilarityDetectionMode =
    Form.useWatch("detectionMode", form) ?? "near";

  const handleSelectPath = async () => {
    if (!window.electronAPI) return;

    const path = await window.electronAPI.openDirectory();

    if (path) {
      setScanPath(path);

      form.setFieldsValue({ scanPath: path });
    }
  };

  const handleSubmit = (values: Record<string, unknown>) => {
    onStart({
      scanPath: (values.scanPath as string) || scanPath,

      includeSubdirectories: (values.includeSubdirectories as boolean) ?? true,

      minFileSize: values.minFileSize
        ? Number(values.minFileSize) * 1024
        : undefined,

      maxFileSize: values.maxFileSize
        ? Number(values.maxFileSize) * 1024 * 1024
        : undefined,

      excludedFolders: values.excludedFolders
        ? String(values.excludedFolders)
            .split("\n")
            .filter((f) => f.trim())
        : [],

      excludedExtensions: values.excludedExtensions
        ? String(values.excludedExtensions)
            .split(",")
            .map((e) => e.trim().replace(".", ""))
        : [],

      similarityThreshold: Number(values.similarityThreshold) || 86,

      detectionMode:
        (values.detectionMode as SimilarityDetectionMode) || "near",
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        includeSubdirectories: true,
        similarityThreshold: 86,
        detectionMode: "near",
      }}
      className="sim-setup"
    >
      <Form.Item
        name="scanPath"
        rules={[{ required: true, message: "请选择目录" }]}
        hidden
      >
        <Input />
      </Form.Item>

      <div className="sim-setup-grid">
        <section className="sim-panel sim-panel--directory">
          <div className="sim-panel__head">
            <div className="sim-panel__title-row">
              <h2 className="sim-panel__title">照片目录</h2>

              <div
                className="sim-panel__subdirs"
                role="group"
                aria-label="包含子文件夹"
              >
                <span className="sim-panel__subdirs-label">
                  <Tooltip title={INCLUDE_SUBDIRECTORIES_HINT}>
                    <span
                      className="sim-panel__subdirs-help"
                      role="img"
                      aria-label="包含子文件夹说明"
                    >
                      <QuestionCircleOutlined />
                    </span>
                  </Tooltip>
                </span>
                <Form.Item
                  name="includeSubdirectories"
                  valuePropName="checked"
                  noStyle
                >
                  <Switch checkedChildren="是" unCheckedChildren="否" />
                </Form.Item>
              </div>
            </div>

            <p className="sim-panel__sub">选择要扫描的本地文件夹</p>
          </div>

          <div
            className={`sim-path ${scanPath ? "is-filled" : ""}`}
            role={scanPath ? undefined : "button"}
            tabIndex={scanPath ? undefined : 0}
            onClick={!scanPath ? handleSelectPath : undefined}
            onKeyDown={(e) => {
              if (!scanPath && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();

                handleSelectPath();
              }
            }}
          >
            {!scanPath ? (
              <>
                <span className="sim-path__ring">
                  <FolderOutlined />
                </span>

                <p className="sim-path__title">点击选择文件夹</p>

                <p className="sim-path__hint">
                  支持子目录扫描，下方可展开过滤与排除规则
                </p>
              </>
            ) : (
              <>
                <code className="sim-path__code">{scanPath}</code>

                <div className="sim-path__actions">
                  <SimilarityButton
                    variant="secondary"
                    size="md"
                    icon={<TbFolderOpen size={16} />}
                    onClick={handleSelectPath}
                  >
                    更换目录
                  </SimilarityButton>
                </div>
              </>
            )}
          </div>

          <div className="sim-filters">
            <Collapse
              className="sim-advanced sim-filters__collapse"
              bordered={false}
              defaultActiveKey={[]}
              items={[
                {
                  key: "filters",

                  label: "扫描过滤",

                  children: (
                    <div className="sim-filters__body">
                      <p className="sim-filters__intro">
                        缩小扫描范围，跳过无关文件与目录
                      </p>

                      <div className="sim-filters__section">
                        <h3 className="sim-filters__section-title">文件大小</h3>

                        <div className="sim-filters__grid">
                          <Form.Item
                            label={
                              <Tooltip title="小于此大小的图片将跳过，留空表示不限">
                                <span>最小 (KB)</span>
                              </Tooltip>
                            }
                            name="minFileSize"
                          >
                            <InputNumber min={0} placeholder="不限" />
                          </Form.Item>

                          <Form.Item
                            label={
                              <Tooltip title="大于此大小的图片将跳过，留空表示不限">
                                <span>最大 (MB)</span>
                              </Tooltip>
                            }
                            name="maxFileSize"
                          >
                            <InputNumber min={0} placeholder="不限" />
                          </Form.Item>
                        </div>
                      </div>

                      <div className="sim-filters__section">
                        <h3 className="sim-filters__section-title">排除规则</h3>

                        <Form.Item
                          className="sim-filters__exclude"
                          label={
                            <Tooltip title="每行一个完整路径，匹配到的子目录不会参与扫描">
                              <span>排除目录</span>
                            </Tooltip>
                          }
                          name="excludedFolders"
                        >
                          <Input.TextArea
                            rows={2}
                            placeholder={"D:\\Backup\nD:\\Photos\\Cache"}
                          />
                        </Form.Item>

                        <Form.Item
                          className="sim-filters__exclude"
                          label={
                            <Tooltip title="逗号分隔，不含点号，如 raw, tif">
                              <span>排除扩展名</span>
                            </Tooltip>
                          }
                          name="excludedExtensions"
                        >
                          <Input placeholder="gif, bmp, raw" />
                        </Form.Item>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </section>

        <section className="sim-panel">
          <div className="sim-panel__head">
            <h2 className="sim-panel__title">检测策略</h2>

            <p className="sim-panel__sub">
              检测范围决定找回哪些照片，相似度决定严格程度
            </p>
          </div>

          <Form.Item name="detectionMode" hidden>
            <Input />
          </Form.Item>

          <div
            className="sim-algo-grid"
            role="radiogroup"
            aria-label="检测范围"
          >
            {DETECTION_MODE_OPTIONS.map((opt) => {
              const Icon = ALGO_ICONS[opt.iconKey];

              const active = detectionMode === opt.value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`sim-algo ${active ? "is-active" : ""} ${
                    opt.safe ? "" : "is-reference"
                  }`}
                  onClick={() =>
                    form.setFieldsValue({ detectionMode: opt.value })
                  }
                >
                  <span className="sim-algo__icon">
                    <Icon size={15} />
                  </span>

                  <span className="sim-algo__name">{opt.name}</span>

                  <span className="sim-algo__desc">{opt.desc}</span>
                </button>
              );
            })}
          </div>

          {detectionMode === "exact" ? (
            <p className="sim-mode-note">
              仅按文件内容完全一致分组，不做视觉比对；像素级相同即判为重复。
            </p>
          ) : null}

          {detectionMode === "scene" ? (
            <p className="sim-mode-note is-warn">
              同场景组由 CLIP 语义生成，可能包含「同类不同照片」，仅作参考，
              不参与批量删除与移动。
            </p>
          ) : null}

          {detectionMode === "exact" ? null : (
            <>
              <div
                className="sim-presets"
                role="group"
                aria-label="相似度预设"
              >
                {THRESHOLD_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`sim-preset ${
                      threshold === preset.value ? "is-active" : ""
                    }`}
                    onClick={() =>
                      form.setFieldsValue({ similarityThreshold: preset.value })
                    }
                  >
                    <span className="sim-preset__label">{preset.label}</span>

                    <span className="sim-preset__value">{preset.value}%</span>

                    <span className="sim-preset__hint">{preset.hint}</span>
                  </button>
                ))}
              </div>

              <Form.Item name="similarityThreshold" noStyle>
                <div className="sim-slider-label">
                  <span>精细调节</span>

                  <strong>{threshold}%</strong>
                </div>

                <Slider min={75} max={100} />
              </Form.Item>
            </>
          )}
        </section>
      </div>

      <div className="sim-setup-bar">
        <div className="sim-setup-bar__row">
          <SimilarityButton
            variant="ghost"
            size="md"
            icon={<TbEye size={16} />}
            onClick={() => setPreviewVisible(true)}
          >
            预览配置
          </SimilarityButton>
          <SimilarityButton
            type="submit"
            variant="primary"
            size="lg"
            icon={<TbRadar size={17} />}
            disabled={!scanPath}
          >
            开始扫描
          </SimilarityButton>
        </div>
      </div>

      <FormPreview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        formInstance={form}
        title="相似照片检测配置预览"
      />
    </Form>
  );
};

export default SimilarityScanSetup;
