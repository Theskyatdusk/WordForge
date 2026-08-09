/**
 * 导入词库 —— 对齐 web 端 pages/ImportPage.tsx。
 *
 * 迁移差异（小程序没有 File / FileReader / 拖拽）：
 *   - 拖拽上传区 → Taro.chooseMessageFile 从聊天会话选文件 + FileSystemManager.readFile
 *   - 额外提供「从剪贴板粘贴」（Taro.getClipboardData），这是小程序上最顺手的路径
 *   - <textarea> → Taro <Textarea>
 *   - localStorage → storage 工具（Taro.setStorageSync）
 *   - navigate('/library') → Taro.switchTab
 */
import { useState, useCallback } from 'react';
import { View, Text, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/Icon';
import { useUIStore } from '../../store/useUIStore';
import { storage } from '../../utils/storage';
import { sfx } from '../../utils/sfx';
import type { VocabData } from '../../types/index';
import './index.scss';

interface ParseResult {
  success: boolean;
  data?: VocabData;
  error?: string;
  stats?: { chapters: number; sections: number; groups: number; items: number };
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

const FORMAT_SNIPPET = `{
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
}`;

/** 与 web 端逐字一致的校验逻辑，保证两端导入结果完全相同 */
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
          return {
            success: false,
            error: `第 ${i + 1} 章第 ${j + 1} 节第 ${k + 1} 组缺少 items 数组`,
          };
        }
        totalGroups++;

        for (let m = 0; m < grp.items.length; m++) {
          const item = grp.items[m] as Record<string, unknown>;
          if (!item || typeof item.en !== 'string' || typeof item.zh !== 'string') {
            return {
              success: false,
              error: `第 ${i + 1} 章第 ${j + 1} 节第 ${k + 1} 组第 ${m + 1} 个词条数据无效`,
            };
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

export default function ImportPage() {
  const addToast = useUIStore((s) => s.addToast);

  const [input, setInput] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const handleParse = useCallback((text: string) => {
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    try {
      const result = validateVocabData(JSON.parse(text));
      setParseResult(result);
      if (result.success) sfx.correct();
      else sfx.error();
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

  /** 从微信聊天会话选择 .json 文件 */
  const handleChooseFile = async () => {
    sfx.click();
    try {
      const res = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['json'],
      });
      const file = res.tempFiles?.[0];
      if (!file) return;
      if (!file.name.endsWith('.json')) {
        addToast('请选择 .json 格式的文件', 'error');
        sfx.error();
        return;
      }
      const fs = Taro.getFileSystemManager();
      fs.readFile({
        filePath: file.path,
        encoding: 'utf-8',
        success: (r) => {
          const text = r.data as string;
          setInput(text);
          handleParse(text);
        },
        fail: () => {
          addToast('文件读取失败', 'error');
          sfx.error();
        },
      });
    } catch {
      /* 用户取消选择，静默处理 */
    }
  };

  /** 从剪贴板读取 JSON —— 小程序上最常用的导入路径 */
  const handlePasteClipboard = async () => {
    sfx.click();
    try {
      const { data } = await Taro.getClipboardData();
      if (!data || !data.trim()) {
        addToast('剪贴板为空', 'error');
        return;
      }
      setInput(data);
      handleParse(data);
    } catch {
      addToast('读取剪贴板失败', 'error');
      sfx.error();
    }
  };

  const handleImport = () => {
    if (!parseResult?.success || !parseResult.data) return;
    try {
      storage.set('wordforge_custom_vocab', JSON.stringify(parseResult.data));
      sfx.success();
      addToast(
        `导入成功！${parseResult.stats?.chapters} 章，${parseResult.stats?.items} 个词条`,
        'success',
      );
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/library/index' });
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

  const stats = parseResult?.stats;
  const statCells = stats
    ? [
        { n: stats.chapters, label: '章节' },
        { n: stats.sections, label: '小节' },
        { n: stats.groups, label: '词组' },
        { n: stats.items, label: '词条' },
      ]
    : [];

  return (
    <PageShell tabBarSpace={false}>
      <View className="wf-fade-in">
        {/* 返回 */}
        <View
          className="im__back"
          onClick={() => {
            sfx.navigate();
            Taro.switchTab({ url: '/pages/library/index' });
          }}
        >
          <Icon name="chevron-left" size={16} color="#94a3b8" />
          <Text className="im__back-text">返回词库</Text>
        </View>

        <View className="im__head">
          <Text className="wf-h1">导入词库</Text>
          <Text className="wf-sub">上传 JSON 格式的自定义词库数据</Text>
        </View>

        {/* 选择文件 */}
        <View className="im__drop" hoverClass="im__drop--pressed" onClick={handleChooseFile}>
          <View className="im__drop-icon">
            <Icon name="upload" size={28} color="#0d9488" />
          </View>
          <Text className="im__drop-title">从聊天会话选择文件</Text>
          <Text className="im__drop-desc">支持 .json 格式词库文件</Text>
        </View>

        {/* 分割线 */}
        <View className="im__divider">
          <View className="im__divider-line" />
          <Text className="im__divider-text">或粘贴 JSON</Text>
          <View className="im__divider-line" />
        </View>

        {/* 文本输入 */}
        <View className="im__editor">
          <Textarea
            className="im__textarea"
            value={input}
            placeholder='{"chapters": [...]}'
            placeholderClass="im__textarea-ph"
            maxlength={-1}
            autoHeight={false}
            onInput={(e) => handleInputChange(e.detail.value)}
          />
          {!!input && (
            <View className="im__clear" onClick={handleClear}>
              <Icon name="trash" size={14} color="#94a3b8" />
            </View>
          )}
        </View>

        {/* 操作 */}
        <View className="im__actions">
          <Button variant="secondary" size="md" onClick={handlePasteClipboard}>
            <Icon name="file-text" size={16} color="#334155" />
            <Text className="im__btn-text">读剪贴板</Text>
          </Button>
          <Button variant="secondary" size="md" onClick={handleLoadSample}>
            <Icon name="download" size={16} color="#334155" />
            <Text className="im__btn-text">加载示例</Text>
          </Button>
        </View>

        {parseResult?.success && (
          <Button variant="primary" fullWidth size="lg" className="im__cta" onClick={handleImport}>
            <Icon name="check-plain" size={18} color="#fff" />
            <Text className="im__btn-text">确认导入</Text>
          </Button>
        )}

        {/* 解析结果 */}
        {parseResult && (
          <Card
            padding="md"
            className="im__result"
            style={{
              borderColor: parseResult.success ? '#16a34a' : '#dc2626',
              borderWidth: '2px',
            }}
          >
            {parseResult.success ? (
              <View>
                <View className="im__result-head">
                  <View className="im__result-icon" style={{ background: 'rgba(22,163,74,0.12)' }}>
                    <Icon name="check-plain" size={18} color="#16a34a" />
                  </View>
                  <Text className="im__result-title" style={{ color: '#16a34a' }}>
                    格式验证通过
                  </Text>
                </View>
                <View className="im__stats">
                  {statCells.map((c) => (
                    <View key={c.label} className="im__stat">
                      <Text className="im__stat-num">{c.n}</Text>
                      <Text className="im__stat-label">{c.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View className="im__err">
                <View className="im__result-icon" style={{ background: 'rgba(220,38,38,0.12)' }}>
                  <Icon name="alert" size={18} color="#dc2626" />
                </View>
                <View className="im__err-body">
                  <Text className="im__result-title" style={{ color: '#dc2626' }}>
                    验证失败
                  </Text>
                  <Text className="im__err-msg">{parseResult.error}</Text>
                </View>
              </View>
            )}
          </Card>
        )}

        {/* 格式说明 */}
        <Card padding="md" className="im__guide">
          <View className="im__guide-head">
            <Icon name="file-text" size={18} color="#0d9488" />
            <Text className="im__guide-title">JSON 格式说明</Text>
          </View>
          <View className="im__guide-list">
            <Text className="im__guide-line">
              <Text className="im__code">chapters</Text> - 章节数组，含 id, title, icon, sections
            </Text>
            <Text className="im__guide-line">
              <Text className="im__code">sections</Text> - 小节数组，含 id, title, groups
            </Text>
            <Text className="im__guide-line">
              <Text className="im__code">groups</Text> - 词组数组，含 id, title, type, items
            </Text>
            <Text className="im__guide-line">
              <Text className="im__code">items</Text> - 词条数组，含 id, en, zh, pos (可选)
            </Text>
          </View>
          <View className="im__snippet">
            <Text className="im__snippet-text">{FORMAT_SNIPPET}</Text>
          </View>
        </Card>

        {/* 提示 */}
        <Card padding="md" className="im__tips">
          <View className="im__tips-icon">
            <Icon name="book" size={18} color="#8b5cf6" />
          </View>
          <View className="im__tips-body">
            <Text className="im__tips-title">导入提示</Text>
            <Text className="im__tips-line">· 导入的词库将替换当前自定义词库</Text>
            <Text className="im__tips-line">· 每个词条的 en 和 zh 字段为必填项</Text>
            <Text className="im__tips-line">· pos (词性) 字段为可选，如 n. v. adj.</Text>
            <Text className="im__tips-line">· type 可选值：word, phrase, sentence</Text>
          </View>
        </Card>
      </View>
    </PageShell>
  );
}
