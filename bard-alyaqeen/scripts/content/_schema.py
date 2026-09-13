# -*- coding: utf-8 -*-
"""
مساعدات بناء محتوى «بَرْدُ اليقين».

قواعد المصدر (src) المستعملة في كل عنصر محتوى:
  book       : نص منقول حرفيًا من الكتاب المعتمد.
  quran      : نص قرآني (لا يُستخرج من PDF؛ يُكتب بالرسم المعتمد ويُراجع بشريًا).
  hadith     : نص حديث نبوي منقول من الكتاب.
  dhikr      : ذكر أو دعاء منقول من الكتاب.
  authored   : صياغة تعليمية مساعدة (مدخل/هدف/تلخيص) ليست من الكتاب.
  derived    : نشاط أو سؤال مبني حرفيًا على نص الكتاب (ترتيب/مطابقة/اختيار).

كل عنصر مصدره quran أو authored يُعلَّم needsReview=True ليظهر في لوحة المراجعة الشرعية.
"""

BOOK_ID = "al-muhim-li-kulli-muslim"


def card(cid, ctype, text, src, page=None, ref=None, level="standard",
         title=None, needs_review=None, items=None, note=None):
    """بطاقة محتوى داخل الدرس."""
    if needs_review is None:
        needs_review = src in ("quran", "authored")
    c = {
        "id": cid,
        "type": ctype,          # text | quran | hadith | dhikr | list | note | hook
        "src": src,
        "level": level,         # brief | standard | deep
        "needsReview": needs_review,
    }
    if title:
        c["title"] = title
    if text is not None:
        c["text"] = text
    if items is not None:
        c["items"] = items
    if ref:
        c["ref"] = ref
    if page:
        c["page"] = page
    if note:
        c["note"] = note
    return c


def classify(qid, prompt, groups, why, page=None, src="derived"):
    """تصنيف الأمثلة — groups: [{"label": "...", "items": [...]}, ...]"""
    return {
        "id": qid, "kind": "classify", "prompt": prompt, "groups": groups,
        "why": why, "src": src, "page": page, "needsReview": src == "authored",
    }


def mcq(qid, prompt, options, answer, why, src="derived", page=None):
    return {
        "id": qid, "kind": "mcq", "prompt": prompt, "options": options,
        "answer": answer, "why": why, "src": src, "page": page,
        "needsReview": src == "authored",
    }


def truefalse(qid, prompt, answer, why, page=None, src="derived"):
    return {
        "id": qid, "kind": "truefalse", "prompt": prompt,
        "options": ["صحيح", "خطأ"], "answer": 0 if answer else 1,
        "why": why, "src": src, "page": page, "needsReview": src == "authored",
    }


def order(qid, prompt, items, why, page=None, src="derived"):
    """ترتيب الخطوات — items بالترتيب الصحيح."""
    return {
        "id": qid, "kind": "order", "prompt": prompt, "items": items,
        "why": why, "src": src, "page": page, "needsReview": src == "authored",
    }


def match(qid, prompt, pairs, why, page=None, src="derived"):
    """مطابقة بين مصطلح ومعناه — pairs قائمة [يمين, يسار]."""
    return {
        "id": qid, "kind": "match", "prompt": prompt, "pairs": pairs,
        "why": why, "src": src, "page": page, "needsReview": src == "authored",
    }


def complete(qid, prompt, before, after, options, answer, why, page=None, src="derived"):
    """إكمال نص — before/after يحيطان بالفراغ."""
    return {
        "id": qid, "kind": "complete", "prompt": prompt, "before": before,
        "after": after, "options": options, "answer": answer, "why": why,
        "src": src, "page": page, "needsReview": src == "authored",
    }


def scenario(qid, prompt, options, answer, why, page=None, src="authored"):
    """موقف حياتي تطبيقي — الصياغة مساعدة والحكم مأخوذ من الكتاب."""
    return {
        "id": qid, "kind": "scenario", "prompt": prompt, "options": options,
        "answer": answer, "why": why, "src": src, "page": page,
        "needsReview": src == "authored",
    }


def flashcards(qid, prompt, pairs, page=None):
    """بطاقات تذكر: [وجه, ظهر]."""
    return {
        "id": qid, "kind": "flashcards", "prompt": prompt, "pairs": pairs,
        "src": "derived", "page": page, "needsReview": False,
    }


def lesson(lid, title, pages, hook, objective, cards, interactions, summary, quiz,
           tags=None, family=None):
    return {
        "id": lid,
        "title": title,
        "source": {"book": BOOK_ID, "pages": pages},
        "hook": {"text": hook, "src": "authored", "needsReview": True},
        "objective": {"text": objective, "src": "authored", "needsReview": True},
        "cards": cards,
        "interactions": interactions,
        "summary": {"points": summary, "src": "authored", "needsReview": True},
        "quiz": quiz,
        "tags": tags or [],
        # سؤال للنقاش الأسري (صياغة مساعدة)
        "family": {"text": family, "src": "authored", "needsReview": True} if family else None,
    }


def unit(uid, order_no, title, short, pages, outcomes, lessons, assessment, tasks,
         intro=None):
    return {
        "id": uid,
        "order": order_no,
        "title": title,
        "shortTitle": short,
        "source": {"book": BOOK_ID, "pages": pages},
        "intro": intro,
        "outcomes": {"points": outcomes, "src": "book", "needsReview": False},
        "lessons": lessons,
        # أسئلة تحصيلية مقالية كما وردت في الكتاب (صفحات «أنشطة»)
        "assessment": assessment,
        # مهام أدائية كما وردت في الكتاب
        "tasks": tasks,
    }
