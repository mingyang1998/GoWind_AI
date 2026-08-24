// 把上传的 Office/文本文件解析为纯文本，供 AI 对话分析。
// - 文本类(.txt/.md/.csv/.json/.log/代码等): readAsText
// - .docx: mammoth 抽纯文本
// - .xlsx/.xls: SheetJS 转 CSV(每个 sheet 一段)
// 不支持: 扫描版 PDF(需 OCR)、老 .doc(需后端 LibreOffice/antiword)
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface Extracted {
  name: string;
  content: string;
  size: number;
}

const TEXT_EXT = [
  '.txt', '.md', '.markdown', '.csv', '.json', '.log', '.py', '.go',
  '.js', '.ts', '.tsx', '.yaml', '.yml', '.xml', '.html', '.css', '.sh', '.bat', '.ini', '.cfg',
];

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export async function extractText(file: File): Promise<Extracted> {
  const e = ext(file.name);

  // 1) 文本类：直接读
  if (TEXT_EXT.includes(e) || file.type.startsWith('text/')) {
    const content = await file.text();
    return { name: file.name, content, size: file.size };
  }

  // 2) .docx：mammoth 抽纯文本
  if (e === '.docx') {
    const arrayBuffer = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer });
    return { name: file.name, content: res.value || '', size: file.size };
  }

  // 3) .xlsx / .xls：SheetJS，每个 sheet 转 CSV 拼接
  if (e === '.xlsx' || e === '.xls') {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const parts: string[] = [];
    for (const sn of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
      parts.push(`=== Sheet: ${sn} (${csv.split('\n').length} 行) ===\n${csv}`);
    }
    return { name: file.name, content: parts.join('\n\n'), size: file.size };
  }

  // 4) 不支持
  throw new Error(
    `暂不支持 ${e || '该'} 格式。支持：.txt/.md/.csv/.json/.log/代码/.docx/.xlsx。` +
    `扫描版 PDF、老 .doc/.xls 需后端解析（OCR/LibreOffice）。`
  );
}
