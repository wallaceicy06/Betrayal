/**
* Gateway.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

  autoWatch: false,

  autosubscribe: ['update'],

  attributes: {
    roomFrom: {model: 'room',
               required: true},
    roomTo: {model: 'room',
             required: true},
    direction: {type: 'string',
			          required: true},
    locked: {type: 'boolean',
             required: true,
             defaultsTo: false}
  }
};

