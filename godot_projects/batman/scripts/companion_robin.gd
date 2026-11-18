extends CharacterBody2D
class_name CompanionRobin
## Autonomous AI Companion for Player 2 (Robin / Nightwing)
## Features: Dynamic Follow, Auto-Wall Jump, Bo-Staff & Shock Dart Weapons

const SPEED: float = 115.0
const JUMP_VELOCITY: float = -315.0
const WALL_JUMP_VELOCITY_Y: float = -295.0
const WALL_JUMP_VELOCITY_X: float = 145.0
const GRAVITY: float = 720.0

@export var target_player: Node2D
@export var ai_enabled: bool = true

@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

var facing_direction: int = 1
var attack_timer: float = 0.0

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y += GRAVITY * delta

	if attack_timer > 0.0:
		attack_timer -= delta

	if not ai_enabled or target_player == null:
		move_and_slide()
		return

	var dist_x = target_player.global_position.x - global_position.x
	var dist_y = target_player.global_position.y - global_position.y

	# Autonomous Following & Obstacle Scaling
	if abs(dist_x) > 45.0:
		var dir = sign(dist_x)
		velocity.x = dir * SPEED
		facing_direction = int(dir)
		if sprite:
			sprite.flip_h = (facing_direction < 0)

		# Auto-Jump over walls and ledges
		if is_on_wall():
			if is_on_floor():
				velocity.y = JUMP_VELOCITY
			else:
				# Robin Wall-Kick
				var wall_normal = get_wall_normal()
				velocity.y = WALL_JUMP_VELOCITY_Y
				velocity.x = wall_normal.x * WALL_JUMP_VELOCITY_X
				facing_direction = int(sign(wall_normal.x))
				if sprite:
					sprite.flip_h = (facing_direction < 0)
		elif dist_y < -25.0 and is_on_floor():
			velocity.y = JUMP_VELOCITY
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED)

	# Animation Updates
	if sprite:
		if attack_timer > 0.0:
			pass
		elif is_on_floor():
			if abs(velocity.x) > 5.0:
				sprite.play("run")
			else:
				sprite.play("idle")
		else:
			sprite.play("jump")

	move_and_slide()
