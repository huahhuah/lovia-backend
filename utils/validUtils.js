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

function isNotValidUrl(value) {
  try {
    new URL(value);
    return false;
  } catch (_) {
    return true;
  }
}

function isNotValidGender(value) {
  return !["male", "female", "other"].includes(value);
}

function isTooLong(str, maxLength) {
  return typeof str === "string" && str.length > maxLength;
}

function isValidBirthday(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    console.warn("❌ 生日格式不符合 YYYY-MM-DD");
    return false;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const isValidDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  if (!isValidDate) {
    console.warn(" 日期無效：可能是不存在的日期");
  } else if (date > today) {
    console.warn(" 日期超出今天");
  }

  return isValidDate && date <= today;
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
  isValidDate
};
