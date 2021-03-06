/**
* Player.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

  autoWatch: false,

  autosubscribe: ['update', 'destroy', 'message'],

  attributes: {
    name: {type: 'string',
           required: true},
    game: {model: 'game',
           required: true},
    room: {model: 'room',
           required: true},
    locX: {type: 'integer',
           required: true,
           defaultsTo: sails.config.gameconfig.playerDefaults.locX},
    locY: {type: 'integer',
           required: true,
           defaultsTo: sails.config.gameconfig.playerDefaults.locY},
    socket: {type: 'string',
             required: true},
    color: {type: 'string',
            required: true,
            defaultsTo: sails.config.gameconfig.playerDefaults.color},
    sprite: {type: 'string',
             required: true,
             defaultsTo: sails.config.gameconfig.playerDefaults.sprite},
    health: {type: 'integer',
                required: true,
                defaultsTo: sails.config.gameconfig.playerDefaults.health},
    weapon: {type: 'integer',
             required: true,
             defaultsTo: sails.config.gameconfig.playerDefaults.weapon},
    relics: {type: 'integer',
             required: true,
             defaultsTo: sails.config.gameconfig.playerDefaults.relics},
    keys: {type: 'integer',
           required: true,
           defaultsTo: sails.config.gameconfig.playerDefaults.keys},
    speed: {type: 'integer',
            required: true,
            defaultsTo: sails.config.gameconfig.playerDefaults.speed},
    isTraitor: {type: 'boolean',
                required: true,
                defaultsTo: sails.config.gameconfig.playerDefaults.isTraitor}
  },

  ATTACK_RADIUS: 42,

  defaults: sails.config.gameconfig.playerDefaults,

  assignColor: function(playerNum) {
    var colors = sails.config.gameconfig.playerColors;

    if (playerNum < colors.length) {
      return colors[playerNum];
    } else {
      return colors[0];
    }
  },

  afterUpdate: function(player, cb) {
    if (player.health < 1) {
      if (!player.isTraitor) { //If this is a hero, they are dead
        sails.log.info('destroying ' + player.name);
        Player.destroy(player.id);
        Player.publishDestroy(player.id, {});
      } else { //The traitor is stunned while they regenerate instead of dying
        Player.message(player.id, {verb: 'stunned'});
        Player.update(player.id, {health: 3})
          .then(function(updatedPlayer) {
            Player.publishUpdate(player.id, {health: 3});
          })
          .catch(function(err) {
            sails.log.error(err);
          });
      }
    }
    cb();
  },

  afterDestroy: function(players, cb) {
    var tileW = Room.dimensions.tileW;

    _.each(players, function(player) {

      Game.findOne(player.game)
        .then(function(game) {
          if (game == undefined) {
            throw new sails.promise.CancellationError();
          }

          if (game.haunt !== undefined && !player.isTraitor) {
            Game.message(player.game, {verb: 'traitorWon'});
          }

          return [game, Player.count({game: player.game})];
        })
        .spread(function(game, count) {
          if (game.active === false) {
            return [];
          } else if (game.haunt === undefined && count < Game.minPlayers) {
            return Game.destroy(player.game);
          } else if (game.haunt !== undefined && count === 0) {
            return Game.destroy(player.game);
          } else {
            return [];
          }
        })
        .then(function(destroyed) {
          _.each(destroyed, function(game) {
            Game.publishDestroy(game.id);
          });
        })
        .catch(sails.promise.CancellationError, function(err) {
          sails.log.warn("Player afterDestroy cancelled. No game was found.");
        })
        .catch(function(err) {
          sails.log.error(err);
        });
    });

    cb();
  },

  attackRegion: function(locX, locY) {
    return {
      minX: locX - Player.ATTACK_RADIUS,
      maxX: locX + Player.ATTACK_RADIUS,
      minY: locY - Player.ATTACK_RADIUS,
      maxY: locY + Player.ATTACK_RADIUS
    };
  }
};

