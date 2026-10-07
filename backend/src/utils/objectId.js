// Un ObjectId MongoDB sérialisé est exactement 24 caractères hexadécimaux.
// On n'utilise pas mongoose.isValidObjectId car il accepte aussi des chaînes de 12 caractères.
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function isObjectIdString(value) {
  return typeof value === 'string' && OBJECT_ID_RE.test(value);
}

module.exports = { isObjectIdString };
