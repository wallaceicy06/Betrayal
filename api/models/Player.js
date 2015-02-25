/**
* Player.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

  autoWatch: false,

  autoSubscribe: ['destroy'],

  attributes: {
    name: {type: 'string',
           required: true},
    game: {model: 'game',
           required: true},
    room: {model: 'room',
           required: true},
    locX: {type: 'integer',
           required: true},
    locY: {type: 'integer',
           required: true},
    socket: {type: 'string',
             required: true},
    color: {type: 'string',
             required: true},
    maxHealth: {type: 'integer',
                required: true},
    curHealth: {type: 'integer',
                required: true},
    weapon: {type: 'integer',
             required: true},
    relics: {type: 'integer',
             required: true},
    speed: {type: 'integer',
            required: true}
  }
};

