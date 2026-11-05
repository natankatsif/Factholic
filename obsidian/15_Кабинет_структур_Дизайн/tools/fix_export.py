#!/usr/bin/env python3
"""Правит экспорт pen.dev: блоки с рамкой на одной стороне получают неверный размер.

Экспорт пишет [box-sizing:content-box], хотя w/h уже включают отступы, поэтому
браузер прибавляет padding ещё раз. Скрипт ставит box-border и добавляет рамку к w/h.

Запуск из папки дизайна: python3 tools/fix_export.py
"""
import glob
import re

BOX = "[box-sizing:content-box]"


def px(value):
    return float(value.replace("px", ""))


def fix(match):
    classes = match.group(1).split()
    if BOX not in classes:
        return match.group(0)
    border = next((c for c in classes if c.startswith("[border-width:")), None)
    if border is None:
        return match.group(0)
    sides = [px(v) for v in border[len("[border-width:"):-1].split("_")]
    if len(sides) != 4:
        return match.group(0)
    top, right, bottom, left = sides
    out = []
    for c in classes:
        size = re.fullmatch(r"([wh])-\[(\d+(?:\.\d+)?)px\]", c)
        if c == BOX:
            out.append("box-border")
        elif size:
            extra = left + right if size.group(1) == "w" else top + bottom
            out.append(f"{size.group(1)}-[{float(size.group(2)) + extra:g}px]")
        else:
            out.append(c)
    return 'class="' + " ".join(out) + '"'


for path in glob.glob("screens/*/index.html"):
    with open(path, encoding="utf8") as f:
        html = f.read()
    with open(path, "w", encoding="utf8") as f:
        f.write(re.sub(r'class="([^"]*)"', fix, html))
