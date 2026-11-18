extends CharacterBody2D
class_name CompanionRobin
## Autonomous AI Companion for Player 2 (Robin / Nightwing)

enum AIState { FOLLOW, COMBAT, WALL_RECOVER, IDLE }

const SPEED: float = 90.0
const JUMP_VELOCITY: float = -290.0
const GRAVITY: float = 650.0

@export var target_player: Node2D
@export var ai_enabled: bool = true

var current_state: AIState = AIState.FOLLOW
var attack_cooldown: float = 0.0

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y += GRAVITY * delta

	if not ai_enabled or target_player == null:
		move_and_slide()
		return

	var dist_to_player = global_position.distance_to(target_player.global_position)
	var x_diff = target_player.global_position.x - global_position.x

	# AI Decision Matrix
	if abs(x_diff) > 40.0:
		# Follow player
		var dir = sign(x_diff)
		velocity.x = dir * SPEED
		
		# Auto jump over obstacles or when player jumps high
		if is_on_wall() and is_on_floor():
			velocity.y = JUMP_VELOCITY
		elif target_player.global_position.y < global_position.y - 30 and is_on_floor():
			velocity.y = JUMP_VELOCITY
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED)

	# Combat Target scan (attack nearby enemies)
	if attack_cooldown > 0.0:
		attack_cooldown -= delta
	else:
		attack_nearby_enemies()

	move_and_slide()

func attack_nearby_enemies() -> void:
	var enemies = get_tree().get_nodes_in_group("enemy")
	for enemy in enemies:
		if is_instance_valid(enemy) and global_position.distance_to(enemy.global_position) < 50.0:
			# Strike with bo-staff / shock gadget
			attack_cooldown = 0.8
			if enemy.has_method("take_damage"):
				enemy.take_damage(2)
			break
