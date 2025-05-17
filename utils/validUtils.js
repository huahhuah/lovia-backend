function isUndefined(value) {
  return value === undefined;
}

function isNotValidString(value) {
  return typeof value !== "string" || value.trim().length === 0 || value === "";
}

function isNotValidInteger(value) {
  return typeof value !== "number" || value < 0 || value % 1 !== 0;
}

function isNotValidUuid(value) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
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
  const date = new Date(value);
  const today = new Date();
  if (isNaN(date.getTime())){
    return false;
  }
  today.setHours(0,0,0,0);
  date.setHours(0,0,0,0);
  return date < today;
}

function isValidImage(url) {
  return typeof url === "string" && (url.endsWith(".jpg") || url.endsWith(".png"));
}

function isValidDate(dateStr) {
  return !isNaN(Date.parse(dateStr));
}

module.exports = {
  isNotValidInteger,
  isNotValidString,
  isUndefined,
  isNotValidUuid,
  isNotValidUrl,
  isNotValidGender,
  isTooLong,
  isValidBirthday,
  isValidImage,
  isValidDate,

};
