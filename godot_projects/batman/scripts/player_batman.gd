extends CharacterBody2D
class_name PlayerBatman
## Batman Character Controller (Sunsoft 1989 Wall-Kick Physics & Sub-Weapons)

const SPEED: float = 110.0
const JUMP_VELOCITY: float = -310.0
const WALL_JUMP_VELOCITY_Y: float = -290.0
const WALL_JUMP_VELOCITY_X: float = 140.0
const GRAVITY: float = 720.0

@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

var facing_direction: int = 1
var is_punching: bool = false
var punch_timer: float = 0.0

func _physics_process(delta: float) -> void:
	# Apply gravity
	if not is_on_floor():
		velocity.y += GRAVITY * delta

	# Punch handling
	if punch_timer > 0.0:
		punch_timer -= delta
		if punch_timer <= 0.0:
			is_punching = false

	# Attack Trigger (Z / J)
	if (Input.is_action_just_pressed("ui_focus_next") or Input.is_key_pressed(KEY_Z) or Input.is_key_pressed(KEY_J)) and not is_punching:
		is_punching = true
		punch_timer = 0.22
		if sprite:
			sprite.play("punch")

	# Horizontal Movement
	var direction := Input.get_axis("ui_left", "ui_right")
	if direction != 0 and not is_punching:
		velocity.x = direction * SPEED
		facing_direction = int(sign(direction))
		if sprite:
			sprite.flip_h = (facing_direction < 0)
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED)

	# Jump & Signature Sunsoft Wall-Kick
	if Input.is_action_just_pressed("ui_accept") or Input.is_action_just_pressed("ui_up") or Input.is_key_pressed(KEY_X) or Input.is_key_pressed(KEY_K):
		if is_on_floor():
			velocity.y = JUMP_VELOCITY
		elif is_on_wall():
			# Bounce off wall normal
			var wall_normal := get_wall_normal()
			velocity.y = WALL_JUMP_VELOCITY_Y
			velocity.x = wall_normal.x * WALL_JUMP_VELOCITY_X
			facing_direction = int(sign(wall_normal.x))
			if sprite:
				sprite.flip_h = (facing_direction < 0)

	# Animations
	if sprite and not is_punching:
		if is_on_floor():
			if abs(velocity.x) > 5.0:
				sprite.play("run")
			else:
				sprite.play("idle")
		else:
			if is_on_wall():
				sprite.play("wall")
			else:
				sprite.play("jump")

	move_and_slide()
