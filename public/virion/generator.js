// *** generator ***
// generates random enemies
// spec:
//		game : an in_game_state
//			Is going to access: (through getters since we're so safe)
//			game_objects - array
//			distance - a num
//			type_to_level - hash from type to level
//			active_cell
//		mutation : a mutation obj, so it can get current mutation color

var make_generator = function(p, spec) {
    // --- defaults ---

    // obj to return
    var obj = {};

    // --- private variables ---
	
	//These will be updated at every call of update()
    var game_objects = null;
	var distance = null;
	var mutation = spec.mutation;
	var game = spec.game;
	var last_obj = null; // The last object generated

	var default_gen_speed = 10;
    // structure that stores the generation settings
    // for each type of object
    // - start = distance after which to start generating
    // - num = how many total on screen
    // - cap = upper limit on num
    // - rate = determines when to increment num
    //          when dist % rate = 0, num increments
	// - gen_speed = speed with which to generate the object
	//				1 (1/100 frames) to 100 (100/100 frames)
	//				If not specified, defaults to DEFAULT_GEN_SPEED
    // - spacing = diagonal space to put b/w objects of this type (optional)
    // - gen_x = how far offscreen to gen this type (optional)
    // - gen_y = function that returns random y pos for this object (optional)
    // - make_new = function that takes a pos and returns a new enemy
    // - diminish = Include to make enemy's num decrease over time instead of increasing (optional)
    var gen_info = {
        "cell": { 
            // was 8
            start: 0, num: 30, cap: 10, rate: 2000, gen_speed: 55, diminish : true,
            spacing: 50, 
            make_new: function(en_pos) {
                return cell(p, {
                    pos: en_pos,
                    state: "alive",
                });
            }
        },
        "wall_cell": {
            start: 0, num: 3, cap: 7, rate: 3000, //non testing value: 1000
            spacing: "dynamic",//100,
            make_new: function(en_pos) {
                return wall_cell(p, { pos: en_pos });
            } 
        },
        "empty_cell": {
            start: 5000, num: 1, cap: 10, rate: 5000,
            make_new: function(en_pos) {
                return empty_cell(p, { pos: en_pos });
            } 
        },
        "floater": {
            start: 1000, num: 3, cap: 7, rate: 7000,
            spacing: "dynamic",//100,
            make_new: function(en_pos) {
                return floater(p, { pos: en_pos });
            } 
        },
        /*
        "tkiller": {
            start: 1000, num: 1, cap: 5, rate: 20000,
            make_new: function(en_pos) {
                // target will get set later
                return tkiller(p, { 
					pos: en_pos, 
					mutation_info: game.get_mutation_info()
				});
            }
        },
        */
		"multiplier": {
			start:0, num: 10, cap: 20, rate: 20000,
			make_new: function(en_pos) {
				return multiplier(p, { pos : en_pos });
			}
		},
        /*
		"b_cell": {
			start:0, num: 1, cap: 1, rate: 999999,
			make_new: function(en_pos) {
				return b_cell(p, { pos : en_pos });
			}
		},
        */
        "background_object": {
            start:0, num: 8, cap: 8, rate: 999999, 
            spacing: p.width/5, gen_x: 500,
            gen_y: function() {
                return p.random(200, p.height - 180);
            },
            make_new: function(en_pos) {
                return background_object(p, { pos: en_pos });
            }
        },
    };

    // list of types of enemies
    var enemy_types = keys(gen_info);
    /*var random_type = function() {
        return random_from(enemy_types);//[p.floor(p.random(
                        //enemy_types.length))];
    };
    */

    // just some wrappers
    var start = function(type) {
        return gen_info[type].start;
    };
    var num = function(type) {
        return gen_info[type].num;
    };
    var cap = function(type) {
        return gen_info[type].cap;
    };
    var rate = function(type) {
        return gen_info[type].rate;
    };
    var spacing = function(type) {
        // dynamic spacing
        if(gen_info[type].spacing === "dynamic") {
            return p.width/num(type);
        }
        return gen_info[type].spacing;
    };
    var gen_x_pos = function(type) {
        return p.width + (gen_info[type].gen_x || 50);
    };
    var gen_y_pos = function(type) {
        if (gen_info[type].gen_y) {
            return gen_info[type].gen_y();
        }
        return p.floor(p.random(90, p.height-50));
    };
    var gen_speed = function(type) {
        return gen_info[type].gen_speed;
    };
    var make_new = function(type) {
        return gen_info[type].make_new;
    };
    var diminish = function(type) {
        return gen_info[type].diminish || false;
    }
    var gen_more = function(type) {
        if (diminish(type)) {
            if (num(type) > cap(type)) {
                gen_info[type].num = num(type)-1;
            }
        }
        else {
            if (num(type) < cap(type)) {
                gen_info[type].num = num(type)+1;
            }
        }
    };
	
	// Returns whether it is not too soon to generate another
	// object, based on last_obj
	var ok_to_generate = function() {
		if (last_obj) {
			if (last_obj.get_type() === "cell") {
				// 2 times width spacing
				return last_obj.get_pos().x < 
                    (gen_x_pos(last_obj.get_type()) - last_obj.get_width() * 2); 
			}
		}
		// else
		return true;
	};

    // --- public methods --- 
	
	//Should be called every time the game updates
	obj.update = function() {
		//game_objects = game.get_game_objects();
		distance = p.floor(game.get_distance());

        update_types();

        var enemy_type = random_from(enemy_types);//random_type();
        var num_enemies = count_enemy(enemy_type);

        // if there aren't enough of that enemy on the board
        if (num_enemies < num(enemy_type)
                // and some random factor
                && p.random(100) < (gen_speed(enemy_type) || default_gen_speed )
                // and we are ready to start making this enemy
                && distance >= start(enemy_type)) {
				//&& ok_to_generate()) {

			var enemy_y = gen_y_pos(enemy_type); 
			var enemy_pos = new p.PVector(gen_x_pos(enemy_type), enemy_y);
			
			var new_enemy = make_new(enemy_type)(enemy_pos);
			assert(new_enemy, "Error in generator.update()");

            // make sure it's far enough away from the last object
            // of its type
            if (!spaced_out_enough(new_enemy)) {
                return;
            }

            // make sure it's not overlapping anything else
            if (is_overlapping(new_enemy) 
                    && !new_enemy.is("background_object")) {
                //console.log("overlapped");
                return;
            }

			//Add the new enemy to game_objects
            game.add_object(new_enemy);
			
			// If b cell, must update b cells targets
			if (new_enemy.get_type() === "b_cell") {
                console.log("made new b_cell");
				game.set_b_cell_target(new_enemy);
			}
			
			last_obj = new_enemy;
		}

	};
	
	// --- private methods ---

    var update_types = function() {
        /*
        if (distance % 100 <= 0.5) {
            console.log(distance);
        }
        */
        // update nums for types based on rate
        for_each(
            enemy_types,
            function(type) {
                if (distance % rate(type) <= 0.1 
                        && distance >= 10) {
                    gen_more(type);
                    console.log("increased num of "+type+
                            "s to "+num(type));
                }
            }
        );
    };
    
    // returns how many of given enemy there are
    var count_enemy = function(enemy_type) {
        var n = 0;
        game.do_to_type(function(o) { n++; },
                enemy_type, true);
        return n;
    }

    // returns true if the enemy overlaps any game objects
    var is_overlapping = function(enemy) {
        var overlap = false;
        var check_overlap = function(obj) {
            if (game.check_circle_collision(enemy, obj)) {
                overlap = true;
            }
        };
        game.do_to_type(check_overlap, "particle", false);
        game.do_to_type(check_overlap, "cell", false);
        game.do_to_type(check_overlap, "enemy", false);
        game.do_to_type(check_overlap, "wall_segment", false);
        return overlap;
    };

    // returns true if the new enemy if far enough away (in x coord)
    // from the rightmost of its type
    // or if there is no spacing requirement for that type
    var spaced_out_enough = function(new_enemy) {
        var to_return = true;
        // if there is spacing defined for this type
        if (spacing(new_enemy.get_type())) {
            var min_dist = 99999;
            // find the closest object of the type
            game.do_to_type(
                function(o) {
                    var dist = new_enemy.get_pos().dist(o.get_pos());
                    if (dist < min_dist) {
                        min_dist = dist; 
                        // check if it is too close
                        if (dist < spacing(new_enemy.get_type())) {
                            to_return = false;
                        }
                    }
                },
                new_enemy.get_type(), true
            );
        }
        return to_return;
    };



    /*
            // return true if it is far enough apart from rightmost of its type
            return new_enemy.get_pos().dist(
                    rightmost(new_enemy.get_type()).get_pos())
                    > spacing(new_enemy.get_type());
        }
        return true;
    };

    /*
    var rightmost = function(type) {
        var rightmost_x = 0;
        var rightmost;
        game.do_to_type(
            function(o) {
                if (o.get_pos().x > rightmost_x) {
                    rightmost = o;
                    rightmost_x = o.get_pos().x;
                }
            },
            type, true
        );
        return rightmost;
    };
    */
	
    // returns an object:
    //      cell: number of cells on the screen
    //      wall_cell: number of wall_cells
    //      empty_cell: number of empty_cells
    //      tkiller: number of tkillers
    //      floater: number of floaters
	var get_enemies = (function() {
		var total = 0;
		
		// These are the types to check
		//var types = ["cell", "wall_cell", "empty_cell",
         //       "floater", "tkiller"];
		
		//Checks if an element is in an array
		var member = function(arr, elem) {
			return (arr.indexOf(elem) != -1);
		};

        var get_em = function() {
            var enemies = { "cell":0, "wall_cell":0,
                "empty_cell":0, "floater":0, "tkiller":0,
				"multiplier":0, "b_cell":0};

            // increment counter for each object
            var incr = function(o) {
                enemies[o.get_type()] += 1;
            };
            game.do_to_type(incr, "cell", false);
            game.do_to_type(incr, "enemy", false);
        };
            /*for (var type in enemies) {
                if (enemies.hasOwnProperty(type)) {
                    game.do_to_type(
                        function(o) {
                            enemies[type] += 1;
                        },
                        type, true);
                }
            }
            /*for (var i = 0; i < game_objects.length; i++) {
                var lst = game_objects[i];
                for (var j = 0; j < lst.length; j++) {
                    var obj = lst[j];
                    if (member(types, obj.get_type())) {
                        total++;
                    }
                }
            }
            return total;
            */

		return get_em;
    }());

    return obj;
};
