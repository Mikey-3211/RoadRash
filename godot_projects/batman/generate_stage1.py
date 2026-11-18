import os
from PIL import Image, ImageDraw

base_dir = r"D:\RiderProjects\RoadRash\godot_projects\batman\assets"
os.makedirs(base_dir, exist_ok=True)

# Stage 1 Dimensions: 2048px wide x 240px high (NES 256x240 scrolled horizontally)
WIDTH = 2048
HEIGHT = 240

bg = Image.new("RGBA", (WIDTH, HEIGHT), (8, 6, 16, 255))
draw = ImageDraw.Draw(bg)

# Palette (Sunsoft Batman Stage 1 Gotham Streets)
C_SKY_TOP = (16, 12, 32)
C_SKY_BOT = (36, 24, 56)
C_DISTANT_BLDG = (20, 16, 36)
C_MID_BLDG = (28, 22, 48)
C_FORE_BLDG = (40, 32, 64)
C_BRICK = (52, 40, 80)
C_BRICK_DARK = (30, 24, 50)
C_ROAD = (24, 20, 36)
C_GIRDER = (70, 85, 120)
C_YELLOW_WINDOW = (240, 180, 40)
C_GREEN_SEWER = (32, 120, 60)

# 1. Gradient Sky
for y in range(HEIGHT):
    t = y / HEIGHT
    r = int(C_SKY_TOP[0] * (1 - t) + C_SKY_BOT[0] * t)
    g = int(C_SKY_TOP[1] * (1 - t) + C_SKY_BOT[1] * t)
    b = int(C_SKY_TOP[2] * (1 - t) + C_SKY_BOT[2] * t)
    draw.line([(0, y), (WIDTH, y)], fill=(r, g, b, 255))

# 2. Distant Gotham City Skyline
for x in range(0, WIDTH, 32):
    bldg_h = 70 + (x * 37 % 60)
    draw.rectangle([x, HEIGHT - 40 - bldg_h, x + 30, HEIGHT - 40], fill=C_DISTANT_BLDG)
    # Tiny glowing windows
    for wy in range(HEIGHT - 35 - bldg_h, HEIGHT - 50, 12):
        if (x + wy) % 5 == 0:
            draw.rectangle([x + 6, wy, x + 10, wy + 4], fill=C_YELLOW_WINDOW)
            draw.rectangle([x + 18, wy, x + 22, wy + 4], fill=C_YELLOW_WINDOW)

# 3. Midground Architecture & Industrial smokestacks
for x in range(0, WIDTH, 64):
    bldg_h = 90 + (x * 23 % 50)
    draw.rectangle([x + 8, HEIGHT - 40 - bldg_h, x + 56, HEIGHT - 40], fill=C_MID_BLDG)
    # Smokestack or gothic spire
    if x % 128 == 0:
        draw.polygon([(x + 20, HEIGHT - 40 - bldg_h), (x + 32, HEIGHT - 65 - bldg_h), (x + 44, HEIGHT - 40 - bldg_h)], fill=C_FORE_BLDG)

# 4. Foreground Brick Walls & Buildings
# Street level is at Y = 200 to 240
# Elevated building sections for Batman wall-kicking
platforms = [
    # (x1, y1, x2, y2)
    (0, 208, WIDTH, 240),          # Main ground street
    (160, 144, 256, 208),          # Building 1 (wall kick obstacle)
    (320, 112, 416, 208),          # Building 2 (higher ledge)
    (480, 80, 560, 208),           # Gothic tower
    (640, 144, 768, 208),          # Warehouse roof
    (880, 128, 992, 208),          # High catwalk
    (1100, 96, 1240, 208),         # Chemical Factory facade
    (1360, 144, 1500, 208),        # City Hall steps
    (1620, 112, 1780, 208),        # High security sector
    (1880, 80, 2048, 208)          # Boss arena wall (Killer Moth chamber)
]

for p in platforms:
    x1, y1, x2, y2 = p
    # Fill solid wall / roof
    draw.rectangle([x1, y1, x2, y2], fill=C_BRICK)
    # Top border ledge
    draw.rectangle([x1, y1, x2, y1 + 4], fill=C_GIRDER)
    # Brick pattern
    for by in range(y1 + 6, y2, 8):
        draw.line([(x1, by), (x2, by)], fill=C_BRICK_DARK)
        offset = 8 if (by // 8) % 2 == 1 else 0
        for bx in range(x1 + offset, x2, 16):
            draw.line([(bx, by), (bx, by + 8)], fill=C_BRICK_DARK)

# 5. Street Road Surface & Curb
draw.rectangle([0, 208, WIDTH, 212], fill=C_GIRDER) # Curb
draw.rectangle([0, 213, WIDTH, 240], fill=C_ROAD)   # Asphalt
# Sewer grates / manholes
for sx in range(100, WIDTH, 240):
    draw.ellipse([sx, 220, sx + 24, 230], fill=C_DISTANT_BLDG, outline=C_GIRDER)

bg.save(os.path.join(base_dir, "gotham_stage1_full.png"))
print("Generated authentic Sunsoft Gotham City Stage 1 Panorama (2048x240)!")
