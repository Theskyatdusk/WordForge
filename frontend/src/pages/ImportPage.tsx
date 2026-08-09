/**
 * ImportPage — Import custom vocabulary data via JSON paste or file upload.
 * Supports validation, preview, and format guide.
 */
import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Check,
  ChevronLeft,
  AlertTriangle,
  FileText,
  ClipboardPaste,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { sfx } from '../utils/sfx';
import { useUIStore } from '../store/useUIStore';
import { loadCustomVocab } from '../hooks/useVocab';
import type { VocabData } from '../types/index';

interface ParseResult {
  success: boolean;
  data?: VocabData;
  error?: string;
  stats?: {
    chapters: number;
    sections: number;
    groups: number;
    items: number;
  };
}

const SAMPLE_JSON = `{
  "chapters": [
    {
      "id": "custom1",
      "title": "自定义词库",
      "subtitle": "我的单词表",
      "icon": "📚",
      "color": "#0d9488",
      "sections": [
        {
          "id": "s1",
          "title": "第一单元",
          "groups": [
            {
              "id": 1,
              "title": "基础词汇",
              "type": "word",
              "items": [
                { "id": 1, "en": "example", "zh": "例子", "pos": "n." },
                { "id": 2, "en": "practice", "zh": "练习", "pos": "v." }
              ]
            }
          ]
        }
      ]
    }
  ]
}`;

function validateVocabData(obj: unknown): ParseResult {
  if (!obj || typeof obj !== 'object') {
    return { success: false, error: '数据格式无效：需要一个 JSON 对象' };
  }

  const data = obj as Record<string, unknown>;
  if (!Array.isArray(data.chapters)) {
    return { success: false, error: '缺少 chapters 数组字段' };
  }

  let totalSections = 0;
  let totalGroups = 0;
  let totalItems = 0;

  for (let i = 0; i < data.chapters.length; i++) {
    const ch = data.chapters[i] as Record<string, unknown>;
    if (!ch || typeof ch !== 'object') {
      return { success: false, error: `第 ${i + 1} 章数据无效` };
    }
    if (typeof ch.id !== 'string' || typeof ch.title !== 'string') {
      return { success: false, error: `第 ${i + 1} 章缺少 id 或 title 字段` };
    }
    if (!Array.isArray(ch.sections)) {
      return { success: false, error: `第 ${i + 1} 章缺少 sections 数组` };
    }

    for (let j = 0; j < ch.sections.length; j++) {
      const sec = ch.sections[j] as Record<string, unknown>;
      if (!sec || typeof sec.id !== 'string' || typeof sec.title !== 'string') {
        return { success: false, error: `第 ${i + 1} 章第 ${j + 1} 节数据无效` };
      }
      if (!Array.isArray(sec.groups)) {
        return { success: false, error: `第 ${i + 1} 章第 ${j + 1} 节缺少 groups 数组` };
      }
      totalSections++;

      for (let k = 0; k < sec.groups.length; k++) {
        const grp = sec.groups[k] as Record<string, unknown>;
        if (!grp || typeof grp.title !== 'string') {
          return { success: false, error: `第 ${i + 1} 章第 ${j + 1} 节第 ${k + 1} 组数据无效` };
        }
        if (!Array.isArray(grp.items)) {
          return { success: false, error: `第 ${i + 1} 章第 ${j + 1} 节第 ${k + 1} 组缺少 items 数组` };
        }
        totalGroups++;

        for (let m = 0; m < grp.items.length; m++) {
          const item = grp.items[m] as Record<string, unknown>;
          if (!item || typeof item.en !== 'string' || typeof item.zh !== 'string') {
            return { success: false, error: `第 ${i + 1} 章第 ${j + 1} 节第 ${k + 1} 组第 ${m + 1} 个词条数据无效` };
          }
          totalItems++;
        }
      }
    }
  }

  return {
    success: true,
    data: data as unknown as VocabData,
    stats: {
      chapters: data.chapters.length,
      sections: totalSections,
      groups: totalGroups,
      items: totalItems,
    },
  };
}

export function ImportPage() {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleParse = useCallback((text: string) => {
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const result = validateVocabData(parsed);
      setParseResult(result);
      if (result.success) {
        sfx.correct();
      } else {
        sfx.error();
      }
    } catch (e) {
      setParseResult({
        success: false,
        error: `JSON 解析错误：${e instanceof Error ? e.message : '未知错误'}`,
      });
      sfx.error();
    }
  }, []);

  const handleInputChange = (value: string) => {
    setInput(value);
    handleParse(value);
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.json')) {
      addToast('请上传 .json 格式的文件', 'error');
      sfx.error();
      return;
    }

    // File size validation — limit to 5MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      addToast(`文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，请上传小于 5MB 的文件`, 'error');
      sfx.error();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInput(text);
      handleParse(text);
    };
    reader.onerror = () => {
      addToast('文件读取失败', 'error');
      sfx.error();
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleImport = () => {
    if (!parseResult?.success || !parseResult.data) return;

    try {
      localStorage.setItem('wordforge_custom_vocab', JSON.stringify(parseResult.data));
      // Reload custom vocab into the shared cache so all pages see it immediately
      loadCustomVocab();
      sfx.success();
      addToast(
        `导入成功！${parseResult.stats?.chapters} 章，${parseResult.stats?.items} 个词条`,
        'success',
      );
      setTimeout(() => {
        navigate('/library');
      }, 1000);
    } catch {
      addToast('保存失败：存储空间不足', 'error');
      sfx.error();
    }
  };

  const handleClear = () => {
    sfx.remove();
    setInput('');
    setParseResult(null);
  };

  const handleLoadSample = () => {
    sfx.click();
    setInput(SAMPLE_JSON);
    handleParse(SAMPLE_JSON);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => {
          sfx.navigate();
          navigate('/library');
        }}
        className="flex items-center gap-1 text-sm"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <ChevronLeft size={16} />
        返回词库
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>
          导入词库
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          上传 JSON 格式的自定义词库数据
        </p>
      </div>

      {/* File Upload Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center p-8 rounded-2xl cursor-pointer transition-all"
        style={{
          background: dragOver ? 'rgba(20,184,166,0.08)' : 'var(--surface)',
          border: `2px dashed ${dragOver ? 'var(--teal-500)' : 'var(--border)'}`,
        }}
      >
        <div
          className="flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
          style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--teal-600)' }}
        >
          <Upload size={28} />
        </div>
        <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
          点击或拖拽文件到此处
        </p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          支持 .json 格式词库文件
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
      </div>

      {/* Or paste JSON */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          或粘贴 JSON
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      {/* JSON Input */}
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder='{"chapters": [...]}'
          rows={8}
          className="w-full p-4 rounded-xl text-sm font-mono outline-none resize-y"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
          }}
        />
        {input && (
          <button
            onClick={handleClear}
            className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={handleLoadSample}
        >
          <ClipboardPaste size={16} />
          加载示例
        </Button>
        {parseResult?.success && (
          <Button
            variant="primary"
            fullWidth
            onClick={handleImport}
          >
            <Check size={18} />
            确认导入
          </Button>
        )}
      </div>

      {/* Parse Result */}
      {parseResult && (
        <Card
          padding="md"
          style={{
            borderColor: parseResult.success ? '#16a34a' : '#dc2626',
            borderWidth: 2,
          }}
        >
          {parseResult.success ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full"
                  style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
                >
                  <Check size={18} />
                </div>
                <span className="font-bold text-sm" style={{ color: '#16a34a' }}>
                  格式验证通过
                </span>
              </div>
              {parseResult.stats && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: 'var(--teal-600)' }}>
                      {parseResult.stats.chapters}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      章节
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: 'var(--teal-600)' }}>
                      {parseResult.stats.sections}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      小节
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: 'var(--teal-600)' }}>
                      {parseResult.stats.groups}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      词组
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: 'var(--teal-600)' }}>
                      {parseResult.stats.items}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      词条
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}
              >
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="font-bold text-sm mb-1" style={{ color: '#dc2626' }}>
                  验证失败
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {parseResult.error}
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Format Guide */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={18} style={{ color: 'var(--teal-600)' }} />
          <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            JSON 格式说明
          </h3>
        </div>
        <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <p>
            <code style={{ color: 'var(--teal-600)', fontWeight: 600 }}>chapters</code>
            {' '}
            - 章节数组，每个章节包含 id, title, icon, sections
          </p>
          <p>
            <code style={{ color: 'var(--teal-600)', fontWeight: 600 }}>sections</code>
            {' '}
            - 小节数组，每个小节包含 id, title, groups
          </p>
          <p>
            <code style={{ color: 'var(--teal-600)', fontWeight: 600 }}>groups</code>
            {' '}
            - 词组数组，每个词组包含 id, title, type, items
          </p>
          <p>
            <code style={{ color: 'var(--teal-600)', fontWeight: 600 }}>items</code>
            {' '}
            - 词条数组，每个词条包含 id, en, zh, pos (可选)
          </p>
        </div>
        <div
          className="mt-3 p-3 rounded-lg overflow-x-auto"
          style={{ background: 'var(--surface-2)' }}
        >
          <pre
            className="text-xs"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
            }}
          >
{`{
  "chapters": [{
    "id": "ch1",
    "title": "第一章",
    "sections": [{
      "id": "s1", "title": "第一节",
      "groups": [{
        "id": 1, "title": "词组",
        "type": "word",
        "items": [
          {"id":1,"en":"word","zh":"单词"}
        ]
      }]
    }]
  }]
}`}
          </pre>
        </div>
      </Card>

      {/* Tips */}
      <Card padding="md" className="flex items-start gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
          style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--violet-500)' }}
        >
          <BookOpen size={18} />
        </div>
        <div>
          <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
            导入提示
          </p>
          <ul className="text-xs space-y-1" style={{ color: 'var(--text-tertiary)' }}>
            <li>- 导入的词库将替换当前自定义词库</li>
            <li>- 每个词条的 en 和 zh 字段为必填项</li>
            <li>- pos (词性) 字段为可选，如 n. v. adj.</li>
            <li>- type 可选值：word, phrase, sentence</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
