"""Seed vocabulary from the Word document into the database (idempotent)."""
from __future__ import annotations
import time
from sqlalchemy.orm import Session

from database import SessionLocal, init_db
from models import Chapter, Section, Group, Item, Equipped
from utils import ensure_default_settings, get_equipped


# ------------------------------------------------------------------
#  Seed data — extracted from 英语高考高频词汇短语_排版优化版.docx
#  Each item is (en, zh, pos_or_None)
# ------------------------------------------------------------------
SEED_DATA = [
        {
            "id": "ch1",
            "title": "原笔记核心词汇复盘",
            "subtitle": "基础必背",
            "icon": "book",
            "color": "#0D9488",
            "order": 0,
            "sections": [
                {
                    "id": "ch1-s1",
                    "title": "社区志愿主题",
                    "order": 0,
                    "groups": [
                        {
                            "title": "核心短语",
                            "type": "phrase",
                            "order": 0,
                            "items": [
                                ("take part in", "参与", None),
                                ("be split into", "被划分", None),
                                ("set off", "启程，出发", None),
                                ("sweep away", "清扫；扫除", None),
                                ("offer assistance to", "协助、帮助", None),
                                ("tidy up", "整理；收拾", None),
                                ("appeal to", "呼吁；吸引", None),
                                ("show concern for", "关注；关心", None),
                                ("not merely...but also...", "不仅......而且......", None),
                                ("gain great benefits from", "从......收获良多", None)
                            ]
                        },
                        {
                            "title": "核心单词",
                            "type": "word",
                            "order": 1,
                            "items": [
                                ("voluntary", "志愿的", "adj."),
                                ("orderly", "有序的", "adj."),
                                ("responsible", "有责任心的", "adj."),
                                ("scattered", "散落的", "adj."),
                                ("corridor", "走廊", "n."),
                                ("poster", "海报", "n."),
                                ("bulletin board", "公告栏", "n."),
                                ("low-carbon", "低碳的", "adj."),
                                ("effectively", "有效地", "adv."),
                                ("foster", "培养；促进", "v."),
                                ("social responsibility", "社会责任", "n."),
                                ("unforgettable", "难忘的", "adj."),
                                ("valuable", "有价值的", "adj.")
                            ]
                        }
                    ]
                },
                {
                    "id": "ch1-s2",
                    "title": "善意温暖主题",
                    "order": 1,
                    "groups": [
                        {
                            "title": "核心形容词&副词",
                            "type": "word",
                            "order": 0,
                            "items": [
                                ("gentle", "温柔的", "adj."),
                                ("priceless", "无价的", "adj."),
                                ("tender", "柔和的", "adj."),
                                ("sincere", "真诚的", "adj."),
                                ("subtly", "微妙地", "adv."),
                                ("trivial", "微不足道的", "adj."),
                                ("pure", "纯粹的", "adj."),
                                ("touching", "动人的", "adj."),
                                ("tough", "艰难的", "adj."),
                                ("ordinary", "平凡的", "adj.")
                            ]
                        },
                        {
                            "title": "核心动词",
                            "type": "word",
                            "order": 1,
                            "items": [
                                ("melt", "消融", "v."),
                                ("heal", "治愈", "v."),
                                ("trap", "使陷入", "v."),
                                ("mark", "标记", "v."),
                                ("reshape", "重塑", "v."),
                                ("strike", "使触动", "v."),
                                ("accumulate", "积累", "v."),
                                ("enable", "使能够", "v.")
                            ]
                        },
                        {
                            "title": "核心名词",
                            "type": "word",
                            "order": 2,
                            "items": [
                                ("despair", "绝望", "n."),
                                ("miracle", "奇迹", "n."),
                                ("deed", "行为", "n."),
                                ("blessing", "祝福", "n."),
                                ("gesture", "姿态", "n."),
                                ("potential", "潜力", "n."),
                                ("devotion", "奉献", "n."),
                                ("accompany", "陪伴", "n."),
                                ("existence", "存在", "n.")
                            ]
                        },
                        {
                            "title": "核心短语",
                            "type": "phrase",
                            "order": 3,
                            "items": [
                                ("light up", "点亮", None),
                                ("serve as", "充当", None),
                                ("circle back", "循环回归", None),
                                ("move forward", "前行", None),
                                ("full of", "充满", None),
                                ("drive away", "驱散", None)
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "ch2",
            "title": "读后续写高分替换词 & 动作链",
            "subtitle": "阅卷加分级",
            "icon": "edit",
            "color": "#7C3AED",
            "order": 1,
            "sections": [
                {
                    "id": "ch2-s1",
                    "title": "普通词→高级词替换",
                    "order": 0,
                    "groups": [
                        {
                            "title": "替换词表",
                            "type": "word",
                            "order": 0,
                            "items": [
                                ("thrilled", "狂喜的（替换happy）", "adj."),
                                ("overjoyed", "狂喜的（替换happy）", "adj."),
                                ("overwhelmingly touched", "深受触动的（替换moved）", None),
                                ("compassionate", "富有同情心的（替换kind）", "adj."),
                                ("warm-hearted", "热心的（替换kind）", "adj."),
                                ("offer a helping hand", "伸出援手（替换help）", None),
                                ("come to one's aid", "伸出援手（替换help）", None),
                                ("gaze", "凝望（替换look）", "v."),
                                ("glance", "瞥一眼（替换look）", "v."),
                                ("stare", "紧盯（替换look）", "v."),
                                ("wander", "漫步（替换walk）", "v."),
                                ("stride", "大步走（替换walk）", "v."),
                                ("dash", "狂奔（替换walk）", "v."),
                                ("murmur", "低语（替换say）", "v."),
                                ("whisper", "耳语（替换say）", "v."),
                                ("respond", "回应（替换say）", "v."),
                                ("transform", "深刻改变（替换change）", "v."),
                                ("reshape", "深刻改变（替换change）", "v."),
                                ("significant", "至关重要的（替换important）", "adj."),
                                ("vital", "至关重要的（替换important）", "adj.")
                            ]
                        }
                    ]
                },
                {
                    "id": "ch2-s2",
                    "title": "动作链高频动词（细节加分）",
                    "order": 1,
                    "groups": [
                        {
                            "title": "手部动作",
                            "type": "phrase",
                            "order": 0,
                            "items": [
                                ("clasp one's hands", "紧握双手", None),
                                ("wipe away tears", "擦去泪水", None),
                                ("reach out a hand", "伸出手", None)
                            ]
                        },
                        {
                            "title": "脚步动作",
                            "type": "phrase",
                            "order": 1,
                            "items": [
                                ("spring to one's feet", "猛地起身", None),
                                ("pace back and forth", "来回踱步", None),
                                ("slow down one's steps", "放慢脚步", None)
                            ]
                        },
                        {
                            "title": "面部动作",
                            "type": "phrase",
                            "order": 2,
                            "items": [
                                ("a bright smile spread across one's face", "脸上绽放笑容", None),
                                ("eyes twinkle with delight", "眼中闪烁着喜悦", None),
                                ("tears blur one's vision", "泪水模糊视线", None)
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "ch3",
            "title": "完形填空核心高频短语",
            "subtitle": "近三年真题高频",
            "icon": "list-check",
            "color": "#EA580C",
            "order": 2,
            "sections": [
                {
                    "id": "ch3-s1",
                    "title": "动词+介词（每年必考）",
                    "order": 0,
                    "groups": [
                        {
                            "title": "核心动词短语",
                            "type": "phrase",
                            "order": 0,
                            "items": [
                                ("account for", "解释；占（比例）", None),
                                ("adapt to", "适应", None),
                                ("apply for", "申请", None),
                                ("approve of", "赞成", None),
                                ("benefit from", "从......中受益", None),
                                ("contribute to", "导致；促成；捐赠", None),
                                ("concentrate on", "集中精力于", None),
                                ("depend on", "依靠；取决于", None),
                                ("result in", "导致", None),
                                ("stick to", "坚持", None)
                            ]
                        }
                    ]
                },
                {
                    "id": "ch3-s2",
                    "title": "动词+副词（易混易错）",
                    "order": 1,
                    "groups": [
                        {
                            "title": "核心动词短语",
                            "type": "phrase",
                            "order": 0,
                            "items": [
                                ("break down", "出故障；分解；崩溃", None),
                                ("break out", "（战争/火灾）爆发", None),
                                ("call off", "取消", None),
                                ("give up", "放弃", None),
                                ("give away", "赠送；泄露", None),
                                ("go through", "经历；浏览", None),
                                ("look into", "调查", None),
                                ("pick up", "捡起；学会；接人", None),
                                ("put off", "推迟", None),
                                ("turn out", "结果是；证明是", None)
                            ]
                        }
                    ]
                },
                {
                    "id": "ch3-s3",
                    "title": "熟词生义（完形拉分点）",
                    "order": 2,
                    "groups": [
                        {
                            "title": "熟词生义",
                            "type": "word",
                            "order": 0,
                            "items": [
                                ("support", "赡养；支撑（非仅\"支持\"）", "v."),
                                ("address", "解决；处理（非仅\"地址\"）", "v."),
                                ("deliver", "发表（演讲）；递送", "v."),
                                ("observe", "遵守；观察；庆祝", "v."),
                                ("acknowledge", "承认；感谢", "v.")
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "ch4",
            "title": "善意 & 公益主题进阶语块",
            "subtitle": "写作直接套用",
            "icon": "heart",
            "color": "#DC2626",
            "order": 3,
            "sections": [
                {
                    "id": "ch4-s1",
                    "title": "人物行为类",
                    "order": 0,
                    "groups": [
                        {
                            "title": "核心语块",
                            "type": "phrase",
                            "order": 0,
                            "items": [
                                ("reach out to people in need", "向困境中的人伸出援手", None),
                                ("devote oneself to public welfare", "投身公益事业", None),
                                ("make a positive difference to the community", "对社区产生积极影响", None),
                                ("set a good example for others", "为他人树立榜样", None),
                                ("act out of pure kindness", "出于纯粹的善意行事", None)
                            ]
                        }
                    ]
                },
                {
                    "id": "ch4-s2",
                    "title": "意义升华类",
                    "order": 1,
                    "groups": [
                        {
                            "title": "核心语块",
                            "type": "phrase",
                            "order": 0,
                            "items": [
                                ("a small act of kindness goes a long way", "小小的善举意义深远", None),
                                ("kindness is a bridge between hearts", "善意是心灵之间的桥梁", None),
                                ("warm the deepest corner of one's heart", "温暖某人内心最深处", None),
                                ("plant seeds of kindness in people's hearts", "在人们心中播下善意的种子", None),
                                ("create a warm cycle of giving and receiving", "形成施与受的温暖循环", None)
                            ]
                        }
                    ]
                },
                {
                    "id": "ch4-s3",
                    "title": "社区活动类",
                    "order": 2,
                    "groups": [
                        {
                            "title": "核心语块",
                            "type": "phrase",
                            "order": 0,
                            "items": [
                                ("launch a voluntary campaign", "发起志愿活动", None),
                                ("raise residents' awareness of environmental protection", "提高居民环保意识", None),
                                ("build a more harmonious neighborhood", "构建更和谐的邻里关系", None),
                                ("participate in community governance", "参与社区治理", None)
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "ch5",
            "title": "情感描写万能短语",
            "subtitle": "读后续写通用",
            "icon": "face-smile",
            "color": "#0891B2",
            "order": 4,
            "sections": [
                {
                    "id": "ch5-s1",
                    "title": "正面情绪",
                    "order": 0,
                    "groups": [
                        {
                            "title": "核心短语",
                            "type": "phrase",
                            "order": 0,
                            "items": [
                                ("a surge of joy welled up in sb's heart", "一阵喜悦涌上心头", None),
                                ("be overwhelmed with gratitude", "满怀感激", None),
                                ("in high spirits", "情绪高涨", None),
                                ("feel a warm glow inside", "内心感到一阵暖意", None),
                                ("relief washed over sb", "某人如释重负", None)
                            ]
                        }
                    ]
                },
                {
                    "id": "ch5-s2",
                    "title": "过渡 & 衔接短语",
                    "order": 1,
                    "groups": [
                        {
                            "title": "核心短语",
                            "type": "phrase",
                            "order": 0,
                            "items": [
                                ("without hesitation", "毫不犹豫", None),
                                ("all of a sudden", "突然间", None),
                                ("shortly afterwards", "没过多久", None),
                                ("in the meanwhile", "与此同时", None),
                                ("as a result", "因此", None),
                                ("what's more", "此外", None),
                                ("on the contrary", "相反", None)
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "ch6",
            "title": "高考完形高频核心词汇补充",
            "subtitle": "分类速记",
            "icon": "academic-cap",
            "color": "#CA8A04",
            "order": 5,
            "sections": [
                {
                    "id": "ch6-s1",
                    "title": "品质形容词",
                    "order": 0,
                    "groups": [
                        {
                            "title": "品质形容词",
                            "type": "word",
                            "order": 0,
                            "items": [
                                ("generous", "慷慨的", "adj."),
                                ("selfless", "无私的", "adj."),
                                ("reliable", "可靠的", "adj."),
                                ("modest", "谦虚的", "adj."),
                                ("determined", "坚定的", "adj.")
                            ]
                        }
                    ]
                },
                {
                    "id": "ch6-s2",
                    "title": "情感形容词",
                    "order": 1,
                    "groups": [
                        {
                            "title": "情感形容词",
                            "type": "word",
                            "order": 0,
                            "items": [
                                ("grateful", "感激的", "adj."),
                                ("ashamed", "羞愧的", "adj."),
                                ("embarrassed", "尴尬的", "adj."),
                                ("relieved", "释然的", "adj."),
                                ("desperate", "绝望的", "adj.")
                            ]
                        }
                    ]
                },
                {
                    "id": "ch6-s3",
                    "title": "抽象名词",
                    "order": 2,
                    "groups": [
                        {
                            "title": "抽象名词",
                            "type": "word",
                            "order": 0,
                            "items": [
                                ("awareness", "意识", "n."),
                                ("gratitude", "感激", "n."),
                                ("harmony", "和谐", "n."),
                                ("sympathy", "同情", "n."),
                                ("courage", "勇气", "n.")
                            ]
                        }
                    ]
                }
            ]
        }
    ]


def seed_vocabulary(db: Session) -> None:
    """Insert all seed chapters/sections/groups/items (idempotent)."""
    # If chapters already exist, skip
    if db.query(Chapter).count() > 0:
        return

    for ch_data in SEED_DATA:
        chapter = Chapter(
            id=ch_data["id"],
            title=ch_data["title"],
            subtitle=ch_data["subtitle"],
            icon=ch_data["icon"],
            color=ch_data["color"],
            order=ch_data["order"],
        )
        db.add(chapter)

        for sec_data in ch_data["sections"]:
            section = Section(
                id=sec_data["id"],
                chapter_id=ch_data["id"],
                title=sec_data["title"],
                order=sec_data["order"],
            )
            db.add(section)

            for grp_data in sec_data["groups"]:
                group = Group(
                    section_id=sec_data["id"],
                    title=grp_data["title"],
                    type=grp_data["type"],
                    order=grp_data["order"],
                )
                db.add(group)
                db.flush()  # get group.id

                for item_idx, (en, zh, pos) in enumerate(grp_data["items"]):
                    item = Item(
                        group_id=group.id,
                        en=en,
                        zh=zh,
                        pos=pos,
                        order=item_idx,
                    )
                    db.add(item)

    db.commit()


def seed_defaults(db: Session) -> None:
    """Ensure default settings and equipped row exist."""
    ensure_default_settings(db)
    # Ensure equipped row
    equipped = db.query(Equipped).filter(Equipped.id == 1).first()
    if not equipped:
        db.add(Equipped(id=1, theme="default", badge=""))
        db.commit()


def run_seed() -> None:
    """Initialise tables and seed all default data."""
    init_db()
    db = SessionLocal()
    try:
        seed_vocabulary(db)
        seed_defaults(db)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
    print("Seed complete.")
