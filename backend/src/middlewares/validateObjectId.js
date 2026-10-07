const { invalidInput } = require('../utils/errors');
const { isObjectIdString } = require('../utils/objectId');

// Un identifiant malformé donne 400 avant toute requête MongoDB.
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    if (!isObjectIdString(req.params[paramName])) {
      return next(invalidInput(`Identifiant malformé : ${req.params[paramName]}`));
    }
    return next();
  };
}

module.exports = validateObjectId;
