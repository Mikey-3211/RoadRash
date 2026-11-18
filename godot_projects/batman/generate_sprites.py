import os
from PIL import Image, ImageDraw

base_dir = r"D:\RiderProjects\RoadRash\godot_projects\batman\assets\sprites"
batman_dir = os.path.join(base_dir, "batman")
robin_dir = os.path.join(base_dir, "robin")
os.makedirs(batman_dir, exist_ok=True)
os.makedirs(robin_dir, exist_ok=True)

# Sunsoft Batman NES Palette (Accurate 3-color NES sprite + transparent)
# Black outline, Dark Blue/Purple (#202048), Bright Cyan/Highlight (#3898E8), Skin (#FCE4A0)
C_TRANS = (0, 0, 0, 0)
C_BLACK = (10, 10, 20, 255)
C_BAT_BLUE_DARK = (32, 40, 96, 255)
C_BAT_BLUE_LIGHT = (56, 152, 232, 255)
C_SKIN = (252, 228, 160, 255)
C_EYES = (255, 255, 255, 255)

# Robin Palette
# Green (#109040), Red (#D82020), Yellow (#F8C810), Skin, Dark/Black
C_ROBIN_RED = (216, 32, 32, 255)
C_ROBIN_GREEN = (16, 144, 64, 255)
C_ROBIN_YELLOW = (248, 200, 16, 255)

# Sprite Dimensions (Sunsoft Batman is typically 16x32 or 24x32)
W, H = 24, 32

def create_batman_idle():
    im = Image.new("RGBA", (W, H), C_TRANS)
    draw = ImageDraw.Draw(im)
    # Cowl / Ears
    draw.rectangle([10, 2, 10, 5], fill=C_BAT_BLUE_DARK)
    draw.rectangle([14, 2, 14, 5], fill=C_BAT_BLUE_DARK)
    draw.rectangle([11, 4, 13, 5], fill=C_BAT_BLUE_DARK)
    # Head & Mask
    draw.rectangle([9, 5, 15, 10], fill=C_BAT_BLUE_DARK)
    draw.rectangle([10, 6, 14, 9], fill=C_BAT_BLUE_LIGHT)
    # Eyes & Jaw
    draw.point((11, 7), fill=C_EYES)
    draw.point((13, 7), fill=C_EYES)
    draw.rectangle([11, 9, 13, 10], fill=C_SKIN)
    # Torso & Cape
    draw.rectangle([7, 11, 17, 21], fill=C_BAT_BLUE_DARK)
    draw.rectangle([9, 11, 15, 20], fill=C_BAT_BLUE_LIGHT)
    # Bat Emblem
    draw.rectangle([11, 13, 13, 14], fill=C_BLACK)
    draw.point((10, 12), fill=C_BLACK)
    draw.point((14, 12), fill=C_BLACK)
    # Utility Belt
    draw.rectangle([9, 21, 15, 22], fill=C_ROBIN_YELLOW)
    # Legs
    draw.rectangle([8, 23, 11, 29], fill=C_BAT_BLUE_DARK)
    draw.rectangle([13, 23, 16, 29], fill=C_BAT_BLUE_DARK)
    # Boots
    draw.rectangle([7, 29, 11, 31], fill=C_BAT_BLUE_LIGHT)
    draw.rectangle([13, 29, 17, 31], fill=C_BAT_BLUE_LIGHT)
    return im

def create_batman_run(frame):
    im = create_batman_idle()
    draw = ImageDraw.Draw(im)
    # Erase lower legs
    draw.rectangle([6, 22, 18, 31], fill=C_TRANS)
    draw.rectangle([9, 21, 15, 22], fill=C_ROBIN_YELLOW)
    if frame == 0:
        draw.rectangle([6, 23, 9, 28], fill=C_BAT_BLUE_DARK)
        draw.rectangle([5, 29, 9, 31], fill=C_BAT_BLUE_LIGHT)
        draw.rectangle([15, 23, 18, 28], fill=C_BAT_BLUE_DARK)
        draw.rectangle([15, 29, 19, 31], fill=C_BAT_BLUE_LIGHT)
    elif frame == 1:
        draw.rectangle([8, 23, 11, 29], fill=C_BAT_BLUE_DARK)
        draw.rectangle([8, 29, 12, 31], fill=C_BAT_BLUE_LIGHT)
        draw.rectangle([13, 23, 16, 27], fill=C_BAT_BLUE_DARK)
        draw.rectangle([14, 27, 18, 29], fill=C_BAT_BLUE_LIGHT)
    else:
        draw.rectangle([10, 23, 14, 28], fill=C_BAT_BLUE_DARK)
        draw.rectangle([14, 24, 18, 28], fill=C_BAT_BLUE_LIGHT)
        draw.rectangle([10, 29, 14, 31], fill=C_BAT_BLUE_LIGHT)
    return im

def create_batman_jump():
    im = Image.new("RGBA", (W, H), C_TRANS)
    draw = ImageDraw.Draw(im)
    # Acrobatic somersault ball
    draw.ellipse([5, 6, 19, 26], fill=C_BAT_BLUE_DARK)
    draw.ellipse([7, 8, 17, 24], fill=C_BAT_BLUE_LIGHT)
    draw.rectangle([9, 12, 15, 18], fill=C_BLACK)
    return im

def create_batman_wall_cling():
    im = create_batman_idle()
    draw = ImageDraw.Draw(im)
    # Hands extended against the wall
    draw.rectangle([17, 12, 21, 14], fill=C_BAT_BLUE_LIGHT)
    # One foot pressed back
    draw.rectangle([16, 26, 21, 28], fill=C_BAT_BLUE_LIGHT)
    return im

def create_batman_punch():
    im = create_batman_idle()
    draw = ImageDraw.Draw(im)
    # Fist extended forward
    draw.rectangle([16, 12, 23, 16], fill=C_BAT_BLUE_LIGHT)
    draw.rectangle([21, 13, 23, 15], fill=C_BAT_BLUE_DARK)
    return im

# Generate Robin Sprites
def create_robin_idle():
    im = Image.new("RGBA", (W, H), C_TRANS)
    draw = ImageDraw.Draw(im)
    # Hair & Domino Mask
    draw.rectangle([10, 4, 15, 6], fill=C_BLACK)
    draw.rectangle([10, 7, 14, 8], fill=C_BLACK)
    draw.point((11, 7), fill=C_EYES)
    draw.point((13, 7), fill=C_EYES)
    draw.rectangle([11, 9, 14, 10], fill=C_SKIN)
    # Red Vest & Cape
    draw.rectangle([7, 11, 17, 20], fill=C_ROBIN_YELLOW) # Cape
    draw.rectangle([9, 11, 15, 20], fill=C_ROBIN_RED)    # Vest
    # 'R' Insignia
    draw.point((10, 13), fill=C_ROBIN_YELLOW)
    draw.point((10, 14), fill=C_ROBIN_YELLOW)
    # Utility Belt
    draw.rectangle([9, 21, 15, 22], fill=C_ROBIN_YELLOW)
    # Green Tights & Boots
    draw.rectangle([8, 23, 11, 28], fill=C_ROBIN_GREEN)
    draw.rectangle([13, 23, 16, 28], fill=C_ROBIN_GREEN)
    draw.rectangle([7, 29, 11, 31], fill=C_BLACK)
    draw.rectangle([13, 29, 17, 31], fill=C_BLACK)
    return im

def create_robin_run(frame):
    im = create_robin_idle()
    draw = ImageDraw.Draw(im)
    draw.rectangle([6, 22, 18, 31], fill=C_TRANS)
    draw.rectangle([9, 21, 15, 22], fill=C_ROBIN_YELLOW)
    if frame == 0:
        draw.rectangle([6, 23, 9, 28], fill=C_ROBIN_GREEN)
        draw.rectangle([5, 29, 9, 31], fill=C_BLACK)
        draw.rectangle([15, 23, 18, 28], fill=C_ROBIN_GREEN)
        draw.rectangle([15, 29, 19, 31], fill=C_BLACK)
    else:
        draw.rectangle([9, 23, 12, 28], fill=C_ROBIN_GREEN)
        draw.rectangle([8, 28, 12, 31], fill=C_BLACK)
        draw.rectangle([13, 23, 16, 27], fill=C_ROBIN_GREEN)
        draw.rectangle([14, 27, 18, 30], fill=C_BLACK)
    return im

def create_robin_attack():
    im = create_robin_idle()
    draw = ImageDraw.Draw(im)
    # Bo-staff strike
    draw.line([3, 18, 22, 10], fill=C_ROBIN_YELLOW, width=2)
    return im

# Save Batman Frames
create_batman_idle().save(os.path.join(batman_dir, "batman_idle.png"))
create_batman_run(0).save(os.path.join(batman_dir, "batman_run_0.png"))
create_batman_run(1).save(os.path.join(batman_dir, "batman_run_1.png"))
create_batman_run(2).save(os.path.join(batman_dir, "batman_run_2.png"))
create_batman_jump().save(os.path.join(batman_dir, "batman_jump.png"))
create_batman_wall_cling().save(os.path.join(batman_dir, "batman_wall.png"))
create_batman_punch().save(os.path.join(batman_dir, "batman_punch.png"))

# Save Robin Frames
create_robin_idle().save(os.path.join(robin_dir, "robin_idle.png"))
create_robin_run(0).save(os.path.join(robin_dir, "robin_run_0.png"))
create_robin_run(1).save(os.path.join(robin_dir, "robin_run_1.png"))
create_batman_jump().save(os.path.join(robin_dir, "robin_jump.png"))
create_robin_attack().save(os.path.join(robin_dir, "robin_attack.png"))

print("Sprite assets successfully generated!")
