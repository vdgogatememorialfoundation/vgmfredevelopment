#!/usr/bin/env python3
"""Generate VGMF app mark, launcher icons and splash art."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
IOS = ROOT.parent / "ios" / "Shared" / "Assets.xcassets" / "AppIcon.appiconset"

NAVY = (11, 31, 58, 255)
NAVY_SOFT = (22, 50, 92, 255)
GOLD = (196, 149, 74, 255)
CREAM = (247, 243, 234, 255)
BURGUNDY = (143, 45, 45, 255)
GREEN = (31, 74, 50, 255)
GOLD_DEEP = (138, 106, 42, 255)

FLAVORS = {
    "customer": (NAVY, "VG"),
    "admin": (BURGUNDY, "AD"),
    "staff": (GREEN, "ST"),
    "support": (GOLD_DEEP, "SU"),
}

MIPMAP = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def draw_mark(size: int, bg: tuple[int, int, int, int], letters: str, rounded: bool = True) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    inset = size * 0.06
    box = (inset, inset, size - inset, size - inset)
    radius = size * 0.22 if rounded else size * 0.5
    draw.rounded_rectangle(box, radius=radius, fill=bg)
    ring = size * 0.11
    draw.rounded_rectangle(
        (inset + ring, inset + ring, size - inset - ring, size - inset - ring),
        radius=max(4, radius - ring),
        outline=GOLD,
        width=max(2, size // 42),
    )
    face = font(int(size * 0.34))
    text = letters
    x0, y0, x1, y1 = draw.textbbox((0, 0), text, font=face)
    draw.text(((size - (x1 - x0)) / 2, (size - (y1 - y0)) / 2 - y0 * 0.15), text, font=face, fill=CREAM)
    return image


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG")


def main() -> None:
    mark = draw_mark(1024, NAVY, "VG")
    save(mark, ROOT / "assets" / "mark.png")
    save(mark.resize((192, 192), Image.Resampling.LANCZOS), ROOT / "assets" / "mark-192.png")

    splash = Image.new("RGBA", (1080, 1920), NAVY)
    canvas = ImageDraw.Draw(splash)
    canvas.rectangle((0, 0, 1080, 1920), fill=NAVY)
    canvas.rectangle((0, 0, 1080, 1920), outline=NAVY_SOFT, width=80)
    emblem = mark.resize((420, 420), Image.Resampling.LANCZOS)
    splash.alpha_composite(emblem, ((1080 - 420) // 2, 620))
    word = font(64)
    label = "VAIDYA GOGATE"
    x0, y0, x1, y1 = canvas.textbbox((0, 0), label, font=word)
    canvas.text(((1080 - (x1 - x0)) / 2, 1100), label, font=word, fill=GOLD)
    sub = font(36)
    second = "MEMORIAL FOUNDATION"
    x0, y0, x1, y1 = canvas.textbbox((0, 0), second, font=sub)
    canvas.text(((1080 - (x1 - x0)) / 2, 1180), second, font=sub, fill=CREAM)
    save(splash, ROOT / "assets" / "splash.png")
    save(emblem.resize((288, 288), Image.Resampling.LANCZOS), ROOT / "android" / "app" / "src" / "main" / "res" / "drawable" / "splash_mark.png")

    for flavor, (bg, letters) in FLAVORS.items():
        icon = draw_mark(1024, bg, letters)
        res = ROOT / "android" / "app" / "src" / flavor / "res"
        for density, px in MIPMAP.items():
            save(icon.resize((px, px), Image.Resampling.LANCZOS), res / f"mipmap-{density}" / "ic_launcher.png")
        if flavor == "customer":
            for density, px in MIPMAP.items():
                save(icon.resize((px, px), Image.Resampling.LANCZOS), ROOT / "android" / "app" / "src" / "main" / "res" / f"mipmap-{density}" / "ic_launcher.png")
            save(icon, IOS / "AppIcon.png")

    print("brand assets written")


if __name__ == "__main__":
    main()
