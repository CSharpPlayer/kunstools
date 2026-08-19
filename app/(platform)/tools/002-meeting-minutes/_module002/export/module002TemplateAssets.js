import { module002WriteFile } from "../workspace/module002FileSystem";

export const module002TemplateKinds = Object.freeze({
  notice: "notice",
  attendance: "attendance",
});

const module002TemplateDescriptors = Object.freeze({
  [module002TemplateKinds.notice]: {
    builtInUrl: "/module002-templates/module002-notice-template.docx",
    customFileName: "module002-custom-notice-template.docx",
    extension: ".docx",
    label: "通知模板",
    maximumSize: 8 * 1024 * 1024,
  },
  [module002TemplateKinds.attendance]: {
    builtInUrl: "/module002-templates/module002-attendance-template.xlsx",
    customFileName: "module002-custom-attendance-template.xlsx",
    extension: ".xlsx",
    label: "签到簿模板",
    maximumSize: 8 * 1024 * 1024,
  },
});

/** 返回固定内置模板的字段映射，供恢复模板时重置配置。 */
export function module002CreateBuiltInTemplateMapping(module002Kind) {
  if (module002Kind === module002TemplateKinds.notice) {
    return {
      title: 7,
      recipient: 9,
      explanation: 10,
      topics: 11,
      attire: 12,
      signatureDate: 22,
    };
  }
  return {
    organization: "C2:F2",
    meetingName: "C3:F3",
    topics: "C4:F4",
  };
}

/** 返回模块 002 内置模板的本地保存与访问描述。 */
export function module002GetTemplateDescriptor(module002Kind) {
  const module002Descriptor = module002TemplateDescriptors[module002Kind];
  if (!module002Descriptor) throw new Error("未知的导出模板类型");
  return module002Descriptor;
}

/** 校验用户选择的本地模板文件类型与大小。 */
export function module002ValidateTemplateUpload(module002Kind, module002File) {
  const module002Descriptor = module002GetTemplateDescriptor(module002Kind);
  if (!module002File?.name?.toLowerCase().endsWith(module002Descriptor.extension)) {
    throw new Error(`请选择 ${module002Descriptor.extension} 格式的${module002Descriptor.label}`);
  }
  if (module002File.size > module002Descriptor.maximumSize) {
    throw new Error(`${module002Descriptor.label}不能超过 8MB`);
  }
}

/** 将自定义模板写入模块 002 工作区，避免依赖电脑上的固定路径。 */
export async function module002SaveCustomTemplate(
  module002DirectoryHandle,
  module002Kind,
  module002File,
) {
  module002ValidateTemplateUpload(module002Kind, module002File);
  const module002Descriptor = module002GetTemplateDescriptor(module002Kind);
  await module002WriteFile(
    module002DirectoryHandle,
    module002Descriptor.customFileName,
    module002File,
  );
  return module002Descriptor.customFileName;
}

/** 读取当前配置选中的内置或本地自定义模板文件。 */
export async function module002LoadTemplateFile(
  module002DirectoryHandle,
  module002TemplateConfig,
  module002Kind,
) {
  const module002Descriptor = module002GetTemplateDescriptor(module002Kind);
  if (module002TemplateConfig.source === "custom") {
    const module002FileName = module002TemplateConfig.customFileName;
    if (!module002FileName) throw new Error(`${module002Descriptor.label}尚未保存到本地工作区`);
    try {
      const module002FileHandle = await module002DirectoryHandle.getFileHandle(module002FileName);
      return module002FileHandle.getFile();
    } catch (module002Error) {
      if (module002Error?.name === "NotFoundError") {
        throw new Error(`${module002Descriptor.label}文件不存在，请重新上传或恢复内置模板`);
      }
      throw module002Error;
    }
  }
  const module002Response = await fetch(module002Descriptor.builtInUrl);
  if (!module002Response.ok) throw new Error(`无法读取内置${module002Descriptor.label}`);
  return new File(
    [await module002Response.blob()],
    module002Descriptor.customFileName.replace("module002-custom-", ""),
    { type: module002Response.headers.get("content-type") || "application/octet-stream" },
  );
}
