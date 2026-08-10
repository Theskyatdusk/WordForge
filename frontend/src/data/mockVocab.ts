import type { VocabData } from '../types/index';

export const mockVocabData: VocabData = {
  chapters: [
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
                { id: 2, en: 'be split into', zh: '被划分' },
                { id: 3, en: 'set off', zh: '启程，出发' },
                { id: 4, en: 'sweep away', zh: '清扫；扫除' },
                { id: 5, en: 'offer assistance to', zh: '协助、帮助' },
                { id: 6, en: 'tidy up', zh: '整理；收拾' },
                { id: 7, en: 'appeal to', zh: '呼吁；吸引' },
                { id: 8, en: 'show concern for', zh: '关注；关心' },
                { id: 9, en: 'not merely...but also...', zh: '不仅......而且......' },
                { id: 10, en: 'gain great benefits from', zh: '从......收获良多' },
              ],
            },
            {
              id: 2,
              title: '核心单词',
              type: 'word',
              items: [
                { id: 11, en: 'voluntary', zh: '志愿的', pos: 'adj.' },
                { id: 12, en: 'orderly', zh: '有序的', pos: 'adj.' },
                { id: 13, en: 'responsible', zh: '有责任心的', pos: 'adj.' },
                { id: 14, en: 'scattered', zh: '散落的', pos: 'adj.' },
                { id: 15, en: 'corridor', zh: '走廊', pos: 'n.' },
                { id: 16, en: 'poster', zh: '海报', pos: 'n.' },
                { id: 17, en: 'bulletin board', zh: '公告栏', pos: 'n.' },
                { id: 18, en: 'low-carbon', zh: '低碳的', pos: 'adj.' },
                { id: 19, en: 'effectively', zh: '有效地', pos: 'adv.' },
                { id: 20, en: 'foster', zh: '培养；促进', pos: 'v.' },
                { id: 21, en: 'social responsibility', zh: '社会责任', pos: 'n.' },
                { id: 22, en: 'unforgettable', zh: '难忘的', pos: 'adj.' },
                { id: 23, en: 'valuable', zh: '有价值的', pos: 'adj.' },
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
                { id: 24, en: 'gentle', zh: '温柔的', pos: 'adj.' },
                { id: 25, en: 'priceless', zh: '无价的', pos: 'adj.' },
                { id: 26, en: 'tender', zh: '柔和的', pos: 'adj.' },
                { id: 27, en: 'sincere', zh: '真诚的', pos: 'adj.' },
                { id: 28, en: 'subtly', zh: '微妙地', pos: 'adv.' },
                { id: 29, en: 'trivial', zh: '微不足道的', pos: 'adj.' },
                { id: 30, en: 'pure', zh: '纯粹的', pos: 'adj.' },
                { id: 31, en: 'touching', zh: '动人的', pos: 'adj.' },
                { id: 32, en: 'tough', zh: '艰难的', pos: 'adj.' },
                { id: 33, en: 'ordinary', zh: '平凡的', pos: 'adj.' },
              ],
            },
            {
              id: 4,
              title: '核心动词',
              type: 'word',
              items: [
                { id: 34, en: 'melt', zh: '消融', pos: 'v.' },
                { id: 35, en: 'heal', zh: '治愈', pos: 'v.' },
                { id: 36, en: 'trap', zh: '使陷入', pos: 'v.' },
                { id: 37, en: 'mark', zh: '标记', pos: 'v.' },
                { id: 38, en: 'reshape', zh: '重塑', pos: 'v.' },
                { id: 39, en: 'strike', zh: '使触动', pos: 'v.' },
                { id: 40, en: 'accumulate', zh: '积累', pos: 'v.' },
                { id: 41, en: 'enable', zh: '使能够', pos: 'v.' },
              ],
            },
            {
              id: 5,
              title: '核心名词',
              type: 'word',
              items: [
                { id: 42, en: 'despair', zh: '绝望', pos: 'n.' },
                { id: 43, en: 'miracle', zh: '奇迹', pos: 'n.' },
                { id: 44, en: 'deed', zh: '行为', pos: 'n.' },
                { id: 45, en: 'blessing', zh: '祝福', pos: 'n.' },
                { id: 46, en: 'gesture', zh: '姿态', pos: 'n.' },
                { id: 47, en: 'potential', zh: '潜力', pos: 'n.' },
                { id: 48, en: 'devotion', zh: '奉献', pos: 'n.' },
                { id: 49, en: 'accompany', zh: '陪伴', pos: 'n.' },
                { id: 50, en: 'existence', zh: '存在', pos: 'n.' },
              ],
            },
            {
              id: 6,
              title: '核心短语',
              type: 'phrase',
              items: [
                { id: 51, en: 'light up', zh: '点亮' },
                { id: 52, en: 'serve as', zh: '充当' },
                { id: 53, en: 'circle back', zh: '循环回归' },
                { id: 54, en: 'move forward', zh: '前行' },
                { id: 55, en: 'full of', zh: '充满' },
                { id: 56, en: 'drive away', zh: '驱散' },
              ],
            },
          ],
        },
      ],
    },
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
                { id: 57, en: 'thrilled', zh: '狂喜的（替换happy）', pos: 'adj.' },
                { id: 58, en: 'overjoyed', zh: '狂喜的（替换happy）', pos: 'adj.' },
                { id: 59, en: 'overwhelmingly touched', zh: '深受触动的（替换moved）' },
                { id: 60, en: 'compassionate', zh: '富有同情心的（替换kind）', pos: 'adj.' },
                { id: 61, en: 'warm-hearted', zh: '热心的（替换kind）', pos: 'adj.' },
                { id: 62, en: 'offer a helping hand', zh: '伸出援手（替换help）' },
                { id: 63, en: 'come to one\'s aid', zh: '伸出援手（替换help）' },
                { id: 64, en: 'gaze', zh: '凝望（替换look）', pos: 'v.' },
                { id: 65, en: 'glance', zh: '瞥一眼（替换look）', pos: 'v.' },
                { id: 66, en: 'stare', zh: '紧盯（替换look）', pos: 'v.' },
                { id: 67, en: 'wander', zh: '漫步（替换walk）', pos: 'v.' },
                { id: 68, en: 'stride', zh: '大步走（替换walk）', pos: 'v.' },
                { id: 69, en: 'dash', zh: '狂奔（替换walk）', pos: 'v.' },
                { id: 70, en: 'murmur', zh: '低语（替换say）', pos: 'v.' },
                { id: 71, en: 'whisper', zh: '耳语（替换say）', pos: 'v.' },
                { id: 72, en: 'respond', zh: '回应（替换say）', pos: 'v.' },
                { id: 73, en: 'transform', zh: '深刻改变（替换change）', pos: 'v.' },
                { id: 74, en: 'reshape', zh: '深刻改变（替换change）', pos: 'v.' },
                { id: 75, en: 'significant', zh: '至关重要的（替换important）', pos: 'adj.' },
                { id: 76, en: 'vital', zh: '至关重要的（替换important）', pos: 'adj.' },
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
              type: 'phrase',
              items: [
                { id: 77, en: 'clasp one\'s hands', zh: '紧握双手' },
                { id: 78, en: 'wipe away tears', zh: '擦去泪水' },
                { id: 79, en: 'reach out a hand', zh: '伸出手' },
              ],
            },
            {
              id: 9,
              title: '脚步动作',
              type: 'phrase',
              items: [
                { id: 80, en: 'spring to one\'s feet', zh: '猛地起身' },
                { id: 81, en: 'pace back and forth', zh: '来回踱步' },
                { id: 82, en: 'slow down one\'s steps', zh: '放慢脚步' },
              ],
            },
            {
              id: 10,
              title: '面部动作',
              type: 'phrase',
              items: [
                { id: 83, en: 'a bright smile spread across one\'s face', zh: '脸上绽放笑容' },
                { id: 84, en: 'eyes twinkle with delight', zh: '眼中闪烁着喜悦' },
                { id: 85, en: 'tears blur one\'s vision', zh: '泪水模糊视线' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'ch3',
      title: '完形填空核心高频短语',
      subtitle: '近三年真题高频',
      icon: 'list-check',
      color: '#EA580C',
      sections: [
        {
          id: 'ch3-s1',
          title: '动词+介词（每年必考）',
          groups: [
            {
              id: 11,
              title: '核心动词短语',
              type: 'phrase',
              items: [
                { id: 86, en: 'account for', zh: '解释；占（比例）' },
                { id: 87, en: 'adapt to', zh: '适应' },
                { id: 88, en: 'apply for', zh: '申请' },
                { id: 89, en: 'approve of', zh: '赞成' },
                { id: 90, en: 'benefit from', zh: '从......中受益' },
                { id: 91, en: 'contribute to', zh: '导致；促成；捐赠' },
                { id: 92, en: 'concentrate on', zh: '集中精力于' },
                { id: 93, en: 'depend on', zh: '依靠；取决于' },
                { id: 94, en: 'result in', zh: '导致' },
                { id: 95, en: 'stick to', zh: '坚持' },
              ],
            },
          ],
        },
        {
          id: 'ch3-s2',
          title: '动词+副词（易混易错）',
          groups: [
            {
              id: 12,
              title: '核心动词短语',
              type: 'phrase',
              items: [
                { id: 96, en: 'break down', zh: '出故障；分解；崩溃' },
                { id: 97, en: 'break out', zh: '（战争/火灾）爆发' },
                { id: 98, en: 'call off', zh: '取消' },
                { id: 99, en: 'give up', zh: '放弃' },
                { id: 100, en: 'give away', zh: '赠送；泄露' },
                { id: 101, en: 'go through', zh: '经历；浏览' },
                { id: 102, en: 'look into', zh: '调查' },
                { id: 103, en: 'pick up', zh: '捡起；学会；接人' },
                { id: 104, en: 'put off', zh: '推迟' },
                { id: 105, en: 'turn out', zh: '结果是；证明是' },
              ],
            },
          ],
        },
        {
          id: 'ch3-s3',
          title: '熟词生义（完形拉分点）',
          groups: [
            {
              id: 13,
              title: '熟词生义',
              type: 'word',
              items: [
                { id: 106, en: 'support', zh: '赡养；支撑（非仅"支持"）', pos: 'v.' },
                { id: 107, en: 'address', zh: '解决；处理（非仅"地址"）', pos: 'v.' },
                { id: 108, en: 'deliver', zh: '发表（演讲）；递送', pos: 'v.' },
                { id: 109, en: 'observe', zh: '遵守；观察；庆祝', pos: 'v.' },
                { id: 110, en: 'acknowledge', zh: '承认；感谢', pos: 'v.' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'ch4',
      title: '善意 & 公益主题进阶语块',
      subtitle: '写作直接套用',
      icon: 'heart',
      color: '#DC2626',
      sections: [
        {
          id: 'ch4-s1',
          title: '人物行为类',
          groups: [
            {
              id: 14,
              title: '核心语块',
              type: 'phrase',
              items: [
                { id: 111, en: 'reach out to people in need', zh: '向困境中的人伸出援手' },
                { id: 112, en: 'devote oneself to public welfare', zh: '投身公益事业' },
                { id: 113, en: 'make a positive difference to the community', zh: '对社区产生积极影响' },
                { id: 114, en: 'set a good example for others', zh: '为他人树立榜样' },
                { id: 115, en: 'act out of pure kindness', zh: '出于纯粹的善意行事' },
              ],
            },
          ],
        },
        {
          id: 'ch4-s2',
          title: '意义升华类',
          groups: [
            {
              id: 15,
              title: '核心语块',
              type: 'phrase',
              items: [
                { id: 116, en: 'a small act of kindness goes a long way', zh: '小小的善举意义深远' },
                { id: 117, en: 'kindness is a bridge between hearts', zh: '善意是心灵之间的桥梁' },
                { id: 118, en: 'warm the deepest corner of one\'s heart', zh: '温暖某人内心最深处' },
                { id: 119, en: 'plant seeds of kindness in people\'s hearts', zh: '在人们心中播下善意的种子' },
                { id: 120, en: 'create a warm cycle of giving and receiving', zh: '形成施与受的温暖循环' },
              ],
            },
          ],
        },
        {
          id: 'ch4-s3',
          title: '社区活动类',
          groups: [
            {
              id: 16,
              title: '核心语块',
              type: 'phrase',
              items: [
                { id: 121, en: 'launch a voluntary campaign', zh: '发起志愿活动' },
                { id: 122, en: 'raise residents\' awareness of environmental protection', zh: '提高居民环保意识' },
                { id: 123, en: 'build a more harmonious neighborhood', zh: '构建更和谐的邻里关系' },
                { id: 124, en: 'participate in community governance', zh: '参与社区治理' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'ch5',
      title: '情感描写万能短语',
      subtitle: '读后续写通用',
      icon: 'face-smile',
      color: '#0891B2',
      sections: [
        {
          id: 'ch5-s1',
          title: '正面情绪',
          groups: [
            {
              id: 17,
              title: '核心短语',
              type: 'phrase',
              items: [
                { id: 125, en: 'a surge of joy welled up in sb\'s heart', zh: '一阵喜悦涌上心头' },
                { id: 126, en: 'be overwhelmed with gratitude', zh: '满怀感激' },
                { id: 127, en: 'in high spirits', zh: '情绪高涨' },
                { id: 128, en: 'feel a warm glow inside', zh: '内心感到一阵暖意' },
                { id: 129, en: 'relief washed over sb', zh: '某人如释重负' },
              ],
            },
          ],
        },
        {
          id: 'ch5-s2',
          title: '过渡 & 衔接短语',
          groups: [
            {
              id: 18,
              title: '核心短语',
              type: 'phrase',
              items: [
                { id: 130, en: 'without hesitation', zh: '毫不犹豫' },
                { id: 131, en: 'all of a sudden', zh: '突然间' },
                { id: 132, en: 'shortly afterwards', zh: '没过多久' },
                { id: 133, en: 'in the meanwhile', zh: '与此同时' },
                { id: 134, en: 'as a result', zh: '因此' },
                { id: 135, en: 'what\'s more', zh: '此外' },
                { id: 136, en: 'on the contrary', zh: '相反' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'ch6',
      title: '高考完形高频核心词汇补充',
      subtitle: '分类速记',
      icon: 'academic-cap',
      color: '#CA8A04',
      sections: [
        {
          id: 'ch6-s1',
          title: '品质形容词',
          groups: [
            {
              id: 19,
              title: '品质形容词',
              type: 'word',
              items: [
                { id: 137, en: 'generous', zh: '慷慨的', pos: 'adj.' },
                { id: 138, en: 'selfless', zh: '无私的', pos: 'adj.' },
                { id: 139, en: 'reliable', zh: '可靠的', pos: 'adj.' },
                { id: 140, en: 'modest', zh: '谦虚的', pos: 'adj.' },
                { id: 141, en: 'determined', zh: '坚定的', pos: 'adj.' },
              ],
            },
          ],
        },
        {
          id: 'ch6-s2',
          title: '情感形容词',
          groups: [
            {
              id: 20,
              title: '情感形容词',
              type: 'word',
              items: [
                { id: 142, en: 'grateful', zh: '感激的', pos: 'adj.' },
                { id: 143, en: 'ashamed', zh: '羞愧的', pos: 'adj.' },
                { id: 144, en: 'embarrassed', zh: '尴尬的', pos: 'adj.' },
                { id: 145, en: 'relieved', zh: '释然的', pos: 'adj.' },
                { id: 146, en: 'desperate', zh: '绝望的', pos: 'adj.' },
              ],
            },
          ],
        },
        {
          id: 'ch6-s3',
          title: '抽象名词',
          groups: [
            {
              id: 21,
              title: '抽象名词',
              type: 'word',
              items: [
                { id: 147, en: 'awareness', zh: '意识', pos: 'n.' },
                { id: 148, en: 'gratitude', zh: '感激', pos: 'n.' },
                { id: 149, en: 'harmony', zh: '和谐', pos: 'n.' },
                { id: 150, en: 'sympathy', zh: '同情', pos: 'n.' },
                { id: 151, en: 'courage', zh: '勇气', pos: 'n.' },
              ],
            },
          ],
        },
      ],
    },
  ],
};