import os
from PIL import Image

rom_path = r"D:\RiderProjects\RoadRash\godot_projects\batman\batman.nes"
out_dir = r"D:\RiderProjects\RoadRash\godot_projects\batman\assets\extracted_tiles"
os.makedirs(out_dir, exist_ok=True)

with open(rom_path, "rb") as f:
    header = f.read(16)
    prg_size = header[4] * 16384
    chr_size = header[5] * 8192
    f.seek(16 + prg_size)
    chr_data = f.read(chr_size)

print(f"Total CHR bytes: {len(chr_data)}")

# Decode 8x8 2bpp tiles
# NES 2bpp tile: 16 bytes. First 8 bytes are bitplane 0, next 8 bytes are bitplane 1.
num_tiles = len(chr_data) // 16
print(f"Total tiles in ROM: {num_tiles}")

# Color palette for Batman sprites: 0=transparent, 1=light blue, 2=dark blue, 3=skin
PALETTE = [
    (0, 0, 0, 0),         # 0: transparent
    (56, 152, 232, 255),   # 1: light blue highlight
    (32, 40, 96, 255),     # 2: dark navy blue
    (252, 228, 160, 255)   # 3: face / belt / skin
]

def decode_tile(tile_bytes, palette=PALETTE):
    im = Image.new("RGBA", (8, 8))
    pixels = im.load()
    plane0 = tile_bytes[:8]
    plane1 = tile_bytes[8:16]
    for y in range(8):
        b0 = plane0[y]
        b1 = plane1[y]
        for x in range(8):
            bit0 = (b0 >> (7 - x)) & 1
            bit1 = (b1 >> (7 - x)) & 1
            color_idx = (bit1 << 1) | bit0
            pixels[x, y] = palette[color_idx]
    return im

# Render all tiles into atlas sheets of 16x16 tiles (128x128 px each bank)
tiles_per_sheet = 256 # 1 bank = 4KB = 256 tiles
sheet_idx = 0
for start in range(0, num_tiles, tiles_per_sheet):
    sheet = Image.new("RGBA", (128, 128), (0,0,0,0))
    for i in range(min(tiles_per_sheet, num_tiles - start)):
        tile_offset = (start + i) * 16
        tile_img = decode_tile(chr_data[tile_offset:tile_offset+16])
        tx = (i % 16) * 8
        ty = (i // 16) * 8
        sheet.paste(tile_img, (tx, ty))
    sheet.save(os.path.join(out_dir, f"chr_bank_{sheet_idx:02d}.png"))
    sheet_idx += 1

print(f"Generated {sheet_idx} authentic CHR tile banks from Sunsoft NES ROM!")
