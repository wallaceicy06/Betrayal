/**
 * PlayerController
 *
 * @description :: Server-side logic for managing players
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

	create: function(req, res) {
    var newPlayer;

    Player.create({name: req.body.name,
                   game: req.body.game,
                   room: req.body.room,
                   locX: 64,
                   locY: 64,
                   socket: req.socket.id,
                   color: req.body.color,
                   maxHealth: 3,
                   curHealth: 3,
                   speed: 5,
                   weapon: 1,
                   relics: 0,
                   keys: 0,
                   isTraitor: false})
      .then(function(player) {
        newPlayer = player;

        Room.subscribe(req, newPlayer.room, ['message']);

        return Player.find({game: newPlayer.game});
      })
      .then(function(players) {
        Player.watch(req);
        Player.subscribe(req, players, ['update', 'destroy']);

        /* Publish player creation */
        Player.publishCreate(newPlayer);

        res.json(newPlayer);
      })
      .catch(function(err) {
        console.log(err);
        res.json(err);
      });
  },

  update: function(req, res) {
    Player.update(req.param('id'), req.body)
      .then(function(players) {
        var updatedPlayer = players[0];

        if (req.body.locX !== undefined && req.body.locY !== undefined) {
          Room.message(updatedPlayer.room, {id: updatedPlayer.id,
                                            verb: 'playerUpdated',
                                            data: req.body});
        } else {
          Player.publishUpdate(updatedPlayer.id, req.body);
        }

        res.json();
      })
      .catch(function(err) {
        console.log(err);
        res.json(err);
      });
  },

  destroy: function(req, res) {
    Player.findOne(req.param('id'))
      .then(function(player) {
        if (player.keys > 0) {
          for (var i = 0; i < player.keys; i++) {
            var tileW = Room.dimensions.tileW;
            Item.create({type: 'key',
                         stat: 'keys',
                         amount: 1,
                         room: player.room,
                         gridX: Math.round(player.locX/tileW),
                         gridY: Math.round(player.locY/tileW)})
              .then(function(item) {
                Room.message(item.room, {verb: 'itemCreated', item: item});
              })
              .catch(function(err) {
                console.log(err);
                res.json(err);
                return;
              });
          }
          Game.findOne(player.game)
            .then(function(game) {
              Game.update(game.id, {keysRemaining: game.keysRemaining + player.keys}, function(err, game) {});
            })
            .catch(function (err) {
              console.log(err);
              res.json(err);
            });
        }
        Player.destroy(req.param('id'))
          .then(function(player) {
            Player.publishDestroy(req.param('id'));
            res.json(player);
          })
      })
  },

  changeRoom: function(req, res) {
    var oldRoom;
    var player;

    Player.findOne(req.params.id).populate('room')
      .then(function(player) {
        oldRoom = player.room;

        return Player.update(player.id, {room: req.body.room});
      })
      .then(function(players) {
        player = players[0];

        return Room.findOne(player.room).populate('players');
      })
      .then(function(room) {
        /*
         * Unsubscribe player from the room they used to be in on the 'message'
         * context. It is super important to pass the 'message' context
         * otherwise the player will never be able to subscribe to a room
         * again. Subscribe them to their new room under the message context.
         */
        Room.unsubscribe(req, oldRoom, ['message']);
        Room.subscribe(req, room.id, ['message']);

        Player.publishUpdate(player.id, {room: player.room});

        /* If we entered the entryway, see if the heroes have won */
        if (room.name === 'entryway' && !player.isTraitor) {
          Game.findOne(room.game).populate('players')
            .then(function(game) {
              if (game.keysRemaining === 0) {
                var won = true;
                for (var i = 0; i < game.players.length; i++) {
                  var p = game.players[i];
                  if (!p.isTraitor && p.room !== room.id) {
                    won = false;
                  }
                }
                if (won) {
                  Game.message(game.id, {verb: 'heroesWon'});
                }
              }
            })
        }

        res.json(room.players);
      })
      .catch(function(err) {
        console.log(err);
        res.json(err);
      });
  },

  adjustStat: function(req, res) {
    var updateObj = {};
    updateObj[req.body.stat] = req.body.newValue;

    Player.update(req.params.id, updateObj, function (err, updatedPlayers) {
      if (err) {
        console.log(err);
        res.json(err);
        return;
      }
      if (updatedPlayers.length > 0) {
        Player.publishUpdate(updatedPlayers[0].id, updateObj);
      } else {
        console.log("Tried to update a player that doesn't exist");
      }
    });
  },

  attack: function(req, res) {
    var player;

    Player.findOne(req.params.id)
      .then(function(p) {
        player = p;

        return Room.findOne(player.room).populate('players');
      })
      .then(function(room) {
        var attackRegion = Player.attackRegion(player.locX, player.locY);
        for (var i = 0; i < room.players.length; i++) {
          var otherPlayer = room.players[i];
          if (otherPlayer.id !== player.id
              && otherPlayer.locX < attackRegion.maxX
              && otherPlayer.locX > attackRegion.minX
              && otherPlayer.locY < attackRegion.maxY
              && otherPlayer.locY > attackRegion.minY) {
            /* Roll dice for combat based on weapon strength */
            var myRoll = 0;
            for (var j = 0; j < player.weapon; j++) {
              myRoll += Math.floor(Math.random() * 3); //0, 1, or 2
            }
            var otherRoll = 0;
            for (var j = 0; j < otherPlayer.weapon; j++) {
              otherRoll += Math.floor(Math.random() * 3);
            }
            var damage = myRoll - otherRoll;
            if (damage <= 0) {
              Game.message(player.game,
                           {message: player.name + " attacked "
                                     + otherPlayer.name
                                     + "! They were unharmed.",
                            verb: 'chat'});
            }
            else {
              Game.message(player.game, {message: player.name + " attacked "
                                                  + otherPlayer.name + "! "
                                                  + otherPlayer.name + " took "
                                                  + damage + " damage.",
                                         verb: 'chat'});
              var updateObj = {curHealth: otherPlayer.curHealth - damage};
              Player.update(otherPlayer.id, updateObj);
              Player.publishUpdate(otherPlayer.id, updateObj);
            }
          }
        }
        res.json();
      })
      .catch(function(err) {
        console.log(err);
        res.json(err);
      });
  },

  subscribe: function(req, res) {
    Player.findOne(req.params.id)
      .then(function(player) {
        Player.subscribe(req, player, ['update', 'destroy']);
      })
      .catch(function(err) {
        console.log(err);
        res.json(err);
      });
  }
};

