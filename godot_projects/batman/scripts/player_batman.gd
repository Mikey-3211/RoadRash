extends CharacterBody2D
class_name PlayerBatman
## Batman Character Controller (Sunsoft 1989 Physics Replication)

const SPEED: float = 85.0
const JUMP_VELOCITY: float = -285.0
const WALL_JUMP_VELOCITY_Y: float = -260.0
const WALL_JUMP_VELOCITY_X: float = 120.0
const GRAVITY: float = 650.0

@export var is_player_controlled: bool = true
var is_wall_sliding: bool = false
var facing_direction: int = 1

func _physics_process(delta: float) -> void:
	# Add gravity
	if not is_on_floor():
		velocity.y += GRAVITY * delta
	
	if not is_player_controlled:
		return # Controlled by AI companion script
	
	# Horizontal Movement
	var direction := Input.get_axis("ui_left", "ui_right")
	if direction != 0:
		velocity.x = direction * SPEED
		facing_direction = int(sign(direction))
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED)

	# Jump & Wall-Jump Mechanics (Sunsoft signature)
	if Input.is_action_just_pressed("ui_accept") or Input.is_key_pressed(KEY_X):
		if is_on_floor():
			velocity.y = JUMP_VELOCITY
		elif is_on_wall():
			# Wall jump pushes away from wall
			var wall_normal := get_wall_normal()
			velocity.y = WALL_JUMP_VELOCITY_Y
			velocity.x = wall_normal.x * WALL_JUMP_VELOCITY_X
			facing_direction = int(sign(wall_normal.x))

	move_and_slide()
