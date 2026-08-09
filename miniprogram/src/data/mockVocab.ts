/**
 * Mock vocabulary data for development and fallback.
 * Mirrors the backend seed data (backend/seed.py) — 6 chapters.
 */
import type { VocabData } from '../types/index';

export const mockVocabData: VocabData = {
  chapters: [
    // ===================== Chapter 1 =====================
    {
      id: 'ch1',
      title: '原笔记核心词汇复盘',
      subtitle: '基础必背',
      icon: 'book',
      color: '#0D9488',
      sections: [
        {
          id: 'ch1-s1',
          title: '社区志愿主题',
          groups: [
            {
              id: 1,
              title: '核心短语',
              type: 'phrase',
              items: [
                { id: 1, en: 'take part in', zh: '参与' },
                { id: 2, en: 'give a hand', zh: '帮忙' },
                { id: 3, en: 'make a difference', zh: '起作用' },
                { id: 4, en: 'put forward', zh: '提出' },
                { id: 5, en: 'carry out', zh: '执行' },
                { id: 6, en: 'look forward to', zh: '期待' },
              ],
            },
            {
              id: 2,
              title: '核心单词',
              type: 'word',
              items: [
                { id: 7, en: 'voluntary', zh: '志愿的', pos: 'adj.' },
                { id: 8, en: 'community', zh: '社区', pos: 'n.' },
                { id: 9, en: 'contribute', zh: '贡献', pos: 'v.' },
                { id: 10, en: 'responsible', zh: '负责的', pos: 'adj.' },
                { id: 11, en: 'benefit', zh: '利益', pos: 'n.' },
                { id: 12, en: 'participate', zh: '参与', pos: 'v.' },
              ],
            },
          ],
        },
        {
          id: 'ch1-s2',
          title: '善意温暖主题',
          groups: [
            {
              id: 3,
              title: '核心形容词&副词',
              type: 'word',
              items: [
                { id: 13, en: 'warm', zh: '温暖的', pos: 'adj.' },
                { id: 14, en: 'generous', zh: '慷慨的', pos: 'adj.' },
                { id: 15, en: 'sincere', zh: '真诚的', pos: 'adj.' },
                { id: 16, en: 'grateful', zh: '感激的', pos: 'adj.' },
                { id: 17, en: 'gentle', zh: '温柔的', pos: 'adj.' },
                { id: 18, en: 'thoughtful', zh: '体贴的', pos: 'adj.' },
              ],
            },
            {
              id: 4,
              title: '核心动词',
              type: 'word',
              items: [
                { id: 19, en: 'offer', zh: '提供', pos: 'v.' },
                { id: 20, en: 'support', zh: '支持', pos: 'v.' },
                { id: 21, en: 'encourage', zh: '鼓励', pos: 'v.' },
                { id: 22, en: 'comfort', zh: '安慰', pos: 'v.' },
                { id: 23, en: 'appreciate', zh: '感激', pos: 'v.' },
                { id: 24, en: 'inspire', zh: '激励', pos: 'v.' },
              ],
            },
            {
              id: 5,
              title: '核心名词',
              type: 'word',
              items: [
                { id: 25, en: 'kindness', zh: '善良', pos: 'n.' },
                { id: 26, en: 'warmth', zh: '温暖', pos: 'n.' },
                { id: 27, en: 'generosity', zh: '慷慨', pos: 'n.' },
                { id: 28, en: 'sympathy', zh: '同情', pos: 'n.' },
                { id: 29, en: 'compassion', zh: '同情心', pos: 'n.' },
                { id: 30, en: 'donation', zh: '捐赠', pos: 'n.' },
              ],
            },
            {
              id: 6,
              title: '核心短语',
              type: 'phrase',
              items: [
                { id: 31, en: 'lend a helping hand', zh: '伸出援手' },
                { id: 32, en: 'show concern for', zh: '关心' },
                { id: 33, en: 'be grateful for', zh: '对...感激' },
                { id: 34, en: 'make a contribution to', zh: '对...做出贡献' },
                { id: 35, en: 'take responsibility for', zh: '对...负责' },
                { id: 36, en: 'put oneself in others\' shoes', zh: '设身处地' },
              ],
            },
          ],
        },
      ],
    },
    // ===================== Chapter 2 =====================
    {
      id: 'ch2',
      title: '读后续写高分替换词 & 动作链',
      subtitle: '阅卷加分级',
      icon: 'edit',
      color: '#7C3AED',
      sections: [
        {
          id: 'ch2-s1',
          title: '普通词→高级词替换',
          groups: [
            {
              id: 7,
              title: '替换词表',
              type: 'word',
              items: [
                { id: 37, en: 'utilize', zh: '利用', pos: 'v.' },
                { id: 38, en: 'comprehend', zh: '理解', pos: 'v.' },
                { id: 39, en: 'endeavor', zh: '努力', pos: 'v.' },
                { id: 40, en: 'facilitate', zh: '促进', pos: 'v.' },
                { id: 41, en: 'acquire', zh: '获得', pos: 'v.' },
                { id: 42, en: 'implement', zh: '实施', pos: 'v.' },
                { id: 43, en: 'demonstrate', zh: '展示', pos: 'v.' },
                { id: 44, en: 'sufficient', zh: '充足的', pos: 'adj.' },
                { id: 45, en: 'consequently', zh: '因此', pos: 'adv.' },
                { id: 46, en: 'nevertheless', zh: '然而', pos: 'adv.' },
              ],
            },
          ],
        },
        {
          id: 'ch2-s2',
          title: '动作链高频动词（细节加分）',
          groups: [
            {
              id: 8,
              title: '手部动作',
              type: 'word',
              items: [
                { id: 47, en: 'grasp', zh: '抓住', pos: 'v.' },
                { id: 48, en: 'clutch', zh: '紧握', pos: 'v.' },
                { id: 49, en: 'stroke', zh: '抚摸', pos: 'v.' },
                { id: 50, en: 'trace', zh: '描摹', pos: 'v.' },
              ],
            },
            {
              id: 9,
              title: '脚步动作',
              type: 'word',
              items: [
                { id: 51, en: 'tiptoe', zh: '踮脚走', pos: 'v.' },
                { id: 52, en: 'stride', zh: '大步走', pos: 'v.' },
                { id: 53, en: 'stumble', zh: '绊倒', pos: 'v.' },
                { id: 54, en: 'dash', zh: '冲刺', pos: 'v.' },
              ],
            },
            {
              id: 10,
              title: '面部动作',
              type: 'word',
              items: [
                { id: 55, en: 'frown', zh: '皱眉', pos: 'v.' },
                { id: 56, en: 'blink', zh: '眨眼', pos: 'v.' },
                { id: 57, en: 'grin', zh: '咧嘴笑', pos: 'v.' },
                { id: 58, en: 'blush', zh: '脸红', pos: 'v.' },
              ],
            },
          ],
        },
      ],
    },
    // ===================== Chapter 3 =====================
    {
      id: 'ch3',
      title: '完形填空核心高频短语',
      subtitle: '近三年真题高频',
      icon: 'list-check',
      color: '#EA580C',
      sections: [
        {
          id: 'ch3-s1',
          title: '动词短语',
          groups: [
            {
              id: 11,
              title: '核心动词短语',
              type: 'phrase',
              items: [
                { id: 59, en: 'consist of', zh: '由...组成' },
                { id: 60, en: 'result in', zh: '导致' },
                { id: 61, en: 'lead to', zh: '导致' },
                { id: 62, en: 'belong to', zh: '属于' },
                { id: 63, en: 'depend on', zh: '取决于' },
                { id: 64, en: 'account for', zh: '解释' },
                { id: 65, en: 'bring about', zh: '引起' },
                { id: 66, en: 'set up', zh: '建立' },
                { id: 67, en: 'carry on', zh: '继续' },
                { id: 68, en: 'put off', zh: '推迟' },
              ],
            },
          ],
        },
        {
          id: 'ch3-s2',
          title: '介词短语',
          groups: [
            {
              id: 12,
              title: '核心介词短语',
              type: 'phrase',
              items: [
                { id: 69, en: 'in addition to', zh: '除...之外' },
                { id: 70, en: 'in favor of', zh: '支持' },
                { id: 71, en: 'in charge of', zh: '负责' },
                { id: 72, en: 'in terms of', zh: '就...而言' },
                { id: 73, en: 'on behalf of', zh: '代表' },
                { id: 74, en: 'by means of', zh: '通过' },
                { id: 75, en: 'for the sake of', zh: '为了' },
                { id: 76, en: 'with regard to', zh: '关于' },
                { id: 77, en: 'in spite of', zh: '尽管' },
                { id: 78, en: 'as a matter of fact', zh: '事实上' },
              ],
            },
          ],
        },
        {
          id: 'ch3-s3',
          title: '固定搭配',
          groups: [
            {
              id: 13,
              title: '固定搭配',
              type: 'phrase',
              items: [
                { id: 79, en: 'take advantage of', zh: '利用' },
                { id: 80, en: 'take pride in', zh: '以...为傲' },
                { id: 81, en: 'take into account', zh: '考虑到' },
                { id: 82, en: 'make sense of', zh: '理解' },
                { id: 83, en: 'lose track of', zh: '失去...的踪迹' },
                { id: 84, en: 'keep pace with', zh: '跟上' },
                { id: 85, en: 'get rid of', zh: '摆脱' },
                { id: 86, en: 'pay attention to', zh: '注意' },
                { id: 87, en: 'attach importance to', zh: '重视' },
                { id: 88, en: 'take it for granted', zh: '视为理所当然' },
              ],
            },
          ],
        },
      ],
    },
    // ===================== Chapter 4 =====================
    {
      id: 'ch4',
      title: '善意 & 公益主题进阶语块',
      subtitle: '写作直接套用',
      icon: 'heart',
      color: '#DC2626',
      sections: [
        {
          id: 'ch4-s1',
          title: '公益慈善',
          groups: [
            {
              id: 14,
              title: '核心语块',
              type: 'phrase',
              items: [
                { id: 89, en: 'engage in charitable activities', zh: '参与慈善活动' },
                { id: 90, en: 'raise funds for', zh: '为...筹款' },
                { id: 91, en: 'dedicate oneself to', zh: '致力于' },
                { id: 92, en: 'make a positive impact on', zh: '对...产生积极影响' },
                { id: 93, en: 'show compassion towards', zh: '对...表现出同情' },
              ],
            },
          ],
        },
        {
          id: 'ch4-s2',
          title: '志愿服务',
          groups: [
            {
              id: 15,
              title: '核心语块',
              type: 'phrase',
              items: [
                { id: 94, en: 'volunteer one\'s time to', zh: '自愿花时间做' },
                { id: 95, en: 'reach out to those in need', zh: '伸出援手帮助需要的人' },
                { id: 96, en: 'contribute to the well-being of', zh: '为...的福祉做贡献' },
                { id: 97, en: 'play an active role in', zh: '在...中发挥积极作用' },
                { id: 98, en: 'foster a sense of community', zh: '培养社区意识' },
              ],
            },
          ],
        },
        {
          id: 'ch4-s3',
          title: '善意行为',
          groups: [
            {
              id: 16,
              title: '核心语块',
              type: 'phrase',
              items: [
                { id: 99, en: 'extend a helping hand', zh: '伸出援手' },
                { id: 100, en: 'go out of one\'s way to', zh: '特地去做' },
                { id: 101, en: 'bring joy to', zh: '给...带来欢乐' },
                { id: 102, en: 'spread kindness and warmth', zh: '传播善意与温暖' },
                { id: 103, en: 'inspire others to follow suit', zh: '激励他人效仿' },
              ],
            },
          ],
        },
      ],
    },
    // ===================== Chapter 5 =====================
    {
      id: 'ch5',
      title: '情感描写万能短语',
      subtitle: '读后续写通用',
      icon: 'face-smile',
      color: '#0891B2',
      sections: [
        {
          id: 'ch5-s1',
          title: '积极情感',
          groups: [
            {
              id: 17,
              title: '核心短语',
              type: 'phrase',
              items: [
                { id: 104, en: 'be overwhelmed with joy', zh: '喜不自胜' },
                { id: 105, en: 'a wave of excitement washed over', zh: '一阵兴奋涌上心头' },
                { id: 106, en: 'one\'s heart skipped a beat', zh: '心跳漏了一拍' },
                { id: 107, en: 'a smile spread across one\'s face', zh: '笑容绽放在脸上' },
                { id: 108, en: 'eyes lit up with delight', zh: '眼中闪烁着喜悦' },
                { id: 109, en: 'be moved to tears', zh: '感动落泪' },
              ],
            },
          ],
        },
        {
          id: 'ch5-s2',
          title: '消极情感',
          groups: [
            {
              id: 18,
              title: '核心短语',
              type: 'phrase',
              items: [
                { id: 110, en: 'a wave of panic swept over', zh: '一阵恐慌席卷而来' },
                { id: 111, en: 'one\'s heart sank', zh: '心一沉' },
                { id: 112, en: 'tremble with fear', zh: '因恐惧而颤抖' },
                { id: 113, en: 'be on the verge of tears', zh: '差点哭出来' },
                { id: 114, en: 'a knot formed in one\'s stomach', zh: '心里打了个结' },
                { id: 115, en: 'be consumed by guilt', zh: '被愧疚吞噬' },
              ],
            },
          ],
        },
      ],
    },
    // ===================== Chapter 6 =====================
    {
      id: 'ch6',
      title: '高考完形高频核心词汇补充',
      subtitle: '分类速记',
      icon: 'academic-cap',
      color: '#CA8A04',
      sections: [
        {
          id: 'ch6-s1',
          title: '核心词汇补充',
          groups: [
            {
              id: 19,
              title: '核心词汇',
              type: 'word',
              items: [
                { id: 116, en: 'inevitable', zh: '不可避免的', pos: 'adj.' },
                { id: 117, en: 'profound', zh: '深刻的', pos: 'adj.' },
                { id: 118, en: 'ambiguous', zh: '模糊的', pos: 'adj.' },
                { id: 119, en: 'skeptical', zh: '怀疑的', pos: 'adj.' },
                { id: 120, en: 'comprehensive', zh: '全面的', pos: 'adj.' },
                { id: 121, en: 'persistent', zh: '坚持的', pos: 'adj.' },
                { id: 122, en: 'distinguish', zh: '区分', pos: 'v.' },
                { id: 123, en: 'evaluate', zh: '评估', pos: 'v.' },
                { id: 124, en: 'acknowledge', zh: '承认', pos: 'v.' },
                { id: 125, en: 'emphasize', zh: '强调', pos: 'v.' },
                { id: 126, en: 'fundamental', zh: '基本的', pos: 'adj.' },
                { id: 127, en: 'tremendous', zh: '巨大的', pos: 'adj.' },
                { id: 128, en: 'adequate', zh: '充足的', pos: 'adj.' },
                { id: 129, en: 'reluctant', zh: '不情愿的', pos: 'adj.' },
                { id: 130, en: 'consequence', zh: '后果', pos: 'n.' },
              ],
            },
          ],
        },
      ],
    },
  ],
};
