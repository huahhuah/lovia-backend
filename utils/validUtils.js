function isUndefined(value) {
  return value === undefined;
}

function isNotValidSting(value) {
  return typeof value !== "string" || value.trim().length === 0 || value === "";
}

function isNotValidInteger(value) {
  return typeof value !== "number" || value < 0 || value % 1 !== 0;
}

function isNotValidUuid(value) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  return !uuidRegex.test(value);
}

function isNotValidUrl(value){
  try{
    new URL(value);
    return false;
  } catch (_){
    return true;
  }
}

function isNotValidGender(value){
  return !['male','female','other'].includes(value);
}

function isTooLong(value, maxLength){
  return typeof value !== 'string' || value.length >maxLength;
}

function isValidBirthday(value){
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(value);
}

module.exports = {
  isNotValidInteger,
  isNotValidSting,
  isUndefined,
  isNotValidUuid,
  isNotValidUrl,
  isNotValidGender,
  isTooLong,
  isValidBirthday
};
