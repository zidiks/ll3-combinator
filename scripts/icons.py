#!/usr/bin/env python3
# ============================================================
#  icons.py — пересобирает icons/*.webp из исходного пака иконок.
#
#    python scripts/icons.py                 → взять пак по пути по умолчанию
#    python scripts/icons.py <путь-к-паку>   → указать папку с skill_###.png
#    python scripts/icons.py --check         → только проверить, ничего не писать
#
#  Что делает: для каждого мода из data.json берёт файл <пак>/<icon>.png,
#  ужимает до iconSet.size и кладёт в icons/<icon>.webp. Файлы, на которые
#  больше никто не ссылается, удаляет. Нужен Pillow (pip install pillow).
#
#  Источник иконок — пак «500 Free Skill Icons» из Unity-проекта LL3
#  (Assets/500FreeSkillIcons/Icons). В репозитории лежат только те 80 штук,
#  что реально заняты модами, — ужатые до веб-размера.
# ============================================================
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACK_DEFAULT = Path("E:/projects/ll-test/ll3/LL3/Assets/500FreeSkillIcons/Icons")
QUALITY = 80

args = [a for a in sys.argv[1:] if not a.startswith("--")]
check_only = "--check" in sys.argv
pack = Path(args[0]) if args else PACK_DEFAULT

data = json.loads((ROOT / "data.json").read_text(encoding="utf-8"))
size = int(data.get("iconSet", {}).get("size", 256))
out_dir = ROOT / "icons"
wanted = {}
for mod in data["mods"]:
    icon = mod.get("icon")
    if not icon:
        print(f"  ERROR mod {mod['id']}: нет поля icon")
        continue
    wanted.setdefault(icon, []).append(mod["id"])

missing = [i for i in wanted if not (pack / f"{i}.png").exists()]
if missing:
    print(f"  ERROR нет в паке ({pack}): {', '.join(sorted(missing))}")
    sys.exit(1)

if check_only:
    stale = [i for i in wanted if not (out_dir / f"{i}.webp").exists()]
    orphans = [p.stem for p in out_dir.glob("*.webp") if p.stem not in wanted]
    print(f"нужно {len(wanted)}, не собрано {len(stale)}, лишних {len(orphans)}")
    sys.exit(1 if stale else 0)

from PIL import Image  # noqa: E402  (после --check, чтобы проверка работала без Pillow)

out_dir.mkdir(exist_ok=True)
for icon in sorted(wanted):
    img = Image.open(pack / f"{icon}.png").convert("RGB").resize((size, size), Image.LANCZOS)
    img.save(out_dir / f"{icon}.webp", "WEBP", quality=QUALITY, method=6)

removed = 0
for path in out_dir.glob("*.webp"):
    if path.stem not in wanted:
        path.unlink()
        removed += 1

total = sum((out_dir / f"{i}.webp").stat().st_size for i in wanted)
print(f"icons/: {len(wanted)} файлов, {total // 1024} КБ, удалено лишних: {removed}")
